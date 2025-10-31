// src/app/demo/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
// Usamos los mismos estilos de HomePage para que se vea idéntica
import styles from "@/app/HomePage.module.css";
// Importamos los íconos que necesita el diseño
import { FiUpload, FiCamera, FiLock, FiX } from "react-icons/fi";

export default function DemoPage() {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  // Esta función se activará con cualquier clic en el contenido
  const triggerModal = (e: React.MouseEvent) => {
    // Evita que el modal se dispare si ya está abierto y se hace clic en el overlay
    if (!showModal) {
      e.preventDefault();
      e.stopPropagation();
      setShowModal(true);
    }
  };

  const closeModal = (e: React.MouseEvent) => {
    e.stopPropagation(); // Evita que el clic en el botón de cerrar active el wrapper
    setShowModal(false);
  };

  const goToLogin = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push("/login");
  };

  const goToRegister = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push("/register");
  };

  return (
    <>
      {/* --- El Modal --- */}
      {showModal && (
        <div
          className={styles.modalOverlay}
          onClick={closeModal} // Cierra al hacer clic en el fondo
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()} // Evita que el clic en el modal lo cierre
          >
            <button
              className={styles.modalCloseButton}
              onClick={closeModal}
              aria-label="Cerrar modal"
            >
              <FiX />
            </button>
            <div className={styles.modalHeader}>
              <FiLock />
              <h3>¡Funcionalidad Bloqueada!</h3>
            </div>
            <div className={styles.modalBody}>
              <p>
                Esta es una vista previa de la aplicación. Para identificar,
                guardar y chatear sobre tus plantas, necesitas una cuenta.
              </p>
              <p>¡Es gratis y solo toma un minuto!</p>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.modalButtonSecondary}
                onClick={goToRegister}
              >
                Crear Cuenta
              </button>
              <button className={styles.modalButtonPrimary} onClick={goToLogin}>
                Iniciar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Contenido de la Página (Wrapper) --- */}
      {/* Este div captura todos los clics */}
      <div className={styles.demoWrapper} onClick={triggerModal}>
        {/*
          Este es el JSX estático de tu src/app/page.tsx.
          Todos los `onClick`, `onChange`, `disabled` y `href` han sido eliminados
          para que el wrapper principal capture la interacción.
        */}
        <main className={styles.container}>
          <div className={styles.header}>
            <h1>🌿 PlantCare</h1>
            <p>Identifica tus plantas y aprende a cuidarlas al instante.</p>
          </div>

          <div className={styles.uploadSection}>
            <div className={styles.imagePreviewContainer}>
              <Image
                src="https://media.admagazine.com/photos/618a611d4b3f9152d1b42033/3:2/w_2250,h_1500,c_limit/76290.jpg"
                alt="Vista previa de la planta"
                width={150}
                height={150}
                className={styles.imagePreview}
                unoptimized={true}
              />
            </div>

            <div className={styles.buttonGroup}>
              <label className={styles.uploadButton} tabIndex={0}>
                <FiUpload /> Subir Foto
                <input type="file" style={{ display: "none" }} disabled />
              </label>

              <button className={styles.cameraButton}>
                <FiCamera /> Tomar Foto
              </button>
            </div>

            <button className={styles.button}>Identificar Planta</button>
          </div>

          {/* Sección de resultados de ejemplo (estática) */}
          <div className={styles.resultsContainer}>
            <h2>Posibles Coincidencias</h2>
            <ul className={styles.resultsList}>
              <li className={styles.resultItem}>
                <Image
                  src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Starr_080731-9571_Monstera_deliciosa.jpg/1200px-Starr_080731-9571_Monstera_deliciosa.jpg"
                  alt="Monstera Deliciosa"
                  width={80}
                  height={80}
                  className={styles.suggestionImage}
                  unoptimized={true}
                />
                <div className={styles.resultItemInfo}>
                  <strong>Monstera deliciosa</strong>
                  <p className={styles.commonName}>Costilla de Adán</p>
                  <p>Similitud: 98.2%</p>
                </div>
                <button className={styles.selectButton}>Seleccionar</button>
              </li>
              <li className={styles.resultItem}>
                <Image
                  src="https://upload.wikimedia.org/wikipedia/commons/d/d6/Zamioculcas.jpg"
                  alt="Zamioculcas"
                  width={80}
                  height={80}
                  className={styles.suggestionImage}
                  unoptimized={true}
                />
                <div className={styles.resultItemInfo}>
                  <strong>Zamioculcas zamiifolia</strong>
                  <p className={styles.commonName}>Planta ZZ</p>
                  <p>Similitud: 85.1%</p>
                </div>
                <button className={styles.selectButton}>Seleccionar</button>
              </li>
            </ul>
          </div>
        </main>
      </div>
    </>
  );
}
