// src/app/layout.tsx
"use client"; // <-- AÑADE ESTA LÍNEA

import { useEffect } from "react"; // <-- AÑADE ESTA LÍNEA
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";
import styles from "./Layout.module.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // --- AÑADE ESTE BLOQUE useEffect ---
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) =>
          console.log(
            "Service Worker registrado con éxito:",
            registration.scope
          )
        )
        .catch((error) =>
          console.error("Error al registrar el Service Worker:", error)
        );
    }
  }, []);
  // ------------------------------------

  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <div className={styles.appContainer}>
          <Sidebar />
          <main className={styles.contentArea}>{children}</main>
        </div>
      </body>
    </html>
  );
}
