// Bootstrap the first HR/Admin login (run once after migrations):
//   npm run create-admin -- admin@morepenpdr.com "Full Name"
// Prints a one-time password; the admin sets their own on first sign-in.
import { pool } from "./db";
import { audit } from "./lib/audit";
import { generateTempPassword, hashPassword } from "./lib/passwords";

async function main() {
  const [email, fullName] = process.argv.slice(2);
  if (!email || !fullName) {
    console.error('Usage: npm run create-admin -- <email> "<Full Name>"');
    process.exit(1);
  }
  if (!pool) throw new Error("DATABASE_URL is not set in .env");

  const existing = await pool.query("SELECT id FROM users WHERE lower(email) = lower($1)", [email]);
  if (existing.rowCount) {
    console.error(`A user already exists for ${email} — use the Users screen to reset their password.`);
    process.exit(1);
  }
  const temp = generateTempPassword();
  const r = await pool.query(
    `INSERT INTO users (email, full_name, role, password_hash, must_change_password)
     VALUES ($1, $2, 'hr_admin', $3, true) RETURNING id`,
    [email, fullName, hashPassword(temp)]
  );
  await audit("user.provisioned", "user", String(r.rows[0].id), { email, role: "hr_admin", bootstrap: true }, "create-admin-cli");
  console.log(`HR/Admin account created for ${email}`);
  console.log(`One-time password (shown once, must be changed on first sign-in): ${temp}`);
  await pool.end();
}

main();
