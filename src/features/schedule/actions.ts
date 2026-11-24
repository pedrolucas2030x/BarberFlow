"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

const scheduleConflict = "Há um agendamento nesse horário. Reagende ou cancele antes de mudar o expediente.";
import { teamFormError, teamFormSuccess, type TeamFormState } from "@/features/professionals/form-state";
import { requireWorkspace } from "@/features/workspace/access";
import { isSupportedTimeZone } from "@/lib/app-time-zone";
import { createClient } from "@/lib/supabase/server";
import { tenantDateTimeToInstant, timeOffSchema, weeklyShiftSchema } from "@/lib/validation/schedule";

const uuid = z.uuid();

async function resolveSchedule(form: FormData) {
  const { organization } = await requireWorkspace();
  const professional = uuid.safeParse(form.get("professional_id"));
  if (!professional.success) return { ok: false, problem: "Profissional inválido." } as const;

  const supabase = await createClient();
  const { data, error } = await supabase.from("professionals").select("id")
    .eq("organization_id", organization.id).eq("id", professional.data).maybeSingle();

  if (error) return { ok: false, problem: "Não foi possível consultar o profissional. Tente novamente." } as const;
  if (!data) return { ok: false, problem: "Profissional indisponível para edição." } as const;

  return { ok: true, organization, professionalId: data.id, supabase } as const;
}

function scheduleSaved(previous: TeamFormState, professionalId: string, message: string) {
  revalidatePath(`/equipe/${professionalId}/expediente`);
  return teamFormSuccess(previous, message);
}

export async function linkProfessionalService(previous: TeamFormState, form: FormData): Promise<TeamFormState> {
  const target = await resolveSchedule(form);
  if (!target.ok) return teamFormError(previous, target.problem);
  const serviceId = uuid.safeParse(form.get("service_id"));
  if (!serviceId.success) return teamFormError(previous, "Selecione um serviço válido.");

  const { supabase, organization, professionalId } = target;
  const { data: service, error: lookupError } = await supabase.from("services").select("id")
    .eq("organization_id", organization.id).eq("id", serviceId.data).eq("active", true).maybeSingle();

  if (lookupError) return teamFormError(previous, "Não foi possível consultar o serviço. Tente novamente.");
  if (!service) return teamFormError(previous, "O serviço está indisponível para vínculo.");

  const { error } = await supabase.from("professional_services").insert({
    organization_id: organization.id,
    professional_id: professionalId,
    service_id: service.id,
  });

  if (error?.code === "23505") return scheduleSaved(previous, professionalId, "O serviço já está vinculado.");
  if (error) return teamFormError(previous, "Não foi possível vincular o serviço. Tente novamente.");
  return scheduleSaved(previous, professionalId, "Serviço vinculado.");
}

export async function unlinkProfessionalService(previous: TeamFormState, form: FormData): Promise<TeamFormState> {
  const target = await resolveSchedule(form);
  if (!target.ok) return teamFormError(previous, target.problem);
  const serviceId = uuid.safeParse(form.get("service_id"));
  if (!serviceId.success) return teamFormError(previous, "Serviço inválido.");

  const { supabase, organization, professionalId } = target;
  const { data, error } = await supabase.from("professional_services").delete()
    .eq("organization_id", organization.id).eq("professional_id", professionalId).eq("service_id", serviceId.data)
    .select("service_id").maybeSingle();

  if (error) return teamFormError(previous, "Não foi possível remover o vínculo. Tente novamente.");
  if (!data) return teamFormError(previous, "Vínculo indisponível para remoção.");
  return scheduleSaved(previous, professionalId, "Vínculo removido.");
}

export async function saveWeeklyShift(previous: TeamFormState, form: FormData): Promise<TeamFormState> {
  const target = await resolveSchedule(form);
  if (!target.ok) return teamFormError(previous, target.problem);
  const parsed = weeklyShiftSchema.safeParse({
    id: form.get("id"),
    weekday: form.get("weekday"),
    starts_at: form.get("starts_at"),
    ends_at: form.get("ends_at"),
    break_starts_at: form.get("break_starts_at"),
    break_ends_at: form.get("break_ends_at"),
  });
  if (!parsed.success) return teamFormError(previous, "Revise o horário do turno.", z.flattenError(parsed.error).fieldErrors);

  const { supabase, organization, professionalId } = target;
  const { id, ...shift } = parsed.data;
  const query = id
    ? supabase.from("working_hours").update(shift)
      .eq("organization_id", organization.id).eq("professional_id", professionalId).eq("id", id)
    : supabase.from("working_hours").insert({ ...shift, organization_id: organization.id, professional_id: professionalId });
  const { data, error } = await query.select("id").maybeSingle();

  if (error?.code === "23505") return teamFormError(previous, "Já existe um turno para esse dia.", { weekday: ["Selecione outro dia."] });
  if (error) return teamFormError(previous, error.code === "BF030" ? scheduleConflict : "Não foi possível salvar o turno. Tente novamente.");
  if (!data) return teamFormError(previous, "Turno indisponível para edição.");
  return scheduleSaved(previous, professionalId, id ? "Turno atualizado." : "Turno cadastrado.");
}

export async function removeWeeklyShift(previous: TeamFormState, form: FormData): Promise<TeamFormState> {
  const target = await resolveSchedule(form);
  if (!target.ok) return teamFormError(previous, target.problem);
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return teamFormError(previous, "Turno inválido.");

  const { supabase, organization, professionalId } = target;
  const { data, error } = await supabase.from("working_hours").delete()
    .eq("organization_id", organization.id).eq("professional_id", professionalId).eq("id", id.data).select("id").maybeSingle();

  if (error) return teamFormError(previous, error.code === "BF030" ? scheduleConflict : "Não foi possível remover o turno. Tente novamente.");
  if (!data) return teamFormError(previous, "Turno indisponível para remoção.");
  return scheduleSaved(previous, professionalId, "Turno removido.");
}

const invalidTimeMessages = {
  invalid: "Informe uma data e um horário válidos.",
  missing: "Esse horário não existe no fuso do estabelecimento. Escolha outro.",
  ambiguous: "Esse horário ocorre duas vezes no fuso do estabelecimento. Escolha outro.",
};

export async function saveTimeOff(previous: TeamFormState, form: FormData): Promise<TeamFormState> {
  const target = await resolveSchedule(form);
  if (!target.ok) return teamFormError(previous, target.problem);
  const parsed = timeOffSchema.safeParse({ id: form.get("id"), starts_at: form.get("starts_at"), ends_at: form.get("ends_at"), reason: form.get("reason") });
  if (!parsed.success) return teamFormError(previous, "Revise as datas do bloqueio.", z.flattenError(parsed.error).fieldErrors);

  const { supabase, organization, professionalId } = target;
  if (!isSupportedTimeZone(organization.timezone)) return teamFormError(previous, "O fuso do estabelecimento não é reconhecido.");
  const { id, reason } = parsed.data;
  const start = tenantDateTimeToInstant(parsed.data.starts_at, organization.timezone);
  const end = tenantDateTimeToInstant(parsed.data.ends_at, organization.timezone);
  if ("error" in start || "error" in end) {
    return teamFormError(previous, "Revise as datas do bloqueio.", {
      starts_at: "error" in start ? [invalidTimeMessages[start.error]] : undefined,
      ends_at: "error" in end ? [invalidTimeMessages[end.error]] : undefined,
    });
  }

  if (Date.parse(end.instant) <= Date.parse(start.instant)) {
    return teamFormError(previous, "Revise as datas do bloqueio.", { ends_at: ["O fim deve ocorrer depois do início."] });
  }

  const block = { starts_at: start.instant, ends_at: end.instant, reason };
  const query = id
    ? supabase.from("time_off").update(block)
      .eq("organization_id", organization.id).eq("professional_id", professionalId).eq("id", id)
    : supabase.from("time_off").insert({ ...block, organization_id: organization.id, professional_id: professionalId });
  const { data, error } = await query.select("id").maybeSingle();

  if (error) return teamFormError(previous, error.code === "BF030" ? scheduleConflict : "Não foi possível salvar o bloqueio. Tente novamente.");
  if (!data) return teamFormError(previous, "Bloqueio indisponível para edição.");
  return scheduleSaved(previous, professionalId, id ? "Bloqueio atualizado." : "Bloqueio cadastrado.");
}

export async function removeTimeOff(previous: TeamFormState, form: FormData): Promise<TeamFormState> {
  const target = await resolveSchedule(form);
  if (!target.ok) return teamFormError(previous, target.problem);
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return teamFormError(previous, "Bloqueio inválido.");

  const { supabase, organization, professionalId } = target;
  const { data, error } = await supabase.from("time_off").delete()
    .eq("organization_id", organization.id).eq("professional_id", professionalId).eq("id", id.data).select("id").maybeSingle();

  if (error) return teamFormError(previous, "Não foi possível remover o bloqueio. Tente novamente.");
  if (!data) return teamFormError(previous, "Bloqueio indisponível para remoção.");
  return scheduleSaved(previous, professionalId, "Bloqueio removido.");
}
