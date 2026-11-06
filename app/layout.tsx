import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { getDb } from "@/lib/db";
import { getCompany } from "@/lib/repo";

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
  return (
    <html lang="el" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
