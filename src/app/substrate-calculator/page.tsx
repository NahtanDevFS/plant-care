// src/app/substrate-calculator/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./SubstrateCalculator.module.css";
import {
  FiPercent,
  FiSave,
  FiArchive,
  FiTrash2,
  FiEdit2,
  FiBox, // <-- Iconos para explicaciones
  FiCloudDrizzle,
  FiWind,
  FiFeather,
  FiZap,
} from "react-icons/fi";
import { GiPlantSeed } from "react-icons/gi";

// --- MODIFICADO: Añadido function_type ---
type SubstrateComponent = {
  id: number;
  name: string;
  ph_value: number;
  description?: string | null;
  function_type?: string | null; // <-- AÑADIDO
};

// --- MODIFICADO: Añadido function_type ---
type SelectedComponent = {
  component_id: number;
  name: string;
  ph_value: number;
  percentage: number;
  function_type?: string | null; // <-- AÑADIDO
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
  const [componentToAdd, setComponentToAdd] = useState<string>("");

  const [editingMixId, setEditingMixId] = useState<number | null>(null);
  const [editingMixName, setEditingMixName] = useState("");
  const [editingMixNotes, setEditingMixNotes] = useState("");
  const [isUpdatingMix, setIsUpdatingMix] = useState(false);

  useEffect(() => {
    const fetchComponents = async () => {
      setLoadingComponents(true);
      const { data, error } = await supabase
        .from("substrate_components")
        // --- MODIFICADO: Pedir la nueva columna ---
        .select("id, name, ph_value, description, function_type")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching components:", error);
        setError("Error al cargar componentes de sustrato.");
        setLoadingComponents(false);
      } else {
        const componentsData = data || [];
        setAllComponents(componentsData);
        setLoadingComponents(false);
        fetchSavedMixes(componentsData);
      }
    };
    fetchComponents();
  }, [supabase]);

  const fetchSavedMixes = async (componentsData: SubstrateComponent[]) => {
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
      const mixes = (data || []).map((mix) => {
        const loadedComponents = (
          Array.isArray(mix.components) ? mix.components : []
        ) as { component_id: number; parts: number }[];

        const totalParts = loadedComponents.reduce(
          (sum, c) => sum + (Number(c.parts) || 0),
          0
        );

        const components: SelectedComponent[] = loadedComponents.map((comp) => {
          const componentInfo = componentsData.find(
            (c) => c.id === comp.component_id
          );
          const percentage =
            totalParts > 0
              ? parseFloat(
                  (((Number(comp.parts) || 0) / totalParts) * 100).toFixed(1)
                )
              : 0;

          return {
            component_id: comp.component_id,
            percentage: percentage,
            name: componentInfo?.name || "Desconocido",
            ph_value: componentInfo?.ph_value || 0,
            function_type: componentInfo?.function_type || null, // <-- AÑADIDO
          };
        });

        return { ...mix, components };
      });
      setSavedMixes(mixes);
    }
    setLoadingMixes(false);
  };

  useEffect(() => {
    if (selectedComponents.length === 0) {
      setCalculatedPh(null);
      return;
    }
    let totalPercentage = 0;
    let weightedPhSum = 0;
    selectedComponents.forEach((item) => {
      const percentage = Number(item.percentage) || 0;
      if (percentage > 0) {
        totalPercentage += percentage;
        weightedPhSum += percentage * item.ph_value;
      }
    });
    if (totalPercentage > 0) {
      const averagePh = weightedPhSum / totalPercentage;
      setCalculatedPh(Number(averagePh.toFixed(1)));
    } else {
      setCalculatedPh(null);
    }
  }, [selectedComponents]);

  // --- MODIFICADO: Añadir 'function_type' al objeto ---
  const handleAddComponent = () => {
    if (!componentToAdd) return;
    const componentId = parseInt(componentToAdd, 10);
    const component = allComponents.find((c) => c.id === componentId);

    if (
      component &&
      !selectedComponents.some((sc) => sc.component_id === componentId)
    ) {
      const newPercentage = selectedComponents.length === 0 ? 100 : 0;
      setSelectedComponents((prev) => [
        ...prev,
        {
          component_id: component.id,
          name: component.name,
          ph_value: component.ph_value,
          function_type: component.function_type, // <-- AÑADIDO
          percentage: newPercentage,
        },
      ]);
    }
    setComponentToAdd("");
  };

  const handleRemoveComponent = (componentIdToRemove: number) => {
    setSelectedComponents((prev) =>
      prev.filter((c) => c.component_id !== componentIdToRemove)
    );
  };

  const handlePercentageChange = (componentId: number, value: string) => {
    let newPercentage = parseInt(value, 10);
    if (isNaN(newPercentage)) {
      newPercentage = 0;
    }
    if (newPercentage < 0) newPercentage = 0;
    if (newPercentage > 100) newPercentage = 100;

    setSelectedComponents((prev) =>
      prev.map((c) =>
        c.component_id === componentId ? { ...c, percentage: newPercentage } : c
      )
    );
  };

  const totalPercentage = useMemo(() => {
    return selectedComponents.reduce(
      (sum, item) => sum + (Number(item.percentage) || 0),
      0
    );
  }, [selectedComponents]);

  const handleSaveMix = async () => {
    // ... (lógica sin cambios) ...
    if (!mixName.trim()) {
      setError("Por favor, dale un nombre a tu mezcla.");
      return;
    }
    if (selectedComponents.length === 0) {
      setError("Añade al menos un componente.");
      return;
    }
    if (Math.abs(totalPercentage - 100) > 0.1) {
      setError(
        `El total de porcentajes debe ser 100%. Actualmente es ${totalPercentage}%.`
      );
      return;
    }
    if (calculatedPh === null) {
      setError("No se pudo calcular el pH. Revisa los porcentajes.");
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
      .filter((c) => c.percentage > 0)
      .map(({ component_id, percentage }) => ({
        component_id,
        parts: percentage,
      }));

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
            const percentage = Number(comp.parts) || 0;
            return {
              component_id: comp.component_id,
              percentage: percentage,
              name: componentInfo?.name || "Desconocido",
              ph_value: componentInfo?.ph_value || 0,
              function_type: componentInfo?.function_type || null, // <-- AÑADIDO
            };
          }),
        };
        setSavedMixes((prev) => [newMixFormatted, ...prev]);
      }
      setSuccessMessage(`Mezcla "${mixName.trim()}" guardada!`);
      setSelectedComponents([]);
      setMixName("");
      setMixNotes("");
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
    // ... (lógica sin cambios) ...
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

  const handleEditClick = (mix: UserMix) => {
    // ... (lógica sin cambios) ...
    setEditingMixId(mix.id);
    setEditingMixName(mix.mix_name);
    setEditingMixNotes(mix.notes || "");
    setError(null);
    setSuccessMessage(null);
  };

  const handleCancelEdit = () => {
    // ... (lógica sin cambios) ...
    setEditingMixId(null);
    setEditingMixName("");
    setEditingMixNotes("");
    setIsUpdatingMix(false);
  };

  const handleUpdateMix = async (mixId: number) => {
    // ... (lógica sin cambios) ...
    if (!editingMixName.trim()) {
      setError("El nombre de la mezcla no puede estar vacío.");
      return;
    }
    setIsUpdatingMix(true);
    setError(null);
    setSuccessMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Necesitas iniciar sesión para editar.");
      setIsUpdatingMix(false);
      return;
    }

    try {
      const { data: updatedData, error: updateError } = await supabase
        .from("user_substrate_mixes")
        .update({
          mix_name: editingMixName.trim(),
          notes: editingMixNotes.trim() || null,
        })
        .eq("id", mixId)
        .eq("user_id", user.id)
        .select("mix_name, notes")
        .single();

      if (updateError) throw updateError;

      setSavedMixes((prevMixes) =>
        prevMixes.map((mix) =>
          mix.id === mixId
            ? {
                ...mix,
                mix_name: updatedData.mix_name,
                notes: updatedData.notes,
              }
            : mix
        )
      );

      setSuccessMessage("Mezcla actualizada con éxito.");
      handleCancelEdit();
    } catch (err) {
      console.error("Error updating mix:", err);
      setError(
        err instanceof Error ? err.message : "Error desconocido al actualizar."
      );
    } finally {
      setIsUpdatingMix(false);
    }
  };

  // --- MODIFICADO: Agrupar componentes para el <select> ---
  const groupedAvailableComponents = useMemo(() => {
    const groups: { [key: string]: SubstrateComponent[] } = {};
    // Filtra los que ya están seleccionados Y los de tipo 'Líquido'
    const available = allComponents.filter(
      (comp) =>
        !selectedComponents.some((sel) => sel.component_id === comp.id) &&
        comp.function_type !== "Líquido"
    );

    available.forEach((comp) => {
      const type = comp.function_type || "Otros"; // Agrupa nulos en 'Otros'
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(comp);
    });

    // Ordenar los grupos
    const orderedGroups: { [key: string]: SubstrateComponent[] } = {};
    const order = [
      "Base",
      "Aireación",
      "Retención",
      "Nutrientes",
      "Mejorador",
      "Otros",
    ];
    order.forEach((key) => {
      if (groups[key]) {
        orderedGroups[key] = groups[key];
      }
    });

    return orderedGroups;
  }, [allComponents, selectedComponents]);
  // ------------------------------------------------------

  return (
    <div className={styles.pageContainer}>
      <h1>
        <FiPercent /> Calculadora de Sustrato
      </h1>
      <p>Crea y guarda tus mezclas de sustrato personalizadas.</p>

      {error && <p className={styles.errorMessage}>{error}</p>}
      {successMessage && (
        <p className={styles.successMessage}>{successMessage}</p>
      )}

      <div className={styles.calculatorSection}>
        <div className={styles.componentSelection}>
          <h2>1. Añadir Componentes</h2>

          {/* --- 4. NUEVO: Explicaciones de Categorías --- */}
          <div className={styles.componentExplanations}>
            <div className={styles.explanationItem}>
              <span>
                <FiBox /> <strong>Base:</strong>
              </span>
              <p>Componente principal que da cuerpo a la mezcla.</p>
            </div>
            <div className={styles.explanationItem}>
              <span>
                <FiWind /> <strong>Aireación:</strong>
              </span>
              <p>Materiales que crean espacio para oxígeno y drenaje.</p>
            </div>
            <div className={styles.explanationItem}>
              <span>
                <FiCloudDrizzle /> <strong>Retención:</strong>
              </span>
              <p>Materiales que absorben y retienen agua.</p>
            </div>
            <div className={styles.explanationItem}>
              <span>
                <FiFeather /> <strong>Nutrientes:</strong>
              </span>
              <p>Aportan alimento orgánico a la mezcla.</p>
            </div>
            <div className={styles.explanationItem}>
              <span>
                <FiZap /> <strong>Mejorador:</strong>
              </span>
              <p>Ajustan el pH o añaden minerales específicos.</p>
            </div>
          </div>
          {/* ------------------------------------------- */}

          {loadingComponents ? (
            <p>Cargando componentes...</p>
          ) : (
            <div className={styles.addComponentArea}>
              <select
                value={componentToAdd}
                onChange={(e) => setComponentToAdd(e.target.value)}
                className={styles.componentSelect}
              >
                <option value="">Elige un componente</option>
                {Object.entries(groupedAvailableComponents).map(
                  ([groupName, components]) => (
                    <optgroup
                      label={`${groupName}`}
                      key={groupName}
                      className={styles.optGroup}
                    >
                      {components.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.name} (pH {comp.ph_value.toFixed(1)})
                        </option>
                      ))}
                    </optgroup>
                  )
                )}
              </select>
              {/* ------------------------------------------------ */}
              <button
                onClick={handleAddComponent}
                disabled={!componentToAdd}
                className={styles.addButton}
              >
                Añadir a la Mezcla
              </button>
            </div>
          )}
          {selectedComponents.length > 0 && (
            <div className={styles.addedComponentsInfo}>
              <h4>Componentes en la mezcla:</h4>
              <ul>
                {/* --- 6. MODIFICADO: Mostrar pH y Tipo --- */}
                {selectedComponents.map((c) => (
                  <li key={c.component_id}>
                    <GiPlantSeed /> {c.name}
                    <span className={styles.componentInfo}>
                      (pH {c.ph_value.toFixed(1)} - {c.function_type || "Base"})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className={styles.mixConfiguration}>
          <h2>2. Define Proporciones (%)</h2>
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
                  <span className={styles.componentPhLabel}>
                    pH: {selComp.ph_value.toFixed(1)}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={selComp.percentage}
                    onChange={(e) =>
                      handlePercentageChange(
                        selComp.component_id,
                        e.target.value
                      )
                    }
                    className={styles.percentageInput}
                  />
                  <span className={styles.percentageSymbol}>%</span>
                  <button
                    onClick={() => handleRemoveComponent(selComp.component_id)}
                    className={styles.removeButton}
                    title="Quitar componente"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <div
                className={styles.totalPercentage}
                style={{
                  color:
                    Math.abs(totalPercentage - 100) < 0.1 ? "green" : "#d32f2f",
                }}
              >
                Total: {totalPercentage.toFixed(0)}%
                {Math.abs(totalPercentage - 100) > 0.1 && (
                  <span className={styles.warning}>
                    (El total debe ser 100%)
                  </span>
                )}
              </div>
            </div>
          )}

          <div className={styles.phResult}>
            <h2>3. Resultado Estimado</h2>
            {/* ... (Indicador de pH sin cambios) ... */}
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

          <div className={styles.saveSection}>
            <h2>4. Guardar Mezcla (Opcional)</h2>
            {/* ... (Inputs de guardar sin cambios) ... */}
            <input
              type="text"
              placeholder="Nombre de la mezcla (ej. Para Suculentas)"
              value={mixName}
              onChange={(e) => setMixName(e.target.value)}
              className={styles.mixNameInput}
              disabled={selectedComponents.length === 0}
            />
            <textarea
              placeholder="Notas adicionales (opcional)..."
              value={mixNotes}
              onChange={(e) => setMixNotes(e.target.value)}
              className={styles.mixNotesInput}
              rows={2}
              disabled={selectedComponents.length === 0}
            />
            <button
              onClick={handleSaveMix}
              disabled={
                isSaving ||
                selectedComponents.length === 0 ||
                !mixName.trim() ||
                Math.abs(totalPercentage - 100) > 0.1
              }
              className={styles.saveButton}
            >
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

      <div className={styles.savedMixesSection}>
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
            {savedMixes.map((mix) =>
              editingMixId === mix.id ? (
                // --- VISTA DE EDICIÓN ---
                <div
                  key={mix.id}
                  className={`${styles.savedMixCard} ${styles.editing}`}
                >
                  <div className={styles.editForm}>
                    <label htmlFor={`edit-name-${mix.id}`}>Nombre:</label>
                    <input
                      id={`edit-name-${mix.id}`}
                      type="text"
                      value={editingMixName}
                      onChange={(e) => setEditingMixName(e.target.value)}
                      className={styles.editInput}
                      disabled={isUpdatingMix}
                    />
                    <label htmlFor={`edit-notes-${mix.id}`}>Notas:</label>
                    <textarea
                      id={`edit-notes-${mix.id}`}
                      value={editingMixNotes}
                      onChange={(e) => setEditingMixNotes(e.target.value)}
                      className={styles.editTextArea}
                      rows={3}
                      disabled={isUpdatingMix}
                    />
                  </div>
                  <div className={styles.editActions}>
                    <button
                      onClick={handleCancelEdit}
                      className={styles.editCancelButton}
                      disabled={isUpdatingMix}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleUpdateMix(mix.id)}
                      className={styles.editSaveButton}
                      disabled={isUpdatingMix}
                    >
                      {isUpdatingMix ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              ) : (
                // --- VISTA NORMAL ---
                <div key={mix.id} className={styles.savedMixCard}>
                  <div className={styles.savedMixHeader}>
                    <h3>{mix.mix_name}</h3>
                    <div className={styles.headerButtons}>
                      <button
                        onClick={() => handleEditClick(mix)}
                        className={styles.editMixButton}
                        title="Editar mezcla"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        onClick={() => handleDeleteMix(mix.id)}
                        className={styles.deleteMixButton}
                        title="Eliminar mezcla"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                  <p className={styles.savedMixPh}>
                    pH Estimado: {mix.calculated_ph.toFixed(1)}
                  </p>
                  <ul>
                    {/* --- 7. MODIFICADO: Mostrar pH y Tipo --- */}
                    {mix.components.map((comp, index) => (
                      <li key={index}>
                        {comp.percentage.toFixed(0)}% de {comp.name}
                        <span className={styles.savedMixComponentInfo}>
                          (pH {comp.ph_value.toFixed(1)} -{" "}
                          {comp.function_type || "Base"})
                        </span>
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
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
