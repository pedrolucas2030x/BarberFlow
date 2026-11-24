import { NextResponse } from "next/server";
import { authLinkPaths, readAuthLink } from "@/features/auth/email-flow";
import { authLinkCookie } from "@/features/auth/link-cookie";
import { getAppUrl, getSupabaseConfig } from "@/lib/supabase/config";

export function GET(request: Request) {
  const link = readAuthLink(new URL(request.url).searchParams);
  const canConfirm = Boolean(link?.token && getAppUrl() && getSupabaseConfig());
  const location = link
    ? authLinkPaths[link.type][canConfirm ? "pending" : "invalid"]
    : authLinkPaths.email.invalid;

  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });

  if (link?.token && canConfirm) {
    response.cookies.set({ ...authLinkCookie(link.type), value: link.token });
  } else if (link) {
    response.cookies.set({ ...authLinkCookie(link.type), value: "", maxAge: 0 });
  }

  return response;
}
