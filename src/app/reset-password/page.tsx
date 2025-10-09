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
    let isMounted = true;

    const initializeRecovery = async () => {
      try {
        // Primero intentamos obtener la sesión actual
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session && isMounted) {
          console.log("Sesión de recuperación detectada");
          setIsSessionReady(true);
          return;
        }

        // Si no hay sesión, esperamos por el evento PASSWORD_RECOVERY
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!isMounted) return;

          console.log("Auth event:", event);

          if (event === "PASSWORD_RECOVERY" && session) {
            console.log("Evento PASSWORD_RECOVERY recibido");
            setIsSessionReady(true);
          } else if (event === "SIGNED_IN" && session) {
            // También capturamos SIGNED_IN por si el flujo viene así
            console.log("Usuario autenticado");
            setIsSessionReady(true);
          }
        });

        return () => {
          subscription?.unsubscribe();
        };
      } catch (err) {
        console.error("Error en inicialización:", err);
        if (isMounted) {
          setError("Error al validar el enlace de recuperación");
        }
      }
    };

    const cleanup = initializeRecovery();

    return () => {
      isMounted = false;
      cleanup?.then((fn) => fn?.());
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

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(`Error: ${error.message}`);
        setIsLoading(false);
        return;
      }

      setMessage(
        "¡Tu contraseña ha sido actualizada con éxito! Serás redirigido para iniciar sesión."
      );

      // Cerramos la sesión para que inicie sesión con la nueva contraseña
      await supabase.auth.signOut();

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      setError("Ocurrió un error inesperado");
      setIsLoading(false);
    }
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
