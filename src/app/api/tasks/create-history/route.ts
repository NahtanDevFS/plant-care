// src/app/api/tasks/create-history/route.ts
// Este endpoint crea registros en task_history cuando se guarda una planta

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
    const { reminderId, plantId, careType } = await request.json();

    if (!reminderId || !plantId || !careType) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Crear un registro de historial para hoy
    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase.from("task_history").insert([
      {
        reminder_id: reminderId,
        plant_id: plantId,
        user_id: user.id,
        care_type: careType,
        scheduled_date: today,
        is_completed: false,
        completed_date: null,
      },
    ]);

    if (error) throw error;

    return NextResponse.json({
      message: "Registro de tarea creado correctamente",
    });
  } catch (error) {
    console.error("Error al crear historial de tareas:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// --- EDGE FUNCTION PARA CREAR TAREAS DIARIAMENTE ---
// Archivo: supabase/functions/create-daily-tasks/index.ts
// Se ejecuta diariamente para crear registros de task_history
