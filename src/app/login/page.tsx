import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import styles from "@/app/HomePage.module.css"; // Reutilizamos estilos

export default function Login({
  searchParams,
}: {
  searchParams: { message: string };
}) {
  const signIn = async (formData: FormData) => {
    "use server";

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return redirect("/login?message=Could not authenticate user");
    }

    return redirect("/");
  };

  return (
    <div className={styles.authContainer}>
      <form action={signIn} className={styles.authForm}>
        <h2>Iniciar Sesión</h2>
        <label htmlFor="email">Email</label>
        <input name="email" placeholder="you@example.com" required />
        <label htmlFor="password">Contraseña</label>
        <input
          type="password"
          name="password"
          placeholder="••••••••"
          required
        />
        <button className={styles.button}>Iniciar Sesión</button>
        <p>
          ¿No tienes cuenta? <Link href="/register">Regístrate</Link>
        </p>
        {searchParams?.message && (
          <p className={styles.errorMessage}>{searchParams.message}</p>
        )}
      </form>
    </div>
  );
}
