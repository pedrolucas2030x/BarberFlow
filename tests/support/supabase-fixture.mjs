import { createServerClient } from "@supabase/ssr";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";

const publishableKey = "sb_publishable_barberflow_http_fixture";
const signingKey = "fixture-signing-key-only-for-node-tests";
const mainOrg = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Estabelecimento Alfa",
  slug: "estabelecimento-alfa",
  timezone: "America/Rio_Branco",
  status: "active",
};
const secondOrg = { ...mainOrg, id: "10000000-0000-4000-8000-000000000002", name: "Estabelecimento Beta", slug: "estabelecimento-beta" };

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}

export async function startSupabaseFixture() {
  const log = [];
  const users = new Map();
  const tokens = new Map();
  const accounts = [
    ["owner", { role: "owner", organizations: mainOrg }],
    ["manager", { role: "manager", organizations: secondOrg }],
    ["barber", { role: "barber", organizations: secondOrg }],
    ["new-owner", null],
    ["inactive", { role: "owner", organizations: { ...mainOrg, status: "inactive" } }],
  ];

  for (const [index, [handle, membership]] of accounts.entries()) {
    users.set(handle, {
      handle,
      membership,
      user: {
        id: `20000000-0000-4000-8000-00000000000${index + 1}`,
        aud: "authenticated",
        role: "authenticated",
        email: `${handle}@example.test`,
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-01-01T00:00:00Z",
      },
    });
  }

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const account = tokens.get(request.headers.authorization?.replace(/^Bearer /, ""));
    const send = (status, body) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(body));
    };

    if (request.method === "POST" && url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      const { email } = await readJson(request);
      const entry = [...users.values()].find(({ user }) => user.email === email);
      if (!entry) return send(400, { code: "invalid_credentials", message: "Invalid credentials" });
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: entry.user.id, role: entry.user.role, exp: expiresAt })}`;
      const token = `${unsigned}.${createHmac("sha256", signingKey).update(unsigned).digest("base64url")}`;
      tokens.set(token, entry);

      return send(200, {
        access_token: token, expires_at: expiresAt, expires_in: 3600, token_type: "bearer",
        refresh_token: `test-refresh-${entry.handle}`, user: entry.user,
      });
    }

    if (!account) return send(401, { code: "bad_jwt", message: "Invalid session" });
    if (url.pathname === "/auth/v1/user") return send(200, account.user);
    if (url.pathname === "/rest/v1/memberships") {
      if (url.searchParams.get("user_id") !== `eq.${account.user.id}`) return send(403, { code: "42501" });
      return send(200, account.membership ? [account.membership] : []);
    }

    if (request.method === "POST" && url.pathname === "/rest/v1/rpc/create_organization") {
      if (account.membership) return send(403, { code: "42501" });
      const { p_name, p_slug, p_timezone } = await readJson(request);
      log.push({ userId: account.user.id, name: p_name, slug: p_slug, timezone: p_timezone });
      account.membership = {
        role: "owner",
        organizations: { id: "10000000-0000-4000-8000-000000000003", name: p_name, slug: p_slug, timezone: p_timezone, status: "active" },
      };
      return send(200, account.membership.organizations.id);
    }

    return send(404, { message: "Unexpected test request" });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}`;

  return {
    url,
    publishableKey,
    log,
    async makeCookie(handle) {
      const cookies = new Map();
      const client = createServerClient(url, publishableKey, {
        cookies: {
          getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
          setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
        },
      });

      const { error } = await client.auth.signInWithPassword({ email: users.get(handle).user.email, password: "fixture-password" });
      if (error) throw error;
      return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    async close() {
      const closed = once(server, "close");
      server.close();
      await closed;
    },
  };
}
