"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createOrder, payOrder, restock, type NewOrderLine } from "@/lib/orders";
import { MoneyError } from "@/lib/money";
import { ROLE_COOKIE } from "@/lib/actors";

export async function switchRoleAction(formData: FormData) {
  const role = String(formData.get("role") ?? "provider");
  const jar = await cookies();
  jar.set(ROLE_COOKIE, role, { path: "/" });
  redirect(role === "provider" ? "/provider" : "/patient");
}

export interface CreateOrderState {
  error?: string;
}

export async function createOrderAction(
  patientName: string,
  lines: NewOrderLine[],
): Promise<CreateOrderState> {
  let orderId: string;
  try {
    const order = await createOrder(patientName, lines);
    orderId = order.id;
  } catch (e) {
    if (e instanceof MoneyError) return { error: e.message };
    throw e;
  }
  revalidatePath("/provider");
  redirect(`/provider/orders/${orderId}`);
}

export interface PayState {
  status: "idle" | "paid" | "already_paid" | "declined";
  reason?: string;
}

export async function payOrderAction(
  orderId: string,
  _prev: PayState,
  formData: FormData,
): Promise<PayState> {
  const cardNumber = String(formData.get("cardNumber") ?? "");
  const result = await payOrder(orderId, cardNumber);
  revalidatePath("/provider");
  revalidatePath(`/pay/${orderId}`);
  if (result.outcome === "declined") {
    return { status: "declined", reason: result.reason };
  }
  return { status: result.outcome };
}

export async function restockAction(formData: FormData) {
  const supplementId = String(formData.get("supplementId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  if (supplementId && Number.isSafeInteger(quantity) && quantity !== 0) {
    await restock(supplementId, quantity, "manual restock from dashboard");
  }
  revalidatePath("/provider");
}
