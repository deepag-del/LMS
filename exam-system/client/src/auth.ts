export type User = {
  id: number;
  email: string;
  fullName: string;
  role: "employee" | "manager" | "dept_manager" | "c_level" | "hr_admin" | "qa";
  mustChangePassword: boolean;
};

export const ROLE_LABELS: Record<User["role"], string> = {
  employee: "Employee",
  manager: "Manager",
  dept_manager: "Dept manager (question author)",
  c_level: "C-level",
  hr_admin: "HR / Admin",
  qa: "QA (read-only)",
};
