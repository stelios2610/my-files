import assert from "node:assert/strict";
import test from "node:test";
import { BusinessError, addLine, addPayment, closeDocument, closeShift, getOpenTicketByTable, getStock, getTicket, markFiscalSent, openShift, openTable, voidDocument } from "../lib/repo";
import { seedIfEmpty } from "../lib/seed";
import { openDatabase } from "../lib/sqlite";

function tavern() {
  const db = openDatabase(":memory:");
  seedIfEmpty(db);
  seedIfEmpty(db);
  return db;
}

test("a table cannot open before the shift", () => {
  const db = tavern();
  assert.throws(() => openTable(db, "table_s1"), /βάρδια/);
});

test("closing a table explodes recipes, keeps modifiers off stock, and hands the total to the register", () => {
  const db = tavern();
  openShift(db, "co_elia", 15000);
  const opened = openTable(db, "table_s1");
  assert.throws(() => addLine(db, opened.documentId, "item_coffee", []), /Βράσιμο/);
  addLine(db, opened.documentId, "item_coffee", ["mod_metrios"]);
  addLine(db, opened.documentId, "item_horiatiki", ["mod_extra_feta"]);
  addLine(db, opened.documentId, "item_beer", []);
  addLine(db, opened.documentId, "item_beer", []);

  const ticket = getOpenTicketByTable(db, "table_s1");
  assert.ok(ticket);
  assert.equal(ticket.lines.length, 3);
  assert.equal(ticket.lines.find((line) => line.name === "Μπύρα 500ml")?.qtyMilli, 2000);
  assert.equal(ticket.gross, 250 + 1070 + 800);
  assert.ok(ticket.buckets.some((bucket) => bucket.rateBps === 1300));
  assert.ok(ticket.buckets.some((bucket) => bucket.rateBps === 2400));

  addPayment(db, opened.documentId, "cash", 500);
  assert.throws(() => closeDocument(db, opened.documentId), /εξοφλημένος/);
  assert.throws(() => addPayment(db, opened.documentId, "card", 5000), /κάρτα/i);

  const midway = getTicket(db, opened.documentId);
  assert.ok(midway);
  const tender = addPayment(db, opened.documentId, "cash", midway.remaining + 380);
  assert.equal(tender.change, 380);

  openTable(db, "table_s2");
  assert.throws(() => closeShift(db, "co_elia", 15000), /ανοιχτά τραπέζια/);
  const second = getOpenTicketByTable(db, "table_s2");
  assert.ok(second);
  addLine(db, second.documentId, "item_water", []);
  addPayment(db, second.documentId, "cash", 50);
  assert.throws(() => voidDocument(db, second.documentId), /πληρωμές/);

  closeDocument(db, opened.documentId);
  assert.throws(() => closeDocument(db, opened.documentId), /ανοιχτή/);

  const stock = Object.fromEntries(getStock(db, "co_elia").map((row) => [row.name, row.onHandMilli]));
  assert.equal(stock["Φέτα"], 3000 - 80);
  assert.equal(stock["Ντομάτα"], 8000 - 150);
  assert.equal(stock["Καφές"], 1000 - 8);
  assert.equal(stock["Μπύρα 500ml"], 48000 - 2000);

  const closed = getTicket(db, opened.documentId);
  assert.equal(closed?.remaining, 0);
  markFiscalSent(db, opened.documentId);
  assert.throws(() => markFiscalSent(db, opened.documentId), /σήμανση/);

  const companies = db.prepare("SELECT COUNT(*) AS count FROM company").get() as { count: number };
  assert.equal(Number(companies.count), 1);
});
