// src/app/my-plants/page.tsx

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/MyPlants.module.css";
import Image from "next/image";

// Definimos un tipo para la planta para mayor claridad
type Plant = {
  id: number;
  name: string;
  image_url: string;
  care_instructions: string;
};

// Mapeo de iconos y colores para cada categoría de cuidado
const careConfig = {
  Riego: { icon: "💧", color: "#2196F3", bgColor: "#E3F2FD" },
  Luz: { icon: "☀️", color: "#FF9800", bgColor: "#FFF3E0" },
  Sustrato: { icon: "🌱", color: "#795548", bgColor: "#EFEBE9" },
  Fertilizante: { icon: "🧪", color: "#9C27B0", bgColor: "#F3E5F5" },
  Humedad: { icon: "💨", color: "#00BCD4", bgColor: "#E0F7FA" },
};

type CareKey = keyof typeof careConfig;

// Nuevo componente mejorado para mostrar las instrucciones de cuidado
const CareInstructions = ({ text }: { text: string }) => {
  const sections = text.split("### ").filter((s) => s);

  return (
    <div className={styles.careGrid}>
      {sections.map((section) => {
        const [title, ...content] = section.split(":");
        const trimmedTitle = title.trim() as CareKey;
        const config = careConfig[trimmedTitle] || {
          icon: "📋",
          color: "#4caf50",
          bgColor: "#E8F5E9",
        };

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
            <p className={styles.careContent}>{content.join(":").trim()}</p>
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

  const togglePlant = (plantId: number) => {
    setExpandedPlant(expandedPlant === plantId ? null : plantId);
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
        <h1>🌿 Mis Plantas Guardadas</h1>
        <p>
          Aquí encontrarás todas las plantas que has identificado y sus cuidados
          personalizados.
        </p>
      </div>

      {plants.length > 0 ? (
        <div className={styles.myPlantsGrid}>
          {plants.map((plant) => (
            <div key={plant.id} className={styles.plantCard}>
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
                <button
                  onClick={() => togglePlant(plant.id)}
                  className={styles.toggleButton}
                >
                  {expandedPlant === plant.id ? (
                    <>
                      <span>Ocultar Cuidados</span>
                      <span className={styles.arrow}>▲</span>
                    </>
                  ) : (
                    <>
                      <span>Ver Guía de Cuidados</span>
                      <span className={styles.arrow}>▼</span>
                    </>
                  )}
                </button>

                {expandedPlant === plant.id && (
                  <div className={styles.careInstructionsWrapper}>
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
          <h3>Aún no has guardado ninguna planta</h3>
          <p>¡Identifica tu primera planta y comienza tu jardín digital!</p>
        </div>
      )}
    </div>
  );
}
