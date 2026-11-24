import type { PaymentMethod } from "@/lib/supabase/database.types";

export const paymentMethods = {
  pix: "Pix",
  cash: "Dinheiro",
  debit: "Cartão de débito",
  credit: "Cartão de crédito",
} satisfies Record<PaymentMethod, string>;

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && Object.hasOwn(paymentMethods, value);
}
