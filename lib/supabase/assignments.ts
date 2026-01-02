import { supabase } from "./client";
import { createSupabaseServer } from "./server";

// Client-side functions
export async function createAssignment(
  classId: string,
  title: string,
  description: string,
  dueDate: string,
  answerKeyUrl?: string,
  rubricUrl?: string
) {
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      class_id: classId,
      title,
      description,
      due_date: dueDate,
      answer_key_url: answerKeyUrl,
      rubric_url: rubricUrl,
    })
    .select()
    .single();

  return { data, error };
}

export async function getClassAssignments(classId: string) {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  return { data, error };
}

export async function getStudentAssignments(studentId: string) {
  // Get all classes student is enrolled in
  const { data: class_members } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("user_id", studentId);

  if (!class_members || class_members.length === 0) {
    return { data: [], error: null };
  }

  const classIds = class_members.map((e) => e.class_id);

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

  // Get submissions for these assignments
  if (data && data.length > 0) {
    const assignmentIds = data.map((a) => a.id);
    const { data: submissionsData } = await supabase
      .from("submissions")
      .select("*")
      .in("assignment_id", assignmentIds)
      .eq("user_id", studentId)
      .order("submitted_at", { ascending: false });

    // Group submissions by assignment (all attempts)
    if (submissionsData) {
      const submissionsByAssignment = new Map<string, any[]>();
      submissionsData.forEach((sub: any) => {
        if (!submissionsByAssignment.has(sub.assignment_id)) {
          submissionsByAssignment.set(sub.assignment_id, []);
        }
        submissionsByAssignment.get(sub.assignment_id)!.push(sub);
      });

      // Attach all submissions to each assignment (for attempt history)
      // Latest is first in array due to ordering
      data.forEach((assignment: any) => {
        assignment.submissions =
          submissionsByAssignment.get(assignment.id) || [];
      });
    }
  }

  return { data, error };
}

// Server-side functions
export async function getTeacherAssignmentsServer(teacherId: string) {
  const supabase = createSupabaseServer();

  // Get all classes for teacher
  const { data: classes } = await supabase
    .from("classes")
    .select("id")
    .eq("teacher_id", teacherId);

  if (!classes || classes.length === 0) {
    return { data: [], error: null };
  }

  const classIds = classes.map((c) => c.id);

  const { data, error } = await supabase
    .from("assignments")
    .select(
      `
      *,
      class:classes!inner (
        id,
        name
      ),
      submissions (
        id,
        user_id,
        status,
        ai_score,
        submitted_at
      )
    `
    )
    .in("class_id", classIds)
    .order("created_at", { ascending: false });

  return { data, error };
}

export async function getAssignmentServer(assignmentId: string) {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", assignmentId)
    .single();

  return { data, error };
}

export async function getStudentAssignmentsServer(studentId: string) {
  const supabase = createSupabaseServer();

  // Get all classes student is enrolled in
  const { data: class_members } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("user_id", studentId);

  if (!class_members || class_members.length === 0) {
    return { data: [], error: null };
  }

  const classIds = class_members.map((e) => e.class_id);

  const { data, error } = await supabase
    .from("assignments")
    .select(
      `
      *,
      class:classes (
        id,
        name
      ),
      submissions!left (
        id,
        status,
        ai_score,
        ai_feedback,
        submitted_at
      )
    `
    )
    .in("class_id", classIds)
    .order("due_date", { ascending: true });

  return { data, error };
}
