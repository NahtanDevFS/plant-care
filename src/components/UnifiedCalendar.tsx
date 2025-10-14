// src/components/UnifiedCalendar.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./UnifiedCalendar.module.css";
import Image from "next/image";

type Task = {
  id: string;
  plantName: string;
  careType: "Riego" | "Fertilizante";
  isCompleted: boolean;
  completedDate?: string;
  imageUrl: string;
};

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  tasks: Task[];
  completedCount: number;
  pendingCount: number;
  futureReminders: number;
};

export default function UnifiedCalendar() {
  const supabase = createClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<{ [key: string]: Task[] }>({});
  const [futureReminders, setFutureReminders] = useState<{
    [key: string]: number;
  }>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    loadCalendarData();
  }, [currentMonth]);

  const loadCalendarData = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const firstDay = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    )
      .toISOString()
      .split("T")[0];
    const lastDay = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 2,
      0
    )
      .toISOString()
      .split("T")[0];

    // Cargar tareas completadas y pendientes
    const { data: taskData } = await supabase
      .from("task_history")
      .select("*, plants(name, image_url)")
      .eq("user_id", user.id)
      .gte("scheduled_date", firstDay)
      .lte("scheduled_date", lastDay)
      .order("scheduled_date", { ascending: true });

    // Cargar recordatorios futuros
    const { data: reminderData } = await supabase
      .from("reminders")
      .select("*, plants(name, image_url)")
      .eq("user_id", user.id)
      .gte("next_reminder_date", firstDay)
      .lte("next_reminder_date", lastDay);

    // Agrupar tareas por fecha
    const groupedTasks: { [key: string]: Task[] } = {};
    taskData?.forEach((task: any) => {
      const dateKey = task.scheduled_date;
      if (!groupedTasks[dateKey]) {
        groupedTasks[dateKey] = [];
      }
      groupedTasks[dateKey].push({
        id: task.id,
        plantName: task.plants?.name || "Planta desconocida",
        careType: task.care_type,
        isCompleted: task.is_completed,
        completedDate: task.completed_date,
        imageUrl: task.plants?.image_url || "/plant-care.png",
      });
    });

    // Contar recordatorios futuros por fecha
    const reminderCounts: { [key: string]: number } = {};
    reminderData?.forEach((reminder: any) => {
      const dateKey = reminder.next_reminder_date;
      reminderCounts[dateKey] = (reminderCounts[dateKey] || 0) + 1;
    });

    setTasks(groupedTasks);
    setFutureReminders(reminderCounts);
    setLoading(false);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const generateCalendarDays = (): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const firstDay = getFirstDayOfMonth(currentMonth);
    const daysInMonth = getDaysInMonth(currentMonth);
    const daysInPrevMonth = getDaysInMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    );

    // Días del mes anterior
    for (let i = firstDay - 1; i >= 0; i--) {
      const date = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() - 1,
        daysInPrevMonth - i
      );
      const dateString = date.toISOString().split("T")[0];
      days.push({
        date,
        isCurrentMonth: false,
        tasks: tasks[dateString] || [],
        completedCount: 0,
        pendingCount: 0,
        futureReminders: futureReminders[dateString] || 0,
      });
    }

    // Días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        i
      );
      const dateString = date.toISOString().split("T")[0];
      const dayTasks = tasks[dateString] || [];
      const completedCount = dayTasks.filter((t) => t.isCompleted).length;
      const pendingCount = dayTasks.length - completedCount;

      days.push({
        date,
        isCurrentMonth: true,
        tasks: dayTasks,
        completedCount,
        pendingCount,
        futureReminders: futureReminders[dateString] || 0,
      });
    }

    // Días del mes siguiente
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        i
      );
      const dateString = date.toISOString().split("T")[0];
      days.push({
        date,
        isCurrentMonth: false,
        tasks: tasks[dateString] || [],
        completedCount: 0,
        pendingCount: 0,
        futureReminders: futureReminders[dateString] || 0,
      });
    }

    return days;
  };

  const handleCompleteTask = async (taskId: string) => {
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

      await loadCalendarData();
    } catch (error) {
      console.error("Error al completar tarea:", error);
      alert("Error al completar la tarea");
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    );
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    );
    setSelectedDate(null);
  };

  const calendarDays = generateCalendarDays();
  const selectedDateTasks = selectedDate ? tasks[selectedDate] || [] : [];

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
          <span>Futura</span>
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
                    day.isCurrentMonth && setSelectedDate(dateString)
                  }
                >
                  <div className={styles.dayNumber}>{day.date.getDate()}</div>
                  {(day.tasks.length > 0 || day.futureReminders > 0) && (
                    <div className={styles.taskIndicators}>
                      {day.completedCount > 0 && (
                        <span className={styles.completed} title="Completadas">
                          ✓
                        </span>
                      )}
                      {day.pendingCount > 0 && (
                        <span className={styles.pending} title="Pendientes">
                          ●
                        </span>
                      )}
                      {day.futureReminders > 0 && (
                        <span
                          className={styles.future}
                          title={`${day.futureReminders} futuras`}
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

        {selectedDateTasks.length > 0 && (
          <div className={styles.taskDetail}>
            <h3>
              {new Date(selectedDate!).toLocaleDateString("es-ES", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </h3>
            <div className={styles.taskList}>
              {selectedDateTasks.map((task) => (
                <div
                  key={task.id}
                  className={`${styles.taskItem} ${
                    task.isCompleted ? styles.taskCompleted : styles.taskPending
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
                      {task.careType === "Riego" ? "💧" : "🧪"} {task.careType}
                    </div>
                  </div>
                  <div className={styles.taskStatus}>
                    {task.isCompleted ? (
                      <div className={styles.completedBadge}>✓</div>
                    ) : (
                      <button
                        onClick={() => handleCompleteTask(task.id)}
                        className={styles.completeButton}
                      >
                        Marcar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
