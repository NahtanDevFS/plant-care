// src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { CookieOptions, createServerClient } from "@supabase/ssr";
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

// obtener perfil del usuario
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("GET Profile Auth Error:", authError);
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", user.id)
      .single();

    if (profileError) {
      if (profileError.code === "PGRST116") {
        console.warn(
          `Profile not found for user ${user.id}. Returning empty profile.`
        );
        return NextResponse.json({ username: null, avatar_url: null });
      }
      console.error("GET Profile DB Error:", profileError);
      throw profileError;
    }

    return NextResponse.json(profile || { username: null, avatar_url: null });
  } catch (error) {
    console.error("GET Profile CATCH Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// actualizar perfil del usuario
export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("PUT Profile Auth Error:", authError);
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const username = formData.get("username") as string | null;
    const avatarFile = formData.get("avatar") as File | null;

    let avatarUrl: string | undefined = undefined;
    const updateData: {
      username?: string;
      avatar_url?: string;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (username !== null) {
      const trimmedUsername = username.trim();
      if (trimmedUsername.length > 0 && trimmedUsername.length < 3) {
        return NextResponse.json(
          { error: "El nombre de usuario debe tener al menos 3 caracteres." },
          { status: 400 }
        );
      }
      if (
        trimmedUsername.length > 0 &&
        !/^[a-zA-Z0-9_]+$/.test(trimmedUsername)
      ) {
        return NextResponse.json(
          { error: "Nombre de usuario inválido (solo letras, números, _)." },
          { status: 400 }
        );
      }
      if (trimmedUsername.length > 0) {
        updateData.username = trimmedUsername;
      }
    }

    if (avatarFile) {
      const { data: currentProfile, error: fetchError } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("Error fetching current avatar URL:", fetchError);
      } else if (currentProfile?.avatar_url) {
        try {
          const oldAvatarPath = new URL(currentProfile.avatar_url).pathname
            .split("/")
            .slice(3)
            .join("/");
          if (oldAvatarPath) {
            console.log("Deleting old avatar:", oldAvatarPath);
            await supabase.storage.from("plant_images").remove([oldAvatarPath]);
          }
        } catch (e) {
          console.error("Error deleting old avatar:", e);
        }
      }

      const fileExt = avatarFile.name.split(".").pop();
      const filePath = `avatars/${user.id}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("plant_images")
        .upload(filePath, avatarFile);

      if (uploadError) {
        console.error("PUT Profile Upload Error:", uploadError);
        throw new Error(`Error al subir imagen: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from("plant_images")
        .getPublicUrl(filePath);

      if (!urlData || !urlData.publicUrl) {
        console.error("Failed to get public URL for:", filePath);
        throw new Error(
          "No se pudo obtener la URL pública de la imagen subida."
        );
      }
      avatarUrl = urlData.publicUrl;
      updateData.avatar_url = avatarUrl;
    }

    if (updateData.username || updateData.avatar_url) {
      console.log("Updating profile for", user.id, "with data:", updateData);
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id)
        .select("username, avatar_url")
        .single();

      if (updateError) {
        if (updateError.code === "23505") {
          console.error(
            "PUT Profile Update Error (duplicate username):",
            updateError
          );
          return NextResponse.json(
            { error: "El nombre de usuario ya está en uso." },
            { status: 409 }
          );
        }
        console.error("PUT Profile Update DB Error:", updateError);
        throw updateError;
      }

      console.log("Profile updated successfully:", updatedProfile);
      return NextResponse.json(updatedProfile);
    } else {
      console.log("No profile data to update for", user.id);
      const { data: currentProfile, error: currentError } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .single();
      if (currentError && currentError.code !== "PGRST116") throw currentError;
      return NextResponse.json(
        currentProfile || { username: null, avatar_url: null }
      );
    }
  } catch (error) {
    console.error("PUT Profile CATCH Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error interno del servidor";
    if (errorMessage.includes("duplicate key value")) {
      return NextResponse.json(
        { error: "El nombre de usuario ya está en uso." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Error al actualizar el perfil." },
      { status: 500 }
    );
  }
}
