import type { Metadata } from "next";
import { navigation } from "@/components/dashboard/navigation-items";
import { requireWorkspace, roleLabels } from "@/features/workspace/access";

const { label } = navigation.settings;
export const metadata: Metadata = { title: label };

export default async function SettingsPage() {
  const { organization, role } = await requireWorkspace();

  return (
    <>
      <div className="page-intro">
        <h1>{label}</h1>
        <p>Dados do estabelecimento e da sua permissão de acesso.</p>
      </div>
      <dl className="panel settings-panel">
        <div>
          <dt>Estabelecimento</dt>
          <dd>{organization.name}</dd>
        </div>
        <div>
          <dt>Identificador</dt>
          <dd>{organization.slug}</dd>
        </div>
        <div>
          <dt>Fuso horário</dt>
          <dd>{organization.timezone}</dd>
        </div>
        <div>
          <dt>Seu acesso</dt>
          <dd>{roleLabels[role]}</dd>
        </div>
      </dl>
    </>
  );
}
