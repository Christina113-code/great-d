/**
 * Assignment-related queries matching the exact database schema
 */

import { supabase } from "../client";
import { createSupabaseServer } from "../server";

export interface Assignment {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  due_date: string;
  rubric: string | null;
  answer_key: string | null;
  created_at: string;
}

/**
 * Client-side: Get assignments for a specific class
 */
export async function getAssignmentsForClass(classId: string) {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  return { data, error };
}

/**
 * Client-side: Get all assignments for classes a student is enrolled in
 */
export async function getStudentAssignments(studentId: string) {
  // First get classes student is enrolled in
  const { data: classMembers } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("user_id", studentId);

  if (!classMembers || classMembers.length === 0) {
    return { data: [], error: null };
  }

  const classIds = classMembers.map((cm) => cm.class_id);

  // Get assignments for these classes
  const { data, error } = await supabase
    .from("assignments")
    .select(
      `
      *,
      class:classes (
        id,
        name
      )
    `
    )
    .in("class_id", classIds)
    .order("due_date", { ascending: true });

  return { data, error };
}

/**
 * Client-side: Get all assignments for a teacher's classes
 */
export async function getTeacherAssignments(teacherId: string) {
  // Get all classes for teacher
  const { data: classes } = await supabase
    .from("classes")
    .select("id")
    .eq("teacher_id", teacherId);

  if (!classes || classes.length === 0) {
    return { data: [], error: null };
  }

  const classIds = classes.map((c) => c.id);

  // Get assignments for these classes
  const { data, error } = await supabase
    .from("assignments")
    .select(
      `
      *,
      class:classes (
        id,
        name
      )
    `
    )
    .in("class_id", classIds)
    .order("created_at", { ascending: false });

  return { data, error };
}

/**
 * Client-side: Create a new assignment
 */
export async function createAssignment(
  classId: string,
  teacherId: string,
  title: string,
  description: string,
  dueDate: string
) {
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      class_id: classId,
      teacher_id: teacherId,
      title,
      description: description || null,
      due_date: dueDate,
      rubric: null,
      answer_key: null,
    })
    .select()
    .single();

  return { data, error };
}

/**
 * Server-side: Get assignments for a class
 */
export async function getAssignmentsForClassServer(classId: string) {
  const supabase = createSupabaseServer();

  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  return { data, error };
}

