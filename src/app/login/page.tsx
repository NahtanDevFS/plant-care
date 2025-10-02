"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import styles from "@/app/HomePage.module.css"; // Reutilizamos estilos
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className={styles.authContainer}>
      <form onSubmit={handleSignIn} className={styles.authForm}>
        <h2>Iniciar Sesión</h2>
        <label htmlFor="email">Email</label>
        <input
          name="email"
          onChange={(e) => setEmail(e.target.value)}
          value={email}
          placeholder="you@example.com"
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
        <button className={styles.button}>Iniciar Sesión</button>
        <p>
          ¿No tienes cuenta? <Link href="/register">Regístrate</Link>
        </p>
        {error && <p className={styles.errorMessage}>{error}</p>}
      </form>
    </div>
  );
}
