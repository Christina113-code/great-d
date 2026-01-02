/**
 * Submission-related queries matching the exact database schema
 */

import { supabase } from "../client";
import { createSupabaseServer } from "../server";

export interface Submission {
  id: string;
  assignment_id: string;
  user_id: string;
  file_path: string | null;
  attempt_number: number;
  status: string;
  ai_score: number | null;
  ai_feedback: string | null;
  teacher_score: number | null;
  teacher_feedback: string | null;
  created_at: string;
  graded_at: string | null;
}

/**
 * Client-side: Get submissions for a specific assignment
 */
export async function getSubmissionsForAssignment(assignmentId: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select(
      `
      *,
      student:profiles!submissions_student_id_fkey (
        id,
        full_name
      )
    `
    )
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false });

  return { data, error };
}

/**
 * Client-side: Get all submission attempts for a student's assignment
 */
export async function getStudentSubmissionAttempts(
  assignmentId: string,
  studentId: string
) {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId) // corrected from user_id → student_id
    .order("attempt_number", { ascending: false });
  console.log("data", data);
  return { data, error };
}
/**
 * Client-side: Get all submissions for a student (across all assignments)
 */
export async function getStudentSubmissions(studentId: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select(
      `
    *,
    assignment:assignments (
      id,
      title,
      class:classes (
        id,
        name
      )
    )
  `
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  return { data, error };
}
/**
 * Client-side: Get next attempt number for a student's assignment
 */
export async function getNextAttemptNumber(
  assignmentId: string,
  studentId: string
): Promise<number> {
  const { data } = await supabase
    .from("submissions")
    .select("attempt_number")
    .eq("assignment_id", assignmentId)
    .eq("user_id", studentId)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .single();

  return (data?.attempt_number || 0) + 1;
}

/**
 * Client-side: Create a new submission
 */
export async function createSubmission(
  assignmentId: string,
  studentId: string,
  filePath: string
) {
  // Get next attempt number
  const attemptNumber = await getNextAttemptNumber(assignmentId, studentId);

  const { data, error } = await supabase
    .from("submissions")
    .insert({
      assignment_id: assignmentId,
      student_id: studentId,
      file_path: filePath,
      attempt_number: attemptNumber,
      status: "grading",
      ai_score: null,
      ai_feedback: null,
      teacher_score: null,
      teacher_feedback: null,
      graded_at: null,
    })
    .select()
    .single();

  return { data, error };
}

/**
 * Client-side: Update submission with AI grading results
 */
export async function updateSubmissionGrading(
  submissionId: string,
  aiScore: number,
  aiFeedback: string
) {
  const { data, error } = await supabase
    .from("submissions")
    .update({
      status: "graded",
      ai_score: aiScore,
      ai_feedback: aiFeedback,
      graded_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .select()
    .single();

  return { data, error };
}

/**
 * Client-side: Update submission with teacher review
 */
export async function updateTeacherReview(
  submissionId: string,
  teacherScore: number | null,
  teacherFeedback: string | null
) {
  const { data, error } = await supabase
    .from("submissions")
    .update({
      teacher_score: teacherScore,
      teacher_feedback: teacherFeedback,
    })
    .eq("id", submissionId)
    .select()
    .single();

  return { data, error };
}

/**
 * Client-side: Get all submissions for a teacher's assignments
 */
export async function getTeacherSubmissions(teacherId: string) {
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
  const { data: assignments } = await supabase
    .from("assignments")
    .select("id")
    .in("class_id", classIds);

  if (!assignments || assignments.length === 0) {
    return { data: [], error: null };
  }

  const assignmentIds = assignments.map((a) => a.id);

  // Get submissions for these assignments
  const { data, error } = await supabase
    .from("submissions")
    .select(
      `
      *,
      student:users!submissions_user_id_fkey (
        id,
        name
      ),
      assignment:assignments (
        id,
        title,
        class:classes (
          id,
          name
        )
      )
    `
    )
    .in("assignment_id", assignmentIds)
    .order("created_at", { ascending: false });

  return { data, error };
}

/**
 * Server-side: Get submissions for an assignment
 */
export async function getSubmissionsForAssignmentServer(assignmentId: string) {
  const supabase = createSupabaseServer();

  const { data, error } = await supabase
    .from("submissions")
    .select(
      `
      *,
      student:users!submissions_user_id_fkey (
        id,
        name
      )
    `
    )
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false });

  return { data, error };
}
