begin;

select '1..13';

create function pg_temp.check_test(passed boolean, number integer, description text)
returns text language plpgsql as $$
begin
  if passed is distinct from true then raise exception 'not ok % - %', number, description; end if;
  return format('ok %s - %s', number, description);
end;
$$;

create function pg_temp.has_sqlstate(statement text, expected text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  if sqlstate <> expected then raise; end if;
  return true;
end;
$$;

insert into auth.users (id, email) values
  ('71000000-0000-4000-8000-000000000001', 'caixa-owner@example.invalid'),
  ('71000000-0000-4000-8000-000000000002', 'caixa-manager@example.invalid'),
  ('71000000-0000-4000-8000-000000000003', 'caixa-barber@example.invalid');
insert into public.organizations (id, name, slug, timezone) values
  ('72000000-0000-4000-8000-000000000001', 'Barbearia Caixa', 'caixa-a', 'America/Fortaleza'),
  ('72000000-0000-4000-8000-000000000002', 'Outra Barbearia', 'caixa-b', 'America/Fortaleza');
insert into public.memberships (id, organization_id, user_id, role) values
  ('73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'owner'),
  ('73000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 'manager'),
  ('73000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000003', 'barber');
insert into public.professionals (id, organization_id, membership_id, name)
values ('74000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000003', 'Profissional Caixa');
insert into public.services (id, organization_id, name, duration_minutes, price_cents)
values ('75000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'Corte Caixa', 30, 7500);

insert into public.appointments (id, organization_id, professional_id, service_id, starts_at, ends_at, price_cents, commission_bps)
select ('76000000-0000-4000-8000-00000000000' || row.number)::uuid,
  '72000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001',
  '75000000-0000-4000-8000-000000000001', now() + row.offset_time, now() + row.offset_time + interval '30 minutes',
  row.price, 2000
from (values (1, interval '-2 days', 4500), (2, interval '+1 hour', 4500), (3, interval '-3 days', 0)) as row(number, offset_time, price);

create function pg_temp.complete(suffix text) returns boolean language sql as $$
  select public.complete_appointment('72000000-0000-4000-8000-000000000001',
    ('76000000-0000-4000-8000-00000000000' || suffix)::uuid);
$$;
create function pg_temp.pay(method text, suffix text default '1') returns void language sql as $$
  select public.record_appointment_payment('72000000-0000-4000-8000-000000000001',
    ('76000000-0000-4000-8000-00000000000' || suffix)::uuid, method);
$$;
create function pg_temp.finance(day date default (now() at time zone 'America/Fortaleza')::date)
returns jsonb language sql stable as $$
  select public.received_payments_day('72000000-0000-4000-8000-000000000001', day);
$$;

set local role anon;
select pg_temp.check_test(pg_temp.has_sqlstate('select pg_temp.finance()', '42501'), 1, 'visitante não consulta recebimentos');

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
select pg_temp.check_test(pg_temp.has_sqlstate($$select pg_temp.pay('pix')$$, 'BF011'), 2, 'recebimento exige atendimento concluído');
select pg_temp.check_test(not pg_temp.complete('2'), 3, 'atendimento futuro não pode ser concluído');
select pg_temp.check_test(pg_temp.complete('1') and pg_temp.complete('1'), 4, 'conclusão pode ser repetida sem alterar o estado');
select pg_temp.check_test(pg_temp.finance()->>'total_cents' = '0', 5, 'conclusão não gera receita');
select pg_temp.check_test(not public.cancel_appointment('72000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000001'), 6, 'atendimento concluído não pode ser cancelado');
select pg_temp.check_test(pg_temp.has_sqlstate($$select pg_temp.pay('transferência desconhecida')$$, 'BF010'),
  7, 'rejeita formas de pagamento não reconhecidas');

select pg_temp.pay('pix');
select pg_temp.pay('pix');
select pg_temp.check_test((select count(*) = 1 and min(amount_cents) = 4500 and min(method) = 'pix' from public.payments),
  8, 'grava uma vez pelo preço congelado do agendamento');
select pg_temp.check_test(pg_temp.has_sqlstate($$select pg_temp.pay('cash')$$, 'BF012'),
  9, 'uma segunda forma de pagamento não altera o recebimento');
select pg_temp.check_test(pg_temp.finance()->>'total_cents' = '4500'
  and pg_temp.finance()->'payments'->0->>'service_name' = 'Corte Caixa'
  and pg_temp.finance((now() at time zone 'America/Fortaleza')::date - 2)->>'total_cents' = '0',
  10, 'total segue a data de recebimento e não a data do atendimento');
select pg_temp.complete('3');
select pg_temp.check_test(pg_temp.has_sqlstate($$select pg_temp.pay('pix', '3')$$, 'BF011'), 11, 'cortesia não gera lançamento');

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', true);
select pg_temp.check_test((select count(*) = 0 from public.payments)
  and pg_temp.finance()->>'total_cents' = '0'
  and pg_temp.has_sqlstate($$select pg_temp.pay('pix')$$, '42501'),
  12, 'gestor de outra barbearia não lê nem registra o pagamento');

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000003', true);
select pg_temp.check_test((select count(*) = 0 from public.payments)
  and (select count(*) = 1 and count(is_paid) = 0 and count(price_cents) = 0 and not bool_or(can_complete)
    from public.list_appointments_with_payments('72000000-0000-4000-8000-000000000001',
      (now() at time zone 'America/Fortaleza')::date - 2))
  and pg_temp.has_sqlstate($$select pg_temp.complete('1')$$, '42501'),
  13, 'profissional vê o próprio atendimento sem valores ou estado financeiro');

rollback;
