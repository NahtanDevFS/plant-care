import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import styles from "@/app/HomePage.module.css"; // Reutilizamos estilos

export default function Register({
  searchParams,
}: {
  searchParams: { message: string };
}) {
  const signUp = async (formData: FormData) => {
    "use server";

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${headers().get("origin")}/auth/callback`,
      },
    });

    if (error) {
      return redirect("/register?message=Could not authenticate user");
    }

    return redirect(
      "/register?message=Check email to continue sign in process"
    );
  };

  return (
    <div className={styles.authContainer}>
      <form action={signUp} className={styles.authForm}>
        <h2>Crear Cuenta</h2>
        <label htmlFor="email">Email</label>
        <input name="email" placeholder="you@example.com" required />
        <label htmlFor="password">Contraseña</label>
        <input
          type="password"
          name="password"
          placeholder="••••••••"
          required
        />
        <button className={styles.button}>Registrarse</button>
        <p>
          ¿Ya tienes cuenta? <Link href="/login">Inicia Sesión</Link>
        </p>
        {searchParams?.message && (
          <p className={styles.successMessage}>{searchParams.message}</p>
        )}
      </form>
    </div>
  );
}
