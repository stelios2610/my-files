import { DatabaseSync } from "node:sqlite";
import { schemaSql } from "./schema";

export type DB = DatabaseSync;

export function openDatabase(filename: string): DB {
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  if (filename !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  db.exec(schemaSql);
  return db;
}
