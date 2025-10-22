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
      if (!session) {
        router.push("/login");
      }
      router.refresh();
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.assign("/login");
  };

  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };

  if (loading) {
    return null;
  }

  const isAuthPage = pathname === "/login" || pathname === "/register";
  if (!user || isAuthPage) {
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
        href="/calendar"
        onClick={handleLinkClick}
        className={pathname === "/calendar" ? styles.active : ""}
      >
        ✅ Tareas
      </Link>
      <Link
        href="/calendar-tasks"
        onClick={handleLinkClick}
        className={pathname === "/calendar-tasks" ? styles.active : ""}
      >
        📅 Calendario
      </Link>
    </nav>
  );

  const UserSection = () => (
    <div className={styles.sidebarUser}>
      <span className={styles.userEmail}>{user?.email}</span>
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
      <NavLinks />
      <UserSection />
    </div>
  );

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>🌿 PlantCare</h2>
        </div>
        <NavLinks />
        <UserSection />
      </aside>

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
