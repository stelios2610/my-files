import { randomUUID } from "node:crypto";
import type { DB } from "./sqlite";

export const COMPANY_ID = "co_elia";

type SeedItem = {
  id: string;
  name: string;
  unit: "tem" | "kg" | "lt";
  categoryId?: string;
  priceGross?: number;
  vatRateId?: string;
  tracksStock?: boolean;
  onMenu?: boolean;
  openingMilli?: number;
};

const categories = [
  { id: "cat_salad", name: "Ορεκτικά", position: 1 },
  { id: "cat_kitchen", name: "Κουζίνα", position: 2 },
  { id: "cat_drink", name: "Ποτά", position: 3 },
];

const items: SeedItem[] = [
  { id: "item_tomato", name: "Ντομάτα", unit: "kg", tracksStock: true, openingMilli: 8000 },
  { id: "item_cucumber", name: "Αγγούρι", unit: "kg", tracksStock: true, openingMilli: 5000 },
  { id: "item_feta", name: "Φέτα", unit: "kg", tracksStock: true, openingMilli: 3000 },
  { id: "item_onion", name: "Κρεμμύδι", unit: "kg", tracksStock: true, openingMilli: 2000 },
  { id: "item_olive", name: "Ελιά", unit: "kg", tracksStock: true, openingMilli: 1000 },
  { id: "item_oil", name: "Ελαιόλαδο", unit: "lt", tracksStock: true, openingMilli: 4000 },
  { id: "item_beef_meat", name: "Μοσχάρι", unit: "kg", tracksStock: true, openingMilli: 6000 },
  { id: "item_pork_meat", name: "Χοιρινό", unit: "kg", tracksStock: true, openingMilli: 5000 },
  { id: "item_potato", name: "Πατάτα", unit: "kg", tracksStock: true, openingMilli: 10000 },
  { id: "item_yogurt", name: "Γιαούρτι", unit: "kg", tracksStock: true, openingMilli: 2000 },
  { id: "item_garlic", name: "Σκόρδο", unit: "kg", tracksStock: true, openingMilli: 300 },
  { id: "item_lemon", name: "Λεμόνι", unit: "kg", tracksStock: true, openingMilli: 1000 },
  { id: "item_coffee_beans", name: "Καφές", unit: "kg", tracksStock: true, openingMilli: 1000 },
  { id: "item_wine_bulk", name: "Κρασί χύμα", unit: "lt", tracksStock: true, openingMilli: 20000 },
  { id: "item_ouzo_bulk", name: "Ούζο", unit: "lt", tracksStock: true, openingMilli: 2000 },
  {
    id: "item_horiatiki",
    name: "Χωριάτικη",
    unit: "tem",
    categoryId: "cat_salad",
    priceGross: 950,
    vatRateId: "vat_13",
    onMenu: true,
  },
  {
    id: "item_tzatziki",
    name: "Τζατζίκι",
    unit: "tem",
    categoryId: "cat_salad",
    priceGross: 450,
    vatRateId: "vat_13",
    onMenu: true,
  },
  {
    id: "item_potatoes",
    name: "Τηγανητές πατάτες",
    unit: "tem",
    categoryId: "cat_kitchen",
    priceGross: 400,
    vatRateId: "vat_13",
    onMenu: true,
  },
  {
    id: "item_beef",
    name: "Μοσχάρι λεμονάτο",
    unit: "tem",
    categoryId: "cat_kitchen",
    priceGross: 1450,
    vatRateId: "vat_13",
    onMenu: true,
  },
  {
    id: "item_pork",
    name: "Χοιρινή μπριζόλα",
    unit: "tem",
    categoryId: "cat_kitchen",
    priceGross: 1300,
    vatRateId: "vat_13",
    onMenu: true,
  },
  {
    id: "item_coffee",
    name: "Ελληνικός",
    unit: "tem",
    categoryId: "cat_drink",
    priceGross: 250,
    vatRateId: "vat_13",
    onMenu: true,
  },
  {
    id: "item_water",
    name: "Νερό 500ml",
    unit: "tem",
    categoryId: "cat_drink",
    priceGross: 100,
    vatRateId: "vat_13",
    tracksStock: true,
    onMenu: true,
    openingMilli: 40000,
  },
  {
    id: "item_beer",
    name: "Μπύρα 500ml",
    unit: "tem",
    categoryId: "cat_drink",
    priceGross: 400,
    vatRateId: "vat_24",
    tracksStock: true,
    onMenu: true,
    openingMilli: 48000,
  },
  {
    id: "item_wine",
    name: "Ποτήρι κρασί",
    unit: "tem",
    categoryId: "cat_drink",
    priceGross: 450,
    vatRateId: "vat_24",
    onMenu: true,
  },
  {
    id: "item_ouzo",
    name: "Ούζο",
    unit: "tem",
    categoryId: "cat_drink",
    priceGross: 350,
    vatRateId: "vat_24",
    onMenu: true,
  },
  {
    id: "item_cola",
    name: "Κόλα",
    unit: "tem",
    categoryId: "cat_drink",
    priceGross: 250,
    vatRateId: "vat_24",
    tracksStock: true,
    onMenu: true,
    openingMilli: 24000,
  },
];

const recipes: { parentId: string; ingredientId: string; qtyMilli: number }[] = [
  { parentId: "item_horiatiki", ingredientId: "item_tomato", qtyMilli: 150 },
  { parentId: "item_horiatiki", ingredientId: "item_cucumber", qtyMilli: 80 },
  { parentId: "item_horiatiki", ingredientId: "item_feta", qtyMilli: 80 },
  { parentId: "item_horiatiki", ingredientId: "item_onion", qtyMilli: 30 },
  { parentId: "item_horiatiki", ingredientId: "item_olive", qtyMilli: 30 },
  { parentId: "item_horiatiki", ingredientId: "item_oil", qtyMilli: 20 },
  { parentId: "item_tzatziki", ingredientId: "item_yogurt", qtyMilli: 150 },
  { parentId: "item_tzatziki", ingredientId: "item_cucumber", qtyMilli: 40 },
  { parentId: "item_tzatziki", ingredientId: "item_garlic", qtyMilli: 5 },
  { parentId: "item_tzatziki", ingredientId: "item_oil", qtyMilli: 10 },
  { parentId: "item_potatoes", ingredientId: "item_potato", qtyMilli: 250 },
  { parentId: "item_potatoes", ingredientId: "item_oil", qtyMilli: 40 },
  { parentId: "item_beef", ingredientId: "item_beef_meat", qtyMilli: 250 },
  { parentId: "item_beef", ingredientId: "item_potato", qtyMilli: 200 },
  { parentId: "item_beef", ingredientId: "item_oil", qtyMilli: 20 },
  { parentId: "item_beef", ingredientId: "item_lemon", qtyMilli: 40 },
  { parentId: "item_pork", ingredientId: "item_pork_meat", qtyMilli: 280 },
  { parentId: "item_pork", ingredientId: "item_oil", qtyMilli: 15 },
  { parentId: "item_pork", ingredientId: "item_lemon", qtyMilli: 20 },
  { parentId: "item_coffee", ingredientId: "item_coffee_beans", qtyMilli: 8 },
  { parentId: "item_wine", ingredientId: "item_wine_bulk", qtyMilli: 150 },
  { parentId: "item_ouzo", ingredientId: "item_ouzo_bulk", qtyMilli: 50 },
];

export function seedIfEmpty(db: DB): void {
  const existing = db.prepare("SELECT COUNT(*) AS count FROM company").get() as { count: number };
  if (Number(existing.count) > 0) return;

  const now = new Date().toISOString();
  const insertItem = db.prepare(
    `INSERT INTO item (
      id, company_id, category_id, name, unit, price_gross, vat_rate_id, tracks_stock, on_menu, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  );
  const insertMovement = db.prepare(
    `INSERT INTO stock_movement (id, company_id, item_id, qty_milli, reason, note, created_at)
     VALUES (?, ?, ?, ?, 'opening', 'Αρχικό απόθεμα', ?)`,
  );

  db.exec("BEGIN");
  try {
    db.prepare("INSERT INTO company (id, name, vat_number, address) VALUES (?, ?, ?, ?)").run(
      COMPANY_ID,
      "Ταβέρνα η Ελιά",
      "800345678",
      "Παραλιακή 12",
    );
    db.prepare("INSERT INTO vat_rate (id, company_id, name, rate_bps) VALUES (?, ?, ?, ?)").run(
      "vat_13",
      COMPANY_ID,
      "ΦΠΑ 13%",
      1300,
    );
    db.prepare("INSERT INTO vat_rate (id, company_id, name, rate_bps) VALUES (?, ?, ?, ?)").run(
      "vat_24",
      COMPANY_ID,
      "ΦΠΑ 24%",
      2400,
    );
    for (const category of categories) {
      db.prepare("INSERT INTO category (id, company_id, name, position) VALUES (?, ?, ?, ?)").run(
        category.id,
        COMPANY_ID,
        category.name,
        category.position,
      );
    }
    for (const item of items) {
      insertItem.run(
        item.id,
        COMPANY_ID,
        item.categoryId ?? null,
        item.name,
        item.unit,
        item.priceGross ?? null,
        item.vatRateId ?? null,
        item.tracksStock ? 1 : 0,
        item.onMenu ? 1 : 0,
      );
      if (item.openingMilli) {
        insertMovement.run(randomUUID(), COMPANY_ID, item.id, item.openingMilli, now);
      }
    }
    const insertRecipe = db.prepare(
      "INSERT INTO recipe_line (id, parent_item_id, ingredient_item_id, qty_milli) VALUES (?, ?, ?, ?)",
    );
    for (const recipe of recipes) insertRecipe.run(randomUUID(), recipe.parentId, recipe.ingredientId, recipe.qtyMilli);

    db.prepare("INSERT INTO modifier_group (id, company_id, name, required) VALUES (?, ?, ?, ?)").run(
      "grp_salad",
      COMPANY_ID,
      "Υλικά",
      0,
    );
    db.prepare("INSERT INTO modifier_group (id, company_id, name, required) VALUES (?, ?, ?, ?)").run(
      "grp_coffee",
      COMPANY_ID,
      "Βράσιμο",
      1,
    );
    const insertModifier = db.prepare("INSERT INTO modifier (id, group_id, name, price_delta) VALUES (?, ?, ?, ?)");
    insertModifier.run("mod_no_onion", "grp_salad", "Χωρίς κρεμμύδι", 0);
    insertModifier.run("mod_extra_feta", "grp_salad", "Έξτρα φέτα", 120);
    insertModifier.run("mod_sketos", "grp_coffee", "Σκέτος", 0);
    insertModifier.run("mod_metrios", "grp_coffee", "Μέτριος", 0);
    insertModifier.run("mod_glykos", "grp_coffee", "Γλυκός", 0);
    db.prepare("INSERT INTO item_modifier_group (item_id, group_id) VALUES (?, ?)").run("item_horiatiki", "grp_salad");
    db.prepare("INSERT INTO item_modifier_group (item_id, group_id) VALUES (?, ?)").run("item_coffee", "grp_coffee");

    db.prepare("INSERT INTO area (id, company_id, name, position) VALUES (?, ?, ?, ?)").run("area_sala", COMPANY_ID, "Σάλα", 1);
    db.prepare("INSERT INTO area (id, company_id, name, position) VALUES (?, ?, ?, ?)").run("area_avli", COMPANY_ID, "Αυλή", 2);
    const insertTable = db.prepare("INSERT INTO dining_table (id, area_id, name, position) VALUES (?, ?, ?, ?)");
    for (let index = 1; index <= 6; index += 1) insertTable.run(`table_s${index}`, "area_sala", `Τ${index}`, index);
    for (let index = 1; index <= 4; index += 1) insertTable.run(`table_a${index}`, "area_avli", `Α${index}`, index);

    db.prepare("INSERT INTO series (id, company_id, code, doc_type, next_number) VALUES (?, ?, ?, ?, ?)").run(
      "series_order",
      COMPANY_ID,
      "ΠΑΡ",
      "order",
      1,
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
