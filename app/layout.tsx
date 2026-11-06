import type { Metadata } from "next";
import Link from "next/link";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { getDb } from "@/lib/db";
import { formatEuro, formatTime } from "@/lib/money";
import { getCompany, getOpenShift, pendingFiscalCount } from "@/lib/repo";
import { Nav } from "@/components/nav";

const sans = Source_Sans_3({
  subsets: ["latin", "greek"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const serif = Source_Serif_4({
  subsets: ["latin", "greek"],
  weight: ["600", "700"],
  variable: "--font-serif",
});

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const company = getCompany(getDb());
  return { title: company.name, description: "Όροφος, παραστατικά και αποθήκη" };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const db = getDb();
  const company = getCompany(db);
  const shift = getOpenShift(db, company.id);
  const pending = pendingFiscalCount(db, company.id);
  return (
    <html lang="el" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <div className="app">
          <header className="topbar">
            <Link href="/" className="brand">
              <strong>{company.name}</strong>
              <span>Όροφος · αποθήκη · βάρδια</span>
            </Link>
            <Nav pending={pending} />
            <div className="shift-pill">
              {shift ? (
                <>
                  <em>Βάρδια ανοιχτή</em> από {formatTime(shift.openedAt)} · ταμείο {formatEuro(shift.openingFloat)}
                </>
              ) : (
                <Link href="/shift">Χωρίς βάρδια</Link>
              )}
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
