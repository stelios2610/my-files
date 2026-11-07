"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function current(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/tables");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({
  pending,
  items,
}: {
  pending: number;
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();
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
