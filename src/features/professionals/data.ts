import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function listProfessionals(organizationId: string) {
  const supabase = await createClient();
  return supabase.from("professionals").select("id, name, commission_bps, active")
    .eq("organization_id", organizationId)
    .order("active", { ascending: false }).order("name").order("id");
}

export async function getProfessional(organizationId: string, professionalId: string) {
  const supabase = await createClient();
  return supabase.from("professionals").select("id, name, active")
    .eq("organization_id", organizationId).eq("id", professionalId).maybeSingle();
}
