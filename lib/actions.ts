"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { parseEuroToCents, parseQtyToMilli } from "./money";
import {
  BusinessError,
  addLine,
  addPayment,
  addRecipeLine,
  adjustStock,
  closeDocument,
  closeShift,
  getCompany,
  markFiscalSent,
  openShift,
  openTable,
  removePayment,
  removeRecipeLine,
  setLineQty,
  updateItemPrice,
  voidDocument,
} from "./repo";

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
  try {
    openTable(getDb(), tableId);
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
  try {
    const result = addLine(getDb(), documentId, itemId, modifierIds);
    refresh(result.tableId);
    return null;
  } catch (error) {
    if (error instanceof BusinessError) return { error: error.message };
    throw error;
  }
}

export async function setLineQtyAction(formData: FormData) {
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
  try {
    const result = addPayment(getDb(), documentId, method, cents);
    refresh(result.tableId);
    const change = result.change > 0 ? `&change=${result.change}` : "";
    redirect(`/tables/${tableId}?paid=1${change}`);
  } catch (error) {
    if (error instanceof BusinessError) bounce(`/tables/${tableId}`, error.message);
    throw error;
  }
}

export async function removePaymentAction(formData: FormData) {
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
