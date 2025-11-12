// src/lib/llm-config.ts

export type LLMProvider = "gemini" | "groq";

//alternar entre APIs
export const CURRENT_LLM_PROVIDER: LLMProvider = "gemini"; //'groq' o 'gemini'

export const LLM_MODELS = {
  gemini: "gemini-2.5-flash",
  groq: "openai/gpt-oss-120b", //llama-3.3-70b-versatile o openai/gpt-oss-120b
} as const;
