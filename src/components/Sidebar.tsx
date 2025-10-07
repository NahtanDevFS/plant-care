// src/components/Sidebar.tsx
"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./Sidebar.module.css"; // Crearemos este archivo de estilos

export default function Sidebar() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      router.refresh();
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return <aside className={styles.sidebar}></aside>; // Muestra un sidebar vacío mientras carga
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <h2>🌿 Mi Jardín</h2>
      </div>
      {user ? (
        <>
          <nav className={styles.sidebarNav}>
            <Link href="/">Identificar</Link>
            <Link href="/my-plants">Mis Plantas</Link>
          </nav>
          <div className={styles.sidebarUser}>
            <span>{user.email}</span>
            <button onClick={handleSignOut} className={styles.logoutButton}>
              Cerrar Sesión
            </button>
          </div>
        </>
      ) : (
        <div className={styles.sidebarUser}>
          <Link href="/login" className={styles.loginButton}>
            Iniciar Sesión
          </Link>
        </div>
      )}
    </aside>
  );
}
