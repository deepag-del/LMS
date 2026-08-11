import ExcelJS from "exceljs";

// Parses an HR roster .xlsx into clean rows, tolerating varied column headings
// ("Emp Code" / "Employee ID", "DOJ" / "Date of Joining", etc.).
// Unknown departments are NOT auto-created — that's a row error, because a typo'd
// department would silently split the question bank.

export type RosterRow = {
  rowNumber: number;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
  designation: string | null;
  managerEmail: string | null;
  dateOfJoining: string | null; // YYYY-MM-DD
};

export type RosterParse = {
  rows: RosterRow[];
  errors: { rowNumber: number; message: string }[];
};

const HEADER_MAP: Record<string, keyof Omit<RosterRow, "rowNumber">> = {
  employeecode: "employeeCode", empcode: "employeeCode", empid: "employeeCode",
  employeeid: "employeeCode", code: "employeeCode",
  name: "fullName", fullname: "fullName", employeename: "fullName",
  email: "email", emailid: "email", officialemail: "email", emailaddress: "email",
  department: "department", dept: "department",
  designation: "designation", role: "designation", title: "designation",
  manageremail: "managerEmail", reportingmanageremail: "managerEmail",
  reportingmanager: "managerEmail", manager: "managerEmail",
  dateofjoining: "dateOfJoining", doj: "dateOfJoining", joiningdate: "dateOfJoining",
};

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    // formula results / rich text / hyperlinked emails
    const o = v as { result?: unknown; text?: string; hyperlink?: string };
    if (o.text) return String(o.text).trim();
    if (o.result != null) return String(o.result).trim();
    return "";
  }
  return String(v).trim();
}

function toIsoDate(s: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); // DD/MM/YYYY (Indian convention)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function parseRoster(buffer: Buffer): Promise<RosterParse> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], errors: [{ rowNumber: 0, message: "Workbook has no sheets" }] };

  // Map headers from row 1
  const colFor = new Map<number, keyof Omit<RosterRow, "rowNumber">>();
  ws.getRow(1).eachCell((cell, col) => {
    const key = HEADER_MAP[normalize(cellText(cell))];
    if (key) colFor.set(col, key);
  });

  const mapped = new Set(colFor.values());
  const missing = (["employeeCode", "fullName", "email", "department"] as const)
    .filter(k => !mapped.has(k));
  if (missing.length) {
    return {
      rows: [],
      errors: [{
        rowNumber: 1,
        message: `Missing required column(s): ${missing.join(", ")}. ` +
          "Expected headers like: Employee Code, Name, Email, Department (see roster template).",
      }],
    };
  }

  const rows: RosterRow[] = [];
  const errors: RosterParse["errors"] = [];
  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const r: Partial<RosterRow> = { rowNumber };
    for (const [col, key] of colFor) {
      const text = cellText(row.getCell(col));
      if (key === "dateOfJoining") r.dateOfJoining = toIsoDate(text);
      else (r as Record<string, unknown>)[key] = text || null;
    }
    if (!r.employeeCode && !r.fullName && !r.email) return; // fully blank row

    if (!r.employeeCode) return errors.push({ rowNumber, message: "Employee code is empty" });
    if (!r.fullName) return errors.push({ rowNumber, message: "Name is empty" });
    if (!r.email || !EMAIL_RE.test(r.email)) {
      return errors.push({ rowNumber, message: `Invalid or missing email: "${r.email ?? ""}"` });
    }
    if (!r.department) return errors.push({ rowNumber, message: "Department is empty" });
    if (r.managerEmail && !EMAIL_RE.test(r.managerEmail)) {
      return errors.push({ rowNumber, message: `Invalid manager email: "${r.managerEmail}"` });
    }
    const codeKey = r.employeeCode.toLowerCase();
    const emailKey = r.email.toLowerCase();
    if (seenCodes.has(codeKey)) {
      return errors.push({ rowNumber, message: `Duplicate employee code in file: ${r.employeeCode}` });
    }
    if (seenEmails.has(emailKey)) {
      return errors.push({ rowNumber, message: `Duplicate email in file: ${r.email}` });
    }
    seenCodes.add(codeKey);
    seenEmails.add(emailKey);
    rows.push({
      rowNumber,
      employeeCode: r.employeeCode,
      fullName: r.fullName,
      email: r.email,
      department: r.department,
      designation: r.designation ?? null,
      managerEmail: r.managerEmail ?? null,
      dateOfJoining: r.dateOfJoining ?? null,
    });
  });

  return { rows, errors };
}
