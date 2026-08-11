import { useCallback, useEffect, useState } from "react";
import { ROLE_LABELS, User } from "./auth";
import LoginPage from "./pages/LoginPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import StatusPage from "./pages/StatusPage";
import EmployeesPage from "./pages/EmployeesPage";
import HolidaysPage from "./pages/HolidaysPage";
import UsersPage from "./pages/UsersPage";
import QuestionsPage from "./pages/QuestionsPage";
import SelectionPage from "./pages/SelectionPage";
import MyExamsPage from "./pages/MyExamsPage";

type Tab = "Employees" | "Holidays" | "Users" | "Question bank" | "Selection" | "System status" | "My exams";

function tabsForRole(role: User["role"]): Tab[] {
  switch (role) {
    case "hr_admin":     return ["Selection", "Employees", "Holidays", "Users", "Question bank", "System status"];
    case "qa":           return ["Selection", "Employees", "Holidays", "Users", "Question bank", "System status"];
    case "c_level":      return ["Question bank", "Selection", "Employees", "Holidays"];
    case "dept_manager": return ["Question bank", "My exams", "Holidays"];
    default:              return ["My exams", "Holidays"];
  }
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading
  const [tab, setTab] = useState<Tab | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/me")
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(b => {
        setUser(b.user);
        setTab(t => t ?? tabsForRole(b.user.role)[0]);
      })
      .catch(() => setUser(null));
  }, []);
  useEffect(refresh, [refresh]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setTab(null);
  }

  if (user === undefined) return <main><p className="pending">Loading…</p></main>;
  if (user === null) return <main><LoginPage onLoggedIn={refresh} /></main>;
  if (user.mustChangePassword) {
    return <main><ChangePasswordPage onChanged={() => { setUser(null); setTab(null); }} /></main>;
  }

  const tabs = tabsForRole(user.role);
  const active = tab && tabs.includes(tab) ? tab : tabs[0];
  const readOnly = user.role === "qa";

  return (
    <main>
      <header className="row spread">
        <div>
          <h1>SOP Compliance Exam Management System</h1>
          <p className="sub">
            {user.fullName} · {ROLE_LABELS[user.role]}{readOnly && " · read-only"}
          </p>
        </div>
        <button className="ghost" onClick={logout}>Sign out</button>
      </header>
      <nav className="tabs">
        {tabs.map(t => (
          <button key={t} className={t === active ? "active" : ""} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      {active === "Employees" && <EmployeesPage readOnly={readOnly || user.role === "c_level"} />}
      {active === "Holidays" && <HolidaysPage readOnly={user.role !== "hr_admin"} />}
      {active === "Users" && <UsersPage me={user} readOnly={readOnly} />}
      {active === "Question bank" && <QuestionsPage me={user} />}
      {active === "Selection" && <SelectionPage readOnly={user.role !== "hr_admin"} />}
      {active === "System status" && <StatusPage />}
      {active === "My exams" && <MyExamsPage />}
    </main>
  );
}
