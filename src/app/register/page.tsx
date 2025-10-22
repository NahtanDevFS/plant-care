// src/app/register/page.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import styles from "@/app/HomePage.module.css"; // Reutilizamos estilos
import { useRouter } from "next/navigation"; // Importar useRouter

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(""); // <--- Nuevo estado para username
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false); // <--- Estado de carga
  const supabase = createClient();
  const router = useRouter(); // <--- Hook de router

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true); // <--- Iniciar carga

    if (username.length < 3) {
      setError("El nombre de usuario debe tener al menos 3 caracteres.");
      setIsLoading(false);
      return;
    }
    // Validación simple de username (puedes añadir más reglas)
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
        // --- URL ACTUALIZADA ---
        emailRedirectTo: `https://plant-care-mu.vercel.app/auth/callback`,
        // --- PASAR USERNAME AL TRIGGER ---
        data: {
          username: username.trim(), // Pasamos el username aquí
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      // Podrías verificar si el error es por username duplicado aquí si Supabase lo devuelve
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
      // El trigger se encargará de crear el perfil.
      // Solo mostramos mensaje de éxito y esperamos confirmación de correo.
      setMessage(
        "¡Registro exitoso! Revisa tu correo para confirmar tu cuenta."
      );
      // Podrías redirigir a login después de un tiempo o dejar al usuario aquí
      // setTimeout(() => router.push('/login'), 5000);
    } else {
      // Caso inesperado
      setError("Ocurrió un error inesperado durante el registro.");
    }

    setIsLoading(false); // <--- Finalizar carga
  };

  return (
    <div className={styles.authContainer}>
      <form onSubmit={handleSignUp} className={styles.authForm}>
        <h2>Crear Cuenta</h2>
        {/* --- Campo Username --- */}
        <label htmlFor="username">Nombre de Usuario</label>
        <input
          id="username"
          name="username"
          type="text"
          onChange={(e) => setUsername(e.target.value)}
          value={username}
          placeholder="tu_usuario"
          required
          minLength={1} // <--- Validación básica
          disabled={isLoading} // <--- Deshabilitar en carga
        />
        {/* -------------------- */}
        <label htmlFor="email">Email</label>
        <input
          id="email" // <--- Añadir id
          name="email"
          type="email"
          onChange={(e) => setEmail(e.target.value)}
          value={email}
          placeholder="tu@email.com"
          required
          disabled={isLoading} // <--- Deshabilitar en carga
        />
        <label htmlFor="password">Contraseña</label>
        <input
          id="password" // <--- Añadir id
          type="password"
          name="password"
          onChange={(e) => setPassword(e.target.value)}
          value={password}
          placeholder="•••••••• (mínimo 6 caracteres)"
          required
          minLength={6} // <--- Supabase requiere mínimo 6
          disabled={isLoading} // <--- Deshabilitar en carga
        />
        <button className={styles.button} disabled={isLoading}>
          {isLoading ? "Registrando..." : "Registrarse"}
        </button>
        <p>
          ¿Ya tienes cuenta? <Link href="/login">Inicia Sesión</Link>
        </p>
        {error && <p className={styles.errorMessage}>{error}</p>}
        {message && <p className={styles.successMessage}>{message}</p>}
      </form>
    </div>
  );
}
