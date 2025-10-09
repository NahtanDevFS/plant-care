// src/app/forgot-password/page.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/HomePage.module.css";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `https://plant-care-mu.vercel.app/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage(
        "Se ha enviado un enlace para restablecer tu contraseña a tu correo electrónico."
      );
    }
    setIsLoading(false);
  };

  return (
    <div className={styles.authContainer}>
      <form onSubmit={handlePasswordReset} className={styles.authForm}>
        <h2>Recuperar Contraseña</h2>
        <p>
          Ingresa tu correo electrónico y te enviaremos un enlace para
          restablecer tu contraseña.
        </p>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          onChange={(e) => setEmail(e.target.value)}
          value={email}
          placeholder="tu@email.com"
          required
          disabled={isLoading}
        />
        <button className={styles.button} disabled={isLoading}>
          {isLoading ? "Enviando..." : "Enviar enlace"}
        </button>
        <p>
          ¿Recordaste tu contraseña? <Link href="/login">Iniciar Sesión</Link>
        </p>
        {error && <p className={styles.errorMessage}>{error}</p>}
        {message && <p className={styles.successMessage}>{message}</p>}
      </form>
    </div>
  );
}
