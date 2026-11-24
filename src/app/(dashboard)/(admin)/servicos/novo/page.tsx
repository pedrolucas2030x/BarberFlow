import type { Metadata } from "next";
import { requireWorkspace } from "@/features/workspace/access";
import styles from "@/components/dashboard/registry.module.css";
import { ServiceForm } from "../service-form";

export const metadata: Metadata = { title: "Novo serviço" };

export default async function NewServicePage() {
  await requireWorkspace();

  return (
    <>
      <div className="page-intro">
        <h1>Novo serviço</h1>
        <p>Defina o nome, a duração e o preço do item no catálogo.</p>
      </div>
      <section className={`panel ${styles.panel}`} aria-label="Cadastro do serviço">
        <ServiceForm />
      </section>
    </>
  );
}
