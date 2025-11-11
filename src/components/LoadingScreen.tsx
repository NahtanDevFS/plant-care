// src/components/LoadingScreen.tsx
"use client";

import styles from "@/app/HomePage.module.css";

type LoadingScreenProps = {
  message: string;
  plantName?: string;
};

export default function LoadingScreen({
  message,
  plantName,
}: LoadingScreenProps) {
  return (
    <div className={styles.loadingOverlay}>
      <div className={styles.loadingContent}>
        <div className={styles.loadingSpinnerAnimation}></div>
        <h2>{message}</h2>
        {plantName && <p>{plantName}</p>}
        <p className={styles.loadingSubtext}>
          Generando guía de cuidados personalizada...
        </p>
      </div>
    </div>
  );
}
