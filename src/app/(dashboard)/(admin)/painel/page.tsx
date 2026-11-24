import { ArrowRight, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { navigation } from "@/components/dashboard/navigation-items";
import controls from "@/components/dashboard/registry.module.css";
import { requireWorkspace } from "@/features/workspace/access";
import { getDashboardProgress } from "@/features/workspace/dashboard-progress";
import styles from "./dashboard.module.css";
import { listAppointments } from "@/features/appointments/data";
import { todayForAppointments } from "@/features/appointments/dates";

export const metadata: Metadata = { title: "Painel" };

const steps = [
  { key: "services", ...navigation.services, pending: "Cadastre ou reative um serviço com duração e preço." },
] as const;

export default async function DashboardPage() {
  const { organization } = await requireWorkspace();
  const today = todayForAppointments(organization.timezone);
  const [progress, appointments] = await Promise.all([
    getDashboardProgress(organization.id),
    listAppointments(organization.id, today),
  ]);
  const upcoming = appointments?.filter(({ status }) => status === "confirmed" || status === "pending").slice(0, 3);
  const localTime = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: organization.timezone });
  const completed = progress ? steps.filter(({ key }) => progress[key]).length : null;
  const next = progress ? steps.find(({ key }) => !progress[key])?.key : undefined;

  return (
    <>
      <div className="page-intro">
        <h1>Painel de controle</h1>
        <p>{organization.name}</p>
      </div>

      <section className={`panel ${styles.gettingStarted}`} aria-labelledby="setup-title">
        <div className={styles.heading}>
          <div>
            <h2 id="setup-title">{completed === steps.length ? "Cadastros iniciais concluídos" : "Primeiros passos"}</h2>
            <p>{progress
              ? "Acesse cada cadastro para manter os dados da barbearia atualizados."
              : "Não foi possível consultar o progresso agora. Você pode abrir cada cadastro abaixo."}</p>
          </div>
          {completed !== null && (
            <div className={styles.progress}>
              <span>{completed} de {steps.length} concluídos</span>
              <progress value={completed} max={steps.length} aria-label="Progresso dos cadastros iniciais" />
            </div>
          )}
        </div>

        <ol className={styles.steps}>
          {steps.map(({ key, label, href, icon: Icon, pending }) => {
            const done = progress?.[key];
            const highlighted = next === key;
            return (
              <li className={styles.step} key={key} data-next={highlighted || undefined} data-done={done || undefined}>
                <span className={styles.stepIcon}>
                  {done ? <CircleCheck size={22} aria-hidden="true" /> : <Icon size={22} aria-hidden="true" />}
                </span>
                <div>
                  <h3>{label}</h3>
                  {done === true && <p>Concluído</p>}
                  {done === false && <p>{`${highlighted ? "Próximo passo." : "Pendente."} ${pending}`}</p>}
                </div>
                <Link href={href} className={`${styles.stepAction} ${highlighted ? "primary-button" : controls.secondary}`}>
                  Abrir {label.toLowerCase()} <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section className={`panel ${styles.modules}`} aria-labelledby="operational-modules">
        <h2 id="operational-modules">Agenda</h2>
        <p>Consulte seus horários e marque um atendimento.</p>
        {appointments && <p>Atendimentos concluídos hoje: {appointments.filter(({ status }) => status === "completed").length}</p>}
        {upcoming?.length ? <ul className={controls.list}>
          {upcoming.map((item) => <li key={item.id}>
            <time dateTime={item.starts_at}>{localTime.format(new Date(item.starts_at))}</time> · {item.service_name}
          </li>)}
        </ul> : appointments && <p>Nenhum atendimento pendente ou confirmado hoje.</p>}
        <Link href="/agenda" className={`${completed === steps.length ? "primary-button" : controls.secondary} mt-3`}>
          Abrir agenda <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
