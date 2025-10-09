// src/app/register/page.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import styles from "@/app/HomePage.module.css"; // Reutilizamos estilos

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // --- URL ACTUALIZADA ---
        emailRedirectTo: `https://plant-care-mu.vercel.app/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage(
        "¡Registro exitoso! Revisa tu correo para confirmar tu cuenta."
      );
    }
  };

  return (
    <div className={styles.authContainer}>
      <form onSubmit={handleSignUp} className={styles.authForm}>
        <h2>Crear Cuenta</h2>
        <label htmlFor="email">Email</label>
        <input
          name="email"
          type="email"
          onChange={(e) => setEmail(e.target.value)}
          value={email}
          placeholder="tu@email.com"
          required
        />
        <label htmlFor="password">Contraseña</label>
        <input
          type="password"
          name="password"
          onChange={(e) => setPassword(e.target.value)}
          value={password}
          placeholder="••••••••"
          required
        />
        <button className={styles.button}>Registrarse</button>
        <p>
          ¿Ya tienes cuenta? <Link href="/login">Inicia Sesión</Link>
        </p>
        {error && <p className={styles.errorMessage}>{error}</p>}
        {message && <p className={styles.successMessage}>{message}</p>}
      </form>
    </div>
  );
}
