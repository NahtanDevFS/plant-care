// src/lib/imageCompression.ts

/**
 * Comprime una imagen a formato JPEG con calidad ajustable
 * @param file - Archivo de imagen original
 * @param maxWidth - Ancho máximo de la imagen (default: 1200px)
 * @param maxHeight - Alto máximo de la imagen (default: 1200px)
 * @param quality - Calidad de compresión JPEG (0-1, default: 0.85)
 * @returns Promise con el archivo comprimido
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Error al leer el archivo"));

    reader.onload = (e) => {
      const img = new Image();

      img.onerror = () => reject(new Error("Error al cargar la imagen"));

      img.onload = () => {
        // Calcular nuevas dimensiones manteniendo aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        // Crear canvas para redimensionar
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Error al crear contexto de canvas"));
          return;
        }

        // Dibujar imagen redimensionada
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a Blob con compresión JPEG
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Error al comprimir la imagen"));
              return;
            }

            // Crear nuevo archivo con el blob comprimido
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^/.]+$/, ".jpg"), // Cambiar extensión a .jpg
              {
                type: "image/jpeg",
                lastModified: Date.now(),
              }
            );

            console.log(
              `Imagen comprimida: ${(file.size / 1024 / 1024).toFixed(
                2
              )}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`
            );

            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Obtiene el stream de la cámara del dispositivo
 * @param facingMode - "user" para cámara frontal, "environment" para trasera
 * @returns Promise con el MediaStream
 */
export async function getCameraStream(
  facingMode: "user" | "environment" = "environment"
): Promise<MediaStream> {
  // Verificar si el navegador soporta getUserMedia
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Tu navegador no soporta acceso a la cámara");
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: facingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
    return stream;
  } catch (error: any) {
    if (error.name === "NotAllowedError") {
      throw new Error("Permiso denegado para acceder a la cámara");
    } else if (error.name === "NotFoundError") {
      throw new Error("No se encontró ninguna cámara");
    } else {
      throw new Error(`Error al acceder a la cámara: ${error.message}`);
    }
  }
}

/**
 * Captura una foto desde un elemento de video
 * @param videoElement - Elemento de video activo
 * @returns Promise con el archivo de imagen capturado
 */
export async function capturePhotoFromVideo(
  videoElement: HTMLVideoElement
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Error al crear contexto de canvas"));
      return;
    }

    // Capturar frame actual del video
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Convertir a blob
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Error al capturar la imagen"));
          return;
        }

        // Crear archivo desde el blob
        const file = new File([blob], `camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });

        resolve(file);
      },
      "image/jpeg",
      0.9
    );
  });
}
