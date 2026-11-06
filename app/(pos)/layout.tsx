import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { logoutAction } from "@/lib/actions";
import { currentStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatEuro, formatTime } from "@/lib/money";
import { getCompany, getOpenShift, pendingFiscalCount } from "@/lib/repo";

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const staff = await currentStaff();
  if (!staff) redirect("/login");
  const db = getDb();
  const company = getCompany(db);
  const shift = getOpenShift(db, company.id);
  const pending = pendingFiscalCount(db, company.id);
  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="brand">
          <strong>{company.name}</strong>
          <span>Όροφος · αποθήκη · βάρδια</span>
        </Link>
        <Nav pending={pending} showCodes={staff.role === "cashier"} />
        <div className="shift-pill">
          {shift ? (
            <>
              <em>Βάρδια ανοιχτή</em> από {formatTime(shift.openedAt)} · ταμείο {formatEuro(shift.openingFloat)}
            </>
          ) : (
            <Link href="/shift">Χωρίς βάρδια</Link>
          )}
          <form action={logoutAction}>
            <button className="ghost" type="submit">
              {staff.name} · Έξοδος
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
