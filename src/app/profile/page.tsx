// src/app/profile/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/imageCompression";
import styles from "./ProfilePage.module.css"; // Crearemos este CSS
import type { User } from "@supabase/supabase-js"; // Importar User type
// --- 1. IMPORTAR ÍCONO ---
import { FiUser } from "react-icons/fi";

type Profile = {
  username: string | null;
  avatar_url: string | null;
};

export default function ProfilePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = useState<User | null>(null); // Estado para el usuario de auth
  const [usernameInput, setUsernameInput] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      // Primero obtener el usuario de auth
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !authUser) {
        setError("No se pudo obtener la información del usuario.");
        console.error("Auth error:", authError);
        setLoading(false);
        return;
      }
      setUser(authUser); // Guardar info de auth (ej. email)

      try {
        const response = await fetch("/api/profile"); // Llama al GET
        if (!response.ok) {
          throw new Error("Error al cargar el perfil.");
        }
        const data: Profile = await response.json();
        setProfile(data);
        setUsernameInput(data.username || ""); // Inicializa el input
        setAvatarPreview(data.avatar_url); // Muestra avatar actual
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido.");
        console.error("Fetch profile error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [supabase]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsCompressing(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const compressed = await compressImage(file, 400, 400, 0.8); // Comprime a 400x400 max
        setAvatarFile(compressed);
        setAvatarPreview(URL.createObjectURL(compressed)); // Muestra vista previa del nuevo
      } catch (compressError) {
        console.error("Error compressing avatar:", compressError);
        setError("Error al procesar la imagen.");
        setAvatarFile(null);
        // Mantiene la preview anterior si falla la compresión
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData();
    // Añadir username solo si ha cambiado respecto al perfil actual
    if (usernameInput.trim() !== (profile?.username || "")) {
      // Validar longitud mínima aquí también por si acaso
      if (usernameInput.trim().length > 0 && usernameInput.trim().length < 3) {
        setError("El nombre de usuario debe tener al menos 3 caracteres.");
        setIsSaving(false);
        return;
      }
      if (
        usernameInput.trim().length > 0 &&
        !/^[a-zA-Z0-9_]+$/.test(usernameInput.trim())
      ) {
        setError("Nombre de usuario inválido (solo letras, números, _).");
        setIsSaving(false);
        return;
      }
      formData.append("username", usernameInput.trim());
    }
    if (avatarFile) {
      formData.append("avatar", avatarFile, avatarFile.name);
    }

    // Solo llama a la API si hay algo que actualizar
    if (!formData.has("username") && !formData.has("avatar")) {
      setSuccessMessage("No hay cambios para guardar.");
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar el perfil.");
      }

      const updatedProfile: Profile = await response.json();
      setProfile(updatedProfile); // Actualiza el estado local con la respuesta
      setUsernameInput(updatedProfile.username || ""); // Sincroniza input
      setAvatarPreview(updatedProfile.avatar_url); // Actualiza preview
      setAvatarFile(null); // Limpia el archivo seleccionado
      if (fileInputRef.current) fileInputRef.current.value = ""; // Limpia input file visualmente
      setSuccessMessage("Perfil actualizado con éxito!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error desconocido al guardar."
      );
      console.error("Save profile error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* --- 2. ÍCONO REEMPLAZADO --- */}
      <h1>
        <FiUser /> Mi Perfil
      </h1>

      {error && <p className={styles.errorMessage}>{error}</p>}
      {successMessage && (
        <p className={styles.successMessage}>{successMessage}</p>
      )}

      <form onSubmit={handleSaveProfile} className={styles.profileForm}>
        {/* Sección Avatar */}
        <div className={styles.avatarSection}>
          <div className={styles.avatarPreview}>
            <Image
              src={avatarPreview || "/plant-care.png"} // Fallback a imagen por defecto
              alt="Avatar"
              width={120}
              height={120}
              className={styles.avatarImage}
              unoptimized // Si usas Supabase Storage gratuito
              key={avatarPreview} // Forza re-render si la URL cambia
            />
          </div>
          <label htmlFor="avatar-upload" className={styles.uploadButton}>
            {isCompressing ? "Procesando..." : "Cambiar Foto"}
          </label>
          <input
            id="avatar-upload"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: "none" }}
            disabled={isSaving || isCompressing}
          />
          {isCompressing && <div className={styles.miniSpinner}></div>}
        </div>

        {/* Sección Datos */}
        <div className={styles.fieldGroup}>
          <label htmlFor="email">Correo Electrónico</label>
          <input
            id="email"
            type="email"
            value={user?.email || ""} // Muestra el email de auth
            disabled // No editable
            className={styles.readOnlyInput}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="username">Nombre de Usuario</label>
          <input
            id="username"
            type="text"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder="Tu nombre de usuario"
            minLength={3}
            disabled={isSaving || isCompressing}
          />
          <p className={styles.inputHint}>
            Mínimo 3 caracteres. Letras, números y guion bajo (_).
          </p>
        </div>

        <button
          type="submit"
          className={styles.saveButton}
          disabled={
            isSaving ||
            isCompressing ||
            (!avatarFile && usernameInput.trim() === (profile?.username || ""))
          }
        >
          {isSaving ? "Guardando..." : "Guardar Cambios"}
        </button>
      </form>
    </div>
  );
}
