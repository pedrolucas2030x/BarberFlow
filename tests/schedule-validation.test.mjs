import test from "node:test";
import assert from "node:assert/strict";
import { professionalSchema } from "../src/lib/validation/professionals.ts";
import { formatTenantDateTime, tenantDateTimeToInstant, timeOffSchema, weeklyShiftSchema } from "../src/lib/validation/schedule.ts";

test("comissão aceita centésimos exatos entre 0% e 100%", () => {
  const base = { id: null, name: "Profissional" };
  assert.equal(professionalSchema.parse({ ...base, commission: "17,29" }).commission, 1729);
  assert.equal(professionalSchema.parse({ ...base, commission: "0.01" }).commission, 1);
  assert.equal(professionalSchema.parse({ ...base, commission: "100" }).commission, 10_000);
  for (const commission of ["100,01", "-0,01", "10,005", "1e2", ""]) {
    assert.equal(professionalSchema.safeParse({ ...base, commission }).success, false);
  }
});

test("turno valida dia, intervalo no mesmo dia e pausa completa estritamente interna", () => {
  const valid = {
    id: null,
    weekday: "1",
    starts_at: "09:00",
    ends_at: "18:00",
    break_starts_at: "12:00",
    break_ends_at: "13:00",
  };
  assert.equal(weeklyShiftSchema.parse(valid).weekday, 1);
  assert.equal(weeklyShiftSchema.parse({ ...valid, break_starts_at: "", break_ends_at: "" }).break_starts_at, null);
  for (const invalid of [{ weekday: "7" }, { ends_at: "24:00" }, { ends_at: "08:00" }, { starts_at: "9:00" },
    { break_starts_at: "09:00" }, { break_ends_at: "18:00" }, { break_ends_at: "11:00" }, { break_ends_at: "" }]) {
    assert.equal(weeklyShiftSchema.safeParse({ ...valid, ...invalid }).success, false);
  }
});

test("bloqueio usa fuso IANA do estabelecimento no cadastro e na edição", () => {
  const dateTime = "2026-11-24T20:15";
  for (const [timeZone, instant] of [
    ["America/Fortaleza", "2026-11-24T23:15:00.000Z"],
    ["America/Rio_Branco", "2026-11-25T01:15:00.000Z"],
    ["Asia/Kathmandu", "2026-11-24T14:30:00.000Z"],
  ]) {
    assert.deepEqual(tenantDateTimeToInstant(dateTime, timeZone), { instant });
    assert.equal(formatTenantDateTime(instant, timeZone), dateTime);
  }
  const block = { id: null, starts_at: dateTime, ends_at: "2026-11-24T21:15" };
  assert.equal(timeOffSchema.parse({ ...block, reason: "  " }).reason, null);
  assert.equal(timeOffSchema.safeParse({ ...block, reason: "Motivo\ninválido" }).success, false);
});

test("horário local ausente, duplicado ou data impossível não vira instante", () => {
  assert.deepEqual(tenantDateTimeToInstant("2026-03-08T02:30", "America/New_York"), { error: "missing" });
  assert.deepEqual(tenantDateTimeToInstant("2026-11-01T01:30", "America/New_York"), { error: "ambiguous" });
  assert.deepEqual(tenantDateTimeToInstant("2026-02-30T10:20", "America/Fortaleza"), { error: "invalid" });
  assert.deepEqual(tenantDateTimeToInstant("2026-11-24T24:00", "America/Fortaleza"), { error: "invalid" });
});
