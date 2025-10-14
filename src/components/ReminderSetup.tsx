// src/components/ReminderSetup.tsx
"use client";

import { useState } from "react";
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
      const response = await fetch("/api/reminders/update-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId, careType, frequency }),
      });

      if (!response.ok) {
        throw new Error("Error al guardar el recordatorio");
      }

      setIsEditing(false);
      alert("Recordatorio guardado correctamente");
    } catch (error) {
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
