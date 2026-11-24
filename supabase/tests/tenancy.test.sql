begin;

-- TAP output is consumable by `supabase test db` and needs no extension for psql.
select '1..19';

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

select pg_temp.check_test(
  (select count(*) = 3 from pg_class
    where oid in ('public.profiles'::regclass, 'public.organizations'::regclass, 'public.memberships'::regclass)
      and relrowsecurity),
  1, 'RLS nas tres tabelas'
);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'owner-a@example.invalid', now(), '{"name":"  Titular A  "}'),
  ('10000000-0000-0000-0000-000000000002', 'owner-b@example.invalid', now(), '{"name":"Titular B"}'),
  ('10000000-0000-0000-0000-000000000003', 'manager-b@example.invalid', now(), '{"name":"Gerente B"}'),
  ('10000000-0000-0000-0000-000000000004', 'barber-b@example.invalid', now(), '{"name":"Profissional B","role":"owner"}'),
  ('10000000-0000-0000-0000-000000000005', 'unconfirmed@example.invalid', null, '{"name":true}'),
  ('10000000-0000-0000-0000-000000000006', 'rollback@example.invalid', now(), '{}');

select pg_temp.check_test(
  (select name = 'Titular A' from public.profiles where user_id = '10000000-0000-0000-0000-000000000001')
  and (select name is null from public.profiles where user_id = '10000000-0000-0000-0000-000000000005'),
  2, 'cadastro em Auth cria perfil sem copiar metadados invalidos'
);

set local role anon;
select pg_temp.check_test(
  pg_temp.has_sqlstate('select * from public.profiles', '42501')
  and pg_temp.has_sqlstate('select * from public.organizations', '42501')
  and pg_temp.has_sqlstate('select * from public.memberships', '42501'),
  3, 'visitante nao le perfis, estabelecimentos ou vinculos'
);
select pg_temp.check_test(
  pg_temp.has_sqlstate($sql$select public.create_organization('Teste', 'teste', 'America/Fortaleza')$sql$, '42501'),
  4, 'visitante nao pode executar onboarding'
);

set local role authenticated;
set local "request.jwt.claims" = '{}';
select pg_temp.check_test(
  pg_temp.has_sqlstate($sql$select public.create_organization('Teste', 'teste', 'America/Fortaleza')$sql$, '42501'),
  5, 'onboarding exige identidade do Auth'
);

set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}';
select pg_temp.check_test(
  pg_temp.has_sqlstate($sql$select public.create_organization('Teste', 'teste', 'America/Fortaleza')$sql$, '42501'),
  6, 'conta com e-mail pendente nao cria estabelecimento'
);

set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
begin
  perform set_config(
    'barberflow_test.owner_a_org', public.create_organization('  Barbearia A  ', 'tenant-a', 'America/Fortaleza')::text, true
  );
end;
$$;
select pg_temp.check_test(
  (select count(*) = 1 from public.organizations where slug = 'tenant-a' and name = 'Barbearia A'
    and timezone = 'America/Fortaleza' and status = 'active')
  and (select count(*) = 1 from public.memberships where role = 'owner'
    and user_id = auth.uid() and organization_id = current_setting('barberflow_test.owner_a_org')::uuid),
  7, 'onboarding cria estabelecimento e vinculo de titular'
);
select pg_temp.check_test(
  public.create_organization('Nome diferente', 'tenant-a', 'UTC') = current_setting('barberflow_test.owner_a_org')::uuid,
  8, 'repeticao com o mesmo slug retorna o estabelecimento anterior'
);
select pg_temp.check_test(
  (select count(*) = 1 from public.organizations where slug = 'tenant-a' and name = 'Barbearia A'
    and timezone = 'America/Fortaleza'),
  9, 'repeticao nao substitui as preferencias gravadas'
);
select pg_temp.check_test(
  pg_temp.has_sqlstate($sql$select public.create_organization('A', 'tenant-a', 'America/Fortaleza')$sql$, '22023')
  and pg_temp.has_sqlstate($sql$select public.create_organization('Teste', 'Slug//Invalido', 'America/Fortaleza')$sql$, '22023')
  and pg_temp.has_sqlstate($sql$select public.create_organization('Teste', 'tenant-a', 'America/Inexistente')$sql$, '22023'),
  10, 'RPC rejeita nome, slug e fuso invalidos'
);
select pg_temp.check_test(
  pg_temp.has_sqlstate($sql$update public.organizations set name = 'Outro nome'$sql$, '42501')
  and pg_temp.has_sqlstate($sql$update public.profiles set name = 'Outro nome'$sql$, '42501')
  and pg_temp.has_sqlstate($sql$delete from public.memberships$sql$, '42501')
  and pg_temp.has_sqlstate($sql$select public.create_organization('Outro', 'outra-barbearia', 'UTC')$sql$, '42501'),
  11, 'titular nao tem escrita direta e o onboarding e de estabelecimento inicial'
);

set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';
select pg_temp.check_test(
  pg_temp.has_sqlstate($sql$select public.create_organization('Colisao', 'tenant-a', 'UTC')$sql$, '23505')
  and (select count(*) = 0 from public.memberships),
  12, 'colisao de slug preserva o estado anterior da conta'
);
do $$
begin
  perform set_config(
    'barberflow_test.owner_b_org', public.create_organization('Barbearia B', 'tenant-b', 'America/Sao_Paulo')::text, true
  );
end;
$$;
select pg_temp.check_test(
  (select count(*) = 1 from public.organizations where slug = 'tenant-b')
  and not exists (select 1 from public.organizations where id = current_setting('barberflow_test.owner_a_org')::uuid)
  and (select count(*) = 1 from public.profiles)
  and (select count(*) = 1 from public.memberships where user_id = auth.uid() and role = 'owner'),
  13, 'titular B le o proprio estabelecimento e nao ve dados do A'
);

set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
select pg_temp.check_test(
  (select count(*) = 1 from public.organizations)
  and not exists (select 1 from public.organizations where id = current_setting('barberflow_test.owner_b_org')::uuid)
  and not exists (select 1 from public.profiles where user_id = '10000000-0000-0000-0000-000000000002')
  and not exists (select 1 from public.memberships where organization_id = current_setting('barberflow_test.owner_b_org')::uuid),
  14, 'titular A nao le estabelecimento, perfil nem vinculos do B'
);

reset role;
insert into public.memberships (organization_id, user_id, role) values
  (current_setting('barberflow_test.owner_b_org')::uuid, '10000000-0000-0000-0000-000000000003', 'manager'),
  (current_setting('barberflow_test.owner_b_org')::uuid, '10000000-0000-0000-0000-000000000004', 'barber');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';
select pg_temp.check_test(
  (select count(*) = 1 from public.organizations where slug = 'tenant-b')
  and (select count(*) = 1 from public.memberships where role = 'manager')
  and pg_temp.has_sqlstate($sql$update public.memberships set role = 'owner' where user_id = auth.uid()$sql$, '42501'),
  15, 'gerente consulta o proprio vinculo e nao se promove'
);

set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';
select pg_temp.check_test(
  (select count(*) = 1 from public.organizations where slug = 'tenant-b')
  and not exists (select 1 from public.organizations where slug = 'tenant-a')
  and (select count(*) = 1 from public.memberships where role = 'barber')
  and pg_temp.has_sqlstate($sql$insert into public.memberships (organization_id, user_id, role)
    values (current_setting('barberflow_test.owner_a_org')::uuid, auth.uid(), 'owner')$sql$, '42501')
  and pg_temp.has_sqlstate($sql$select public.create_organization('Outro', 'outro-tenant', 'UTC')$sql$, '42501'),
  16, 'profissional nao acessa outro tenant nem cria vinculo de titular por metadados ou escrita'
);

reset role;
select pg_temp.check_test(
  pg_temp.has_sqlstate($sql$insert into public.memberships (organization_id, user_id, role)
    values (current_setting('barberflow_test.owner_b_org')::uuid, '10000000-0000-0000-0000-000000000003', 'owner')$sql$, '23505')
  and pg_temp.has_sqlstate($sql$insert into public.memberships (organization_id, user_id, role)
    values ('10000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003', 'owner')$sql$, '23503'),
  17, 'constraints impedem vinculo duplicado e estabelecimento inexistente'
);

-- Inject a database-side failure after the organization insert. This change rolls back with the test.
alter table public.memberships add constraint test_reject_owner_membership
  check (user_id <> '10000000-0000-0000-0000-000000000006');
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}';
select pg_temp.check_test(
  pg_temp.has_sqlstate($sql$select public.create_organization('Interrompida', 'rollback-onboarding', 'UTC')$sql$, '23514'),
  18, 'onboarding propaga falha ao gravar o vinculo'
);

reset role;
select pg_temp.check_test(
  not exists (select 1 from public.organizations where slug = 'rollback-onboarding')
  and not exists (select 1 from public.memberships where user_id = '10000000-0000-0000-0000-000000000006'),
  19, 'falha no vinculo nao deixa estabelecimento orfao'
);

rollback;
