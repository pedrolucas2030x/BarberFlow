import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CatalogKind = "services" | "customers";

export type CatalogPage = {
  rows: { id: string; name: string; detail: string; active?: boolean }[];
  query: string;
  page: number;
  hasNext: boolean;
  failed: boolean;
};

const pageSize = 30;
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function parseCatalogPage(value: unknown) {
  return typeof value === "string" && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : 1;
}

function namePattern(query: string) {
  return `%${query.replace(/[\\%_*]/g, (character) => `\\${character}`)}%`;
}

function displayPhone(phone: string) {
  return phone.replace(/^\+55(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
}

export async function loadCatalogPage(kind: CatalogKind, organizationId: string, page: number, query = ""): Promise<CatalogPage> {
  const supabase = await createClient();
  const offset = (page - 1) * pageSize;

  if (kind === "services") {
    const request = supabase.from("services").select("id, name, duration_minutes, price_cents, active")
      .eq("organization_id", organizationId).order("active", { ascending: false }).order("name").order("id");
    if (query) request.ilike("name", namePattern(query));
    const { data, error } = await request.range(offset, offset + pageSize);
    const rows = data?.slice(0, pageSize).map(({ id, name, price_cents, duration_minutes, active }) => ({
      id, name, active, detail: `${currency.format(price_cents / 100)} · ${duration_minutes} min`,
    })) ?? [];
    return { rows, page, query, hasNext: (data?.length ?? 0) > pageSize, failed: Boolean(error) };
  }

  const request = supabase.from("customers").select("id, name, phone, marketing_consent")
    .eq("organization_id", organizationId).order("name").order("id");
  if (query) {
    const digits = query.replace(/\D/g, "");
    if (digits && /^[+\d().\s-]+$/.test(query)) request.like("phone", `%${digits}%`);
    else request.ilike("name", namePattern(query));
  }
  const { data, error } = await request.range(offset, offset + pageSize);
  const rows = data?.slice(0, pageSize).map(({ id, name, phone, marketing_consent }) => ({
    id, name, detail: `${displayPhone(phone)} · ${marketing_consent ? "Marketing autorizado" : "Sem autorização para marketing"}`,
  })) ?? [];
  return { rows, page, query, hasNext: (data?.length ?? 0) > pageSize, failed: Boolean(error) };
}
