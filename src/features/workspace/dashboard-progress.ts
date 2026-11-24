import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getDashboardProgress(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("id")
    .eq("organization_id", organizationId).eq("active", true).limit(1);
  return data ? { services: data.length > 0 } : null;
}
