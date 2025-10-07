// src/app/layout.tsx
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar"; // Importa el nuevo componente
import "./globals.css";
import styles from "./Layout.module.css"; // Un nuevo archivo de estilos para el layout

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
