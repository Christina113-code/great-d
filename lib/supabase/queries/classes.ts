/**
 * Class-related queries matching the exact database schema
 */

import { supabase } from "../client";
import { createSupabaseServer } from "../server";

export interface Class {
  id: string;
  name: string;
  class_code: string;
  teacher_id: string;
  created_at: string;
}

export interface ClassMember {
  id: string;
  class_id: string;
  user_id: string;
  created_at: string;
}

/**
 * Client-side: Get classes for a student (via class_members)
 */
export async function getStudentClasses(studentId: string) {
  // First, get class_ids from class_members
  const { data: memberships, error: memberError } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("user_id", studentId);

  if (memberError) {
    console.error("Error fetching memberships:", memberError.message);
    return [];
  }

  if (!memberships?.length) return [];

  // Then, fetch classes by class_id
  const classIds = memberships.map((m) => m.class_id);

  const { data: classes, error: classError } = await supabase
    .from("classes")
    .select("*")
    .in("id", classIds)
    .order("created_at", { ascending: false });

  if (classError) console.error("Error fetching classes:", classError.message);
  console.log(classes);
  return classes;
}

/**
 * Client-side: Get classes for a teacher
 */
export async function getTeacherClasses(teacherId: string) {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  return { data, error };
}

/**
 * Client-side: Get students (class_members) for a class
 */
export async function getClassMembers(classId: string) {
  const { data, error } = await supabase
    .from("class_members")
    .select(
      `
      id,
      class_id,
      user_id,
      created_at,
      user:users (
        id,
        name,
        role
      )
    `
    )
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  return { data, error };
}

/**
 * Client-side: Join a class by class code
 */
export async function joinClassByCode(classCode: string, studentId: string) {
  // Find the class by code
  const { data: classData, error: classError } = await supabase
    .from("classes")
    .select("id")
    .eq("class_code", classCode.toUpperCase())
    .single();

  if (classError || !classData) {
    return { data: null, error: classError || new Error("Class not found") };
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("class_members")
    .select("id")
    .eq("user_id", studentId)
    .eq("class_id", classData.id)
    .single();

  if (existing) {
    return { data: null, error: new Error("Already enrolled in this class") };
  }

  // Insert into class_members
  const { data, error } = await supabase
    .from("class_members")
    .insert({
      class_id: classData.id,
      user_id: studentId,
    })
    .select()
    .single();

  return { data, error };
}

/**
 * Client-side: Create a new class
 */
export async function createClass(name: string, teacherId: string) {
  // Generate random 6-character class code
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

/**
 * Server-side: Get classes for a teacher with members
 */
export async function getTeacherClassesWithMembers(teacherId: string) {
  const supabase = createSupabaseServer();

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  if (classesError || !classes) {
    return { data: null, error: classesError };
  }

  // Get members for each class
  const classesWithMembers = await Promise.all(
    classes.map(async (classItem) => {
      const { data: members } = await supabase
        .from("class_members")
        .select(
          `
          id,
          user:users (
            id,
            name
          )
        `
        )
        .eq("class_id", classItem.id);

      return {
        ...classItem,
        class_members: members || [],
      };
    })
  );

  return { data: classesWithMembers, error: null };
}
