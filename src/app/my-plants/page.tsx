// src/app/my-plants/page.tsx

"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/MyPlants.module.css";
import Image from "next/image";
import ReminderSetup from "@/components/ReminderSetup";
import Link from "next/link";
import {
  FiDroplet,
  FiSun,
  FiWind,
  FiAlertTriangle,
  FiThermometer,
  FiTrash2,
  FiBookOpen,
  FiArchive,
  FiInfo,
  FiEdit2,
  FiUpload,
  FiCamera,
  FiRefreshCw,
  FiX,
  FiFileText,
  FiGrid,
  FiCheckSquare,
  FiSquare,
  FiChevronDown, // <-- AÑADIDO: Ícono para colapsar
  FiFilter, // <-- AÑADIDO: Ícono para colapsar
} from "react-icons/fi";
import { LiaPawSolid, LiaBugSolid, LiaDeafSolid } from "react-icons/lia";
import { GiPlantSeed } from "react-icons/gi";
import {
  compressImage,
  getCameraStream,
  capturePhotoFromVideo,
} from "@/lib/imageCompression";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";

// --- TIPOS DE DATOS ---
type PlantFromDB = {
  id: number;
  created_at: string;
  name: string;
  image_url: string;
  care_instructions: string;
  watering_frequency_days: number | null;
  fertilizing_frequency_days: number | null;
  care_level: "Fácil" | "Media" | "Difícil" | null;
  pet_friendly: boolean | null;
  is_toxic: boolean | null;
};
type Plant = PlantFromDB;

// --- CONFIGURACIÓN DE TARJETAS DE CUIDADO ---
const careConfig = {
  Riego: { icon: <FiDroplet />, color: "#2196F3", bgColor: "#E3F2FD" },
  Luz: { icon: <FiSun />, color: "#FF9800", bgColor: "#FFF3E0" },
  Sustrato: { icon: <GiPlantSeed />, color: "#795548", bgColor: "#EFEBE9" },
  Fertilizante: {
    icon: <FiThermometer />,
    color: "#9C27B0",
    bgColor: "#F3E5F5",
  },
  Humedad: { icon: <FiWind />, color: "#00BCD4", bgColor: "#E0F7FA" },
  "Plagas Comunes": {
    icon: <LiaBugSolid />,
    color: "#d32f2f",
    bgColor: "#ffcdd2",
  },
  "Enfermedades Comunes": {
    icon: <LiaDeafSolid />,
    color: "#7B1FA2",
    bgColor: "#E1BEE7",
  },
  General: { icon: <FiInfo />, color: "#607D8B", bgColor: "#ECEFF1" },
};
type CareKey = keyof typeof careConfig;

// --- PARSEADOR PARA PLAGAS Y ENFERMEDADES (Sin cambios) ---
const PestDiseaseParser = ({ text }: { text: string }) => {
  const items = text.split(/\d+\.\s+/).filter((s) => s.trim().length > 0);
  return (
    <div className={styles.careContentComplex}>
      {items.map((item, index) => {
        const cleanItem = item.replace(/\*\*/g, "");
        const titleMatch = cleanItem.match(/^([\s\S]*?)(?=\n|Síntomas:)/);
        const title = titleMatch
          ? titleMatch[1].trim()
          : `Problema ${index + 1}`;
        const symptomMatch = cleanItem.match(
          /Síntomas:\s*([\s\S]*?)(?=\nControl:|Control:|$)/
        );
        const symptoms = symptomMatch ? symptomMatch[1].trim() : "";
        const controlMatch = cleanItem.match(/Control:\s*([\s\S]*?)$/);
        const control = controlMatch ? controlMatch[1].trim() : "";
        return (
          <div key={index} className={styles.careContentDetail}>
            <strong>{title}</strong>
            {symptoms && (
              <div className={styles.pestSubsection}>
                <em>Síntomas:</em> {symptoms}
              </div>
            )}
            {control && (
              <div className={styles.pestSubsection}>
                <em>Control:</em> {control}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// --- CareInstructions (Sin cambios) ---
const CareInstructions = ({ text }: { text: string }) => {
  const sections = text.split("### ").filter((s) => s);
  return (
    <div className={styles.careGrid}>
      {sections.map((section) => {
        const [title, ...contentParts] = section.split(":");
        const content = contentParts.join(":").trim();
        const trimmedTitle = title.trim() as CareKey;
        const config = careConfig[trimmedTitle] || careConfig["General"];
        if (trimmedTitle === "General") return null;
        const isComplex = ["Plagas Comunes", "Enfermedades Comunes"].includes(
          trimmedTitle
        );
        return (
          <div
            key={title}
            className={styles.careCard}
            style={{ borderLeft: `4px solid ${config.color}` }}
          >
            <div
              className={styles.careHeader}
              style={{ backgroundColor: config.bgColor }}
            >
              <span className={styles.careIcon}>{config.icon}</span>
              <h4 style={{ color: config.color }}>{trimmedTitle}</h4>
            </div>
            <div className={styles.careContent}>
              {isComplex ? (
                <PestDiseaseParser text={content} />
              ) : (
                <p>{content}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// --- Helper para parsear cuidados para Exportación (Sin cambios) ---
const parseCareInstructionsForExport = (text: string) => {
  const sections = text.split("### ").filter((s) => s);
  const careData: { [key: string]: string } = {};
  sections.forEach((section) => {
    const [title, ...contentParts] = section.split(":");
    const content = contentParts
      .join(":")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\n/g, " ");
    careData[title.trim()] = content;
  });
  return careData;
};

// --- Helper para convertir imagen a base64 (Sin cambios) ---
const getImageAsBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status} al cargar imagen`);
        }
        return response.blob();
      })
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = (error) => {
          reject(error);
        };
        reader.readAsDataURL(blob);
      })
      .catch((error) => {
        console.error("Error al convertir imagen a base64:", error);
        reject(error);
      });
  });
};

export default function MyPlants() {
  const supabase = createClient();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlant, setExpandedPlant] = useState<number | null>(null);

  // --- Estados de Búsqueda y Filtro ---
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [petFilter, setPetFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  // --- Estados de Modal de Cámara ---
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment"
  );
  const [currentPlantToUpdate, setCurrentPlantToUpdate] = useState<
    number | null
  >(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Estados de Selección y Exportación ---
  const [selectedPlants, setSelectedPlants] = useState(new Set<number>());
  const [isExporting, setIsExporting] = useState(false);

  // --- AÑADIDO: Estado para colapsar controles ---
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  // ---------------------------------------------

  // --- useEffect para fetchPlants (Sin cambios) ---
  useEffect(() => {
    const fetchPlants = async () => {
      // ... (lógica existente)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("plants")
          .select("*")
          .eq("user_id", user.id);
        if (error) {
          setError("No se pudieron cargar tus plantas.");
        } else {
          const plantsWithReminders = await Promise.all(
            (data || []).map(async (plant) => {
              const { data: reminders } = await supabase
                .from("reminders")
                .select("*")
                .eq("plant_id", plant.id)
                .eq("user_id", user.id);
              let watering_frequency = null;
              let fertilizing_frequency = null;
              reminders?.forEach((reminder) => {
                if (reminder.care_type === "Riego")
                  watering_frequency = reminder.frequency_days;
                else if (reminder.care_type === "Fertilizante")
                  fertilizing_frequency = reminder.frequency_days;
              });
              return {
                ...plant,
                watering_frequency_days: watering_frequency,
                fertilizing_frequency_days: fertilizing_frequency,
              };
            })
          );
          setPlants(plantsWithReminders);
        }
      }
      setLoading(false);
    };
    fetchPlants();
  }, [supabase]);

  // --- useEffect para Limpieza de cámara (Sin cambios) ---
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // --- AÑADIDO: useEffect para colapsar en móvil ---
  useEffect(() => {
    // Colapsar controles por defecto en pantallas pequeñas
    if (window.innerWidth <= 768) {
      setIsControlsVisible(false);
    }
  }, []); // Se ejecuta solo una vez al montar

  // --- LÓGICA DE FILTRADO Y ORDENAMIENTO (Sin cambios) ---
  const processedPlants = useMemo(() => {
    let processed = [...plants];
    if (difficultyFilter !== "all") {
      processed = processed.filter((p) => p.care_level === difficultyFilter);
    }
    if (petFilter !== "all") {
      const isPetFriendly = petFilter === "yes";
      processed = processed.filter((p) => p.pet_friendly === isPetFriendly);
    }
    if (searchTerm) {
      processed = processed.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (sortBy === "oldest") {
      processed.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } else {
      processed.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    return processed;
  }, [plants, searchTerm, difficultyFilter, petFilter, sortBy]);

  // --- HANDLERS (Guardar recordatorio, borrar planta, etc. - Sin cambios) ---
  const togglePlant = (plantId: number) => {
    setExpandedPlant(expandedPlant === plantId ? null : plantId);
  };

  const handleSaveReminder = async (
    plantId: number,
    careType: "Riego" | "Fertilizante",
    frequency: number
  ) => {
    // ... (lógica existente sin cambios)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert("No estás autenticado");
        return;
      }
      const { data: reminder, error: reminderError } = await supabase
        .from("reminders")
        .select("*")
        .eq("plant_id", plantId)
        .eq("care_type", careType)
        .eq("user_id", user.id)
        .single();
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + frequency);
      if (reminderError || !reminder) {
        const { error: insertError } = await supabase.from("reminders").insert([
          {
            plant_id: plantId,
            user_id: user.id,
            care_type: careType,
            frequency_days: frequency,
            next_reminder_date: nextDate.toISOString().split("T")[0],
          },
        ]);
        if (insertError) throw insertError;
        alert("Recordatorio creado correctamente");
      } else {
        const { error: updateError } = await supabase
          .from("reminders")
          .update({
            frequency_days: frequency,
            next_reminder_date: nextDate.toISOString().split("T")[0],
          })
          .eq("id", reminder.id);
        if (updateError) throw updateError;
        alert("Recordatorio actualizado correctamente");
      }
    } catch (error) {
      console.error("Error:", error);
      alert(
        "Error: " + (error instanceof Error ? error.message : "desconocido")
      );
    }
  };

  const handleDeletePlant = async (plantId: number, imageUrl: string) => {
    // ... (lógica existente sin cambios)
    if (!confirm("¿Estás seguro de que deseas eliminar esta planta?")) return;
    try {
      if (imageUrl) {
        const urlParts = new URL(imageUrl);
        const pathInStorage = urlParts.pathname.split("/plant_images/")[1];
        if (pathInStorage) {
          await supabase.storage.from("plant_images").remove([pathInStorage]);
        }
      }
      const { error } = await supabase
        .from("plants")
        .delete()
        .eq("id", plantId);
      if (error) throw error;
      setPlants(plants.filter((p) => p.id !== plantId));
      setSelectedPlants((prev) => {
        const newSet = new Set(prev);
        newSet.delete(plantId);
        return newSet;
      });
      alert("Planta eliminada correctamente");
    } catch (error) {
      console.error("Error al eliminar planta:", error);
      alert(
        "Error: " + (error instanceof Error ? error.message : "desconocido")
      );
    }
  };

  const getDifficultyClass = (level: Plant["care_level"]) => {
    if (level === "Fácil") return styles.levelEasy;
    if (level === "Media") return styles.levelMedium;
    if (level === "Difícil") return styles.levelHard;
    return "";
  };

  // --- Funciones para actualizar imagen (Sin cambios) ---
  const handleOpenUpdateModal = (plantId: number) => {
    setCurrentPlantToUpdate(plantId);
    setShowCameraModal(true);
    openCamera(facingMode);
  };
  const openCamera = async (mode: "user" | "environment") => {
    setError(null);
    try {
      if (cameraStream)
        cameraStream.getTracks().forEach((track) => track.stop());
      const stream = await getCameraStream(mode);
      setCameraStream(stream);
      setFacingMode(mode);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current
          .play()
          .catch((err) => console.error("Error playing video:", err));
      }
    } catch (error) {
      console.error("Error al abrir cámara:", error);
      alert(
        error instanceof Error ? error.message : "Error al acceder a la cámara"
      );
      closeCamera();
    }
  };
  const closeCamera = () => {
    if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setShowCameraModal(false);
    setCurrentPlantToUpdate(null);
    setIsCompressing(false);
  };
  const switchCamera = () => {
    const newMode = facingMode === "environment" ? "user" : "environment";
    openCamera(newMode);
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processImage(e.target.files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const handleCapturePhoto = async () => {
    if (!videoRef.current || !cameraStream) return;
    try {
      const capturedImage = await capturePhotoFromVideo(videoRef.current);
      await processImage(capturedImage);
    } catch (error) {
      console.error("Error al capturar foto:", error);
      alert("Error al capturar la foto");
    }
  };
  const processImage = async (file: File) => {
    if (!currentPlantToUpdate) return;
    setIsCompressing(true);
    try {
      const compressed = await compressImage(file, 800, 800, 0.8);
      closeCamera();
      await handleUpdateImage(compressed);
    } catch (compressError) {
      console.error("Error processing image:", compressError);
      alert("Error al procesar la imagen. Intenta de nuevo.");
      setIsCompressing(false);
    }
  };
  const handleUpdateImage = async (imageFile: File) => {
    if (!currentPlantToUpdate) return;
    setIsUpdatingImage(true);
    setError(null);
    const formData = new FormData();
    formData.append("plantId", String(currentPlantToUpdate));
    formData.append("image", imageFile, imageFile.name);
    try {
      const response = await fetch("/api/my-plants/update-image", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al actualizar la imagen.");
      }
      const data = await response.json();
      const newImageUrl = data.new_image_url;
      setPlants((prevPlants) =>
        prevPlants.map((p) =>
          p.id === currentPlantToUpdate ? { ...p, image_url: newImageUrl } : p
        )
      );
      alert("¡Imagen de planta actualizada!");
    } catch (err) {
      console.error("Error updating image:", err);
      setError(err instanceof Error ? err.message : "Error desconocido.");
      alert(
        `Error al actualizar: ${err instanceof Error ? err.message : "Error"}`
      );
    } finally {
      setIsUpdatingImage(false);
      setCurrentPlantToUpdate(null);
      setIsCompressing(false);
    }
  };

  // --- Lógica de Selección y Exportación (Actualizada) ---

  const handlePlantSelect = (plantId: number) => {
    setSelectedPlants((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(plantId)) {
        newSet.delete(plantId);
      } else {
        newSet.add(plantId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allVisibleIds = processedPlants.map((p) => p.id);
    setSelectedPlants(new Set(allVisibleIds));
  };

  const handleDeselectAll = () => {
    setSelectedPlants(new Set());
  };

  const getSelectedPlantsData = () => {
    return processedPlants.filter((p) => selectedPlants.has(p.id));
  };

  // --- MODIFICADO: handleExportExcel ---
  const handleExportExcel = () => {
    setIsExporting(true);
    const plantsToExport = getSelectedPlantsData();
    if (plantsToExport.length === 0) {
      alert("Por favor, selecciona al menos una planta para exportar.");
      setIsExporting(false);
      return;
    }

    const dataForExcel = plantsToExport.map((plant) => {
      const careData = parseCareInstructionsForExport(plant.care_instructions);
      return {
        ID: plant.id,
        Nombre: plant.name,
        Nivel_Cuidado: plant.care_level,
        Apta_Mascotas: plant.pet_friendly ? "Sí" : "No",
        Es_Toxica: plant.is_toxic ? "Sí" : "No",
        Registrada: new Date(plant.created_at).toLocaleDateString("es-ES"),
        ...careData,
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataForExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MisPlantas");
    XLSX.writeFile(wb, "mis_plantas.xlsx");
    setIsExporting(false);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    const plantsToExport = getSelectedPlantsData();
    if (plantsToExport.length === 0) {
      alert("Por favor, selecciona al menos una planta para exportar.");
      setIsExporting(false);
      return;
    }

    const pdf = new jsPDF("p", "mm", "a4");
    const margin = 15;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;

    pdf.setFontSize(18);
    pdf.setTextColor(69, 160, 73);
    pdf.text("Reporte de Mis Plantas", pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 15;

    for (let i = 0; i < plantsToExport.length; i++) {
      const plant = plantsToExport[i];
      const plantHeaderHeight = 10;
      if (i > 0) yPos += 8;

      if (yPos + plantHeaderHeight > pageHeight - margin) {
        pdf.addPage();
        yPos = margin;
      }

      if (i > 0) {
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, yPos - 4, pageWidth - margin, yPos - 4);
      }

      pdf.setFontSize(16);
      pdf.setTextColor(69, 160, 73);
      pdf.text(plant.name, margin, yPos);
      yPos += 10;

      try {
        const imgData = await getImageAsBase64(plant.image_url);
        const imgProps = pdf.getImageProperties(imgData);
        const imgWidth = contentWidth * 0.4;
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

        if (yPos + imgHeight > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }

        pdf.addImage(imgData, "PNG", margin, yPos, imgWidth, imgHeight);

        const textX = margin + imgWidth + 8;
        const textWidth = contentWidth - imgWidth - 8;
        let textY = yPos;

        pdf.setFontSize(10);
        pdf.setTextColor(51, 51, 51);

        const careData = parseCareInstructionsForExport(
          plant.care_instructions
        );
        const generalInfo = [
          `Dificultad de cuidar: ${plant.care_level || "N/A"}`,
          `Mascotas: ${plant.pet_friendly ? "Sí" : "No"}`,
          `Tóxica: ${plant.is_toxic ? "Sí" : "No"}`,
        ];

        pdf.setFont("helvetica", "bold");
        pdf.text("General", textX, textY);
        textY += 5;

        pdf.setFont("helvetica", "normal");
        generalInfo.forEach((info) => {
          pdf.text(info, textX, textY);
          textY += 5;
        });

        yPos = Math.max(yPos + imgHeight + 8, textY + 8);

        const tableBody = Object.entries(careData)
          .filter(([key]) => key !== "General")
          .map(([key, value]) => [key, value]);

        if (yPos + 20 > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }

        autoTable(pdf, {
          startY: yPos,
          head: [["Aspecto", "Instrucción"]],
          body: tableBody,
          theme: "grid",
          headStyles: { fillColor: [69, 160, 73] },
          margin: { left: margin, right: margin },
        });

        // @ts-ignore
        yPos = pdf.lastAutoTable.finalY + 10;
      } catch (imgError) {
        console.error("Error al procesar imagen para PDF:", imgError);
        pdf.setFontSize(9);
        pdf.setTextColor(255, 0, 0);
        pdf.text("Error al cargar imagen.", margin, yPos);
        yPos += 6;
      }
    }

    pdf.save("mis_plantas.pdf");
    setIsExporting(false);
  };
  // ----------------------------------------------------

  // --- Renderizado ---
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <h2>Cargando tus plantas...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <p className={styles.errorMessage}>{error}</p>
      </div>
    );
  }

  return (
    <>
      {isUpdatingImage && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner}>
            <div className={styles.spinner}></div>
            <h2>Actualizando foto...</h2>
          </div>
        </div>
      )}

      {showCameraModal && (
        <div className={styles.cameraModal}>
          <div className={styles.cameraContainer}>
            <div className={styles.cameraHeader}>
              <h2>
                <FiCamera /> Actualizar Foto
              </h2>
              <button onClick={closeCamera} className={styles.closeModalButton}>
                <FiX />
              </button>
            </div>
            <div className={styles.videoContainer}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={styles.cameraVideo}
              />
            </div>
            <div className={styles.cameraControls}>
              <label
                htmlFor={`image-update-upload-${currentPlantToUpdate}`}
                className={styles.modalUploadButton}
              >
                <FiUpload /> Subir
              </label>
              <input
                id={`image-update-upload-${currentPlantToUpdate}`}
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
                disabled={isCompressing}
              />
              <button
                onClick={handleCapturePhoto}
                className={styles.modalCaptureButton}
                disabled={isCompressing}
              >
                {isCompressing ? (
                  "Procesando..."
                ) : (
                  <>
                    <FiCamera /> Capturar
                  </>
                )}
              </button>
              <button
                onClick={switchCamera}
                className={styles.modalSwitchButton}
                disabled={isCompressing}
              >
                <FiRefreshCw /> Cambiar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🌿 Mis Plantas</h1>
          <p>Busca, filtra y gestiona todas tus plantas y sus cuidados.</p>
        </div>

        {/* --- AÑADIDO: Botón para colapsar --- */}
        <button
          onClick={() => setIsControlsVisible(!isControlsVisible)}
          className={styles.controlsToggleButton}
        >
          <span>
            <FiFilter />
            {isControlsVisible
              ? " Ocultar Filtros y Opciones"
              : " Mostrar Filtros y Opciones"}
          </span>
          <FiChevronDown
            className={styles.controlsToggleIcon}
            style={{
              transform: isControlsVisible ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>

        {/* --- MODIFICADO: Contenedor de controles colapsable --- */}
        <div
          className={`${styles.controlsContainer} ${
            !isControlsVisible ? styles.controlsCollapsed : ""
          }`}
        >
          {/* --- AÑADIDO: Contenedor interno para la transición --- */}
          <div className={styles.controlsContent}>
            <input
              type="text"
              placeholder="Buscar por nombre..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className={styles.filterGrid}>
              <div className={styles.filterGroup}>
                <label>Ordenar por</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="newest">Más nuevas</option>
                  <option value="oldest">Más antiguas</option>
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label>Dificultad</label>
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                >
                  <option value="all">Todas</option>
                  <option value="Fácil">Fácil</option>
                  <option value="Media">Media</option>
                  <option value="Difícil">Difícil</option>
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label>Mascotas</label>
                <select
                  value={petFilter}
                  onChange={(e) => setPetFilter(e.target.value)}
                >
                  <option value="all">Todas</option>
                  <option value="yes">Aptas para mascotas</option>
                  <option value="no">No aptas para mascotas</option>
                </select>
              </div>
            </div>

            <div className={styles.exportContainer}>
              <button
                onClick={handleSelectAll}
                className={styles.selectButton}
                disabled={isExporting}
              >
                <FiCheckSquare /> Seleccionar{" "}
                {processedPlants.length > 0
                  ? `(${processedPlants.length})`
                  : ""}
              </button>
              <button
                onClick={handleDeselectAll}
                className={styles.selectButton}
                disabled={isExporting || selectedPlants.size === 0}
              >
                <FiSquare /> Deseleccionar
              </button>
              <button
                onClick={handleExportExcel}
                className={styles.exportButton}
                disabled={isExporting || selectedPlants.size === 0}
              >
                <FiGrid /> Exportar Excel ({selectedPlants.size})
              </button>
              <button
                onClick={handleExportPDF}
                className={styles.exportButton}
                disabled={isExporting || selectedPlants.size === 0}
              >
                <FiFileText /> Exportar PDF ({selectedPlants.size})
              </button>
            </div>
            {isExporting && (
              <div className={styles.loadingSpinnerSmall}>
                <div className={styles.spinner}></div>
                <span>Exportando...</span>
              </div>
            )}
          </div>
        </div>
        {/* ----------------------------------------------- */}

        {processedPlants.length > 0 ? (
          <div className={styles.myPlantsGrid}>
            {processedPlants.map((plant) => {
              const isSelected = selectedPlants.has(plant.id);
              return (
                <div
                  key={plant.id}
                  className={`${styles.plantCard} ${
                    expandedPlant === plant.id ? styles.plantCardExpanded : ""
                  } ${isSelected ? styles.selected : ""}`}
                >
                  <div className={styles.plantSelectCheckboxContainer}>
                    <input
                      type="checkbox"
                      id={`select-plant-${plant.id}`}
                      className={styles.plantSelectCheckbox}
                      checked={isSelected}
                      onChange={() => handlePlantSelect(plant.id)}
                      onClick={(e) => e.stopPropagation()}
                      title="Seleccionar para exportar"
                    />
                  </div>
                  <label
                    htmlFor={`select-plant-${plant.id}`}
                    className={styles.visuallyHidden}
                  >
                    Seleccionar {plant.name}
                  </label>

                  <div className={styles.plantImageWrapper}>
                    <Image
                      id={`plant-image-${plant.id}`}
                      src={plant.image_url}
                      alt={plant.name}
                      width={400}
                      height={300}
                      className={styles.plantCardImage}
                      unoptimized
                      key={plant.image_url}
                      crossOrigin="anonymous"
                    />
                    <button
                      className={styles.editImageButton}
                      title="Actualizar foto de la planta"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenUpdateModal(plant.id);
                      }}
                      disabled={isUpdatingImage || isCompressing}
                    >
                      <FiEdit2 />
                    </button>
                    <div className={styles.plantNameOverlay}>
                      <h3>{plant.name}</h3>
                    </div>
                  </div>

                  <div className={styles.plantCardContent}>
                    <div className={styles.generalInfo}>
                      {plant.care_level && (
                        <span
                          className={`${styles.infoTag} ${getDifficultyClass(
                            plant.care_level
                          )}`}
                        >
                          Dificultad: {plant.care_level}
                        </span>
                      )}
                      {plant.pet_friendly === true && (
                        <span
                          className={`${styles.infoTag} ${styles.petFriendly}`}
                        >
                          <LiaPawSolid /> Apta para Mascotas
                        </span>
                      )}
                      {plant.is_toxic === true && (
                        <span className={`${styles.infoTag} ${styles.isToxic}`}>
                          <FiAlertTriangle /> Venenosa
                        </span>
                      )}
                    </div>
                    <div className={styles.buttonGroup}>
                      <button
                        onClick={() => togglePlant(plant.id)}
                        className={styles.toggleButton}
                      >
                        {expandedPlant === plant.id
                          ? "Ocultar"
                          : "Ver Cuidados"}
                      </button>
                      <button
                        onClick={() =>
                          handleDeletePlant(plant.id, plant.image_url)
                        }
                        className={styles.deleteButton}
                        title="Eliminar planta"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                    {expandedPlant === plant.id && (
                      <div className={styles.careInstructionsWrapper}>
                        <div className={styles.remindersSection}>
                          <h3>Recordatorios</h3>
                          <ReminderSetup
                            plantId={plant.id}
                            careType="Riego"
                            initialFrequency={plant.watering_frequency_days}
                            onSave={(f) =>
                              handleSaveReminder(plant.id, "Riego", f)
                            }
                          />
                          <ReminderSetup
                            plantId={plant.id}
                            careType="Fertilizante"
                            initialFrequency={plant.fertilizing_frequency_days}
                            onSave={(f) =>
                              handleSaveReminder(plant.id, "Fertilizante", f)
                            }
                          />
                        </div>
                        <div className={styles.diaryLinkContainer}>
                          <Link
                            href={`/plant-diary/${plant.id}`}
                            className={styles.diaryLinkButton}
                          >
                            Ver Diario de la Planta <FiBookOpen />
                          </Link>
                        </div>
                        <h3 className={styles.careTitle}>Guía de Cuidados</h3>
                        <CareInstructions text={plant.care_instructions} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>
              <FiArchive />
            </span>
            <h3>No se encontraron plantas</h3>
            <p>
              {searchTerm
                ? "Prueba a cambiar el término de búsqueda o los filtros."
                : "Añade tu primera planta desde la pestaña 'Identificar'."}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
