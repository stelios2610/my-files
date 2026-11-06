import assert from "node:assert/strict";
import test from "node:test";
import { BusinessError, addLine, addPayment, changeStaffPin, closeDocument, closeShift, getOpenTicketByTable, getStock, getTicket, markFiscalSent, openShift, openTable, staffByPin, voidDocument } from "../lib/repo";
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
  assert.throws(() => openTable(db, "table_s1", "staff_maria"), /βάρδια/);
});

test("closing a table explodes recipes, keeps modifiers off stock, and hands the total to the register", () => {
  const db = tavern();
  openShift(db, "co_elia", 15000);
  const opened = openTable(db, "table_s1", "staff_maria");
  assert.throws(() => addLine(db, opened.documentId, "item_coffee", [], "staff_maria"), /Βράσιμο/);
  addLine(db, opened.documentId, "item_coffee", ["mod_metrios"], "staff_maria");
  addLine(db, opened.documentId, "item_horiatiki", ["mod_extra_feta"], "staff_maria");
  addLine(db, opened.documentId, "item_beer", [], "staff_maria");
  addLine(db, opened.documentId, "item_beer", [], "staff_maria");

  const ticket = getOpenTicketByTable(db, "table_s1");
  assert.ok(ticket);
  assert.equal(ticket.lines.length, 3);
  assert.equal(ticket.lines.find((line) => line.name === "Μπύρα 500ml")?.qtyMilli, 2000);
  assert.equal(ticket.gross, 250 + 1070 + 800);
  assert.ok(ticket.buckets.some((bucket) => bucket.rateBps === 1300));
  assert.ok(ticket.buckets.some((bucket) => bucket.rateBps === 2400));

  addPayment(db, opened.documentId, "cash", 500, "staff_maria");
  assert.throws(() => closeDocument(db, opened.documentId), /εξοφλημένος/);
  assert.throws(() => addPayment(db, opened.documentId, "card", 5000, "staff_maria"), /κάρτα/i);

  const midway = getTicket(db, opened.documentId);
  assert.ok(midway);
  const tender = addPayment(db, opened.documentId, "cash", midway.remaining + 380, "staff_maria");
  assert.equal(tender.change, 380);

  openTable(db, "table_s2", "staff_maria");
  assert.throws(() => closeShift(db, "co_elia", 15000), /ανοιχτά τραπέζια/);
  const second = getOpenTicketByTable(db, "table_s2");
  assert.ok(second);
  addLine(db, second.documentId, "item_water", [], "staff_maria");
  addPayment(db, second.documentId, "cash", 50, "staff_maria");
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

test("two waiters on the same table stay on their own lines", () => {
  const db = tavern();
  openShift(db, "co_elia", 0);
  const opened = openTable(db, "table_s1", "staff_maria");
  addLine(db, opened.documentId, "item_beer", [], "staff_maria");
  addLine(db, opened.documentId, "item_beer", [], "staff_nikos");
  const ticket = getTicket(db, opened.documentId);
  assert.equal(ticket?.lines.length, 2);
  assert.deepEqual(
    ticket?.lines.map((line) => line.staffName).sort(),
    ["Μαρία", "Νίκος"],
  );
  assert.equal(staffByPin(db, "co_elia", "0000"), null);
  assert.equal(staffByPin(db, "co_elia", "2580")?.name, "Μαρία");
  assert.throws(() => changeStaffPin(db, "staff_nikos", "2580"), /χρησιμοποιείται/);
});
