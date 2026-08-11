import { useState } from "react";
import StatusPage from "./pages/StatusPage";
import EmployeesPage from "./pages/EmployeesPage";
import HolidaysPage from "./pages/HolidaysPage";

const TABS = ["Employees", "Holidays", "System status"] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [tab, setTab] = useState<Tab>("Employees");
  return (
    <main>
      <h1>SOP Compliance Exam Management System</h1>
      <p className="sub">Morepen R&amp;D · Module 2 — data foundation (login &amp; roles arrive in Module 3)</p>
      <nav className="tabs">
        {TABS.map(t => (
          <button key={t} className={t === tab ? "active" : ""} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      {tab === "Employees" && <EmployeesPage />}
      {tab === "Holidays" && <HolidaysPage />}
      {tab === "System status" && <StatusPage />}
    </main>
  );
}
