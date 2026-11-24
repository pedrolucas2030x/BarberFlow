import { Scissors } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/features/auth/actions";
import styles from "./setup.module.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SetupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className="brand" aria-label="BarberFlow, página inicial">
          <span className="brand-mark"><Scissors size={20} aria-hidden="true" /></span>
          <span>Barber<span className="brand-accent">Flow</span></span>
        </Link>
        <form action={signOut}>
          <button type="submit" className={styles.secondary}>Sair da conta</button>
        </form>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
