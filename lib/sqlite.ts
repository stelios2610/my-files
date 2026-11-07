import { DatabaseSync } from "node:sqlite";
import { schemaSql } from "./schema";

export type DB = DatabaseSync;

export function openDatabase(filename: string): DB {
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  if (filename !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  db.exec(schemaSql);
  ensureStaffSchema(db);
  ensureColumn(db, "document", "opened_by", "TEXT");
  ensureColumn(db, "document", "opened_by_name", "TEXT");
  ensureColumn(db, "document_line", "staff_id", "TEXT");
  ensureColumn(db, "document_line", "staff_name", "TEXT");
  ensureColumn(db, "payment", "staff_id", "TEXT");
  ensureColumn(db, "payment", "staff_name", "TEXT");
  return db;
}

function ensureColumn(db: DB, table: string, column: string, definition: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (rows.some((row) => row.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function ensureStaffSchema(db: DB) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'staff'").get() as
    | { sql: string }
    | undefined;
  if (!row?.sql.includes("'admin'") || !row.sql.includes("permissions")) {
    const columns = db.prepare("PRAGMA table_info(staff)").all() as { name: string }[];
    const hasPermissions = columns.some((column) => column.name === "permissions");
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec(`CREATE TABLE staff_next (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      pin TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('waiter', 'cashier', 'admin')),
      active INTEGER NOT NULL DEFAULT 1,
      permissions TEXT NOT NULL DEFAULT '',
      UNIQUE (company_id, pin)
    )`);
    if (hasPermissions) {
      db.exec(
        `INSERT INTO staff_next (id, company_id, name, pin, role, active, permissions)
         SELECT id, company_id, name, pin, role, active, COALESCE(permissions, '') FROM staff`,
      );
    } else {
      db.exec(
        `INSERT INTO staff_next (id, company_id, name, pin, role, active, permissions)
         SELECT id, company_id, name, pin, role, active, '' FROM staff`,
      );
    }
    db.exec("DROP TABLE staff");
    db.exec("ALTER TABLE staff_next RENAME TO staff");
    db.exec("PRAGMA foreign_keys = ON");
  }
}
