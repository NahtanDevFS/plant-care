// src/app/plant-chat/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./PlantChat.module.css";
import Image from "next/image";

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

export default function PlantChatPage() {
  const supabase = createClient();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [tempSelectedPlant, setTempSelectedPlant] = useState<number | null>(
    null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showSelector, setShowSelector] = useState(true);
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
        setPlants(data);
      }
    }
    setLoading(false);
  };

  const handleSelectPlant = () => {
    const plant = plants.find((p) => p.id === tempSelectedPlant);
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
      // Preparar historial para la API
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
          plantId: selectedPlant.id,
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

  if (plants.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🤖 Chat con tu Planta</h1>
        </div>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🪴</span>
          <h3>No tienes plantas registradas</h3>
          <p>
            Primero debes identificar y guardar una planta para poder chatear
            sobre ella.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {!selectedPlant && (
        <div className={styles.header}>
          <h1>🤖 Chat con tu Planta</h1>
          <p>Selecciona una planta para consultar dudas personalizadas</p>
        </div>
      )}

      {showSelector && !selectedPlant ? (
        <div className={styles.plantSelector}>
          <h2>Selecciona una planta</h2>
          <div className={styles.plantsGrid}>
            {plants.map((plant) => (
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
          <button
            onClick={handleSelectPlant}
            disabled={!tempSelectedPlant}
            className={styles.selectButton}
          >
            Comenzar Chat
          </button>
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
              />
              <div className={styles.chatHeaderText}>
                <h3>{selectedPlant.name}</h3>
                <p>Asistente IA disponible</p>
              </div>
            </div>
            <button onClick={changePlant} className={styles.changePlantButton}>
              Cambiar Planta
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
                  {message.role === "user" ? "👤" : "🌿"}
                </div>
                <div className={styles.messageBubble}>
                  {message.content}
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
                <div className={styles.messageAvatar}>🌿</div>
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
              placeholder="Escribe tu pregunta sobre la planta..."
              className={styles.messageInput}
              disabled={sending}
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || sending}
              className={styles.sendButton}
            >
              ➤
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
