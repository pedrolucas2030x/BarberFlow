"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/features/workspace/access";
import { createClient } from "@/lib/supabase/server";
import { professionalSchema, professionalStatusSchema } from "@/lib/validation/professionals";
import { teamFormError, teamFormSuccess, type TeamFormState } from "./form-state";

export async function saveProfessional(previous: TeamFormState, form: FormData): Promise<TeamFormState> {
  const { organization } = await requireWorkspace();
  const parsed = professionalSchema.safeParse({ id: form.get("id"), name: form.get("name"), commission: form.get("commission") });
  if (!parsed.success) return teamFormError(previous, "Revise os campos destacados.", z.flattenError(parsed.error).fieldErrors);

  const { id, name, commission } = parsed.data;
  const supabase = await createClient();
  const values = { name, commission_bps: commission };
  const query = id
    ? supabase.from("professionals").update(values).eq("organization_id", organization.id).eq("id", id)
    : supabase.from("professionals").insert({ ...values, organization_id: organization.id });
  const { data, error } = await query.select("id").maybeSingle();

  if (error) return teamFormError(previous, "Não foi possível salvar o profissional. Tente novamente.");
  if (!data) return teamFormError(previous, "Profissional indisponível para edição.");

  revalidatePath("/equipe");
  revalidatePath(`/equipe/${data.id}/expediente`);
  return teamFormSuccess(previous, id ? "Profissional atualizado." : "Profissional cadastrado.");
}

export async function setProfessionalStatus(previous: TeamFormState, form: FormData): Promise<TeamFormState> {
  const { organization } = await requireWorkspace();
  const parsed = professionalStatusSchema.safeParse({ id: form.get("id"), active: form.get("active") });
  if (!parsed.success) return teamFormError(previous, "Profissional ou situação inválida.");

  const { id, active: status } = parsed.data;
  const active = status === "true";
  const supabase = await createClient();
  const { data, error } = await supabase.from("professionals").update({ active })
    .eq("organization_id", organization.id).eq("id", id).select("id").maybeSingle();

  if (error) return teamFormError(previous, "Não foi possível alterar a situação do profissional.");
  if (!data) return teamFormError(previous, "Profissional indisponível para edição.");

  revalidatePath("/equipe");
  revalidatePath(`/equipe/${id}/expediente`);
  return teamFormSuccess(previous, active ? "Profissional ativado." : "Profissional desativado.");
}
