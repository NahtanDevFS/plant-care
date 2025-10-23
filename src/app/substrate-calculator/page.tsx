// src/app/substrate-calculator/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./SubstrateCalculator.module.css"; // Asegúrate de crear este archivo

type SubstrateComponent = {
  id: number;
  name: string;
  ph_value: number;
  description?: string | null;
};

type SelectedComponent = {
  component_id: number;
  name: string; // Guardamos el nombre para mostrarlo fácilmente
  ph_value: number; // Guardamos el pH para el cálculo
  parts: number;
};

type UserMix = {
  id: number;
  mix_name: string;
  components: SelectedComponent[]; // Asumimos que guardamos en este formato o similar
  calculated_ph: number;
  notes?: string | null;
  created_at: string;
};

export default function SubstrateCalculatorPage() {
  const supabase = createClient();
  const [allComponents, setAllComponents] = useState<SubstrateComponent[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<
    SelectedComponent[]
  >([]);
  const [calculatedPh, setCalculatedPh] = useState<number | null>(null);
  const [mixName, setMixName] = useState("");
  const [mixNotes, setMixNotes] = useState("");
  const [savedMixes, setSavedMixes] = useState<UserMix[]>([]);
  const [loadingComponents, setLoadingComponents] = useState(true);
  const [loadingMixes, setLoadingMixes] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cargar componentes disponibles al montar
  useEffect(() => {
    const fetchComponents = async () => {
      setLoadingComponents(true);
      const { data, error } = await supabase
        .from("substrate_components")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching components:", error);
        setError("Error al cargar componentes de sustrato.");
      } else {
        setAllComponents(data || []);
      }
      setLoadingComponents(false);
    };
    fetchComponents();
  }, [supabase]);

  // Cargar mezclas guardadas por el usuario
  useEffect(() => {
    const fetchSavedMixes = async () => {
      setLoadingMixes(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoadingMixes(false);
        // Podrías mostrar un mensaje o simplemente no cargar nada
        return;
      }

      // *** IMPORTANTE: SIN RLS, ESTA CONSULTA TRAERÍA TODAS LAS MEZCLAS ***
      // *** NECESITAS FILTRAR POR user_id MANUALMENTE ***
      const { data, error } = await supabase
        .from("user_substrate_mixes")
        .select("*")
        .eq("user_id", user.id) // <--- FILTRO MANUAL ESENCIAL SIN RLS
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching saved mixes:", error);
        setError("Error al cargar mezclas guardadas.");
      } else {
        // Asegurarse de que 'components' sea un array
        const mixes = (data || []).map((mix) => ({
          ...mix,
          components: Array.isArray(mix.components) ? mix.components : [],
        }));
        setSavedMixes(mixes);
      }
      setLoadingMixes(false);
    };
    fetchSavedMixes();
  }, [supabase]);

  // Calcular pH cuando cambian los componentes seleccionados o sus partes
  useEffect(() => {
    if (selectedComponents.length === 0) {
      setCalculatedPh(null);
      return;
    }

    let totalParts = 0;
    let weightedPhSum = 0;

    selectedComponents.forEach((item) => {
      const parts = Number(item.parts) || 0;
      if (parts > 0) {
        totalParts += parts;
        weightedPhSum += parts * item.ph_value;
      }
    });

    if (totalParts > 0) {
      const averagePh = weightedPhSum / totalParts;
      setCalculatedPh(Number(averagePh.toFixed(1))); // Redondear a 1 decimal
    } else {
      setCalculatedPh(null);
    }
  }, [selectedComponents]);

  const handleSelectComponent = (component: SubstrateComponent) => {
    // Añadir si no está, quitar si ya está
    setSelectedComponents((prev) => {
      const exists = prev.some((c) => c.component_id === component.id);
      if (exists) {
        return prev.filter((c) => c.component_id !== component.id);
      } else {
        return [
          ...prev,
          {
            component_id: component.id,
            name: component.name,
            ph_value: component.ph_value,
            parts: 1, // Inicia con 1 parte por defecto
          },
        ];
      }
    });
  };

  const handlePartsChange = (componentId: number, value: string) => {
    const newParts = parseInt(value, 10);
    setSelectedComponents((prev) =>
      prev.map((c) =>
        c.component_id === componentId
          ? { ...c, parts: isNaN(newParts) || newParts < 0 ? 0 : newParts }
          : c
      )
    );
  };

  const getTotalParts = useMemo(() => {
    return selectedComponents.reduce(
      (sum, item) => sum + (Number(item.parts) || 0),
      0
    );
  }, [selectedComponents]);

  const getPercentage = (parts: number) => {
    const total = getTotalParts;
    if (total === 0 || parts === 0) return 0;
    return ((parts / total) * 100).toFixed(0);
  };

  const handleSaveMix = async () => {
    if (!mixName.trim()) {
      setError("Por favor, dale un nombre a tu mezcla.");
      return;
    }
    if (selectedComponents.length === 0 || getTotalParts <= 0) {
      setError("Añade componentes y define sus proporciones (partes > 0).");
      return;
    }
    if (calculatedPh === null) {
      setError("No se pudo calcular el pH. Revisa las proporciones.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Necesitas iniciar sesión para guardar mezclas.");
      setIsSaving(false);
      return;
    }

    // Prepara los datos a guardar (solo id y parts)
    const componentsToSave = selectedComponents
      .filter((c) => c.parts > 0) // Solo guardar componentes con partes > 0
      .map(({ component_id, parts }) => ({ component_id, parts }));

    try {
      // *** IMPORTANTE: SIN RLS, CUALQUIERA PODRÍA INSERTAR ***
      // Idealmente, esto se haría en una API route que verifique al usuario
      // O usar RLS policies que aseguren auth.uid() = user_id
      const { data, error: insertError } = await supabase
        .from("user_substrate_mixes")
        .insert([
          {
            user_id: user.id, // Esencial incluir esto
            mix_name: mixName.trim(),
            components: componentsToSave,
            calculated_ph: calculatedPh,
            notes: mixNotes.trim() || null,
          },
        ])
        .select() // Devuelve el registro insertado
        .single(); // Esperamos solo uno

      if (insertError) throw insertError;

      // Añadir la nueva mezcla a la lista localmente
      if (data) {
        // Necesitamos mapear los component_id a nombres para mostrar
        const newMixFormatted: UserMix = {
          ...data,
          components: (
            data.components as { component_id: number; parts: number }[]
          ).map((comp) => {
            const componentInfo = allComponents.find(
              (c) => c.id === comp.component_id
            );
            return {
              ...comp,
              name: componentInfo?.name || "Desconocido",
              ph_value: componentInfo?.ph_value || 0,
            };
          }),
        };
        setSavedMixes((prev) => [newMixFormatted, ...prev]);
      }

      setSuccessMessage(`Mezcla "${mixName.trim()}" guardada!`);
      // Limpiar formulario opcionalmente
      // setMixName("");
      // setMixNotes("");
      // setSelectedComponents([]);
    } catch (err) {
      console.error("Error saving mix:", err);
      setError(
        err instanceof Error ? err.message : "Error desconocido al guardar."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMix = async (mixId: number) => {
    if (!confirm("¿Seguro que quieres eliminar esta mezcla guardada?")) {
      return;
    }
    setError(null);
    setSuccessMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Necesitas iniciar sesión.");
      return;
    }

    try {
      // *** IMPORTANTE: SIN RLS, CUALQUIERA PODRÍA BORRAR SI CONOCE EL ID ***
      // Se debe verificar user_id
      const { error: deleteError } = await supabase
        .from("user_substrate_mixes")
        .delete()
        .eq("id", mixId)
        .eq("user_id", user.id); // <--- FILTRO MANUAL ESENCIAL

      if (deleteError) throw deleteError;

      setSavedMixes((prev) => prev.filter((mix) => mix.id !== mixId));
      setSuccessMessage("Mezcla eliminada.");
    } catch (err) {
      console.error("Error deleting mix:", err);
      setError(err instanceof Error ? err.message : "Error al eliminar.");
    }
  };

  // --- Renderizado ---
  return (
    <div className={styles.pageContainer}>
      <h1>🧪 Calculadora de Sustrato</h1>
      <p>Crea y guarda tus mezclas de sustrato personalizadas.</p>

      {error && <p className={styles.errorMessage}>{error}</p>}
      {successMessage && (
        <p className={styles.successMessage}>{successMessage}</p>
      )}

      <div className={styles.calculatorSection}>
        <div className={styles.componentSelection}>
          <h2>1. Selecciona Componentes</h2>
          {loadingComponents ? (
            <p>Cargando componentes...</p>
          ) : (
            <div className={styles.componentGrid}>
              {allComponents.map((comp) => (
                <button
                  key={comp.id}
                  onClick={() => handleSelectComponent(comp)}
                  className={`${styles.componentButton} ${
                    selectedComponents.some((c) => c.component_id === comp.id)
                      ? styles.selected
                      : ""
                  }`}
                  title={comp.description || `pH: ${comp.ph_value}`}
                >
                  {comp.name}{" "}
                  <span className={styles.componentPh}>
                    (pH {comp.ph_value.toFixed(1)})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.mixConfiguration}>
          <h2>2. Define Proporciones (Partes)</h2>
          {selectedComponents.length === 0 ? (
            <p className={styles.placeholder}>
              Selecciona componentes de la lista de la izquierda.
            </p>
          ) : (
            <div className={styles.selectedComponentsList}>
              {selectedComponents.map((selComp) => (
                <div key={selComp.component_id} className={styles.selectedItem}>
                  <span className={styles.selectedItemName}>
                    {selComp.name}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.5" // Permite medias partes
                    value={selComp.parts}
                    onChange={(e) =>
                      handlePartsChange(selComp.component_id, e.target.value)
                    }
                    className={styles.partsInput}
                  />
                  <span> partes ({getPercentage(selComp.parts)}%)</span>
                  <button
                    onClick={() =>
                      handleSelectComponent(
                        allComponents.find(
                          (c) => c.id === selComp.component_id
                        )!
                      )
                    }
                    className={styles.removeButton}
                    title="Quitar componente"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <div className={styles.totalParts}>
                Total Partes: {getTotalParts.toFixed(1)}
              </div>
            </div>
          )}

          <div className={styles.phResult}>
            <h2>3. Resultado Estimado</h2>
            <div className={styles.phIndicatorContainer}>
              <div className={styles.phScale}>
                <span className={styles.phLabelAcid}>Ácido</span>
                <span className={styles.phLabelNeutral}>Neutro</span>
                <span className={styles.phLabelAlkaline}>Alcalino</span>
              </div>
              <div className={styles.phBarTrack}>
                {calculatedPh !== null && (
                  <div
                    className={styles.phBarValue}
                    style={{ left: `${((calculatedPh - 3) / 8) * 100}%` }} // Ajusta rango 3-11 pH
                    title={`pH Estimado: ${calculatedPh}`}
                  ></div>
                )}
              </div>
              <div className={styles.phValueDisplay}>
                pH Estimado:{" "}
                {calculatedPh !== null ? calculatedPh.toFixed(1) : "N/A"}
              </div>
            </div>
          </div>

          <div className={styles.saveSection}>
            <h2>4. Guardar Mezcla (Opcional)</h2>
            <input
              type="text"
              placeholder="Nombre de la mezcla (ej. Para Suculentas)"
              value={mixName}
              onChange={(e) => setMixName(e.target.value)}
              className={styles.mixNameInput}
              disabled={selectedComponents.length === 0 || getTotalParts <= 0}
            />
            <textarea
              placeholder="Notas adicionales (opcional)..."
              value={mixNotes}
              onChange={(e) => setMixNotes(e.target.value)}
              className={styles.mixNotesInput}
              rows={2}
              disabled={selectedComponents.length === 0 || getTotalParts <= 0}
            />
            <button
              onClick={handleSaveMix}
              disabled={
                isSaving ||
                selectedComponents.length === 0 ||
                !mixName.trim() ||
                getTotalParts <= 0
              }
              className={styles.saveButton}
            >
              {isSaving ? "Guardando..." : "💾 Guardar Mezcla"}
            </button>
          </div>
        </div>
      </div>

      <hr className={styles.separator} />

      <div className={styles.savedMixesSection}>
        <h2>📚 Mis Mezclas Guardadas</h2>
        {loadingMixes ? (
          <p>Cargando mezclas...</p>
        ) : savedMixes.length === 0 ? (
          <p className={styles.placeholder}>
            No tienes mezclas guardadas todavía.
          </p>
        ) : (
          <div className={styles.savedMixesGrid}>
            {savedMixes.map((mix) => (
              <div key={mix.id} className={styles.savedMixCard}>
                <div className={styles.savedMixHeader}>
                  <h3>{mix.mix_name}</h3>
                  <button
                    onClick={() => handleDeleteMix(mix.id)}
                    className={styles.deleteMixButton}
                    title="Eliminar mezcla"
                  >
                    🗑️
                  </button>
                </div>

                <p className={styles.savedMixPh}>
                  pH Estimado: {mix.calculated_ph.toFixed(1)}
                </p>
                <ul>
                  {mix.components.map((comp, index) => (
                    <li key={index}>
                      {comp.parts} parte(s) de {comp.name}
                    </li>
                  ))}
                </ul>
                {mix.notes && (
                  <p className={styles.savedMixNotes}>
                    <em>Notas:</em> {mix.notes}
                  </p>
                )}
                <p className={styles.savedMixDate}>
                  Guardada el:{" "}
                  {new Date(mix.created_at).toLocaleDateString("es-ES")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
