// src/components/Sidebar.tsx
"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import styles from "./Sidebar.module.css";

// --- NUEVO: Función para convertir la clave VAPID ---
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

// --- Componente para manejar la lógica de notificaciones ---
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

    // Asegúrate de que la clave VAPID exista
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error("La clave pública VAPID no está definida en .env.local");
      alert("Error de configuración: Faltan las claves de notificación.");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // --- CORRECCIÓN: Convertimos la clave al formato correcto ---
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey, // <-- Usamos la clave convertida
      });

      const { error } = await supabase
        .from("push_subscriptions")
        .insert({ user_id: user.id, subscription_data: subscription });

      if (error && error.code !== "23505") {
        throw error;
      }

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

// ... El resto del componente Sidebar no cambia y puede permanecer como está ...
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
      {user ? (
        <>
          <NavLinks />
          <UserSection />
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
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>🌿 PlantCare</h2>
        </div>
        {user ? (
          <>
            <NavLinks />
            <UserSection />
          </>
        ) : (
          <div className={styles.sidebarUser}>
            <Link href="/login" className={styles.loginButton}>
              Iniciar Sesión
            </Link>
          </div>
        )}
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
