// src/app/api/my-plants/regenerate-guide/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getCareInstructions, extractPlantMetadata } from "@/lib/llm-helpers"; // Importamos las funciones compartidas

async function createSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let userCountry = "Guatemala";
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("country")
      .eq("id", user.id)
      .single();
    if (profile && profile.country) {
      userCountry = profile.country;
    }
  } catch (e) {
    console.warn("No se pudo obtener país del perfil, usando fallback.");
  }

  try {
    const { plantId, plantName } = await request.json();
    if (!plantId || !plantName) {
      return NextResponse.json(
        { error: "Faltan datos (plantId o plantName)" },
        { status: 400 }
      );
    }

    const newCareInstructions = await getCareInstructions(
      plantName,
      userCountry
    );

    const newMetadata = extractPlantMetadata(newCareInstructions);

    const { data: updatedPlant, error: updateError } = await supabase
      .from("plants")
      .update({
        care_instructions: newCareInstructions,
        care_level: newMetadata.care_level,
        pet_friendly: newMetadata.pet_friendly,
        is_toxic: newMetadata.is_toxic,
      })
      .eq("id", plantId)
      .eq("user_id", user.id)
      .select(
        "id, created_at, name, common_name, image_url, care_instructions, care_level, pet_friendly, is_toxic"
      )
      .single();

    if (updateError) {
      console.error("Error al actualizar la planta:", updateError);
      throw updateError;
    }

    return NextResponse.json(updatedPlant);
  } catch (error) {
    console.error("Error en POST regenerate-guide:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
