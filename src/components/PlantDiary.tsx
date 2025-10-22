// src/components/PlantDiary.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  compressImage,
  getCameraStream, // <--- Importar
  capturePhotoFromVideo, // <--- Importar
} from "@/lib/imageCompression";
import styles from "./PlantDiary.module.css";

type DiaryEntry = {
  id: number;
  entry_date: string;
  notes: string | null;
  image_url: string | null;
  created_at: string;
};

type PlantDiaryProps = {
  plantId: number;
};

export default function PlantDiary({ plantId }: PlantDiaryProps) {
  const supabase = createClient();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null); // Ref para el video

  // --- Estados para la cámara ---
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment"
  );
  // -----------------------------

  useEffect(() => {
    fetchEntries();
  }, [plantId]);

  // Limpieza del stream de cámara al desmontar o cerrar
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/diary?plantId=${plantId}`);
      if (!response.ok) {
        throw new Error("Error al cargar las entradas del diario.");
      }
      const data: DiaryEntry[] = await response.json();
      setEntries(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error desconocido al cargar."
      );
    } finally {
      setLoading(false);
    }
  };

  // Función genérica para procesar una imagen (File)
  const processImageFile = async (file: File) => {
    setIsCompressing(true);
    setError(null); // Limpia errores previos de imagen
    try {
      const compressed = await compressImage(file, 800, 800, 0.8);
      setNewImage(compressed);
      setImagePreview(URL.createObjectURL(compressed));
    } catch (compressError) {
      console.error("Error processing image:", compressError);
      setError("Error al procesar la imagen. Intenta de nuevo.");
      setNewImage(null);
      setImagePreview(null);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processImageFile(e.target.files[0]);
    } else {
      // Si el usuario cancela, limpiar
      setNewImage(null);
      setImagePreview(null);
    }
  };

  const clearForm = () => {
    setNewNote("");
    setNewImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() && !newImage) {
      setError("Debes añadir una nota o una imagen.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("plantId", String(plantId));
    // Incluir nota solo si no está vacía, para evitar guardar entradas solo con imagen sin nota
    if (newNote.trim()) {
      formData.append("notes", newNote.trim());
    } else if (!newImage) {
      // Si no hay nota ni imagen (debería haber sido prevenido antes, pero doble chequeo)
      setError("Se requiere una nota o una imagen.");
      setIsSubmitting(false);
      return;
    }

    if (newImage) {
      formData.append("image", newImage, newImage.name);
    }

    try {
      const response = await fetch("/api/diary", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar la entrada.");
      }

      const newEntry: DiaryEntry = await response.json();
      setEntries([newEntry, ...entries]);
      clearForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (entryId: number) => {
    if (!confirm("¿Seguro que quieres eliminar esta entrada del diario?")) {
      return;
    }
    setError(null);

    try {
      const response = await fetch(`/api/diary?entryId=${entryId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al eliminar la entrada.");
      }

      setEntries(entries.filter((entry) => entry.id !== entryId));
      alert("Entrada eliminada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar.");
      console.error("Delete error:", err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // --- Funciones de Cámara ---
  const handleCameraCapture = () => {
    setShowCamera(true);
    openCamera(facingMode); // Abre con el modo actual
  };

  const openCamera = async (mode: "user" | "environment") => {
    setError(null); // Limpiar errores al abrir
    try {
      // Detener stream anterior si existe
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }

      const stream = await getCameraStream(mode);
      setCameraStream(stream);
      setFacingMode(mode);

      // Asignar stream al video usando la ref
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current
          .play()
          .catch((err) => console.error("Error playing video:", err)); // Intenta reproducir
      }
    } catch (error) {
      console.error("Error al abrir cámara:", error);
      setError(
        error instanceof Error ? error.message : "Error al acceder a la cámara"
      );
      setShowCamera(false); // Cierra el modal si hay error
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !cameraStream) {
      setError("Error: La cámara no está activa");
      return;
    }

    setIsCompressing(true); // Usamos el mismo estado de compresión
    try {
      const capturedImage = await capturePhotoFromVideo(videoRef.current);
      await processImageFile(capturedImage); // Procesa la imagen capturada
      closeCamera(); // Cierra la cámara después de capturar
    } catch (error) {
      console.error("Error al capturar foto:", error);
      setError("Error al capturar la foto");
    } finally {
      setIsCompressing(false);
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const switchCamera = () => {
    const newMode = facingMode === "environment" ? "user" : "environment";
    openCamera(newMode);
  };
  // -------------------------

  return (
    <>
      {/* --- Modal de Cámara --- */}
      {showCamera && (
        <div className={styles.cameraModal}>
          <div className={styles.cameraContainer}>
            <div className={styles.cameraHeader}>
              <h2>📷 Tomar Foto</h2>
              <button onClick={closeCamera} className={styles.closeModalButton}>
                ✕
              </button>
            </div>
            <div className={styles.videoContainer}>
              <video
                ref={videoRef} // Usar ref aquí
                autoPlay
                playsInline
                className={styles.cameraVideo}
                // Quitar onLoadedMetadata si usamos ref.play()
              />
            </div>
            <div className={styles.cameraControls}>
              <button
                onClick={switchCamera}
                className={styles.switchCameraButton}
                disabled={isCompressing} // Deshabilita mientras procesa
              >
                🔄 Cambiar
              </button>
              <button
                onClick={capturePhoto}
                className={styles.captureButton}
                disabled={isCompressing} // Deshabilita mientras procesa
              >
                {isCompressing ? "Procesando..." : "📸 Capturar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ----------------------- */}

      {/* --- Formulario para Nueva Entrada --- */}
      <form onSubmit={handleSubmit} className={styles.entryForm}>
        <textarea
          placeholder="Escribe una nota sobre tu planta..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
          disabled={isSubmitting || isCompressing}
        />
        <div className={styles.formActions}>
          {/* Botón Subir Foto */}
          <label
            htmlFor={`image-upload-${plantId}`}
            className={styles.uploadLabel}
          >
            📁{" "}
            {isCompressing && !newImage
              ? "Procesando..."
              : newImage
              ? "Cambiar Foto"
              : "Subir Foto"}
          </label>
          <input
            id={`image-upload-${plantId}`}
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={{ display: "none" }}
            disabled={isSubmitting || isCompressing}
          />

          {/* Botón Tomar Foto */}
          <button
            type="button" // Importante: type="button" para no enviar el form
            onClick={handleCameraCapture}
            className={styles.cameraButtonForm} // Nueva clase CSS
            disabled={isSubmitting || isCompressing}
          >
            📷 Tomar Foto
          </button>

          {imagePreview && (
            <div className={styles.previewContainer}>
              <Image
                src={imagePreview}
                alt="Vista previa"
                width={50}
                height={50}
                className={styles.imagePreview}
              />
              <button
                type="button"
                onClick={() => {
                  setNewImage(null);
                  setImagePreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className={styles.removePreviewButton}
              >
                ×
              </button>
            </div>
          )}
          {isCompressing && <div className={styles.miniSpinner}></div>}
          <button
            type="submit"
            disabled={
              isSubmitting || isCompressing || (!newNote.trim() && !newImage)
            }
          >
            {isSubmitting ? "Guardando..." : "Guardar Entrada"}
          </button>
        </div>
        {error && <p className={styles.errorMessageForm}>{error}</p>}
      </form>

      {/* --- Lista de Entradas --- */}
      {loading && <p>Cargando diario...</p>}
      {!loading && entries.length === 0 && (
        <p className={styles.emptyMessage}>Aún no hay entradas en el diario.</p>
      )}
      {!loading && entries.length > 0 && (
        <div className={styles.entriesList}>
          {entries.map((entry) => (
            <div key={entry.id} className={styles.diaryEntry}>
              <div className={styles.entryHeader}>
                <span className={styles.entryDate}>
                  {formatDate(entry.entry_date)}
                </span>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className={styles.deleteEntryButton}
                  title="Eliminar entrada"
                >
                  🗑️
                </button>
              </div>
              {entry.image_url && (
                <div className={styles.entryImageContainer}>
                  <Image
                    src={entry.image_url}
                    alt="Foto del diario"
                    width={200}
                    height={150}
                    className={styles.entryImage}
                    unoptimized
                  />
                </div>
              )}
              {entry.notes && (
                <p className={styles.entryNotes}>{entry.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
