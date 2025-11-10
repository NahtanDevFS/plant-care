// src/app/api/identify/route.ts

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File | null;

    if (!image) {
      return NextResponse.json(
        { error: "No se proporcionó ninguna imagen." },
        { status: 400 }
      );
    }

    const imageBuffer = await image.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");

    const apiKey = process.env.PLANT_ID_API_KEY;
    if (!apiKey) {
      throw new Error("La API key de Plant.id no está configurada.");
    }

    const API_URL = "https://api.plant.id/v3/identification";

    const initialResponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify({
        images: [imageBase64],
        similar_images: true,
      }),
    });

    if (!initialResponse.ok) {
      console.error(
        "Error en la llamada inicial a Plant.id:",
        await initialResponse.text()
      );
      return NextResponse.json(
        { error: "Error al iniciar la identificación" },
        { status: initialResponse.status }
      );
    }

    const initialData = await initialResponse.json();
    const accessToken = initialData.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: "No se recibió un access_token de la API" },
        { status: 500 }
      );
    }

    const detailsUrl = `${API_URL}/${accessToken}?details=common_names,url&language=es`;

    const detailsResponse = await fetch(detailsUrl, {
      method: "GET",
      headers: {
        "Api-Key": apiKey,
      },
    });

    if (!detailsResponse.ok) {
      console.error(
        "Error al obtener los detalles de Plant.id:",
        await detailsResponse.text()
      );
      return NextResponse.json(
        { error: "Error al obtener los detalles de la planta" },
        { status: detailsResponse.status }
      );
    }

    const finalData = await detailsResponse.json();

    // Devolvemos las sugerencias del resultado final que ya incluyen los detalles.
    return NextResponse.json({
      suggestions: finalData.result.classification.suggestions,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
