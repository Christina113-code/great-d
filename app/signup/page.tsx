"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { createUserProfile } from "@/lib/supabase/users";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error || !data.user) {
      setError(error?.message || "Signup failed");
      return;
    }

    const { error: profileError } = await createUserProfile(
      data.user.id,
      name,
      role
    );

    if (profileError) {
      setError(profileError.message);
      return;
    }

    router.push("/signup/confirm-email");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-100 to-blue-200 px-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 text-center">
        <h1 className="text-3xl font-extrabold text-blue-600">Join the Fun!</h1>
        <p className="text-gray-500 mt-2">Learn smarter, not harder ✨</p>

        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          <input
            className="w-full px-4 py-3 rounded-xl border
            bg-white text-gray-800 placeholder-gray-400
            focus:ring-2 focus:ring-indigo-400 outline-none"
            placeholder="Name"
            onChange={(e) => setName(e.target.value)}
            required
          />

          <input
            className="w-full px-4 py-3 rounded-xl border
             bg-white text-gray-800 placeholder-gray-400
             focus:ring-2 focus:ring-indigo-400 outline-none"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            className="w-full px-4 py-3 rounded-xl border
             bg-white text-gray-800 placeholder-gray-400
             focus:ring-2 focus:ring-indigo-400 outline-none"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`flex-1 py-3 rounded-xl font-semibold transition ${
                role === "student"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              🎒 Student
            </button>

            <button
              type="button"
              onClick={() => setRole("teacher")}
              className={`flex-1 py-3 rounded-xl font-semibold transition ${
                role === "teacher"
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              🍎 Teacher
            </button>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition"
          >
            Create Account
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-600">
          Already have an account?{" "}
          <a
            href="/login"
            className="text-blue-500 font-semibold hover:underline"
          >
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
