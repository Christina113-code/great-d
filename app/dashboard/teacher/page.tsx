"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  getTeacherClasses,
  createClass,
  getClassMembers,
} from "@/lib/supabase/queries/classes";
import {
  createAssignment,
  getTeacherAssignments,
} from "@/lib/supabase/queries/assignments";
import {
  getSubmissionsForAssignment,
  updateTeacherReview,
} from "@/lib/supabase/queries/submissions";
import { getSubmissionImageUrl } from "@/lib/supabase/storage";
import { Assignment, Class, Submission } from "@/lib/types";

export default function TeacherDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null);
  const [teacherScore, setTeacherScore] = useState("");
  const [teacherComment, setTeacherComment] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [selectedClassForAssignment, setSelectedClassForAssignment] =
    useState("");
  const [newAssignmentTitle, setNewAssignmentTitle] = useState("");
  const [newAssignmentDescription, setNewAssignmentDescription] = useState("");
  const [newAssignmentDueDate, setNewAssignmentDueDate] = useState("");
  const [isImageOpen, setIsImageOpen] = useState(false);

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDashboard() {
    try {
      // Small delay to allow Supabase session hydration
      await new Promise((resolve) => setTimeout(resolve, 40));

      // 1. Get current user
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      console.log(currentUser);
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

      if (!userProfile || userProfile.role !== "teacher") {
        router.push("/");
        return;
      }

      setUser(currentUser);

      // 2. Load teacher classes with members
      const { data: classesData, error: classesError } =
        await getTeacherClasses(currentUser.id);

      if (classesError) {
        console.error("Error loading classes:", classesError);
      }

      if (!classesData || classesData.length === 0) {
        setClasses([]);
        setAssignments([]);
        setSubmissions([]);
        return;
      }

      // Load members for each class
      const classesWithMembers = await Promise.all(
        classesData.map(async (classItem) => {
          const { data: members } = await getClassMembers(classItem.id);
          return {
            ...classItem,
            class_members: members || [],
          };
        })
      );
      setClasses(classesWithMembers);

      // 3. Load assignments for all classes
      const { data: assignmentsData, error: assignmentsError } =
        await getTeacherAssignments(currentUser.id);
      if (assignmentsError) {
        console.error("Error loading assignments:", assignmentsError);
      }

      // Load submissions for each assignment
      const allAssignments: Assignment[] = [];
      const allSubmissions: Submission[] = [];

      if (assignmentsData) {
        for (const assignment of assignmentsData) {
          const { data: submissionsData, error: subsError } =
            await getSubmissionsForAssignment(assignment.id);
          if (subsError) {
            console.error("Error loading submissions:", subsError);
          }
          console.log("Submissions data:", submissionsData);
          const submissionsList = submissionsData || [];

          // Add assignment with class info and submission count
          allAssignments.push({
            ...assignment,
            submissions: submissionsList.map((s) => ({
              id: s.id,
              status: s.status,
              ai_score: s.ai_score || null,
            })),
          });

          // Add submissions enriched with assignment + class info
          allSubmissions.push(
            ...submissionsList.map(
              (s): Submission => ({
                ...s,
                assignment: assignment.class
                  ? {
                      id: assignment.id,
                      title: assignment.title,
                      class: assignment.class,
                    }
                  : {
                      id: assignment.id,
                      title: assignment.title,
                      class: { id: assignment.class_id, name: "" },
                    },
              })
            )
          );
        }
      }

      setAssignments(allAssignments);
      setSubmissions(allSubmissions);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newClassName.trim()) return;

    const { data, error } = await createClass(newClassName, user.id);
    if (error) {
      alert("Error creating class: " + error.message);
      return;
    }

    setClasses([data, ...classes]);
    setNewClassName("");
    setShowCreateClass(false);
  }

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClassForAssignment || !newAssignmentTitle.trim() || !user)
      return;

    const { data, error } = await createAssignment(
      selectedClassForAssignment,
      user.id,
      newAssignmentTitle,
      newAssignmentDescription,
      newAssignmentDueDate
    );

    if (error) {
      alert("Error creating assignment: " + error.message);
      return;
    }

    const classInfo = classes.find((c) => c.id === selectedClassForAssignment);
    setAssignments([
      {
        ...data,
        class: { id: selectedClassForAssignment, name: classInfo?.name || "" },
        submissions: [],
      },
      ...assignments,
    ]);
    setNewAssignmentTitle("");
    setNewAssignmentDescription("");
    setNewAssignmentDueDate("");
    setSelectedClassForAssignment("");
    setShowCreateAssignment(false);
  }

  function copyClassCode(code: string) {
    navigator.clipboard.writeText(code);
    alert("Class code copied!");
  }

  function handleSignOut() {
    supabase.auth.signOut();
    router.push("/login");
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSubmission) return;

    setReviewing(true);
    try {
      const { error } = await updateTeacherReview(
        selectedSubmission.id,
        teacherScore ? parseFloat(teacherScore) : null,
        teacherComment || null
      );

      if (error) {
        alert("Error submitting review: " + error.message);
        setReviewing(false);
        return;
      }

      // Reload dashboard to show updated submission
      loadDashboard();
      setSelectedSubmission(null);
      setTeacherScore("");
      setTeacherComment("");
    } catch (error) {
      alert("Error: " + (error as Error).message);
    } finally {
      setReviewing(false);
    }
  }

  async function handleOpenReview(submission: Submission) {
    console.log("Submission:", submission);
    setSelectedSubmission(submission);
    setTeacherScore(submission.teacher_score?.toString() || "");
    setTeacherComment(submission.teacher_feedback || "");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-100 to-blue-200">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const totalStudents = classes.reduce(
    (sum, c) => sum + (c.class_members?.length || 0),
    0
  );

  // Calculate average scores
  const gradedSubmissions = submissions.filter(
    (s) =>
      s.status === "graded" &&
      (s.teacher_score !== null ||
        (s.ai_score !== null && s.ai_score !== undefined))
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

  // Count late submissions (submitted after due date)
  const lateSubmissions = submissions.filter((s) => {
    const assignment = assignments.find((a) => a.id === s.assignment.id);
    if (!assignment) return false;
    return new Date(s.created_at) > new Date(assignment.due_date);
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 to-blue-200">
      <nav className="bg-white shadow-md px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-extrabold text-blue-600">
          🍎 Teacher Dashboard
        </h1>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 bg-gray-300 text-white hover:bg-gray-300 rounded-xl transition"
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
              {classes.length}
            </div>
            <div className="text-gray-600">Total Classes</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-3xl mb-2">👥</div>
            <div className="text-3xl font-bold text-green-600">
              {totalStudents}
            </div>
            <div className="text-gray-600">Total Students</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-3xl mb-2">⭐</div>
            <div className="text-3xl font-bold text-purple-600">
              {averageScore}%
            </div>
            <div className="text-gray-600">Average Score</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-3xl mb-2">⏰</div>
            <div className="text-3xl font-bold text-orange-600">
              {lateSubmissions}
            </div>
            <div className="text-gray-600">Late Submissions</div>
          </div>
        </div>

        {/* Classes Panel */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Classes</h2>
            <button
              onClick={() => setShowCreateClass(true)}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition"
            >
              + Create Class
            </button>
          </div>

          {classes.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No classes yet. Create your first class to get started!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((classItem) => (
                <div
                  key={classItem.id}
                  className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-400 transition"
                >
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {classItem.name}
                  </h3>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-600">Code:</span>
                    <code className="bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono text-sm">
                      {classItem.class_code}
                    </code>
                    <button
                      onClick={() => copyClassCode(classItem.class_code)}
                      className="text-blue-500 hover:text-blue-600 text-sm"
                    >
                      📋
                    </button>
                  </div>
                  <div className="text-sm text-gray-500">
                    {classItem.class_members?.length || 0} students
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assignments */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Assignments</h2>
            <button
              onClick={() => setShowCreateAssignment(true)}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition"
            >
              + Create Assignment
            </button>
          </div>

          {assignments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No assignments yet. Create your first assignment!
            </p>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="border-2 border-gray-200 rounded-xl p-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
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
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {assignment.submissions?.length || 0}
                      </div>
                      <div className="text-sm text-gray-600">Submissions</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submissions Table */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Recent Submissions
          </h2>
          {submissions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No submissions yet. Students will appear here when they submit
              assignments.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Student
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Assignment
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      AI Score
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Submitted
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission) => (
                    <tr
                      key={submission.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 text-gray-600">
                        {submission.student.name}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        <div className="font-semibold">
                          {submission.assignment.title}
                        </div>
                        <div className="text-sm text-gray-500">
                          {submission.assignment.class.name}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        <span
                          className={`px-2 py-1 rounded text-sm ${
                            submission.status === "graded"
                              ? "bg-green-100 text-green-800"
                              : submission.status === "grading"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {submission.status === "graded"
                            ? "Graded"
                            : submission.status === "grading"
                            ? "Grading..."
                            : submission.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-600">
                        {submission.teacher_score !== null ? (
                          <div>
                            <div className="text-purple-600">
                              {submission.teacher_score}%
                            </div>
                            {submission.ai_score !== null && (
                              <div className="text-xs text-gray-400 line-through">
                                {submission.ai_score}%
                              </div>
                            )}
                            <span className="ml-1 text-xs text-purple-600">
                              (Override)
                            </span>
                          </div>
                        ) : (
                          submission.ai_score || "—"
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(submission.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleOpenReview(submission)}
                          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AI Configuration */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">
              AI Grading Configuration
            </h2>
            <button
              onClick={() => setShowAiConfig(true)}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-semibold transition"
            >
              Configure AI
            </button>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-gray-700 mb-2">
              <strong>How AI Grading Works:</strong>
            </p>
            <p className="text-sm text-gray-600">
              Our AI analyzes student submissions by comparing them against
              answer keys and grading rubrics you provide. It evaluates
              accuracy, methodology, and completeness, providing detailed
              feedback to help students learn and improve. Upload answer keys
              and rubrics for each assignment to enable AI grading.
            </p>
          </div>
        </div>
      </div>

      {/* Create Class Modal */}
      {showCreateClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Create New Class
            </h2>
            <form onSubmit={handleCreateClass}>
              <input
                type="text"
                placeholder="Class Name"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-400 outline-none mb-4"
                required
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateClass(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Assignment Modal */}
      {showCreateAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Create New Assignment
            </h2>
            <form onSubmit={handleCreateAssignment}>
              <select
                value={selectedClassForAssignment}
                onChange={(e) => setSelectedClassForAssignment(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border bg-white text-gray-800 focus:ring-2 focus:ring-indigo-400 outline-none mb-4"
                required
              >
                <option value="">Select a class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Assignment Title"
                value={newAssignmentTitle}
                onChange={(e) => setNewAssignmentTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-400 outline-none mb-4"
                required
              />
              <textarea
                placeholder="Description"
                value={newAssignmentDescription}
                onChange={(e) => setNewAssignmentDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-400 outline-none mb-4"
                rows={3}
              />
              <input
                type="datetime-local"
                value={newAssignmentDueDate}
                onChange={(e) => setNewAssignmentDueDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border bg-white text-gray-800 focus:ring-2 focus:ring-indigo-400 outline-none mb-4"
                required
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateAssignment(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Configuration Modal */}
      {showAiConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              AI Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Upload Answer Key
                </label>
                <input
                  type="file"
                  className="w-full px-4 py-3 rounded-xl border bg-white text-gray-800 focus:ring-2 focus:ring-indigo-400 outline-none"
                  accept=".pdf,.doc,.docx,.txt"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Upload Grading Rubric
                </label>
                <input
                  type="file"
                  className="w-full px-4 py-3 rounded-xl border bg-white text-gray-800 focus:ring-2 focus:ring-indigo-400 outline-none"
                  accept=".pdf,.doc,.docx,.txt"
                />
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-gray-700">
                  <strong>Note:</strong> Upload answer keys and rubrics when
                  creating assignments. The AI will use these to grade student
                  submissions.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAiConfig(false)}
              className="mt-6 w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Submission Review Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-3xl w-full my-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Review Submission
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">
                  <strong>Student:</strong> {selectedSubmission.student.name}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Assignment:</strong>{" "}
                  {selectedSubmission.assignment.title}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Class:</strong>{" "}
                  {selectedSubmission.assignment.class.name}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Submitted:</strong>{" "}
                  {new Date(selectedSubmission.created_at).toLocaleString()}
                </p>
              </div>

              {/* Submission Image */}
              {selectedSubmission.file_path && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Submission Image:
                  </p>

                  {/* Fixed-height preview container */}
                  <div className="relative h-64 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getSubmissionImageUrl(selectedSubmission.file_path)}
                      alt="Student submission"
                      className="h-full w-full cursor-zoom-in object-contain"
                      onClick={() => setIsImageOpen(true)}
                    />

                    <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
                      Click to expand
                    </div>
                  </div>
                </div>
              )}
              {/* Image Modal */}
              {isImageOpen && selectedSubmission?.file_path && (
                <div
                  className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
                  onClick={() => setIsImageOpen(false)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getSubmissionImageUrl(selectedSubmission.file_path)}
                    alt="Expanded submission"
                    className="max-h-[90vh] max-w-[90vw] object-contain"
                  />
                </div>
              )}

              {/* AI Score & Feedback */}
              {selectedSubmission.ai_score !== null && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-semibold text-gray-700">
                      AI Score
                    </span>
                    <span className="text-2xl font-bold text-blue-600">
                      {selectedSubmission.ai_score}%
                    </span>
                  </div>
                  {selectedSubmission.ai_feedback && (
                    <div className="bg-white rounded-lg p-3 mt-3">
                      <p className="text-sm font-semibold text-gray-700 mb-1">
                        AI Feedback:
                      </p>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">
                        {selectedSubmission.ai_feedback}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Teacher Override Section */}
              <div className="border-t-2 border-gray-200 pt-4">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Teacher Review & Override
                </h3>
                <form onSubmit={handleSubmitReview}>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Manual Score Override (0-100)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={teacherScore}
                      onChange={(e) => setTeacherScore(e.target.value)}
                      placeholder="Leave empty to use AI score"
                      className="w-full px-4 py-3 rounded-xl border bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Override AI score with your own assessment. Original AI
                      score will still be visible.
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Teacher Comment
                    </label>
                    <textarea
                      value={teacherComment}
                      onChange={(e) => setTeacherComment(e.target.value)}
                      placeholder="Add additional feedback or notes..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 outline-none"
                    />
                  </div>

                  {selectedSubmission.teacher_score !== null && (
                    <div className="bg-purple-50 rounded-lg p-3 mb-4">
                      <p className="text-sm text-gray-700">
                        <strong>⚠️ Override Active:</strong> This submission has
                        been manually reviewed.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={reviewing}
                      className="flex-1 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white font-bold py-3 rounded-xl transition"
                    >
                      {reviewing ? "Saving..." : "Save Review"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubmission(null);
                        setTeacherScore("");
                        setTeacherComment("");
                      }}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-xl transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
