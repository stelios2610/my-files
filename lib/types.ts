import type { VatBucket } from "./money";

export type FloorTable = {
  id: string;
  name: string;
  documentId: string | null;
  gross: number | null;
  itemCount: number;
  openedMinutes: number | null;
};

export type FloorArea = {
  id: string;
  name: string;
  tables: FloorTable[];
};

export type MenuModifier = {
  id: string;
  name: string;
  priceDelta: number;
};

export type MenuGroup = {
  id: string;
  name: string;
  required: boolean;
  modifiers: MenuModifier[];
};

export type MenuItem = {
  id: string;
  name: string;
  priceGross: number;
  vatRateBps: number;
  groups: MenuGroup[];
};

export type MenuCategory = {
  id: string;
  name: string;
  items: MenuItem[];
};

export type TicketModifier = {
  id: string;
  name: string;
  priceDelta: number;
};

export type TicketLine = {
  id: string;
  name: string;
  qtyMilli: number;
  unitPriceGross: number;
  vatRateBps: number;
  modifiers: TicketModifier[];
  gross: number;
};

export type PaymentRow = {
  id: string;
  method: "cash" | "card";
  amount: number;
};

export type Ticket = {
  documentId: string;
  numberLabel: string;
  tableId: string;
  tableName: string;
  areaName: string;
  openedAt: string;
  lines: TicketLine[];
  payments: PaymentRow[];
  gross: number;
  net: number;
  vat: number;
  buckets: VatBucket[];
  paid: number;
  remaining: number;
};

export type ShiftInfo = {
  id: string;
  openedAt: string;
  openingFloat: number;
};

export type CompanyInfo = {
  id: string;
  name: string;
  vatNumber: string;
  address: string;
};
