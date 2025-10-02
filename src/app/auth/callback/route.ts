// src/app/auth/callback/route.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

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
            const response = NextResponse.redirect(origin);
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            const response = NextResponse.redirect(origin);
            response.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirige al usuario a la página de inicio después del inicio de sesión.
  return NextResponse.redirect(origin);
}
