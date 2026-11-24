import {
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  CircleCheck,
  MapPin,
  Scissors,
  UsersRound,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: { absolute: "BarberFlow | Gestão para barbearias" },
  description: "Conheça o BarberFlow, sistema de gestão para barbearias de 1 a 5 profissionais, com piloto em Palmeirais e região.",
};

const features = [
  {
    icon: CalendarDays,
    title: "Serviços e expediente",
    description: "Monte o catálogo com duração e preço. Defina os turnos, as pausas e os bloqueios da equipe.",
  },
  {
    icon: UsersRound,
    title: "Clientes e equipe",
    description: "Organize seus contatos, cadastre os profissionais e vincule os serviços de cada pessoa.",
  },
  {
    icon: Wallet,
    title: "Agenda e caixa",
    description: "Agendamentos, pagamentos recebidos, despesas e cálculo de comissões estão em desenvolvimento.",
  },
];

const steps = [
  { title: "Crie sua conta", description: "Cadastre seu e-mail e confirme o acesso." },
  { title: "Cadastre a barbearia", description: "Informe o nome, o identificador e o fuso horário do estabelecimento." },
  { title: "Acesse o painel", description: "Consulte os dados do estabelecimento na sua área de trabalho." },
];

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="BarberFlow, início">
      <span className="brand-mark"><Scissors size={19} aria-hidden="true" /></span>
      <span>Barber<span className="brand-accent">Flow</span></span>
    </Link>
  );
}

export default function LandingPage() {
  return (
    <div className={styles.landing}>
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <Brand />
          <nav className={styles.navigation} aria-label="Navegação da página">
            <a href="#recursos">Recursos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#plano">Plano piloto</a>
          </nav>
          <div className={styles.headerActions}>
            <Link className={styles.loginLink} href="/login">Entrar</Link>
            <Link className={styles.headerSignup} href="/cadastro">Criar conta</Link>
          </div>
        </div>
      </header>

      <main id="conteudo" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={`${styles.container} ${styles.heroInner}`}>
            <div className={styles.heroCopy}>
              <p className={styles.pilotLocation}><MapPin size={16} aria-hidden="true" /> Piloto em Palmeirais e região</p>
              <h1 id="landing-title">Seu negócio.<br /><span>No controle.</span></h1>
              <p className={styles.heroDescription}>Gestão para barbearias de 1 a 5 profissionais. Comece cadastrando seu estabelecimento e acesse seu painel de gestão.</p>
              <div className={styles.heroActions}>
                <Link href="/cadastro" className={styles.primaryAction}>
                  Criar conta <ArrowUpRight size={19} aria-hidden="true" />
                </Link>
                <a href="#plano" className={styles.secondaryAction}>
                  Conhecer o piloto <ArrowDown size={17} aria-hidden="true" />
                </a>
              </div>
            </div>
            <div className={styles.heroMedia}>
              <Image
                className={styles.heroImage}
                src="/barbershop.webp"
                alt=""
                fill
                preload
                sizes="(min-width: 82rem) 630px, (min-width: 54rem) 52vw, calc(100vw - 2rem)"
              />
            </div>
          </div>
        </section>

        <section className={styles.featuresSection} id="recursos" aria-labelledby="features-title" aria-describedby="features-description">
          <div className={styles.container}>
            <div className={styles.sectionIntro}>
              <h2 id="features-title">Da agenda ao caixa.</h2>
              <p id="features-description">As primeiras ferramentas do painel ajudam a preparar sua barbearia para a agenda.</p>
            </div>
            <ul className={styles.features}>
              {features.map(({ icon: Icon, title, description }) => (
                <li key={title} className={styles.feature}>
                  <span className={styles.featureIcon}><Icon size={22} aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.stepsSection} id="como-funciona" aria-labelledby="steps-title">
          <div className={`${styles.container} ${styles.stepsInner}`}>
            <div className={styles.stepsIntro}>
              <h2 id="steps-title">Comece em três passos.</h2>
              <p>O cadastro pode ser feito no navegador do celular ou do computador.</p>
            </div>
            <ol className={styles.steps}>
              {steps.map(({ title, description }, index) => (
                <li key={title} className={styles.step}>
                  <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.planSection} id="plano" aria-labelledby="plan-title">
          <div className={styles.container}>
            <div className={styles.plan}>
              <div className={styles.planIntro}>
                <h2 id="plan-title">Plano piloto</h2>
                <p>Para barbearias de 1 a 5 profissionais em Palmeirais e região.</p>
              </div>
              <div className={styles.planDetails}>
                <p className={styles.priceLabel}>Preço previsto</p>
                <p className={styles.planPrice}><strong>R$ 49,90</strong><span>por mês</span></p>
                <ul className={styles.planTerms}>
                  <li><CircleCheck size={18} aria-hidden="true" /> 14 dias de teste previstos</li>
                  <li><CircleCheck size={18} aria-hidden="true" /> Cobrança somente com sua autorização</li>
                </ul>
                <Link href="/cadastro" className={`${styles.primaryAction} ${styles.planAction}`}>
                  Criar conta para o piloto <ArrowUpRight size={19} aria-hidden="true" />
                </Link>
              </div>
              <div className={styles.planIncludes}>
                <h3>O que você pode usar no piloto</h3>
                <ul className={styles.planTerms}>
                  <li><CircleCheck size={18} aria-hidden="true" /> Painel da sua barbearia</li>
                  <li><CircleCheck size={18} aria-hidden="true" /> Cadastros de serviços, clientes e equipe</li>
                  <li><CircleCheck size={18} aria-hidden="true" /> Turnos, pausas e bloqueios por profissional</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <Brand />
          <Link className={styles.loginLink} href="/login">Acessar minha conta <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
      </footer>
    </div>
  );
}
