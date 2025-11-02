// src/components/ClientLayout.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "./Sidebar";
import styles from "@/app/Layout.module.css";
import type { User } from "@supabase/supabase-js";
import { Toaster } from "sonner";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const supabase = createClient();

  const authRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/demo",
  ];

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const checkInitialSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
      setLoading(false);
    };

    checkInitialSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const isAuthRoute = authRoutes.includes(pathname);

  if (isAuthRoute) {
    return (
      <div className={styles.contentAreaFull}>
        <Toaster richColors closeButton position="top-right" />
        {children}
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.contentAreaFull}>
        <Toaster richColors closeButton position="top-right" />
        {children}
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      <Toaster richColors closeButton position="top-right" />
      <Sidebar />
      <main className={styles.contentArea}>{children}</main>
    </div>
  );
}
