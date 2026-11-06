import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTender,
  explodeSale,
  formatEuro,
  lineGrossCents,
  parseEuroToCents,
  parseQtyToMilli,
  splitGross,
  summarizeLines,
} from "../lib/money";

test("menu prices are gross and VAT is backed out per line", () => {
  assert.deepEqual(splitGross(1130, 1300), { net: 1000, vat: 130 });
  assert.deepEqual(splitGross(1240, 2400), { net: 1000, vat: 240 });
  const totals = summarizeLines([
    { gross: 1070, vatRateBps: 1300 },
    { gross: 800, vatRateBps: 2400 },
  ]);
  assert.equal(totals.gross, 1870);
  assert.equal(totals.net + totals.vat, totals.gross);
  assert.equal(totals.buckets.length, 2);
});

test("line gross includes modifiers and quantity", () => {
  assert.equal(lineGrossCents(1000, 950, 120), 1070);
  assert.equal(lineGrossCents(2000, 400, 0), 800);
});

test("recipes explode in milli-units and bottles decrement themselves", () => {
  const movements = explodeSale([
    {
      itemId: "salad",
      qtyMilli: 2000,
      tracksStock: false,
      recipe: [
        { ingredientId: "feta", qtyMilli: 80 },
        { ingredientId: "tomato", qtyMilli: 150 },
      ],
    },
    { itemId: "beer", qtyMilli: 2000, tracksStock: true, recipe: [] },
    {
      itemId: "salad-again",
      qtyMilli: 1000,
      tracksStock: false,
      recipe: [{ ingredientId: "feta", qtyMilli: 80 }],
    },
  ]);
  const byItem = Object.fromEntries(movements.map((movement) => [movement.itemId, movement.qtyMilli]));
  assert.equal(byItem.feta, -(160 + 80));
  assert.equal(byItem.tomato, -300);
  assert.equal(byItem.beer, -2000);
});

test("cash can over-tender and card cannot", () => {
  assert.deepEqual(applyTender(1620, 2000, "cash"), { ok: true, applied: 1620, change: 380 });
  const card = applyTender(1620, 2000, "card");
  assert.equal(card.ok, false);
});

test("money and quantity inputs accept Greek decimals", () => {
  assert.equal(parseEuroToCents("12,50"), 1250);
  assert.equal(parseEuroToCents("12.5"), 1250);
  assert.equal(parseEuroToCents(""), null);
  assert.equal(parseEuroToCents("-1"), null);
  assert.equal(parseQtyToMilli("0,150"), 150);
  assert.equal(parseQtyToMilli("-0,5"), -500);
  assert.match(formatEuro(1250), /12,50/);
});
