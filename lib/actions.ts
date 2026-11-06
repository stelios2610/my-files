"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSession, currentStaff, startSession } from "./auth";
import { getDb } from "./db";
import { parseEuroToCents, parseQtyToMilli } from "./money";
import {
  BusinessError,
  addLine,
  addPayment,
  addRecipeLine,
  adjustStock,
  changeStaffPin,
  closeDocument,
  closeShift,
  createStaff,
  getCompany,
  markFiscalSent,
  openShift,
  openTable,
  removePayment,
  removeRecipeLine,
  setLineQty,
  staffByPin,
  updateItemPrice,
  voidDocument,
} from "./repo";
import type { StaffMember } from "./types";

const pinFailures = new Map<string, { count: number; until: number }>();

async function actor(): Promise<StaffMember> {
  const staff = await currentStaff();
  if (!staff) redirect("/login");
  return staff;
}

function refresh(tableId?: string, documentId?: string) {
  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/stock");
  revalidatePath("/shift");
  revalidatePath("/documents");
  if (tableId) revalidatePath(`/tables/${tableId}`);
  if (documentId) revalidatePath(`/documents/${documentId}`);
}

function bounce(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function openTableAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const tableId = String(formData.get("tableId") ?? "");
  const staff = await actor();
  try {
    openTable(getDb(), tableId, staff.id);
  } catch (error) {
    if (error instanceof BusinessError) return { error: error.message };
    throw error;
  }
  revalidatePath("/");
  redirect(`/tables/${tableId}`);
}

export async function addLineAction(
  documentId: string,
  itemId: string,
  modifierIds: string[],
): Promise<{ error: string } | null> {
  const staff = await actor();
  try {
    const result = addLine(getDb(), documentId, itemId, modifierIds, staff.id);
    refresh(result.tableId);
    return null;
  } catch (error) {
    if (error instanceof BusinessError) return { error: error.message };
    throw error;
  }
}

export async function setLineQtyAction(formData: FormData) {
  await actor();
  const lineId = String(formData.get("lineId") ?? "");
  const qty = Number(formData.get("qty") ?? "");
  const tableId = String(formData.get("tableId") ?? "");
  try {
    const result = setLineQty(getDb(), lineId, qty);
    refresh(result.tableId);
  } catch (error) {
    if (error instanceof BusinessError) bounce(`/tables/${tableId}`, error.message);
    throw error;
  }
  redirect(`/tables/${tableId}`);
}

export async function addPaymentAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "");
  const tableId = String(formData.get("tableId") ?? "");
  const method = String(formData.get("method") ?? "");
  const cents = parseEuroToCents(String(formData.get("amount") ?? ""));
  if (method !== "cash" && method !== "card") bounce(`/tables/${tableId}`, "Άκυρος τρόπος πληρωμής.");
  if (cents == null) bounce(`/tables/${tableId}`, "Γράψε ποσό, για παράδειγμα 12,50.");
  const staff = await actor();
  try {
    const result = addPayment(getDb(), documentId, method, cents, staff.id);
    refresh(result.tableId);
    const change = result.change > 0 ? `&change=${result.change}` : "";
    redirect(`/tables/${tableId}?paid=1${change}`);
  } catch (error) {
    if (error instanceof BusinessError) bounce(`/tables/${tableId}`, error.message);
    throw error;
  }
}

export async function removePaymentAction(formData: FormData) {
  await actor();
  const paymentId = String(formData.get("paymentId") ?? "");
  const tableId = String(formData.get("tableId") ?? "");
  try {
    const result = removePayment(getDb(), paymentId);
    refresh(result.tableId);
  } catch (error) {
    if (error instanceof BusinessError) bounce(`/tables/${tableId}`, error.message);
    throw error;
  }
  redirect(`/tables/${tableId}`);
}

export async function closeDocumentAction(formData: FormData) {
  await actor();
  const documentId = String(formData.get("documentId") ?? "");
  const tableId = String(formData.get("tableId") ?? "");
  try {
    closeDocument(getDb(), documentId);
  } catch (error) {
    if (error instanceof BusinessError) bounce(`/tables/${tableId}`, error.message);
    throw error;
  }
  refresh(tableId, documentId);
  redirect(`/documents/${documentId}`);
}

export async function voidDocumentAction(formData: FormData) {
  await actor();
  const documentId = String(formData.get("documentId") ?? "");
  const tableId = String(formData.get("tableId") ?? "");
  try {
    voidDocument(getDb(), documentId);
  } catch (error) {
    if (error instanceof BusinessError) bounce(`/tables/${tableId}`, error.message);
    throw error;
  }
  refresh(tableId);
  redirect("/");
}

export async function openShiftAction(formData: FormData) {
  await actor();
  const cents = parseEuroToCents(String(formData.get("float") ?? ""));
  if (cents == null) bounce("/shift", "Γράψε το αρχικό ταμείο, για παράδειγμα 150,00.");
  try {
    openShift(getDb(), getCompany(getDb()).id, cents);
  } catch (error) {
    if (error instanceof BusinessError) bounce("/shift", error.message);
    throw error;
  }
  refresh();
  redirect("/shift");
}

export async function closeShiftAction(formData: FormData) {
  await actor();
  const cents = parseEuroToCents(String(formData.get("counted") ?? ""));
  if (cents == null) bounce("/shift", "Γράψε τα μετρητά που μέτρησες.");
  try {
    closeShift(getDb(), getCompany(getDb()).id, cents);
  } catch (error) {
    if (error instanceof BusinessError) bounce("/shift", error.message);
    throw error;
  }
  refresh();
  redirect("/shift?closed=1");
}

export async function markFiscalSentAction(formData: FormData) {
  await actor();
  const documentId = String(formData.get("documentId") ?? "");
  try {
    markFiscalSent(getDb(), documentId);
  } catch (error) {
    if (error instanceof BusinessError) bounce(`/documents/${documentId}`, error.message);
    throw error;
  }
  refresh(undefined, documentId);
  redirect(`/documents/${documentId}`);
}

export async function updatePriceAction(formData: FormData) {
  await actor();
  const itemId = String(formData.get("itemId") ?? "");
  const cents = parseEuroToCents(String(formData.get("price") ?? ""));
  if (cents == null) bounce("/menu", "Άκυρη τιμή.");
  try {
    updateItemPrice(getDb(), itemId, cents);
  } catch (error) {
    if (error instanceof BusinessError) bounce("/menu", error.message);
    throw error;
  }
  refresh();
  redirect("/menu");
}

export async function addRecipeAction(formData: FormData) {
  await actor();
  const parentId = String(formData.get("parentId") ?? "");
  const ingredientId = String(formData.get("ingredientId") ?? "");
  const qty = parseQtyToMilli(String(formData.get("qty") ?? ""));
  if (qty == null || qty <= 0) bounce("/menu", "Η ποσότητα συνταγής γράφεται ως 0,150.");
  try {
    addRecipeLine(getDb(), parentId, ingredientId, qty);
  } catch (error) {
    if (error instanceof BusinessError) bounce("/menu", error.message);
    throw error;
  }
  refresh();
  redirect("/menu");
}

export async function removeRecipeAction(formData: FormData) {
  await actor();
  const recipeLineId = String(formData.get("recipeLineId") ?? "");
  try {
    removeRecipeLine(getDb(), recipeLineId);
  } catch (error) {
    if (error instanceof BusinessError) bounce("/menu", error.message);
    throw error;
  }
  refresh();
  redirect("/menu");
}

export async function adjustStockAction(formData: FormData) {
  await actor();
  const itemId = String(formData.get("itemId") ?? "");
  const qty = parseQtyToMilli(String(formData.get("qty") ?? ""));
  const note = String(formData.get("note") ?? "");
  if (qty == null || qty === 0) bounce("/stock", "Η διόρθωση γράφεται ως 2 ή -0,5.");
  try {
    adjustStock(getDb(), getCompany(getDb()).id, itemId, qty, note);
  } catch (error) {
    if (error instanceof BusinessError) bounce("/stock", error.message);
    throw error;
  }
  refresh();
  redirect("/stock");
}

export async function loginAction(pin: string): Promise<{ error: string } | null> {
  const now = Date.now();
  const failure = pinFailures.get("shop");
  if (failure && failure.until > now) return { error: "Πολλές προσπάθειες. Περίμενε λίγο." };
  const staff = staffByPin(getDb(), getCompany(getDb()).id, pin);
  if (!staff) {
    const count = failure && failure.until <= now ? failure.count + 1 : (failure?.count ?? 0) + 1;
    pinFailures.set("shop", { count, until: count >= 6 ? now + 20_000 : 0 });
    return { error: "Λάθος κωδικός." };
  }
  pinFailures.delete("shop");
  await startSession(staff.id);
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function changePinAction(formData: FormData) {
  const staff = await actor();
  if (staff.role !== "cashier") bounce("/staff", "Μόνο το ταμείο αλλάζει κωδικούς.");
  const staffId = String(formData.get("staffId") ?? "");
  const pin = String(formData.get("pin") ?? "");
  try {
    changeStaffPin(getDb(), staffId, pin);
  } catch (error) {
    if (error instanceof BusinessError) bounce("/staff", error.message);
    throw error;
  }
  revalidatePath("/staff");
  redirect("/staff");
}

export async function createStaffAction(formData: FormData) {
  const staff = await actor();
  if (staff.role !== "cashier") bounce("/staff", "Μόνο το ταμείο αλλάζει κωδικούς.");
  const name = String(formData.get("name") ?? "");
  const pin = String(formData.get("pin") ?? "");
  const role = String(formData.get("role") ?? "") === "cashier" ? "cashier" : "waiter";
  try {
    createStaff(getDb(), getCompany(getDb()).id, name, pin, role);
  } catch (error) {
    if (error instanceof BusinessError) bounce("/staff", error.message);
    throw error;
  }
  revalidatePath("/staff");
  redirect("/staff");
}
