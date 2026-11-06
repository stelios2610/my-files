"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Όροφος" },
  { href: "/menu", label: "Μενού" },
  { href: "/stock", label: "Αποθήκη" },
  { href: "/shift", label: "Βάρδια" },
  { href: "/documents", label: "Παραστατικά" },
];

function current(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/tables");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({ pending, showCodes }: { pending: number; showCodes: boolean }) {
  const pathname = usePathname();
  const items = showCodes ? [...links, { href: "/staff", label: "Κωδικοί" }] : links;
  return (
    <nav className="nav">
      {items.map((link) => (
        <Link key={link.href} href={link.href} aria-current={current(pathname, link.href) ? "page" : undefined}>
          {link.label}
          {link.href === "/documents" && pending > 0 ? <span className="badge">{pending}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
