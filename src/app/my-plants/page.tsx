import { createClient } from "@/lib/supabase/server";
import styles from "@/app/HomePage.module.css";
import Image from "next/image";

export default async function MyPlants() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p>Inicia sesión para ver tus plantas.</p>;
  }

  const { data: plants, error } = await supabase
    .from("plants")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Mis Plantas Guardadas</h1>
        <p>Aquí encontrarás todas las plantas que has identificado.</p>
      </div>

      {plants && plants.length > 0 ? (
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
                  <pre>{plant.care_instructions}</pre>
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
