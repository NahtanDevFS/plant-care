// src/app/api/reminders/update-reminder/route.ts
// Este endpoint actualiza la frecuencia de un recordatorio Y calcula el siguiente

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
    const { plantId, careType, frequency } = await request.json();

    if (!plantId || !careType || !frequency || frequency <= 0) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // 1. Obtener el recordatorio actual
    const { data: reminder, error: reminderError } = await supabase
      .from("reminders")
      .select("*")
      .eq("plant_id", plantId)
      .eq("care_type", careType)
      .eq("user_id", user.id)
      .single();

    if (reminderError || !reminder) {
      return NextResponse.json(
        { error: "Recordatorio no encontrado" },
        { status: 404 }
      );
    }

    // 2. Calcular la próxima fecha de recordatorio
    const today = new Date();
    const nextReminderDate = new Date(today);
    nextReminderDate.setDate(nextReminderDate.getDate() + frequency);

    // 3. Actualizar el recordatorio existente
    const { error: updateError } = await supabase
      .from("reminders")
      .update({
        frequency_days: frequency,
        next_reminder_date: nextReminderDate.toISOString().split("T")[0],
      })
      .eq("id", reminder.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      message: "Recordatorio actualizado correctamente",
      nextReminderDate: nextReminderDate.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("Error al actualizar recordatorio:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
