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

export async function listAppointments(organizationId: string, day: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_appointments_with_payments", { p_organization_id: organizationId, p_day: day });
  return data;
}

export async function getBookableProfessionals(organizationId: string) {
  const supabase = await createClient();
  const [professionals, services, links] = await Promise.all([
    supabase.from("professionals").select("id, name").eq("organization_id", organizationId)
      .eq("active", true).order("name").order("id"),
    supabase.from("services").select("id, name, duration_minutes").eq("organization_id", organizationId)
      .eq("active", true).order("name").order("id"),
    supabase.from("professional_services").select("professional_id, service_id").eq("organization_id", organizationId),
  ]);

  if (professionals.error || services.error || links.error) return null;
  const availableServices = new Map(services.data.map((service) => [service.id, service]));
  const servicesByProfessional = new Map<string, (typeof services.data)>();
  for (const link of links.data) {
    const service = availableServices.get(link.service_id);
    if (!service) continue;
    const linkedServices = servicesByProfessional.get(link.professional_id) ?? [];
    linkedServices.push(service);
    servicesByProfessional.set(link.professional_id, linkedServices);
  }

  return professionals.data.flatMap((professional) => {
    const linkedServices = servicesByProfessional.get(professional.id);
    return linkedServices ? [{
      ...professional,
      services: linkedServices.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    }] : [];
  });
}
