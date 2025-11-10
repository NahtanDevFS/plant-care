// src/app/api/chat/route.ts

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerClient } from "@supabase/ssr";
import { CURRENT_LLM_PROVIDER, LLM_MODELS } from "@/lib/llm-config";
import * as GroqClient from "@/lib/groq-client";

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

  let userCountry = "Guatemala";
  try {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("country")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.warn(
        `No se pudo cargar el perfil del usuario ${user.id}: ${profileError.message}`
      );
    } else if (profileData?.country) {
      userCountry = profileData.country;
    }
  } catch (profileCatchError) {
    console.error("Error al buscar el perfil:", profileCatchError);
  }

  try {
    const { message, plantId, chatHistory } = await request.json();

    if (!message || typeof plantId !== "number") {
      return NextResponse.json(
        { error: "Faltan datos requeridos (message o plantId)" },
        { status: 400 }
      );
    }

    let plantContext: string;
    let plantName: string;
    let initialAssistantMessage: string;

    if (plantId === 0) {
      plantName = "Botánica General";
      plantContext = `
Eres un experto botánico y jardinero profesional. Estás ayudando a un usuario con preguntas generales sobre botánica, jardinería, y recomendaciones de plantas.

INSTRUCCIONES PARA TI:
1. Responde de forma clara, amigable y profesional.
2. Si el usuario pregunta por recomendaciones (ej. "plantas de interior"), proporciona listas o sugerencias.
3. Si la pregunta es sobre síntomas (hojas amarillas, etc.) en general, da causas comunes.
4. Proporciona soluciones prácticas y fáciles de implementar.
5. Si la pregunta no está relacionada con plantas o jardinería, gentilmente redirige al usuario.
6. Mantén las respuestas concisas pero completas (máximo 250 palabras).
7. Usa emojis ocasionalmente para hacer la conversación más amena 🌿.
8. IMPORTANTE: Usa formato de texto simple. Si necesitas resaltar algo importante, usa texto en MAYÚSCULAS o emojis destacados, pero evita usar asteriscos ** o símbolos de markdown.

CONTEXTO ADICIONAL:
El usuario está en ${userCountry}. Ten esto en cuenta para tus recomendaciones.
`;
      initialAssistantMessage = `¡Hola! Soy tu asistente de botánica general. ¿Qué te gustaría saber sobre el mundo de las plantas? 🌳 (Ej. "recomiéndame plantas de interior")`;
    } else {
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

      plantName = plant.name;
      plantContext = `
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
3. Si el usuario pregunta algo que ya está en la guía de cuidados, referencia esa información (pero recuerda que la información en la guía de cuidados es limitada, tu propósito es ampliar esa información respecto a lo que el usuario desea saber)
4. Si la pregunta es sobre síntomas (hojas amarillas, manchas, etc.), sé específico en el diagnóstico
5. Proporciona soluciones prácticas y fáciles de implementar
6. Si la pregunta no está relacionada con plantas o jardinería, gentilmente redirige al usuario
7. Mantén las respuestas concisas pero completas (máximo 250 palabras)
8. Usa emojis ocasionalmente para hacer la conversación más amena 🌿
9. Si no estás seguro de algo, admítelo y sugiere consultar con un experto local
10. IMPORTANTE: Usa formato de texto simple. Si necesitas resaltar algo importante, usa texto en MAYÚSCULAS o emojis destacados, pero evita usar asteriscos ** o símbolos de markdown

CONTEXTO ADICIONAL:
El usuario está en ${userCountry}.
`;
      initialAssistantMessage = `¡Entendido! Estoy listo para ayudarte con tu ${plant.name}. Tengo toda la información sobre sus cuidados y características. ¿Qué te gustaría saber? 🌱`;
    }

    let responseText: string;

    if (CURRENT_LLM_PROVIDER === "groq") {
      // Usar Groq
      const messages = [
        { role: "user" as const, content: plantContext },
        {
          role: "assistant" as const,
          content: initialAssistantMessage,
        },
        ...(chatHistory || []).map((msg: any) => ({
          role: (msg.role === "user" ? "user" : "assistant") as
            | "user"
            | "assistant",
          content: msg.content,
        })),
        { role: "user" as const, content: message },
      ];

      responseText = await GroqClient.generateChatResponse(
        LLM_MODELS.groq,
        messages
      );
    } else {
      // Usar Gemini
      const model = genAI.getGenerativeModel({ model: LLM_MODELS.gemini });

      const history = chatHistory
        ? chatHistory.map((msg: any) => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
          }))
        : [];

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
                text: initialAssistantMessage,
              },
            ],
          },
          ...history,
        ],
      });

      const result = await chat.sendMessage(message);
      const response = await result.response;
      responseText = response.text();
    }

    return NextResponse.json({
      response: responseText,
      plantName: plantName,
      provider: CURRENT_LLM_PROVIDER,
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
