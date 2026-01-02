/**
 * Teacher review and override functions
 */

import { supabase } from "./client";

export interface TeacherReview {
  teacher_score?: number | null;
  teacher_comment?: string | null;
  teacher_override?: boolean;
}

/**
 * Add teacher review to a submission
 * Includes manual score override and comments
 */
export async function addTeacherReview(
  submissionId: string,
  review: TeacherReview
) {
  const { data, error } = await supabase
    .from("submissions")
    .update({
      teacher_score: review.teacher_score,
      teacher_comment: review.teacher_comment,
      teacher_override: review.teacher_override || false,
    })
    .eq("id", submissionId)
    .select()
    .single();

  return { data, error };
}

/**
 * Get submission with full details including AI and teacher reviews
 */
export async function getSubmissionWithReviews(submissionId: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select(
      `
      *,
      student:users!submissions_user_id_fkey (
        id,
        name,
        email
      ),
      assignment:assignments (
        id,
        title,
        description,
        class:classes (
          id,
          name
        )
      )
    `
    )
    .eq("id", submissionId)
    .single();

  return { data, error };
}
