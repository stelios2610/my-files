import { DatabaseSync } from "node:sqlite";
import { schemaSql } from "./schema";

export type DB = DatabaseSync;

export function openDatabase(filename: string): DB {
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  if (filename !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  db.exec(schemaSql);
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
