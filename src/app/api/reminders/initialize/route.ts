// src/app/api/reminders/initialize/route.ts
// Este endpoint crea los recordatorios iniciales cuando se guarda una planta

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// --- INICIO DE LA MODIFICACIÓN ---
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
// --- FIN DE LA MODIFICACIÓN ---

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
    const { plantId, careTpes } = await request.json();

    if (!plantId || !careTpes || careTpes.length === 0) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Obtener la planta para verificar que pertenece al usuario
    const { data: plant, error: plantError } = await supabase
      .from("plants")
      .select("id, user_id")
      .eq("id", plantId)
      .single();

    if (plantError || !plant || plant.user_id !== user.id) {
      return NextResponse.json(
        { error: "Planta no encontrada o no autorizado" },
        { status: 404 }
      );
    }

    // --- INICIO DE LA MODIFICACIÓN ---
    // const today = new Date(); // <-- ANTERIOR
    const todayString = getGuatemalaDateString(); // <--- NUEVO
    // --- FIN DE LA MODIFICACIÓN ---

    const remindersToCreate = careTpes.map((careType: string) => ({
      plant_id: plantId,
      user_id: user.id,
      care_type: careType,
      // --- INICIO DE LA MODIFICACIÓN ---
      // next_reminder_date: today.toISOString().split("T")[0], // <--- ANTERIOR
      next_reminder_date: todayString, // <--- NUEVO
      // --- FIN DE LA MODIFICACIÓN ---
      frequency_days: 7, // Default, se actualiza cuando el usuario configura
    }));

    const { error: insertError } = await supabase
      .from("reminders")
      .insert(remindersToCreate);

    if (insertError) throw insertError;

    return NextResponse.json({
      message: "Recordatorios inicializados correctamente",
    });
  } catch (error) {
    console.error("Error en initialize reminders:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
