export const schemaSql = `
CREATE TABLE IF NOT EXISTS company (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vat_number TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS vat_rate (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id),
  name TEXT NOT NULL,
  rate_bps INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS category (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id),
  name TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS item (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id),
  category_id TEXT REFERENCES category(id),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  price_gross INTEGER,
  vat_rate_id TEXT REFERENCES vat_rate(id),
  tracks_stock INTEGER NOT NULL DEFAULT 0,
  on_menu INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS recipe_line (
  id TEXT PRIMARY KEY,
  parent_item_id TEXT NOT NULL REFERENCES item(id),
  ingredient_item_id TEXT NOT NULL REFERENCES item(id),
  qty_milli INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS modifier_group (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id),
  name TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS modifier (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES modifier_group(id),
  name TEXT NOT NULL,
  price_delta INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS item_modifier_group (
  item_id TEXT NOT NULL REFERENCES item(id),
  group_id TEXT NOT NULL REFERENCES modifier_group(id),
  PRIMARY KEY (item_id, group_id)
);

CREATE TABLE IF NOT EXISTS area (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id),
  name TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dining_table (
  id TEXT PRIMARY KEY,
  area_id TEXT NOT NULL REFERENCES area(id),
  name TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shift (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id),
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  opening_float INTEGER NOT NULL,
  closing_cash INTEGER
);

CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id),
  code TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  next_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS document (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id),
  series_id TEXT NOT NULL REFERENCES series(id),
  number INTEGER NOT NULL,
  doc_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'void')),
  table_id TEXT REFERENCES dining_table(id),
  shift_id TEXT REFERENCES shift(id),
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  UNIQUE (series_id, number)
);

CREATE TABLE IF NOT EXISTS document_line (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document(id),
  item_id TEXT NOT NULL REFERENCES item(id),
  name TEXT NOT NULL,
  qty_milli INTEGER NOT NULL,
  unit_price_gross INTEGER NOT NULL,
  vat_rate_bps INTEGER NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS document_line_modifier (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL REFERENCES document_line(id),
  modifier_id TEXT,
  name TEXT NOT NULL,
  price_delta INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payment (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document(id),
  shift_id TEXT NOT NULL REFERENCES shift(id),
  method TEXT NOT NULL CHECK (method IN ('cash', 'card')),
  amount INTEGER NOT NULL,
  paid_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movement (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id),
  item_id TEXT NOT NULL REFERENCES item(id),
  qty_milli INTEGER NOT NULL,
  reason TEXT NOT NULL,
  document_id TEXT REFERENCES document(id),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fiscal_handoff (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL UNIQUE REFERENCES document(id),
  payload TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent')),
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS document_company_status ON document(company_id, status);
CREATE INDEX IF NOT EXISTS document_table_status ON document(table_id, status);
CREATE INDEX IF NOT EXISTS stock_movement_item ON stock_movement(item_id);
`;
