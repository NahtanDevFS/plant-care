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

// --- COMPONENTE REUTILIZABLE PARA RENDERIZAR LISTAS DE RECORDATORIOS ---
const ReminderList = ({
  groupedReminders,
  showCompleteButton,
  onComplete,
}: {
  groupedReminders: GroupedReminders;
  showCompleteButton: boolean;
  onComplete?: (reminder: Reminder) => void;
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className={styles.timeline}>
      {Object.keys(groupedReminders)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        .map((date) => (
          <div key={date} className={styles.dateGroup}>
            <h3 className={styles.dateHeader}>{formatDate(date)}</h3>
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
                  {showCompleteButton && onComplete && (
                    <button
                      onClick={() => onComplete(reminder)}
                      className={styles.completeButton}
                      title="Marcar como completado"
                    >
                      ✓
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
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
        const { data, error } = await supabase
          .from("reminders")
          .select("*, plants(name, image_url)")
          .eq("user_id", user.id);

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
    try {
      const today = new Date();
      const new_reminder_date = new Date(
        today.getTime() +
          (reminderToComplete.frequency_days || 30) * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split("T")[0];

      const { error: updateError } = await supabase
        .from("reminders")
        .update({ next_reminder_date: new_reminder_date })
        .eq("id", reminderToComplete.id);

      if (updateError) throw updateError;

      // Actualiza el estado local para reflejar el cambio inmediatamente
      setReminders(
        reminders.map((r) =>
          r.id === reminderToComplete.id
            ? { ...r, next_reminder_date: new_reminder_date }
            : r
        )
      );
    } catch (error) {
      console.error("Error al completar la tarea:", error);
      alert("No se pudo completar la tarea. Inténtalo de nuevo.");
    }
  };

  // --- LÓGICA PARA SEPARAR TAREAS ---
  const { dueReminders, upcomingReminders } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due: GroupedReminders = {};
    const upcoming: GroupedReminders = {};

    reminders.forEach((reminder) => {
      const reminderDate = new Date(reminder.next_reminder_date + "T00:00:00");
      const dateKey = reminder.next_reminder_date;

      if (reminderDate <= today) {
        if (!due[dateKey]) due[dateKey] = [];
        due[dateKey].push(reminder);
      } else {
        if (!upcoming[dateKey]) upcoming[dateKey] = [];
        upcoming[dateKey].push(reminder);
      }
    });

    return { dueReminders: due, upcomingReminders: upcoming };
  }, [reminders]);

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

  const hasDueReminders = Object.keys(dueReminders).length > 0;
  const hasUpcomingReminders = Object.keys(upcomingReminders).length > 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🗓️ Calendario de Cuidados</h1>
        <p>Tus próximas tareas para mantener tus plantas felices.</p>
      </div>

      {hasDueReminders ? (
        <ReminderList
          groupedReminders={dueReminders}
          showCompleteButton={true}
          onComplete={handleCompleteTask}
        />
      ) : (
        <div className={styles.emptyState}>
          <h3>¡Todo en orden por hoy!</h3>
          <p>No tienes tareas de cuidado pendientes.</p>
        </div>
      )}

      {hasUpcomingReminders && (
        <>
          <h2 className={styles.upcomingTitle}>Próximas Tareas</h2>
          <ReminderList
            groupedReminders={upcomingReminders}
            showCompleteButton={false}
          />
        </>
      )}

      {!hasDueReminders && !hasUpcomingReminders && (
        <div className={styles.emptyState}>
          <h3>No hay recordatorios configurados</h3>
          <p>
            Ve a: Mis Plantas para configurar los recordatorios de riego y
            fertilización.
          </p>
        </div>
      )}
    </div>
  );
}
