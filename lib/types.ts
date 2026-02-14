export type Assignment = {
  id: string;
  title: string;
  description: string;
  due_date: string; // ISO date
  rubric: string | null;
  answer_key: string | null;
  created_at: string; // ISO date
  teacher_id: string;
  class_id: string;
  class: {
    id: string;
    name: string;
  };
  submissions: Submission[]; // reuse the Submission type you already defined
};

export type ClassMember = {
  user_id: string;
  class_id: string;
};
export type Class = {
  id: string;
  name: string;
  teacher_id: string;
  class_code: string;
  class_members: ClassMember[]; // array of user IDs
  created_at: string;
  answer_key: string | null;
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
