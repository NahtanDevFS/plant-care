// src/app/substrate-calculator/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./SubstrateCalculator.module.css";
// --- 1. IMPORTAR ÍCONOS ---
import { FiPercent, FiSave, FiArchive, FiTrash2 } from "react-icons/fi";
import { GiPlantSeed } from "react-icons/gi";

type SubstrateComponent = {
  id: number;
  name: string;
  ph_value: number;
  description?: string | null;
};

type SelectedComponent = {
  component_id: number;
  name: string;
  ph_value: number;
  parts: number;
};

type UserMix = {
  id: number;
  mix_name: string;
  components: SelectedComponent[];
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
  // Estado para el valor del dropdown
  const [componentToAdd, setComponentToAdd] = useState<string>(""); // Guarda el ID como string

  // --- (useEffect para fetchComponents - sin cambios) ---
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

  // --- (useEffect para fetchSavedMixes - sin cambios) ---
  useEffect(() => {
    const fetchSavedMixes = async () => {
      setLoadingMixes(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoadingMixes(false);
        return;
      }
      const { data, error } = await supabase
        .from("user_substrate_mixes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching saved mixes:", error);
        setError("Error al cargar mezclas guardadas.");
      } else {
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

  // --- (useEffect para calcular pH - sin cambios) ---
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
      setCalculatedPh(Number(averagePh.toFixed(1)));
    } else {
      setCalculatedPh(null);
    }
  }, [selectedComponents]);

  // --- MODIFICADO: Añadir componente desde el dropdown ---
  const handleAddComponent = () => {
    if (!componentToAdd) return; // No hacer nada si no hay selección

    const componentId = parseInt(componentToAdd, 10);
    const component = allComponents.find((c) => c.id === componentId);

    // Añadir solo si existe y no está ya en la lista
    if (
      component &&
      !selectedComponents.some((sc) => sc.component_id === componentId)
    ) {
      setSelectedComponents((prev) => [
        ...prev,
        {
          component_id: component.id,
          name: component.name,
          ph_value: component.ph_value,
          parts: 1, // Inicia con 1 parte
        },
      ]);
    }
    // Resetear dropdown después de añadir
    setComponentToAdd("");
  };

  // --- NUEVO: Remover componente de la lista de mezcla ---
  const handleRemoveComponent = (componentIdToRemove: number) => {
    setSelectedComponents((prev) =>
      prev.filter((c) => c.component_id !== componentIdToRemove)
    );
  };

  // --- (handlePartsChange - sin cambios) ---
  const handlePartsChange = (componentId: number, value: string) => {
    const newParts = parseFloat(value) || 0; // Permite decimales
    setSelectedComponents((prev) =>
      prev.map((c) =>
        c.component_id === componentId
          ? { ...c, parts: newParts < 0 ? 0 : newParts } // Evita negativos
          : c
      )
    );
  };

  // --- (getTotalParts - sin cambios) ---
  const getTotalParts = useMemo(() => {
    return selectedComponents.reduce(
      (sum, item) => sum + (Number(item.parts) || 0),
      0
    );
  }, [selectedComponents]);

  // --- (getPercentage - sin cambios) ---
  const getPercentage = (parts: number) => {
    const total = getTotalParts;
    if (total === 0 || parts === 0) return "0";
    return ((parts / total) * 100).toFixed(0);
  };

  // --- (handleSaveMix - sin cambios) ---
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
    const componentsToSave = selectedComponents
      .filter((c) => c.parts > 0)
      .map(({ component_id, parts }) => ({ component_id, parts }));
    try {
      const { data, error: insertError } = await supabase
        .from("user_substrate_mixes")
        .insert([
          {
            user_id: user.id,
            mix_name: mixName.trim(),
            components: componentsToSave,
            calculated_ph: calculatedPh,
            notes: mixNotes.trim() || null,
          },
        ])
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) {
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
    } catch (err) {
      console.error("Error saving mix:", err);
      setError(
        err instanceof Error ? err.message : "Error desconocido al guardar."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // --- (handleDeleteMix - sin cambios) ---
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
      const { error: deleteError } = await supabase
        .from("user_substrate_mixes")
        .delete()
        .eq("id", mixId)
        .eq("user_id", user.id);
      if (deleteError) throw deleteError;
      setSavedMixes((prev) => prev.filter((mix) => mix.id !== mixId));
      setSuccessMessage("Mezcla eliminada.");
    } catch (err) {
      console.error("Error deleting mix:", err);
      setError(err instanceof Error ? err.message : "Error al eliminar.");
    }
  };

  // --- Componentes disponibles que AÚN NO están seleccionados ---
  const availableComponents = useMemo(() => {
    return allComponents.filter(
      (comp) => !selectedComponents.some((sel) => sel.component_id === comp.id)
    );
  }, [allComponents, selectedComponents]);

  // --- Renderizado ---
  return (
    <div className={styles.pageContainer}>
      {/* --- 2. ÍCONO REEMPLAZADO --- */}
      <h1>
        <FiPercent /> Calculadora de Sustrato
      </h1>
      <p>Crea y guarda tus mezclas de sustrato personalizadas.</p>

      {error && <p className={styles.errorMessage}>{error}</p>}
      {successMessage && (
        <p className={styles.successMessage}>{successMessage}</p>
      )}

      <div className={styles.calculatorSection}>
        {/* --- Columna Izquierda: Añadir Componentes --- */}
        <div className={styles.componentSelection}>
          <h2>1. Añadir Componentes</h2>
          {loadingComponents ? (
            <p>Cargando componentes...</p>
          ) : (
            <div className={styles.addComponentArea}>
              <select
                value={componentToAdd}
                onChange={(e) => setComponentToAdd(e.target.value)}
                className={styles.componentSelect}
              >
                <option value="">-- Elige un componente --</option>
                {availableComponents.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name} (pH {comp.ph_value.toFixed(1)})
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddComponent}
                disabled={!componentToAdd}
                className={styles.addButton}
              >
                Añadir a la Mezcla
              </button>
            </div>
          )}
          {/* Mostrar los componentes ya añadidos aquí como referencia */}
          {selectedComponents.length > 0 && (
            <div className={styles.addedComponentsInfo}>
              <h4>Componentes en la mezcla:</h4>
              <ul>
                {/* --- 3. ÍCONO AÑADIDO --- */}
                {selectedComponents.map((c) => (
                  <li key={c.component_id}>
                    <GiPlantSeed /> {c.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* --- Columna Derecha: Configuración y Resultados --- */}
        <div className={styles.mixConfiguration}>
          <h2>2. Define Proporciones (Partes)</h2>
          {selectedComponents.length === 0 ? (
            <p className={styles.placeholder}>
              Añade componentes usando el selector de la izquierda.
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
                    step="0.5"
                    value={selComp.parts}
                    onChange={(e) =>
                      handlePartsChange(selComp.component_id, e.target.value)
                    }
                    className={styles.partsInput}
                  />
                  <span> partes ({getPercentage(selComp.parts)}%)</span>
                  <button
                    onClick={() => handleRemoveComponent(selComp.component_id)} // Usar la nueva función
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

          {/* --- (Indicador de pH - sin cambios) --- */}
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
                    style={{ left: `${((calculatedPh - 3) / 8) * 100}%` }}
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

          {/* --- (Sección Guardar Mezcla - sin cambios) --- */}
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
              {/* --- 4. ÍCONO REEMPLAZADO --- */}
              {isSaving ? (
                "Guardando..."
              ) : (
                <>
                  <FiSave /> Guardar Mezcla
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <hr className={styles.separator} />

      {/* --- (Sección Mezclas Guardadas - sin cambios) --- */}
      <div className={styles.savedMixesSection}>
        {/* --- 5. ÍCONO REEMPLAZADO --- */}
        <h2>
          <FiArchive /> Mis Mezclas Guardadas
        </h2>
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
                    {/* --- 6. ÍCONO REEMPLAZADO --- */}
                    <FiTrash2 />
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
