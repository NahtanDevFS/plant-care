// src/app/plant-diary/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import styles from "./PlantDiaryList.module.css";
import { FiBook, FiArchive } from "react-icons/fi";

type Plant = {
  id: number;
  name: string;
  image_url: string;
};

export default function SelectPlantForDiaryPage() {
  const supabase = createClient();
  const [allPlants, setAllPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchPlants = async () => {
      setLoading(true);
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error: fetchError } = await supabase
          .from("plants")
          .select("id, name, image_url")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (fetchError) {
          console.error("Error fetching plants:", fetchError);
          setError("No se pudieron cargar tus plantas.");
        } else {
          setAllPlants(data || []);
        }
      } else {
        setError("Usuario no autenticado.");
      }
      setLoading(false);
    };

    fetchPlants();
  }, [supabase]);

  const filteredPlants = useMemo(() => {
    if (!searchTerm) {
      return allPlants;
    }
    return allPlants.filter((plant) =>
      plant.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allPlants, searchTerm]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>Cargando tus plantas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>
            <FiBook /> Diario de Plantas
          </h1>
        </div>
        <p className={styles.errorMessage}>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>
          <FiBook /> Diario de Plantas
        </h1>
        <p>Selecciona una planta para ver o añadir entradas a su diario.</p>
      </div>

      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Buscar planta por nombre..."
          className={styles.searchInput}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {allPlants.length === 0 ? ( // Comprueba si originalmente no había plantas
        <div className={styles.emptyState}>
          <h3>No tienes plantas registradas</h3>
          <p>
            Identifica y guarda una planta primero para poder usar el diario.
          </p>
          <Link href="/" className={styles.identifyButton}>
            Identificar Planta
          </Link>
        </div>
      ) : filteredPlants.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>
            <FiArchive />
          </span>
          <h3>No se encontraron plantas</h3>
          <p>No hay plantas que coincidan con tu búsqueda: {searchTerm}.</p>
        </div>
      ) : (
        <div className={styles.plantsGrid}>
          {filteredPlants.map((plant) => (
            <Link
              key={plant.id}
              href={`/plant-diary/${plant.id}`}
              className={styles.plantCardLink}
            >
              <div className={styles.plantCard}>
                <Image
                  src={plant.image_url}
                  alt={plant.name}
                  width={200}
                  height={150}
                  className={styles.plantCardImage}
                  unoptimized
                />
                <div className={styles.plantCardName}>{plant.name}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
