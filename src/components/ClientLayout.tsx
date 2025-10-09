// src/components/ClientLayout.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation"; // 1. Importar usePathname
import { createClient } from "@/lib/supabase/client";
import Sidebar from "./Sidebar";
import styles from "@/app/Layout.module.css";
import type { User } from "@supabase/supabase-js";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname(); // 2. Obtener la ruta actual
  const supabase = createClient();

  // 3. Definir las rutas donde NO queremos el sidebar
  const authRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
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

  // 4. Comprobar si la ruta actual es una de autenticación
  const isAuthRoute = authRoutes.includes(pathname);

  // Si es una ruta de autenticación, renderiza solo el contenido de la página
  if (isAuthRoute) {
    return <>{children}</>;
  }

  // Si no hay usuario (y no es una ruta de auth), renderiza solo el contenido
  // El middleware ya se encarga de redirigir si es una ruta protegida
  if (!user) {
    return <>{children}</>;
  }

  // En cualquier otro caso (ruta protegida con usuario), muestra el layout completo
  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.mainContent}>{children}</main>
    </div>
  );
}
