import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import styles from "./HomePage.module.css";
import { createClient } from "@/lib/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plant Care",
  description: "Cuidado de las plantas",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="es">
      <body>
        <div className={styles.appContainer}>
          {/* --- LÓGICA CORREGIDA --- */}
          {/* Solo mostramos el sidebar si el objeto 'user' existe (si el usuario está logueado) */}
          {user && (
            <aside className={styles.sidebar}>
              <div className={styles.sidebarHeader}>
                <h2>🌿 Mi Jardín</h2>
              </div>
              <nav className={styles.sidebarNav}>
                <a href="/">Identificar</a>
                <a href="/my-plants">Mis Plantas</a>
              </nav>
              <div className={styles.sidebarUser}>
                <span>{user.email}</span>
                <form action="/auth/sign-out" method="post">
                  <button className={styles.logoutButton}>Cerrar Sesión</button>
                </form>
              </div>
            </aside>
          )}

          {/* El área de contenido principal siempre se muestra */}
          <main className={styles.contentArea}>{children}</main>
        </div>
      </body>
    </html>
  );
}
