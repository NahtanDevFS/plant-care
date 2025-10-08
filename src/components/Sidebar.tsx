// src/components/Sidebar.tsx
"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation"; // Importamos usePathname
import Link from "next/link";
import styles from "./Sidebar.module.css";

export default function Sidebar() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname(); // Obtenemos la ruta actual

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
      setMobileMenuOpen(false);
      router.refresh();
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMobileMenuOpen(false);
    router.push("/login");
  };

  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };

  // Componente reutilizable para la navegación, así evitamos duplicar código
  const NavLinks = () => (
    <nav className={styles.sidebarNav}>
      <Link
        href="/"
        onClick={handleLinkClick}
        className={pathname === "/" ? styles.active : ""}
      >
        Identificar
      </Link>
      <Link
        href="/my-plants"
        onClick={handleLinkClick}
        className={pathname === "/my-plants" ? styles.active : ""}
      >
        Mis Plantas
      </Link>
    </nav>
  );

  const MobileNav = () => (
    <div className={styles.mobileNavContent}>
      <button
        onClick={() => setMobileMenuOpen(false)}
        className={styles.mobileCloseButton}
      >
        &times;
      </button>
      <div className={styles.sidebarHeader}>
        <h2>🌿 PlantCare</h2>
      </div>
      {user ? (
        <>
          <NavLinks />
          <div className={styles.sidebarUser}>
            <span className={styles.userEmail}>{user.email}</span>
            <button onClick={handleSignOut} className={styles.logoutButton}>
              Cerrar Sesión
            </button>
          </div>
        </>
      ) : (
        <div className={styles.sidebarUser}>
          <Link
            href="/login"
            onClick={handleLinkClick}
            className={styles.loginButton}
          >
            Iniciar Sesión
          </Link>
        </div>
      )}
    </div>
  );

  if (loading) {
    return <aside className={styles.sidebar}></aside>;
  }

  return (
    <>
      {/* --- Menú para Escritorio --- */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>🌿 PlantCare</h2>
        </div>
        {user ? (
          <>
            <NavLinks />
            <div className={styles.sidebarUser}>
              <span className={styles.userEmail}>{user.email}</span>
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

      {/* --- Barra Superior para Móvil --- */}
      <header className={styles.mobileHeader}>
        <Link href="/" className={styles.mobileLogo}>
          <h2>🌿 PlantCare</h2>
        </Link>
        <button
          className={styles.hamburgerButton}
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Abrir menú"
        >
          ☰
        </button>
      </header>

      {/* --- Overlay del Menú Móvil --- */}
      {isMobileMenuOpen && (
        <div
          className={styles.mobileNavOverlay}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <MobileNav />
          </div>
        </div>
      )}
    </>
  );
}
