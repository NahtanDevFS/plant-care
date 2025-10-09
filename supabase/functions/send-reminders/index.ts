// supabase/functions/send-reminders/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

interface NotificationPayload {
  title: string;
  body: string;
}

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    webpush.setVapidDetails(
      "mailto:jonathan007franco@gmail.com",
      Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    );

    // --- CORRECCIÓN DE ZONA HORARIA ---
    // Obtenemos la hora actual y ajustamos a UTC-6 (Guatemala)
    const now = new Date();
    const guatemalaTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const todayInGuatemala = guatemalaTime.toISOString().split("T")[0];
    // ------------------------------------

    console.log(`Buscando recordatorios para la fecha: ${todayInGuatemala}`);

    const { data: reminders, error: remindersError } = await supabaseClient
      .from("reminders")
      .select(
        `
        care_type,
        plants ( name ),
        push_subscriptions ( subscription_data )
      `
      )
      .eq("next_reminder_date", todayInGuatemala); // Usamos la fecha corregida

    if (remindersError) throw remindersError;
    if (!reminders || reminders.length === 0) {
      console.log("No hay recordatorios para enviar hoy.");
      return new Response(
        JSON.stringify({ message: "No reminders for today." }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const notificationsToSend = reminders
      .map((reminder) => {
        // @ts-ignore
        const plantName = reminder.plants?.name || "una de tus plantas";

        const payload: NotificationPayload = {
          title: "🌿 Recordatorio de PlantCare 🌿",
          body: `¡Hoy es día de ${reminder.care_type.toLowerCase()} para ${plantName}!`,
        };

        // @ts-ignore
        const subscription = reminder.push_subscriptions?.subscription_data;

        if (subscription) {
          return webpush.sendNotification(
            subscription,
            JSON.stringify(payload)
          );
        }
      })
      .filter(Boolean); // Filtramos los indefinidos si no había suscripción

    if (notificationsToSend.length > 0) {
      await Promise.all(notificationsToSend);
      console.log(
        `${notificationsToSend.length} notificaciones enviadas con éxito.`
      );
    }

    return new Response(
      JSON.stringify({
        message: `${notificationsToSend.length} notificaciones enviadas.`,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("Error al ejecutar la función:", err);
    return new Response(String(err?.message ?? err), { status: 500 });
  }
});
