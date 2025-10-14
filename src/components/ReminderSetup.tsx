// src/components/ReminderSetup.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./ReminderSetup.module.css";

type ReminderSetupProps = {
  plantId: number;
  careType: "Riego" | "Fertilizante";
  initialFrequency: number | null;
  onSave: (frequency: number) => Promise<void>;
};

export default function ReminderSetup({
  plantId,
  careType,
  initialFrequency,
  onSave,
}: ReminderSetupProps) {
  const supabase = createClient();
  const [frequency, setFrequency] = useState<number | null>(initialFrequency);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    if (frequency === null || frequency <= 0) {
      alert("Por favor, introduce un número de días válido.");
      return;
    }

    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("No estás autenticado");
        return;
      }

      // 1. Obtener el recordatorio actual
      const { data: reminder, error: reminderError } = await supabase
        .from("reminders")
        .select("*")
        .eq("plant_id", plantId)
        .eq("care_type", careType)
        .eq("user_id", user.id)
        .single();

      // 2. Calcular la próxima fecha
      const today = new Date();
      const nextReminderDate = new Date(today);
      nextReminderDate.setDate(nextReminderDate.getDate() + frequency);

      if (reminderError || !reminder) {
        // Si no existe, crear uno nuevo
        const { error: insertError } = await supabase.from("reminders").insert([
          {
            plant_id: plantId,
            user_id: user.id,
            care_type: careType,
            frequency_days: frequency,
            next_reminder_date: nextReminderDate.toISOString().split("T")[0],
          },
        ]);

        if (insertError) throw insertError;
      } else {
        // 3. Actualizar el recordatorio existente
        const { error: updateError } = await supabase
          .from("reminders")
          .update({
            frequency_days: frequency,
            next_reminder_date: nextReminderDate.toISOString().split("T")[0],
          })
          .eq("id", reminder.id);

        if (updateError) throw updateError;
      }

      // Llamar al callback onSave sin recargar
      await onSave(frequency);
      setIsEditing(false);
      alert("Recordatorio guardado correctamente");
    } catch (error) {
      console.error("Error:", error);
      alert(
        "Error: " + (error instanceof Error ? error.message : "desconocido")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const icon = careType === "Riego" ? "💧" : "🧪";
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
          disabled={isLoading}
          className={styles.saveButton}
        >
          {isLoading ? "..." : "Guardar"}
        </button>
        <button
          onClick={() => setIsEditing(false)}
          className={styles.cancelButton}
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
        {frequency
          ? `${label} ${frequency} días`
          : `No has configurado recordatorios para ${careType.toLowerCase()}.`}
      </p>
      <button onClick={() => setIsEditing(true)} className={styles.editButton}>
        {frequency ? "Cambiar" : "Configurar"}
      </button>
    </div>
  );
}
