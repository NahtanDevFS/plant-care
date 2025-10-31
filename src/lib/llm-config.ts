// src/lib/llm-config.ts

export type LLMProvider = "gemini" | "groq";

//alternar entre APIs
export const CURRENT_LLM_PROVIDER: LLMProvider = "groq"; //'groq' o 'gemini'

export const LLM_MODELS = {
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
} as const;
