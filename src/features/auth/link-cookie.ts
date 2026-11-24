import "server-only";

import { cookies } from "next/headers";
import { getAuthCookieOptions } from "@/lib/supabase/config";
import { isAuthLinkToken, type AuthLinkType } from "./email-flow";

const lifetimeSeconds = 15 * 60;

export function authLinkCookie(type: AuthLinkType) {
  const options = getAuthCookieOptions();

  return {
    ...options,
    name: (options.secure ? "__Host-" : "") + (type === "email" ? "bf-confirm-email" : "bf-recover-account"),
    maxAge: lifetimeSeconds,
  } as const;
}

export async function getAuthLinkToken(type: AuthLinkType) {
  const store = await cookies();
  const value = store.get(authLinkCookie(type).name)?.value;
  return isAuthLinkToken(value) ? value : undefined;
}

export async function clearAuthLinkToken(type: AuthLinkType) {
  const store = await cookies();
  store.set({ ...authLinkCookie(type), value: "", maxAge: 0 });
}
