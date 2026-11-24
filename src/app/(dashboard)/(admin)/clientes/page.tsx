import type { Metadata } from "next";
import { navigation } from "@/components/dashboard/navigation-items";
import { SectionPage } from "@/components/dashboard/section-page";
import { requireWorkspace } from "@/features/workspace/access";

const { label, icon } = navigation.customers;
export const metadata: Metadata = { title: label };

export default async function CustomersPage() {
  await requireWorkspace();

  return (
    <SectionPage
      title={label}
      icon={icon}
      description="Consulte os contatos e o histórico de atendimento."
      emptyTitle="Nenhum cliente para exibir"
      emptyDescription="Os contatos vão aparecer aqui quando o cadastro de clientes estiver disponível."
    />
  );
}
