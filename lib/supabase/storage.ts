import { supabase } from "./client";

/**
 * Upload submission image to Supabase Storage
 *
 * Structure: submissions/{assignmentId}/{studentId}/{timestamp}.{ext}
 * This allows multiple attempts per student per assignment
 *
 * RLS: Should be enforced at storage bucket level:
 * - Students can upload to their own folder
 * - Teachers can read from folders of their students
 */
/**
 * Upload submission image and return file_path for database storage
 * Schema uses file_path (storage path), not image_url
 */
export async function uploadSubmissionImage(
  file: File,
  assignmentId: string,
  studentId: string
): Promise<{
  data: { file_path: string; publicUrl: string } | null;
  error: Error | null;
}> {
  const fileExt = file.name.split(".").pop() || "jpg";
  const timestamp = Date.now();
  const fileName = `${assignmentId}/${studentId}/${timestamp}.${fileExt}`;

  // Upload to submissions bucket
  const { data, error } = await supabase.storage
    .from("submissions")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    return { data: null, error: error as Error };
  }

  // Get public URL for display (file_path is stored in DB, publicUrl is for display)
  const {
    data: { publicUrl },
  } = supabase.storage.from("submissions").getPublicUrl(data.path);

  return { data: { file_path: data.path, publicUrl }, error: null };
}

/**
 * Get public URL from file_path (for display)
 */
export function getSubmissionImageUrl(filePath: string): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from("submissions").getPublicUrl(filePath);
  return publicUrl;
}

/**
 * Get signed URL for viewing submission image (for private buckets)
 * Use this for private buckets or when you need time-limited access
 */
export async function getSubmissionSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  const { data } = await supabase.storage
    .from("submissions")
    .createSignedUrl(filePath, expiresIn);

  return data?.signedUrl || null;
}
