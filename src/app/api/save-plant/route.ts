// src/app/api/save-plant/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Inicializa el SDK de Google
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function getCareInstructions(plantName: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Usamos un modelo más reciente si está disponible

    // --- PROMPT MEJORADO Y MÁS DETALLADO ---
    const prompt = `Proporciona una guía de cuidados para un jardinero casero sobre la planta "${plantName}", considerando un clima templado a subtropical como el de Guatemala. La guía debe ser clara, específica y fácil de seguir. Utiliza el siguiente formato estricto, sin texto introductorio ni final:

### Riego:
Descripción del riego. Incluye una recomendación específica de frecuencia en días, por ejemplo: "Regar cada 7-10 días, o cuando los primeros 3cm de sustrato estén secos.".

### Luz:
Descripción detallada de las necesidades de luz (luz directa, indirecta brillante, sombra, etc.) y cuántas horas al día son ideales.

### Sustrato:
Descripción del tipo de sustrato ideal, mencionando componentes clave como perlita, turba o fibra de coco si son importantes.

### Fertilizante:
Descripción del fertilizante. Incluye una recomendación específica de frecuencia según la estación, por ejemplo: "Fertilizar cada 15 días durante la primavera y verano con un fertilizante balanceado.".

### Humedad:
Descripción de las necesidades de humedad ambiental y si es recomendable pulverizar las hojas.

### Plagas Comunes:
Lista de 1 a 2 plagas comunes para esta planta. Para cada una, describe los síntomas para detectarlas (ej. telarañas finas, manchas pegajosas) y un método de control o cura (ej. aceite de neem, jabón potásico).

### Enfermedades Comunes:
Lista de 1 a 2 enfermedades comunes (hongos, etc.). Para cada una, describe los síntomas para detectarlas (ej. manchas en las hojas, polvo blanco) y un método de control o cura (ej. mejorar ventilación, fungicida).`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error(
      "No se pudo obtener la información de cuidados de Gemini:",
      error
    );
    throw new Error(
      "No se pudo generar la información de cuidados desde Gemini."
    );
  }
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

    if (!image || !plantName) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    }

    const careInstructions = await getCareInstructions(plantName);

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
        care_instructions: careInstructions,
        image_url: publicUrl,
        user_id: user.id,
      },
    ]);

    if (dbError) throw dbError;

    return NextResponse.json({
      message: "¡Planta guardada con éxito!",
      careInstructions,
    });
  } catch (error) {
    console.error("Error en el endpoint POST /api/save-plant:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error interno del servidor.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
