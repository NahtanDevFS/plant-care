// src/app/api/send-reminder-email/route.ts

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  // --- Seguridad (Opcional pero Recomendado) ---
  // const apiKey = request.headers.get('x-api-key');
  // if (apiKey !== process.env.EMAIL_API_SECRET) {
  //   console.warn("Intento de acceso no autorizado a la API de correo.");
  //   return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  // }
  // --- Fin Seguridad ---

  try {
    const { userEmail, userName, plantName, careType } = await request.json();

    // Validación básica de datos recibidos
    if (!userEmail || !plantName || !careType) {
      return NextResponse.json(
        { error: "Faltan datos requeridos (userEmail, plantName, careType)" },
        { status: 400 }
      );
    }

    // Configura el transportador de Nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_FROM,
        pass: process.env.GMAIL_APP_PASSWORD, // Usa la contraseña de aplicación
      },
      // Opciones adicionales para evitar problemas de TLS en algunos entornos
      // tls: {
      //     ciphers:'SSLv3'
      // }
    });

    const careEmoji = careType === "Riego" ? "💧" : "🧪";
    const subject = `${careEmoji} Recordatorio de cuidado para ${plantName} | PlantCare`;
    const greetingName = userName || "amante de las plantas"; // Usa username o un saludo genérico

    // Cuerpo del correo en HTML
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: sans-serif; line-height: 1.6; color: #333; background-color: #f7fdf7; padding: 20px; }
        .container { max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 8px; border-left: 5px solid #4CAF50; }
        .header { color: #4CAF50; font-size: 1.5em; margin-bottom: 15px; }
        .plant-name { font-weight: bold; }
        .care-type { font-size: 1.2em; margin: 15px 0; }
        .button { display: inline-block; background-color: #4CAF50; color: white !important; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; font-weight: bold; }
        .footer { margin-top: 30px; font-size: 0.8em; color: #777; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="header">Recordatorio de PlantCare</h1>
        <p>¡Hola ${greetingName}!</p>
        <p>Es hora de darle un poco de amor a tu planta <span class="plant-name">${plantName}</span>.</p>
        <p class="care-type">${careEmoji} Hoy necesita: <strong>${careType}</strong></p>
        <p>Asegúrate de marcar la tarea como completada en la aplicación una vez realizada.</p>
        <a href="${
          process.env.NEXT_PUBLIC_BASE_URL || "https://plant-care-mu.vercel.app"
        }/calendar-tasks" class="button" style="color: white;">Ver Calendario</a>
        <div class="footer">
          <p>Recibes este correo porque configuraste recordatorios en PlantCare.</p>
        </div>
      </div>
    </body>
    </html>
  `;

    // Opciones del correo
    const mailOptions = {
      from: `"PlantCare App" <${process.env.GMAIL_FROM}>`, // Remitente con nombre
      to: userEmail, // Destinatario
      subject: subject,
      html: emailHtml,
    };

    // Enviar el correo
    await transporter.sendMail(mailOptions);
    console.log(
      `Recordatorio enviado a ${userEmail} para ${plantName} (${careType})`
    );

    return NextResponse.json({ message: "Correo enviado con éxito" });
  } catch (error) {
    console.error("Error al enviar el correo:", error);
    // Evita exponer detalles del error al cliente
    return NextResponse.json(
      { error: "Error interno al enviar el correo." },
      { status: 500 }
    );
  }
}
