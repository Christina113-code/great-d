import { supabase } from "./client";
import { createSupabaseServer } from "./server";
import { gradeSubmission, type GradingConfig } from "@/lib/ai/grading";

// Client-side functions
export async function submitAssignment(
  assignmentId: string,
  studentId: string,
  imageUrl: string
) {
  // Get assignment details for grading config
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, title, answer_key_url, rubric_url")
    .eq("id", assignmentId)
    .single();

  // Create submission record first (pending status)
  const { data: submissionData, error: insertError } = await supabase
    .from("submissions")
    .insert({
      assignment_id: assignmentId,
      student_id: studentId,
      image_url: imageUrl,
      status: "grading", // Changed from "submitted" to indicate AI grading in progress
    })
    .select()
    .single();

  if (insertError || !submissionData) {
    return { data: null, error: insertError };
  }

  // Grade submission using AI pipeline
  try {
    const config: GradingConfig = {
      answerKey: assignment?.answer_key_url || undefined,
      rubric: assignment?.rubric_url || undefined,
      assignmentId: assignmentId,
      assignmentTitle: assignment?.title || "",
    };

    const gradingResult = await gradeSubmission(imageUrl, config);

    // Update submission with grading results
    const { data: updatedSubmission, error: updateError } = await supabase
      .from("submissions")
      .update({
        status: "graded",
        ai_score: gradingResult.score,
        ai_feedback: gradingResult.feedback,
      })
      .eq("id", submissionData.id)
      .select()
      .single();

    if (updateError) {
      console.error(
        "Error updating submission with grading results:",
        updateError
      );
      // Still return the submission even if grading update fails
      return { data: submissionData, error: null };
    }

    return { data: updatedSubmission, error: null };
  } catch (gradingError) {
    console.error("Error during AI grading:", gradingError);
    // Update status to indicate grading failed, but keep submission
    await supabase
      .from("submissions")
      .update({ status: "grading_failed" })
      .eq("id", submissionData.id);

    return { data: submissionData, error: gradingError as Error };
  }
}

export async function getAssignmentSubmissions(assignmentId: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select(
      `
      *,
      student:users!submissions_student_id_fkey (
        id,
        name
      )
    `
    )
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false });

  return { data, error };
}

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
    .order("submitted_at", { ascending: false });

  return { data, error };
}

/**
 * Get all submission attempts for a specific assignment by a student
 * Ordered by submission date (newest first)
 */
export async function getSubmissionAttempts(
  assignmentId: string,
  studentId: string
) {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false });

  return { data, error };
}

/**
 * Get the latest (best) submission for a student's assignment
 */
export async function getLatestSubmission(
  assignmentId: string,
  studentId: string
) {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .single();

  return { data, error };
}

// Server-side functions
export async function getAllTeacherSubmissionsServer(teacherId: string) {
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

  // Get all assignments for these classes
  const { data: assignments } = await supabase
    .from("assignments")
    .select("id")
    .in("class_id", classIds);

  if (!assignments || assignments.length === 0) {
    return { data: [], error: null };
  }

  const assignmentIds = assignments.map((a) => a.id);

  const { data, error } = await supabase
    .from("submissions")
    .select(
      `
      *,
      student:users!submissions_student_id_fkey (
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
    .order("submitted_at", { ascending: false });

  return { data, error };
}

export async function getSubmissionServer(submissionId: string) {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("submissions")
    .select(
      `
      *,
      student:users!submissions_student_id_fkey (
        id,
        name
      ),
      assignment:assignments (
        *
      )
    `
    )
    .eq("id", submissionId)
    .single();

  return { data, error };
}
