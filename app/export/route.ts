import { formatDateTime } from "@/lib/money";
import { getDb } from "@/lib/db";
import { exportRows, getCompany } from "@/lib/repo";

export const dynamic = "force-dynamic";

function cell(value: string): string {
  if (/[";\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function euro(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function GET() {
  const db = getDb();
  const company = getCompany(db);
  const rows = exportRows(db, company.id);
  const header = ["Αριθμός", "Ημ/νία", "Τραπέζι", "Καθαρή αξία", "ΦΠΑ", "Σύνολο", "Μετρητά", "Κάρτα", "Ταμειακή"];
  const lines = [
    header.join(";"),
    ...rows.map((row) =>
      [
        row.number,
        formatDateTime(row.closedAt),
        row.table,
        euro(row.net),
        euro(row.vat),
        euro(row.gross),
        euro(row.cash),
        euro(row.card),
        row.fiscal,
      ]
        .map(cell)
        .join(";"),
    ),
  ];
  const body = `\uFEFF${lines.join("\n")}\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="parastatika.csv"',
    },
  });
}
