// src/middleware.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.delete(name);
        },
      },
    }
  );

  // Refresca la sesión del usuario si ha expirado.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- LÓGICA DE PROTECCIÓN DE RUTAS ---
  const { pathname } = request.nextUrl;

  // Rutas de autenticación (públicas para no logueados)
  const authRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ];
  // Rutas protegidas (privadas, solo para logueados)
  const protectedRoutes = ["/", "/my-plants", "/calendar"];

  // 1. Si el usuario NO está logueado y intenta acceder a una ruta protegida
  if (!user && protectedRoutes.includes(pathname)) {
    // Redirigir a la página de login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 2. Si el usuario SÍ está logueado y intenta acceder a una ruta de autenticación
  if (user && authRoutes.includes(pathname)) {
    // Redirigir a la página principal
    return NextResponse.redirect(new URL("/", request.url));
  }
  // --- FIN DE LA LÓGICA ---

  // Si no se cumple ninguna de las condiciones de redirección, continuar con la petición.
  return response;
}

export const config = {
  matcher: [
    /*
     * Coincide con todas las rutas de petición excepto las que empiezan por:
     * - api (rutas de API)
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (archivo de favicon)
     * - sw.js (service worker)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sw.js).*)",
  ],
};
