"use client";

import { useActionState } from "react";
import { openTableAction } from "@/lib/actions";
import { formatEuro } from "@/lib/money";
import type { FloorArea } from "@/lib/types";

export function Floor({ areas, shiftOpen }: { areas: FloorArea[]; shiftOpen: boolean }) {
  const [state, action, pending] = useActionState(openTableAction, null);
  return (
    <div className="floor">
      {!shiftOpen ? (
        <p className="banner">
          Η βάρδια είναι κλειστή. <a href="/shift">Άνοιξέ την</a> για να πάρεις τραπέζι.
        </p>
      ) : null}
      {state?.error ? <p className="banner">{state.error}</p> : null}
      {areas.map((area) => (
        <section key={area.id}>
          <h2>{area.name}</h2>
          <div className="tables">
            {area.tables.map((table) => (
              <form key={table.id} action={action}>
                <input type="hidden" name="tableId" value={table.id} />
                <button className={table.documentId ? "table-card open" : "table-card"} disabled={pending} type="submit">
                  <strong>{table.name}</strong>
                  <span className="meta">
                    {table.documentId ? `${table.itemCount} είδη · ${table.openedMinutes ?? 0}′` : "Ελεύθερο"}
                  </span>
                  {table.documentId ? <span className="amount">{formatEuro(table.gross ?? 0)}</span> : null}
                </button>
              </form>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
