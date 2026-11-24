import type { Metadata } from "next";
import styles from "@/components/dashboard/registry.module.css";
import { requireWorkspace } from "@/features/workspace/access";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NewCustomerPage() {
  await requireWorkspace();

  return (
    <>
      <div className="page-intro">
        <h1>Novo cliente</h1>
        <p>Registre o nome e o telefone para os contatos de atendimento.</p>
      </div>
      <section className={`panel ${styles.panel}`} aria-label="Cadastro do cliente">
        <CustomerForm />
      </section>
    </>
  );
}
