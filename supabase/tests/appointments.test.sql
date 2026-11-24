begin;

select '1..16';

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
  ('61000000-0000-4000-8000-000000000001', 'agenda-owner@example.invalid'),
  ('61000000-0000-4000-8000-000000000002', 'agenda-barber@example.invalid'),
  ('61000000-0000-4000-8000-000000000003', 'agenda-manager@example.invalid');

insert into public.organizations (id, name, slug, timezone) values
  ('62000000-0000-4000-8000-000000000001', 'Barbearia A', 'agenda-teste-a', 'America/Fortaleza'),
  ('62000000-0000-4000-8000-000000000002', 'Barbearia B', 'agenda-teste-b', 'America/Fortaleza');
insert into public.memberships (id, organization_id, user_id, role) values
  ('63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'owner'),
  ('63000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', 'barber'),
  ('63000000-0000-4000-8000-000000000003', '62000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000003', 'manager');

insert into public.professionals (id, organization_id, membership_id, name, commission_bps) values
  ('64000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000002', 'Profissional A', 2750),
  ('64000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000001', null, 'Profissional B', 3500);
insert into public.services (id, organization_id, name, duration_minutes, price_cents)
values ('65000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'Corte teste', 30, 6500);
insert into public.customers (id, organization_id, name, phone) values
  ('66000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'Cliente A', '+5586999988001'),
  ('66000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000002', 'Cliente B', '+5586999988002');
insert into public.professional_services (organization_id, professional_id, service_id)
select organization_id, id, '65000000-0000-4000-8000-000000000001' from public.professionals
where organization_id = '62000000-0000-4000-8000-000000000001';

create function pg_temp.booking_day() returns date language sql stable as $$
  select (now() at time zone 'America/Fortaleza')::date + 1;
$$;

insert into public.working_hours (organization_id, professional_id, weekday, starts_at, ends_at, break_starts_at, break_ends_at)
select organization_id, id, extract(dow from pg_temp.booking_day()), '09:00', '18:00', '12:00', '13:00'
from public.professionals where organization_id = '62000000-0000-4000-8000-000000000001';
insert into public.time_off (organization_id, professional_id, starts_at, ends_at)
values ('62000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001',
  (pg_temp.booking_day() + time '15:00') at time zone 'America/Fortaleza',
  (pg_temp.booking_day() + time '16:00') at time zone 'America/Fortaleza');

create function pg_temp.book(start_time time, professional_suffix text default '1', customer_suffix text default '1')
returns uuid language sql as $$
  select public.create_appointment('62000000-0000-4000-8000-000000000001',
    ('64000000-0000-4000-8000-00000000000' || professional_suffix)::uuid,
    '65000000-0000-4000-8000-000000000001', ('66000000-0000-4000-8000-00000000000' || customer_suffix)::uuid,
    (pg_temp.booking_day() + start_time) at time zone 'America/Fortaleza');
$$;

set local role anon;
select pg_temp.check_test(pg_temp.has_sqlstate(
  $$select public.list_appointments('62000000-0000-4000-8000-000000000001', pg_temp.booking_day())$$, '42501'
), 1, 'anon não acessa a agenda');

set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
select pg_temp.check_test(pg_temp.has_sqlstate('select * from public.appointments', '42501'), 2, 'tabela acessível somente por RPC');
select set_config('test.booking', pg_temp.book('09:30')::text, true);
select pg_temp.check_test((select count(*) = 1 and min(price_cents) = 6500 and min(ends_at - starts_at) = interval '30 minutes'
  from public.list_appointments('62000000-0000-4000-8000-000000000001', pg_temp.booking_day())), 3, 'cria no fuso local e usa o catálogo');
select pg_temp.check_test(pg_temp.has_sqlstate($$select pg_temp.book('09:45')$$, '23P01'), 4, 'bloqueia sobreposição');
select pg_temp.check_test(pg_temp.book('10:00') is not null and pg_temp.book('09:30', '2') is not null, 5, 'aceita horários adjacentes ou profissionais distintos');
select pg_temp.check_test(pg_temp.has_sqlstate($$select pg_temp.book('11:45')$$, 'BF004'),
  6, 'respeita pausa');
select pg_temp.check_test(pg_temp.has_sqlstate($$select pg_temp.book('14:45')$$, 'BF005'), 7, 'respeita bloqueios');
select pg_temp.check_test(pg_temp.has_sqlstate($$select pg_temp.book('16:00', '1', '2')$$, 'BF003'), 8, 'rejeita cliente de outra barbearia');

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true);
select pg_temp.check_test((select count(*) = 2 and count(price_cents) = 0
  from public.list_appointments('62000000-0000-4000-8000-000000000001', pg_temp.booking_day()))
  and pg_temp.has_sqlstate($$select pg_temp.book('13:00')$$, '42501'), 9, 'profissional consulta apenas os próprios horários');

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', true);
select pg_temp.check_test((select count(*) = 0 from public.list_appointments('62000000-0000-4000-8000-000000000001', pg_temp.booking_day()))
  and pg_temp.has_sqlstate($$select public.cancel_appointment('62000000-0000-4000-8000-000000000001', current_setting('test.booking')::uuid)$$, '42501'),
  10, 'gestor de outra barbearia não pode ler nem cancelar');

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
select pg_temp.check_test(public.cancel_appointment('62000000-0000-4000-8000-000000000001', current_setting('test.booking')::uuid), 11, 'proprietário cancela');
select pg_temp.check_test(pg_temp.book('09:30') is not null
  and (select count(*) = 1 from public.list_appointments('62000000-0000-4000-8000-000000000001', pg_temp.booking_day()) where status = 'canceled'),
  12, 'cancelamento libera o horário e preserva histórico');

update public.services set price_cents = 9900 where id = '65000000-0000-4000-8000-000000000001';
select pg_temp.check_test((select count(*) = 4 and max(price_cents) = 6500
  from public.list_appointments('62000000-0000-4000-8000-000000000001', pg_temp.booking_day())),
  13, 'alteração no catálogo preserva preços já registrados');

delete from public.customers where id = '66000000-0000-4000-8000-000000000001';
select pg_temp.check_test((select count(*) = 4 and count(customer_name) = 0
  from public.list_appointments('62000000-0000-4000-8000-000000000001', pg_temp.booking_day())),
  14, 'exclusão de cliente preserva agenda sem reter o nome');

select public.book_solo_appointment('62000000-0000-4000-8000-000000000001',
  '65000000-0000-4000-8000-000000000001', (pg_temp.booking_day() + time '19:30') at time zone 'America/Fortaleza',
  null, 'Cliente sem telefone', null);

select pg_temp.check_test((select count(*) = 1
  from public.list_appointments('62000000-0000-4000-8000-000000000001', pg_temp.booking_day())
  where customer_name = 'Cliente sem telefone'), 15, 'agenda com nome e sem telefone fora do turno');
select pg_temp.check_test(pg_temp.has_sqlstate($$select public.book_with_customer_name(
  '62000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001',
  '65000000-0000-4000-8000-000000000001', 'Cliente não gravado', null,
  (pg_temp.booking_day() + time '19:30') at time zone 'America/Fortaleza')$$, '23P01')
  and not exists (select 1 from public.customers where name = 'Cliente não gravado'),
  16, 'conflito reverte o cadastro do cliente');

rollback;
