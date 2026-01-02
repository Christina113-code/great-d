"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  getStudentClasses,
  joinClassByCode,
} from "@/lib/supabase/queries/classes";
import { getStudentAssignments } from "@/lib/supabase/queries/assignments";
import {
  getStudentSubmissions,
  getStudentSubmissionAttempts,
  createSubmission,
  updateSubmissionGrading,
} from "@/lib/supabase/queries/submissions";
import { uploadSubmissionImage } from "@/lib/supabase/storage";
import { gradeSubmission, type GradingConfig } from "@/lib/ai/grading";
import { Class } from "@/lib/types";

interface ClassWithDetails {
  id: string;
  class_id: string;
  user_id: string;
  created_at: string;
  class: {
    id: string;
    name: string;
    class_code: string;
    teacher_id: string;
    created_at: string;
  };
}

interface AssignmentWithClass {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  due_date: string;
  rubric: string | null;
  answer_key: string | null;
  created_at: string;
  class: { id: string; name: string };
  submissions?: Array<{
    id: string;
    status: string;
    ai_score: number | null;
    ai_feedback: string | null;
    teacher_score: number | null;
    attempt_number: number;
    created_at: string;
  }>;
}

interface SubmissionWithDetails {
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
  assignment: {
    id: string;
    title: string;
    class: { id: string; name: string };
  };
}

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignments, setAssignments] = useState<AssignmentWithClass[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showJoinClass, setShowJoinClass] = useState(false);
  const [showAssignmentDetail, setShowAssignmentDetail] =
    useState<AssignmentWithClass | null>(null);
  const [classCode, setClassCode] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);

      if (!currentUser) {
        router.push("/login");
        return;
      }

      // Check user role
      const { data: userProfile } = await supabase
        .from("users")
        .select("role")
        .eq("id", currentUser.id)
        .single();

      if (!userProfile || userProfile.role !== "student") {
        router.push("/");
        return;
      }

      // Load classes
      const classesData = await getStudentClasses(currentUser.id);
      if (!classesData) {
        console.error("Error loading classes:");
      }
      console.log(classesData);
      if (classesData) {
        // Transform data to match ClassWithDetails interface

        // const transformedClasses: ClassWithDetails[] = classesData.map(
        //   (item: {
        //     id: string;
        //     class_id: string;
        //     user_id: string;
        //     created_at: string;
        //     class:
        //       | {
        //           id: string;
        //           name: string;
        //           class_code: string;
        //           teacher_id: string;
        //           created_at: string;
        //         }
        //       | Array<{
        //           id: string;
        //           name: string;
        //           class_code: string;
        //           teacher_id: string;
        //           created_at: string;
        //         }>;
        //   }) => ({
        //     id: item.id,
        //     class_id: item.class_id,
        //     user_id: item.user_id,
        //     created_at: item.created_at,
        //     class: Array.isArray(item.class) ? item.class[0] : item.class,
        //   })
        // );
        setClasses(classesData);
      }

      // Load assignments
      const { data: assignmentsData, error: assignmentsError } =
        await getStudentAssignments(currentUser.id);
      if (assignmentsError) {
        console.error("Error loading assignments:", assignmentsError);
      }

      // Load submission attempts for each assignment and attach them
      if (assignmentsData && assignmentsData.length > 0) {
        const assignmentsWithSubmissions = await Promise.all(
          assignmentsData.map(async (assignment) => {
            const { data: attempts } = await getStudentSubmissionAttempts(
              assignment.id,
              currentUser.id
            );
            return {
              ...assignment,
              submissions: (attempts || []).sort(
                (a, b) => b.attempt_number - a.attempt_number
              ),
            };
          })
        );
        setAssignments(assignmentsWithSubmissions);
      } else if (assignmentsData) {
        setAssignments(assignmentsData);
      }

      // Load all submissions for recent feedback display
      const { data: submissionsData, error: submissionsError } =
        await getStudentSubmissions(currentUser.id);
      if (submissionsError) {
        console.error("Error loading submissions:", submissionsError);
      }
      if (submissionsData) setSubmissions(submissionsData);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinClass(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !classCode.trim()) return;

    const { error } = await joinClassByCode(classCode.trim(), user.id);
    if (error) {
      alert("Error joining class: " + error.message);
      return;
    }

    setClassCode("");
    setShowJoinClass(false);
    loadDashboard(); // Reload to get updated classes
  }

  async function handleSubmitAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !showAssignmentDetail || !selectedFile) return;

    setUploading(true);
    try {
      // Upload image
      const { data: uploadData, error: uploadError } =
        await uploadSubmissionImage(
          selectedFile,
          showAssignmentDetail.id,
          user.id
        );

      if (uploadError || !uploadData) {
        alert("Error uploading file: " + uploadError?.message);
        setUploading(false);
        return;
      }

      // Create submission with file_path
      const { data: submissionData, error: createError } =
        await createSubmission(
          showAssignmentDetail.id,
          user.id,
          uploadData.file_path
        );

      if (createError || !submissionData) {
        alert("Error creating submission: " + createError?.message);
        setUploading(false);
        return;
      }

      // Grade submission using AI pipeline
      try {
        const config: GradingConfig = {
          answerKey: showAssignmentDetail.answer_key || undefined,
          rubric: showAssignmentDetail.rubric || undefined,
          assignmentId: showAssignmentDetail.id,
          assignmentTitle: showAssignmentDetail.title,
        };

        const gradingResult = await gradeSubmission(
          uploadData.publicUrl,
          config
        );

        // Update submission with grading results
        await updateSubmissionGrading(
          submissionData.id,
          gradingResult.score,
          gradingResult.feedback
        );
      } catch (gradingError) {
        console.error("Error during AI grading:", gradingError);
        // Submission created, grading will happen later or manually
      }

      setSelectedFile(null);
      setShowAssignmentDetail(null);
      loadDashboard(); // Reload to get updated submissions
    } catch (error) {
      alert("Error: " + (error as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handleSignOut() {
    supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-200">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const activeClasses = classes.length;
  const pendingAssignments = assignments.filter((a) => {
    const submission = a.submissions?.[0];
    return (
      !submission ||
      (submission.status !== "graded" && submission.status !== "grading")
    );
  }).length;
  const completedAssignments = assignments.filter((a) => {
    const submission = a.submissions?.[0];
    return (
      submission &&
      (submission.status === "graded" || submission.status === "grading")
    );
  }).length;

  // Calculate average score from graded submissions
  const gradedSubmissions = submissions.filter(
    (s) =>
      s.status === "graded" && (s.ai_score !== null || s.teacher_score !== null)
  );
  const averageScore =
    gradedSubmissions.length > 0
      ? Math.round(
          gradedSubmissions.reduce((sum, s) => {
            const score = s.teacher_score ?? s.ai_score ?? 0;
            return sum + score;
          }, 0) / gradedSubmissions.length
        )
      : 0;

  // Calculate completion streak (days in a row with at least one submission)
  const sortedSubmissions = [...submissions]
    .filter((s) => s.status === "graded" || s.status === "grading")
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  let streak = 0;
  if (sortedSubmissions.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let currentCheckDate = new Date(today);
    for (const sub of sortedSubmissions) {
      const subDate = new Date(sub.created_at);
      subDate.setHours(0, 0, 0, 0);

      if (subDate.getTime() === currentCheckDate.getTime()) {
        streak++;
        currentCheckDate = new Date(currentCheckDate);
        currentCheckDate.setDate(currentCheckDate.getDate() - 1);
      } else if (subDate.getTime() < currentCheckDate.getTime()) {
        break;
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200">
      <nav className="bg-white shadow-md px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-extrabold text-indigo-600">
          🎒 Student Dashboard
        </h1>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 text-gray-500 hover:cursor-pointer bg-gray-200 hover:bg-gray-300 rounded-xl transition"
        >
          Sign Out
        </button>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-3xl mb-2">📚</div>
            <div className="text-3xl font-bold text-blue-600">
              {activeClasses}
            </div>
            <div className="text-gray-600">Active Classes</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-3xl mb-2">⭐</div>
            <div className="text-3xl font-bold text-purple-600">
              {averageScore}%
            </div>
            <div className="text-gray-600">Average Score</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-3xl mb-2">🔥</div>
            <div className="text-3xl font-bold text-orange-600">{streak}</div>
            <div className="text-gray-600">Day Streak</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-3xl mb-2">✅</div>
            <div className="text-3xl font-bold text-green-600">
              {completedAssignments}
            </div>
            <div className="text-gray-600">Completed</div>
          </div>
        </div>

        {/* Classes Panel */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">My Classes</h2>
            <button
              onClick={() => setShowJoinClass(true)}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition"
            >
              + Join Class
            </button>
          </div>

          {classes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                You&apos;re not enrolled in any classes yet.
              </p>
              <p className="text-gray-600">
                Join a class with a class code to get started! 🚀
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes?.map((cls: Class) => (
                <div
                  key={cls?.id ?? Math.random()} // fallback if id is missing
                  className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-400 transition"
                >
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {cls?.name ?? "No name"}
                  </h3>
                  <div className="text-sm text-gray-500">
                    Code:{" "}
                    <code className="bg-gray-100 px-2 py-1 rounded font-mono">
                      {cls?.class_code ?? "No code"}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assignments */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Assignments</h2>
          {assignments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                No assignments yet. Join a class to see assignments!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => {
                // Get the latest submission (submissions are ordered by attempt_number desc)
                const latestSubmission = assignment.submissions?.[0];
                const hasSubmission =
                  latestSubmission &&
                  (latestSubmission.status === "graded" ||
                    latestSubmission.status === "grading");
                const isOverdue = new Date(assignment.due_date) < new Date();

                return (
                  <div
                    key={assignment.id}
                    className={`border-2 rounded-xl p-4 ${
                      hasSubmission
                        ? "border-green-300 bg-green-50"
                        : isOverdue
                        ? "border-orange-300 bg-orange-50"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800">
                          {assignment.title}
                        </h3>
                        <p className="text-gray-600 mt-1">
                          {assignment.class.name}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Due:{" "}
                          {new Date(assignment.due_date).toLocaleDateString()}
                        </p>
                        {hasSubmission && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-blue-600">
                                Latest Score:{" "}
                                {(latestSubmission.ai_score ??
                                  latestSubmission.teacher_score) ||
                                  "—"}
                                %
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Submitted:{" "}
                              {new Date(
                                latestSubmission.created_at
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setShowAssignmentDetail(assignment)}
                        className={`px-4 py-2 rounded-xl font-semibold transition ${
                          hasSubmission
                            ? "bg-blue-500 hover:bg-blue-600 text-white"
                            : "bg-green-500 hover:bg-green-600 text-white"
                        }`}
                      >
                        {hasSubmission ? "View/Resubmit" : "Submit"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Submissions with AI Feedback */}
        {submissions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Recent Feedback
            </h2>
            <div className="space-y-4">
              {submissions.slice(0, 5).map((submission) => (
                <div
                  key={submission.id}
                  className="border-2 border-gray-200 rounded-xl p-4 bg-blue-50"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">
                        {submission.assignment.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {submission.assignment.class.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {submission.ai_score}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(submission.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      AI Feedback:
                    </p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {submission.ai_feedback}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Join Class Modal */}
      {showJoinClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Join a Class
            </h2>
            <form onSubmit={handleJoinClass}>
              <input
                type="text"
                placeholder="Enter Class Code"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-xl border bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-400 outline-none mb-4 font-mono text-center text-xl"
                required
                maxLength={6}
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition"
                >
                  Join Class
                </button>
                <button
                  type="button"
                  onClick={() => setShowJoinClass(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignment Detail/Submit Modal */}
      {showAssignmentDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-2xl w-full my-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {showAssignmentDetail.title}
            </h2>
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                <strong>Class:</strong> {showAssignmentDetail.class.name}
              </p>
              <p className="text-gray-600 mb-2">
                <strong>Due Date:</strong>{" "}
                {new Date(showAssignmentDetail.due_date).toLocaleString()}
              </p>
              <div className="bg-gray-50 rounded-xl p-4 mt-4">
                <p className="text-sm font-semibold text-gray-700 mb-1">
                  Description:
                </p>
                <p className="text-gray-600 whitespace-pre-wrap">
                  {showAssignmentDetail.description ||
                    "No description provided."}
                </p>
              </div>
            </div>

            {showAssignmentDetail.submissions &&
              showAssignmentDetail.submissions.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">
                    Your Submission History
                  </h3>
                  <div className="space-y-3">
                    {showAssignmentDetail.submissions.map(
                      (
                        submission: {
                          id: string;
                          status: string;
                          ai_score: number | null;
                          ai_feedback: string | null;
                          teacher_score: number | null;
                          attempt_number: number;
                          created_at: string;
                        },
                        index: number
                      ) => (
                        <div
                          key={submission.id}
                          className={`bg-blue-50 rounded-xl p-4 border-2 ${
                            index === 0 ? "border-blue-400" : "border-gray-200"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-700">
                                Attempt #{submission.attempt_number}
                                {index === 0 && (
                                  <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded">
                                    Latest
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(
                                  submission.created_at
                                ).toLocaleString()}
                              </span>
                            </div>
                            <span className="text-2xl font-bold text-blue-600">
                              {submission.teacher_score ??
                                submission.ai_score ??
                                "—"}
                              %
                            </span>
                          </div>
                          {submission.ai_feedback && (
                            <div className="bg-white rounded-lg p-3 mt-2">
                              <p className="text-sm font-semibold text-gray-700 mb-1">
                                AI Feedback:
                              </p>
                              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                                {submission.ai_feedback}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 mt-3">
                    <p className="text-sm text-gray-700">
                      <strong>✨ Keep improving!</strong> You can submit again
                      anytime to improve your score. Each attempt helps you
                      learn more!
                    </p>
                  </div>
                </div>
              )}

            <div className="border-t-2 border-gray-200 pt-4 mt-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">
                {showAssignmentDetail.submissions &&
                showAssignmentDetail.submissions.length > 0
                  ? `Submit Attempt #${
                      showAssignmentDetail.submissions.length + 1
                    }:`
                  : "Submit Your Work:"}
              </p>
              <form onSubmit={handleSubmitAssignment}>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Upload Your Homework Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setSelectedFile(e.target.files?.[0] || null)
                    }
                    className="w-full px-4 py-3 rounded-xl border bg-white text-gray-800 focus:ring-2 focus:ring-indigo-400 outline-none"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Unlimited resubmissions allowed! Each attempt helps you
                    improve.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={!selectedFile || uploading}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-3 rounded-xl transition"
                >
                  {uploading
                    ? "Uploading & Grading..."
                    : showAssignmentDetail.submissions &&
                      showAssignmentDetail.submissions.length > 0
                    ? "Submit New Attempt"
                    : "Submit Assignment"}
                </button>
              </form>
            </div>

            <button
              onClick={() => {
                setShowAssignmentDetail(null);
                setSelectedFile(null);
              }}
              className="mt-4 w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
