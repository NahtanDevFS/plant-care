// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import styles from "@/app/HomePage.module.css";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      console.log("Iniciando sesión con:", email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log("Respuesta de Supabase:", { data, error });

      if (error) {
        console.error("Error de autenticación:", error.message);
        setError(error.message);
        setIsLoading(false);
        return;
      }

      if (data?.session) {
        console.log("Sesión iniciada exitosamente");
        // Usar un pequeño delay para asegurar que la cookie se guarde
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 500);
      } else {
        setError("No se estableció la sesión correctamente");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Error inesperado:", err);
      setError("Error inesperado. Intenta de nuevo.");
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <form onSubmit={handleSignIn} className={styles.authForm}>
        <h2>Iniciar Sesión</h2>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          onChange={(e) => setEmail(e.target.value)}
          value={email}
          placeholder="you@example.com"
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
          placeholder="••••••••"
          required
          disabled={isLoading}
        />
        <button className={styles.button} disabled={isLoading}>
          {isLoading ? "Cargando..." : "Iniciar Sesión"}
        </button>
        <p>
          ¿No tienes cuenta? <Link href="/register">Regístrate</Link>
        </p>
        {error && <p className={styles.errorMessage}>{error}</p>}
      </form>
    </div>
  );
}
