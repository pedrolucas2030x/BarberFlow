"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireWorkspace } from "@/features/workspace/access";
import { createClient } from "@/lib/supabase/server";
import { customerFieldsSchema } from "@/lib/validation/customers";

export type CustomerFormState = {
  message?: string;
  errors?: Partial<Record<keyof z.input<typeof customerFieldsSchema>, string[]>>;
};

export async function saveCustomer(_previous: CustomerFormState, form: FormData): Promise<CustomerFormState> {
  const { organization } = await requireWorkspace();
  const record = z.uuid().nullable().safeParse(form.get("id"));
  if (!record.success) return { message: "Cliente não encontrado." };
  const id = record.data;

  const fields = customerFieldsSchema.safeParse({
    name: form.get("name"),
    phone: form.get("phone"),
    marketingConsent: form.get("marketingConsent"),
  });

  if (!fields.success) return { errors: z.flattenError(fields.error).fieldErrors };

  const supabase = await createClient();
  const values = {
    name: fields.data.name,
    phone: fields.data.phone,
    marketing_consent: fields.data.marketingConsent,
  };
  const { data, error } = id === null
    ? await supabase.from("customers").insert({ ...values, organization_id: organization.id }).select("id").single()
    : await supabase.from("customers").update(values).eq("organization_id", organization.id).eq("id", id).select("id").maybeSingle();

  if (error?.code === "23505") return { errors: { phone: ["Já existe um cliente com esse telefone na barbearia."] } };
  if (error) return { message: "Não foi possível salvar o cliente. Tente novamente." };
  if (!data) return { message: "Cliente não encontrado." };

  revalidatePath("/clientes");
  redirect(`/clientes?resultado=${id === null ? "criado" : "editado"}`);
}

export async function deleteCustomer(id: string, form: FormData) {
  const { organization } = await requireWorkspace();
  if (!z.uuid().safeParse(id).success) redirect("/clientes");
  const editPath = `/clientes/${id}/editar`;
  if (form.get("confirmation") !== "on") redirect(`${editPath}?exclusao=confirmacao`);

  const supabase = await createClient();
  const { data, error } = await supabase.from("customers")
    .delete().eq("organization_id", organization.id).eq("id", id).select("id").maybeSingle();

  if (error?.code === "23503") redirect(`${editPath}?exclusao=vinculado`);
  if (error) redirect(`${editPath}?exclusao=erro`);
  if (!data) redirect("/clientes");

  revalidatePath("/clientes");
  redirect("/clientes?resultado=excluido");
}
