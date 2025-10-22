// src/components/Sidebar.tsx
"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import styles from "./Sidebar.module.css";

export default function Sidebar() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

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
      // Solo redirige si no hay sesión Y no estamos ya en una página de autenticación
      if (
        !session &&
        ![
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
        ].includes(pathname)
      ) {
        router.push("/login");
      }
      router.refresh(); // Refresca para actualizar el estado del servidor
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, router, pathname]); // Añadir pathname a las dependencias

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // Forzar recarga completa para limpiar estado y asegurar redirección por middleware
    window.location.assign("/login");
  };

  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };

  // No renderizar sidebar en páginas de autenticación o mientras carga
  const authRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ];
  if (loading || authRoutes.includes(pathname)) {
    return null;
  }
  // Si no hay usuario después de cargar y no estamos en auth, tampoco renderizar (middleware debería redirigir)
  if (!user && !authRoutes.includes(pathname)) {
    return null;
  }

  const NavLinks = () => (
    <nav className={styles.sidebarNav}>
      <Link
        href="/"
        onClick={handleLinkClick}
        className={pathname === "/" ? styles.active : ""}
      >
        🔍 Identificar
      </Link>
      <Link
        href="/my-plants"
        onClick={handleLinkClick}
        className={pathname === "/my-plants" ? styles.active : ""}
      >
        🪴 Mis Plantas
      </Link>
      <Link
        href="/plant-diary" // Ahora apunta a la página de lista
        onClick={handleLinkClick}
        // Se marca activo si la ruta es /plant-diary o empieza con /plant-diary/
        className={
          pathname === "/plant-diary" || pathname.startsWith("/plant-diary/")
            ? styles.active
            : ""
        }
      >
        📝 Diario de Plantas
      </Link>
      <Link
        href="/plant-chat"
        onClick={handleLinkClick}
        className={pathname === "/plant-chat" ? styles.active : ""}
      >
        🤖 Chat IA
      </Link>
      <Link
        href="/calendar-tasks"
        onClick={handleLinkClick}
        className={pathname === "/calendar-tasks" ? styles.active : ""}
      >
        📅 Calendario
      </Link>

      {/* --- NUEVO ENLACE AL PERFIL --- */}
      <Link
        href="/profile"
        onClick={handleLinkClick}
        className={pathname === "/profile" ? styles.active : ""}
        // Estilo para intentar ponerlo más abajo, ajusta según sea necesario
        style={{
          marginTop: "auto",
          paddingTop: "1rem",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        👤 Mi Perfil
      </Link>
      {/* ----------------------------- */}
    </nav>
  );

  const UserSection = () => (
    <div className={styles.sidebarUser}>
      {/* Opcional: podrías mostrar el username si lo cargas aquí */}
      {/* <span className={styles.userEmail}>{user?.email}</span> */}
      <button onClick={handleSignOut} className={styles.logoutButton}>
        Cerrar Sesión
      </button>
    </div>
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
      <NavLinks /> {/* Usa el NavLinks actualizado */}
      <UserSection />
    </div>
  );

  return (
    <>
      {/* Sidebar para escritorio */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>🌿 PlantCare</h2>
        </div>
        <NavLinks />
        <UserSection />
      </aside>

      {/* Header para móvil */}
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

      {/* Menú Overlay para móvil */}
      {isMobileMenuOpen && (
        <div
          className={styles.mobileNavOverlay}
          onClick={() => setMobileMenuOpen(false)}
        >
          {/* Evita que el click dentro del menú cierre el overlay */}
          <div onClick={(e) => e.stopPropagation()}>
            <MobileNav />{" "}
            {/* Asegúrate que MobileNav usa el NavLinks actualizado */}
          </div>
        </div>
      )}
    </>
  );
}
