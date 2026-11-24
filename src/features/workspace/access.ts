import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { WorkspaceRole } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const roleLabels = {
  owner: "Proprietário",
  manager: "Gestor",
  barber: "Profissional",
} satisfies Record<WorkspaceRole, string>;

export const getWorkspace = cache(async () => {
  await connection();
  if (!getSupabaseConfig()) return { state: "unconfigured" } as const;

  const supabase = await createClient();
  const { data: identity, error: identityError } = await supabase.auth.getClaims();

  if (identityError?.name === "AuthRetryableFetchError" || (identityError?.status ?? 0) >= 500) {
    return { state: "unavailable" } as const;
  }

  const userId = identity?.claims.sub;
  if (identityError || !userId || identity?.claims.is_anonymous === true) return { state: "anonymous" } as const;

  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("role, organizations!inner(id, name, slug, timezone, status)")
    .eq("user_id", userId)
    .order("created_at")
    .order("id");

  if (error) return { state: "unavailable" } as const;
  if (!memberships.length) return { state: "needs-onboarding" } as const;

  const active = memberships.filter(({ organizations }) => organizations.status === "active");
  const membership = active.find(({ role }) => role === "owner" || role === "manager") ?? active[0];
  if (!membership) return { state: "inactive" } as const;

  return {
    state: "ready",
    organization: membership.organizations,
    role: membership.role,
  } as const;
});

export async function requireWorkspace(access: "admin" | "member" = "admin") {
  const workspace = await getWorkspace();

  switch (workspace.state) {
    case "anonymous":
    case "unconfigured":
      redirect("/login");
    case "needs-onboarding":
      redirect("/onboarding");
    case "unavailable":
    case "inactive":
      redirect("/acesso");
    case "ready":
      if (access === "admin" && workspace.role === "barber") redirect("/agenda");
      return workspace;
  }
}
