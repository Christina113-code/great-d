export type Assignment = {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  due_date: string;
  rubric: string | null;
  answer_key: string | null;
  created_at: string;
};

export type ClassMember = {
  user_id: string;
  class_id: string;
};
export type Class = {
  id: string;
  teacher_id: string;
  name: string;
  class_code: string;
  created_at: string;
};

export type SubmissionAttempt = {
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
};
export type Submission = {
  id: string;
  assignment_id: string;
  student_id: string;
  file_path: string | null;
  attempt_number: number;
  status: string;
  ai_score: number | null;
  ai_feedback: string | null;
  teacher_score: number | null;
  teacher_feedback: string | null;
  graded_at: string | null; // ISO date string
  created_at: string; // ISO date string

  // Nested objects
  student: {
    id: string;
    name: string;
  };
  assignment: {
    id: string;
    title: string;
    class: {
      id: string;
      name: string;
    };
  };
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: "student" | "teacher";
  created_at: string;
};
