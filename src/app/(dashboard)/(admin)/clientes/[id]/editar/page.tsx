import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import styles from "@/components/dashboard/registry.module.css";
import { requireWorkspace } from "@/features/workspace/access";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm, DeleteCustomerForm } from "../../customer-form";

export const metadata: Metadata = { title: "Editar cliente" };

const deleteMessages = {
  confirmacao: "Confirme a exclusão do cadastro.",
  vinculado: "Este cliente possui registros vinculados e precisa ser mantido.",
  erro: "Não foi possível excluir o cliente. Tente novamente.",
};

export default async function EditCustomerPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ exclusao?: string | string[] }>;
}) {
  const { organization } = await requireWorkspace();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: customer, error } = await supabase.from("customers")
    .select("id, name, phone, marketing_consent")
    .eq("organization_id", organization.id).eq("id", id).maybeSingle();

  if (error) throw new Error("Não foi possível consultar o cliente.");
  if (!customer) notFound();
  const { exclusao } = await searchParams;
  const deleteMessage = exclusao === "confirmacao" || exclusao === "vinculado" || exclusao === "erro"
    ? deleteMessages[exclusao]
    : undefined;

  return (
    <>
      <div className="page-intro">
        <h1>Editar cliente</h1>
        <p>Atualize o contato e o consentimento de {customer.name}.</p>
      </div>
      <section className={`panel ${styles.panel}`} aria-label="Dados do cliente">
        <CustomerForm customer={customer} />
      </section>
      <section className={`panel ${styles.panel}`} aria-labelledby="delete-customer-title">
        <div className={styles.panelHeading}>
          <h2 id="delete-customer-title">Excluir cadastro</h2>
        </div>
        <DeleteCustomerForm id={customer.id} message={deleteMessage} />
      </section>
    </>
  );
}
