// src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import styles from "./Sidebar.module.css";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js"; // 1. Importar el tipo User

// 2. Definir una interfaz para los props del componente
interface SidebarProps {
  user: User;
}

// 3. Aceptar 'user' como prop
export default function Sidebar({ user }: SidebarProps) {
  const supabase = createClient();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // Usamos refresh() para que Next.js vuelva a correr el middleware y nos redirija
    router.refresh();
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <img src="/plant-care.png" alt="PlantCare Logo" />
        <h2>PlantCare</h2>
      </div>
      <nav className={styles.nav}>
        <Link href="/" className={styles.navLink}>
          Inicio
        </Link>
        <Link href="/my-plants" className={styles.navLink}>
          Mis Plantas
        </Link>
        <Link href="/calendar" className={styles.navLink}>
          Calendario
        </Link>
      </nav>
      <div className={styles.userInfo}>
        <p>Bienvenido,</p>
        {/* 4. Usar la información del usuario */}
        <p className={styles.userEmail}>{user.email}</p>
        <button onClick={handleSignOut} className={styles.signOutButton}>
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
