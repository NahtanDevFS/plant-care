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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    // Forzamos un refresh para que el middleware se ejecute con la nueva sesión
    router.refresh();
  };

  return (
    <div className={styles.authContainer}>
      <form onSubmit={handleSignIn} className={styles.authForm}>
        <h2>Iniciar Sesión</h2>
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
          placeholder="••••••••"
          required
          disabled={isLoading}
        />

        <div className={styles.linkContainer}>
          <Link href="/forgot-password" className={styles.authLink}>
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

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
