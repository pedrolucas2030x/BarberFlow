import { createServerClient } from "@supabase/ssr";
import { createHmac, randomUUID } from "node:crypto";
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

const catalogIds = {
  service: "30000000-0000-4000-8000-000000000001",
  foreignService: "30000000-0000-4000-8000-000000000002",
  customer: "40000000-0000-4000-8000-000000000001",
  professional: "50000000-0000-4000-8000-000000000001",
  foreignProfessional: "50000000-0000-4000-8000-000000000002",
};

const catalogDefaults = {
  professionals: { active: true, membership_id: null, commission_bps: 0 },
  services: { active: true },
  customers: { marketing_consent: false },
};

function createCatalogFixtures() {
  return {
    services: [
      { id: catalogIds.service, organization_id: mainOrg.id, name: "Corte Alfa", price_cents: 5000, duration_minutes: 30, active: true },
      { id: catalogIds.foreignService, organization_id: secondOrg.id, name: "Corte Beta", price_cents: 8000, duration_minutes: 45, active: true },
    ],
    customers: [
      { id: catalogIds.customer, organization_id: mainOrg.id, name: "Cliente Alfa", phone: "+5586991110000", marketing_consent: false },
      { id: randomUUID(), organization_id: secondOrg.id, name: "Cliente Beta", phone: "+5586992220000", marketing_consent: false },
    ],
    professionals: [
      { id: catalogIds.professional, organization_id: mainOrg.id, name: "Profissional Alfa", active: true, commission_bps: 2750, membership_id: null },
      { id: catalogIds.foreignProfessional, organization_id: secondOrg.id, name: "Profissional Beta", active: true, commission_bps: 3500, membership_id: null },
    ],
    professional_services: [],
    working_hours: [],
    time_off: [],
  };
}

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}

export async function startSupabaseFixture() {
  const log = [];
  const catalogs = createCatalogFixtures();
  const appointments = [];
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

    if (request.method === "POST" && url.pathname === "/auth/v1/signup") {
      const { email } = await readJson(request);
      return send(200, { id: randomUUID(), email, aud: "authenticated", app_metadata: {}, user_metadata: {} });
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

    const appointmentAction = url.pathname.match(/^\/rest\/v1\/rpc\/(list|create|cancel)_appointments?$/)?.[1];
    const paidAgenda = url.pathname === "/rest/v1/rpc/list_appointments_with_payments";
    const soloBooking = url.pathname === "/rest/v1/rpc/book_solo_appointment";
    const complete = url.pathname === "/rest/v1/rpc/complete_appointment";
    const recordPayment = url.pathname === "/rest/v1/rpc/record_appointment_payment";
    const finances = url.pathname === "/rest/v1/rpc/received_payments_day";
    if (request.method === "POST" && (appointmentAction || soloBooking || paidAgenda || complete || recordPayment || finances)) {
      const args = await readJson(request);
      const organization = account.membership?.organizations;
      if (!organization || args.p_organization_id !== organization.id) return send(403, { code: "42501" });
      const date = new Intl.DateTimeFormat("sv-SE", { timeZone: organization.timezone, dateStyle: "short" });
      const ownRows = appointments.filter((row) => row.organization_id === organization.id);
      if (appointmentAction === "list" || paidAgenda) return send(200, ownRows
        .filter((row) => account.membership.role !== "barber" && date.format(new Date(row.starts_at)) === args.p_day)
        .map((row) => ({
          ...row, is_paid: Boolean(row.receipt),
          can_complete: row.status === "confirmed" && Date.parse(row.starts_at) <= Date.now(),
        })));
      if (account.membership.role === "barber") return send(403, { code: "42501" });
      const appointment = ownRows.find(({ id }) => id === args.p_appointment_id);
      if (complete) {
        if (!appointment || appointment.status === "canceled" || Date.parse(appointment.starts_at) > Date.now()) return send(200, false);
        appointment.status = "completed";
        return send(200, true);
      }
      if (recordPayment) {
        if (appointment?.status !== "completed" || appointment.price_cents <= 0) return send(400, { code: "BF011" });
        if (appointment.receipt && appointment.receipt.method !== args.p_method) return send(400, { code: "BF012" });
        appointment.receipt ??= { amount_cents: appointment.price_cents, method: args.p_method, received_at: new Date().toISOString() };
        return send(200, null);
      }
      if (finances) {
        const payments = ownRows.filter(({ receipt }) => receipt && date.format(new Date(receipt.received_at)) === args.p_day)
          .map(({ id, receipt, starts_at, service_name, professional_name }) => ({
            appointment_id: id, ...receipt, starts_at, service_name, professional_name,
          }));
        return send(200, { total_cents: payments.reduce((sum, row) => sum + row.amount_cents, 0), payments });
      }
      if (appointmentAction === "cancel") {
        if (appointment?.status !== "confirmed") return send(200, false);
        appointment.status = "canceled";
        return send(200, true);
      }
      const service = catalogs.services.find(({ id, organization_id }) => id === args.p_service_id && organization_id === organization.id);
      const professional = catalogs.professionals.find(({ id, organization_id }) =>
        organization_id === organization.id && (soloBooking || id === args.p_professional_id));
      const customer = catalogs.customers.find(({ id, organization_id }) => id === args.p_customer_id && organization_id === organization.id);
      if (!service || !professional || !customer) return send(400, { code: "BF002" });
      const row = {
        id: randomUUID(), organization_id: organization.id, starts_at: args.p_starts_at,
        ends_at: new Date(Date.parse(args.p_starts_at) + service.duration_minutes * 60_000).toISOString(),
        status: "confirmed", service_name: service.name, professional_name: professional.name,
        customer_name: customer.name, price_cents: service.price_cents,
      };
      appointments.push(row);
      return send(200, row.id);
    }

    const table = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1];
    if (table && Object.hasOwn(catalogs, table)) {
      const membership = account.membership;
      if (!membership || membership.role === "barber" || membership.organizations.status !== "active") {
        return send(403, { code: "42501" });
      }

      const tenant = membership.organizations.id;
      if (request.method !== "POST" && url.searchParams.get("organization_id") !== `eq.${tenant}`) {
        return send(403, { code: "42501" });
      }

      const rows = catalogs[table];
      const filters = [...url.searchParams].filter(([, value]) => value.startsWith("eq."));
      const matches = rows.filter((row) => row.organization_id === tenant && filters.every(([field, value]) => String(row[field]) === value.slice(3)));
      const representation = request.headers.prefer?.includes("return=representation");
      const wantsSingle = request.headers.accept?.includes("vnd.pgrst.object+json");
      const sendRows = (result) => {
        if (!wantsSingle) return send(200, result);
        if (result.length === 1) return send(200, result[0]);
        return send(406, { code: "PGRST116" });
      };

      if (request.method === "GET") {
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const limit = Number(url.searchParams.get("limit") ?? matches.length);
        const name = url.searchParams.get("name")?.match(/^ilike\.%(.*)%$/)?.[1].replace(/\\(.)/g, "$1").toLowerCase();
        const phone = url.searchParams.get("phone")?.match(/^like\.%(\d+)%$/)?.[1];
        const filtered = matches.filter((row) => (!name || row.name.toLowerCase().includes(name)) && (!phone || row.phone.includes(phone)));
        return sendRows(filtered.slice(offset, offset + limit));
      }
      if (request.method === "POST") {
        const values = await readJson(request);
        if (values.organization_id !== tenant) return send(403, { code: "42501" });
        const row = { id: randomUUID(), created_at: "2026-01-01T00:00:00Z", ...catalogDefaults[table], ...values };
        rows.push(row);
        return representation ? sendRows([row]) : send(201);
      }
      if (request.method === "PATCH") {
        const values = await readJson(request);
        if ("organization_id" in values || "id" in values) return send(403, { code: "42501" });
        for (const row of matches) Object.assign(row, values);
        return representation ? sendRows(matches) : send(204);
      }
      if (request.method === "DELETE") {
        catalogs[table] = rows.filter((row) => !matches.includes(row));
        return representation ? sendRows(matches) : send(204);
      }
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
    appointments,
    catalogs,
    catalogIds,
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
