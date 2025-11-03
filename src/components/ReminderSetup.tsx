// src/components/ReminderSetup.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./ReminderSetup.module.css";
import { FiDroplet, FiThermometer, FiTrash2 } from "react-icons/fi";
import { toast } from "sonner"; // <-- IMPORTAR TOAST

// --- ¡NUEVO! Helper para obtener la fecha local como string 'YYYY-MM-DD' ---
// Esto evita la conversión a UTC de .toISOString()
const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};
// --- FIN DE LO NUEVO ---

type ReminderSetupProps = {
  plantId: number;
  careType: "Riego" | "Fertilizante";
  initialFrequency: number | null;
  onSave: (frequency: number) => void; // <-- Modificado: Ya no es Promise
  onDelete: () => Promise<void>; // <-- ¡NUEVO! Prop para eliminar
};

export default function ReminderSetup({
  plantId,
  careType,
  initialFrequency,
  onSave,
  onDelete, // <-- ¡NUEVO!
}: ReminderSetupProps) {
  const supabase = createClient();
  // El estado 'frequency' ahora se usa solo para la EDICIÓN
  const [frequency, setFrequency] = useState<number | null>(initialFrequency);
  // Estados de carga separados
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // <-- ¡NUEVO!
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    if (frequency === null || frequency <= 0) {
      toast.warning("Por favor, introduce un número de días válido.");
      return;
    }

    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("No estás autenticado");
      }

      // 1. Obtener el recordatorio actual
      const { data: reminder, error: reminderError } = await supabase
        .from("reminders")
        .select("*")
        .eq("plant_id", plantId)
        .eq("care_type", careType)
        .eq("user_id", user.id)
        .single();

      // 2. Calcular la próxima fecha (usando la fecha local)
      const today = new Date();
      const nextReminderDate = new Date(today);
      nextReminderDate.setDate(nextReminderDate.getDate() + frequency);
      // --- ¡CAMBIO! Usar la función helper local ---
      const nextDateString = toLocalDateString(nextReminderDate);

      if (reminderError || !reminder) {
        // Si no existe, crear uno nuevo
        const { error: insertError } = await supabase.from("reminders").insert([
          {
            plant_id: plantId,
            user_id: user.id,
            care_type: careType,
            frequency_days: frequency,
            next_reminder_date: nextDateString, // <-- Usar fecha local
          },
        ]);

        if (insertError) throw insertError;
      } else {
        // 3. Actualizar el recordatorio existente
        const { error: updateError } = await supabase
          .from("reminders")
          .update({
            frequency_days: frequency,
            next_reminder_date: nextDateString, // <-- Usar fecha local
          })
          .eq("id", reminder.id);

        if (updateError) throw updateError;
      }

      // Llamar al callback onSave para actualizar el estado del padre
      onSave(frequency); // <-- Modificado: ya no es async
      setIsEditing(false);
      toast.success("Recordatorio guardado correctamente");
    } catch (error) {
      console.error("Error:", error);
      toast.error(
        "Error al guardar: " +
          (error instanceof Error ? error.message : "desconocido")
      );
    } finally {
      setIsSaving(false);
    }
  };

  // --- ¡NUEVO! ---
  // Manejador para el botón de eliminar
  const handleDelete = async () => {
    toast.warning(
      `¿Seguro que quieres eliminar el recordatorio de ${careType.toLowerCase()}?`,
      {
        description: "Esta acción no se puede deshacer.",
        action: {
          label: "Eliminar",
          onClick: async () => {
            setIsDeleting(true);
            try {
              // Llama a la función onDelete pasada desde el padre
              await onDelete();
              // El estado del padre se actualiza (initialFrequency -> null)
              // lo que re-renderizará este componente
              setFrequency(null); // Actualiza estado local
              setIsEditing(false); // Salir del modo edición si estaba activo
              toast.success("Recordatorio eliminado.");
            } catch (error) {
              console.error("Error deleting reminder:", error);
              toast.error(
                "Error al eliminar: " +
                  (error instanceof Error ? error.message : "Error desconocido")
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
        cancel: {
          label: "Cancelar",
          onClick: () => {},
        },
      }
    );
  };
  // --- FIN DE LO NUEVO ---

  const icon = careType === "Riego" ? <FiDroplet /> : <FiThermometer />;
  const label = careType === "Riego" ? "Regar cada" : "Fertilizar cada";

  if (isEditing) {
    return (
      <div className={styles.reminderContainer}>
        <span className={styles.icon}>{icon}</span>
        <label htmlFor={`freq-${plantId}-${careType}`}>{label}</label>
        <input
          id={`freq-${plantId}-${careType}`}
          type="number"
          value={frequency || ""}
          onChange={(e) => setFrequency(parseInt(e.target.value, 10) || null)}
          className={styles.input}
          min="1"
        />
        <span>días</span>
        <button
          onClick={handleSave}
          disabled={isSaving || isDeleting} // Deshabilitar si está guardando O eliminando
          className={styles.saveButton}
        >
          {isSaving ? "..." : "Guardar"}
        </button>
        <button
          onClick={() => {
            setIsEditing(false);
            setFrequency(initialFrequency); // Resetea al valor inicial si cancela
          }}
          className={styles.cancelButton}
          disabled={isSaving || isDeleting}
        >
          X
        </button>
      </div>
    );
  }

  return (
    <div className={styles.reminderContainer}>
      <span className={styles.icon}>{icon}</span>
      <p>
        {/* Usamos initialFrequency para mostrar el estado REAL guardado */}
        {initialFrequency
          ? `${label} ${initialFrequency} días`
          : `No has configurado recordatorios para ${careType.toLowerCase()}.`}
      </p>
      <button
        onClick={() => setIsEditing(true)}
        className={styles.editButton}
        disabled={isDeleting} // Deshabilitar mientras se borra
      >
        {initialFrequency ? "Cambiar" : "Configurar"}
      </button>

      {/* --- ¡NUEVO! Botón de eliminar --- */}
      {/* Solo se muestra si ya existe un recordatorio (initialFrequency no es null) */}
      {initialFrequency && (
        <button
          onClick={handleDelete}
          className={styles.deleteButton} // Asegúrate de añadir este estilo a ReminderSetup.module.css
          disabled={isDeleting}
          title="Eliminar recordatorio"
        >
          {isDeleting ? "..." : <FiTrash2 />}
        </button>
      )}
    </div>
  );
}
