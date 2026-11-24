import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { startSupabaseFixture } from "./support/supabase-fixture.mjs";

const servers = [];
let baseUrl;
let unconfiguredUrl;
let fixture;

async function startApp(environment) {
  const nextBin = fileURLToPath(import.meta.resolve("next/dist/bin/next"));
  const networkGuard = new URL("./support/loopback-fetch-only.mjs", import.meta.url).href;
  const nextCommand = ["--import", networkGuard, nextBin, "start", "--hostname", "127.0.0.1", "--port", "0"];
  const processInstance = spawn(process.execPath, nextCommand, {
    env: { ...process.env, BARBERFLOW_APP_URL: "http://127.0.0.1:3000", ...environment },
  });
  servers.push(processInstance);

  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error(`Servidor não iniciou.\n${output}`)), 15_000);
    const collectOutput = (chunk) => {
      output += chunk;
      const address = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (address && output.includes("Ready")) {
        clearTimeout(timeout);
        resolve(address[0]);
      }
    };
    processInstance.stdout.on("data", collectOutput);
    processInstance.stderr.on("data", collectOutput);
    processInstance.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    processInstance.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Servidor encerrou com código ${code}. Execute npm run build antes dos testes.\n${output}`));
    });
  });
}

before(async () => {
  fixture = await startSupabaseFixture();
  [baseUrl, unconfiguredUrl] = await Promise.all([
    startApp({ NEXT_PUBLIC_SUPABASE_URL: fixture.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fixture.publishableKey }),
    startApp({ NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" }),
  ]);
});

after(async () => {
  await Promise.all(servers.map(async (server) => {
    if (server.exitCode !== null || server.signalCode !== null) return;
    const exited = once(server, "exit");
    server.kill();
    await exited;
  }));
  await fixture?.close();
});

async function assertRedirect(response, destination) {
  assert.ok([303, 307].includes(response.status), `Esperado redirecionamento, recebido HTTP ${response.status}`);
  assert.equal(new URL(response.headers.get("location"), baseUrl).pathname, destination);
  await response.body?.cancel();
}

async function getAs(handle, path) {
  const cookie = await fixture.makeCookie(handle);
  return fetch(`${baseUrl}${path}`, { headers: { cookie }, redirect: "manual" });
}

test("landing comercial em pt-BR mostra preço do piloto e links de acesso sem Supabase", async () => {
  const response = await fetch(`${unconfiguredUrl}/`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html[^>]*lang="pt-BR"/);
  assert.match(html, /class="[^\"]*landing[^\"]*"/);
  assert.match(html, /Seu negócio\./);
  assert.match(html, /href="\/cadastro"/);
  assert.match(html, /href="\/login"/);
  assert.match(html, /R\$ 49,90/);
  assert.match(html, /14 dias de teste previstos/);
  assert.match(html, /Preço previsto/);
  assert.match(html, /Cobrança somente com sua autorização/);
  assert.match(html, /O que você pode usar no piloto/);
  assert.match(html, /Criar conta para o piloto/);
  assert.match(html, /em desenvolvimento/);
});

test("Tailwind global e CSS Modules são servidos juntos", async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();
  const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+\.css)"/g)].map(([, href]) => href);
  assert.ok(styles.length > 0);

  const css = (await Promise.all(styles.map(async (href) => (await fetch(`${baseUrl}${href}`)).text()))).join("\n");
  assert.match(css, /--font-sans:\s*["']Inter Variable["']/);
  assert.match(css, /\.sr-only\s*\{/);
  assert.match(css, /@media\s*\(/);
  assert.doesNotMatch(css, /@theme\b/);
});

const authPages = [
  ["/login", "Entrar na sua conta"],
  ["/cadastro", "Crie sua conta"],
  ["/recuperar-senha", "Recuperar senha"],
];
for (const [path, heading] of authPages) {
  test(`${path} entrega a página de autenticação`, async () => {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes(heading));
    assert.match(html, /<form\b/);
    assert.doesNotMatch(html, /class="[^\"]*\bundefined\b/);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  });
}

test("senha e confirmação exigem links válidos", async () => {
  await assertRedirect(await fetch(`${baseUrl}/redefinir-senha`, { redirect: "manual" }), "/recuperar-senha");
  await assertRedirect(await fetch(`${baseUrl}/confirmar-email`, { redirect: "manual" }), "/login");
  const rejected = await fetch(`${baseUrl}/auth/confirm?type=recovery&next=https://example.test`, { redirect: "manual" });
  await assertRedirect(rejected, "/recuperar-senha");
});

test("link de recuperação redireciona sem token na URL e grava cookie temporário", async () => {
  const token = "a".repeat(64);
  const response = await fetch(`${baseUrl}/auth/confirm?type=recovery&token_hash=${token}`, { redirect: "manual" });
  assert.equal(response.headers.get("location"), "/redefinir-senha");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const linkCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith("bf-recover-account="));
  assert.match(linkCookie ?? "", /HttpOnly/i);
  assert.match(linkCookie, /Max-Age=900/i);
  await assertRedirect(response, "/redefinir-senha");
});

test("rota protegida permanece fechada sem configuração de Supabase", async () => {
  await assertRedirect(await fetch(`${unconfiguredUrl}/painel`, { redirect: "manual" }), "/login");
});

test("formulário de login avisa e fica desabilitado sem Supabase", async () => {
  const response = await fetch(`${unconfiguredUrl}/login`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<button[^>]*type="submit"[^>]*disabled/);
});

for (const path of ["/painel", "/agenda", "/agenda/novo", "/clientes", "/servicos", "/equipe", "/financeiro", "/configuracoes", "/onboarding"]) {
  test(`${path} exige sessão`, async () => {
    await assertRedirect(await fetch(`${baseUrl}${path}`, { redirect: "manual" }), "/login");
  });
}

test("sessões simultâneas recebem seus próprios dados de estabelecimento", async () => {
  const [owner, manager] = await Promise.all([getAs("owner", "/painel"), getAs("manager", "/configuracoes")]);
  assert.equal(owner.status, 200);
  assert.equal(manager.status, 200);
  assert.match(owner.headers.get("cache-control") ?? "", /no-store/);
  const [ownerPage, managerPage] = await Promise.all([owner.text(), manager.text()]);
  assert.match(ownerPage, /<h1>Painel de controle<\/h1>/);
  assert.match(ownerPage, /Estabelecimento Alfa/);
  assert.doesNotMatch(ownerPage, /Estabelecimento Beta/);
  assert.match(ownerPage, /Cadastros iniciais concluídos/);
  assert.match(ownerPage, /Abrir agenda/);
  assert.match(ownerPage, /<time datetime="\d{4}-\d{2}-\d{2}">/i);
  assert.match(managerPage, /Estabelecimento Beta/);
  assert.doesNotMatch(managerPage, /Estabelecimento Alfa/);
  assert.match(managerPage, /America\/Rio_Branco/);
  assert.match(managerPage, /Gestor/);
});

test("profissional acessa a agenda e não recebe navegação administrativa", async () => {
  await assertRedirect(await getAs("barber", "/financeiro"), "/agenda");
  const schedule = await getAs("barber", "/agenda");
  assert.equal(schedule.status, 200);
  const html = await schedule.text();
  assert.match(html, /<h1>Agenda<\/h1>/);
  assert.doesNotMatch(html, /href="\/financeiro"/);
});

test("estabelecimento inativo bloqueia acesso e não reabre o cadastro", async () => {
  await assertRedirect(await getAs("inactive", "/painel"), "/acesso");
  await assertRedirect(await getAs("inactive", "/onboarding"), "/acesso");
  const blocked = await getAs("inactive", "/acesso");
  assert.match(await blocked.text(), /estabelecimento vinculado à sua conta está inativo/);
});

function decodeHtml(value) {
  const entities = { "&quot;": '"', "&#x27;": "'", "&amp;": "&", "&lt;": "<", "&gt;": ">" };
  return value.replace(/&quot;|&#x27;|&amp;|&lt;|&gt;/g, (entity) => entities[entity]);
}

function readActionBody(html, field) {
  const form = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(([tag]) => tag)
    .find((tag) => tag.includes(`name="${field}"`));
  assert.ok(form);

  const body = new FormData();
  for (const [input] of form.matchAll(/<input\b[^>]*>/g)) {
    const name = input.match(/\bname="([^"]+)"/)?.[1];
    if (name && /\btype="hidden"/.test(input)) {
      body.append(name, decodeHtml(input.match(/\bvalue="([^"]*)"/)?.[1] ?? ""));
    }
  }
  assert.ok([...body.keys()].some((name) => name.startsWith("$ACTION_")));
  return body;
}

test("cadastro concluído mostra o próximo passo de confirmação", async () => {
  const page = await fetch(`${baseUrl}/cadastro`);
  const body = readActionBody(await page.text(), "password");
  body.set("name", "Conta de teste");
  body.set("email", "cadastro@example.test");
  body.set("password", "fixture-password-123");

  const result = await fetch(`${baseUrl}/cadastro`, {
    method: "POST", headers: { origin: baseUrl }, body, signal: AbortSignal.timeout(7000),
  });
  assert.equal(result.status, 200);
  const html = await result.text();
  assert.match(html, /Confira sua caixa de entrada/);
  assert.match(html, /Ir para o login/);
  assert.match(html, /Usar outro e-mail/);
});

test("login feito pelo formulário grava sessão HttpOnly para acessar o painel", async () => {
  const page = await fetch(`${baseUrl}/login`);
  assert.equal(page.status, 200);
  const body = readActionBody(await page.text(), "email");
  body.append("email", "owner@example.test");
  body.append("password", "fixture-password");

  const result = await fetch(`${baseUrl}/login`, {
    method: "POST", headers: { origin: baseUrl }, body, redirect: "manual",
  });
  await assertRedirect(result, "/painel");
  const session = result.headers.getSetCookie().find((cookie) => /sb-.+-auth-token=/.test(cookie));
  assert.match(session ?? "", /HttpOnly/i);
  assert.match(result.headers.get("cache-control") ?? "", /no-store/);
  const panel = await fetch(`${baseUrl}/painel`, { headers: { cookie: session.split(";")[0] } });
  assert.match(await panel.text(), /Estabelecimento Alfa/);
});

test("onboarding autorizado chama a RPC e abre o painel com o cadastro gravado", async () => {
  await assertRedirect(await getAs("new-owner", "/painel"), "/onboarding");
  const cookie = await fixture.makeCookie("new-owner");
  const page = await fetch(`${baseUrl}/onboarding`, { headers: { cookie } });
  assert.equal(page.status, 200);
  const body = readActionBody(await page.text(), "timezone");
  body.append("name", "Estabelecimento Cadastrado");
  body.append("slug", "estabelecimento-cadastrado");
  body.append("timezone", "America/Fortaleza");

  const result = await fetch(`${baseUrl}/onboarding`, {
    method: "POST", headers: { cookie, origin: baseUrl }, body, redirect: "manual",
  });
  await assertRedirect(result, "/painel");
  assert.equal(fixture.log.length, 1);
  assert.equal(fixture.log[0].slug, "estabelecimento-cadastrado");
  const dashboard = await fetch(`${baseUrl}/painel`, { headers: { cookie } });
  const dashboardPage = await dashboard.text();
  assert.match(dashboardPage, /Estabelecimento Cadastrado/);
  assert.match(dashboardPage, /Primeiros passos/);
  assert.match(dashboardPage, /Próximo passo\. Cadastre ou reative um serviço/);

  await assertRedirect(await submitCatalogForm("/servicos/novo", cookie, "durationMinutes", {
    name: "Primeiro serviço", durationMinutes: "30", price: "45,00", active: "on",
  }), "/servicos");
  const updated = await fetch(`${baseUrl}/painel`, { headers: { cookie } });
  assert.match(await updated.text(), /Cadastros iniciais concluídos/);
});

async function submitCatalogForm(path, cookie, field, values) {
  const page = await fetch(`${baseUrl}${path}`, { headers: { cookie }, signal: AbortSignal.timeout(7000) });
  assert.equal(page.status, 200);
  const body = readActionBody(await page.text(), field);
  for (const [name, value] of Object.entries(values)) body.set(name, value);
  return fetch(`${baseUrl}${path}`, {
    method: "POST", headers: { cookie, origin: baseUrl }, body, redirect: "manual", signal: AbortSignal.timeout(7000),
  }).catch((error) => { throw new Error(`POST ${path} (${field}) falhou.`, { cause: error }); });
}

test("proprietário cria e cancela um agendamento pelo formulário", async () => {
  const cookie = await fixture.makeCookie("owner");
  const { service, professional, customer } = fixture.catalogIds;
  const organizationId = fixture.catalogs.professionals.find(({ id }) => id === professional).organization_id;
  const link = { organization_id: organizationId, professional_id: professional, service_id: service };
  const day = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  fixture.catalogs.professional_services.push(link);

  try {
    await assertRedirect(await getAs("barber", "/agenda/novo"), "/agenda");
    const saved = await submitCatalogForm(`/agenda/novo?data=${day}`, cookie, "customer", {
      professional, service, customer, date: day, time: "09:15",
    });
    await assertRedirect(saved, "/agenda");
    const booking = fixture.appointments.at(-1);
    assert.equal(booking.starts_at, `${day}T14:15:00.000Z`);
    const agenda = `/agenda?data=${day}`;
    const html = await (await getAs("owner", agenda)).text();
    assert.match(html, /Corte Alfa.*Cliente Alfa/);
    assert.match(html, /09:15/);
    const other = await (await getAs("manager", agenda)).text();
    assert.doesNotMatch(other, /Cliente Alfa/);
    await assertRedirect(await submitCatalogForm(agenda, cookie, "appointment", { appointment: booking.id, confirm: "on" }), "/agenda");
    assert.equal(booking.status, "canceled");
    assert.match(await (await getAs("owner", agenda)).text(), /Cancelado/);
  } finally {
    fixture.appointments.length = 0;
    fixture.catalogs.professional_services.splice(fixture.catalogs.professional_services.indexOf(link), 1);
  }
});

test("concluir atendimento mantém o pagamento pendente até registrar o recebimento", async () => {
  const cookie = await fixture.makeCookie("owner");
  const organizationId = fixture.catalogs.professionals[0].organization_id;
  const booking = {
    id: "60000000-0000-4000-8000-000000000001", organization_id: organizationId,
    starts_at: "2026-01-03T14:00:00Z", ends_at: "2026-01-03T14:30:00Z",
    status: "confirmed", service_name: "Corte para recebimento", professional_name: "Profissional Alfa",
    customer_name: "Cliente Alfa", price_cents: 5000,
  };
  fixture.appointments.push(booking);
  const path = "/agenda?data=2026-01-03";

  try {
    await assertRedirect(await submitCatalogForm(path, cookie, "completion", { completion: booking.id }), "/agenda");
    const completed = await (await getAs("owner", path)).text();
    assert.match(completed, /Concluído/);
    assert.match(completed, /Pagamento pendente/);
    assert.match(await (await getAs("owner", "/financeiro")).text(), /Nenhum pagamento recebido nesta data/);

    const payment = await submitCatalogForm(path, cookie, "payment", { payment: booking.id, method: "pix" });
    assert.match(payment.headers.get("location"), /resultado=recebido/);
    await assertRedirect(payment, "/agenda");
    const paid = await (await getAs("owner", path)).text();
    assert.match(paid, />Pago</);
    assert.doesNotMatch(paid, /Confirmar recebimento/);

    const ledger = await (await getAs("owner", "/financeiro")).text();
    assert.match(ledger, /Corte para recebimento/);
    assert.match(ledger, /Pix/);
    assert.match(ledger, /R\$\s*50,00/);
    assert.doesNotMatch(await (await getAs("manager", "/financeiro")).text(), /Corte para recebimento/);
  } finally {
    fixture.appointments.splice(fixture.appointments.indexOf(booking), 1);
  }
});

test("catálogos administrativos mostram somente os registros do estabelecimento da sessão", async () => {
  const [services, customers, team] = await Promise.all([
    getAs("owner", "/servicos"), getAs("owner", "/clientes"), getAs("manager", "/equipe"),
  ]);
  for (const response of [services, customers, team]) assert.equal(response.status, 200);
  const [servicesPage, customersPage, teamPage] = await Promise.all([services.text(), customers.text(), team.text()]);
  assert.match(servicesPage, /Corte Alfa/);
  assert.doesNotMatch(servicesPage, /Corte Beta/);
  assert.match(customersPage, /Cliente Alfa/);
  assert.doesNotMatch(customersPage, /Cliente Beta/);
  assert.match(teamPage, /Profissional Beta/);
  assert.doesNotMatch(teamPage, /Profissional Alfa/);
});

test("busca de serviços mantém o filtro ao avançar a página", async () => {
  const cookie = await fixture.makeCookie("owner");
  const template = fixture.catalogs.services.find(({ id }) => id === fixture.catalogIds.service);
  const baseCount = fixture.catalogs.services.length;
  fixture.catalogs.services.push(...Array.from({ length: 31 }, (_, index) => ({
    ...template, id: `70000000-0000-4000-8000-${String(index).padStart(12, "0")}`, name: `Barba série ${index + 1}`,
  })));

  try {
    const found = await submitCatalogForm("/servicos", cookie, "busca", { busca: "barba série" });
    const html = await found.text();
    assert.match(html, /<h3>Barba série 1<\/h3>/);
    assert.doesNotMatch(html, /<h3>Corte Alfa<\/h3>/);
    const nextAction = readActionBody(html, "busca");
    nextAction.set("busca", "barba série");
    nextAction.set("pagina", "2");
    const next = await fetch(`${baseUrl}/servicos`, {
      method: "POST", headers: { origin: baseUrl, cookie }, body: nextAction, signal: AbortSignal.timeout(7000),
    });
    const nextPage = await next.text();
    assert.match(nextPage, /<h3>Barba série 31<\/h3>/);
    assert.doesNotMatch(nextPage, /<h3>Corte Alfa<\/h3>/);
  } finally {
    fixture.catalogs.services.splice(baseCount);
  }
});

test("busca de clientes aceita telefone formatado e mantém o termo fora do endereço", async () => {
  const cookie = await fixture.makeCookie("owner");
  const found = await submitCatalogForm("/clientes", cookie, "busca", { busca: "(86) 99111-0000" });
  assert.match(await found.text(), /<h3>Cliente Alfa<\/h3>/);
  assert.equal(new URL(found.url).search, "");
  const missing = await submitCatalogForm("/clientes", cookie, "busca", { busca: "99123-4567" });
  assert.match(await missing.text(), /Nenhum resultado/);
});

test("formulário de serviço grava centavos inteiros, edita e desativa o registro", async () => {
  const cookie = await fixture.makeCookie("owner");
  const created = await submitCatalogForm("/servicos/novo", cookie, "durationMinutes", {
    name: "Serviço do teste", durationMinutes: "35", price: "45,90", active: "on",
  });
  await assertRedirect(created, "/servicos");
  const service = fixture.catalogs.services.find(({ name }) => name === "Serviço do teste");
  assert.ok(service);
  assert.equal(service.price_cents, 4590);
  assert.equal(service.organization_id, fixture.catalogs.services[0].organization_id);

  const wrongPrice = await submitCatalogForm(`/servicos/${service.id}/editar`, cookie, "durationMinutes", {
    name: service.name, durationMinutes: "35", price: "45,901", active: "on",
  });
  assert.match(await wrongPrice.text(), /com até duas casas decimais/);
  assert.equal(service.price_cents, 4590);

  const edited = await submitCatalogForm(`/servicos/${service.id}/editar`, cookie, "durationMinutes", {
    name: "Serviço do teste editado", durationMinutes: "40", price: "46,15",
  });
  await assertRedirect(edited, "/servicos");
  assert.equal(service.price_cents, 4615);
  assert.equal(service.duration_minutes, 40);
  assert.equal(service.active, false);
});

test("formulário de clientes normaliza telefone, registra o consentimento e permite excluir", async () => {
  const cookie = await fixture.makeCookie("owner");
  const created = await submitCatalogForm("/clientes/novo", cookie, "marketingConsent", {
    name: "Cliente do teste", phone: "(86) 99998-1234",
  });
  await assertRedirect(created, "/clientes");
  const customer = fixture.catalogs.customers.find(({ name }) => name === "Cliente do teste");
  assert.ok(customer);
  assert.equal(customer.phone, "+5586999981234");
  assert.equal(customer.marketing_consent, false);

  const editPath = `/clientes/${customer.id}/editar`;
  const wrongPhone = await submitCatalogForm(editPath, cookie, "marketingConsent", {
    name: customer.name, phone: "1234", marketingConsent: "on",
  });
  assert.match(await wrongPhone.text(), /Informe um telefone com DDD/);
  assert.equal(customer.phone, "+5586999981234");

  const edited = await submitCatalogForm(editPath, cookie, "marketingConsent", {
    name: customer.name, phone: customer.phone, marketingConsent: "on",
  });
  await assertRedirect(edited, "/clientes");
  assert.equal(customer.marketing_consent, true);

  const refused = await submitCatalogForm(editPath, cookie, "confirmation", {});
  await assertRedirect(refused, editPath);
  const notice = await fetch(new URL(refused.headers.get("location"), baseUrl), { headers: { cookie } });
  assert.match(await notice.text(), /Confirme a exclusão do cadastro/);
  assert.ok(fixture.catalogs.customers.some(({ id }) => id === customer.id));

  const deleted = await submitCatalogForm(editPath, cookie, "confirmation", { confirmation: "on" });
  await assertRedirect(deleted, "/clientes");
  assert.ok(fixture.catalogs.customers.every(({ id }) => id !== customer.id));
});

test("cadastro de equipe grava a comissão em pontos-base e bloqueia edição entre barbearias", async () => {
  const cookie = await fixture.makeCookie("owner");
  const created = await submitCatalogForm("/equipe", cookie, "commission", {
    name: "Profissional do teste", commission: "27,35",
  });
  assert.match(await created.text(), /Profissional cadastrado/);
  const professional = fixture.catalogs.professionals.find(({ name }) => name === "Profissional do teste");
  assert.ok(professional);
  assert.equal(professional.commission_bps, 2735);

  const refused = await submitCatalogForm("/equipe", cookie, "commission", {
    id: fixture.catalogIds.foreignProfessional, name: "Tentativa de edição", commission: "1,50",
  });
  assert.match(await refused.text(), /Profissional indisponível para edição/);
  assert.equal(fixture.catalogs.professionals.find(({ id }) => id === fixture.catalogIds.foreignProfessional).commission_bps, 3500);
});

test("expediente vincula serviço, grava pausa e converte bloqueio no fuso da barbearia", async () => {
  const cookie = await fixture.makeCookie("owner");
  const professionalId = fixture.catalogIds.professional;
  const path = `/equipe/${professionalId}/expediente`;
  const related = await submitCatalogForm(path, cookie, "service_id", { professional_id: professionalId, service_id: fixture.catalogIds.service });
  assert.match(await related.text(), /Serviço vinculado/);
  assert.ok(fixture.catalogs.professional_services.some(({ service_id }) => service_id === fixture.catalogIds.service));

  const shift = await submitCatalogForm(path, cookie, "weekday", {
    professional_id: professionalId, weekday: "1", starts_at: "09:00", ends_at: "17:00",
    break_starts_at: "12:00", break_ends_at: "13:00",
  });
  assert.match(await shift.text(), /Turno cadastrado/);
  assert.equal(fixture.catalogs.working_hours.find(({ professional_id }) => professional_id === professionalId)?.break_ends_at, "13:00");

  const scheduled = await submitCatalogForm(path, cookie, "reason", {
    professional_id: professionalId, starts_at: "2026-12-05T09:30", ends_at: "2026-12-05T10:30", reason: "Indisponibilidade",
  });
  assert.match(await scheduled.text(), /Bloqueio cadastrado/);
  const block = fixture.catalogs.time_off.find(({ professional_id }) => professional_id === professionalId);
  assert.equal(block?.starts_at, "2026-12-05T14:30:00.000Z");
  assert.equal(block?.ends_at, "2026-12-05T15:30:00.000Z");
});

test("imagem local é servida como WebP", async () => {
  const response = await fetch(`${baseUrl}/barbershop.webp`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^image\/webp/);
  await response.body?.cancel();
});

test("rota inexistente retorna 404 com link para a página inicial", async () => {
  const response = await fetch(`${baseUrl}/secao-inexistente`);
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /<h1>Página não encontrada<\/h1>/);
  assert.match(html, /<a[^>]*href="\/">Voltar ao início<\/a>/);
});
