import { supabase } from "./client";
import { createSupabaseServer } from "./server";

export async function createUserProfile(
  id: string,
  name: string,
  role: "student" | "teacher"
) {
  return supabase.from("users").insert({
    id,
    name,
    role,
  });
}

export async function getUserRoleServer(userId: string) {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  return data?.role;
}
