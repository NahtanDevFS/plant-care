// src/components/TaskCalendar.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./TaskCalendar.module.css";

type TaskDay = {
  date: string;
  tasks: {
    id: string;
    plantName: string;
    careType: "Riego" | "Fertilizante";
    isCompleted: boolean;
    completedDate?: string;
  }[];
};

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  taskCount: number;
  completedCount: number;
  tasks: TaskDay["tasks"];
};

export default function TaskCalendar() {
  const supabase = createClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [taskHistory, setTaskHistory] = useState<TaskDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const getMonthTasks = async (year: number, month: number) => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Obtener todas las tareas del mes y del próximo mes (para mostrar futuras)
    const firstDay = new Date(year, month, 1).toISOString().split("T")[0];
    const lastDay = new Date(year, month + 2, 0).toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("task_history")
      .select("*, plants(name)")
      .eq("user_id", user.id)
      .gte("scheduled_date", firstDay)
      .lte("scheduled_date", lastDay)
      .order("scheduled_date", { ascending: true });

    if (error) {
      console.error("Error al cargar tareas:", error);
    } else {
      const grouped: { [key: string]: TaskDay["tasks"] } = {};

      data?.forEach((task: any) => {
        const dateKey = task.scheduled_date;
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push({
          id: task.id,
          plantName: task.plants?.name || "Planta desconocida",
          careType: task.care_type,
          isCompleted: task.is_completed,
          completedDate: task.completed_date,
        });
      });

      const taskDays: TaskDay[] = Object.entries(grouped).map(
        ([date, tasks]) => ({
          date,
          tasks,
        })
      );

      setTaskHistory(taskDays);
    }
    setLoading(false);
  };

  useEffect(() => {
    getMonthTasks(currentMonth.getFullYear(), currentMonth.getMonth());
  }, [currentMonth]);

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
      days.push({
        date,
        isCurrentMonth: false,
        taskCount: 0,
        completedCount: 0,
        tasks: [],
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
      const dayTasks =
        taskHistory.find((t) => t.date === dateString)?.tasks || [];
      const completedCount = dayTasks.filter((t) => t.isCompleted).length;

      days.push({
        date,
        isCurrentMonth: true,
        taskCount: dayTasks.length,
        completedCount: completedCount,
        tasks: dayTasks,
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
      days.push({
        date,
        isCurrentMonth: false,
        taskCount: 0,
        completedCount: 0,
        tasks: [],
      });
    }

    return days;
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

  const handleCompleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("task_history")
        .update({
          is_completed: true,
          completed_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", taskId);

      if (error) throw error;

      // Recargar tareas
      getMonthTasks(currentMonth.getFullYear(), currentMonth.getMonth());
    } catch (error) {
      console.error("Error al completar tarea:", error);
      alert("Error al completar la tarea");
    }
  };

  const calendarDays = generateCalendarDays();
  const selectedDateTasks = selectedDate
    ? taskHistory.find((t) => t.date === selectedDate)?.tasks || []
    : [];

  const monthName = currentMonth.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  if (loading && taskHistory.length === 0) {
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
        <p>Visualiza tu historial de tareas completadas y pendientes</p>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendSymbol}>✓</span>
          <span>Tarea completada</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendSymbol} ${styles.pending}`}>●</span>
          <span>Tarea pendiente</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendSymbol}>✓●</span>
          <span>Día con tareas mixtas</span>
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
                  {day.taskCount > 0 && (
                    <div className={styles.taskIndicators}>
                      {day.completedCount > 0 && (
                        <span
                          className={styles.completed}
                          title={`${day.completedCount} completadas`}
                        >
                          ✓
                        </span>
                      )}
                      {day.taskCount - day.completedCount > 0 && (
                        <span
                          className={styles.pending}
                          title={`${
                            day.taskCount - day.completedCount
                          } pendientes`}
                        >
                          ●
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
              Tareas del{" "}
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
                  <div className={styles.taskInfo}>
                    <div className={styles.taskPlant}>{task.plantName}</div>
                    <div className={styles.taskCare}>
                      {task.careType === "Riego" ? "💧" : "🧪"} {task.careType}
                    </div>
                  </div>
                  <div className={styles.taskStatus}>
                    {task.isCompleted ? (
                      <div className={styles.completedBadge}>✓ Completado</div>
                    ) : (
                      <button
                        onClick={() => handleCompleteTask(task.id.toString())}
                        className={styles.completeButton}
                      >
                        Marcar como hecho
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
