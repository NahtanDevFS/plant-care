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
  FiChevronDown,
  FiFilter,
  FiSave,
} from "react-icons/fi";
import { LiaPawSolid, LiaBugSolid, LiaDeafSolid } from "react-icons/lia";
import { GiPlantSeed } from "react-icons/gi";
import {
  compressImage,
  getCameraStream,
  capturePhotoFromVideo,
} from "@/lib/imageCompression";
import { toast } from "sonner";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import LoadingScreen from "@/components/LoadingScreen";

type PlantFromDB = {
  id: number;
  created_at: string;
  name: string; // Nombre científico
  common_name: string | null;
  image_url: string;
  care_instructions: string;
  watering_frequency_days: number | null;
  fertilizing_frequency_days: number | null;
  care_level: "Fácil" | "Media" | "Difícil" | null;
  pet_friendly: boolean | null;
  is_toxic: boolean | null;
};
type Plant = PlantFromDB;

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

const parseCareInstructionsForExport = (text: string) => {
  const sections = text.split("### ").filter((s) => s);
  const careData: { [key: string]: string } = {};

  sections.forEach((section) => {
    const [title, ...contentParts] = section.split(":");
    let content = contentParts.join(":").trim();

    content = content
      .replace(/\n+/g, " ")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();

    careData[title.trim()] = content;
  });

  return careData;
};

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
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratingPlantName, setRegeneratingPlantName] = useState("");

  useEffect(() => {
    const fetchPlants = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
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

  const togglePlant = (plantId: number) => {
    setExpandedPlant(expandedPlant === plantId ? null : plantId);
  };

  const handleSaveReminderStateUpdate = (
    plantId: number,
    careType: "Riego" | "Fertilizante",
    frequency: number
  ) => {
    setPlants((prevPlants) =>
      prevPlants.map((p) => {
        if (p.id === plantId) {
          if (careType === "Riego") {
            return { ...p, watering_frequency_days: frequency };
          } else if (careType === "Fertilizante") {
            return { ...p, fertilizing_frequency_days: frequency };
          }
        }
        return p;
      })
    );
  };

  const handleDeleteReminder = async (
    plantId: number,
    careType: "Riego" | "Fertilizante"
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("No estás autenticado");
    }

    const { error: deleteError } = await supabase
      .from("reminders")
      .delete()
      .eq("plant_id", plantId)
      .eq("care_type", careType)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error deleting reminder:", deleteError);
      throw new Error("Error al eliminar el recordatorio de la base de datos.");
    }

    setPlants((prevPlants) =>
      prevPlants.map((p) => {
        if (p.id === plantId) {
          if (careType === "Riego") {
            return { ...p, watering_frequency_days: null };
          } else if (careType === "Fertilizante") {
            return { ...p, fertilizing_frequency_days: null };
          }
        }
        return p;
      })
    );
  };

  const handleDeletePlant = async (plantId: number, imageUrl: string) => {
    const performDelete = async () => {
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
        toast.success("Planta eliminada correctamente");
      } catch (error) {
        console.error("Error al eliminar planta:", error);
        toast.error(
          "Error al eliminar: " +
            (error instanceof Error ? error.message : "desconocido")
        );
      }
    };

    toast.warning("¿Estás seguro de que deseas eliminar esta planta?", {
      description: "Esta acción no se puede deshacer.",
      action: {
        label: "Eliminar",
        onClick: () => performDelete(),
      },
      cancel: {
        label: "Cancelar",
        onClick: () => {},
      },
    });
  };

  const getDifficultyClass = (level: Plant["care_level"]) => {
    if (level === "Fácil") return styles.levelEasy;
    if (level === "Media") return styles.levelMedium;
    if (level === "Difícil") return styles.levelHard;
    return "";
  };

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
      toast.error(
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
      toast.error("Error al capturar la foto");
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
      toast.error("Error al procesar la imagen. Intenta de nuevo.");
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
      toast.success("¡Imagen de planta actualizada!");
    } catch (err) {
      console.error("Error updating image:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Error desconocido.";
      setError(errorMsg);
      toast.error(`Error al actualizar: ${errorMsg}`);
    } finally {
      setIsUpdatingImage(false);
      setCurrentPlantToUpdate(null);
      setIsCompressing(false);
    }
  };

  const handleEditNameClick = (plant: Plant) => {
    setEditingNameId(plant.id);
    setEditingNameValue(plant.common_name || "");
    setError(null);
    setExpandedPlant(null);
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
          commonName: newCommonName,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar el nombre.");
      }
      const updatedPlant = await response.json();
      setPlants((prevPlants) =>
        prevPlants.map((p) =>
          p.id === plantId ? { ...p, common_name: updatedPlant.common_name } : p
        )
      );
      handleCancelEditName();
      toast.success("Nombre común actualizado.");
    } catch (err) {
      console.error("Error saving name:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Error desconocido.";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleRegenerateGuide = (plant: Plant) => {
    setError(null);
    toast.warning(`¿Actualizar la guía de cuidados para "${plant.name}"?`, {
      description:
        "Esto generará una nueva guía basada en tu país actual. La guía anterior se sobrescribirá.",
      action: {
        label: "Actualizar",
        onClick: async () => {
          setIsRegenerating(true);
          setRegeneratingPlantName(plant.name);
          setExpandedPlant(null);
          try {
            const response = await fetch("/api/my-plants/regenerate-guide", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                plantId: plant.id,
                plantName: plant.name,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || "Error al regenerar la guía.");
            }

            const updatedPlant: Plant = await response.json();

            setPlants((prevPlants) =>
              prevPlants.map((p) =>
                p.id === updatedPlant.id ? { ...p, ...updatedPlant } : p
              )
            );

            toast.success("¡Guía de cuidados actualizada!");
          } catch (err) {
            console.error("Error regenerating guide:", err);
            const errorMsg =
              err instanceof Error ? err.message : "Error desconocido.";
            toast.error(`Error al actualizar: ${errorMsg}`);
          } finally {
            setIsRegenerating(false);
            setRegeneratingPlantName("");
          }
        },
      },
      cancel: {
        label: "Cancelar",
        onClick: () => {},
      },
    });
  };

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
  const handleExportExcel = () => {
    setIsExporting(true);
    const plantsToExport = getSelectedPlantsData();
    if (plantsToExport.length === 0) {
      toast.info("Por favor, selecciona al menos una planta para exportar.");
      setIsExporting(false);
      return;
    }
    const dataForExcel = plantsToExport.map((plant) => {
      const careData = parseCareInstructionsForExport(plant.care_instructions);
      delete careData["Nombre Común"];
      return {
        ID: plant.id,
        "Nombre Común": plant.common_name || "N/A",
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
    setIsExporting(true);
    const plantsToExport = getSelectedPlantsData();

    if (plantsToExport.length === 0) {
      toast.info("Por favor, selecciona al menos una planta para exportar.");
      setIsExporting(false);
      return;
    }

    try {
      const container = document.createElement("div");
      container.style.width = "794px";
      container.style.padding = "40px";
      container.style.fontFamily = "Arial, sans-serif";
      container.style.fontSize = "12px";
      container.style.backgroundColor = "white";
      container.style.boxSizing = "border-box";

      // Título del reporte
      const title = document.createElement("h1");
      title.textContent = "Reporte de Mis Plantas";
      title.style.color = "#45A049";
      title.style.textAlign = "center";
      title.style.marginBottom = "30px";
      title.style.fontSize = "28px";
      container.appendChild(title);

      // Array para guardar promesas de carga de imágenes
      const imagePromises: Promise<void>[] = [];

      for (const plant of plantsToExport) {
        const plantSection = document.createElement("div");
        plantSection.style.marginBottom = "40px";
        plantSection.style.borderTop = "2px solid #ccc";
        plantSection.style.paddingTop = "20px";

        const plantName = document.createElement("h2");
        plantName.textContent = plant.common_name || plant.name;
        plantName.style.color = "#45A049";
        plantName.style.marginBottom = "8px";
        plantName.style.fontSize = "22px";
        plantSection.appendChild(plantName);

        if (plant.common_name) {
          const scientificName = document.createElement("p");
          scientificName.textContent = plant.name;
          scientificName.style.fontStyle = "italic";
          scientificName.style.color = "#666";
          scientificName.style.marginBottom = "15px";
          scientificName.style.fontSize = "14px";
          plantSection.appendChild(scientificName);
        }

        const flexContainer = document.createElement("div");
        flexContainer.style.display = "flex";
        flexContainer.style.gap = "20px";
        flexContainer.style.marginBottom = "20px";

        const imgContainer = document.createElement("div");
        imgContainer.style.flex = "0 0 40%";
        const img = document.createElement("img");

        const imagePromise = new Promise<void>(async (resolve) => {
          try {
            const base64Image = await getImageAsBase64(plant.image_url);
            img.src = base64Image;
            img.onload = () => resolve();
            img.onerror = () => resolve();
          } catch (error) {
            console.error("Error loading image:", error);
            resolve();
          }
        });

        imagePromises.push(imagePromise);

        img.style.width = "100%";
        img.style.height = "auto";
        img.style.borderRadius = "8px";
        img.style.display = "block";
        imgContainer.appendChild(img);
        flexContainer.appendChild(imgContainer);

        const generalContainer = document.createElement("div");
        generalContainer.style.flex = "1";

        const generalTitle = document.createElement("h3");
        generalTitle.textContent = "General";
        generalTitle.style.fontSize = "16px";
        generalTitle.style.marginBottom = "10px";
        generalTitle.style.marginTop = "0";
        generalContainer.appendChild(generalTitle);

        const generalInfo = [
          `Dificultad de cuidar: ${plant.care_level || "N/A"}`,
          `Mascotas: ${plant.pet_friendly ? "Sí" : "No"}`,
          `Tóxica: ${plant.is_toxic ? "Sí" : "No"}`,
        ];

        generalInfo.forEach((info) => {
          const p = document.createElement("p");
          p.textContent = info;
          p.style.margin = "5px 0";
          p.style.fontSize = "12px";
          generalContainer.appendChild(p);
        });

        flexContainer.appendChild(generalContainer);
        plantSection.appendChild(flexContainer);

        const careData = parseCareInstructionsForExport(
          plant.care_instructions
        );
        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.style.marginTop = "20px";
        table.style.fontSize = "11px";

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        const th1 = document.createElement("th");
        th1.textContent = "Aspecto";
        th1.style.backgroundColor = "#45A049";
        th1.style.color = "white";
        th1.style.padding = "10px";
        th1.style.textAlign = "left";
        th1.style.width = "30%";
        th1.style.fontWeight = "bold";
        th1.style.fontSize = "12px";
        headerRow.appendChild(th1);

        const th2 = document.createElement("th");
        th2.textContent = "Instrucción";
        th2.style.backgroundColor = "#45A049";
        th2.style.color = "white";
        th2.style.padding = "10px";
        th2.style.textAlign = "left";
        th2.style.fontWeight = "bold";
        th2.style.fontSize = "12px";
        headerRow.appendChild(th2);

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        Object.entries(careData)
          .filter(([key]) => key !== "General" && key !== "Nombre Común")
          .forEach(([key, value]) => {
            const row = document.createElement("tr");

            const td1 = document.createElement("td");
            td1.textContent = key;
            td1.style.border = "1px solid #ddd";
            td1.style.padding = "10px";
            td1.style.fontWeight = "bold";
            td1.style.verticalAlign = "top";
            td1.style.fontSize = "11px";
            row.appendChild(td1);

            const td2 = document.createElement("td");
            td2.textContent = value;
            td2.style.border = "1px solid #ddd";
            td2.style.padding = "10px";
            td2.style.verticalAlign = "top";
            td2.style.lineHeight = "1.5";
            td2.style.fontSize = "11px";
            row.appendChild(td2);

            tbody.appendChild(row);
          });

        table.appendChild(tbody);
        plantSection.appendChild(table);

        container.appendChild(plantSection);
      }

      container.style.position = "absolute";
      container.style.top = "-99999px";
      container.style.left = "0";
      document.body.appendChild(container);

      console.log("Esperando imágenes...");
      await Promise.all(imagePromises);
      console.log("Imágenes cargadas");

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      console.log("Capturando contenido...");
      console.log("Container height:", container.scrollHeight, "px");

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: false,
        backgroundColor: "#ffffff",
        width: container.scrollWidth,
        height: container.scrollHeight,
        windowWidth: container.scrollWidth,
        windowHeight: container.scrollHeight,
      });

      console.log("Canvas creado:", canvas.width, "x", canvas.height);

      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      const imgData = canvas.toDataURL("image/png");

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      console.log("Guardando PDF con", pdf.getNumberOfPages(), "páginas...");
      pdf.save("mis_plantas.pdf");

      document.body.removeChild(container);

      toast.success(
        `PDF exportado correctamente con ${plantsToExport.length} planta(s)`
      );
    } catch (error) {
      console.error("Error al exportar PDF:", error);
      toast.error(
        "Error al exportar PDF: " +
          (error instanceof Error ? error.message : "desconocido")
      );
    } finally {
      setIsExporting(false);
    }
  };

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

  if (error && plants.length === 0) {
    return (
      <div className={styles.container}>
        <p className={styles.errorMessage}>{error}</p>
      </div>
    );
  }

  return (
    <>
      {isRegenerating && (
        <LoadingScreen
          message="Regenerando guía..."
          plantName={regeneratingPlantName}
        />
      )}

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
                disabled={isExporting || isRegenerating}
              >
                <FiCheckSquare /> Seleccionar{" "}
                {processedPlants.length > 0
                  ? `(${processedPlants.length})`
                  : ""}
              </button>
              <button
                onClick={handleDeselectAll}
                className={styles.selectButton}
                disabled={
                  isExporting || selectedPlants.size === 0 || isRegenerating
                }
              >
                <FiSquare /> Deseleccionar
              </button>
              <button
                onClick={handleExportExcel}
                className={styles.exportButton}
                disabled={
                  isExporting || selectedPlants.size === 0 || isRegenerating
                }
              >
                <FiGrid /> Exportar Excel ({selectedPlants.size})
              </button>
              <button
                onClick={handleExportPDF}
                className={styles.exportButton}
                disabled={
                  isExporting || selectedPlants.size === 0 || isRegenerating
                }
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

        {processedPlants.length > 0 ? (
          <div className={styles.myPlantsGrid}>
            {processedPlants.map((plant) => {
              const isSelected = selectedPlants.has(plant.id);
              const isEditingName = editingNameId === plant.id;
              const isBusy =
                isUpdatingImage ||
                isCompressing ||
                isEditingName ||
                isRegenerating;

              return (
                <div
                  key={plant.id}
                  className={`${styles.plantCard} ${
                    expandedPlant === plant.id ? styles.plantCardExpanded : ""
                  } ${isSelected ? styles.selected : ""} ${
                    isEditingName ? styles.plantCardEditing : ""
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
                      disabled={isBusy}
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
                      disabled={isBusy}
                    >
                      <FiEdit2 />
                    </button>

                    <div className={styles.plantNameOverlay}>
                      <h3
                        onClick={() =>
                          !isEditingName &&
                          !isRegenerating &&
                          togglePlant(plant.id)
                        }
                      >
                        {plant.name}
                      </h3>

                      {isEditingName ? (
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
                        <p
                          className={styles.commonNameDisplay}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isRegenerating) handleEditNameClick(plant);
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
                          disabled={isRegenerating}
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
                          disabled={isRegenerating}
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
                                handleSaveReminderStateUpdate(
                                  plant.id,
                                  "Riego",
                                  f
                                )
                              }
                              onDelete={() =>
                                handleDeleteReminder(plant.id, "Riego")
                              }
                            />
                            <ReminderSetup
                              plantId={plant.id}
                              careType="Fertilizante"
                              initialFrequency={
                                plant.fertilizing_frequency_days
                              }
                              onSave={(f) =>
                                handleSaveReminderStateUpdate(
                                  plant.id,
                                  "Fertilizante",
                                  f
                                )
                              }
                              onDelete={() =>
                                handleDeleteReminder(plant.id, "Fertilizante")
                              }
                            />
                          </div>
                          <div className={styles.diaryLinkContainer}>
                            <Link
                              href={`/plant-diary/${plant.id}`}
                              className={styles.diaryLinkButton}
                            >
                              Ver Diario <FiBookOpen />
                            </Link>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRegenerateGuide(plant);
                              }}
                              className={styles.regenerateButton}
                              title="Regenerar guía de cuidados"
                              disabled={isRegenerating}
                            >
                              <FiRefreshCw /> Regenerar Guía
                            </button>
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
