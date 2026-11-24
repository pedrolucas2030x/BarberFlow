import "server-only";

import { connection } from "next/server";
import { getAppUrl, getSupabaseConfig } from "@/lib/supabase/config";

export async function isAuthAvailable() {
  await connection();
  return Boolean(getAppUrl() && getSupabaseConfig());
}
