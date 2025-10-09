// src/components/Sidebar.tsx
"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import styles from "./Sidebar.module.css";

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
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        if ("serviceWorker" in navigator && "PushManager" in window) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        }
      } catch (err) {
        console.error("Error al comprobar la suscripción:", err);
      } finally {
        setIsLoading(false);
      }
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
      setError("Las notificaciones no están configuradas correctamente.");
      console.error("VAPID public key no definida en .env.local");
      alert(
        "Las notificaciones no están disponibles. Configúralas en el servidor."
      );
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Asegurar que el Service Worker está registrado
      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.ready;
      } catch (err) {
        console.error("Service Worker no está listo:", err);
        setError("El Service Worker no está disponible.");
        return;
      }

      // Solicitar permiso de notificaciones
      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setError("Permiso de notificaciones denegado.");
          alert("Debes permitir las notificaciones para continuar.");
          return;
        }
      }

      // Suscribirse a push notifications
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // Guardar la suscripción en la base de datos
      const { error: dbError } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            subscription_data: subscription,
          },
          { onConflict: "user_id" }
        );

      if (dbError) {
        console.error("Error al guardar la suscripción:", dbError);
        throw dbError;
      }

      setIsSubscribed(true);
      alert("¡Notificaciones activadas correctamente!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error al suscribirse:", errorMessage);
      setError(errorMessage);
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (typeof window !== "undefined" && !("PushManager" in window)) {
    return null; // Push Manager no disponible
  }

  if (isLoading) return null;

  return (
    <>
      <button
        onClick={subscribeUser}
        disabled={isSubscribed || isLoading}
        className={styles.notificationButton}
      >
        {isSubscribed
          ? "🔔 Notificaciones Activadas"
          : "Activar Notificaciones"}
      </button>
      {error && (
        <p
          style={{ fontSize: "0.8rem", color: "#d32f2f", marginTop: "0.5rem" }}
        >
          {error}
        </p>
      )}
    </>
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
