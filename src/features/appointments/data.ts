import "server-only";

import { loadCatalogPage } from "@/features/workspace/catalog-list";
import { createClient } from "@/lib/supabase/server";

export async function getAppointmentCustomers(organizationId: string, page = 1, query = "") {
  const catalog = await loadCatalogPage("customers", organizationId, page, query);
  return {
    page: catalog.page,
    query: catalog.query,
    hasNext: catalog.hasNext,
    failed: catalog.failed,
    rows: catalog.rows.map(({ id, name, detail }) => ({ id, name, contact: detail.split(" · ")[0] })),
  };
}

export type AppointmentCustomers = Awaited<ReturnType<typeof getAppointmentCustomers>>;

export async function getActiveAppointmentServices(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("id, name, duration_minutes")
    .eq("organization_id", organizationId).eq("active", true).order("name").order("id");
  return data;
}

export async function listAppointments(organizationId: string, day: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_appointments_with_payments", { p_organization_id: organizationId, p_day: day });
  return data;
}

export async function listAppointmentPeriod(organizationId: string, first: string, last: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("appointments_period", { p_organization_id: organizationId, p_first: first, p_last: last });
  return data;
}
