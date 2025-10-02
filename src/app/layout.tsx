"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import styles from "./HomePage.module.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <div className={styles.appContainer}>
          {/* Muestra el sidebar con contenido diferente si el usuario está logueado o no */}
          {!loading && (
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
                    <button
                      onClick={handleSignOut}
                      className={styles.logoutButton}
                    >
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
          )}

          <main className={styles.contentArea}>{children}</main>
        </div>
      </body>
    </html>
  );
}
