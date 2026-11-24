import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

export type PublicOffer = {
  service: string;
  name: string;
  description: string | null;
  minutes: number;
  price: number;
  professional: string;
  professionalName: string;
  specialties: string | null;
};
export type PublicCatalog = { name: string; timezone: string; offers: PublicOffer[] };
export type PublicConfirmation = {
  status: "confirmed"; name: string; service: string; professional: string; start: string; timezone: string; price: number;
};

export function bookingClient() {
  const config = getSupabaseConfig();
  const key = process.env.SUPABASE_BOOKING_SECRET?.trim() || process.env.SUPABASE_SECRET_KEY?.trim();
  if (!config || !key) return null;
  return { key, client: createClient(config.url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (input, options) => fetch(input, { ...options, cache: "no-store" }) },
  }) };
}

export async function publicCatalog(slug: string) {
  const backend = bookingClient();
  if (!backend) return { unavailable: true, catalog: null };
  const { data, error } = await backend.client.rpc("public_catalog", { p_slug: slug });
  return { unavailable: Boolean(error), catalog: data as PublicCatalog | null };
}
