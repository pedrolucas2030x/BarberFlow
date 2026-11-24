import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getProfessionalSchedule(organizationId: string, professionalId: string) {
  const supabase = await createClient();
  const [services, links, shifts, blocks] = await Promise.all([
    supabase.from("services").select("id, name, active")
      .eq("organization_id", organizationId).order("name").order("id"),
    supabase.from("professional_services").select("service_id")
      .eq("organization_id", organizationId).eq("professional_id", professionalId),
    supabase.from("working_hours").select("id, weekday, starts_at, ends_at, break_starts_at, break_ends_at")
      .eq("organization_id", organizationId).eq("professional_id", professionalId).order("weekday"),
    supabase.from("time_off").select("id, starts_at, ends_at, reason")
      .eq("organization_id", organizationId).eq("professional_id", professionalId).order("starts_at").order("id"),
  ]);

  if (services.error || links.error || shifts.error || blocks.error) return null;

  const linkedIds = new Set(links.data.map(({ service_id }) => service_id));
  return {
    linkedServices: services.data.filter(({ id }) => linkedIds.has(id)),
    availableServices: services.data.filter(({ id, active }) => active && !linkedIds.has(id)),
    shifts: shifts.data,
    blocks: blocks.data,
  };
}
