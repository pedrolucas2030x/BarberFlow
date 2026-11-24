"use server";

import { requireWorkspace } from "./access";
import { loadCatalogPage, parseCatalogPage, type CatalogKind, type CatalogPage } from "./catalog-list";

async function browse(kind: CatalogKind, previous: CatalogPage, form: FormData) {
  const { organization } = await requireWorkspace();
  const raw = form.get("busca");
  const clear = form.get("limpar") === "1";
  const query = !clear && typeof raw === "string" ? raw.trim().replace(/\p{Cc}/gu, "").slice(0, 100) : "";
  const page = query === previous?.query && !clear ? parseCatalogPage(form.get("pagina")) : 1;
  return loadCatalogPage(kind, organization.id, page, query);
}

export async function browseServices(previous: CatalogPage, form: FormData) {
  return browse("services", previous, form);
}

export async function browseCustomers(previous: CatalogPage, form: FormData) {
  return browse("customers", previous, form);
}
