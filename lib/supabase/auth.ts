import { redirect } from "next/navigation";
import { createSupabaseServer } from "./server";

export async function getCurrentUser() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(role: "student" | "teacher") {
  const supabase = createSupabaseServer();
  const user = await requireAuth();

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== role) redirect("/");
  return user;
}
