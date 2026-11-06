import { redirect } from "next/navigation";
import { changePinAction, createStaffAction } from "@/lib/actions";
import { currentStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getCompany, listStaff } from "@/lib/repo";

const roleLabel = { waiter: "Σερβιτόρος", cashier: "Ταμείο" };

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await currentStaff();
  if (!staff) redirect("/login");
  const query = await searchParams;
  if (staff.role !== "cashier") {
    return (
      <main className="page">
        <h1>Κωδικοί</h1>
        <p className="lede">Μόνο το ταμείο βλέπει και αλλάζει τους κωδικούς.</p>
      </main>
    );
  }
  const people = listStaff(getDb(), getCompany(getDb()).id);
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Κωδικοί</h1>
          <p className="lede">Τέσσερα ψηφία για κάθε άτομο. Το όνομα γράφεται στη γραμμή που βάζει και στην πληρωμή που κλείνει.</p>
        </div>
      </div>
      {query.error ? <p className="banner banner-danger">{query.error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Όνομα</th>
            <th>Ρόλος</th>
            <th>Κωδικός</th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id}>
              <td>{person.name}</td>
              <td>{roleLabel[person.role]}</td>
              <td>
                <form action={changePinAction} className="inline">
                  <input type="hidden" name="staffId" value={person.id} />
                  <input name="pin" defaultValue={person.pin} inputMode="numeric" aria-label={`Κωδικός ${person.name}`} />
                  <button className="secondary" type="submit">
                    Αλλαγή
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Νέο άτομο</h2>
      <form action={createStaffAction} className="inline">
        <input name="name" placeholder="Όνομα" aria-label="Όνομα" />
        <input name="pin" placeholder="1234" inputMode="numeric" aria-label="Κωδικός" />
        <select name="role" aria-label="Ρόλος">
          <option value="waiter">Σερβιτόρος</option>
          <option value="cashier">Ταμείο</option>
        </select>
        <button className="primary" type="submit">
          Προσθήκη
        </button>
      </form>
    </main>
  );
}
