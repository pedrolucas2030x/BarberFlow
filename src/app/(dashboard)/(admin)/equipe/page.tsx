import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { navigation } from "@/components/dashboard/navigation-items";
import styles from "@/components/dashboard/registry.module.css";
import { listProfessionals } from "@/features/professionals/data";
import { requireWorkspace } from "@/features/workspace/access";
import { ProfessionalForm, ProfessionalStatusForm } from "./professional-form";

const { label, icon } = navigation.team;
export const metadata: Metadata = { title: label };

export default async function TeamPage() {
  const { organization } = await requireWorkspace();
  const { data: professionals, error } = await listProfessionals(organization.id);
  const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });

  return (
    <>
      <div className="page-intro">
        <h1>{label}</h1>
        <p>Cadastre profissionais e organize seus serviços, comissões e horários.</p>
      </div>
      {error ? (
        <section className={styles.panel} aria-label="Cadastro da equipe">
          <p role="alert" className={styles.error}>Não foi possível carregar os profissionais. Tente novamente.</p>
        </section>
      ) : (
        <>
          <section className={styles.panel} aria-labelledby="new-professional-title">
            <h2 id="new-professional-title" className={styles.panelHeading}>Novo profissional</h2>
            <ProfessionalForm />
          </section>
          <section className={styles.panel} aria-labelledby="professionals-title">
            <h2 id="professionals-title" className={styles.panelHeading}>Profissionais da barbearia</h2>
            {professionals.length === 0 ? (
              <EmptyState icon={icon} heading="h3" title="Nenhum profissional cadastrado"
                description="Cadastre um profissional para definir o expediente e os serviços que ele pode atender." />
            ) : (
              <ul className={styles.list}>
                {professionals.map((professional) => (
                  <li key={professional.id} className={styles.item}>
                    <div className={styles.itemHeader}>
                      <h3>{professional.name}</h3>
                      <span className={styles.badge}>{professional.active ? "Ativo" : "Inativo"}</span>
                    </div>
                    <p className={styles.details}>Comissão de {percent.format(professional.commission_bps / 10_000)}</p>
                    <div className={styles.actions}>
                      <Link href={`/equipe/${professional.id}/expediente`} className={styles.secondary}>Expediente e serviços</Link>
                      <ProfessionalStatusForm id={professional.id} active={professional.active} />
                    </div>
                    <details>
                      <summary className={styles.secondary}>Editar profissional</summary>
                      <ProfessionalForm professional={professional} />
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
