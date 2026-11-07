import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <h1>Δεν βρέθηκε</h1>
      <p>
        <Link href="/">Πίσω στον όροφο</Link>
      </p>
    </main>
  );
}
