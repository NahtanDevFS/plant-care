// src/app/page.tsx

"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./HomePage.module.css";

// 1. CORRECCIÓN EN EL TIPO: de 'plant_name' a 'name'
type PlantSuggestion = {
  name: string;
  probability: number;
  similar_images: {
    id: string;
    url: string;
    similarity: number;
    url_small: string;
  }[];
  details: {
    common_names: string[] | null;
  };
};

type IdentificationResponse = {
  suggestions: PlantSuggestion[];
};

// Nuevo componente para mostrar las instrucciones de cuidado
const CareInstructions = ({ text }: { text: string }) => {
  if (!text || text === "Obteniendo cuidados y guardando tu planta...") {
    return <p>Cargando...</p>;
  }

  const sections = text.split("### ").filter((s) => s);

  return (
    <div>
      {sections.map((section) => {
        const [title, ...content] = section.split(":");
        return (
          <div key={title} className={styles.careSection}>
            <h3>{title}</h3>
            <p>{content.join(":").trim()}</p>
          </div>
        );
      })}
    </div>
  );
};

export default function HomePage() {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null); // Estado para la preview
  const [results, setResults] = useState<IdentificationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<PlantSuggestion | null>(
    null
  );
  const [careInfo, setCareInfo] = useState<string>("");

  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file)); // Creamos la URL para la preview
      setResults(null);
      setSelectedPlant(null);
      setCareInfo("");
    }
  };

  const handleIdentifyClick = async () => {
    if (!image) {
      alert("Por favor, sube una imagen primero.");
      return;
    }

    setLoading(true);
    setResults(null);
    setCareInfo("");
    setSelectedPlant(null);

    const formData = new FormData();
    formData.append("image", image);

    try {
      const response = await fetch("/api/identify", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Falló la identificación de la planta");
      }

      const data: IdentificationResponse = await response.json();
      data.suggestions.forEach(
        (s) => (s.probability = parseFloat((s.probability * 100).toFixed(2)))
      );
      setResults(data);
    } catch (error) {
      console.error(error);
      alert("Ocurrió un error al identificar la planta.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlant = async (suggestion: PlantSuggestion) => {
    if (!image) {
      alert("Error: no se encuentra la imagen original.");
      return;
    }

    setLoading(true);
    setSelectedPlant(suggestion);
    setCareInfo("Obteniendo cuidados y guardando tu planta...");

    const formData = new FormData();
    formData.append("image", image);
    // 2. CORRECCIÓN AL ENVIAR DATOS: de 'suggestion.plant_name' a 'suggestion.name'
    formData.append("plantName", suggestion.name);

    try {
      const response = await fetch("/api/save-plant", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Falló al guardar la planta");
      }

      const data = await response.json();
      setCareInfo(data.careInstructions);
      alert('¡Tu planta ha sido guardada en "Mi Jardín"!');
    } catch (error) {
      console.error(error);
      setCareInfo("");
      alert(
        `Ocurrió un error: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {" "}
      {/* Usamos un Fragment <> para poder tener el modal al mismo nivel que main */}
      <main className={styles.container}>
        <div className={styles.header}>
          <h1>PlantCare</h1>
          <p>Identifica tus plantas y aprende a cuidarlas al instante.</p>
        </div>

        <div className={styles.uploadSection}>
          {imagePreview && (
            <div className={styles.imagePreviewContainer}>
              <Image
                src={imagePreview}
                alt="Vista previa de la planta"
                width={150}
                height={150}
                className={styles.imagePreview}
              />
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className={styles.fileInput}
          />
          <button
            onClick={handleIdentifyClick}
            disabled={loading || !image}
            className={styles.button}
          >
            {loading ? "Identificando..." : "Identificar Planta"}
          </button>
        </div>

        {results && (
          <div className={styles.resultsContainer}>
            <h2>Posibles Coincidencias</h2>
            <ul className={styles.resultsList}>
              {results.suggestions.map((suggestion) => (
                <li key={suggestion.name} className={styles.resultItem}>
                  {/* --- MODIFICADO: Añadimos onClick para abrir el modal --- */}
                  <Image
                    src={suggestion.similar_images[0].url_small}
                    alt={suggestion.name}
                    width={80}
                    height={80}
                    className={styles.suggestionImage}
                    unoptimized={true}
                    onClick={() =>
                      setModalImageUrl(suggestion.similar_images[0].url)
                    } // Usamos la URL grande
                  />
                  <div className={styles.resultItemInfo}>
                    <strong>{suggestion.name}</strong>
                    {suggestion.details.common_names &&
                      suggestion.details.common_names.length > 0 && (
                        <p className={styles.commonName}>
                          {suggestion.details.common_names[0]}
                        </p>
                      )}
                    <p>Similitud: {suggestion.probability}%</p>
                  </div>
                  <button
                    onClick={() => handleSelectPlant(suggestion)}
                    className={styles.selectButton}
                    disabled={loading}
                  >
                    Seleccionar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {selectedPlant && careInfo && (
          <div className={styles.careInfo}>
            <h2>Cuidados para: {selectedPlant.name}</h2>
            <CareInstructions text={careInfo} />
          </div>
        )}
      </main>
      {/* --- NUEVO: JSX para mostrar el modal de la imagen ampliada --- */}
      {modalImageUrl && (
        <div
          className={styles.modalOverlay}
          onClick={() => setModalImageUrl(null)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles.closeButton}
              onClick={() => setModalImageUrl(null)}
            >
              &times;
            </button>
            <Image
              src={modalImageUrl}
              alt="Vista ampliada"
              layout="fill"
              objectFit="contain"
              unoptimized={true}
            />
          </div>
        </div>
      )}
    </>
  );
}
