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
    // Variable para evitar múltiples ejecuciones si el componente se re-renderiza rápido
    let sessionChecked = false;

    const checkSession = async () => {
      // Obtenemos la sesión actual. Si el usuario viene de un enlace de recuperación,
      // esta sesión contendrá la identidad del usuario pero requerirá una actualización.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session && !sessionChecked) {
        setIsSessionReady(true);
      }
      sessionChecked = true;
    };

    checkSession();

    // También mantenemos el listener por si el evento llega después del primer render
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setIsSessionReady(true);
      }
    });

    // Limpiamos la suscripción al desmontar el componente
    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSessionReady) {
      setError(
        "La sesión de recuperación no es válida o ha expirado. Por favor, solicita un nuevo enlace desde la página de 'Olvidé mi contraseña'."
      );
      return;
    }
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
      // Forzamos el cierre de sesión para que el usuario deba loguearse con la nueva contraseña
      await supabase.auth.signOut();
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

        {!isSessionReady ? (
          <p className={styles.loadingMessage}>
            Validando enlace de recuperación...
          </p>
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
            />
            <button className={styles.button} disabled={isLoading || !!message}>
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
