// src/app/auth/callback/route.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            const newResponse = NextResponse.redirect(`${origin}${next}`);
            newResponse.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            const newResponse = NextResponse.redirect(`${origin}${next}`);
            newResponse.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  console.error("Error en el callback de autenticación o código no encontrado");
  // Redirigir a una página de error si falla
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
