import { supabase } from "./client";

/**
 * Upload submission image and return file_path for database storage
 */
export async function uploadSubmissionImage(
  file: File,
  assignmentId: string,
  studentId: string
): Promise<{
  data: { file_path: string; publicUrl: string } | null;
  error: Error | null;
}> {
  console.log("📤 [uploadSubmissionImage] start");
  console.log("📄 File:", {
    name: file.name,
    type: file.type,
    size: file.size,
  });
  console.log("🆔 assignmentId:", assignmentId);
  console.log("🆔 studentId:", studentId);

  const fileExt = file.name.split(".").pop() || "jpg";
  const timestamp = Date.now();
  const fileName = `${assignmentId}/${studentId}/${timestamp}.${fileExt}`;

  console.log("🧾 Generated file path:", fileName);

  const { data, error } = await supabase.storage
    .from("submissions")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    console.error("❌ Upload failed:", error);
    return { data: null, error: error as Error };
  }

  console.log("✅ Upload success:", data);

  const {
    data: { publicUrl },
  } = supabase.storage.from("submissions").getPublicUrl(data.path);

  console.log("🌍 Public URL generated:", publicUrl);

  return { data: { file_path: data.path, publicUrl }, error: null };
}

/**
 * Get public URL from file_path (for display)
 */
export function getSubmissionImageUrl(filePath: string): string {
  console.log("🖼️ [getSubmissionImageUrl] filePath:", filePath);

  const {
    data: { publicUrl },
  } = supabase.storage.from("submissions").getPublicUrl(filePath);

  console.log("🌍 Public URL:", publicUrl);

  return publicUrl;
}

/**
 * Get signed URL for viewing submission image (private buckets)
 */
export async function getSubmissionSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  console.log("🔐 [getSubmissionSignedUrl] start");
  console.log("🖼️ filePath:", filePath);
  console.log("⏳ expiresIn:", expiresIn);

  const { data, error } = await supabase.storage
    .from("submissions")
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    console.error("❌ Failed to create signed URL:", error);
    return null;
  }

  console.log("✅ Signed URL created:", data?.signedUrl);

  return data?.signedUrl || null;
}
