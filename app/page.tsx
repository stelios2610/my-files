import { Floor } from "@/components/floor";
import { getDb } from "@/lib/db";
import { getCompany, getFloor, getOpenShift } from "@/lib/repo";

export default function FloorPage() {
  const db = getDb();
  const company = getCompany(db);
  const areas = getFloor(db, company.id);
  const shift = getOpenShift(db, company.id);
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Όροφος</h1>
          <p className="lede">Πάτα τραπέζι για παραγγελία. Το κλείσιμο στέλνει σύνολο για την ταμειακή και ρίχνει την αποθήκη από τη συνταγή.</p>
        </div>
      </div>
      <Floor areas={areas} shiftOpen={shift != null} />
    </main>
  );
}
