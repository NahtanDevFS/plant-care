// src/app/auth/sign-out/route.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          const response = NextResponse.redirect(
            new URL("/login", request.url)
          );
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          const response = NextResponse.redirect(
            new URL("/login", request.url)
          );
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Cierra la sesión del usuario
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url), {
    status: 302,
  });
}
