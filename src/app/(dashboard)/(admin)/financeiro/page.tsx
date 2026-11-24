import type { Metadata } from "next";
import { navigation } from "@/components/dashboard/navigation-items";
import { SectionPage } from "@/components/dashboard/section-page";
import { requireWorkspace } from "@/features/workspace/access";

const { label, icon } = navigation.finances;
export const metadata: Metadata = { title: label };

export default async function FinancesPage() {
  await requireWorkspace();

  return (
    <SectionPage
      title={label}
      icon={icon}
      description="Acompanhe recebimentos, despesas e comissões."
      emptyTitle="Financeiro em desenvolvimento"
      emptyDescription="O registro de pagamentos, despesas e comissões estará disponível em uma próxima etapa."
    />
  );
}
