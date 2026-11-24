"use client";

import { Scissors, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import type { CatalogKind, CatalogPage } from "@/features/workspace/catalog-list";
import { browseCustomers, browseServices } from "@/features/workspace/catalog-search-actions";
import { EmptyState } from "./empty-state";
import styles from "./registry.module.css";

export function CatalogList({ kind, initial }: { kind: CatalogKind; initial: CatalogPage }) {
  const services = kind === "services";
  const base = services ? "/servicos" : "/clientes";
  const subject = services ? "serviço" : "cliente";
  const [state, action, pending] = useActionState(services ? browseServices : browseCustomers, initial);

  return (
    <form action={action} className={styles.form} aria-busy={pending}>
      <div className={styles.search}>
        <div className={styles.field}>
          <label htmlFor="catalog-query">{services ? "Buscar por nome" : "Buscar por nome ou telefone"}</label>
          <input key={state.query} id="catalog-query" name="busca" type="search" defaultValue={state.query}
            maxLength={100} autoComplete="off" />
        </div>
        <div className={styles.actions}>
          <button type="submit" className={styles.secondary} disabled={pending}>
            <Search size={16} aria-hidden="true" /> {pending ? "Buscando…" : "Buscar"}
          </button>
          {state.query && <button type="submit" name="limpar" value="1" className="text-link" disabled={pending}>Limpar busca</button>}
        </div>
      </div>

      {state.failed && <p className={styles.error} role="alert">Não foi possível consultar a lista. Tente buscar novamente.</p>}
      {!state.failed && state.rows.length === 0 && (
        <EmptyState icon={services ? Scissors : UserRound} heading="h3"
          title={state.query ? "Nenhum resultado" : state.page === 1 ? `Nenhum ${subject} cadastrado` : "Nenhum registro nesta página"}
          description={state.query ? "Tente outro termo ou limpe a busca para voltar à lista completa."
            : state.page === 1 ? `Use o botão acima para cadastrar o primeiro ${subject}.` : "Volte para consultar a página anterior."} />
      )}
      {state.rows.length > 0 && (
        <ul className={styles.list}>
          {state.rows.map(({ id, name, detail, active }) => (
            <li key={id} className={styles.item}>
              <div>
                <div className={styles.itemHeader}>
                  <h3>{name}</h3>
                  {active !== undefined && <span className={styles.badge} data-active={active}>{active ? "Ativo" : "Inativo"}</span>}
                </div>
                <p className={styles.details}>{detail}</p>
              </div>
              <Link href={`${base}/${id}/editar`} prefetch={false} className={styles.secondary}>
                Editar <span className="sr-only">{subject} {name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!state.failed && (state.page > 1 || state.hasNext) && (
        <nav className={styles.actions} aria-label="Paginação dos resultados">
          {state.page > 1 && <button type="submit" name="pagina" value={state.page - 1} className={styles.secondary} disabled={pending}>Anterior</button>}
          <span className={styles.muted}>Página {state.page}</span>
          {state.hasNext && <button type="submit" name="pagina" value={state.page + 1} className={styles.secondary} disabled={pending}>Próxima</button>}
        </nav>
      )}
    </form>
  );
}
