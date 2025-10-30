// src/components/PlantDiary.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  compressImage,
  getCameraStream,
  capturePhotoFromVideo,
} from "@/lib/imageCompression";
import styles from "./PlantDiary.module.css";
// --- 1. IMPORTAR ÍCONOS ---
import { FiUpload, FiCamera, FiRefreshCw, FiX, FiTrash2 } from "react-icons/fi";

type DiaryEntry = {
  id: number;
  entry_date: string; // Fecha en formato ISO string (UTC o con timezone)
  notes: string | null;
  image_url: string | null;
  created_at: string;
};

type PlantDiaryProps = {
  plantId: number;
};

// --- Tipos para filtros y ordenación ---
type DateFilterType = "all" | "week" | "month" | "year" | "custom";
type SortOrderType = "desc" | "asc";
// ------------------------------------

export default function PlantDiary({ plantId }: PlantDiaryProps) {
  const supabase = createClient();
  const [allEntries, setAllEntries] = useState<DiaryEntry[]>([]); // Almacena todas las entradas
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- Estados para la cámara ---
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment"
  );
  // -----------------------------

  // --- Estados para Filtros y Ordenación ---
  const [dateFilter, setDateFilter] = useState<DateFilterType>("all");
  const [sortOrder, setSortOrder] = useState<SortOrderType>("desc"); // Descendente por defecto
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  // ---------------------------------------

  useEffect(() => {
    fetchEntries();
  }, [plantId]);

  // Limpieza del stream de cámara
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
      // Optimizacion: Podríamos pasar filtros a la API aquí si fueran muchos datos
      const response = await fetch(`/api/diary?plantId=${plantId}`);
      if (!response.ok) {
        throw new Error("Error al cargar las entradas del diario.");
      }
      const data: DiaryEntry[] = await response.json();
      setAllEntries(data); // Guarda todas las entradas
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error desconocido al cargar."
      );
    } finally {
      setLoading(false);
    }
  };

  // --- Lógica de Filtrado y Ordenación (useMemo) ---
  const filteredAndSortedEntries = useMemo(() => {
    let filtered = [...allEntries];
    const now = new Date();

    // Aplicar filtro de fecha
    if (dateFilter !== "all") {
      let startDate: Date | null = null;
      let endDate: Date | null = new Date(now); // Por defecto hasta hoy
      endDate.setHours(23, 59, 59, 999); // Final del día actual

      switch (dateFilter) {
        case "week":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0); // Inicio del día hace 7 días
          break;
        case "month":
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case "year":
          startDate = new Date(now);
          startDate.setFullYear(now.getFullYear() - 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case "custom":
          if (customStartDate) {
            startDate = new Date(customStartDate);
            startDate.setHours(0, 0, 0, 0); // Inicio del día de inicio
          }
          if (customEndDate) {
            endDate = new Date(customEndDate);
            endDate.setHours(23, 59, 59, 999); // Final del día de fin
          }
          // Si solo hay fecha de inicio, filtra desde esa fecha hasta hoy
          // Si solo hay fecha de fin, filtra desde el inicio hasta esa fecha
          // Si ambas, filtra en el rango
          break;
      }

      filtered = filtered.filter((entry) => {
        const entryDate = new Date(entry.entry_date);
        const isAfterStart = startDate ? entryDate >= startDate : true;
        const isBeforeEnd = endDate ? entryDate <= endDate : true;
        return isAfterStart && isBeforeEnd;
      });
    }

    // Aplicar ordenación
    filtered.sort((a, b) => {
      const dateA = new Date(a.entry_date).getTime();
      const dateB = new Date(b.entry_date).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [allEntries, dateFilter, sortOrder, customStartDate, customEndDate]);
  // -----------------------------------------------

  const processImageFile = async (file: File) => {
    setIsCompressing(true);
    setError(null);
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
    if (newNote.trim()) {
      formData.append("notes", newNote.trim());
    } else if (!newImage) {
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
      // Actualiza allEntries, useMemo se encargará del resto
      setAllEntries([newEntry, ...allEntries]);
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

      // Actualiza allEntries, useMemo se encargará del resto
      setAllEntries(allEntries.filter((entry) => entry.id !== entryId));
      alert("Entrada eliminada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar.");
      console.error("Delete error:", err);
    }
  };

  const formatDate = (dateString: string) => {
    // Intenta crear la fecha asumiendo que puede o no tener 'Z'
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // Si falla, intenta añadiendo 'Z' si no está
      if (!dateString.endsWith("Z")) {
        const dateUTC = new Date(dateString + "Z");
        if (!isNaN(dateUTC.getTime())) {
          return dateUTC.toLocaleDateString("es-ES", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC", // Especifica UTC si la fecha original lo era
          });
        }
      }
      return "Fecha inválida"; // Fallback
    }
    // Si la fecha original es válida, formatea en la zona horaria local
    return date.toLocaleDateString("es-ES", {
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
    openCamera(facingMode);
  };

  const openCamera = async (mode: "user" | "environment") => {
    setError(null);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      const stream = await getCameraStream(mode);
      setCameraStream(stream);
      setFacingMode(mode);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current
          .play()
          .catch((err) => console.error("Error playing video:", err));
      }
    } catch (error) {
      console.error("Error al abrir cámara:", error);
      setError(
        error instanceof Error ? error.message : "Error al acceder a la cámara"
      );
      setShowCamera(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !cameraStream) {
      setError("Error: La cámara no está activa");
      return;
    }
    setIsCompressing(true);
    try {
      const capturedImage = await capturePhotoFromVideo(videoRef.current);
      await processImageFile(capturedImage);
      closeCamera();
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
              {/* --- 2. ÍCONO REEMPLAZADO --- */}
              <h2>
                <FiCamera /> Tomar Foto
              </h2>
              <button onClick={closeCamera} className={styles.closeModalButton}>
                ✕
              </button>
            </div>
            <div className={styles.videoContainer}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={styles.cameraVideo}
              />
            </div>
            <div className={styles.cameraControls}>
              <button
                onClick={switchCamera}
                className={styles.switchCameraButton}
                disabled={isCompressing}
              >
                {/* --- 3. ÍCONO REEMPLAZADO --- */}
                <FiRefreshCw /> Cambiar
              </button>
              <button
                onClick={capturePhoto}
                className={styles.captureButton}
                disabled={isCompressing}
              >
                {/* --- 4. ÍCONO REEMPLAZADO --- */}
                {isCompressing ? (
                  "Procesando..."
                ) : (
                  <>
                    <FiCamera /> Capturar
                  </>
                )}
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
          <label
            htmlFor={`image-upload-${plantId}`}
            className={styles.uploadLabel}
          >
            {/* --- 5. ÍCONO REEMPLAZADO --- */}
            <FiUpload />
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
          <button
            type="button"
            onClick={handleCameraCapture}
            className={styles.cameraButtonForm}
            disabled={isSubmitting || isCompressing}
          >
            {/* --- 6. ÍCONO REEMPLAZADO --- */}
            <FiCamera /> Tomar Foto
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
                {/* --- 7. ÍCONO REEMPLAZADO --- */}
                <FiX />
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

      {/* --- Controles de Filtro y Ordenación --- */}
      <div className={styles.filterControls}>
        {/* Filtro de Fecha */}
        <div className={styles.filterGroup}>
          <label htmlFor={`date-filter-${plantId}`}>Mostrar:</label>
          <select
            id={`date-filter-${plantId}`}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilterType)}
          >
            <option value="all">Todas</option>
            <option value="week">Última semana</option>
            <option value="month">Último mes</option>
            <option value="year">Último año</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        {/* Inputs para Rango Personalizado (condicional) */}
        {dateFilter === "custom" && (
          <div className={`${styles.filterGroup} ${styles.customDateInputs}`}>
            <label htmlFor={`start-date-${plantId}`}>Desde:</label>
            <input
              type="date"
              id={`start-date-${plantId}`}
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              max={customEndDate || undefined} // Evita fecha inicio > fecha fin
            />
            <label htmlFor={`end-date-${plantId}`}>Hasta:</label>
            <input
              type="date"
              id={`end-date-${plantId}`}
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              min={customStartDate || undefined} // Evita fecha fin < fecha inicio
            />
          </div>
        )}

        {/* Ordenación */}
        <div className={styles.filterGroup}>
          <label htmlFor={`sort-order-${plantId}`}>Ordenar por:</label>
          <select
            id={`sort-order-${plantId}`}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrderType)}
          >
            <option value="desc">Más recientes primero</option>
            <option value="asc">Más antiguas primero</option>
          </select>
        </div>
      </div>
      {/* ------------------------------------------ */}

      {/* --- Lista de Entradas --- */}
      {loading && <p>Cargando diario...</p>}
      {!loading &&
        filteredAndSortedEntries.length === 0 && ( // Usa la variable filtrada
          <p className={styles.emptyMessage}>
            {dateFilter === "all"
              ? "Aún no hay entradas en el diario."
              : "No hay entradas que coincidan con los filtros seleccionados."}
          </p>
        )}
      {/* Muestra las entradas filtradas y ordenadas */}
      {!loading && filteredAndSortedEntries.length > 0 && (
        <div className={styles.entriesList}>
          {filteredAndSortedEntries.map((entry) => (
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
                  {/* --- 8. ÍCONO REEMPLAZADO --- */}
                  <FiTrash2 />
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
