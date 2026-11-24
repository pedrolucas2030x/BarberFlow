import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Scissors } from "lucide-react";
import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={styles.shell}>
      <aside className={styles.visual} aria-hidden="true">
        <Image src="/barbershop.webp" className={styles.photo} alt="" fill sizes="50vw" />
        <div className={styles.visualContent}>
          <div className={styles.visualLine} />
          <p>Seu negócio.<br /><span>No controle.</span></p>
        </div>
      </aside>

      <main className={styles.main}>
        <Link href="/" className={"brand " + styles.brand} aria-label="BarberFlow, início">
          <span className={"brand-mark " + styles.brandMark}><Scissors size={20} aria-hidden="true" /></span>
          <span>Barber<span className="brand-accent">Flow</span></span>
        </Link>
        {children}
      </main>
    </div>
  );
}
