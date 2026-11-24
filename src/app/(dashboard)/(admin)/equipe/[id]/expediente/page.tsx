import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import styles from "@/components/dashboard/registry.module.css";
import { getProfessional } from "@/features/professionals/data";
import { getProfessionalSchedule } from "@/features/schedule/data";
import { weekdays } from "@/features/schedule/weekdays";
import { requireWorkspace } from "@/features/workspace/access";
import { isSupportedTimeZone } from "@/lib/app-time-zone";
import { formatTenantDateTime } from "@/lib/validation/schedule";
import { RemoveScheduleRecord, TimeOffForm, WeeklyShiftForm } from "./schedule-forms";
import { LinkServiceForm, UnlinkServiceForm } from "./service-forms";

export const metadata: Metadata = { title: "Expediente do profissional" };

export default async function ProfessionalSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { organization } = await requireWorkspace();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const { data: professional, error } = await getProfessional(organization.id, id);
  if (!error && !professional) notFound();

  const schedule = professional ? await getProfessionalSchedule(organization.id, professional.id) : null;
  const header = (
    <div className={styles.heading}>
      <div className="page-intro">
        <h1>Expediente e serviços</h1>
        {professional && <p>{professional.name} · {professional.active ? "Ativo" : "Inativo"}</p>}
      </div>
      <Link href="/equipe" className={styles.secondary}>Voltar à equipe</Link>
    </div>
  );

  if (!professional || !schedule) {
    return (
      <>
        {header}
        <p className={`${styles.panel} ${styles.error}`} role="alert">Não foi possível carregar o expediente. Tente novamente.</p>
      </>
    );
  }

  const { availableServices, linkedServices, shifts, blocks } = schedule;
  const occupiedDays = shifts.map(({ weekday }) => weekday);
  const timezone = organization.timezone;
  const blockFormatter = isSupportedTimeZone(timezone)
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: timezone })
    : null;

  return (
    <>
      {header}
      <section className={styles.panel} aria-labelledby="linked-services-title">
        <h2 id="linked-services-title" className={styles.panelHeading}>Serviços vinculados</h2>
        {availableServices.length ? <LinkServiceForm professionalId={id} options={availableServices} /> : (
          <p className={styles.muted}>Os serviços ativos disponíveis para vínculo aparecem aqui. <Link href="/servicos" className="text-link">Gerenciar catálogo</Link></p>
        )}

        {linkedServices.length ? (
          <ul className={styles.list}>
            {linkedServices.map((service) => (
              <li key={service.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <h3>{service.name}</h3>
                  <span className={styles.badge}>{service.active ? "Ativo" : "Inativo"}</span>
                </div>
                <UnlinkServiceForm professionalId={id} serviceId={service.id} />
              </li>
            ))}
          </ul>
        ) : <p className={styles.muted}>Nenhum serviço vinculado.</p>}
      </section>

      <section className={styles.panel} aria-labelledby="weekly-shifts-title">
        <h2 id="weekly-shifts-title" className={styles.panelHeading}>Turnos da semana</h2>
        <p className={styles.muted}>Cadastre um turno por dia. A pausa, quando definida, fica dentro do turno.</p>
        {shifts.length < weekdays.length && <WeeklyShiftForm professionalId={id} occupiedDays={occupiedDays} />}
        {shifts.length ? (
          <ul className={styles.list}>
            {shifts.map((shift) => (
              <li key={shift.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <h3>{weekdays[shift.weekday]}</h3>
                  <span className={styles.badge}>{shift.starts_at.slice(0, 5)} às {shift.ends_at.slice(0, 5)}</span>
                </div>
                {shift.break_starts_at && shift.break_ends_at && (
                  <p className={styles.details}>Pausa das {shift.break_starts_at.slice(0, 5)} às {shift.break_ends_at.slice(0, 5)}</p>
                )}
                <details>
                  <summary className={styles.secondary}>Editar turno</summary>
                  <WeeklyShiftForm professionalId={id} shift={shift} occupiedDays={occupiedDays} />
                </details>
                <RemoveScheduleRecord professionalId={id} id={shift.id} kind="turno" />
              </li>
            ))}
          </ul>
        ) : <p className={styles.muted}>Nenhum turno cadastrado.</p>}
      </section>

      <section className={styles.panel} aria-labelledby="time-off-title">
        <h2 id="time-off-title" className={styles.panelHeading}>Bloqueios</h2>
        <p className={styles.muted}>Os bloqueios usam o fuso do estabelecimento ({timezone}).</p>
        {blockFormatter ? <TimeOffForm professionalId={id} /> : (
          <p role="alert" className={styles.error}>O fuso do estabelecimento precisa ser válido para cadastrar bloqueios.</p>
        )}
        {blockFormatter && blocks.length ? (
          <ul className={styles.list}>
            {blocks.map((block) => (
              <li key={block.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <h3>{block.reason || "Horário bloqueado"}</h3>
                </div>
                <p className={styles.details}>
                  <time dateTime={block.starts_at}>{blockFormatter.format(new Date(block.starts_at))}</time> até{" "}
                  <time dateTime={block.ends_at}>{blockFormatter.format(new Date(block.ends_at))}</time>
                </p>
                <details>
                  <summary className={styles.secondary}>Editar bloqueio</summary>
                  <TimeOffForm professionalId={id} block={{
                    id: block.id,
                    start: formatTenantDateTime(block.starts_at, timezone),
                    end: formatTenantDateTime(block.ends_at, timezone),
                    reason: block.reason,
                  }} />
                </details>
                <RemoveScheduleRecord professionalId={id} id={block.id} kind="bloqueio" />
              </li>
            ))}
          </ul>
        ) : blockFormatter && <p className={styles.muted}>Nenhum bloqueio cadastrado.</p>}
      </section>
    </>
  );
}
