// src/app/api/diary/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

//Helper para crear cliente Supabase en Route Handlers
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

// obtener entradas del diario para una planta (GET)
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseClient();
  const { searchParams } = new URL(request.url);
  const plantId = searchParams.get("plantId");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!plantId) {
    return NextResponse.json(
      { error: "Falta el ID de la planta" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("plant_diary_entries")
      .select("*")
      .eq("plant_id", plantId)
      .eq("user_id", user.id) // Asegura obtener solo las del usuario
      .order("entry_date", { ascending: false }); // Más recientes primero

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching diary entries:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// crear las entradas del diario (POST)
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const plantId = formData.get("plantId") as string | null;
    const notes = formData.get("notes") as string | null;
    const imageFile = formData.get("image") as File | null;
    const entryDate = formData.get("entryDate") as string | null; // Fecha opcional desde el cliente

    if (!plantId || !notes) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    }

    let imageUrl: string | null = null;

    // Subir imagen si existe
    if (imageFile) {
      // Usar plantId en la ruta para organizar mejor
      const fileName = `${user.id}/${plantId}/${Date.now()}-${imageFile.name}`;
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("plant_images") // Usa tu bucket correcto
        .upload(fileName, imageFile);

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
      } else if (uploadData?.path) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("plant_images").getPublicUrl(uploadData.path);
        imageUrl = publicUrl;
      }
    }

    // Insertar en la base de datos
    const { error: insertError, data: newEntry } = await supabase
      .from("plant_diary_entries")
      .insert([
        {
          plant_id: parseInt(plantId, 10),
          user_id: user.id,
          notes: notes,
          image_url: imageUrl,
          entry_date: entryDate
            ? new Date(entryDate).toISOString()
            : new Date().toISOString(), // Usar fecha actual
        },
      ])
      .select() // Devuelve la entrada creada
      .single();

    if (insertError) throw insertError;

    return NextResponse.json(newEntry, { status: 201 }); // 201 Creado
  } catch (error) {
    console.error("Error creating diary entry:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// eliminar una entrada del diario (DELETE)
export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseClient();
  const { searchParams } = new URL(request.url);
  const entryId = searchParams.get("entryId");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!entryId) {
    return NextResponse.json(
      { error: "Falta el ID de la entrada" },
      { status: 400 }
    );
  }

  try {
    // Obtener la entrada para verificar el usuario y obtener la URL de la imagen
    const { data: entry, error: fetchError } = await supabase
      .from("plant_diary_entries")
      .select("image_url, user_id")
      .eq("id", entryId)
      .eq("user_id", user.id) // Asegurar que el usuario es el dueño
      .single();

    if (fetchError || !entry) {
      console.error("Fetch error or entry not found/not owned:", fetchError);
      return NextResponse.json(
        { error: "Entrada no encontrada o no autorizado" },
        { status: 404 }
      );
    }

    // Eliminar la imagen del storage si existe
    if (entry.image_url) {
      const imageUrlPath = new URL(entry.image_url).pathname;
      const fileName = imageUrlPath.split("/").slice(3).join("/"); // Extrae 'public/plant_images/'

      if (fileName) {
        console.log("Attempting to delete image:", fileName);
        const { error: storageError } = await supabase.storage
          .from("plant_images") // Usa el bucket
          .remove([fileName]);

        if (storageError) {
          console.error("Error deleting image from storage:", storageError);
        } else {
          console.log("Image deleted successfully from storage.");
        }
      } else {
        console.warn(
          "Could not extract file name from image_url:",
          entry.image_url
        );
      }
    }

    // Eliminar la entrada de la base de datos
    const { error: deleteError } = await supabase
      .from("plant_diary_entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error deleting database entry:", deleteError);
      throw deleteError;
    }

    console.log("Database entry deleted successfully.");
    return NextResponse.json({ message: "Entrada eliminada" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting diary entry:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
