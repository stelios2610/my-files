import { redirect } from "next/navigation";
import { NewPersonForm } from "@/components/new-person";
import { changePinAction, savePermissionsAction } from "@/lib/actions";
import { currentStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { getCompany, listStaff } from "@/lib/repo";

const roleLabel = { admin: "Υπεύθυνος", cashier: "Ταμείο", waiter: "Σερβιτόρος" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await currentStaff();
  if (!staff) redirect("/login");
  const query = await searchParams;
  if (staff.role !== "admin") {
    return (
      <main className="page">
        <h1>Ρυθμίσεις</h1>
        <p className="lede">Μόνο ο υπεύθυνος μοιράζει δικαιώματα.</p>
      </main>
    );
  }
  const people = listStaff(getDb(), getCompany(getDb()).id);
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Ρυθμίσεις</h1>
          <p className="lede">
            Εδώ μοιράζεις τι βλέπει ο καθένας. Ο σερβιτόρος ξεκινάει μόνο με τον όροφο. Ο υπεύθυνος έχει πάντα όλα τα
            δικαιώματα, μαζί με αυτή τη σελίδα.
          </p>
        </div>
      </div>
      {query.error ? <p className="banner banner-danger">{query.error}</p> : null}
      <div className="catalog">
        {people.map((person) => (
          <article key={person.id} className="item-admin">
            <div>
              <strong>{person.name}</strong>
              <p className="note">{roleLabel[person.role]}</p>
              <form action={changePinAction} className="inline">
                <input type="hidden" name="staffId" value={person.id} />
                <input name="pin" defaultValue={person.pin} inputMode="numeric" aria-label={`Κωδικός ${person.name}`} />
                <button className="secondary" type="submit">
                  Κωδικός
                </button>
              </form>
            </div>
            <div>
              {person.role === "admin" ? (
                <p className="note">Έχει όλα τα δικαιώματα. Δεν αφαιρούνται.</p>
              ) : (
                <form action={savePermissionsAction}>
                  <input type="hidden" name="staffId" value={person.id} />
                  <div className="rights">
                    {PERMISSIONS.map((permission) => (
                      <label key={permission.id}>
                        <input
                          type="checkbox"
                          name="permission"
                          value={permission.id}
                          defaultChecked={person.permissions.includes(permission.id)}
                        />
                        <span>
                          {permission.label}
                          <small>{permission.detail}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <button className="secondary" type="submit">
                    Αποθήκευση
                  </button>
                </form>
              )}
            </div>
          </article>
        ))}
      </div>
      <h2>Νέο άτομο</h2>
      <NewPersonForm />
    </main>
  );
}
