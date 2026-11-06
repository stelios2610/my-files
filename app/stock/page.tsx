import { adjustStockAction } from "@/lib/actions";
import { getDb } from "@/lib/db";
import { formatDateTime, formatQty } from "@/lib/money";
import { getCompany, getStock, recentMovements } from "@/lib/repo";

const reasons: Record<string, string> = {
  opening: "Αρχικό",
  sale: "Πώληση",
  adjust: "Διόρθωση",
};

export default async function StockPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const db = getDb();
  const company = getCompany(db);
  const rows = getStock(db, company.id);
  const movements = recentMovements(db, company.id);
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Αποθήκη</h1>
          <p className="lede">Το απόθεμα πέφτει στο κλείσιμο του τραπεζιού. Αν η παραλαβή δεν έχει περαστεί, το υπόλοιπο γίνεται αρνητικό και το τραπέζι δεν μπλοκάρει.</p>
        </div>
      </div>
      {query.error ? <p className="banner banner-danger">{query.error}</p> : null}
      <form action={adjustStockAction} className="inline" style={{ marginBottom: 16 }}>
        <select name="itemId" aria-label="Είδος αποθήκης">
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
        <input name="qty" placeholder="-0,5" aria-label="Διόρθωση ποσότητας" />
        <input name="note" placeholder="Παραλαβή / φύρα" aria-label="Σημείωση διόρθωσης" />
        <button className="primary" type="submit">
          Διόρθωση
        </button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Είδος</th>
            <th className="num">Υπόλοιπο</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td className={row.onHandMilli < 0 ? "num neg" : "num"}>{formatQty(row.onHandMilli, row.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Κινήσεις</h2>
      <table>
        <thead>
          <tr>
            <th>Πότε</th>
            <th>Είδος</th>
            <th>Αιτία</th>
            <th>Παραστατικό</th>
            <th className="num">Ποσότητα</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td>{formatDateTime(movement.createdAt)}</td>
              <td>{movement.itemName}</td>
              <td>{reasons[movement.reason] ?? movement.reason}</td>
              <td>{movement.documentLabel ?? "—"}</td>
              <td className={movement.qtyMilli < 0 ? "num neg" : "num"}>{formatQty(movement.qtyMilli, movement.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">Οι ώρες είναι σε ώρα Αθήνας.</p>
    </main>
  );
}
