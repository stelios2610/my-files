"use client";

import { useState, useTransition } from "react";
import { addLineAction } from "@/lib/actions";
import { formatEuro } from "@/lib/money";
import type { MenuCategory, MenuItem } from "@/lib/types";

export function MenuPicker({ categories, documentId }: { categories: MenuCategory[]; documentId: string }) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [draft, setDraft] = useState<MenuItem | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const category = categories.find((entry) => entry.id === categoryId) ?? categories[0];

  function add(item: MenuItem, modifierIds: string[]) {
    setError(null);
    startTransition(async () => {
      const result = await addLineAction(documentId, item.id, modifierIds);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setDraft(null);
      setSelected([]);
    });
  }

  function toggle(item: MenuItem, modifierId: string, groupId: string, required: boolean) {
    setSelected((current) => {
      const groupIds = new Set(item.groups.find((group) => group.id === groupId)?.modifiers.map((modifier) => modifier.id));
      const withoutGroup = required ? current.filter((id) => !groupIds.has(id)) : current;
      if (withoutGroup.includes(modifierId)) return withoutGroup.filter((id) => id !== modifierId);
      return [...withoutGroup, modifierId];
    });
  }

  return (
    <section className="panel menu-board">
      <div className="tabs" role="tablist">
        {categories.map((entry) => (
          <button key={entry.id} type="button" aria-pressed={entry.id === category?.id} onClick={() => setCategoryId(entry.id)}>
            {entry.name}
          </button>
        ))}
      </div>
      {error ? <p className="banner">{error}</p> : null}
      <div className="menu-grid">
        {category?.items.map((item) => (
          <button
            key={item.id}
            className="dish"
            type="button"
            disabled={pending}
            onClick={() => {
              if (item.groups.length === 0) add(item, []);
              else {
                setDraft(item);
                setSelected([]);
                setError(null);
              }
            }}
          >
            <span>{item.name}</span>
            <b>{formatEuro(item.priceGross)}</b>
          </button>
        ))}
      </div>
      {draft ? (
        <div className="modal" role="presentation" onClick={() => setDraft(null)}>
          <form
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={draft.name}
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              add(draft, selected);
            }}
          >
            <h2 style={{ marginTop: 0, textTransform: "none", letterSpacing: 0, color: "inherit", fontSize: 22 }}>{draft.name}</h2>
            {draft.groups.map((group) => (
              <fieldset key={group.id} style={{ border: 0, padding: 0, margin: "12px 0" }}>
                <legend>
                  {group.name}
                  {group.required ? " · ένα" : " · όσα θες"}
                </legend>
                <div className="choices">
                  {group.modifiers.map((modifier) => (
                    <label key={modifier.id}>
                      <span>
                        <input
                          type={group.required ? "radio" : "checkbox"}
                          name={group.id}
                          checked={selected.includes(modifier.id)}
                          onChange={() => toggle(draft, modifier.id, group.id, group.required)}
                        />{" "}
                        {modifier.name}
                      </span>
                      <span>{modifier.priceDelta ? `+${formatEuro(modifier.priceDelta)}` : formatEuro(0)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <div className="pay-row">
              <button className="primary" type="submit" disabled={pending}>
                Προσθήκη
              </button>
              <button className="ghost" type="button" onClick={() => setDraft(null)}>
                Άκυρο
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
