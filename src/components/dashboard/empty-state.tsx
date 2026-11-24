import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, description, heading: Heading }: {
  icon: LucideIcon;
  title: string;
  description: string;
  heading: "h2" | "h3";
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={23} aria-hidden="true" /></span>
      <Heading>{title}</Heading>
      <p>{description}</p>
    </div>
  );
}
