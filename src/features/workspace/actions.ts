"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { organizationSchema } from "@/lib/validation/organization";
import { getWorkspace } from "./access";

export type OnboardingState = {
  message?: string;
  errors?: Partial<Record<keyof z.infer<typeof organizationSchema>, string[]>>;
};

export async function createOrganization(_previous: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const workspace = await getWorkspace();
  if (workspace.state === "anonymous" || workspace.state === "unconfigured") redirect("/login");
  if (workspace.state === "ready") redirect(workspace.role === "barber" ? "/agenda" : "/painel");
  if (workspace.state !== "needs-onboarding") redirect("/acesso");

  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_timezone: parsed.data.timezone,
  });

  if (error?.code === "23505") return { errors: { slug: ["Esse identificador já está em uso."] } };
  if (error?.code === "22023") return { message: "Confira o nome, o identificador e o fuso da barbearia." };
  if (error?.code === "42501") redirect("/painel");
  if (error) return { message: "Não foi possível cadastrar a barbearia. Tente novamente." };

  revalidatePath("/painel");
  redirect("/painel");
}
