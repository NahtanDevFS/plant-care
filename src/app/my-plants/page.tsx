// src/app/my-plants/page.tsx

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/HomePage.module.css";
import Image from "next/image";

// Definimos un tipo para la planta para mayor claridad
type Plant = {
  id: number;
  name: string;
  image_url: string;
  care_instructions: string;
};

// Nuevo componente para mostrar las instrucciones de cuidado
const CareInstructions = ({ text }: { text: string }) => {
  const sections = text.split("### ").filter((s) => s);

  return (
    <div>
      {sections.map((section) => {
        const [title, ...content] = section.split(":");
        return (
          <div key={title} className={styles.careSection}>
            <h4>{title}</h4>
            <p>{content.join(":").trim()}</p>
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

  if (loading) {
    return (
      <div className={styles.container}>
        <h2>Cargando tus plantas...</h2>
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
        <h1>Mis Plantas Guardadas</h1>
        <p>Aquí encontrarás todas las plantas que has identificado.</p>
      </div>

      {plants.length > 0 ? (
        <div className={styles.myPlantsGrid}>
          {plants.map((plant) => (
            <div key={plant.id} className={styles.plantCard}>
              <Image
                src={plant.image_url}
                alt={plant.name}
                width={300}
                height={300}
                className={styles.plantCardImage}
                unoptimized
              />
              <div className={styles.plantCardContent}>
                <h3>{plant.name}</h3>
                <details>
                  <summary>Ver Cuidados</summary>
                  <CareInstructions text={plant.care_instructions} />
                </details>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>
          Aún no has guardado ninguna planta. ¡Identifica tu primera planta!
        </p>
      )}
    </div>
  );
}
