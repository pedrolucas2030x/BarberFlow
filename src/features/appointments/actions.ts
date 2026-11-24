"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireWorkspace } from "@/features/workspace/access";
import { parseCatalogPage } from "@/features/workspace/catalog-list";
import { createClient } from "@/lib/supabase/server";
import { tenantDateTimeToInstant } from "@/lib/validation/schedule";
import { getAppointmentCustomers, type AppointmentCustomers } from "./data";
import { appointmentDay, todayForAppointments } from "./dates";

export type AppointmentFormState = { message?: string };

const bookingInput = z.object({
  professionalId: z.uuid(),
  serviceId: z.uuid(),
  customerId: z.uuid(),
  start: z.string(),
});

const bookingErrors: Record<string, string> = {
  "42501": "Seu acesso não permite criar agendamentos.",
  "23P01": "Já existe um agendamento para este profissional nesse horário.",
  BF001: "Escolha uma data e um horário futuros.",
  BF002: "Selecione um serviço ativo vinculado ao profissional.",
  BF003: "Selecione um cliente disponível na sua barbearia.",
  BF004: "O serviço precisa caber no turno, fora da pausa do profissional.",
  BF005: "O profissional tem um bloqueio nesse horário.",
};

export async function searchAppointmentCustomers(_: AppointmentCustomers, form: FormData) {
  const { organization } = await requireWorkspace();
  const query = form.get("query");
  return getAppointmentCustomers(
    organization.id,
    parseCatalogPage(form.get("page")),
    typeof query === "string" ? query.trim().slice(0, 80) : "",
  );
}

export async function createAppointment(_: AppointmentFormState, form: FormData): Promise<AppointmentFormState> {
  const { organization } = await requireWorkspace();
  const fields = bookingInput.safeParse({
    professionalId: form.get("professional"),
    serviceId: form.get("service"),
    customerId: form.get("customer"),
    start: `${form.get("date")}T${form.get("time")}`,
  });
  if (!fields.success) return { message: "Selecione o profissional, o serviço e o cliente e informe a data e o horário." };

  const { professionalId, serviceId, customerId, start } = fields.data;
  const conversion = tenantDateTimeToInstant(start, organization.timezone);
  if ("error" in conversion) {
    return { message: conversion.error === "ambiguous"
      ? "Esse horário ocorre duas vezes no fuso da barbearia. Escolha outro."
      : "Escolha uma data e um horário válidos no fuso da barbearia." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_appointment", {
    p_organization_id: organization.id,
    p_professional_id: professionalId,
    p_service_id: serviceId,
    p_customer_id: customerId,
    p_starts_at: conversion.instant,
  });
  if (error) return { message: bookingErrors[error.code] ?? "Não foi possível criar o agendamento. Tente novamente." };

  revalidatePath("/agenda");
  redirect(`/agenda?data=${start.slice(0, 10)}&resultado=criado`);
}

export async function cancelAppointment(day: string, form: FormData) {
  const { organization } = await requireWorkspace();
  const selectedDay = appointmentDay(day) ?? todayForAppointments(organization.timezone);
  const path = `/agenda?data=${selectedDay}`;
  const id = z.uuid().safeParse(form.get("appointment"));
  if (!id.success || form.get("confirm") !== "on") redirect(`${path}&resultado=erro`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_appointment", {
    p_organization_id: organization.id,
    p_appointment_id: id.data,
  });
  if (error || !data) redirect(`${path}&resultado=erro`);

  revalidatePath("/agenda");
  redirect(`${path}&resultado=cancelado`);
}
