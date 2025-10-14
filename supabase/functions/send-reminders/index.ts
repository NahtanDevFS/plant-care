// supabase/functions/send-reminders/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async (req) => {
  try {
    // 1. Inicializa el cliente de Supabase de forma segura
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    // 2. Lógica para obtener la fecha de hoy en Guatemala
    const now = new Date();
    now.setHours(now.getHours() - 6);
    const todayInGuatemala = now.toISOString().split("T")[0];
    console.log(`Buscando recordatorios para la fecha: ${todayInGuatemala}`);
    // 3. Consulta para obtener los recordatorios
    const { data: reminders, error: remindersError } = await supabaseClient
      .from("reminders")
      .select(
        `
        care_type,
        next_reminder_date,
        user_id,
        plants ( name )
      `
      )
      .eq("next_reminder_date", todayInGuatemala);
    if (remindersError) throw remindersError;
    if (!reminders || reminders.length === 0) {
      console.log("No hay recordatorios para enviar hoy.");
      return new Response(
        JSON.stringify({
          message: "No reminders for today.",
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }
    // 4. Obtener correos de usuarios únicos
    const userIds = [...new Set(reminders.map((r) => r.user_id))];
    const { data: userEmails, error: usersError } =
      await supabaseClient.auth.admin.listUsers();
    if (usersError) throw usersError;
    const emailMap = new Map();
    userEmails.users.forEach((user) => {
      emailMap.set(user.id, user.email);
    });
    // 5. Prepara y envía los correos usando Resend
    let successfulEmails = 0;
    let failedEmails = 0;
    const emailPromises = reminders.map(async (reminder) => {
      const plantName = reminder.plants?.name || "una de tus plantas";
      const userEmail = emailMap.get(reminder.user_id);
      if (!userEmail) {
        console.error(
          `No se encontró email para el user_id: ${reminder.user_id}`
        );
        failedEmails++;
        return;
      }
      try {
        // HTML mejorado con logo y botón
        const emailHtml = `
          <!DOCTYPE html>
          <html lang="es">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Recordatorio de PlantCare</title>
              <style>
                  body {
                      font-family: 'Arial', sans-serif;
                      line-height: 1.6;
                      color: #333;
                      margin: 0;
                      padding: 0;
                      background-color: #f9f9f9;
                  }
                  .container {
                      max-width: 600px;
                      margin: 0 auto;
                      background-color: #ffffff;
                      border-radius: 12px;
                      overflow: hidden;
                      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                  }
                  .header {
                      background: linear-gradient(135deg, #2e7d32, #4caf50);
                      padding: 30px 20px;
                      text-align: center;
                  }
                  .logo {
                      font-size: 32px;
                      font-weight: bold;
                      color: white;
                      margin-bottom: 10px;
                  }
                  .logo-icon {
                      font-size: 40px;
                      margin-right: 10px;
                  }
                  .content {
                      padding: 40px 30px;
                  }
                  .plant-name {
                      color: #2e7d32;
                      font-size: 24px;
                      font-weight: bold;
                      margin-bottom: 20px;
                  }
                  .care-type {
                      background-color: #e8f5e8;
                      padding: 15px;
                      border-radius: 8px;
                      border-left: 4px solid #4caf50;
                      margin: 20px 0;
                  }
                  .btn {
                      display: inline-block;
                      background: linear-gradient(135deg, #2e7d32, #4caf50);
                      color: white;
                      padding: 14px 28px;
                      text-decoration: none;
                      border-radius: 25px;
                      font-weight: bold;
                      margin: 25px 0;
                      text-align: center;
                      transition: all 0.3s ease;
                  }
                  .btn:hover {
                      background: linear-gradient(135deg, #1b5e20, #388e3c);
                      transform: translateY(-2px);
                      box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3);
                  }
                  .footer {
                      text-align: center;
                      padding: 20px;
                      background-color: #f5f5f5;
                      color: #666;
                      font-size: 14px;
                  }
                  .divider {
                      height: 2px;
                      background: linear-gradient(90deg, transparent, #4caf50, transparent);
                      margin: 25px 0;
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="header">
                      <div class="logo">
                          <span class="logo-icon">🌿</span>
                          PlantCare
                      </div>
                  </div>
                  
                  <div class="content">
                      <h1 style="color: #2e7d32; text-align: center; margin-bottom: 30px;">¡Recordatorio de Cuidado!</h1>
                      
                      <p style="font-size: 16px; text-align: center;">Hola, queríamos recordarte que hoy toca cuidar de tu planta:</p>
                      
                      <div style="text-align: center;">
                          <div class="plant-name">${plantName}</div>
                      </div>
                      
                      <div class="divider"></div>
                      
                      <div class="care-type">
                          <strong style="color: #2e7d32;">📋 Tipo de cuidado:</strong><br>
                          <span style="font-size: 18px; text-transform: capitalize;">${reminder.care_type.toLowerCase()}</span>
                      </div>
                      
                      <p style="text-align: center; font-size: 15px; color: #555;">
                          Tu planta te agradecerá este cuidado especial hoy. ¡No olvides darle la atención que necesita!
                      </p>
                      
                      <div style="text-align: center;">
                          <a href="https://plant-care-mu.vercel.app/" class="btn">
                              🌱 Ir a la App PlantCare
                          </a>
                      </div>
                      
                      <p style="text-align: center; font-size: 14px; color: #777;">
                          ¿Ya completaste el cuidado? Marca como hecho en la app para llevar un mejor control.
                      </p>
                  </div>
                  
                  <div class="footer">
                      <p>© 2025 PlantCare. Todos los derechos reservados.</p>
                      <p>Este es un mensaje automático, por favor no respondas a este correo.</p>
                  </div>
              </div>
          </body>
          </html>
        `;
        // Texto plano para clientes de email que no soportan HTML
        const emailText = `¡Hola! Recordatorio de PlantCare 🌿

Hoy es día de ${reminder.care_type.toLowerCase()} para tu planta: ${plantName}.

¡No olvides darle el cuidado que necesita! 

Puedes ver todos los detalles en: https://plant-care-mu.vercel.app/

¿Ya completaste el cuidado? Marca como hecho en la app para llevar un mejor control.

¡Que tengas un excelente día!`;
        // Usar fetch para enviar email via Resend API
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "PlantCare <onboarding@resend.dev>",
            to: [userEmail],
            subject: `🌿 Recordatorio de ${reminder.care_type} para ${plantName}`,
            text: emailText,
            html: emailHtml,
          }),
        });
        if (!resendResponse.ok) {
          const errorData = await resendResponse.json();
          throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
        }
        console.log(`✅ Correo enviado a: ${userEmail}`);
        successfulEmails++;
      } catch (emailError) {
        console.error(
          `❌ Error al enviar correo a ${userEmail}:`,
          emailError.message
        );
        failedEmails++;
      }
    });
    await Promise.allSettled(emailPromises);
    return new Response(
      JSON.stringify({
        message: `Procesamiento completado. Éxitos: ${successfulEmails}, Fallidos: ${failedEmails}, Total: ${reminders.length}`,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );
  } catch (err) {
    console.error("Error al ejecutar la función:", err);
    return new Response(
      JSON.stringify({
        error: err.message,
        details: "Error en el procesamiento de recordatorios",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
});
