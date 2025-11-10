// src/app/api/my-plants/update-image/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Helper para crear cliente Supabase en Route Handlers
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
        async set(name: string, value: string, options: CookieOptions) {
          await cookieStore.set({ name, value, ...options });
        },
        async remove(name: string, options: CookieOptions) {
          await cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}

// Función para extraer el path del archivo desde una URL de Supabase Storage
function getPathFromUrl(url: string) {
  try {
    const { pathname } = new URL(url);
    const parts = pathname.split("/");
    const bucketName = "plant_images";
    const bucketIndex = parts.indexOf(bucketName);
    if (bucketIndex === -1 || bucketIndex + 1 >= parts.length) {
      console.warn("No se pudo extraer el path del bucket de la URL:", url);
      return null;
    }
    return parts.slice(bucketIndex + 1).join("/");
  } catch (error) {
    console.error("URL inválida:", error);
    return null;
  }
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
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const plantId = formData.get("plantId") as string | null;

    if (!imageFile || !plantId) {
      return NextResponse.json(
        { error: "Faltan datos (imagen o ID de planta)" },
        { status: 400 }
      );
    }

    // Obtener la URL de la imagen antigua
    const { data: plantData, error: fetchError } = await supabase
      .from("plants")
      .select("image_url")
      .eq("id", plantId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !plantData) {
      return NextResponse.json(
        { error: "Planta no encontrada o no autorizada" },
        { status: 404 }
      );
    }
    const oldImagePath = getPathFromUrl(plantData.image_url);

    // Subir la nueva imagen
    const fileName = `${user.id}/${plantId}/${Date.now()}-${imageFile.name}`;
    const { error: uploadError, data: uploadData } = await supabase.storage
      .from("plant_images")
      .upload(fileName, imageFile);

    if (uploadError) {
      console.error("Error al subir imagen:", uploadError);
      throw new Error(`Error al subir imagen: ${uploadError.message}`);
    }

    // Obtener la URL pública de la nueva imagen
    const {
      data: { publicUrl: newImageUrl },
    } = supabase.storage.from("plant_images").getPublicUrl(uploadData.path);

    if (!newImageUrl) {
      throw new Error("No se pudo obtener la URL pública de la nueva imagen");
    }

    // Actualizar la base de datos con la nueva URL
    const { error: updateError } = await supabase
      .from("plants")
      .update({ image_url: newImageUrl })
      .eq("id", plantId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error al actualizar DB:", updateError);
      // Si la DB falla, intentar borrar la imagen que acabamos de subir
      await supabase.storage.from("plant_images").remove([uploadData.path]);
      throw new Error(
        `Error al actualizar la base de datos: ${updateError.message}`
      );
    }

    // Borrar la imagen antigua si existía
    if (oldImagePath) {
      const { error: removeError } = await supabase.storage
        .from("plant_images")
        .remove([oldImagePath]);
      if (removeError) {
        console.error("Error al eliminar imagen antigua:", removeError.message);
      }
    }

    //Devolver la nueva URL
    return NextResponse.json({ new_image_url: newImageUrl });
  } catch (error) {
    console.error("Error en POST update-image:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
