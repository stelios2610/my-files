"use client";

import { useState } from "react";
import { createStaffAction } from "@/lib/actions";
import { PERMISSIONS, defaultPermissions } from "@/lib/permissions";

export function NewPersonForm() {
  const [role, setRole] = useState<"waiter" | "cashier">("waiter");
  const selected = defaultPermissions(role);
  return (
    <form action={createStaffAction} className="stack" style={{ maxWidth: 640 }}>
      <div className="inline">
        <input name="name" placeholder="Όνομα" aria-label="Όνομα" />
        <input name="pin" placeholder="1234" inputMode="numeric" aria-label="Κωδικός" />
        <select
          name="role"
          aria-label="Ρόλος"
          value={role}
          onChange={(event) => setRole(event.target.value === "cashier" ? "cashier" : "waiter")}
        >
          <option value="waiter">Σερβιτόρος</option>
          <option value="cashier">Ταμείο</option>
        </select>
      </div>
      <div className="rights" key={role}>
        {PERMISSIONS.map((permission) => (
          <label key={permission.id}>
            <input
              type="checkbox"
              name="permission"
              value={permission.id}
              defaultChecked={selected.includes(permission.id)}
            />
            <span>{permission.label}</span>
          </label>
        ))}
      </div>
      <button className="primary" type="submit">
        Προσθήκη
      </button>
    </form>
  );
}
