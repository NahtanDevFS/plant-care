// src/app/plant-diary/[plantId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PlantDiary from "@/components/PlantDiary";
import styles from "./PlantDiaryPage.module.css";
import Image from "next/image";
import Link from "next/link";
import { FiBook, FiArrowLeft } from "react-icons/fi";

type Plant = {
  id: number;
  name: string;
  image_url: string;
};

export default function PlantDiaryPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const plantId = params.plantId ? Number(params.plantId) : null;

  const [plant, setPlant] = useState<Plant | null>(null);
  const [loadingPlant, setLoadingPlant] = useState(true);
  const [errorPlant, setErrorPlant] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlantDetails = async () => {
      if (!plantId) {
        setErrorPlant("ID de planta inválido.");
        setLoadingPlant(false);
        return;
      }

      setLoadingPlant(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("plants")
          .select("id, name, image_url")
          .eq("id", plantId)
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Error fetching plant details:", error);
          setErrorPlant("No se pudo cargar la información de la planta.");
          setPlant(null);
        } else {
          setPlant(data);
          setErrorPlant(null);
        }
      } else {
        setErrorPlant("Usuario no autenticado.");
      }
      setLoadingPlant(false);
    };

    fetchPlantDetails();
  }, [plantId, supabase]);

  if (loadingPlant) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>Cargando información de la planta...</p>
        </div>
      </div>
    );
  }

  if (errorPlant || !plant) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.header}>
          <h1>
            <FiBook /> Diario de Planta
          </h1>
          <Link href="/my-plants" className={styles.backButton}>
            <FiArrowLeft /> Volver a Mis Plantas
          </Link>
        </div>
        <p className={styles.errorMessagePage}>
          {errorPlant || "No se encontró la planta."}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <div className={styles.plantInfo}>
          <Image
            src={plant.image_url}
            alt={plant.name}
            width={60}
            height={60}
            className={styles.plantHeaderImage}
            unoptimized
          />
          <h1>Diario de: {plant.name}</h1>
        </div>
        <Link href="/my-plants" className={styles.backButton}>
          <FiArrowLeft /> Volver a Mis Plantas
        </Link>
      </div>
      <PlantDiary plantId={plant.id} />
    </div>
  );
}
