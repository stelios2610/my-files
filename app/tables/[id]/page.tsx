import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuPicker } from "@/components/menu-picker";
import {
  addPaymentAction,
  closeDocumentAction,
  removePaymentAction,
  setLineQtyAction,
  voidDocumentAction,
} from "@/lib/actions";
import { getDb } from "@/lib/db";
import { formatAmountInput, formatEuro, formatRate, formatTime } from "@/lib/money";
import { getCompany, getMenu, getOpenTicketByTable, getTableName } from "@/lib/repo";

export default async function TablePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; change?: string; paid?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const db = getDb();
  const table = getTableName(db, id);
  if (!table) notFound();
  const ticket = getOpenTicketByTable(db, id);
  const menu = getMenu(db, getCompany(db).id);
  const change = Number(query.change ?? "");

  return (
    <main className="page">
      {query.error ? <p className="banner banner-danger">{query.error}</p> : null}
      {Number.isInteger(change) && change > 0 ? <p className="banner banner-ok">Ρέστα {formatEuro(change)}</p> : null}
      {!ticket ? (
        <div className="page-head">
          <div>
            <h1>
              {table.areaName} {table.name}
            </h1>
            <p className="lede">Το τραπέζι είναι ελεύθερο.</p>
            <p>
              <Link href="/">Πίσω στον όροφο</Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="ticket-layout">
          <section className="panel ticket">
            <div className="ticket-top">
              <div>
                <h1>
                  {ticket.areaName} {ticket.tableName}
                </h1>
                <p>
                  {ticket.numberLabel} · από {formatTime(ticket.openedAt)}
                </p>
              </div>
              <form action={voidDocumentAction}>
                <input type="hidden" name="documentId" value={ticket.documentId} />
                <input type="hidden" name="tableId" value={ticket.tableId} />
                <button className="ghost" type="submit">
                  Ακύρωση
                </button>
              </form>
            </div>
            {ticket.lines.length === 0 ? <p className="empty">Διάλεξε είδος από το μενού.</p> : null}
            <div className="lines">
              {ticket.lines.map((line) => (
                <article key={line.id} className="line">
                  <div>
                    <strong>{line.name}</strong>
                    {line.modifiers.length > 0 ? (
                      <div className="mods">{line.modifiers.map((modifier) => modifier.name).join(" · ")}</div>
                    ) : null}
                    <div className="qty">
                      <form action={setLineQtyAction}>
                        <input type="hidden" name="lineId" value={line.id} />
                        <input type="hidden" name="tableId" value={ticket.tableId} />
                        <input type="hidden" name="qty" value={line.qtyMilli - 1000} />
                        <button type="submit" aria-label={`Μείωση ${line.name}`}>
                          −
                        </button>
                      </form>
                      <span>{line.qtyMilli / 1000}</span>
                      <form action={setLineQtyAction}>
                        <input type="hidden" name="lineId" value={line.id} />
                        <input type="hidden" name="tableId" value={ticket.tableId} />
                        <input type="hidden" name="qty" value={line.qtyMilli + 1000} />
                        <button type="submit" aria-label={`Αύξηση ${line.name}`}>
                          +
                        </button>
                      </form>
                    </div>
                  </div>
                  <div className="line-price">{formatEuro(line.gross)}</div>
                </article>
              ))}
            </div>
            <div className="totals">
              <div>
                <span>Καθαρή αξία</span>
                <span>{formatEuro(ticket.net)}</span>
              </div>
              {ticket.buckets.map((bucket) => (
                <div key={bucket.rateBps}>
                  <span>ΦΠΑ {formatRate(bucket.rateBps)}</span>
                  <span>{formatEuro(bucket.vat)}</span>
                </div>
              ))}
              <div className="grand">
                <span>Σύνολο</span>
                <span>{formatEuro(ticket.gross)}</span>
              </div>
              {ticket.paid > 0 ? (
                <div>
                  <span>Πληρωμένο</span>
                  <span>{formatEuro(ticket.paid)}</span>
                </div>
              ) : null}
            </div>
            {ticket.payments.length > 0 ? (
              <div className="payments">
                {ticket.payments.map((payment) => (
                  <div key={payment.id} className="payment">
                    <span>
                      {payment.method === "cash" ? "Μετρητά" : "Κάρτα"} {formatEuro(payment.amount)}
                    </span>
                    <form action={removePaymentAction}>
                      <input type="hidden" name="paymentId" value={payment.id} />
                      <input type="hidden" name="tableId" value={ticket.tableId} />
                      <button className="ghost" type="submit">
                        Αφαίρεση
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            ) : null}
            {ticket.lines.length > 0 && ticket.remaining > 0 ? (
              <form className="pay" action={addPaymentAction}>
                <input type="hidden" name="documentId" value={ticket.documentId} />
                <input type="hidden" name="tableId" value={ticket.tableId} />
                <label>
                  Υπόλοιπο {formatEuro(ticket.remaining)}
                  <input
                    key={ticket.remaining}
                    className="amount-input"
                    name="amount"
                    inputMode="decimal"
                    defaultValue={formatAmountInput(ticket.remaining)}
                    aria-label="Ποσό πληρωμής"
                  />
                </label>
                <div className="pay-row">
                  <button className="secondary" name="method" value="cash" type="submit">
                    Μετρητά
                  </button>
                  <button className="secondary" name="method" value="card" type="submit">
                    Κάρτα
                  </button>
                </div>
              </form>
            ) : null}
            {ticket.lines.length > 0 && ticket.remaining === 0 ? (
              <form className="pay" action={closeDocumentAction}>
                <input type="hidden" name="documentId" value={ticket.documentId} />
                <input type="hidden" name="tableId" value={ticket.tableId} />
                <button className="primary" type="submit">
                  Κλείσιμο και σήμανση για ταμειακή
                </button>
                <p className="note">Δεν κόβεται απόδειξη εδώ. Το σύνολο χτυπιέται στην ταμειακή του μαγαζιού.</p>
              </form>
            ) : null}
          </section>
          <MenuPicker categories={menu} documentId={ticket.documentId} />
        </div>
      )}
    </main>
  );
}
