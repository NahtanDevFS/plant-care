// src/app/api/save-plant/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getCareInstructions, extractPlantMetadata } from "@/lib/llm-helpers";
import { CURRENT_LLM_PROVIDER } from "@/lib/llm-config";

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
    const formData = await request.formData();
    const image = formData.get("image") as File | null;
    const plantName = formData.get("plantName") as string | null;
    const commonNameFromClient = formData.get("commonName") as string | null;

    if (!image || !plantName) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    }

    const careInstructions = await getCareInstructions(plantName, userCountry);

    // care_level, pet_friendly, is_toxic
    const metadata = extractPlantMetadata(careInstructions);

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
