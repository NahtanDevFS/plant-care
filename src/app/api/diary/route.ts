// src/app/api/diary/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Helper para obtener la fecha 'YYYY-MM-DD' en Guatemala
const getGuatemalaDateString = (): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Guatemala",
  };

  // Esto devolverá la fecha local de Guatemala
  return new Intl.DateTimeFormat("sv", options).format(new Date());
};

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
        // Puedes agregar set y remove si necesitas modificar cookies en la respuesta
      },
    }
  );
}

// --- OBTENER ENTRADAS DEL DIARIO PARA UNA PLANTA (GET) ---
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

// --- CREAR UNA NUEVA ENTRADA EN EL DIARIO (POST) ---
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
        // Considera si quieres fallar aquí o continuar sin imagen
        // throw new Error(`Error al subir imagen: ${uploadError.message}`);
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
          // --- INICIO DE LA MODIFICACIÓN ---
          entry_date: entryDate
            ? new Date(entryDate).toISOString()
            : // : new Date().toISOString(), // <--- ANTERIOR (INCORRECTO)
              getGuatemalaDateString(), // <--- NUEVO (CORRECTO)
          // --- FIN DE LA MODIFICACIÓN ---
        },
      ])
      .select() // Devuelve la entrada creada
      .single(); // Esperamos solo una

    if (insertError) throw insertError;

    return NextResponse.json(newEntry, { status: 201 }); // 201 Creado
  } catch (error) {
    console.error("Error creating diary entry:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// --- ELIMINAR UNA ENTRADA DEL DIARIO (DELETE) ---
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
    // 1. Obtener la entrada para verificar el usuario y obtener la URL de la imagen
    const { data: entry, error: fetchError } = await supabase
      .from("plant_diary_entries")
      .select("image_url, user_id")
      .eq("id", entryId)
      .eq("user_id", user.id) // ¡Importante! Asegurar que el usuario es el dueño
      .single();

    if (fetchError || !entry) {
      console.error("Fetch error or entry not found/not owned:", fetchError);
      return NextResponse.json(
        { error: "Entrada no encontrada o no autorizado" },
        { status: 404 }
      );
    }

    // 2. Eliminar la imagen del storage si existe
    if (entry.image_url) {
      const imageUrlPath = new URL(entry.image_url).pathname;
      const fileName = imageUrlPath.split("/").slice(3).join("/"); // Extrae 'public/plant_images/'

      if (fileName) {
        console.log("Attempting to delete image:", fileName);
        const { error: storageError } = await supabase.storage
          .from("plant_images") // Usa tu bucket
          .remove([fileName]);

        if (storageError) {
          // Decide si quieres fallar o solo loguear el error y continuar
          console.error("Error deleting image from storage:", storageError);
          // Considera no lanzar un error aquí para permitir borrar la entrada de DB
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

    // 3. Eliminar la entrada de la base de datos
    const { error: deleteError } = await supabase
      .from("plant_diary_entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", user.id); // Doble verificación

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
