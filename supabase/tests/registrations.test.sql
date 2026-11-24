begin;

select '1..24';

create function pg_temp.check_test(passed boolean, number integer, description text)
returns text
language plpgsql
as $$
begin
  if passed is distinct from true then
    raise exception 'not ok % - %', number, description;
  end if;
  return format('ok %s - %s', number, description);
end;
$$;

create function pg_temp.has_sqlstate(statement text, expected text)
returns boolean
language plpgsql
as $$
begin
  execute statement;
  return false;
exception when others then
  return sqlstate = expected;
end;
$$;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('21000000-0000-0000-0000-000000000001', 'cadastro-owner-a@example.invalid', now(), '{"name":"Titular A"}'),
  ('21000000-0000-0000-0000-000000000002', 'cadastro-manager-b@example.invalid', now(), '{"name":"Gerente B"}'),
  ('21000000-0000-0000-0000-000000000003', 'cadastro-barber-a@example.invalid', now(), '{"name":"Profissional A","role":"owner"}'),
  ('21000000-0000-0000-0000-000000000004', 'cadastro-owner-c@example.invalid', now(), '{"name":"Titular C"}');

insert into public.organizations (id, name, slug, status) values
  ('22000000-0000-0000-0000-000000000001', 'Barbearia A', 'cadastro-a', 'active'),
  ('22000000-0000-0000-0000-000000000002', 'Barbearia B', 'cadastro-b', 'active'),
  ('22000000-0000-0000-0000-000000000003', 'Barbearia C', 'cadastro-c', 'inactive');

insert into public.memberships (id, organization_id, user_id, role) values
  ('23000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'owner'),
  ('23000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'manager'),
  ('23000000-0000-0000-0000-000000000003', '22000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000003', 'barber'),
  ('23000000-0000-0000-0000-000000000004', '22000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000004', 'owner'),
  ('23000000-0000-0000-0000-000000000005', '22000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', 'barber');

insert into public.services (id, organization_id, name, duration_minutes, price_cents, updated_at) values
  ('24000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', 'Corte', 25, 3500, '2020-01-01Z'),
  ('24000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000002', 'Corte', 30, 4000, '2020-01-01Z'),
  ('24000000-0000-0000-0000-000000000003', '22000000-0000-0000-0000-000000000003', 'Corte', 30, 4500, '2020-01-01Z');

insert into public.customers (id, organization_id, name, phone) values
  ('25000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', 'Cliente A', '+5586999900001'),
  ('25000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000002', 'Cliente B', '+5586999900001');

insert into public.professionals (id, organization_id, membership_id, name) values
  ('26000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000003', 'Profissional A'),
  ('26000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000002', null, 'Profissional B');

insert into public.professional_services (organization_id, professional_id, service_id) values
  ('22000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000001'),
  ('22000000-0000-0000-0000-000000000002', '26000000-0000-0000-0000-000000000002', '24000000-0000-0000-0000-000000000002');

insert into public.working_hours (organization_id, professional_id, weekday, starts_at, ends_at) values
  ('22000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', 1, '09:00', '18:00'),
  ('22000000-0000-0000-0000-000000000002', '26000000-0000-0000-0000-000000000002', 1, '08:00', '17:00');

insert into public.time_off (organization_id, professional_id, starts_at, ends_at) values
  ('22000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '2026-11-25 10:00-03', '2026-11-25 12:00-03'),
  ('22000000-0000-0000-0000-000000000002', '26000000-0000-0000-0000-000000000002', '2026-11-25 11:00-03', '2026-11-25 12:00-03');

select pg_temp.check_test(
  (select count(*) = 6 from pg_class where relrowsecurity and oid in (
    'public.services'::regclass, 'public.customers'::regclass, 'public.professionals'::regclass,
    'public.professional_services'::regclass, 'public.working_hours'::regclass, 'public.time_off'::regclass
  )), 1, 'RLS ativa nas seis tabelas de cadastros'
);

set local role anon;
select pg_temp.check_test(
  pg_temp.has_sqlstate('select * from public.customers', '42501')
  and pg_temp.has_sqlstate('select * from public.services', '42501')
  and pg_temp.has_sqlstate('select * from public.professionals', '42501')
  and pg_temp.has_sqlstate('select * from public.professional_services', '42501')
  and pg_temp.has_sqlstate('select * from public.working_hours', '42501')
  and pg_temp.has_sqlstate('select * from public.time_off', '42501')
  and pg_temp.has_sqlstate('select barberflow_private.admin_organization_ids()', '42501'),
  2, 'visitante nao le cadastros nem executa a verificacao de vinculos'
);

set local role authenticated;
set local "request.jwt.claims" = '{}';
select pg_temp.check_test(not exists (select 1 from public.services), 3, 'papel autenticado sem identidade nao le cadastros');

set local "request.jwt.claims" = '{"sub":"21000000-0000-0000-0000-000000000001","role":"authenticated"}';
select pg_temp.check_test(
  (select array_agg(name) = array['Corte'] from public.services)
  and (select array_agg(name) = array['Cliente A'] from public.customers)
  and (select array_agg(name) = array['Profissional A'] from public.professionals)
  and (select count(*) = 1 from public.professional_services where organization_id = '22000000-0000-0000-0000-000000000001')
  and (select count(*) = 1 from public.working_hours)
  and (select count(*) = 1 from public.time_off),
  4, 'titular administra apenas seu tenant mesmo com papel de profissional em outro'
);

with changed as (
  update public.services set active = false, price_cents = 3590 where id = '24000000-0000-0000-0000-000000000001'
  returning active, price_cents, updated_at
)
select pg_temp.check_test(
  (select not active and price_cents = 3590 and updated_at > '2020-01-01Z' from changed)
  and exists (select 1 from public.professional_services),
  5, 'titular edita preco em centavos e desativa o servico preservando seu vinculo'
);

select pg_temp.check_test(
  pg_temp.has_sqlstate($sql$insert into public.services (organization_id, name, duration_minutes, price_cents)
    values ('22000000-0000-0000-0000-000000000001', 'cORTE', 25, 3500)$sql$, '23505')
  and pg_temp.has_sqlstate($sql$update public.services set price_cents = -1$sql$, '23514')
  and pg_temp.has_sqlstate($sql$update public.services set duration_minutes = 0$sql$, '23514')
  and pg_temp.has_sqlstate($sql$update public.services set duration_minutes = 1441$sql$, '23514')
  and pg_temp.has_sqlstate($sql$update public.services set name = ' Corte '$sql$, '23514'),
  6, 'valida nome, duracao, preco e duplicidade de servico no tenant'
);

select pg_temp.check_test(
  pg_temp.has_sqlstate('delete from public.services', '42501')
  and pg_temp.has_sqlstate('delete from public.professionals', '42501')
  and pg_temp.has_sqlstate('update public.services set id = gen_random_uuid()', '42501')
  and pg_temp.has_sqlstate('update public.professionals set organization_id = organization_id', '42501'),
  7, 'privilegios preservam catalogo e tornam identificadores imutaveis'
);

with changed as (
  update public.services set price_cents = 100 where id = '24000000-0000-0000-0000-000000000002' returning id
), removed as (
  delete from public.customers where id = '25000000-0000-0000-0000-000000000002' returning id
)
select pg_temp.check_test(
  not exists (select 1 from changed) and not exists (select 1 from removed)
  and pg_temp.has_sqlstate($sql$insert into public.customers (organization_id, name, phone)
    values ('22000000-0000-0000-0000-000000000002', 'Interferencia', '+5586999900002')$sql$, '42501'),
  8, 'titular nao cria, atualiza ou apaga dados em tenant sem permissao administrativa'
);

with created as (
  insert into public.customers (organization_id, name, phone) values
    ('22000000-0000-0000-0000-000000000001', 'Cliente temporario', '+5586999900002')
  returning marketing_consent
)
select pg_temp.check_test((select not marketing_consent from created), 9, 'cliente novo tem marketing desabilitado por padrao');

with changed as (
  update public.customers set marketing_consent = true, name = 'Contato atualizado' where phone = '+5586999900002'
  returning marketing_consent, name
)
select pg_temp.check_test((select marketing_consent and name = 'Contato atualizado' from changed), 10, 'gestao atualiza dados e opt-in do cliente');

with removed as (
  delete from public.customers where phone = '+5586999900002' returning id
)
select pg_temp.check_test(
  (select count(*) = 1 from removed)
  and pg_temp.has_sqlstate($sql$update public.customers set phone = '(86)99990-0001'$sql$, '23514')
  and pg_temp.has_sqlstate($sql$insert into public.customers (organization_id, name, phone)
    values ('22000000-0000-0000-0000-000000000001', 'Contato repetido', '+5586999900001')$sql$, '23505'),
  11, 'cliente pode ser excluido e telefone E.164 e unico por tenant'
);

with changed as (
  update public.professionals set commission_bps = 2750, active = false
  where id = '26000000-0000-0000-0000-000000000001' returning commission_bps, active
)
select pg_temp.check_test(
  (select commission_bps = 2750 and not active from changed)
  and pg_temp.has_sqlstate('update public.professionals set commission_bps = 10001', '23514'),
  12, 'comissao em pontos-base respeita limites e profissional pode ser desativado'
);

select pg_temp.check_test(
  pg_temp.has_sqlstate($sql$update public.professionals set membership_id = '23000000-0000-0000-0000-000000000002'$sql$, '23503')
  and pg_temp.has_sqlstate($sql$insert into public.professionals (organization_id, membership_id, name)
    values ('22000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000003', 'Vinculo duplicado')$sql$, '23505'),
  13, 'vinculo opcional da equipe pertence ao mesmo tenant e e unico por membro'
);

select pg_temp.check_test(
  pg_temp.has_sqlstate($sql$insert into public.professional_services (organization_id, professional_id, service_id)
    values ('22000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000002')$sql$, '23503')
  and pg_temp.has_sqlstate($sql$insert into public.professional_services (organization_id, professional_id, service_id)
    values ('22000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000002', '24000000-0000-0000-0000-000000000001')$sql$, '23503')
  and pg_temp.has_sqlstate($sql$insert into public.professional_services (organization_id, professional_id, service_id)
    values ('22000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000001')$sql$, '23505'),
  14, 'vinculos de profissionais e servicos rejeitam tenants cruzados e duplicatas'
);

with changed as (
  update public.working_hours set break_starts_at = '12:00', break_ends_at = '13:00' returning break_starts_at, break_ends_at
)
select pg_temp.check_test(
  (select break_starts_at = '12:00' and break_ends_at = '13:00' from changed),
  15, 'gestao pode definir pausa dentro do expediente'
);

select pg_temp.check_test(
  pg_temp.has_sqlstate($sql$insert into public.working_hours (organization_id, professional_id, weekday, starts_at, ends_at)
    values ('22000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', 1, '09:00', '18:00')$sql$, '23505')
  and pg_temp.has_sqlstate('update public.working_hours set weekday = 7', '23514')
  and pg_temp.has_sqlstate($sql$update public.working_hours set starts_at = '09:00:01'$sql$, '23514')
  and pg_temp.has_sqlstate($sql$update public.working_hours set ends_at = '24:00'$sql$, '23514')
  and pg_temp.has_sqlstate($sql$update public.working_hours set ends_at = '08:00'$sql$, '23514')
  and pg_temp.has_sqlstate('update public.working_hours set break_ends_at = null', '23514')
  and pg_temp.has_sqlstate($sql$update public.working_hours set break_starts_at = '09:00'$sql$, '23514')
  and pg_temp.has_sqlstate($sql$update public.working_hours set break_ends_at = '18:00'$sql$, '23514'),
  16, 'expediente impõe dia unico, horarios inteiros no mesmo dia e pausa interna completa'
);

with changed as (
  update public.time_off set reason = 'Manutencao' returning starts_at, ends_at, reason
)
select pg_temp.check_test(
  (select starts_at = '2026-11-25 13:00+00' and ends_at = '2026-11-25 15:00+00' and reason = 'Manutencao' from changed)
  and pg_temp.has_sqlstate('update public.time_off set ends_at = starts_at', '23514')
  and pg_temp.has_sqlstate($sql$update public.time_off set ends_at = 'infinity'$sql$, '23514')
  and pg_temp.has_sqlstate($sql$update public.time_off set reason = repeat('x', 161)$sql$, '23514'),
  17, 'bloqueio guarda o instante e rejeita intervalo ou motivo invalidos'
);

select pg_temp.check_test(
  pg_temp.has_sqlstate($sql$insert into public.working_hours (organization_id, professional_id, weekday, starts_at, ends_at)
    values ('22000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000002', 2, '09:00', '18:00')$sql$, '23503')
  and pg_temp.has_sqlstate($sql$insert into public.time_off (organization_id, professional_id, starts_at, ends_at)
    values ('22000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000002', '2026-11-25 10:00-03', '2026-11-25 12:00-03')$sql$, '23503'),
  18, 'expedientes e bloqueios rejeitam profissional de outro tenant'
);

set local "request.jwt.claims" = '{"sub":"21000000-0000-0000-0000-000000000002","role":"authenticated"}';
with created as (
  insert into public.services (organization_id, name, duration_minutes, price_cents) values
    ('22000000-0000-0000-0000-000000000002', 'Barba', 15, 2000) returning active
), removed_links as (
  delete from public.professional_services returning service_id
), removed_hours as (
  delete from public.working_hours returning id
), removed_time_off as (
  delete from public.time_off returning id
)
select pg_temp.check_test(
  (select active from created) and (select array_agg(name) = array['Cliente B'] from public.customers)
  and (select count(*) = 1 from removed_links) and (select count(*) = 1 from removed_hours)
  and (select count(*) = 1 from removed_time_off),
  19, 'gerente cria servico e remove vinculo, turno e bloqueio apenas no proprio tenant'
);

set local "request.jwt.claims" = '{"sub":"21000000-0000-0000-0000-000000000003","role":"authenticated","user_metadata":{"role":"owner"}}';
select pg_temp.check_test(
  not exists (select 1 from public.services) and not exists (select 1 from public.customers)
  and not exists (select 1 from public.professionals) and not exists (select 1 from public.professional_services)
  and not exists (select 1 from public.working_hours) and not exists (select 1 from public.time_off)
  and pg_temp.has_sqlstate($sql$insert into public.services (organization_id, name, duration_minutes, price_cents)
    values ('22000000-0000-0000-0000-000000000001', 'Sem permissao', 25, 1000)$sql$, '42501'),
  20, 'profissional nao administra cadastros nem ganha acesso com metadados'
);

set local "request.jwt.claims" = '{"sub":"21000000-0000-0000-0000-000000000004","role":"authenticated"}';
select pg_temp.check_test(
  not exists (select 1 from public.services)
  and pg_temp.has_sqlstate($sql$insert into public.services (organization_id, name, duration_minutes, price_cents)
    values ('22000000-0000-0000-0000-000000000003', 'Sem permissao', 25, 1000)$sql$, '42501'),
  21, 'titular de estabelecimento inativo nao administra cadastros'
);

reset role;
update public.memberships set role = 'manager' where id = '23000000-0000-0000-0000-000000000005';
delete from public.memberships where id = '23000000-0000-0000-0000-000000000003';
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"21000000-0000-0000-0000-000000000001","role":"authenticated"}';
select pg_temp.check_test(
  (select count(*) = 3 from public.services)
  and pg_temp.has_sqlstate($sql$update public.customers set organization_id = '22000000-0000-0000-0000-000000000002'
    where id = '25000000-0000-0000-0000-000000000001'$sql$, '42501'),
  22, 'mudanca de papel tem efeito imediato mas mover registro entre tenants continua proibido'
);

select pg_temp.check_test(
  (select membership_id is null and organization_id = '22000000-0000-0000-0000-000000000001'
   from public.professionals where id = '26000000-0000-0000-0000-000000000001'),
  23, 'remover vinculo de acesso preserva profissional e tenant'
);

with created_professional as (
  insert into public.professionals (organization_id, name, commission_bps) values
    ('22000000-0000-0000-0000-000000000001', 'Novo profissional', 1000)
  returning id, organization_id, commission_bps, active
), created_link as (
  insert into public.professional_services (organization_id, professional_id, service_id)
    select organization_id, id, '24000000-0000-0000-0000-000000000001' from created_professional
  returning created_at
), created_hours as (
  insert into public.working_hours (organization_id, professional_id, weekday, starts_at, ends_at)
    select organization_id, id, 4, time '08:00', time '16:00' from created_professional
  returning weekday
), created_block as (
  insert into public.time_off (organization_id, professional_id, starts_at, ends_at, reason)
    select organization_id, id, timestamptz '2026-11-26 10:00-03', timestamptz '2026-11-26 13:00-03', 'Folga'
    from created_professional
  returning reason
)
select pg_temp.check_test(
  (select commission_bps = 1000 and active from created_professional)
  and exists (select 1 from created_link where created_at is not null)
  and (select weekday = 4 from created_hours)
  and (select reason = 'Folga' from created_block),
  24, 'gestao cria profissional, vinculo, expediente e bloqueio com privilegios por coluna'
);

rollback;
