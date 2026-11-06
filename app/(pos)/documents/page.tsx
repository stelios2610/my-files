import Link from "next/link";
import { getDb } from "@/lib/db";
import { formatDateTime, formatEuro } from "@/lib/money";
import { getCompany, listClosedDocuments } from "@/lib/repo";

export default function DocumentsPage() {
  const db = getDb();
  const company = getCompany(db);
  const documents = listClosedDocuments(db, company.id);
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Παραστατικά</h1>
          <p className="lede">Κλειστές παραγγελίες της εστίασης. Η σήμανση λέει αν το σύνολο χτυπήθηκε στην ταμειακή. Δεν είναι φορολογικό παραστατικό.</p>
        </div>
        <a className="secondary" href="/export" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
          Εξαγωγή CSV
        </a>
      </div>
      {documents.length === 0 ? <p className="empty">Δεν έχει κλείσει τραπέζι ακόμα.</p> : null}
      {documents.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Αριθμός</th>
              <th>Πότε</th>
              <th>Τραπέζι</th>
              <th>Ταμειακή</th>
              <th className="num">Σύνολο</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td>
                  <Link href={`/documents/${document.id}`}>{document.numberLabel}</Link>
                </td>
                <td>{formatDateTime(document.closedAt)}</td>
                <td>{document.tableName}</td>
                <td>
                  <span className={document.fiscalStatus === "sent" ? "tag sent" : "tag"}>
                    {document.fiscalStatus === "sent" ? "Σημάνθηκε" : "Εκκρεμεί"}
                  </span>
                </td>
                <td className="num">{formatEuro(document.gross)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
