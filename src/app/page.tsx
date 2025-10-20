// src/app/page.tsx

"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./HomePage.module.css";
import { compressImage, captureFromCamera } from "@/lib/imageCompression";

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
  const [isCompressing, setIsCompressing] = useState(false);
  const router = useRouter();

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await processImage(file);
    }
  };

  const handleCameraCapture = async () => {
    setIsCompressing(true);
    try {
      const capturedImage = await captureFromCamera("environment");
      await processImage(capturedImage);
    } catch (error) {
      console.error("Error al capturar desde cámara:", error);
      alert(
        error instanceof Error ? error.message : "Error al acceder a la cámara"
      );
    } finally {
      setIsCompressing(false);
    }
  };

  const processImage = async (file: File) => {
    setIsCompressing(true);
    try {
      // Comprimir la imagen antes de usarla
      const compressedImage = await compressImage(file, 1200, 1200, 0.85);

      setImage(compressedImage);
      setImagePreview(URL.createObjectURL(compressedImage));
      setResults(null);
      setSelectedPlant(null);
      setCareInfo("");
    } catch (error) {
      console.error("Error al procesar imagen:", error);
      alert("Error al procesar la imagen. Por favor, intenta con otra.");
    } finally {
      setIsCompressing(false);
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

          {isCompressing && (
            <div className={styles.loadingState}>
              <div className={styles.loadingSpinnerSmall}></div>
              <p className={styles.loadingMessage}>Optimizando imagen...</p>
            </div>
          )}

          <div className={styles.buttonGroup}>
            <label htmlFor="file-upload" className={styles.uploadButton}>
              📁 Subir Foto
              <input
                id="file-upload"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: "none" }}
                disabled={loading || isCompressing}
              />
            </label>

            <button
              onClick={handleCameraCapture}
              disabled={loading || isCompressing}
              className={styles.cameraButton}
            >
              📷 Tomar Foto
            </button>
          </div>

          <button
            onClick={handleIdentifyClick}
            disabled={loading || !image || isCompressing}
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
