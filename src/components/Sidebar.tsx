// src/components/Sidebar.tsx
"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import styles from "./Sidebar.module.css";
import {
  FiSearch,
  FiGrid,
  FiBookOpen,
  FiPercent,
  FiMessageSquare,
  FiCalendar,
  FiUser,
} from "react-icons/fi";

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
      router.refresh();
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, router, pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.assign("/login");
  };

  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };

  const authRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ];
  if (loading || authRoutes.includes(pathname)) {
    return null;
  }
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
        <FiSearch /> Identificar
      </Link>
      <Link
        href="/my-plants"
        onClick={handleLinkClick}
        className={pathname === "/my-plants" ? styles.active : ""}
      >
        <FiGrid /> Mis Plantas
      </Link>
      <Link
        href="/plant-diary"
        onClick={handleLinkClick}
        className={
          pathname === "/plant-diary" || pathname.startsWith("/plant-diary/")
            ? styles.active
            : ""
        }
      >
        <FiBookOpen /> Diario de Plantas
      </Link>
      <Link
        href="/substrate-calculator"
        onClick={handleLinkClick}
        className={pathname === "/substrate-calculator" ? styles.active : ""}
      >
        <FiPercent /> Calculadora Sustrato
      </Link>
      <Link
        href="/plant-chat"
        onClick={handleLinkClick}
        className={pathname === "/plant-chat" ? styles.active : ""}
      >
        <FiMessageSquare /> Chat IA
      </Link>
      <Link
        href="/calendar-tasks"
        onClick={handleLinkClick}
        className={pathname === "/calendar-tasks" ? styles.active : ""}
      >
        <FiCalendar /> Calendario
      </Link>

      <Link
        href="/profile"
        onClick={handleLinkClick}
        className={pathname === "/profile" ? styles.active : ""}
        style={{
          marginTop: "auto",
          paddingTop: "1rem",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <FiUser /> Mi Perfil
      </Link>
    </nav>
  );

  const UserSection = () => (
    <div className={styles.sidebarUser}>
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
            <MobileNav />{" "}
          </div>
        </div>
      )}
    </>
  );
}
