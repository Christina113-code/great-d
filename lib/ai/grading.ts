import Tesseract from "tesseract.js";
import fetch from "node-fetch";

const config = {
  ocrProvider: "tesseract", // Options: tesseract, googleVision, awsTextract
  llmProvider: "gemini", // Options: gemini, openai, claude
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: "gemini-2.5", // Example Gemini model
};
/**
 * AI Grading Pipeline
 *
 * This module provides a structure for real AI grading that can be easily
 * swapped with OpenAI, Gemini, or other LLM providers.
 */

export interface GradingResult {
  score: number; // 0-100
  feedback: string; // Step-by-step feedback
  breakdown?: {
    accuracy?: number;
    methodology?: number;
    completeness?: number;
  };
}

export interface GradingConfig {
  answerKey?: string; // URL or text content
  rubric?: string; // URL or text content
  assignmentId: string;
  assignmentTitle: string;
}

/**
 * Step 1: OCR - Extract text from submission image
 * Placeholder for real OCR implementation (e.g., Tesseract, Google Vision)
 */
export async function extractTextFromImage(imageUrl: string): Promise<string> {
  if (config.ocrProvider !== "tesseract") {
    throw new Error("Only Tesseract OCR is implemented in this MVP.");
  }

  try {
    // 1️⃣ Fetch image
    const response = await fetch(imageUrl);

    if (!response.ok) {
      console.error("Failed to fetch image:", response.status);
      return "";
    }

    const contentType = response.headers.get("content-type") || "";

    // 2️⃣ Validate image type (prevents HEIC / HTML / JSON crashes)
    if (
      !contentType.includes("image/jpeg") &&
      !contentType.includes("image/png")
    ) {
      console.error("Unsupported image type:", contentType);
      return "";
    }

    // 3️⃣ Convert to buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 1000) {
      console.error("Image buffer too small — likely invalid image");
      return "";
    }

    // 4️⃣ OCR (SAFE)
    const { data } = await Tesseract.recognize(buffer, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          console.log(
            "OCR progress:",
            Math.round((m.progress ?? 0) * 100),
            "%"
          );
        }
      },
    });

    return data.text.trim();
  } catch (error) {
    console.error("OCR failed:", error);
    return "";
  }
}

/**
 * Step 2: LLM Grading - Grade submission using LLM
 * Placeholder for real LLM implementation (e.g., OpenAI, Gemini)
 */
export async function gradeWithLLM(
  extractedText: string,
  gradingConfig: GradingConfig
): Promise<GradingResult> {
  if (config.llmProvider !== "gemini") {
    throw new Error("Only Gemini LLM is implemented in this MVP.");
  }

  const prompt = `
You are a helpful teaching assistant. 
Grade this assignment based on the answer key and rubric provided.
Return a JSON object like this:

{
  "score": number (0-100),
  "feedback": string,
  "breakdown": {
    "accuracy": number,
    "methodology": number,
    "completeness": number
  }
}

Assignment Title: ${gradingConfig.assignmentTitle}
Answer Key: ${gradingConfig.answerKey}
Rubric: ${gradingConfig.rubric}
Student Submission: ${extractedText}
`;

  try {
    const response = await fetch("http://localhost:4000/api/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: "https://example.com/student.png",
        assignmentTitle: "Simple Math Problem",
        answerKey: "2 + 2 = 4",
        rubric: "Correct answer gets full marks",
        submissionId: "6b9ef499-fbf4-40f2-b4e3-637cdf6f75c4", // optional
      }),
    });

    const data = await response.json();
    console.log(data.gradingResult);
    const rawText = data?.candidates?.[0]?.content?.[0]?.text || "";

    try {
      const parsed = JSON.parse(rawText);
      return parsed;
    } catch (e) {
      console.warn("Failed to parse LLM JSON, returning fallback feedback.");
      return {
        score: 85,
        feedback: `Could not parse LLM JSON. Here's raw output:\n\n${rawText}`,
        breakdown: { accuracy: 80, methodology: 85, completeness: 90 },
      };
    }
  } catch (error) {
    console.error("LLM grading error:", error);
    return {
      score: 80,
      feedback: "Error contacting LLM. Please try again later.",
      breakdown: { accuracy: 75, methodology: 80, completeness: 85 },
    };
  }
}

/**
 * Main grading pipeline
 * Orchestrates OCR -> LLM grading -> Result
 */
export async function gradeSubmission(
  imageUrl: string,
  config: GradingConfig
): Promise<GradingResult> {
  // Step 1: Extract text from image using OCR
  const extractedText = await extractTextFromImage(imageUrl);

  // Step 2: Grade using LLM
  const result = await gradeWithLLM(extractedText, config);

  return result;
}
