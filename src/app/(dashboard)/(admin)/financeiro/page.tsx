import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/dashboard/registry.module.css";
import { appointmentDay, todayForAppointments } from "@/features/appointments/dates";
import { paymentMethods } from "@/features/finance/payment-methods";
import { requireWorkspace } from "@/features/workspace/access";
import { formatTenantDateTime } from "@/lib/validation/schedule";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Financeiro" };
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function FinancesPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const { organization } = await requireWorkspace();
  const { data } = await searchParams;
  const today = todayForAppointments(organization.timezone);
  const day = appointmentDay(data) ?? today;
  const supabase = await createClient();
  const { data: receipts } = await supabase.rpc("received_payments_day", { p_organization_id: organization.id, p_day: day });
  const time = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: organization.timezone });

  return (
    <>
      <div className={styles.heading}>
        <div className="page-intro">
          <h1>Financeiro</h1>
          <p>Consulte os recebimentos registrados para os atendimentos da barbearia.</p>
        </div>
        <Link href="/agenda" className={styles.secondary}>Abrir agenda</Link>
      </div>

      <section className={styles.panel} aria-labelledby="received-payments">
        <h2 id="received-payments" className={styles.panelHeading}>Pagamentos recebidos</h2>
        <form method="get" action="/financeiro" className={`${styles.search} mt-4`}>
          <div className={styles.field}>
            <label htmlFor="payment-day">Data do recebimento</label>
            <input key={day} id="payment-day" name="data" type="date" defaultValue={day} max={today} required />
          </div>
          <button type="submit" className={styles.secondary}>Ver dia</button>
          {day !== today && <Link href="/financeiro" className={styles.secondary}>Hoje</Link>}
        </form>

        {receipts ? (
          <>
            <p className="mt-4">Total recebido <strong className="block text-xl">{currency.format(receipts.total_cents / 100)}</strong></p>
            {receipts.payments.length ? (
              <ul className={styles.list}>
                {receipts.payments.map((receipt) => {
                  const appointmentDate = formatTenantDateTime(receipt.starts_at, organization.timezone).slice(0, 10);
                  return (
                    <li className={styles.item} key={receipt.appointment_id}>
                      <div className={styles.itemHeader}>
                        <div>
                          <h3>{receipt.service_name} · {receipt.professional_name}</h3>
                          <p className={styles.details}>
                            {paymentMethods[receipt.method]} · <time dateTime={receipt.received_at}>{time.format(new Date(receipt.received_at))}</time>
                          </p>
                        </div>
                        <strong>{currency.format(receipt.amount_cents / 100)}</strong>
                      </div>
                      <Link href={`/agenda?data=${appointmentDate}`} className={styles.secondary}>Ver na agenda</Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={`${styles.muted} mt-4`}>Nenhum pagamento recebido nesta data.</p>
            )}
          </>
        ) : (
          <p role="alert" className={`${styles.error} mt-4`}>Não foi possível consultar os pagamentos. Tente novamente.</p>
        )}
      </section>
    </>
  );
}
