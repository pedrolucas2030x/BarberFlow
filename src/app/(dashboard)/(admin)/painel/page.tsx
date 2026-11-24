import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  CalendarX2,
  ReceiptText,
  Ticket,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { navigation } from "@/components/dashboard/navigation-items";
import { requireWorkspace } from "@/features/workspace/access";

export const metadata: Metadata = { title: "Painel" };

const metrics = [
  { label: "Receita recebida", detail: "Pagamentos confirmados", icon: Wallet },
  { label: "Atendimentos concluídos", detail: "Serviços finalizados", icon: CalendarCheck },
  { label: "Ticket médio", detail: "Por atendimento pago", icon: Ticket },
  { label: "Despesas", detail: "Saídas registradas", icon: ReceiptText },
];

const shortcuts = [navigation.services, navigation.team, navigation.finances];

export default async function DashboardPage() {
  const { organization } = await requireWorkspace();

  return (
    <>
      <div className="page-intro">
        <h1>Painel de controle</h1>
        <p>{organization.name}</p>
      </div>

      <section className="hero" aria-labelledby="dashboard-hero-title">
        <Image
          src="/barbershop.webp"
          alt=""
          fill
          preload
          sizes="(min-width: 1600px) 1260px, (min-width: 960px) calc(100vw - 312px), 100vw"
          className="hero-image"
        />
        <div className="hero-content">
          <h2 id="dashboard-hero-title">Seu negócio.<br /><span>No controle.</span></h2>
          <p>Sua agenda, seus clientes e seu caixa em um só lugar.</p>
          <Link href={navigation.schedule.href} className="primary-button">
            Abrir agenda <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="today-title">
        <div className="section-heading">
          <h2 id="today-title">Resumo de hoje</h2>
          <span className="status-chip">Sem dados operacionais</span>
        </div>
        <dl className="metric-grid">
          {metrics.map(({ label, detail, icon: Icon }) => (
            <div className="panel metric" key={label}>
              <dt>
                <span className="icon-tile"><Icon size={18} aria-hidden="true" /></span>
                <span>{label}</span>
              </dt>
              <dd>
                <span className="metric-value" aria-hidden="true">—</span>
                <span className="sr-only">Sem dados</span>
                <span className="metric-detail">{detail}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="lower-grid">
        <section className="panel" aria-labelledby="upcoming-title">
          <div className="panel-heading">
            <h2 id="upcoming-title"><CalendarDays size={18} aria-hidden="true" /> Próximos horários</h2>
            <Link href={navigation.schedule.href} className="text-link">
              Ver agenda <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <EmptyState
            icon={CalendarX2}
            heading="h3"
            title="Nenhum horário para exibir"
            description="Os próximos agendamentos aparecerão aqui quando a agenda estiver disponível."
          />
        </section>

        <section className="panel" aria-labelledby="shortcuts-title">
          <div className="panel-heading">
            <h2 id="shortcuts-title">Acesso rápido</h2>
          </div>
          <ul className="shortcut-list">
            {shortcuts.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="shortcut">
                  <span className="shortcut-icon"><Icon size={17} aria-hidden="true" /></span>
                  <span>{label}</span>
                  <ArrowRight className="shortcut-arrow" size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
