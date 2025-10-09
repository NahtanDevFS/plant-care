// src/app/page.tsx

"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./HomePage.module.css";

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

// --- COMPONENTE DE PANTALLA DE CARGA ---
const LoadingScreen = ({ plantName }: { plantName: string }) => {
  return (
    <div className={styles.loadingOverlay}>
      <div className={styles.loadingContent}>
        <div className={styles.loadingSpinnerAnimation}></div>
        <h2>Guardando tu planta...</h2>
        <p>{plantName}</p>
        <p className={styles.loadingSubtext}>
          Generando guía de cuidados personalizada
        </p>
      </div>
    </div>
  );
};

// --- ESTILOS PARA PANTALLA DE CARGA ---
// Agrega esto a tu HomePage.module.css:
/* 
.loadingOverlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.95), rgba(56, 142, 60, 0.95));
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.loadingContent {
  text-align: center;
  color: white;
}

.loadingSpinner {
  width: 60px;
  height: 60px;
  border: 5px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 2rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loadingContent h2 {
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
  color: white;
}

.loadingContent p {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
  margin: 0.5rem 0;
}

.loadingSubtext {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
}
*/

export default function HomePage() {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [results, setResults] = useState<IdentificationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<PlantSuggestion | null>(
    null
  );
  const [careInfo, setCareInfo] = useState<string>("");
  const [isSavingPlant, setIsSavingPlant] = useState(false);
  const [savingPlantName, setSavingPlantName] = useState<string>("");
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const router = useRouter();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
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

    setIsSavingPlant(true);
    setSavingPlantName(suggestion.name);
    setSelectedPlant(suggestion);
    setCareInfo("Obteniendo cuidados y guardando tu planta...");

    const formData = new FormData();
    formData.append("image", image);
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

      // --- REDIRIGIR A MIS PLANTAS DESPUÉS DE 1 SEGUNDO ---
      setTimeout(() => {
        router.push("/my-plants");
      }, 1000);
    } catch (error) {
      console.error(error);
      setCareInfo("");
      setIsSavingPlant(false);
      alert(
        `Ocurrió un error: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }
  };

  // --- NO MOSTRAR NADA SI SE ESTÁ GUARDANDO ---
  if (isSavingPlant) {
    return <LoadingScreen plantName={savingPlantName} />;
  }

  return (
    <>
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
            disabled={loading}
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
                  <Image
                    src={suggestion.similar_images[0].url_small}
                    alt={suggestion.name}
                    width={80}
                    height={80}
                    className={styles.suggestionImage}
                    unoptimized={true}
                    onClick={() =>
                      setModalImageUrl(suggestion.similar_images[0].url)
                    }
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
