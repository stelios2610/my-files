import { randomUUID } from "node:crypto";
import {
  applyTender,
  documentLabel,
  explodeSale,
  lineGrossCents,
  minutesOpen,
  summarizeLines,
} from "./money";
import type { DB } from "./sqlite";
import type {
  CompanyInfo,
  FloorArea,
  MenuCategory,
  MenuGroup,
  ShiftInfo,
  Ticket,
  TicketLine,
} from "./types";

export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessError";
  }
}

type Param = string | number | bigint | null | Uint8Array;

function one<T>(db: DB, sql: string, ...params: Param[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

function many<T>(db: DB, sql: string, ...params: Param[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

function transaction<T>(db: DB, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // The transaction is already closed.
    }
    throw error;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function changesOf(result: { changes: number | bigint }): number {
  return Number(result.changes);
}

export function getCompany(db: DB): CompanyInfo {
  const row = one<{ id: string; name: string; vat_number: string; address: string }>(
    db,
    "SELECT id, name, vat_number, address FROM company ORDER BY name LIMIT 1",
  );
  if (!row) throw new BusinessError("Δεν υπάρχει εταιρεία.");
  return { id: row.id, name: row.name, vatNumber: row.vat_number, address: row.address };
}

export function getOpenShift(db: DB, companyId: string): ShiftInfo | null {
  const row = one<{ id: string; opened_at: string; opening_float: number }>(
    db,
    "SELECT id, opened_at, opening_float FROM shift WHERE company_id = ? AND closed_at IS NULL",
    companyId,
  );
  if (!row) return null;
  return { id: row.id, openedAt: row.opened_at, openingFloat: row.opening_float };
}

export function getFloor(db: DB, companyId: string): FloorArea[] {
  const areas = many<{ id: string; name: string }>(
    db,
    "SELECT id, name FROM area WHERE company_id = ? ORDER BY position",
    companyId,
  );
  const tables = many<{ id: string; area_id: string; name: string }>(
    db,
    `SELECT t.id, t.area_id, t.name
     FROM dining_table t
     JOIN area a ON a.id = t.area_id
     WHERE a.company_id = ?
     ORDER BY t.position`,
    companyId,
  );
  const openDocs = many<{ id: string; table_id: string; opened_at: string }>(
    db,
    "SELECT id, table_id, opened_at FROM document WHERE company_id = ? AND status = 'open' AND table_id IS NOT NULL",
    companyId,
  );
  const docIds = openDocs.map((doc) => doc.id);
  const lines = docIds.length
    ? many<{ document_id: string; qty_milli: number; unit_price_gross: number; vat_rate_bps: number; line_id: string }>(
        db,
        `SELECT id AS line_id, document_id, qty_milli, unit_price_gross, vat_rate_bps
         FROM document_line
         WHERE document_id IN (${docIds.map(() => "?").join(",")})`,
        ...docIds,
      )
    : [];
  const modifiers = lines.length
    ? many<{ line_id: string; price_delta: number }>(
        db,
        `SELECT line_id, price_delta FROM document_line_modifier WHERE line_id IN (${lines.map(() => "?").join(",")})`,
        ...lines.map((line) => line.line_id),
      )
    : [];
  const deltaByLine = new Map<string, number>();
  for (const modifier of modifiers) {
    deltaByLine.set(modifier.line_id, (deltaByLine.get(modifier.line_id) ?? 0) + modifier.price_delta);
  }
  const totals = new Map<string, { gross: number; count: number }>();
  for (const line of lines) {
    const gross = lineGrossCents(line.qty_milli, line.unit_price_gross, deltaByLine.get(line.line_id) ?? 0);
    const current = totals.get(line.document_id) ?? { gross: 0, count: 0 };
    current.gross += gross;
    current.count += 1;
    totals.set(line.document_id, current);
  }
  const docByTable = new Map(openDocs.map((doc) => [doc.table_id, doc]));
  return areas.map((area) => ({
    id: area.id,
    name: area.name,
    tables: tables
      .filter((table) => table.area_id === area.id)
      .map((table) => {
        const doc = docByTable.get(table.id);
        const total = doc ? totals.get(doc.id) : undefined;
        return {
          id: table.id,
          name: table.name,
          documentId: doc?.id ?? null,
          gross: total?.gross ?? (doc ? 0 : null),
          itemCount: total?.count ?? 0,
          openedMinutes: doc ? minutesOpen(doc.opened_at) : null,
        };
      }),
  }));
}

export function openShift(db: DB, companyId: string, openingFloat: number): string {
  if (!Number.isInteger(openingFloat) || openingFloat < 0) {
    throw new BusinessError("Το αρχικό ταμείο πρέπει να είναι μηδέν ή θετικό ποσό.");
  }
  return transaction(db, () => {
    const existing = getOpenShift(db, companyId);
    if (existing) throw new BusinessError("Υπάρχει ήδη ανοιχτή βάρδια.");
    const id = randomUUID();
    db.prepare("INSERT INTO shift (id, company_id, opened_at, opening_float) VALUES (?, ?, ?, ?)").run(
      id,
      companyId,
      nowIso(),
      openingFloat,
    );
    return id;
  });
}

export function closeShift(db: DB, companyId: string, closingCash: number): void {
  if (!Number.isInteger(closingCash) || closingCash < 0) {
    throw new BusinessError("Τα μετρητά στο κλείσιμο πρέπει να είναι μηδέν ή θετικό ποσό.");
  }
  transaction(db, () => {
    const shift = getOpenShift(db, companyId);
    if (!shift) throw new BusinessError("Δεν υπάρχει ανοιχτή βάρδια.");
    const openDocs = one<{ count: number }>(
      db,
      "SELECT COUNT(*) AS count FROM document WHERE company_id = ? AND status = 'open'",
      companyId,
    );
    if (Number(openDocs?.count ?? 0) > 0) throw new BusinessError("Υπάρχουν ανοιχτά τραπέζια. Κλείσε τα πριν τη βάρδια.");
    db.prepare("UPDATE shift SET closed_at = ?, closing_cash = ? WHERE id = ? AND closed_at IS NULL").run(
      nowIso(),
      closingCash,
      shift.id,
    );
  });
}

export type ShiftReport = {
  shift: ShiftInfo;
  cash: number;
  card: number;
  expectedCash: number;
  gross: number;
  net: number;
  vat: number;
  closedCount: number;
};

export function getShiftReport(db: DB, shiftId: string): ShiftReport | null {
  const shift = one<{ id: string; opened_at: string; opening_float: number }>(
    db,
    "SELECT id, opened_at, opening_float FROM shift WHERE id = ?",
    shiftId,
  );
  if (!shift) return null;
  const payments = many<{ method: "cash" | "card"; amount: number }>(
    db,
    "SELECT method, COALESCE(SUM(amount), 0) AS amount FROM payment WHERE shift_id = ? GROUP BY method",
    shiftId,
  );
  const cash = Number(payments.find((row) => row.method === "cash")?.amount ?? 0);
  const card = Number(payments.find((row) => row.method === "card")?.amount ?? 0);
  const lines = many<{ qty_milli: number; unit_price_gross: number; vat_rate_bps: number; line_id: string }>(
    db,
    `SELECT l.id AS line_id, l.qty_milli, l.unit_price_gross, l.vat_rate_bps
     FROM document_line l
     JOIN document d ON d.id = l.document_id
     WHERE d.shift_id = ? AND d.status = 'closed'`,
    shiftId,
  );
  const modifiers = lines.length
    ? many<{ line_id: string; price_delta: number }>(
        db,
        `SELECT line_id, price_delta FROM document_line_modifier WHERE line_id IN (${lines.map(() => "?").join(",")})`,
        ...lines.map((line) => line.line_id),
      )
    : [];
  const deltaByLine = new Map<string, number>();
  for (const modifier of modifiers) {
    deltaByLine.set(modifier.line_id, (deltaByLine.get(modifier.line_id) ?? 0) + modifier.price_delta);
  }
  const totals = summarizeLines(
    lines.map((line) => ({
      gross: lineGrossCents(line.qty_milli, line.unit_price_gross, deltaByLine.get(line.line_id) ?? 0),
      vatRateBps: line.vat_rate_bps,
    })),
  );
  const closed = one<{ count: number }>(
    db,
    "SELECT COUNT(*) AS count FROM document WHERE shift_id = ? AND status = 'closed'",
    shiftId,
  );
  return {
    shift: { id: shift.id, openedAt: shift.opened_at, openingFloat: shift.opening_float },
    cash,
    card,
    expectedCash: shift.opening_float + cash,
    gross: totals.gross,
    net: totals.net,
    vat: totals.vat,
    closedCount: Number(closed?.count ?? 0),
  };
}

export function openTable(db: DB, tableId: string): { documentId: string; tableId: string } {
  return transaction(db, () => {
    const table = one<{ id: string; company_id: string }>(
      db,
      `SELECT t.id, a.company_id
       FROM dining_table t
       JOIN area a ON a.id = t.area_id
       WHERE t.id = ?`,
      tableId,
    );
    if (!table) throw new BusinessError("Δεν υπάρχει αυτό το τραπέζι.");
    const existing = one<{ id: string }>(
      db,
      "SELECT id FROM document WHERE table_id = ? AND status = 'open'",
      tableId,
    );
    if (existing) return { documentId: existing.id, tableId };
    const shift = getOpenShift(db, table.company_id);
    if (!shift) throw new BusinessError("Άνοιξε πρώτα βάρδια.");
    const series = one<{ id: string; next_number: number }>(
      db,
      "SELECT id, next_number FROM series WHERE company_id = ? AND doc_type = 'order'",
      table.company_id,
    );
    if (!series) throw new BusinessError("Δεν υπάρχει σειρά παραστατικών.");
    db.prepare("UPDATE series SET next_number = next_number + 1 WHERE id = ?").run(series.id);
    const documentId = randomUUID();
    db.prepare(
      `INSERT INTO document (
        id, company_id, series_id, number, doc_type, status, table_id, shift_id, opened_at
      ) VALUES (?, ?, ?, ?, 'order', 'open', ?, ?, ?)`,
    ).run(documentId, table.company_id, series.id, series.next_number, tableId, shift.id, nowIso());
    return { documentId, tableId };
  });
}

function loadTicketLines(db: DB, documentId: string): TicketLine[] {
  const rows = many<{
    id: string;
    name: string;
    qty_milli: number;
    unit_price_gross: number;
    vat_rate_bps: number;
  }>(
    db,
    `SELECT id, name, qty_milli, unit_price_gross, vat_rate_bps
     FROM document_line WHERE document_id = ? ORDER BY position`,
    documentId,
  );
  const modifiers = rows.length
    ? many<{ id: string; line_id: string; name: string; price_delta: number }>(
        db,
        `SELECT id, line_id, name, price_delta FROM document_line_modifier
         WHERE line_id IN (${rows.map(() => "?").join(",")})`,
        ...rows.map((row) => row.id),
      )
    : [];
  return rows.map((row) => {
    const lineModifiers = modifiers.filter((modifier) => modifier.line_id === row.id);
    const delta = lineModifiers.reduce((sum, modifier) => sum + Number(modifier.price_delta), 0);
    const qtyMilli = Number(row.qty_milli);
    const unitPriceGross = Number(row.unit_price_gross);
    return {
      id: row.id,
      name: row.name,
      qtyMilli,
      unitPriceGross,
      vatRateBps: Number(row.vat_rate_bps),
      modifiers: lineModifiers.map((modifier) => ({
        id: modifier.id,
        name: modifier.name,
        priceDelta: Number(modifier.price_delta),
      })),
      gross: lineGrossCents(qtyMilli, unitPriceGross, delta),
    };
  });
}

export function getOpenTicketByTable(db: DB, tableId: string): Ticket | null {
  const doc = one<{ id: string }>(db, "SELECT id FROM document WHERE table_id = ? AND status = 'open'", tableId);
  if (!doc) return null;
  return getTicket(db, doc.id);
}

export function getTicket(db: DB, documentId: string): Ticket | null {
  const doc = one<{
    id: string;
    number: number;
    series_code: string;
    table_id: string;
    table_name: string;
    area_name: string;
    opened_at: string;
    status: string;
  }>(
    db,
    `SELECT d.id, d.number, s.code AS series_code, d.table_id, t.name AS table_name, a.name AS area_name, d.opened_at, d.status
     FROM document d
     JOIN series s ON s.id = d.series_id
     JOIN dining_table t ON t.id = d.table_id
     JOIN area a ON a.id = t.area_id
     WHERE d.id = ?`,
    documentId,
  );
  if (!doc || !doc.table_id) return null;
  const lines = loadTicketLines(db, documentId);
  const payments = many<{ id: string; method: "cash" | "card"; amount: number }>(
    db,
    "SELECT id, method, amount FROM payment WHERE document_id = ? ORDER BY paid_at",
    documentId,
  );
  const totals = summarizeLines(lines.map((line) => ({ gross: line.gross, vatRateBps: line.vatRateBps })));
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  return {
    documentId: doc.id,
    numberLabel: documentLabel(doc.series_code, doc.number),
    tableId: doc.table_id,
    tableName: doc.table_name,
    areaName: doc.area_name,
    openedAt: doc.opened_at,
    lines,
    payments,
    gross: totals.gross,
    net: totals.net,
    vat: totals.vat,
    buckets: totals.buckets,
    paid,
    remaining: totals.gross - paid,
  };
}

export function getTableName(db: DB, tableId: string): { name: string; areaName: string } | null {
  const row = one<{ name: string; area_name: string }>(
    db,
    `SELECT t.name, a.name AS area_name
     FROM dining_table t JOIN area a ON a.id = t.area_id
     WHERE t.id = ?`,
    tableId,
  );
  if (!row) return null;
  return { name: row.name, areaName: row.area_name };
}

export function getMenu(db: DB, companyId: string): MenuCategory[] {
  const categories = many<{ id: string; name: string }>(
    db,
    "SELECT id, name FROM category WHERE company_id = ? ORDER BY position",
    companyId,
  );
  const items = many<{
    id: string;
    category_id: string;
    name: string;
    price_gross: number;
    rate_bps: number;
  }>(
    db,
    `SELECT i.id, i.category_id, i.name, i.price_gross, v.rate_bps
     FROM item i
     JOIN vat_rate v ON v.id = i.vat_rate_id
     WHERE i.company_id = ? AND i.on_menu = 1 AND i.active = 1 AND i.category_id IS NOT NULL
     ORDER BY i.name`,
    companyId,
  );
  const groups = many<{ item_id: string; id: string; name: string; required: number }>(
    db,
    `SELECT link.item_id, g.id, g.name, g.required
     FROM item_modifier_group link
     JOIN modifier_group g ON g.id = link.group_id
     WHERE g.company_id = ?`,
    companyId,
  );
  const modifiers = groups.length
    ? many<{ id: string; group_id: string; name: string; price_delta: number }>(
        db,
        `SELECT id, group_id, name, price_delta FROM modifier WHERE group_id IN (${groups.map(() => "?").join(",")})`,
        ...groups.map((group) => group.id),
      )
    : [];
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    items: items
      .filter((item) => item.category_id === category.id)
      .map((item) => ({
        id: item.id,
        name: item.name,
        priceGross: item.price_gross,
        vatRateBps: item.rate_bps,
        groups: groups
          .filter((group) => group.item_id === item.id)
          .map(
            (group): MenuGroup => ({
              id: group.id,
              name: group.name,
              required: group.required === 1,
              modifiers: modifiers
                .filter((modifier) => modifier.group_id === group.id)
                .map((modifier) => ({ id: modifier.id, name: modifier.name, priceDelta: modifier.price_delta })),
            }),
          ),
      })),
  }));
}

function modifierSignature(ids: string[]): string {
  return [...ids].sort().join("|");
}

export function addLine(db: DB, documentId: string, itemId: string, modifierIds: string[]): { tableId: string } {
  return transaction(db, () => {
    const doc = one<{ id: string; status: string; table_id: string; company_id: string }>(
      db,
      "SELECT id, status, table_id, company_id FROM document WHERE id = ?",
      documentId,
    );
    if (!doc || doc.status !== "open" || !doc.table_id) throw new BusinessError("Η παραγγελία δεν είναι ανοιχτή.");
    const item = one<{
      id: string;
      name: string;
      price_gross: number | null;
      on_menu: number;
      rate_bps: number | null;
      company_id: string;
    }>(
      db,
      `SELECT i.id, i.name, i.price_gross, i.on_menu, i.company_id, v.rate_bps
       FROM item i
       LEFT JOIN vat_rate v ON v.id = i.vat_rate_id
       WHERE i.id = ? AND i.active = 1`,
      itemId,
    );
    if (!item || item.company_id !== doc.company_id || !item.on_menu || item.price_gross == null || item.rate_bps == null) {
      throw new BusinessError("Αυτό δεν μπαίνει σε παραγγελία.");
    }
    const uniqueIds = [...new Set(modifierIds)];
    const chosen = uniqueIds.length
      ? many<{ id: string; group_id: string; name: string; price_delta: number }>(
          db,
          `SELECT id, group_id, name, price_delta FROM modifier WHERE id IN (${uniqueIds.map(() => "?").join(",")})`,
          ...uniqueIds,
        )
      : [];
    if (chosen.length !== uniqueIds.length) throw new BusinessError("Άκυρη τροποποίηση.");
    const groups = many<{ id: string; name: string; required: number }>(
      db,
      `SELECT g.id, g.name, g.required
       FROM item_modifier_group link
       JOIN modifier_group g ON g.id = link.group_id
       WHERE link.item_id = ?`,
      itemId,
    );
    const allowed = new Set(groups.map((group) => group.id));
    for (const modifier of chosen) {
      if (!allowed.has(modifier.group_id)) throw new BusinessError("Η τροποποίηση δεν ανήκει στο είδος.");
    }
    for (const group of groups) {
      const count = chosen.filter((modifier) => modifier.group_id === group.id).length;
      if (group.required && count !== 1) throw new BusinessError(`Διάλεξε ένα: ${group.name}.`);
    }
    const signature = modifierSignature(chosen.map((modifier) => modifier.id));
    const existingLines = many<{ id: string; qty_milli: number }>(
      db,
      "SELECT id, qty_milli FROM document_line WHERE document_id = ? AND item_id = ?",
      documentId,
      itemId,
    );
    for (const line of existingLines) {
      const mods = many<{ modifier_id: string | null }>(
        db,
        "SELECT modifier_id FROM document_line_modifier WHERE line_id = ?",
        line.id,
      );
      const existingSignature = modifierSignature(mods.map((mod) => mod.modifier_id ?? ""));
      if (existingSignature === signature) {
        db.prepare("UPDATE document_line SET qty_milli = ? WHERE id = ?").run(line.qty_milli + 1000, line.id);
        return { tableId: doc.table_id };
      }
    }
    const position = one<{ next: number }>(
      db,
      "SELECT COALESCE(MAX(position), 0) + 1 AS next FROM document_line WHERE document_id = ?",
      documentId,
    );
    const lineId = randomUUID();
    db.prepare(
      `INSERT INTO document_line (id, document_id, item_id, name, qty_milli, unit_price_gross, vat_rate_bps, position)
       VALUES (?, ?, ?, ?, 1000, ?, ?, ?)`,
    ).run(lineId, documentId, item.id, item.name, item.price_gross, item.rate_bps, position?.next ?? 1);
    const insertModifier = db.prepare(
      "INSERT INTO document_line_modifier (id, line_id, modifier_id, name, price_delta) VALUES (?, ?, ?, ?, ?)",
    );
    for (const modifier of chosen) {
      insertModifier.run(randomUUID(), lineId, modifier.id, modifier.name, modifier.price_delta);
    }
    return { tableId: doc.table_id };
  });
}

export function setLineQty(db: DB, lineId: string, qtyMilli: number): { tableId: string } {
  if (!Number.isInteger(qtyMilli) || qtyMilli < 0) throw new BusinessError("Άκυρη ποσότητα.");
  return transaction(db, () => {
    const line = one<{ id: string; document_id: string; table_id: string; status: string }>(
      db,
      `SELECT l.id, l.document_id, d.table_id, d.status
       FROM document_line l JOIN document d ON d.id = l.document_id
       WHERE l.id = ?`,
      lineId,
    );
    if (!line || line.status !== "open" || !line.table_id) throw new BusinessError("Η παραγγελία δεν είναι ανοιχτή.");
    if (qtyMilli === 0) {
      db.prepare("DELETE FROM document_line_modifier WHERE line_id = ?").run(lineId);
      db.prepare("DELETE FROM document_line WHERE id = ?").run(lineId);
    } else {
      db.prepare("UPDATE document_line SET qty_milli = ? WHERE id = ?").run(qtyMilli, lineId);
    }
    return { tableId: line.table_id };
  });
}

export function addPayment(
  db: DB,
  documentId: string,
  method: "cash" | "card",
  tendered: number,
): { tableId: string; change: number } {
  if (method !== "cash" && method !== "card") throw new BusinessError("Άκυρος τρόπος πληρωμής.");
  return transaction(db, () => {
    const ticket = getTicket(db, documentId);
    if (!ticket) throw new BusinessError("Η παραγγελία δεν είναι ανοιχτή.");
    const doc = one<{ status: string; shift_id: string }>(
      db,
      "SELECT status, shift_id FROM document WHERE id = ?",
      documentId,
    );
    if (!doc || doc.status !== "open") throw new BusinessError("Η παραγγελία δεν είναι ανοιχτή.");
    const tender = applyTender(ticket.remaining, tendered, method);
    if (!tender.ok) throw new BusinessError(tender.error);
    db.prepare("INSERT INTO payment (id, document_id, shift_id, method, amount, paid_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      randomUUID(),
      documentId,
      doc.shift_id,
      method,
      tender.applied,
      nowIso(),
    );
    return { tableId: ticket.tableId, change: tender.change };
  });
}

export function removePayment(db: DB, paymentId: string): { tableId: string } {
  return transaction(db, () => {
    const payment = one<{ id: string; table_id: string; status: string }>(
      db,
      `SELECT p.id, d.table_id, d.status
       FROM payment p JOIN document d ON d.id = p.document_id
       WHERE p.id = ?`,
      paymentId,
    );
    if (!payment || payment.status !== "open" || !payment.table_id) {
      throw new BusinessError("Η πληρωμή δεν αφαιρείται από κλειστό παραστατικό.");
    }
    db.prepare("DELETE FROM payment WHERE id = ?").run(paymentId);
    return { tableId: payment.table_id };
  });
}

export type FiscalPayload = {
  documentNumber: string;
  closedAt: string;
  table: string;
  lines: { name: string; qty: number; gross: number; modifiers: string[] }[];
  vat: { rateBps: number; net: number; vat: number; gross: number }[];
  payments: { method: "cash" | "card"; amount: number }[];
  total: number;
  note: string;
};

export function closeDocument(db: DB, documentId: string): { tableId: string } {
  return transaction(db, () => {
    const doc = one<{
      id: string;
      status: string;
      table_id: string;
      company_id: string;
      number: number;
      series_code: string;
      table_name: string;
      area_name: string;
    }>(
      db,
      `SELECT d.id, d.status, d.table_id, d.company_id, d.number, s.code AS series_code, t.name AS table_name, a.name AS area_name
       FROM document d
       JOIN series s ON s.id = d.series_id
       JOIN dining_table t ON t.id = d.table_id
       JOIN area a ON a.id = t.area_id
       WHERE d.id = ?`,
      documentId,
    );
    if (!doc || doc.status !== "open" || !doc.table_id) throw new BusinessError("Η παραγγελία δεν είναι ανοιχτή.");
    const lines = loadTicketLines(db, documentId);
    if (lines.length === 0) throw new BusinessError("Ο λογαριασμός είναι άδειος.");
    const totals = summarizeLines(lines.map((line) => ({ gross: line.gross, vatRateBps: line.vatRateBps })));
    const payments = many<{ method: "cash" | "card"; amount: number }>(
      db,
      "SELECT method, amount FROM payment WHERE document_id = ?",
      documentId,
    );
    const paid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    if (paid !== totals.gross) throw new BusinessError("Ο λογαριασμός δεν είναι εξοφλημένος.");
    const recipeRows = many<{ parent_item_id: string; ingredient_item_id: string; qty_milli: number }>(
      db,
      `SELECT parent_item_id, ingredient_item_id, qty_milli FROM recipe_line
       WHERE parent_item_id IN (${lines.map(() => "?").join(",")})`,
      ...lines.map((line) => lineItemId(db, line.id)),
    );
    const itemIds = lines.map((line) => lineItemId(db, line.id));
    const stockFlags = many<{ id: string; tracks_stock: number }>(
      db,
      `SELECT id, tracks_stock FROM item WHERE id IN (${itemIds.map(() => "?").join(",")})`,
      ...itemIds,
    );
    const explosions = explodeSale(
      lines.map((line, index) => ({
        itemId: itemIds[index] ?? "",
        qtyMilli: line.qtyMilli,
        tracksStock: (stockFlags.find((flag) => flag.id === itemIds[index])?.tracks_stock ?? 0) === 1,
        recipe: recipeRows
          .filter((row) => row.parent_item_id === itemIds[index])
          .map((row) => ({ ingredientId: row.ingredient_item_id, qtyMilli: row.qty_milli })),
      })),
    );
    const closedAt = nowIso();
    const payload: FiscalPayload = {
      documentNumber: documentLabel(doc.series_code, doc.number),
      closedAt,
      table: `${doc.area_name} ${doc.table_name}`,
      lines: lines.map((line) => ({
        name: line.name,
        qty: line.qtyMilli / 1000,
        gross: line.gross,
        modifiers: line.modifiers.map((modifier) => modifier.name),
      })),
      vat: totals.buckets,
      payments,
      total: totals.gross,
      note: "Δεν είναι φορολογική απόδειξη. Το σύνολο χτυπιέται στην ταμειακή του μαγαζιού.",
    };
    const changed = db
      .prepare("UPDATE document SET status = 'closed', closed_at = ? WHERE id = ? AND status = 'open'")
      .run(closedAt, documentId);
    if (changesOf(changed) !== 1) throw new BusinessError("Η παραγγελία δεν είναι ανοιχτή.");
    const insertMovement = db.prepare(
      `INSERT INTO stock_movement (id, company_id, item_id, qty_milli, reason, document_id, note, created_at)
       VALUES (?, ?, ?, ?, 'sale', ?, '', ?)`,
    );
    for (const movement of explosions) {
      insertMovement.run(randomUUID(), doc.company_id, movement.itemId, movement.qtyMilli, documentId, closedAt);
    }
    db.prepare(
      "INSERT INTO fiscal_handoff (id, document_id, payload, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
    ).run(randomUUID(), documentId, JSON.stringify(payload), closedAt);
    return { tableId: doc.table_id };
  });
}

function lineItemId(db: DB, lineId: string): string {
  const row = one<{ item_id: string }>(db, "SELECT item_id FROM document_line WHERE id = ?", lineId);
  if (!row) throw new BusinessError("Λείπει γραμμή.");
  return row.item_id;
}

export function voidDocument(db: DB, documentId: string): { tableId: string } {
  return transaction(db, () => {
    const doc = one<{ status: string; table_id: string }>(
      db,
      "SELECT status, table_id FROM document WHERE id = ?",
      documentId,
    );
    if (!doc || doc.status !== "open" || !doc.table_id) throw new BusinessError("Η παραγγελία δεν είναι ανοιχτή.");
    const payments = one<{ count: number }>(
      db,
      "SELECT COUNT(*) AS count FROM payment WHERE document_id = ?",
      documentId,
    );
    if (Number(payments?.count ?? 0) > 0) throw new BusinessError("Βγάλε πρώτα τις πληρωμές και μετά ακύρωσε.");
    const lineIds = many<{ id: string }>(db, "SELECT id FROM document_line WHERE document_id = ?", documentId);
    if (lineIds.length) {
      db.prepare(
        `DELETE FROM document_line_modifier WHERE line_id IN (${lineIds.map(() => "?").join(",")})`,
      ).run(...lineIds.map((line) => line.id));
    }
    db.prepare("DELETE FROM document_line WHERE document_id = ?").run(documentId);
    db.prepare("UPDATE document SET status = 'void', closed_at = ? WHERE id = ?").run(nowIso(), documentId);
    return { tableId: doc.table_id };
  });
}

export type ClosedDocument = {
  id: string;
  numberLabel: string;
  closedAt: string;
  tableName: string;
  gross: number;
  fiscalStatus: "pending" | "sent";
};

export function listClosedDocuments(db: DB, companyId: string): ClosedDocument[] {
  const docs = many<{
    id: string;
    number: number;
    series_code: string;
    closed_at: string;
    table_name: string;
    fiscal_status: "pending" | "sent";
  }>(
    db,
    `SELECT d.id, d.number, s.code AS series_code, d.closed_at, t.name AS table_name, f.status AS fiscal_status
     FROM document d
     JOIN series s ON s.id = d.series_id
     JOIN dining_table t ON t.id = d.table_id
     JOIN fiscal_handoff f ON f.document_id = d.id
     WHERE d.company_id = ? AND d.status = 'closed'
     ORDER BY d.closed_at DESC
     LIMIT 200`,
    companyId,
  );
  return docs.map((doc) => {
    const ticket = getTicket(db, doc.id);
    return {
      id: doc.id,
      numberLabel: documentLabel(doc.series_code, doc.number),
      closedAt: doc.closed_at,
      tableName: doc.table_name,
      gross: ticket?.gross ?? 0,
      fiscalStatus: doc.fiscal_status,
    };
  });
}

export function pendingFiscalCount(db: DB, companyId: string): number {
  const row = one<{ count: number }>(
    db,
    `SELECT COUNT(*) AS count
     FROM fiscal_handoff f
     JOIN document d ON d.id = f.document_id
     WHERE d.company_id = ? AND f.status = 'pending'`,
    companyId,
  );
  return Number(row?.count ?? 0);
}

export function getFiscalHandoff(db: DB, documentId: string): { status: "pending" | "sent"; payload: FiscalPayload } | null {
  const row = one<{ status: "pending" | "sent"; payload: string }>(
    db,
    "SELECT status, payload FROM fiscal_handoff WHERE document_id = ?",
    documentId,
  );
  if (!row) return null;
  return { status: row.status, payload: JSON.parse(row.payload) as FiscalPayload };
}

export function markFiscalSent(db: DB, documentId: string): void {
  const result = db
    .prepare("UPDATE fiscal_handoff SET status = 'sent', sent_at = ? WHERE document_id = ? AND status = 'pending'")
    .run(nowIso(), documentId);
  if (changesOf(result) !== 1) throw new BusinessError("Η σήμανση έχει ήδη καταχωριστεί ή δεν υπάρχει.");
}

export type StockRow = {
  id: string;
  name: string;
  unit: string;
  onHandMilli: number;
};

export function getStock(db: DB, companyId: string): StockRow[] {
  return many<{ id: string; name: string; unit: string; on_hand: number | null }>(
    db,
    `SELECT i.id, i.name, i.unit, COALESCE(SUM(m.qty_milli), 0) AS on_hand
     FROM item i
     LEFT JOIN stock_movement m ON m.item_id = i.id
     WHERE i.company_id = ? AND i.tracks_stock = 1 AND i.active = 1
     GROUP BY i.id
     ORDER BY i.name`,
    companyId,
  ).map((row) => ({ id: row.id, name: row.name, unit: row.unit, onHandMilli: Number(row.on_hand ?? 0) }));
}

export type MovementRow = {
  id: string;
  itemName: string;
  qtyMilli: number;
  unit: string;
  reason: string;
  createdAt: string;
  documentLabel: string | null;
};

export function recentMovements(db: DB, companyId: string): MovementRow[] {
  const rows = many<{
    id: string;
    item_name: string;
    qty_milli: number;
    unit: string;
    reason: string;
    created_at: string;
    series_code: string | null;
    number: number | null;
  }>(
    db,
    `SELECT m.id, i.name AS item_name, m.qty_milli, i.unit, m.reason, m.created_at, s.code AS series_code, d.number
     FROM stock_movement m
     JOIN item i ON i.id = m.item_id
     LEFT JOIN document d ON d.id = m.document_id
     LEFT JOIN series s ON s.id = d.series_id
     WHERE m.company_id = ?
     ORDER BY m.created_at DESC
     LIMIT 40`,
    companyId,
  );
  return rows.map((row) => ({
    id: row.id,
    itemName: row.item_name,
    qtyMilli: row.qty_milli,
    unit: row.unit,
    reason: row.reason,
    createdAt: row.created_at,
    documentLabel: row.series_code && row.number ? documentLabel(row.series_code, row.number) : null,
  }));
}

export function adjustStock(db: DB, companyId: string, itemId: string, qtyMilli: number, note: string): void {
  if (!Number.isInteger(qtyMilli) || qtyMilli === 0) throw new BusinessError("Η διόρθωση δεν μπορεί να είναι μηδέν.");
  const item = one<{ id: string }>(
    db,
    "SELECT id FROM item WHERE id = ? AND company_id = ? AND tracks_stock = 1",
    itemId,
    companyId,
  );
  if (!item) throw new BusinessError("Το είδος δεν κρατάει απόθεμα.");
  db.prepare(
    `INSERT INTO stock_movement (id, company_id, item_id, qty_milli, reason, note, created_at)
     VALUES (?, ?, ?, ?, 'adjust', ?, ?)`,
  ).run(randomUUID(), companyId, itemId, qtyMilli, note.trim().slice(0, 120), nowIso());
}

export type MenuAdminItem = {
  id: string;
  name: string;
  priceGross: number;
  vatRateBps: number;
  vatName: string;
  tracksStock: boolean;
  recipe: { id: string; ingredientId: string; ingredientName: string; qtyMilli: number; unit: string }[];
};

export function getMenuAdmin(db: DB, companyId: string): { categoryName: string; items: MenuAdminItem[] }[] {
  const menu = getMenu(db, companyId);
  const recipes = many<{
    id: string;
    parent_item_id: string;
    ingredient_item_id: string;
    ingredient_name: string;
    qty_milli: number;
    unit: string;
  }>(
    db,
    `SELECT r.id, r.parent_item_id, r.ingredient_item_id, i.name AS ingredient_name, r.qty_milli, i.unit
     FROM recipe_line r
     JOIN item i ON i.id = r.ingredient_item_id
     JOIN item parent ON parent.id = r.parent_item_id
     WHERE parent.company_id = ?`,
    companyId,
  );
  const flags = many<{ id: string; tracks_stock: number; vat_name: string }>(
    db,
    `SELECT i.id, i.tracks_stock, v.name AS vat_name
     FROM item i JOIN vat_rate v ON v.id = i.vat_rate_id
     WHERE i.company_id = ? AND i.on_menu = 1`,
    companyId,
  );
  return menu.map((category) => ({
    categoryName: category.name,
    items: category.items.map((item) => ({
      id: item.id,
      name: item.name,
      priceGross: item.priceGross,
      vatRateBps: item.vatRateBps,
      vatName: flags.find((flag) => flag.id === item.id)?.vat_name ?? "",
      tracksStock: (flags.find((flag) => flag.id === item.id)?.tracks_stock ?? 0) === 1,
      recipe: recipes
        .filter((recipe) => recipe.parent_item_id === item.id)
        .map((recipe) => ({
          id: recipe.id,
          ingredientId: recipe.ingredient_item_id,
          ingredientName: recipe.ingredient_name,
          qtyMilli: recipe.qty_milli,
          unit: recipe.unit,
        })),
    })),
  }));
}

export function updateItemPrice(db: DB, itemId: string, priceGross: number): void {
  if (!Number.isInteger(priceGross) || priceGross < 0) throw new BusinessError("Άκυρη τιμή.");
  const result = db.prepare("UPDATE item SET price_gross = ? WHERE id = ? AND on_menu = 1").run(priceGross, itemId);
  if (changesOf(result) !== 1) throw new BusinessError("Το είδος δεν είναι στο μενού.");
}

export function addRecipeLine(db: DB, parentId: string, ingredientId: string, qtyMilli: number): void {
  if (!Number.isInteger(qtyMilli) || qtyMilli <= 0) throw new BusinessError("Η ποσότητα συνταγής πρέπει να είναι θετική.");
  if (parentId === ingredientId) throw new BusinessError("Ένα είδος δεν μπαίνει στη δική του συνταγή.");
  const ingredient = one<{ tracks_stock: number }>(db, "SELECT tracks_stock FROM item WHERE id = ?", ingredientId);
  if (!ingredient || ingredient.tracks_stock !== 1) throw new BusinessError("Η συνταγή δέχεται μόνο είδη αποθήκης.");
  const parent = one<{ id: string }>(db, "SELECT id FROM item WHERE id = ? AND on_menu = 1", parentId);
  if (!parent) throw new BusinessError("Το πιάτο δεν είναι στο μενού.");
  db.prepare("INSERT INTO recipe_line (id, parent_item_id, ingredient_item_id, qty_milli) VALUES (?, ?, ?, ?)").run(
    randomUUID(),
    parentId,
    ingredientId,
    qtyMilli,
  );
}

export function removeRecipeLine(db: DB, recipeLineId: string): void {
  const result = db.prepare("DELETE FROM recipe_line WHERE id = ?").run(recipeLineId);
  if (changesOf(result) !== 1) throw new BusinessError("Η γραμμή συνταγής δεν υπάρχει.");
}

export function listIngredients(db: DB, companyId: string): { id: string; name: string; unit: string }[] {
  return many<{ id: string; name: string; unit: string }>(
    db,
    "SELECT id, name, unit FROM item WHERE company_id = ? AND tracks_stock = 1 AND active = 1 ORDER BY name",
    companyId,
  );
}

export type ExportRow = {
  number: string;
  closedAt: string;
  table: string;
  net: number;
  vat: number;
  gross: number;
  cash: number;
  card: number;
  fiscal: string;
};

export function exportRows(db: DB, companyId: string): ExportRow[] {
  return listClosedDocuments(db, companyId).map((doc) => {
    const ticket = getTicket(db, doc.id);
    const cash = ticket?.payments.filter((payment) => payment.method === "cash").reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
    const card = ticket?.payments.filter((payment) => payment.method === "card").reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
    return {
      number: doc.numberLabel,
      closedAt: doc.closedAt,
      table: doc.tableName,
      net: ticket?.net ?? 0,
      vat: ticket?.vat ?? 0,
      gross: doc.gross,
      cash,
      card,
      fiscal: doc.fiscalStatus === "sent" ? "σημάνθηκε" : "εκκρεμεί",
    };
  });
}
