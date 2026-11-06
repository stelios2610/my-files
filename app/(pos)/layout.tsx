import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { logoutAction } from "@/lib/actions";
import { currentStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatEuro, formatTime } from "@/lib/money";
import { allows, NAV_LINKS } from "@/lib/permissions";
import { getCompany, getOpenShift, pendingFiscalCount } from "@/lib/repo";

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const staff = await currentStaff();
  if (!staff) redirect("/login");
  const db = getDb();
  const company = getCompany(db);
  const shift = getOpenShift(db, company.id);
  const canSeeDocuments = allows(staff, "documents");
  const pending = canSeeDocuments ? pendingFiscalCount(db, company.id) : 0;
  const items = NAV_LINKS.filter((link) => allows(staff, link.permission)).map((link) => ({
    href: link.href,
    label: link.label,
  }));
  if (staff.role === "admin") items.push({ href: "/settings", label: "Ρυθμίσεις" });
  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="brand">
          <strong>{company.name}</strong>
          <span>Όροφος · αποθήκη · βάρδια</span>
        </Link>
        <Nav pending={pending} items={items} />
        <div className="shift-pill">
          {shift ? (
            <>
              <em>Βάρδια ανοιχτή</em> από {formatTime(shift.openedAt)} · ταμείο {formatEuro(shift.openingFloat)}
            </>
          ) : allows(staff, "shift") ? (
            <Link href="/shift">Χωρίς βάρδια</Link>
          ) : (
            <span>Χωρίς βάρδια</span>
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
