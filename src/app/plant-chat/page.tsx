// src/app/plant-chat/page.tsx
"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./PlantChat.module.css";
import Image from "next/image";
// Mantenemos los íconos existentes
import { FiMessageSquare, FiArchive, FiUser, FiSend } from "react-icons/fi";

type Plant = {
  id: number;
  name: string;
  image_url: string;
  care_level: string | null;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

// Función para procesar el texto de Markdown a HTML
const formatMessage = (text: string) => {
  let formatted = text;
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, "<em>$1</em>");
  formatted = formatted.replace(/^- (.+)$/gm, "• $1");
  formatted = formatted.replace(
    /^\d+\. (.+)$/gm,
    '<div style="margin-left: 1rem;">$1</div>'
  );
  formatted = formatted.replace(/\n\n/g, "<br><br>");
  formatted = formatted.replace(/\n/g, "<br>");
  return formatted;
};

export default function PlantChatPage() {
  const supabase = createClient();
  const [allPlants, setAllPlants] = useState<Plant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [tempSelectedPlant, setTempSelectedPlant] = useState<number | null>(
    null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showSelector, setShowSelector] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPlants();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadPlants = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from("plants")
        .select("id, name, image_url, care_level")
        .eq("user_id", user.id);

      if (!error && data) {
        setAllPlants(data);
      }
    }
    setLoading(false);
  };

  const filteredPlants = useMemo(() => {
    if (!searchTerm) {
      return allPlants;
    }
    if (
      tempSelectedPlant &&
      !allPlants.find(
        (p) =>
          p.id === tempSelectedPlant &&
          p.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    ) {
      setTempSelectedPlant(null);
    }
    return allPlants.filter((plant) =>
      plant.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allPlants, searchTerm, tempSelectedPlant]);

  const handleSelectPlant = () => {
    const plant = allPlants.find((p) => p.id === tempSelectedPlant);
    if (plant) {
      setSelectedPlant(plant);
      setShowSelector(false);
      setMessages([
        {
          role: "assistant",
          content: `¡Hola! 👋 Soy tu asistente experto en ${plant.name}. Tengo toda la información sobre sus cuidados y características. ¿En qué puedo ayudarte hoy? 🌱`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  // --- NUEVA FUNCIÓN: Para iniciar el chat general ---
  const handleSelectGeneralChat = () => {
    const generalChatPlant: Plant = {
      id: 0, // ID 0 para identificar chat general en el backend
      name: "Botánica General",
      image_url: "/plant-care.png", // Usar el logo de la app
      care_level: null,
    };
    setSelectedPlant(generalChatPlant);
    setShowSelector(false);
    setMessages([
      {
        role: "assistant",
        content: `¡Hola! 👋 Soy tu asistente de botánica general. ¿En qué puedo ayudarte hoy? (Ej: Plantas económicas, exterior, interior...) 🌱`,
        timestamp: new Date(),
      },
    ]);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !selectedPlant || sending) return;

    const userMessage: Message = {
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setSending(true);

    try {
      const chatHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: inputMessage,
          plantId: selectedPlant.id, // Esto enviará 0 para chat general
          chatHistory: chatHistory,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al enviar mensaje");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content:
          "Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const changePlant = () => {
    setShowSelector(true);
    setSelectedPlant(null);
    setMessages([]);
    setTempSelectedPlant(null);
    setSearchTerm("");
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

  return (
    <div className={styles.container}>
      {!selectedPlant && (
        <div className={styles.header}>
          <h1>
            <FiMessageSquare /> Aprende más sobre plantas
          </h1>
          <p>
            Selecciona una planta o inicia un chat para consultar dudas de
            botánica personalizadas a una inteligencia artificial que las
            resolverá
          </p>
        </div>
      )}

      {showSelector && !selectedPlant ? (
        <div className={styles.plantSelector}>
          <div className={styles.generalChatContainer}>
            <button
              onClick={handleSelectGeneralChat}
              className={styles.generalChatButton}
            >
              <FiMessageSquare />
              <span>
                <strong>¿Preguntas generales?</strong>
                <small>
                  Consultar dudas de botánica, recomendaciones, etc.
                </small>
              </span>
            </button>
          </div>

          <div className={styles.separator}>
            <span>O</span>
          </div>
          {/* --- FIN NUEVA SECCIÓN --- */}

          <h2>Selecciona una planta específica</h2>

          {allPlants.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>
                <FiArchive />
              </span>
              <h3>No tienes plantas registradas</h3>
              <p>
                Cuando identifiques y guardes plantas, aparecerán aquí para
                chatear sobre ellas.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.searchContainer}>
                <input
                  type="text"
                  placeholder="Buscar planta por nombre..."
                  className={styles.searchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {filteredPlants.length > 0 ? (
                <div className={styles.plantsGrid}>
                  {filteredPlants.map((plant) => (
                    <div
                      key={plant.id}
                      className={`${styles.plantCard} ${
                        tempSelectedPlant === plant.id ? styles.selected : ""
                      }`}
                      onClick={() => setTempSelectedPlant(plant.id)}
                    >
                      <Image
                        src={plant.image_url}
                        alt={plant.name}
                        width={200}
                        height={120}
                        className={styles.plantCardImage}
                        unoptimized
                      />
                      <div className={styles.plantCardName}>{plant.name}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.noResults}>
                  No se encontraron plantas con ese nombre.
                </p>
              )}

              <button
                onClick={handleSelectPlant}
                disabled={!tempSelectedPlant}
                className={styles.selectButton}
              >
                Comenzar Chat Específico
              </button>
            </>
          )}
        </div>
      ) : selectedPlant ? (
        <div className={styles.chatContainer}>
          <div className={styles.chatHeader}>
            <div className={styles.chatHeaderInfo}>
              <Image
                src={selectedPlant.image_url}
                alt={selectedPlant.name}
                width={50}
                height={50}
                className={styles.chatHeaderImage}
                unoptimized
                key={selectedPlant.id}
              />
              <div className={styles.chatHeaderText}>
                <h3>{selectedPlant.name}</h3>
                <p>Asistente IA disponible</p>
              </div>
            </div>
            <button onClick={changePlant} className={styles.changePlantButton}>
              Cambiar Chat
            </button>
          </div>

          <div className={styles.messagesContainer}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`${styles.message} ${
                  message.role === "user"
                    ? styles.messageUser
                    : styles.messageAI
                }`}
              >
                <div className={styles.messageAvatar}>
                  {message.role === "user" ? (
                    <FiUser />
                  ) : selectedPlant.id === 0 ? (
                    <FiMessageSquare />
                  ) : (
                    "🌿"
                  )}
                </div>
                <div className={styles.messageBubble}>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: formatMessage(message.content),
                    }}
                  />
                  <span className={styles.messageTime}>
                    {message.timestamp.toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}

            {sending && (
              <div className={`${styles.message} ${styles.messageAI}`}>
                <div className={styles.messageAvatar}>
                  {selectedPlant.id === 0 ? <FiMessageSquare /> : "🌿"}
                </div>
                <div className={styles.typingIndicator}>
                  <span className={styles.typingDot}></span>
                  <span className={styles.typingDot}></span>
                  <span className={styles.typingDot}></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className={styles.inputContainer}>
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu pregunta..."
              className={styles.messageInput}
              disabled={sending}
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || sending}
              className={styles.sendButton}
            >
              <FiSend />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
