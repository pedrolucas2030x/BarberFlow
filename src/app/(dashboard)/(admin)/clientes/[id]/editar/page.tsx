import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import styles from "@/components/dashboard/registry.module.css";
import { statusLabels } from "@/features/appointments/status";
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
  const { data: history } = await supabase.rpc("customer_history", {
    p_organization_id: organization.id, p_customer_id: id,
  });
  const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: organization.timezone });
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
      <section className={styles.panel} aria-labelledby="customer-history">
        <h2 id="customer-history" className={styles.panelHeading}>Histórico de atendimentos</h2>
        {history ? <>
          <p>Serviços realizados: {history.completed}</p>
          <p>Último atendimento: {history.last_completed ? dateFormat.format(new Date(history.last_completed)) : "Nenhum atendimento concluído"}</p>
          {history.items.length > 0 && <ul className={styles.list}>
            {history.items.map((item) => <li key={item.id} className={styles.item}>
              {dateFormat.format(new Date(item.starts_at))} · {item.service_name} · {statusLabels[item.status]}
            </li>)}
          </ul>}
        </> : <p role="alert" className={styles.error}>Não foi possível carregar o histórico.</p>}
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
