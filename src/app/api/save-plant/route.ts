// src/app/api/save-plant/route.ts

import { NextRequest, NextResponse } from "next/server";
// Importamos las herramientas correctas de @supabase/ssr
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Inicializa el SDK de Google
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function getCareInstructions(plantName: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Proporciona una guía de cuidados completa y fácil de entender para la planta "${plantName}". Organiza la información en las siguientes secciones separadas por un título claro: Riego, Luz, Sustrato, Fertilizante y Humedad. Sé claro y conciso.`;

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
  // Creamos un cliente de Supabase para el servidor DENTRO de la ruta de API
  // Esto es necesario para que pueda acceder a las cookies de la petición
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

  // Obtenemos la sesión del usuario
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

    // Guardamos la planta con el user_id
    const { error: dbError } = await supabase.from("plants").insert([
      {
        name: plantName,
        care_instructions: careInstructions,
        image_url: publicUrl,
        user_id: user.id, // <-- Asociamos al usuario
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
