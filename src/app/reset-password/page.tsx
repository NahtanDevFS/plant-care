// src/app/reset-password/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import styles from "@/app/HomePage.module.css";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Parsea el fragmento de la URL para obtener los tokens
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const errorParam = params.get("error");

    if (errorParam) {
      setError(`Error: ${params.get("error_description") || errorParam}`);
      setStatus("error");
      return;
    }

    if (accessToken && refreshToken) {
      // Establece la sesión con los tokens
      supabase.auth
        .setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        .then(({ error }) => {
          if (error) {
            setError("Error al verificar el enlace: " + error.message);
            setStatus("error");
          } else {
            setStatus("ready");
          }
        });
    } else {
      // Esto se ejecutará la primera vez que se cargue la página
      // El middleware redirigirá y los tokens estarán en el hash
      // Si después de la redirección no hay tokens, el enlace es inválido
      const timer = setTimeout(() => {
        if (status === "loading") {
          setError("Enlace de recuperación inválido o expirado.");
          setStatus("error");
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [supabase.auth, status]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setError(null);
    setMessage(null);
    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(`Error: ${error.message}`);
      setIsLoading(false);
      return;
    }

    setMessage(
      "¡Tu contraseña ha sido actualizada con éxito! Serás redirigido para iniciar sesión."
    );
    await supabase.auth.signOut();
    setTimeout(() => {
      router.push("/login");
    }, 3000);
  };

  if (status === "loading") {
    return (
      <div className={styles.authContainer}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinnerSmall}></div>
          <p className={styles.loadingMessage}>Verificando enlace...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={styles.authContainer}>
        <div className={styles.authForm}>
          <h2>Enlace Inválido</h2>
          <p className={styles.errorMessage}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.authContainer}>
      <form onSubmit={handleResetPassword} className={styles.authForm}>
        <h2>Crea una nueva contraseña</h2>
        <label htmlFor="password">Nueva Contraseña</label>
        <input
          id="password"
          type="password"
          name="password"
          onChange={(e) => setPassword(e.target.value)}
          value={password}
          placeholder="••••••••"
          required
          disabled={isLoading || !!message}
          minLength={6}
        />
        <label htmlFor="confirm-password">Confirmar Contraseña</label>
        <input
          id="confirm-password"
          type="password"
          name="confirm-password"
          onChange={(e) => setConfirm(e.target.value)}
          value={confirm}
          placeholder="••••••••"
          required
          disabled={isLoading || !!message}
          minLength={6}
        />
        <button
          className={styles.button}
          disabled={isLoading || !!message || !password}
        >
          {isLoading ? "Actualizando..." : "Actualizar Contraseña"}
        </button>

        {error && <p className={styles.errorMessage}>{error}</p>}
        {message && <p className={styles.successMessage}>{message}</p>}
      </form>
    </div>
  );
}
