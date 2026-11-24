"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireWorkspace } from "@/features/workspace/access";
import { createClient } from "@/lib/supabase/server";
import { serviceFieldsSchema } from "@/lib/validation/services";

export type ServiceFormState = {
  message?: string;
  errors?: Partial<Record<keyof z.input<typeof serviceFieldsSchema>, string[]>>;
};

export async function saveService(_previous: ServiceFormState, form: FormData): Promise<ServiceFormState> {
  const { organization } = await requireWorkspace();
  const record = z.uuid().nullable().safeParse(form.get("id"));
  if (!record.success) return { message: "Serviço não encontrado." };
  const id = record.data;

  const fields = serviceFieldsSchema.safeParse({
    name: form.get("name"),
    durationMinutes: form.get("durationMinutes"),
    price: form.get("price"),
    active: form.get("active"),
  });

  if (!fields.success) return { errors: z.flattenError(fields.error).fieldErrors };

  const supabase = await createClient();
  const values = {
    name: fields.data.name,
    duration_minutes: fields.data.durationMinutes,
    price_cents: fields.data.price,
    active: fields.data.active,
  };
  const { data, error } = id === null
    ? await supabase.from("services").insert({ ...values, organization_id: organization.id }).select("id").single()
    : await supabase.from("services").update(values).eq("organization_id", organization.id).eq("id", id).select("id").maybeSingle();

  if (error?.code === "23505") return { errors: { name: ["Já existe um serviço com esse nome na barbearia."] } };
  if (error) return { message: "Não foi possível salvar o serviço. Tente novamente." };
  if (!data) return { message: "Serviço não encontrado." };

  revalidatePath("/servicos");
  redirect(`/servicos?resultado=${id === null ? "criado" : "editado"}`);
}
