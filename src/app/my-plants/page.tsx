// src/app/my-plants/page.tsx

"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/MyPlants.module.css";
import Image from "next/image";
import ReminderSetup from "@/components/ReminderSetup";
import PlantDiary from "@/components/PlantDiary";
import Link from "next/link";

// --- TIPOS DE DATOS ---
// Tipo base de la planta que viene de Supabase
type PlantFromDB = {
  id: number;
  created_at: string;
  name: string;
  image_url: string;
  care_instructions: string;
  watering_frequency_days: number | null;
  fertilizing_frequency_days: number | null;
  care_level: "Fácil" | "Media" | "Difícil" | null;
  pet_friendly: boolean | null;
  is_toxic: boolean | null;
};

// Tipo extendido para usar en el componente
type Plant = PlantFromDB;

// --- CONFIGURACIÓN DE TARJETAS DE CUIDADO ---
const careConfig = {
  Riego: { icon: "💧", color: "#2196F3", bgColor: "#E3F2FD" },
  Luz: { icon: "☀️", color: "#FF9800", bgColor: "#FFF3E0" },
  Sustrato: { icon: "🌱", color: "#795548", bgColor: "#EFEBE9" },
  Fertilizante: { icon: "🧪", color: "#9C27B0", bgColor: "#F3E5F5" },
  Humedad: { icon: "💨", color: "#00BCD4", bgColor: "#E0F7FA" },
  "Plagas Comunes": { icon: "🐞", color: "#d32f2f", bgColor: "#ffcdd2" },
  "Enfermedades Comunes": { icon: "🍄", color: "#7B1FA2", bgColor: "#E1BEE7" },
  General: { icon: "ℹ️", color: "#607D8B", bgColor: "#ECEFF1" },
};

type CareKey = keyof typeof careConfig;

// --- PARSEADOR PARA PLAGAS Y ENFERMEDADES (ADAPTADO) ---
const PestDiseaseParser = ({ text }: { text: string }) => {
  const items = text.split(/\d+\.\s+/).filter((s) => s.trim().length > 0);

  return (
    <div className={styles.careContentComplex}>
      {items.map((item, index) => {
        const cleanItem = item.replace(/\*\*/g, "");
        const titleMatch = cleanItem.match(/^([\s\S]*?)(?=\n|Síntomas:)/);
        const title = titleMatch
          ? titleMatch[1].trim()
          : `Problema ${index + 1}`;
        const symptomMatch = cleanItem.match(
          /Síntomas:\s*([\s\S]*?)(?=\nControl:|Control:|$)/
        );
        const symptoms = symptomMatch ? symptomMatch[1].trim() : "";
        const controlMatch = cleanItem.match(/Control:\s*([\s\S]*?)$/);
        const control = controlMatch ? controlMatch[1].trim() : "";

        return (
          <div key={index} className={styles.careContentDetail}>
            <strong>{title}</strong>
            {symptoms && (
              <div className={styles.pestSubsection}>
                <em>Síntomas:</em> {symptoms}
              </div>
            )}
            {control && (
              <div className={styles.pestSubsection}>
                <em>Control:</em> {control}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const CareInstructions = ({ text }: { text: string }) => {
  const sections = text.split("### ").filter((s) => s);
  return (
    <div className={styles.careGrid}>
      {sections.map((section) => {
        const [title, ...contentParts] = section.split(":");
        const content = contentParts.join(":").trim();
        const trimmedTitle = title.trim() as CareKey;
        const config = careConfig[trimmedTitle] || {
          icon: "📋",
          color: "#4caf50",
          bgColor: "#E8F5E9",
        };

        if (trimmedTitle === "General") return null;

        const isComplex = ["Plagas Comunes", "Enfermedades Comunes"].includes(
          trimmedTitle
        );

        return (
          <div
            key={title}
            className={styles.careCard}
            style={{ borderLeft: `4px solid ${config.color}` }}
          >
            <div
              className={styles.careHeader}
              style={{ backgroundColor: config.bgColor }}
            >
              <span className={styles.careIcon}>{config.icon}</span>
              <h4 style={{ color: config.color }}>{trimmedTitle}</h4>
            </div>
            <div className={styles.careContent}>
              {isComplex ? (
                <PestDiseaseParser text={content} />
              ) : (
                <p>{content}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function MyPlants() {
  const supabase = createClient();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlant, setExpandedPlant] = useState<number | null>(null);

  // --- ESTADOS PARA BÚSQUEDA, FILTRO Y ORDENAMIENTO ---
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [petFilter, setPetFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  useEffect(() => {
    const fetchPlants = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("plants")
          .select("*")
          .eq("user_id", user.id);

        if (error) {
          setError("No se pudieron cargar tus plantas.");
        } else {
          // Cargar recordatorios para cada planta
          const plantsWithReminders = await Promise.all(
            (data || []).map(async (plant) => {
              const { data: reminders } = await supabase
                .from("reminders")
                .select("*")
                .eq("plant_id", plant.id)
                .eq("user_id", user.id);

              let watering_frequency = null;
              let fertilizing_frequency = null;

              reminders?.forEach((reminder) => {
                if (reminder.care_type === "Riego") {
                  watering_frequency = reminder.frequency_days;
                } else if (reminder.care_type === "Fertilizante") {
                  fertilizing_frequency = reminder.frequency_days;
                }
              });

              return {
                ...plant,
                watering_frequency_days: watering_frequency,
                fertilizing_frequency_days: fertilizing_frequency,
              };
            })
          );

          setPlants(plantsWithReminders);
        }
      }
      setLoading(false);
    };
    fetchPlants();
  }, [supabase]);

  // --- LÓGICA DE FILTRADO Y ORDENAMIENTO AVANZADO ---
  const processedPlants = useMemo(() => {
    let processed = [...plants];

    if (difficultyFilter !== "all") {
      processed = processed.filter((p) => p.care_level === difficultyFilter);
    }

    if (petFilter !== "all") {
      const isPetFriendly = petFilter === "yes";
      processed = processed.filter((p) => p.pet_friendly === isPetFriendly);
    }

    if (searchTerm) {
      processed = processed.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (sortBy === "oldest") {
      processed.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } else {
      // 'newest' es el default
      processed.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return processed;
  }, [plants, searchTerm, difficultyFilter, petFilter, sortBy]);

  const togglePlant = (plantId: number) => {
    setExpandedPlant(expandedPlant === plantId ? null : plantId);
  };

  const handleSaveReminder = async (
    plantId: number,
    careType: "Riego" | "Fertilizante",
    frequency: number
  ) => {
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

      if (reminderError || !reminder) {
        // Si no existe, crear uno nuevo
        const today = new Date().toISOString().split("T")[0];
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + frequency);

        const { error: insertError } = await supabase.from("reminders").insert([
          {
            plant_id: plantId,
            user_id: user.id,
            care_type: careType,
            frequency_days: frequency,
            next_reminder_date: nextDate.toISOString().split("T")[0],
          },
        ]);

        if (insertError) throw insertError;

        alert("Recordatorio creado correctamente");
      } else {
        // 2. Calcular la próxima fecha
        const today = new Date();
        const nextReminderDate = new Date(today);
        nextReminderDate.setDate(nextReminderDate.getDate() + frequency);

        // 3. Actualizar el recordatorio existente
        const { error: updateError } = await supabase
          .from("reminders")
          .update({
            frequency_days: frequency,
            next_reminder_date: nextReminderDate.toISOString().split("T")[0],
          })
          .eq("id", reminder.id);

        if (updateError) throw updateError;

        alert("Recordatorio actualizado correctamente");
      }

      // No recargamos la página, solo actualizamos el estado local
      // El componente ReminderSetup ya actualizó su estado
    } catch (error) {
      console.error("Error:", error);
      alert(
        "Error: " + (error instanceof Error ? error.message : "desconocido")
      );
    }
  };

  const handleDeletePlant = async (plantId: number, imageUrl: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta planta?")) {
      return;
    }

    try {
      // Eliminar imagen de storage
      if (imageUrl) {
        const fileName = imageUrl.split("/").pop();
        if (fileName) {
          await supabase.storage.from("plant_images").remove([fileName]);
        }
      }

      // Eliminar planta de la base de datos
      const { error } = await supabase
        .from("plants")
        .delete()
        .eq("id", plantId);

      if (error) throw error;

      // Actualizar lista de plantas
      setPlants(plants.filter((p) => p.id !== plantId));
      alert("Planta eliminada correctamente");
    } catch (error) {
      console.error("Error al eliminar planta:", error);
      alert(
        "Error: " + (error instanceof Error ? error.message : "desconocido")
      );
    }
  };

  const getDifficultyClass = (level: Plant["care_level"]) => {
    if (level === "Fácil") return styles.levelEasy;
    if (level === "Media") return styles.levelMedium;
    if (level === "Difícil") return styles.levelHard;
    return "";
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <h2>Cargando tus plantas...</h2>
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
        <h1>🌿 Mis Plantas</h1>
        <p>Busca, filtra y gestiona todas tus plantas y sus cuidados.</p>
      </div>

      <div className={styles.controlsContainer}>
        <input
          type="text"
          placeholder="Buscar por nombre..."
          className={styles.searchInput}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className={styles.filterGrid}>
          <div className={styles.filterGroup}>
            <label>Ordenar por</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Más nuevas</option>
              <option value="oldest">Más antiguas</option>
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label>Dificultad</label>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
            >
              <option value="all">Todas</option>
              <option value="Fácil">Fácil</option>
              <option value="Media">Media</option>
              <option value="Difícil">Difícil</option>
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label>Mascotas</label>
            <select
              value={petFilter}
              onChange={(e) => setPetFilter(e.target.value)}
            >
              <option value="all">Todas</option>
              <option value="yes">Aptas para mascotas</option>
              <option value="no">No aptas para mascotas</option>
            </select>
          </div>
        </div>
      </div>

      {processedPlants.length > 0 ? (
        <div className={styles.myPlantsGrid}>
          {processedPlants.map((plant) => (
            <div
              key={plant.id}
              className={`${styles.plantCard} ${
                expandedPlant === plant.id ? styles.plantCardExpanded : ""
              }`}
            >
              <div className={styles.plantImageWrapper}>
                <Image
                  src={plant.image_url}
                  alt={plant.name}
                  width={400}
                  height={300}
                  className={styles.plantCardImage}
                  unoptimized
                />
                <div className={styles.plantNameOverlay}>
                  <h3>{plant.name}</h3>
                </div>
              </div>
              <div className={styles.plantCardContent}>
                <div className={styles.generalInfo}>
                  {plant.care_level && (
                    <span
                      className={`${styles.infoTag} ${getDifficultyClass(
                        plant.care_level
                      )}`}
                    >
                      {plant.care_level}
                    </span>
                  )}
                  {plant.pet_friendly === true && (
                    <span className={`${styles.infoTag} ${styles.petFriendly}`}>
                      🐾 Apta para Mascotas
                    </span>
                  )}
                  {plant.is_toxic === true && (
                    <span className={`${styles.infoTag} ${styles.isToxic}`}>
                      ⚠️ Venenosa
                    </span>
                  )}
                </div>
                <div className={styles.buttonGroup}>
                  <button
                    onClick={() => togglePlant(plant.id)}
                    className={styles.toggleButton}
                  >
                    {expandedPlant === plant.id ? "Ocultar" : "Ver Cuidados"}
                  </button>
                  <button
                    onClick={() => handleDeletePlant(plant.id, plant.image_url)}
                    className={styles.deleteButton}
                    title="Eliminar planta"
                  >
                    🗑️
                  </button>
                </div>
                {expandedPlant === plant.id && (
                  <div className={styles.careInstructionsWrapper}>
                    <div className={styles.remindersSection}>
                      <h3>Recordatorios</h3>
                      <ReminderSetup
                        plantId={plant.id}
                        careType="Riego"
                        initialFrequency={plant.watering_frequency_days}
                        onSave={(f) => handleSaveReminder(plant.id, "Riego", f)}
                      />
                      <ReminderSetup
                        plantId={plant.id}
                        careType="Fertilizante"
                        initialFrequency={plant.fertilizing_frequency_days}
                        onSave={(f) =>
                          handleSaveReminder(plant.id, "Fertilizante", f)
                        }
                      />
                    </div>
                    <div className={styles.diaryLinkContainer}>
                      <Link
                        href={`/plant-diary/${plant.id}`}
                        className={styles.diaryLinkButton}
                      >
                        Ver Diario de la Planta 📖
                      </Link>
                    </div>
                    <h3 className={styles.careTitle}>Guía de Cuidados</h3>
                    <CareInstructions text={plant.care_instructions} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🪴</span>
          <h3>No se encontraron plantas</h3>
          <p>
            Prueba a cambiar el término de búsqueda, los filtros o añade una
            nueva planta.
          </p>
        </div>
      )}
    </div>
  );
}
