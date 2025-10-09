// src/app/reset-password/page.tsx
"use client";

import { useState } from "react";
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setError(null);
    setMessage(null);
    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      // El error "Auth session missing" aparecerá aquí si el middleware falla
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
