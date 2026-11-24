import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CatalogList } from "@/components/dashboard/catalog-list";
import styles from "@/components/dashboard/registry.module.css";
import { requireWorkspace } from "@/features/workspace/access";
import { loadCatalogPage, parseCatalogPage } from "@/features/workspace/catalog-list";

export const metadata: Metadata = { title: "Serviços" };

export default async function ServicesPage({ searchParams }: {
  searchParams: Promise<{ pagina?: string | string[]; resultado?: string | string[] }>;
}) {
  const { organization } = await requireWorkspace();
  const { pagina, resultado } = await searchParams;
  const initial = await loadCatalogPage("services", organization.id, parseCatalogPage(pagina));
  const notice = resultado === "criado" ? "Serviço cadastrado." : resultado === "editado" ? "Serviço atualizado." : null;

  return (
    <>
      <div className={styles.heading}>
        <div className="page-intro">
          <h1>Serviços</h1>
          <p>Gerencie a duração, o preço e a disponibilidade dos serviços da barbearia.</p>
        </div>
        <Link className="primary-button" href="/servicos/novo"><Plus size={17} aria-hidden="true" /> Novo serviço</Link>
      </div>

      {notice && !initial.failed && <p className={styles.success} role="status">{notice}</p>}

      <section className={`panel ${styles.panel}`} aria-labelledby="catalog-title">
        <h2 className={styles.panelHeading} id="catalog-title">Catálogo</h2>
        <CatalogList kind="services" initial={initial} />
      </section>
    </>
  );
}
