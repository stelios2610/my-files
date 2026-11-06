import { addRecipeAction, removeRecipeAction, updatePriceAction } from "@/lib/actions";
import { Denied } from "@/components/denied";
import { requirePermission } from "@/lib/access";
import { getDb } from "@/lib/db";
import { formatAmountInput, formatQty, formatRate } from "@/lib/money";
import { getCompany, getMenuAdmin, listIngredients } from "@/lib/repo";

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!(await requirePermission("menu"))) return <Denied />;
  const query = await searchParams;
  const db = getDb();
  const company = getCompany(db);
  const sections = getMenuAdmin(db, company.id);
  const ingredients = listIngredients(db, company.id);
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Μενού</h1>
          <p className="lede">Οι τιμές είναι τελικές, με ΦΠΑ. Η συνταγή λέει τι φεύγει από την αποθήκη όταν κλείνει το τραπέζι. Οι τροποποιήσεις αλλάζουν την τιμή, όχι την αποθήκη.</p>
        </div>
      </div>
      {query.error ? <p className="banner banner-danger">{query.error}</p> : null}
      <div className="catalog">
        {sections.map((section) => (
          <section key={section.categoryName}>
            <h2>{section.categoryName}</h2>
            {section.items.map((item) => (
              <article key={item.id} className="item-admin">
                <div>
                  <strong>{item.name}</strong>
                  <p className="note">{item.vatName} · {formatRate(item.vatRateBps)}</p>
                  <form action={updatePriceAction} className="inline">
                    <input type="hidden" name="itemId" value={item.id} />
                    <input name="price" defaultValue={formatAmountInput(item.priceGross)} aria-label={`Τιμή ${item.name}`} />
                    <button className="secondary" type="submit">
                      Τιμή
                    </button>
                  </form>
                </div>
                <div>
                  {item.recipe.length === 0 && item.tracksStock ? <p className="note">Η πώληση μειώνει το απόθεμα του ίδιου είδους.</p> : null}
                  {item.recipe.length === 0 && !item.tracksStock ? <p className="note">Δεν κινεί αποθήκη.</p> : null}
                  {item.recipe.map((line) => (
                    <div key={line.id} className="recipe">
                      <span>
                        {line.ingredientName} · {formatQty(line.qtyMilli, line.unit)}
                      </span>
                      <form action={removeRecipeAction}>
                        <input type="hidden" name="recipeLineId" value={line.id} />
                        <button className="ghost" type="submit">
                          Βγάλ' το
                        </button>
                      </form>
                    </div>
                  ))}
                  <form action={addRecipeAction} className="inline">
                    <input type="hidden" name="parentId" value={item.id} />
                    <select name="ingredientId" aria-label={`Υλικό για ${item.name}`}>
                      {ingredients.map((ingredient) => (
                        <option key={ingredient.id} value={ingredient.id}>
                          {ingredient.name}
                        </option>
                      ))}
                    </select>
                    <input name="qty" placeholder="0,150" aria-label={`Ποσότητα για ${item.name}`} />
                    <button className="secondary" type="submit">
                      Στη συνταγή
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
