/**
 * Client-side authentication utilities
 * Used for route protection in client components
 */

import { supabase } from "./client";

export interface UserRole {
  role: "student" | "teacher" | null;
  userId: string;
}

/**
 * Get current user's role from the users table
 */
export async function getUserRole(): Promise<UserRole> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { role: null, userId: "" };
  }

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  return {
    role: (data?.role as "student" | "teacher") || null,
    userId: user.id,
  };
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}

/**
 * Check if user email is confirmed
 */
export async function isEmailConfirmed(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  // Check email confirmation status
  // Supabase sets email_confirmed_at when email is confirmed
  const { data: { user: userDetails } } = await supabase.auth.getUser();
  return !!userDetails?.email_confirmed_at;
}

/**
 * Require authentication - redirects to login if not authenticated
 */
export async function requireAuthClient(): Promise<{ id: string; email?: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  return user;
}

/**
 * Require specific role - redirects if role doesn't match
 */
export async function requireRoleClient(
  expectedRole: "student" | "teacher"
): Promise<UserRole | null> {
  const userRole = await getUserRole();

  if (!userRole.role) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  if (userRole.role !== expectedRole) {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
    return null;
  }

  return userRole;
}

