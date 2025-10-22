// src/components/UnifiedCalendar.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./UnifiedCalendar.module.css";
import Image from "next/image";

// Tipo para tareas pasadas/presentes (desde task_history)
type Task = {
  id: string; // ID de task_history
  plantName: string;
  careType: "Riego" | "Fertilizante";
  isCompleted: boolean;
  completedDate?: string;
  imageUrl: string;
};

// --- NUEVO TIPO: Para recordatorios futuros (desde reminders) ---
type FutureReminder = {
  id: number; // ID de reminders
  plantName: string;
  careType: "Riego" | "Fertilizante";
  imageUrl: string;
  // No tiene estado 'isCompleted'
};
// -----------------------------------------------------------

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  tasks: Task[]; // Tareas de task_history (pasado/presente)
  completedCount: number;
  pendingCount: number;
  futureRemindersCount: number; // Renombrado de futureReminders
  futureReminderDetails: FutureReminder[]; // Detalles de recordatorios futuros
};

export default function UnifiedCalendar() {
  const supabase = createClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<{ [key: string]: Task[] }>({});
  // --- NUEVO ESTADO: Detalles de recordatorios futuros ---
  const [futureReminderDetails, setFutureReminderDetails] = useState<{
    [key: string]: FutureReminder[];
  }>({});
  // ----------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    loadCalendarData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]); // Depend on currentMonth only

  const loadCalendarData = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const firstDayOfCalendar = new Date(firstDayOfMonth);
    firstDayOfCalendar.setDate(firstDayOfMonth.getDate() - startOffset);

    const lastDayOfMonth = new Date(year, month + 1, 0);
    const endOffset = 6 - ((lastDayOfMonth.getDay() + 6) % 7);
    const lastDayOfCalendar = new Date(lastDayOfMonth);
    lastDayOfCalendar.setDate(lastDayOfMonth.getDate() + endOffset + 7); // Añadir una semana extra para asegurar la carga del mes siguiente

    const firstDayString = firstDayOfCalendar.toISOString().split("T")[0];
    const lastDayString = lastDayOfCalendar.toISOString().split("T")[0];

    try {
      const { data: taskData, error: taskError } = await supabase
        .from("task_history")
        .select("*, plants(name, image_url)")
        .eq("user_id", user.id)
        .gte("scheduled_date", firstDayString)
        .lte("scheduled_date", lastDayString)
        .order("scheduled_date", { ascending: true });

      if (taskError) throw taskError;

      // --- Cargar DETALLES de recordatorios futuros ---
      const { data: reminderData, error: reminderError } = await supabase
        .from("reminders")
        .select(
          "id, next_reminder_date, care_type, plants!inner(name, image_url)"
        ) // Usar !inner para asegurar que plants exista
        .eq("user_id", user.id)
        .gte("next_reminder_date", firstDayString)
        .lte("next_reminder_date", lastDayString);

      if (reminderError) throw reminderError;
      // ---------------------------------------------

      // Agrupar tareas por fecha
      const groupedTasks: { [key: string]: Task[] } = {};
      taskData?.forEach((task: any) => {
        const dateKey = task.scheduled_date;
        if (!groupedTasks[dateKey]) {
          groupedTasks[dateKey] = [];
        }
        groupedTasks[dateKey].push({
          id: task.id.toString(), // Asegurar que sea string
          plantName: task.plants?.name || "Planta desconocida",
          careType: task.care_type,
          isCompleted: task.is_completed,
          completedDate: task.completed_date,
          imageUrl: task.plants?.image_url || "/plant-care.png",
        });
      });

      // --- Agrupar DETALLES de recordatorios futuros por fecha ---
      const groupedFutureReminders: { [key: string]: FutureReminder[] } = {};
      reminderData?.forEach((reminder: any) => {
        // Ya filtramos con !inner, pero una comprobación extra no hace daño
        if (reminder.plants) {
          const dateKey = reminder.next_reminder_date;
          if (!groupedFutureReminders[dateKey]) {
            groupedFutureReminders[dateKey] = [];
          }
          groupedFutureReminders[dateKey].push({
            id: reminder.id, // ID del reminder
            plantName: reminder.plants.name,
            careType: reminder.care_type,
            imageUrl: reminder.plants.image_url || "/plant-care.png",
          });
        }
      });
      // ---------------------------------------------------------

      setTasks(groupedTasks);
      setFutureReminderDetails(groupedFutureReminders); // Guardar detalles
    } catch (error) {
      console.error("Error loading calendar data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date): number => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return (day + 6) % 7;
  };

  const generateCalendarDays = (): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayIndex = getFirstDayOfMonth(currentMonth);
    const daysInCurrentMonth = getDaysInMonth(currentMonth);

    const prevMonthDate = new Date(year, month - 1);
    const daysInPrevMonth = getDaysInMonth(prevMonthDate);

    // Días del mes anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const date = new Date(year, month - 1, dayNum);
      const dateString = date.toISOString().split("T")[0];
      const dayTasks = tasks[dateString] || [];
      const futureReminders = futureReminderDetails[dateString] || []; // Detalles futuros
      days.push({
        date,
        isCurrentMonth: false,
        tasks: dayTasks,
        completedCount: dayTasks.filter((t) => t.isCompleted).length,
        pendingCount: dayTasks.filter((t) => !t.isCompleted).length,
        futureRemindersCount: futureReminders.length, // Conteo
        futureReminderDetails: futureReminders, // Detalles
      });
    }

    // Días del mes actual
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const date = new Date(year, month, i);
      const dateString = date.toISOString().split("T")[0];
      const dayTasks = tasks[dateString] || [];
      const completedCount = dayTasks.filter((t) => t.isCompleted).length;
      const pendingCount = dayTasks.length - completedCount;
      const futureReminders = futureReminderDetails[dateString] || []; // Detalles futuros

      days.push({
        date,
        isCurrentMonth: true,
        tasks: dayTasks,
        completedCount,
        pendingCount,
        futureRemindersCount: futureReminders.length, // Conteo
        futureReminderDetails: futureReminders, // Detalles
      });
    }

    // Días del mes siguiente
    const daysRendered = days.length;
    const remainingDays = 42 - daysRendered;

    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      const dateString = date.toISOString().split("T")[0];
      const dayTasks = tasks[dateString] || [];
      const futureReminders = futureReminderDetails[dateString] || []; // Detalles futuros
      days.push({
        date,
        isCurrentMonth: false,
        tasks: dayTasks,
        completedCount: dayTasks.filter((t) => t.isCompleted).length,
        pendingCount: dayTasks.filter((t) => !t.isCompleted).length,
        futureRemindersCount: futureReminders.length, // Conteo
        futureReminderDetails: futureReminders, // Detalles
      });
    }

    return days;
  };

  const handleCompleteTask = async (taskId: string) => {
    let taskToUpdate: Task | undefined;
    let taskDateKey: string | undefined;

    Object.entries(tasks).forEach(([dateKey, tasksOnDate]) => {
      const found = tasksOnDate.find((t) => t.id === taskId);
      if (found) {
        taskToUpdate = found;
        taskDateKey = dateKey;
      }
    });

    if (!taskToUpdate || !taskDateKey) {
      console.error(`Task with ID ${taskId} not found in local state.`);
      alert("Error: No se encontró la tarea localmente.");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (taskDateKey > todayStr) {
      alert("No puedes completar una tarea programada para el futuro.");
      return;
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase
        .from("task_history")
        .update({
          is_completed: true,
          completed_date: today,
        })
        .eq("id", parseInt(taskId));

      if (error) throw error;

      setTasks((prevTasks) => {
        const newTasks = { ...prevTasks };
        if (newTasks[taskDateKey!]) {
          newTasks[taskDateKey!] = newTasks[taskDateKey!].map((t) =>
            t.id === taskId
              ? { ...t, isCompleted: true, completedDate: today }
              : t
          );
        }
        return newTasks;
      });
      // No necesitamos recargar todo si la UI se actualiza bien
      // await loadCalendarData();
    } catch (error) {
      console.error("Error al completar tarea:", error);
      alert("Error al completar la tarea");
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
    setSelectedDate(null);
  };

  const calendarDays = generateCalendarDays();
  const selectedDayData = selectedDate
    ? calendarDays.find(
        (day) => day.date.toISOString().split("T")[0] === selectedDate
      )
    : null;
  const selectedDateTasks = selectedDayData?.tasks || [];
  // --- OBTENER DETALLES FUTUROS PARA LA FECHA SELECCIONADA ---
  const selectedFutureReminders = selectedDayData?.futureReminderDetails || [];
  // -----------------------------------------------------------

  const monthName = currentMonth.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <h2>Cargando calendario...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>📅 Calendario de Tareas</h1>
        <p>Visualiza tus tareas completadas, pendientes y próximas</p>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendSymbol}>✓</span>
          <span>Completada</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendSymbol} ${styles.pending}`}>●</span>
          <span>Pendiente</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendSymbol}>✓●</span>
          <span>Mixtas</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendSymbol} style={{ fontSize: "0.8rem" }}>
            ◇
          </span>
          <span>Próxima</span> {/* Cambiado de Futura a Próxima */}
        </div>
      </div>

      <div className={styles.calendarWrapper}>
        <div className={styles.calendar}>
          <div className={styles.monthHeader}>
            <button onClick={handlePrevMonth} className={styles.navButton}>
              ←
            </button>
            <h2>{monthName}</h2>
            <button onClick={handleNextMonth} className={styles.navButton}>
              →
            </button>
          </div>

          <div className={styles.weekDays}>
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
              <div key={day} className={styles.weekDay}>
                {day}
              </div>
            ))}
          </div>

          <div className={styles.days}>
            {calendarDays.map((day, index) => {
              const dateString = day.date.toISOString().split("T")[0];
              const isSelected = selectedDate === dateString;

              return (
                <div
                  key={index}
                  className={`${styles.day} ${
                    !day.isCurrentMonth ? styles.otherMonth : ""
                  } ${isSelected ? styles.selected : ""}`}
                  onClick={() =>
                    (day.tasks.length > 0 ||
                      day.futureRemindersCount > 0) /* Usa count aquí */ &&
                    setSelectedDate(dateString)
                  }
                >
                  <div className={styles.dayNumber}>{day.date.getDate()}</div>
                  {/* Usa futureRemindersCount aquí */}
                  {(day.tasks.length > 0 || day.futureRemindersCount > 0) && (
                    <div className={styles.taskIndicators}>
                      {day.completedCount > 0 && (
                        <span
                          className={styles.completed}
                          title={`${day.completedCount} Completada(s)`}
                        >
                          ✓
                        </span>
                      )}
                      {day.pendingCount > 0 && (
                        <span
                          className={styles.pending}
                          title={`${day.pendingCount} Pendiente(s)`}
                        >
                          ●
                        </span>
                      )}
                      {day.futureRemindersCount > 0 && (
                        <span
                          className={styles.future}
                          title={`${day.futureRemindersCount} Próxima(s)`}
                        >
                          ◇
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mostrar panel si hay fecha seleccionada Y hay tareas O recordatorios futuros */}
        {selectedDate &&
          (selectedDateTasks.length > 0 ||
            selectedFutureReminders.length > 0) && (
            <div className={styles.taskDetail}>
              <h3>
                {new Date(selectedDate + "T00:00:00").toLocaleDateString(
                  "es-ES",
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }
                )}
              </h3>
              {/* Renderizar tareas (pasado/presente) */}
              {selectedDateTasks.length > 0 && (
                <div className={styles.taskList}>
                  {selectedDateTasks.map((task) => (
                    <div
                      key={`task-${task.id}`} // Prefijo para evitar colisión de key
                      className={`${styles.taskItem} ${
                        task.isCompleted
                          ? styles.taskCompleted
                          : styles.taskPending
                      }`}
                    >
                      <Image
                        src={task.imageUrl}
                        alt={task.plantName}
                        width={50}
                        height={50}
                        className={styles.taskImage}
                        unoptimized
                      />
                      <div className={styles.taskInfo}>
                        <div className={styles.taskPlant}>{task.plantName}</div>
                        <div className={styles.taskCare}>
                          {task.careType === "Riego" ? "💧" : "🧪"}{" "}
                          {task.careType}
                        </div>
                      </div>
                      <div className={styles.taskStatus}>
                        {task.isCompleted ? (
                          <div
                            className={styles.completedBadge}
                            title={
                              task.completedDate
                                ? `Completada el ${new Date(
                                    task.completedDate + "T00:00:00"
                                  ).toLocaleDateString("es-ES")}`
                                : "Completada"
                            }
                          >
                            ✓
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCompleteTask(task.id)}
                            className={styles.completeButton}
                            disabled={
                              selectedDate >
                              new Date().toISOString().split("T")[0]
                            }
                          >
                            Marcar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* --- Renderizar recordatorios futuros --- */}
              {selectedFutureReminders.length > 0 && (
                <>
                  {/* Opcional: Separador si hay ambos tipos de items */}
                  {selectedDateTasks.length > 0 && (
                    <hr className={styles.detailSeparator} />
                  )}
                  <h4 className={styles.futureTitle}>
                    Próximas Tareas Programadas
                  </h4>
                  <div className={styles.taskList}>
                    {selectedFutureReminders.map((reminder) => (
                      <div
                        key={`reminder-${reminder.id}`} // Prefijo para key única
                        className={`${styles.taskItem} ${styles.taskFuture}`} // Nueva clase para estilo
                      >
                        <Image
                          src={reminder.imageUrl}
                          alt={reminder.plantName}
                          width={50}
                          height={50}
                          className={styles.taskImage}
                          unoptimized
                        />
                        <div className={styles.taskInfo}>
                          <div className={styles.taskPlant}>
                            {reminder.plantName}
                          </div>
                          <div className={styles.taskCare}>
                            {reminder.careType === "Riego" ? "💧" : "🧪"}{" "}
                            {reminder.careType}
                          </div>
                        </div>
                        <div className={styles.taskStatus}>
                          {/* No hay botón, mostramos un indicador */}
                          <div
                            className={styles.futureBadge}
                            title="Tarea futura"
                          >
                            ◇
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {/* -------------------------------------- */}

              {/* Mensaje si no hay nada que mostrar (debería ser raro con la lógica externa) */}
              {selectedDateTasks.length === 0 &&
                selectedFutureReminders.length === 0 && (
                  <p className={styles.noTasksMessage}>
                    No hay tareas ni recordatorios para este día.
                  </p>
                )}
            </div>
          )}
      </div>
    </div>
  );
}
