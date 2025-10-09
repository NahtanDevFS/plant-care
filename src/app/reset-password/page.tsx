// src/app/reset-password/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import styles from "@/app/HomePage.module.css";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Escucha el evento de recuperación de contraseña para permitir el cambio
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        // No es necesario hacer nada aquí, solo confirma que el usuario llegó desde el enlace correcto
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(`Error: ${error.message}`);
    } else {
      setMessage(
        "¡Tu contraseña ha sido actualizada con éxito! Serás redirigido para iniciar sesión."
      );
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    }
    setIsLoading(false);
  };

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
        />
        <button className={styles.button} disabled={isLoading || !!message}>
          {isLoading ? "Actualizando..." : "Actualizar Contraseña"}
        </button>
        {error && <p className={styles.errorMessage}>{error}</p>}
        {message && <p className={styles.successMessage}>{message}</p>}
      </form>
    </div>
  );
}
