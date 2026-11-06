import { redirect } from "next/navigation";
import { PinPad } from "@/components/pin-pad";
import { currentStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { demoPins, getCompany } from "@/lib/repo";

export default async function LoginPage() {
  if (await currentStaff()) redirect("/");
  const db = getDb();
  const company = getCompany(db);
  const demo = demoPins(db);
  return (
    <main className="login">
      <p className="brand-mark">{company.name}</p>
      <h1>Κωδικός</h1>
      <p className="lede">Κάθε σερβιτόρος μπαίνει με τον δικό του. Η παραγγελία κρατάει το όνομα.</p>
      <PinPad />
      {demo ? (
        <p className="note demo-pins">
          Δείγμα: {demo.map((person) => `${person.name} ${person.pin}`).join(" · ")}
        </p>
      ) : null}
    </main>
  );
}
