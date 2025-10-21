// src/app/api/chat/route.ts

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerClient } from "@supabase/ssr";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
    const { message, plantId, chatHistory } = await request.json();

    if (!message || !plantId) {
      return NextResponse.json(
        { error: "Faltan datos requeridos" },
        { status: 400 }
      );
    }

    // Obtener información completa de la planta
    const { data: plant, error: plantError } = await supabase
      .from("plants")
      .select("*")
      .eq("id", plantId)
      .eq("user_id", user.id)
      .single();

    if (plantError || !plant) {
      return NextResponse.json(
        { error: "Planta no encontrada" },
        { status: 404 }
      );
    }

    // Construir el contexto de la planta
    const plantContext = `
Eres un experto botánico y jardinero profesional especializado en el cuidado de plantas. Estás ayudando a un usuario con su planta específica.

INFORMACIÓN DE LA PLANTA DEL USUARIO:
- Nombre: ${plant.name}
- Nivel de Cuidado: ${plant.care_level || "No especificado"}
- Apta para mascotas: ${plant.pet_friendly ? "Sí" : "No"}
- Tóxica: ${plant.is_toxic ? "Sí" : "No"}
- Fecha de registro: ${new Date(plant.created_at).toLocaleDateString("es-ES")}

GUÍA DE CUIDADOS ACTUAL:
${plant.care_instructions}

INSTRUCCIONES PARA TI:
1. Responde de forma clara, amigable y personalizada
2. Usa la información de la planta para dar consejos específicos
3. Si el usuario pregunta algo que ya está en la guía de cuidados, referencia esa información
4. Si la pregunta es sobre síntomas (hojas amarillas, manchas, etc.), sé específico en el diagnóstico
5. Proporciona soluciones prácticas y fáciles de implementar
6. Si la pregunta no está relacionada con plantas o jardinería, gentilmente redirige al usuario
7. Mantén las respuestas concisas pero completas (máximo 250 palabras)
8. Usa emojis ocasionalmente para hacer la conversación más amena 🌿
9. Si no estás seguro de algo, admítelo y sugiere consultar con un experto local
10. IMPORTANTE: Usa formato de texto simple. Si necesitas resaltar algo importante, usa texto en MAYÚSCULAS o emojis destacados, pero evita usar asteriscos ** o símbolos de markdown

CONTEXTO ADICIONAL:
El usuario está en Guatemala, con clima templado a subtropical.
`;

    // Preparar el historial de chat para Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Construir el historial de conversación
    const history = chatHistory
      ? chatHistory.map((msg: any) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        }))
      : [];

    // Iniciar el chat con el contexto
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: plantContext }],
        },
        {
          role: "model",
          parts: [
            {
              text: `¡Entendido! Estoy listo para ayudarte con tu ${plant.name}. Tengo toda la información sobre sus cuidados y características. ¿Qué te gustaría saber? 🌱`,
            },
          ],
        },
        ...history,
      ],
    });

    // Enviar el mensaje del usuario
    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({
      response: text,
      plantName: plant.name,
    });
  } catch (error) {
    console.error("Error en el chat:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
