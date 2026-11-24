import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { z } from "zod";
import { bookingClient } from "@/features/public-booking/data";
import { customerFieldsSchema } from "@/lib/validation/customers";

const slotFields = { service: z.uuid(), professional: z.uuid(), day: z.iso.date() };
const input = z.discriminatedUnion("kind", [
  z.object({ ...slotFields, kind: z.literal("slots") }),
  z.object({
    ...slotFields, kind: z.literal("reserve"),
    start: z.iso.datetime({ offset: true }), name: customerFieldsSchema.shape.name,
    phone: customerFieldsSchema.shape.phone, attempt: z.uuid(),
    price: z.int().min(0).max(2147483647), minutes: z.int().min(1).max(1440),
  }),
]);

const errors: Record<string, [number, string]> = {
  invalid: [422, "Confira os dados informados."],
  not_found: [404, "Serviço ou profissional indisponível."],
  conflict: [409, "Esse horário ficou indisponível. Busque os horários novamente."],
  offer: [409, "O preço ou a duração mudou. Atualize a página e confirme a nova oferta."],
  attempt: [409, "Os dados da tentativa mudaram. Escolha o horário novamente."],
  rate: [429, "Muitas tentativas. Aguarde um minuto e tente novamente."],
  unavailable: [503, "Serviço temporariamente indisponível. Tente novamente."],
};

function failure(code: string) {
  const [status, message] = Object.hasOwn(errors, code) ? errors[code] : errors.unavailable;
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (status === 429) headers.set("Retry-After", "60");
  return NextResponse.json({ error: code, message }, { status, headers });
}

async function readRequest(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let bytes = 0;
  let content = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return JSON.parse(content + decoder.decode()) as unknown;
      bytes += value.byteLength;
      if (bytes > 4096) {
        await reader.cancel();
        return null;
      }
      content += decoder.decode(value, { stream: true });
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 63) return failure("not_found");
  const parsed = input.safeParse(await readRequest(request));
  if (!parsed.success) return failure("invalid");
  const backend = bookingClient();
  if (!backend) return failure("unavailable");
  const payload = parsed.data;
  const forwarded = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.trim() : undefined;
  const origin = createHmac("sha256", backend.key).update(forwarded && isIP(forwarded) ? forwarded : "shared").digest("hex");
  const reserve = payload.kind === "reserve" ? payload : null;
  const { data, error } = await backend.client.rpc("public_booking", {
    p_slug: slug, p_origin: origin, p_service: payload.service, p_professional: payload.professional, p_day: payload.day,
    p_start: reserve?.start ?? null, p_name: reserve?.name ?? null, p_phone: reserve?.phone ?? null,
    p_attempt: reserve?.attempt ?? null, p_price: reserve?.price ?? null, p_minutes: reserve?.minutes ?? null,
  });
  if (error || !data) return failure("unavailable");
  if (data.error) return failure(data.error);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
