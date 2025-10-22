// src/components/PlantDiary.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/imageCompression"; // Importa la función
import styles from "./PlantDiary.module.css"; // Asegúrate que este archivo CSS existe

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
  const [isCompressing, setIsCompressing] = useState(false); // Estado para compresión
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchEntries();
  }, [plantId]);

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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsCompressing(true); // Inicia indicador de compresión
      try {
        // Comprimir la imagen antes de mostrar la vista previa
        const compressed = await compressImage(file, 800, 800, 0.8); // Ajusta tamaño/calidad
        setNewImage(compressed);
        setImagePreview(URL.createObjectURL(compressed));
      } catch (compressError) {
        console.error("Error compressing image:", compressError);
        setError("Error al procesar la imagen. Intenta de nuevo.");
        setNewImage(null); // Resetea si falla
        setImagePreview(null);
      } finally {
        setIsCompressing(false); // Finaliza indicador de compresión
      }
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
      fileInputRef.current.value = ""; // Resetea el input file
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
    formData.append("notes", newNote.trim());
    if (newImage) {
      formData.append("image", newImage, newImage.name); // Usa la imagen comprimida
    }
    // Opcional: añadir fecha personalizada si la necesitas
    // formData.append("entryDate", new Date().toISOString());

    try {
      const response = await fetch("/api/diary", {
        method: "POST",
        body: formData, // No necesita headers 'Content-Type' con FormData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar la entrada.");
      }

      const newEntry: DiaryEntry = await response.json();
      setEntries([newEntry, ...entries]); // Añadir al principio
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

  return (
    // Ya no usamos <div className={styles.diarySection}> como contenedor principal
    <>
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
            {isCompressing
              ? "Procesando..."
              : newImage
              ? "Cambiar Foto"
              : "Añadir Foto"}
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
                    width={200} // Ajusta según necesites
                    height={150} // Ajusta según necesites
                    className={styles.entryImage}
                    unoptimized // Si usas Supabase Storage gratuito
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
