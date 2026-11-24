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
  const processInstance = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", "0"], {
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

for (const path of ["/painel", "/agenda", "/clientes", "/servicos", "/equipe", "/financeiro", "/configuracoes", "/onboarding"]) {
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
  assert.match(ownerPage, /Sem dados operacionais/);
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
    const name = input.match(/\bname="(\$ACTION_[^"]+)"/)?.[1];
    if (name) body.append(name, decodeHtml(input.match(/\bvalue="([^"]*)"/)?.[1] ?? ""));
  }
  assert.ok([...body.keys()].some((name) => name.startsWith("$ACTION_")));
  return body;
}

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
  assert.match(await dashboard.text(), /Estabelecimento Cadastrado/);
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
