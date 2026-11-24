import assert from "node:assert/strict";
import { test } from "node:test";
import { customerFieldsSchema } from "../src/lib/validation/customers.ts";
import { serviceFieldsSchema } from "../src/lib/validation/services.ts";

const service = { name: "Corte de teste", durationMinutes: "30", price: "35,90", active: "on" };
const customer = { name: "Cliente de teste", phone: "(86) 99123-4567", marketingConsent: null };

test("validação de serviços converte preços em reais para centavos inteiros", () => {
  for (const [price, cents] of [
    ["0", 0], ["0,01", 1], ["35,90", 3590], ["35.9", 3590], ["1.234,56", 123456], ["21.474.836,47", 2147483647],
  ]) {
    assert.equal(serviceFieldsSchema.parse({ ...service, price }).price, cents);
  }

  for (const price of ["-1", "0.001", "1,123", "21.474.836,48", "1e2", "1,23.45"]) {
    assert.equal(serviceFieldsSchema.safeParse({ ...service, price }).success, false, price);
  }
});

test("validação de serviços exige duração inteira e aceita desativação", () => {
  assert.equal(serviceFieldsSchema.parse({ ...service, active: null }).active, false);
  assert.equal(serviceFieldsSchema.parse({ ...service, durationMinutes: "1440" }).durationMinutes, 1440);
  for (const durationMinutes of ["0", "1441", "15.5", "1e2"]) {
    assert.equal(serviceFieldsSchema.safeParse({ ...service, durationMinutes }).success, false, durationMinutes);
  }
});

test("validação de clientes normaliza DDD brasileiro e telefones internacionais", () => {
  for (const [phone, normalized] of [
    ["(86) 99123-4567", "+5586991234567"], ["5586991234567", "+5586991234567"],
    ["+55 (86) 9123-4567", "+558691234567"], ["+1 (415) 555-2671", "+14155552671"],
  ]) {
    assert.equal(customerFieldsSchema.parse({ ...customer, phone }).phone, normalized);
  }

  for (const phone of ["99123-4567", "(86) 99123-4567 ramal 2", "+5500991234567", "+0123456789"]) {
    assert.equal(customerFieldsSchema.safeParse({ ...customer, phone }).success, false, phone);
  }
});

test("validação de clientes exige consentimento explícito para marketing", () => {
  assert.equal(customerFieldsSchema.parse(customer).marketingConsent, false);
  assert.equal(customerFieldsSchema.parse({ ...customer, marketingConsent: "on" }).marketingConsent, true);
  assert.equal(customerFieldsSchema.safeParse({ ...customer, marketingConsent: "true" }).success, false);
});
