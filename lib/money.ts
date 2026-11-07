export type VatBucket = {
  rateBps: number;
  net: number;
  vat: number;
  gross: number;
};

export type Totals = {
  gross: number;
  net: number;
  vat: number;
  buckets: VatBucket[];
};

export type ExplosionInput = {
  itemId: string;
  qtyMilli: number;
  tracksStock: boolean;
  recipe: { ingredientId: string; qtyMilli: number }[];
};

export function lineGrossCents(qtyMilli: number, unitPriceGross: number, modifierDelta: number): number {
  return Math.round(((unitPriceGross + modifierDelta) * qtyMilli) / 1000);
}

/** Menu prices are gross. Net is backed out per line, then summed. */
export function splitGross(grossCents: number, vatRateBps: number): { net: number; vat: number } {
  const net = Math.round((grossCents * 10000) / (10000 + vatRateBps));
  return { net, vat: grossCents - net };
}

export function summarizeLines(lines: { gross: number; vatRateBps: number }[]): Totals {
  const byRate = new Map<number, VatBucket>();
  for (const line of lines) {
    const split = splitGross(line.gross, line.vatRateBps);
    const current = byRate.get(line.vatRateBps) ?? {
      rateBps: line.vatRateBps,
      net: 0,
      vat: 0,
      gross: 0,
    };
    current.net += split.net;
    current.vat += split.vat;
    current.gross += line.gross;
    byRate.set(line.vatRateBps, current);
  }
  const buckets = [...byRate.values()].sort((a, b) => a.rateBps - b.rateBps);
  return {
    gross: buckets.reduce((sum, bucket) => sum + bucket.gross, 0),
    net: buckets.reduce((sum, bucket) => sum + bucket.net, 0),
    vat: buckets.reduce((sum, bucket) => sum + bucket.vat, 0),
    buckets,
  };
}

export function explodeSale(lines: ExplosionInput[]): { itemId: string; qtyMilli: number }[] {
  const totals = new Map<string, number>();
  const add = (itemId: string, qtyMilli: number) => {
    totals.set(itemId, (totals.get(itemId) ?? 0) + qtyMilli);
  };
  for (const line of lines) {
    if (line.recipe.length > 0) {
      for (const ingredient of line.recipe) {
        add(ingredient.ingredientId, -Math.round((line.qtyMilli * ingredient.qtyMilli) / 1000));
      }
    } else if (line.tracksStock) {
      add(line.itemId, -line.qtyMilli);
    }
  }
  return [...totals.entries()]
    .filter(([, qtyMilli]) => qtyMilli !== 0)
    .map(([itemId, qtyMilli]) => ({ itemId, qtyMilli }));
}

export function applyTender(
  remaining: number,
  tendered: number,
  method: "cash" | "card",
): { ok: true; applied: number; change: number } | { ok: false; error: string } {
  if (!Number.isInteger(tendered) || tendered <= 0) {
    return { ok: false, error: "Γράψε ποσό μεγαλύτερο από μηδέν." };
  }
  if (remaining <= 0) {
    return { ok: false, error: "Ο λογαριασμός είναι ήδη εξοφλημένος." };
  }
  if (method === "card" && tendered > remaining) {
    return { ok: false, error: "Η κάρτα δεν μπορεί να ξεπεράσει το υπόλοιπο." };
  }
  const applied = Math.min(tendered, remaining);
  return { ok: true, applied, change: tendered - applied };
}

export function parseEuroToCents(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, "").replace("€", "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [euros, cents = ""] = cleaned.split(".");
  const value = Number(euros) * 100 + Number(cents.padEnd(2, "0"));
  if (!Number.isSafeInteger(value) || value > 10_000_000) return null;
  return value;
}

export function parseQtyToMilli(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,3})?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith("-");
  const [whole, fraction = ""] = cleaned.replace("-", "").split(".");
  const milli = Number(whole) * 1000 + Number(fraction.padEnd(3, "0").slice(0, 3));
  if (!Number.isSafeInteger(milli) || milli > 1_000_000_000) return null;
  return negative ? -milli : milli;
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function formatAmountInput(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}${euros},${rest}`;
}

export function formatRate(bps: number): string {
  return `${new Intl.NumberFormat("el-GR", { maximumFractionDigits: 2 }).format(bps / 100)}%`;
}

export function formatQty(milli: number, unit: string): string {
  const value = milli / 1000;
  const text = new Intl.NumberFormat("el-GR", { maximumFractionDigits: 3 }).format(value);
  return `${text} ${unitLabel(unit)}`;
}

export function unitLabel(unit: string): string {
  if (unit === "kg") return "kg";
  if (unit === "lt") return "lt";
  return "τεμ";
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: "Europe/Athens",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: "Europe/Athens",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function minutesOpen(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

export function documentLabel(seriesCode: string, number: number): string {
  return `${seriesCode}-${String(number).padStart(5, "0")}`;
}
