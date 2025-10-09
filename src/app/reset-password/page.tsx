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
  const [isSessionReady, setIsSessionReady] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // 1. Log para verificar si el token está en la URL al cargar la página
    console.log(
      "Página de reseteo cargada. Hash de la URL:",
      window.location.hash
    );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // 2. Log para ver CADA evento de autenticación que ocurre
      console.log(
        `Evento de Auth recibido: ${event}`,
        "La sesión existe:",
        !!session
      );

      // 3. Nos enfocamos específicamente en el evento PASSWORD_RECOVERY
      if (event === "PASSWORD_RECOVERY" && session) {
        console.log(
          "¡Evento PASSWORD_RECOVERY detectado! La sesión está lista."
        );
        setIsSessionReady(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSessionReady) {
      setError(
        "La sesión de recuperación no es válida o ha expirado. Por favor, solicita un nuevo enlace."
      );
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
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
    }, 2000);
  };

  return (
    <div className={styles.authContainer}>
      <form onSubmit={handleResetPassword} className={styles.authForm}>
        <h2>Crea una nueva contraseña</h2>

        {!isSessionReady ? (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinnerSmall}></div>
            <p className={styles.loadingMessage}>
              Validando enlace de recuperación...
            </p>
          </div>
        ) : (
          <>
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
          </>
        )}

        {error && <p className={styles.errorMessage}>{error}</p>}
        {message && <p className={styles.successMessage}>{message}</p>}
      </form>
    </div>
  );
}
