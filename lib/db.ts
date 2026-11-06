import "server-only";
import fs from "node:fs";
import path from "node:path";
import { seedIfEmpty, seedStaffIfMissing } from "./seed";
import { openDatabase, type DB } from "./sqlite";

const globalForDb = globalThis as unknown as { eliaDb?: DB };

export function getDb(): DB {
  if (!globalForDb.eliaDb) {
    const directory = path.join(process.cwd(), "data");
    fs.mkdirSync(directory, { recursive: true });
    const db = openDatabase(path.join(directory, "elia.sqlite"));
    seedIfEmpty(db);
    seedStaffIfMissing(db);
    globalForDb.eliaDb = db;
  }
  return globalForDb.eliaDb;
}
