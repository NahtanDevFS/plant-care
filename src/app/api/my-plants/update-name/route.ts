// src/app/api/my-plants/update-name/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

  try {
    const { plantId, commonName } = await request.json();

    if (!plantId || typeof commonName !== "string") {
      return NextResponse.json(
        { error: "Faltan datos (plantId o commonName)" },
        { status: 400 }
      );
    }

    // Si el usuario envía un string vacío lo guardamos como NULL
    const nameToUpdate = commonName.trim() === "" ? null : commonName.trim();

    const { data: updatedPlant, error: updateError } = await supabase
      .from("plants")
      .update({ common_name: nameToUpdate })
      .eq("id", plantId)
      .eq("user_id", user.id)
      .select("id, name, common_name")
      .single();

    if (updateError) {
      console.error("Error al actualizar nombre:", updateError);
      throw new Error("Error al actualizar el nombre en la base de datos.");
    }

    return NextResponse.json(updatedPlant);
  } catch (error) {
    console.error("Error en POST update-name:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
