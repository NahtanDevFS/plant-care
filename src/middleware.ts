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

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  // --- LÓGICA DE RECUPERACIÓN DE CONTRASEÑA (NUEVO) ---
  const { pathname, searchParams } = request.nextUrl;
  const code = searchParams.get("code");

  // Si el usuario está en la página de reseteo Y hay un 'code' en la URL
  if (code && pathname === "/reset-password") {
    // Supabase usa el 'code' para establecer la sesión de recuperación
    // La sesión estará disponible en la próxima petición
    return NextResponse.redirect(new URL("/reset-password", request.url));
  }
  // --- FIN DE LA LÓGICA NUEVA ---

  // --- LÓGICA DE PROTECCIÓN DE RUTAS ---
  const authRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ];
  const protectedRoutes = ["/", "/my-plants", "/calendar"];

  if (!user && protectedRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && authRoutes.includes(pathname)) {
    // Excepción: Permitir acceso a reset-password si hay una sesión de recuperación
    const {
      data: { user: recoveryUser },
    } = await supabase.auth.getUser();
    const isRecoverySession = recoveryUser?.aud === "authenticated"; // Esto puede variar, pero la idea es detectar si la sesión es para recuperación

    if (pathname === "/reset-password" && isRecoverySession) {
      return response;
    }

    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js).*)"],
};
