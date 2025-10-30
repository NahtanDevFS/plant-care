// src/lib/groq-client.ts

import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Interfaz compatible con Gemini
export async function generateContent(
  model: string,
  prompt: string
): Promise<string> {
  const completion = await groq.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 4096,
  });

  return completion.choices[0]?.message?.content || "";
}

// Para chat con historial
export async function generateChatResponse(
  model: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  // Convertir formato
  const groqMessages = messages.map((msg) => ({
    role: msg.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: msg.content,
  }));

  const completion = await groq.chat.completions.create({
    model,
    messages: groqMessages,
    temperature: 0.7,
    max_tokens: 4096,
  });

  return completion.choices[0]?.message?.content || "";
}

export default groq;
