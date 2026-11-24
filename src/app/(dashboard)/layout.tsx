import { LogOut, Scissors } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CurrentDate } from "@/components/dashboard/current-date";
import { DashboardNavigation } from "@/components/dashboard/navigation";
import { signOut } from "@/features/auth/actions";
import { requireWorkspace, roleLabels } from "@/features/workspace/access";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { organization, role } = await requireWorkspace("member");
  const canManage = role !== "barber";
  const home = canManage ? "/painel" : "/agenda";

  return (
    <div className="dashboard-shell">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <DashboardNavigation organizationName={organization.name} roleLabel={roleLabels[role]} canManage={canManage} />

      <div className="dashboard-body">
        <header className="topbar">
          <div className="topbar-inner">
            <span className="topbar-label">Área de trabalho</span>
            <Link href={home} className="brand mobile-brand" aria-label="BarberFlow, área de trabalho">
              <span className="brand-mark"><Scissors size={18} aria-hidden="true" /></span>
              <span>Barber<span className="brand-accent">Flow</span></span>
            </Link>
            <div className="topbar-actions">
              <CurrentDate timezone={organization.timezone} />
              <form action={signOut}>
                <button type="submit" className="dashboard-signout" aria-label="Sair da conta">
                  <LogOut size={17} aria-hidden="true" /><span>Sair</span>
                </button>
              </form>
            </div>
          </div>
        </header>

        <main id="conteudo" className="dashboard-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
