// src/lib/groq-client.ts

import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500; // Espera 500ms, luego 1000ms, luego 1500ms

export async function generateContent(
  model: string,
  prompt: string
): Promise<string> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
      });
      // Si tiene éxito, retorna el resultado inmediatamente
      return completion.choices[0]?.message?.content || "";
    } catch (error: any) {
      console.warn(
        `Groq generateContent error (Intento ${i + 1}/${MAX_RETRIES}):`,
        error.message
      );
      // Si es el último intento, lanza el error para que sea manejado
      if (i === MAX_RETRIES - 1) {
        console.error(
          "Groq generateContent falló después de todos los reintentos:",
          error
        );
        throw error;
      }
      await sleep(RETRY_DELAY_MS * (i + 1));
    }
  }
  return "";
}

export async function generateChatResponse(
  model: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const groqMessages = messages.map((msg) => ({
    role: msg.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: msg.content,
  }));

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: groqMessages,
        temperature: 0.7,
        max_tokens: 4096,
      });

      return completion.choices[0]?.message?.content || "";
    } catch (error: any) {
      console.warn(
        `Groq connection error (Intento ${i + 1}/${MAX_RETRIES}):`,
        error.message
      );

      if (i === MAX_RETRIES - 1) {
        console.error(
          "Groq generateChatResponse falló después de todos los reintentos:",
          error
        );
        throw new Error(
          `Error en la API de Groq después de ${MAX_RETRIES} intentos: ${error.message}`
        );
      }

      await sleep(RETRY_DELAY_MS * (i + 1));
    }
  }
  return "";
}

export default groq;
