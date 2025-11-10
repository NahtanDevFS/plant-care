// src/components/ReminderSetup.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./ReminderSetup.module.css";
import { FiDroplet, FiThermometer, FiTrash2 } from "react-icons/fi";
import { toast } from "sonner";

type ReminderSetupProps = {
  plantId: number;
  careType: "Riego" | "Fertilizante";
  initialFrequency: number | null;
  onSave: (frequency: number) => void;
  onDelete: () => Promise<void>;
};

export default function ReminderSetup({
  plantId,
  careType,
  initialFrequency,
  onSave,
  onDelete,
}: ReminderSetupProps) {
  const supabase = createClient();
  const [frequency, setFrequency] = useState<number | null>(initialFrequency);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

      const { data: reminder, error: reminderError } = await supabase
        .from("reminders")
        .select("*")
        .eq("plant_id", plantId)
        .eq("care_type", careType)
        .eq("user_id", user.id)
        .single();

      const today = new Date();

      today.setHours(today.getHours() - 6);

      const nextReminderDate = new Date(today);
      nextReminderDate.setDate(nextReminderDate.getDate() + frequency);

      const nextDateString = nextReminderDate.toISOString().split("T")[0];

      if (reminderError || !reminder) {
        const { error: insertError } = await supabase.from("reminders").insert([
          {
            plant_id: plantId,
            user_id: user.id,
            care_type: careType,
            frequency_days: frequency,
            next_reminder_date: nextDateString,
          },
        ]);

        if (insertError) throw insertError;
      } else {
        const { error: updateError } = await supabase
          .from("reminders")
          .update({
            frequency_days: frequency,
            next_reminder_date: nextDateString,
          })
          .eq("id", reminder.id);

        if (updateError) throw updateError;
      }

      onSave(frequency);
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
              await onDelete();
              setFrequency(null);
              setIsEditing(false);
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
          disabled={isSaving || isDeleting}
          className={styles.saveButton}
        >
          {isSaving ? "..." : "Guardar"}
        </button>
        <button
          onClick={() => {
            setIsEditing(false);
            setFrequency(initialFrequency);
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
        {initialFrequency
          ? `${label} ${initialFrequency} días`
          : `No has configurado recordatorios para ${careType.toLowerCase()}.`}
      </p>
      <button
        onClick={() => setIsEditing(true)}
        className={styles.editButton}
        disabled={isDeleting}
      >
        {initialFrequency ? "Cambiar" : "Configurar"}
      </button>

      {initialFrequency && (
        <button
          onClick={handleDelete}
          className={styles.deleteButton}
          disabled={isDeleting}
          title="Eliminar recordatorio"
        >
          {isDeleting ? "..." : <FiTrash2 />}
        </button>
      )}
    </div>
  );
}
