import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CatalogList } from "@/components/dashboard/catalog-list";
import styles from "@/components/dashboard/registry.module.css";
import { requireWorkspace } from "@/features/workspace/access";
import { loadCatalogPage, parseCatalogPage } from "@/features/workspace/catalog-list";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({ searchParams }: {
  searchParams: Promise<{ pagina?: string | string[]; resultado?: string | string[] }>;
}) {
  const { organization } = await requireWorkspace();
  const { pagina, resultado } = await searchParams;
  const initial = await loadCatalogPage("customers", organization.id, parseCatalogPage(pagina));
  const notice = resultado === "criado" ? "Cliente cadastrado." : resultado === "editado" ? "Cliente atualizado." : resultado === "excluido" ? "Cliente excluído." : null;

  return (
    <>
      <div className={styles.heading}>
        <div className="page-intro">
          <h1>Clientes</h1>
          <p>Gerencie os contatos usados no atendimento da barbearia.</p>
        </div>
        <Link className="primary-button" href="/clientes/novo"><Plus size={17} aria-hidden="true" /> Novo cliente</Link>
      </div>

      {notice && !initial.failed && <p className={styles.success} role="status">{notice}</p>}

      <section className={`panel ${styles.panel}`} aria-labelledby="catalog-title">
        <h2 className={styles.panelHeading} id="catalog-title">Contatos</h2>
        <CatalogList kind="customers" initial={initial} />
      </section>
    </>
  );
}
