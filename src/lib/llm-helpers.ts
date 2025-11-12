// src/lib/llm-helpers.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { CURRENT_LLM_PROVIDER, LLM_MODELS } from "@/lib/llm-config";
import * as GroqClient from "@/lib/groq-client";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Llama a la API de LLM para generar una guía de cuidados.
 * @param plantName El nombre científico de la planta.
 * @param userCountry El país del usuario para contextualizar el clima.
 */
export async function getCareInstructions(
  plantName: string,
  userCountry: string
): Promise<string> {
  try {
    const prompt = `Proporciona una guía de cuidados para un jardinero casero sobre la planta "${plantName}", considerando las condiciones climáticas predominantes de ${userCountry} (IMPORTANTE: Usa fuentes botánicas confiables para confirmar los datos). La guía debe ser clara, específica y fácil de seguir. Utiliza EXACTAMENTE el siguiente formato, sin desviaciones:

### General:
- Dificultad: [Fácil/Media/Difícil - basado en: frecuencia de riego, tolerancia a errores, requisitos específicos]
- Apta para mascotas: [Sí/No - verificar toxicidad para perros y gatos específicamente]
- Venenosa: [Sí/No - si es Sí (solo pon Sí, si por ingerir una pequeña cantidad ya puede causar malestar), especificar para quién]

### Riego:
[Descripción clara del riego. Incluye frecuencia específica en días]

### Luz:
[Descripción de necesidades de luz: tipo de luz (directa, indirecta, sombra) y horas recomendadas]

### Sustrato:
[Descripción del sustrato ideal y componentes clave]

### Fertilizante:
[Descripción del fertilizante con frecuencia específica según estación]

### Humedad:
[Descripción de necesidades de humedad ambiental y si pulverizar]

### Plagas Comunes:
1. [Nombre de plaga]
Síntomas: [Lista de síntomas claros]
Control: [Métodos de control o tratamiento]

2. [Nombre de plaga]
Síntomas: [Lista de síntomas claros]
Control: [Métodos de control o tratamiento]

### Enfermedades Comunes:
1. [Nombre de enfermedad]
Síntomas: [Lista de síntomas claros]
Control: [Métodos de control o tratamiento]

2. [Nombre de enfermedad]
Síntomas: [Lista de síntomas claros]
Control: [Métodos de control o tratamiento]

IMPORTANTE: 
- No uses asteriscos o negrita en ningún lado
- Cada sección debe empezar exactamente con "### " 
- En Plagas y Enfermedades, numera con 1. 2. etc
- No incluyas texto introductorio ni final`;

    if (CURRENT_LLM_PROVIDER === "groq") {
      const response = await GroqClient.generateContent(
        LLM_MODELS.groq,
        prompt
      );
      return response;
    } else {
      const model = genAI.getGenerativeModel({ model: LLM_MODELS.gemini });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    }
  } catch (error) {
    console.error(
      `No se pudo obtener la información de cuidados de ${CURRENT_LLM_PROVIDER}:`,
      error
    );
    throw new Error(
      `No se pudo generar la información de cuidados desde ${CURRENT_LLM_PROVIDER}.`
    );
  }
}

/**
 * Extrae metadatos clave de la guía de cuidados generada por la IA.
 * @param careInstructions El texto de la guía de cuidados.
 */
export function extractPlantMetadata(careInstructions: string): {
  care_level: "Fácil" | "Media" | "Difícil" | null;
  pet_friendly: boolean | null;
  is_toxic: boolean | null;
} {
  const result = {
    care_level: null as "Fácil" | "Media" | "Difícil" | null,
    pet_friendly: null as boolean | null,
    is_toxic: null as boolean | null,
  };

  const generalMatch = careInstructions.match(/### General:[\s\S]*?(?=###|$)/);
  if (!generalMatch) return result;

  const generalText = generalMatch[0];

  const difficultyMatch = generalText.match(
    /Dificultad:\s*(Fácil|Media|Difícil)/i
  );
  if (difficultyMatch) {
    const difficulty = difficultyMatch[1];
    if (
      difficulty === "Fácil" ||
      difficulty === "Media" ||
      difficulty === "Difícil"
    ) {
      result.care_level = difficulty;
    }
  }

  const petMatch = generalText.match(/Apta para mascotas:\s*(S[íi]|No)/i);
  if (petMatch) {
    result.pet_friendly = petMatch[1].toLowerCase().startsWith("s");
  }

  const toxicMatch = generalText.match(/Venenosa:\s*(S[íi]|No)/i);
  if (toxicMatch) {
    result.is_toxic = toxicMatch[1].toLowerCase().startsWith("s");
  }

  return result;
}
