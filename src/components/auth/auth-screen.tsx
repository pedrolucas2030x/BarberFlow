import { CircleAlert, CircleCheck } from "lucide-react";
import styles from "./auth.module.css";

export function AuthScreen({ title, description, children, footer }: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className={styles.card} aria-labelledby="auth-title">
      <header className={styles.cardHeading}>
        <h1 id="auth-title">{title}</h1>
        <p>{description}</p>
      </header>
      {children}
      {footer && <div className={styles.cardFooter}>{footer}</div>}
    </section>
  );
}

export function AuthNotice({ status, children }: {
  status: "error" | "success";
  children: React.ReactNode;
}) {
  const Icon = status === "error" ? CircleAlert : CircleCheck;

  return (
    <div className={styles.notice} data-status={status} role={status === "error" ? "alert" : "status"}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
