import { closeShiftAction, openShiftAction } from "@/lib/actions";
import { getDb } from "@/lib/db";
import { formatAmountInput, formatEuro, formatTime } from "@/lib/money";
import { getCompany, getOpenShift, getShiftReport } from "@/lib/repo";

export default async function ShiftPage({ searchParams }: { searchParams: Promise<{ error?: string; closed?: string }> }) {
  const query = await searchParams;
  const db = getDb();
  const company = getCompany(db);
  const shift = getOpenShift(db, company.id);
  const report = shift ? getShiftReport(db, shift.id) : null;
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Βάρδια</h1>
          <p className="lede">Χωρίς ανοιχτή βάρδια δεν ανοίγει τραπέζι. Η βάρδια κλείνει μόνο όταν δεν μένει ανοιχτός λογαριασμός.</p>
        </div>
      </div>
      {query.error ? <p className="banner banner-danger">{query.error}</p> : null}
      {query.closed ? <p className="banner banner-ok">Η βάρδια έκλεισε.</p> : null}
      {!shift ? (
        <form action={openShiftAction} className="panel ticket stack" style={{ maxWidth: 420 }}>
          <label>
            Αρχικό ταμείο
            <input className="amount-input" name="float" defaultValue="150,00" inputMode="decimal" />
          </label>
          <button className="primary" type="submit">
            Άνοιγμα βάρδιας
          </button>
        </form>
      ) : report ? (
        <>
          <p className="lede">Ανοιχτή από {formatTime(report.shift.openedAt)}.</p>
          <div className="stats">
            <div className="stat">
              <span>Μετρητά εισπράξεις</span>
              <strong>{formatEuro(report.cash)}</strong>
            </div>
            <div className="stat">
              <span>Κάρτες</span>
              <strong>{formatEuro(report.card)}</strong>
            </div>
            <div className="stat">
              <span>Αναμενόμενα μετρητά</span>
              <strong>{formatEuro(report.expectedCash)}</strong>
            </div>
            <div className="stat">
              <span>Τζίρος κλεισμένων</span>
              <strong>{formatEuro(report.gross)}</strong>
            </div>
            <div className="stat">
              <span>ΦΠΑ</span>
              <strong>{formatEuro(report.vat)}</strong>
            </div>
            <div className="stat">
              <span>Κλεισμένα τραπέζια</span>
              <strong>{report.closedCount}</strong>
            </div>
          </div>
          <form action={closeShiftAction} className="panel ticket stack" style={{ maxWidth: 420 }}>
            <label>
              Μετρητά που μέτρησες
              <input
                className="amount-input"
                name="counted"
                defaultValue={formatAmountInput(report.expectedCash)}
                inputMode="decimal"
              />
            </label>
            <button className="primary" type="submit">
              Κλείσιμο βάρδιας
            </button>
            <p className="note">Η διαφορά είναι μετρημένα μείον αναμενόμενα. Το αρχικό ταμείο είναι μέσα στα αναμενόμενα.</p>
          </form>
        </>
      ) : null}
    </main>
  );
}
