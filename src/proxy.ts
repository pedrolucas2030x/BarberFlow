import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthCookieOptions, getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();

  if (config) {
    const supabase = createServerClient<Database>(config.url, config.publishableKey, {
      cookieOptions: getAuthCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
        },
      },
    });

    await supabase.auth.getClaims();
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/painel/:path*", "/agenda/:path*", "/clientes/:path*", "/servicos/:path*", "/equipe/:path*",
    "/financeiro/:path*", "/configuracoes/:path*", "/onboarding", "/acesso", "/login", "/cadastro",
    "/recuperar-senha", "/confirmar-email", "/redefinir-senha",
  ],
};
