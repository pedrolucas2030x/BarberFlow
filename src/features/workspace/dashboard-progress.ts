import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getDashboardProgress(organizationId: string) {
  const supabase = await createClient();
  const [services, team, customers] = await Promise.all([
    supabase.from("services").select("id").eq("organization_id", organizationId).eq("active", true).limit(1),
    supabase.from("professionals").select("id").eq("organization_id", organizationId).eq("active", true).limit(1),
    supabase.from("customers").select("id").eq("organization_id", organizationId).limit(1),
  ]);

  if (services.error || team.error || customers.error) return null;
  return { services: services.data.length > 0, team: team.data.length > 0, customers: customers.data.length > 0 };
}
