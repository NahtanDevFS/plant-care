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
        // Verificar si hay un hash en la URL (token de recuperación)
        if (typeof window !== "undefined" && window.location.hash) {
          console.log("Token detectado en URL");
        }

        // Esperar a que Supabase procese el token del hash
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (!isMounted) return;

          console.log("Auth event:", event, "Session:", !!session);

          // Aceptar INITIAL_SESSION, PASSWORD_RECOVERY, o SIGNED_IN
          // Los tres indican que hay una sesión válida
          if (
            (event === "INITIAL_SESSION" ||
              event === "PASSWORD_RECOVERY" ||
              event === "SIGNED_IN") &&
            session
          ) {
            console.log("Sesión de recuperación lista");
            setIsSessionReady(true);
          }
        });

        // Primero intentamos obtener la sesión actual (por si ya la procesó)
        const { data } = await supabase.auth.getSession();
        if (data?.session && isMounted) {
          console.log("Sesión encontrada inmediatamente");
          setIsSessionReady(true);
        }

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
