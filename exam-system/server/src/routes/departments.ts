import { Router } from "express";
import { pool } from "../db";

export const departments = Router();

departments.get("/api/departments", async (_req, res) => {
  const r = await pool!.query(
    `SELECT d.id, d.name, d.active, count(e.id) FILTER (WHERE e.status = 'active')::int AS active_employees
     FROM departments d
     LEFT JOIN employees e ON e.department_id = d.id
     GROUP BY d.id ORDER BY d.name`
  );
  res.json(r.rows);
});
