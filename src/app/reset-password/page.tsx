// src/app/reset-password/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import styles from "@/app/HomePage.module.css";
import type { User } from "@supabase/supabase-js";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUserSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setCheckingSession(false);
    };

    checkUserSession();
  }, [supabase]);

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

    setIsLoading(false);
    if (error) {
      setError(`Error al actualizar la contraseña: ${error.message}`);
      return;
    }

    setMessage(
      "¡Tu contraseña ha sido actualizada con éxito! Serás redirigido."
    );

    await supabase.auth.signOut();
    setTimeout(() => {
      router.push("/login");
      router.refresh();
    }, 3000);
  };

  if (checkingSession) {
    return (
      <div className={styles.authContainer}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinnerSmall}></div>
          <p className={styles.loadingMessage}>
            Validando sesión de recuperación...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.authContainer}>
        <div className={styles.authForm}>
          <h2>Enlace Inválido</h2>
          <p className={styles.errorMessage}>
            El enlace de recuperación es inválido o ha expirado. Por favor,
            solicita uno nuevo desde la página de login.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.authContainer}>
      <form onSubmit={handleResetPassword} className={styles.authForm}>
        <h2>Crea una nueva contraseña</h2>
        <p style={{ textAlign: "center", fontSize: "0.9rem", color: "#555" }}>
          Estás en una sesión segura para actualizar tu contraseña.
        </p>
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
          disabled={isLoading || !!message || !password || password !== confirm}
        >
          {isLoading ? "Actualizando..." : "Actualizar Contraseña"}
        </button>

        {error && <p className={styles.errorMessage}>{error}</p>}
        {message && <p className={styles.successMessage}>{message}</p>}
      </form>
    </div>
  );
}
