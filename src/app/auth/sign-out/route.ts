import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const supabase = createClient();

  // Check if we have a session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    await supabase.auth.signOut();
  }

  return redirect("/login");
}
