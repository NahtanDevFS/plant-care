// src/app/my-plants/page.tsx

"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/MyPlants.module.css";
import Image from "next/image";
import ReminderSetup from "@/components/ReminderSetup";

type Plant = {
  id: number;
  name: string;
  image_url: string;
  care_instructions: string;
  watering_frequency_days: number | null;
  fertilizing_frequency_days: number | null;
  care_level: "Fácil" | "Media" | "Difícil" | null;
  pet_friendly: boolean | null;
  is_toxic: boolean | null;
};

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

// --- PARSEADOR DE PLAGAS Y ENFERMEDADES ---
const PestDiseaseParser = ({ text }: { text: string }) => {
  // Dividir por números seguidos de punto (1., 2., etc.)
  const items = text.split(/\d+\.\s+/).filter((s) => s.trim().length > 0);

  return (
    <div className={styles.careContentComplex}>
      {items.map((item, index) => {
        // Limpiar asteriscos del texto
        const cleanItem = item.replace(/\*\*/g, "");

        // Buscar el título (todo antes de "Síntomas:")
        const titleMatch = cleanItem.match(
          /^([\s\S]*?)(?=\nSíntomas:|Síntomas:)/
        );
        const title = titleMatch
          ? titleMatch[1].trim()
          : `Problema ${index + 1}`;

        // Extraer síntomas
        const symptomMatch = cleanItem.match(
          /Síntomas:\s*([\s\S]*?)(?=\nControl:|Control:|$)/
        );
        const symptoms = symptomMatch ? symptomMatch[1].trim() : "";

        // Extraer control
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
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlants = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("plants")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          setError("No se pudieron cargar tus plantas.");
        } else {
          setPlants(data || []);
        }
      }
      setLoading(false);
    };
    fetchPlants();
  }, [supabase]);

  const filteredPlants = useMemo(() => {
    let filtered = plants;
    if (searchTerm) {
      filtered = filtered.filter((plant) =>
        plant.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (activeFilter) {
      switch (activeFilter) {
        case "Fácil":
          filtered = filtered.filter((plant) => plant.care_level === "Fácil");
          break;
        case "pet_friendly":
          filtered = filtered.filter((plant) => plant.pet_friendly === true);
          break;
        default:
          break;
      }
    }
    return filtered;
  }, [plants, searchTerm, activeFilter]);

  const togglePlant = (plantId: number) => {
    setExpandedPlant(expandedPlant === plantId ? null : plantId);
  };

  const handleSaveReminder = async (
    plantId: number,
    careType: "Riego" | "Fertilizante",
    frequency: number
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      alert("Debes iniciar sesión para guardar recordatorios.");
      return;
    }
    try {
      const plantUpdate =
        careType === "Riego"
          ? { watering_frequency_days: frequency }
          : { fertilizing_frequency_days: frequency };
      const { error: plantError } = await supabase
        .from("plants")
        .update(plantUpdate)
        .eq("id", plantId)
        .eq("user_id", user.id);
      if (plantError) throw plantError;
      const today = new Date();
      const next_reminder_date = new Date(
        today.getTime() + frequency * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split("T")[0];
      const { error: reminderError } = await supabase.from("reminders").upsert(
        {
          plant_id: plantId,
          user_id: user.id,
          care_type: careType,
          frequency_days: frequency,
          next_reminder_date: next_reminder_date,
        },
        { onConflict: "plant_id, care_type" }
      );
      if (reminderError) throw reminderError;
      setPlants(
        plants.map((p) => (p.id === plantId ? { ...p, ...plantUpdate } : p))
      );
    } catch (error) {
      console.error("Error al guardar el recordatorio:", error);
      alert(
        `No se pudo guardar el recordatorio: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }
  };

  const handleDeletePlant = async (plantId: number, imageUrl: string) => {
    if (
      !window.confirm(
        "¿Estás seguro de que quieres eliminar esta planta? Esta acción es irreversible."
      )
    )
      return;
    try {
      const filePath = imageUrl.substring(
        imageUrl.indexOf("plant_images/") + "plant_images/".length
      );
      const { error: storageError } = await supabase.storage
        .from("plant_images")
        .remove([filePath]);
      if (storageError)
        console.error("Error al borrar la imagen del storage:", storageError);
      const { error: dbError } = await supabase
        .from("plants")
        .delete()
        .eq("id", plantId);
      if (dbError) throw dbError;
      setPlants((currentPlants) =>
        currentPlants.filter((p) => p.id !== plantId)
      );
      alert("Planta eliminada con éxito.");
    } catch (error) {
      console.error("Error al eliminar la planta:", error);
      alert("No se pudo eliminar la planta. Inténtalo de nuevo.");
    }
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
        <div className={styles.filterButtons}>
          <button
            className={!activeFilter ? styles.activeFilter : ""}
            onClick={() => setActiveFilter(null)}
          >
            Todas
          </button>
          <button
            className={activeFilter === "Fácil" ? styles.activeFilter : ""}
            onClick={() => setActiveFilter("Fácil")}
          >
            Fáciles de Cuidar
          </button>
          <button
            className={
              activeFilter === "pet_friendly" ? styles.activeFilter : ""
            }
            onClick={() => setActiveFilter("pet_friendly")}
          >
            Aptas para Mascotas
          </button>
        </div>
      </div>
      {filteredPlants.length > 0 ? (
        <div className={styles.myPlantsGrid}>
          {filteredPlants.map((plant) => (
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
                      className={`${styles.infoTag} ${
                        styles[`level${plant.care_level}`]
                      }`}
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
            Prueba a cambiar el término de búsqueda, el filtro o añade una nueva
            planta.
          </p>
        </div>
      )}
    </div>
  );
}
