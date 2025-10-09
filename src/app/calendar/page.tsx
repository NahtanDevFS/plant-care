// src/app/calendar/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./Calendar.module.css";
import Image from "next/image";

type Reminder = {
  id: number;
  next_reminder_date: string;
  care_type: "Riego" | "Fertilizante";
  frequency_days: number;
  plants: {
    name: string;
    image_url: string;
  } | null;
};

type GroupedReminders = {
  [key: string]: Reminder[];
};

export default function CalendarPage() {
  const supabase = createClient();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReminders = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Obtenemos todos los recordatorios, ya que no hay estado 'completed'
        const { data, error } = await supabase
          .from("reminders")
          .select("*, plants(name, image_url)")
          .eq("user_id", user.id)
          .order("next_reminder_date", { ascending: true });

        if (error) {
          setError("No se pudieron cargar los recordatorios.");
          console.error(error);
        } else {
          setReminders(data || []);
        }
      }
      setLoading(false);
    };

    fetchReminders();
  }, [supabase]);

  const handleCompleteTask = async (reminderToComplete: Reminder) => {
    const originalReminders = [...reminders];
    setReminders(reminders.filter((r) => r.id !== reminderToComplete.id));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication error: User not found.");

      // --- LÓGICA SIMPLIFICADA: SOLO ACTUALIZAR LA FECHA ---

      // 1. Calcular la nueva fecha
      const today = new Date();
      const new_reminder_date = new Date(
        today.getTime() +
          reminderToComplete.frequency_days * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split("T")[0];

      // 2. Actualizar el recordatorio existente con la nueva fecha
      const { error: updateError } = await supabase
        .from("reminders")
        .update({ next_reminder_date: new_reminder_date })
        .eq("id", reminderToComplete.id)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      // Opcional: Volver a cargar los recordatorios para que el completado aparezca al final de la lista
      const { data } = await supabase
        .from("reminders")
        .select("*, plants(name, image_url)")
        .eq("user_id", user.id)
        .order("next_reminder_date", { ascending: true });
      setReminders(data || []);
    } catch (error) {
      console.error("Error al completar la tarea:", error);
      let errorMessage = "Error al completar la tarea. Inténtalo de nuevo.";
      if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      }
      alert(errorMessage);
      setReminders(originalReminders); // Revertir si hay un error
    }
  };

  const groupedReminders = useMemo(() => {
    // Solo mostramos las tareas de hoy o del pasado
    const upcoming = reminders.filter(
      (r) => new Date(r.next_reminder_date) <= new Date()
    );
    const groups: GroupedReminders = {};
    upcoming.forEach((reminder) => {
      const date = reminder.next_reminder_date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(reminder);
    });
    return groups;
  }, [reminders]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <h2>Cargando tu calendario...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <p className={styles.errorMessage}>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🗓️ Calendario de Cuidados</h1>
        <p>Tus próximas tareas para mantener tus plantas felices.</p>
      </div>

      {Object.keys(groupedReminders).length > 0 ? (
        <div className={styles.timeline}>
          {Object.keys(groupedReminders).map((date) => (
            <div key={date} className={styles.dateGroup}>
              <h2 className={styles.dateHeader}>{formatDate(date)}</h2>
              <div className={styles.remindersList}>
                {groupedReminders[date].map((reminder) => (
                  <div key={reminder.id} className={styles.reminderCard}>
                    <Image
                      src={reminder.plants?.image_url || "/plant-care.png"}
                      alt={reminder.plants?.name || "Planta"}
                      width={70}
                      height={70}
                      className={styles.plantImage}
                      unoptimized
                    />
                    <div className={styles.reminderInfo}>
                      <span className={styles.plantName}>
                        {reminder.plants?.name}
                      </span>
                      <span className={styles.careType}>
                        {reminder.care_type === "Riego" ? "💧" : "🧪"}{" "}
                        {reminder.care_type}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCompleteTask(reminder)}
                      className={styles.completeButton}
                      title="Marcar como completado"
                    >
                      ✓
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <h3>¡Todo en orden!</h3>
          <p>
            No tienes tareas de cuidado pendientes. Configura los recordatorios
            en "Mis Plantas".
          </p>
        </div>
      )}
    </div>
  );
}
