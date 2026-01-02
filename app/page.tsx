"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function load() {
      // 1. Check if user is logged in
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // 2. Fetch role from your "users" table
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      // 3. Redirect based on role

      router.push(
        data?.role === "teacher" ? "/dashboard/teacher" : "/dashboard/student"
      );
    }

    load();
  }, []);

  return <p className="text-center mt-10">Loading...</p>;
}
