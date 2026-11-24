import type { LucideIcon } from "lucide-react";
import { EmptyState } from "./empty-state";

export function SectionPage({ title, description, icon, emptyTitle, emptyDescription }: {
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <>
      <div className="page-intro">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="panel section-empty">
        <EmptyState icon={icon} heading="h2" title={emptyTitle} description={emptyDescription} />
      </div>
    </>
  );
}
