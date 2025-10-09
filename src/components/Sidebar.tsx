// src/components/Sidebar.tsx
"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import styles from "./Sidebar.module.css";

// ... (El componente NotificationManager no necesita cambios)
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
const NotificationManager = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  useEffect(() => {
    const checkSubscription = async () => {
      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        } catch (error) {
          console.error("Error al comprobar la suscripción:", error);
        }
      }
      setIsLoading(false);
    };
    checkSubscription();
  }, []);
  const subscribeUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      alert("Debes iniciar sesión para activar las notificaciones.");
      return;
    }
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error("La clave pública VAPID no está definida en .env.local");
      alert("Error de configuración: Faltan las claves de notificación.");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          { user_id: user.id, subscription_data: subscription },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      setIsSubscribed(true);
      alert("¡Notificaciones activadas!");
    } catch (error) {
      console.error("Error al suscribirse a las notificaciones:", error);
      alert("No se pudieron activar las notificaciones.");
    }
  };
  if (typeof window !== "undefined" && !("PushManager" in window)) {
    return null;
  }
  if (isLoading) return null;
  return (
    <button
      onClick={subscribeUser}
      disabled={isSubscribed}
      className={styles.notificationButton}
    >
      {isSubscribed ? "🔔 Notificaciones Activadas" : "Activar Notificaciones"}
    </button>
  );
};

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
        // Si el usuario cierra sesión, redirigir a /login
        router.push("/login");
      }
      router.refresh();
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, router]);

  // --- FUNCIÓN DE CERRAR SESIÓN ACTUALIZADA ---
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // Redirigimos manualmente después de cerrar sesión
    window.location.assign("/login");
  };
  // ---------------------------------------------

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
        Identificar
      </Link>
      <Link
        href="/my-plants"
        onClick={handleLinkClick}
        className={pathname === "/my-plants" ? styles.active : ""}
      >
        Mis Plantas
      </Link>
      <Link
        href="/calendar"
        onClick={handleLinkClick}
        className={pathname === "/calendar" ? styles.active : ""}
      >
        Calendario
      </Link>
    </nav>
  );

  const UserSection = () => (
    <div className={styles.sidebarUser}>
      <span className={styles.userEmail}>{user?.email}</span>
      <NotificationManager />
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
