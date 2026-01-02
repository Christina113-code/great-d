import { supabase } from "./client";
import { createSupabaseServer } from "./server";

// Client-side functions
export async function createClass(name: string, teacherId: string) {
  // Generate a random 6-character class code
  const classCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const { data, error } = await supabase
    .from("classes")
    .insert({
      name,
      teacher_id: teacherId,
      class_code: classCode,
    })
    .select()
    .single();

  return { data, error };
}

export async function getTeacherClasses(teacherId: string) {
  const { data, error } = await supabase
    .from("classes")
    .select(
      `
      *,
      class_members (
        id,
        student:users!class_members_user_id_fkey (
          id,
          name
        )
      )
    `
    )
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  return { data, error };
}

export async function joinClassByCode(classCode: string, studentId: string) {
  // First find the class
  const { data: classData, error: classError } = await supabase
    .from("classes")
    .select("id")
    .eq("class_code", classCode.toUpperCase())
    .single();

  if (classError || !classData) {
    return { data: null, error: classError || new Error("Class not found") };
  }

  // Check if already enrolled
  const { data: existing } = await supabase
    .from("class_members")
    .select("id")
    .eq("user_id", studentId)
    .eq("class_id", classData.id)
    .single();

  if (existing) {
    return { data: null, error: new Error("Already enrolled in this class") };
  }

  // Create class_members
  const { data, error } = await supabase
    .from("class_members")
    .insert({
      user_id: studentId,
      class_id: classData.id,
    })
    .select()
    .single();

  return { data, error };
}

export async function getStudentClasses(studentId: string) {
  const { data, error } = await supabase
    .from("class_members")
    .select(
      `
      id,
      class:classes (
        id,
        name,
        class_code,
        created_at
      )
    `
    )
    .eq("user_id", studentId)
    .order("created_at", { ascending: false });

  return { data, error };
}

// Server-side functions
export async function getTeacherClassesServer(teacherId: string) {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("classes")
    .select(
      `
      *,
      class_members (
        id,
        student:users!class_members_user_id_fkey (
          id,
          name
        )
      )
    `
    )
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  return { data, error };
}

export async function getStudentClassesServer(studentId: string) {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("class_members")
    .select(
      `
      id,
      class:classes (
        id,
        name,
        class_code,
        created_at
      )
    `
    )
    .eq("user_id", studentId)
    .order("created_at", { ascending: false });

  return { data, error };
}

export async function getClassStudentsServer(classId: string) {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("class_members")
    .select(
      `
      student:users!class_members_user_id_fkey (
        id,
        name,
        email
      )
    `
    )
    .eq("class_id", classId);

  return { data, error };
}
