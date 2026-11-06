import Link from "next/link";
import { notFound } from "next/navigation";
import { markFiscalSentAction } from "@/lib/actions";
import { getDb } from "@/lib/db";
import { formatDateTime, formatEuro, formatRate } from "@/lib/money";
import { getCompany, getFiscalHandoff, getTicket } from "@/lib/repo";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const db = getDb();
  const company = getCompany(db);
  const ticket = getTicket(db, id);
  const fiscal = getFiscalHandoff(db, id);
  if (!ticket || !fiscal) notFound();
  return (
    <main className="page">
      {query.error ? <p className="banner banner-danger">{query.error}</p> : null}
      <p>
        <Link href="/documents">Όλα τα παραστατικά</Link>
      </p>
      <article className="slip">
        <header>
          <h1>{company.name}</h1>
          <p>
            {company.address}
            <br />
            ΑΦΜ {company.vatNumber}
          </p>
          <div className="stamp">ΟΧΙ ΦΟΡΟΛΟΓΙΚΗ ΑΠΟΔΕΙΞΗ</div>
          <p>
            {ticket.numberLabel}
            <br />
            {ticket.areaName} {ticket.tableName}
            <br />
            {formatDateTime(fiscal.payload.closedAt)}
          </p>
        </header>
        <table>
          <tbody>
            {ticket.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  {line.qtyMilli / 1000} × {line.name}
                  {line.modifiers.length > 0 ? <div>{line.modifiers.map((modifier) => modifier.name).join(", ")}</div> : null}
                  {line.staffName ? <div>{line.staffName}</div> : null}
                </td>
                <td className="num">{formatEuro(line.gross)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table>
          <tbody>
            <tr>
              <td>Καθαρή αξία</td>
              <td className="num">{formatEuro(ticket.net)}</td>
            </tr>
            {ticket.buckets.map((bucket) => (
              <tr key={bucket.rateBps}>
                <td>ΦΠΑ {formatRate(bucket.rateBps)}</td>
                <td className="num">{formatEuro(bucket.vat)}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Σύνολο</strong>
              </td>
              <td className="num">
                <strong>{formatEuro(ticket.gross)}</strong>
              </td>
            </tr>
            {ticket.payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.method === "cash" ? "Μετρητά" : "Κάρτα"}</td>
                <td className="num">{formatEuro(payment.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>{fiscal.payload.note}</p>
        <div className="actions">
          {fiscal.status === "pending" ? (
            <form action={markFiscalSentAction}>
              <input type="hidden" name="documentId" value={ticket.documentId} />
              <button className="primary" type="submit">
                Σημάνθηκε στην ταμειακή
              </button>
            </form>
          ) : (
            <p className="banner banner-ok">Σημάνθηκε στην ταμειακή.</p>
          )}
        </div>
      </article>
    </main>
  );
}
