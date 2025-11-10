// src/app/api/save-plant/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CURRENT_LLM_PROVIDER, LLM_MODELS } from "@/lib/llm-config";
import * as GroqClient from "@/lib/groq-client";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function getCareInstructions(plantName: string): Promise<string> {
  try {
    const prompt = `Proporciona una guía de cuidados para un jardinero casero sobre la planta "${plantName}", considerando un clima templado a subtropical como el de Guatemala. La guía debe ser clara, específica y fácil de seguir. Utiliza EXACTAMENTE el siguiente formato, sin desviaciones:

### General:
- Dificultad: [Fácil/Media/Difícil]
- Apta para mascotas: [Sí/No]
- Venenosa: [Sí/No - si es Sí, especificar para quién]

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

function extractPlantMetadata(careInstructions: string): {
  care_level: "Fácil" | "Media" | "Difícil" | null;
  pet_friendly: boolean | null;
  is_toxic: boolean | null;
} {
  const result = {
    care_level: null as "Fácil" | "Media" | "Difícil" | null,
    pet_friendly: null as boolean | null,
    is_toxic: null as boolean | null,
  };

  // Buscar la sección General
  const generalMatch = careInstructions.match(/### General:[\s\S]*?(?=###|$)/);
  if (!generalMatch) return result;

  const generalText = generalMatch[0];

  // Extraer Dificultad
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

  // Extraer Apta para mascotas
  const petMatch = generalText.match(/Apta para mascotas:\s*(S[íi]|No)/i);
  if (petMatch) {
    result.pet_friendly = petMatch[1].toLowerCase().startsWith("s");
  }

  // Extraer Venenosa
  const toxicMatch = generalText.match(/Venenosa:\s*(S[íi]|No)/i);
  if (toxicMatch) {
    result.is_toxic = toxicMatch[1].toLowerCase().startsWith("s");
  }

  return result;
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const image = formData.get("image") as File | null;
    const plantName = formData.get("plantName") as string | null;
    const commonNameFromClient = formData.get("commonName") as string | null;

    if (!image || !plantName) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    }

    const careInstructions = await getCareInstructions(plantName);

    // solo contiene care_level, pet_friendly, is_toxic
    const metadata = extractPlantMetadata(careInstructions);

    // Convertir string vacío a null para la base de datos
    const commonNameForDB =
      commonNameFromClient && commonNameFromClient.trim() !== ""
        ? commonNameFromClient.trim()
        : null;

    const fileName = `${user.id}/${Date.now()}-${image.name}`;
    const { error: uploadError } = await supabase.storage
      .from("plant_images")
      .upload(fileName, image);

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("plant_images").getPublicUrl(fileName);

    const { error: dbError } = await supabase.from("plants").insert([
      {
        name: plantName,
        common_name: commonNameForDB,
        care_instructions: careInstructions,
        image_url: publicUrl,
        user_id: user.id,
        care_level: metadata.care_level,
        pet_friendly: metadata.pet_friendly,
        is_toxic: metadata.is_toxic,
      },
    ]);

    if (dbError) throw dbError;

    return NextResponse.json({
      message: "¡Planta guardada con éxito!",
      careInstructions,
      metadata: {
        ...metadata,
        common_name: commonNameForDB,
      },
      provider: CURRENT_LLM_PROVIDER,
    });
  } catch (error) {
    console.error("Error en el endpoint POST /api/save-plant:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error interno del servidor.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
