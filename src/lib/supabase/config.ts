import "server-only";

function readOrigin(value?: string) {
  try {
    const url = new URL(value?.trim() ?? "");
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const isAllowedProtocol = url.protocol === "https:" || (isLoopback && url.protocol === "http:");

    if (!isAllowedProtocol || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function getSupabaseConfig() {
  // Avoid build-time substitution of public variables in the server bundle.
  const configuredUrl: string | undefined = Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_URL");
  const configuredKey: string | undefined = Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const url = readOrigin(configuredUrl);
  const publishableKey = configuredKey?.trim();

  if (!url || !publishableKey || !/^sb_publishable_[\w-]{11,}$/.test(publishableKey)) return null;

  return { url, publishableKey };
}

export function getAppUrl() {
  return readOrigin(process.env.BARBERFLOW_APP_URL) ?? (
    !process.env.BARBERFLOW_APP_URL && process.env.NODE_ENV === "development" ? "http://localhost:3000" : null
  );
}

export function getAuthCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: !getAppUrl()?.startsWith("http://"),
  };
}
