"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-200 px-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 text-center">
        <h1 className="text-3xl font-extrabold text-indigo-600">
          Welcome Back!
        </h1>
        <p className="text-gray-500 mt-2">Log in to continue learning 🚀</p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <input
            className="w-full px-4 py-3 rounded-xl border
            bg-white text-gray-800 placeholder-gray-400
            focus:ring-2 focus:ring-indigo-400 outline-none"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="w-full px-4 py-3 rounded-xl border
            bg-white text-gray-800 placeholder-gray-400
            focus:ring-2 focus:ring-indigo-400 outline-none"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition"
          >
            Log In
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-600">
          New here?{" "}
          <a
            href="/signup"
            className="text-indigo-500 font-semibold hover:underline"
          >
            Create an account
          </a>
        </p>
      </div>
    </div>
  );
}
