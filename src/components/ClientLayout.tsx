// src/components/ClientLayout.tsx
"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import styles from "@/app/Layout.module.css";
import type { User } from "@supabase/supabase-js";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const supabase = createClient();

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
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const showSidebar = !isAuthPage && user;

  if (loading) {
    // Muestra un loader de página completa para evitar parpadeos
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <h2>Cargando...</h2>
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      {showSidebar && <Sidebar />}
      <main
        className={showSidebar ? styles.contentArea : styles.contentAreaFull}
      >
        {children}
      </main>
    </div>
  );
}
