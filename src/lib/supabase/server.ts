import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAuthCookieOptions, getSupabaseConfig } from "./config";
import type { Database } from "./database.types";

export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("A conexão com o Supabase precisa ser configurada.");

  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.publishableKey, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components are read-only; the proxy refreshes their session cookies.
        }
      },
    },
  });
}
