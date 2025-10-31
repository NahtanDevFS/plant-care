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
  FiEdit2, // <-- Ícono para editar nombre
  FiUpload,
  FiCamera,
  FiRefreshCw,
  FiX,
  FiFileText,
  FiGrid,
  FiCheckSquare,
  FiSquare,
  FiChevronDown,
  FiFilter,
  FiSave, // <-- Ícono para guardar nombre
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
import * as XLSX from "xlsx";

// --- TIPOS DE DATOS (Actualizado) ---
type PlantFromDB = {
  id: number;
  created_at: string;
  name: string; // Nombre científico
  common_name: string | null; // <-- AÑADIDO
  image_url: string;
  care_instructions: string;
  watering_frequency_days: number | null;
  fertilizing_frequency_days: number | null;
  care_level: "Fácil" | "Media" | "Difícil" | null;
  pet_friendly: boolean | null;
  is_toxic: boolean | null;
};
type Plant = PlantFromDB;

// --- CONFIGURACIÓN DE TARJETAS DE CUIDADO (Sin cambios) ---
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

// --- COMPONENTES (PestDiseaseParser, CareInstructions - sin cambios) ---
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
const CareInstructions = ({ text }: { text: string }) => {
  const sections = text.split("### ").filter((s) => s);
  return (
    <div className={styles.careGrid}>
      {sections.map((section) => {
        const [title, ...contentParts] = section.split(":");
        const content = contentParts.join(":").trim();
        const trimmedTitle = title.trim();
        if (trimmedTitle === "General" || trimmedTitle === "Nombre Común") {
          return null;
        }
        const configKey = trimmedTitle as CareKey;
        const config = careConfig[configKey] || careConfig["General"];
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

// --- Helper para parsear cuidados para Exportación (Actualizado) ---
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

  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [petFilter, setPetFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

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

  const [selectedPlants, setSelectedPlants] = useState(new Set<number>());
  const [isExporting, setIsExporting] = useState(false);

  const [isControlsVisible, setIsControlsVisible] = useState(true);

  // --- NUEVOS ESTADOS PARA EDICIÓN DE NOMBRE ---
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  // ---------------------------------------------

  // --- useEffect para fetchPlants (Actualizado) ---
  useEffect(() => {
    const fetchPlants = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Solicitamos explícitamente la nueva columna 'common_name'
        const { data, error } = await supabase
          .from("plants")
          .select(
            "id, created_at, name, common_name, image_url, care_instructions, care_level, pet_friendly, is_toxic"
          )
          .eq("user_id", user.id);
        if (error) {
          setError("No se pudieron cargar tus plantas.");
        } else {
          const plantsWithReminders = await Promise.all(
            (data || []).map(async (plant) => {
              const { data: reminders } = await supabase
                .from("reminders")
                .select("care_type, frequency_days")
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

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    if (window.innerWidth <= 768) {
      setIsControlsVisible(false);
    }
  }, []);

  // --- LÓGICA DE FILTRADO Y ORDENAMIENTO (Actualizada) ---
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
      // Ahora busca en el nombre científico Y en el nombre común
      const lowerSearch = searchTerm.toLowerCase();
      processed = processed.filter(
        (p) =>
          p.name.toLowerCase().includes(lowerSearch) ||
          (p.common_name && p.common_name.toLowerCase().includes(lowerSearch))
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
    // ... (lógica existente sin cambios)
    if (level === "Fácil") return styles.levelEasy;
    if (level === "Media") return styles.levelMedium;
    if (level === "Difícil") return styles.levelHard;
    return "";
  };

  // --- Funciones para actualizar imagen (Sin cambios) ---
  const handleOpenUpdateModal = (plantId: number) => {
    // ... (lógica existente sin cambios)
    setCurrentPlantToUpdate(plantId);
    setShowCameraModal(true);
    openCamera(facingMode);
  };
  const openCamera = async (mode: "user" | "environment") => {
    // ... (lógica existente sin cambios)
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
    // ... (lógica existente sin cambios)
    if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setShowCameraModal(false);
    setCurrentPlantToUpdate(null);
    setIsCompressing(false);
  };
  const switchCamera = () => {
    // ... (lógica existente sin cambios)
    const newMode = facingMode === "environment" ? "user" : "environment";
    openCamera(newMode);
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // ... (lógica existente sin cambios)
    if (e.target.files && e.target.files[0]) {
      await processImage(e.target.files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const handleCapturePhoto = async () => {
    // ... (lógica existente sin cambios)
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
    // ... (lógica existente sin cambios)
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
    // ... (lógica existente sin cambios)
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

  // --- NUEVAS FUNCIONES PARA EDITAR NOMBRE ---
  const handleEditNameClick = (plant: Plant) => {
    setEditingNameId(plant.id);
    setEditingNameValue(plant.common_name || ""); // Usar el nombre común o vacío
    setError(null);
    setExpandedPlant(null); // Cierra el acordeón si está abierto
  };

  const handleCancelEditName = () => {
    setEditingNameId(null);
    setEditingNameValue("");
    setIsUpdatingName(false);
  };

  const handleSaveName = async (plantId: number) => {
    setIsUpdatingName(true);
    setError(null);

    const newCommonName = editingNameValue.trim();

    try {
      const response = await fetch("/api/my-plants/update-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantId: plantId,
          commonName: newCommonName, // Puede ser "" para borrar
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar el nombre.");
      }

      const updatedPlant = await response.json(); // API devuelve { id, name, common_name }

      // Actualizar el estado local
      setPlants((prevPlants) =>
        prevPlants.map((p) =>
          p.id === plantId ? { ...p, common_name: updatedPlant.common_name } : p
        )
      );
      handleCancelEditName(); // Salir del modo edición
    } catch (err) {
      console.error("Error saving name:", err);
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setIsUpdatingName(false);
    }
  };
  // ------------------------------------------

  // --- Lógica de Selección y Exportación (Actualizada) ---
  const handlePlantSelect = (plantId: number) => {
    // ... (lógica existente sin cambios)
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
    // ... (lógica existente sin cambios)
    const allVisibleIds = processedPlants.map((p) => p.id);
    setSelectedPlants(new Set(allVisibleIds));
  };

  const handleDeselectAll = () => {
    // ... (lógica existente sin cambios)
    setSelectedPlants(new Set());
  };

  const getSelectedPlantsData = () => {
    // ... (lógica existente sin cambios)
    return processedPlants.filter((p) => selectedPlants.has(p.id));
  };

  const handleExportExcel = () => {
    // --- MODIFICADO: Añadido common_name a la exportación ---
    setIsExporting(true);
    const plantsToExport = getSelectedPlantsData();
    if (plantsToExport.length === 0) {
      alert("Por favor, selecciona al menos una planta para exportar.");
      setIsExporting(false);
      return;
    }

    const dataForExcel = plantsToExport.map((plant) => {
      const careData = parseCareInstructionsForExport(plant.care_instructions);
      // Excluir 'Nombre Común' de careData si existe
      delete careData["Nombre Común"];

      return {
        ID: plant.id,
        "Nombre Común": plant.common_name || "N/A", // <-- AÑADIDO
        "Nombre Científico": plant.name,
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
    // --- MODIFICADO: Añadido common_name al PDF ---
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
      // Mostrar nombre común primero si existe, si no, el científico
      pdf.text(plant.common_name || plant.name, margin, yPos);
      yPos += 7;

      // Mostrar nombre científico si había uno común
      if (plant.common_name) {
        pdf.setFontSize(11);
        pdf.setTextColor(100, 100, 100);
        pdf.setFont("helvetica", "italic");
        pdf.text(plant.name, margin, yPos);
        pdf.setFont("helvetica", "normal"); // Resetear
        yPos += 3;
      }
      yPos += 3; // Espacio extra

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
          .filter(([key]) => key !== "General" && key !== "Nombre Común") // Excluir
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

        // @ts-expect-error jspdf-autotable no tipa correctamente 'finalY'
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
          <p>
            Busca, filtra y gestiona todas tus plantas guardadas y sus cuidados.
          </p>
        </div>

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

        <div
          className={`${styles.controlsContainer} ${
            !isControlsVisible ? styles.controlsCollapsed : ""
          }`}
        >
          <div className={styles.controlsContent}>
            <input
              type="text"
              placeholder="Buscar por nombre común o científico..."
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

        {/* --- MODIFICADO: Grid de Plantas con Lógica de Edición --- */}
        {processedPlants.length > 0 ? (
          <div className={styles.myPlantsGrid}>
            {processedPlants.map((plant) => {
              const isSelected = selectedPlants.has(plant.id);
              // Comprueba si esta planta específica está en modo edición de nombre
              const isEditingName = editingNameId === plant.id;
              return (
                <div
                  key={plant.id}
                  className={`${styles.plantCard} ${
                    expandedPlant === plant.id ? styles.plantCardExpanded : ""
                  } ${isSelected ? styles.selected : ""} ${
                    isEditingName ? styles.plantCardEditing : "" // Estilo para resaltar
                  }`}
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
                      disabled={
                        isUpdatingImage || isCompressing || isEditingName
                      }
                    >
                      <FiEdit2 />
                    </button>

                    {/* --- MODIFICADO: Overlay de Nombre con Lógica de Edición --- */}
                    <div className={styles.plantNameOverlay}>
                      {/* 1. Nombre Científico (No editable) */}
                      <h3
                        onClick={() => !isEditingName && togglePlant(plant.id)}
                      >
                        {plant.name}
                      </h3>

                      {isEditingName ? (
                        // --- 2. VISTA DE EDICIÓN DE NOMBRE COMÚN ---
                        <div
                          className={styles.nameEditWrapper}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editingNameValue}
                            onChange={(e) =>
                              setEditingNameValue(e.target.value)
                            }
                            className={styles.nameEditInput}
                            placeholder="Añadir apodo o nombre común"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveName(plant.id);
                              if (e.key === "Escape") handleCancelEditName();
                            }}
                            disabled={isUpdatingName}
                          />
                          <div className={styles.nameEditActions}>
                            <button
                              onClick={handleCancelEditName}
                              className={styles.nameEditButtonCancel}
                              disabled={isUpdatingName}
                              title="Cancelar"
                            >
                              <FiX />
                            </button>
                            <button
                              onClick={() => handleSaveName(plant.id)}
                              className={styles.nameEditButtonSave}
                              disabled={isUpdatingName}
                              title="Guardar"
                            >
                              {isUpdatingName ? (
                                <div className={styles.miniSpinner}></div>
                              ) : (
                                <FiSave />
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        // --- 3. VISTA NORMAL DE NOMBRE COMÚN ---
                        <p
                          className={styles.commonNameDisplay}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditNameClick(plant);
                          }}
                        >
                          {plant.common_name || "Añadir apodo"}
                          <FiEdit2
                            className={styles.editNameIcon}
                            title="Editar nombre"
                          />
                        </p>
                      )}
                    </div>
                  </div>

                  {/* No mostrar contenido si se está editando el nombre */}
                  {!isEditingName && (
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
                          <span
                            className={`${styles.infoTag} ${styles.isToxic}`}
                          >
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
                              initialFrequency={
                                plant.fertilizing_frequency_days
                              }
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
                  )}
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
