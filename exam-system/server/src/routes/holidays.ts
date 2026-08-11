import { Router } from "express";
import { pool } from "../db";
import { audit } from "../lib/audit";
import { requireRole } from "../lib/auth";

export const holidays = Router();

holidays.get("/api/holidays", async (req, res) => {
  const year = Number(req.query.year) || null;
  const r = year
    ? await pool!.query(
        "SELECT id, holiday_date::text, name FROM holidays WHERE date_part('year', holiday_date) = $1 ORDER BY holiday_date",
        [year]
      )
    : await pool!.query("SELECT id, holiday_date::text, name FROM holidays ORDER BY holiday_date");
  res.json(r.rows);
});

holidays.post("/api/holidays", requireRole("hr_admin"), async (req, res) => {
  const { date, name } = req.body ?? {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !name?.trim()) {
    return res.status(400).json({ ok: false, detail: "Provide {date: 'YYYY-MM-DD', name: '…'}" });
  }
  try {
    const r = await pool!.query(
      "INSERT INTO holidays (holiday_date, name) VALUES ($1, $2) RETURNING id, holiday_date::text, name",
      [date, name.trim()]
    );
    await audit("holiday.added", "holiday", String(r.rows[0].id), { date, name: name.trim() });
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return res.status(409).json({ ok: false, detail: `A holiday already exists on ${date}` });
    }
    throw e;
  }
});

holidays.delete("/api/holidays/:id", requireRole("hr_admin"), async (req, res) => {
  const r = await pool!.query(
    "DELETE FROM holidays WHERE id = $1 RETURNING holiday_date::text, name",
    [req.params.id]
  );
  if (!r.rowCount) return res.status(404).json({ ok: false, detail: "Not found" });
  await audit("holiday.removed", "holiday", req.params.id, r.rows[0]);
  res.json({ ok: true });
});
