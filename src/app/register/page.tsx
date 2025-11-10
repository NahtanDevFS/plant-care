// src/app/register/page.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import styles from "@/app/HomePage.module.css";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);
    if (username.length < 3) {
      setError("El nombre de usuario debe tener al menos 3 caracteres.");
      setIsLoading(false);
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError(
        "El nombre de usuario solo puede contener letras, números y guion bajo (_)."
      );
      setIsLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `https://plant-care-mu.vercel.app/auth/callback`,
        data: {
          username: username.trim(),
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      if (
        signUpError.message.includes(
          "duplicate key value violates unique constraint"
        )
      ) {
        setError("El nombre de usuario ya está en uso. Por favor, elige otro.");
      } else {
        setError(signUpError.message);
      }
    } else if (data.user) {
      setMessage(
        "¡Registro exitoso! Revisa tu correo para confirmar tu cuenta."
      );
    } else {
      setError("Ocurrió un error inesperado durante el registro.");
    }

    setIsLoading(false);
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authHeader}>
        <h1>🌿 PlantCare</h1>
        <p>Identifica y aprende a cuidar tus plantas y mucho más.</p>
      </div>

      <form onSubmit={handleSignUp} className={styles.authForm}>
        <h2>Crear Cuenta</h2>
        <label htmlFor="username">Nombre de Usuario</label>
        <input
          id="username"
          name="username"
          type="text"
          onChange={(e) => setUsername(e.target.value)}
          value={username}
          placeholder="tu_usuario"
          required
          minLength={1}
          disabled={isLoading}
        />
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
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          name="password"
          onChange={(e) => setPassword(e.target.value)}
          value={password}
          placeholder="•••••••• (mínimo 6 caracteres)"
          required
          minLength={6} // Supabase requiere mínimo 6
          disabled={isLoading}
        />
        <button className={styles.button} disabled={isLoading}>
          {isLoading ? "Registrando..." : "Registrarse"}
        </button>
        <p>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className={styles.authLink}>
            Inicia Sesión
          </Link>
        </p>
        {error && <p className={styles.errorMessage}>{error}</p>}
        {message && <p className={styles.successMessage}>{message}</p>}
      </form>
    </div>
  );
}
