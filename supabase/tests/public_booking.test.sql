begin;
select '1..17';

create function pg_temp.check_test(ok boolean, number integer, description text)
returns text language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'not ok % - %', number, description; end if;
  return format('ok %s - %s', number, description);
end;
$$;

insert into auth.users (id,email) values ('81000000-0000-4000-8000-000000000001','public-owner@example.invalid');
insert into public.organizations (id,name,slug,timezone)
values ('82000000-0000-4000-8000-000000000001','Barbearia Pública','publico-teste','America/Fortaleza');
insert into public.memberships (organization_id,user_id,role) values
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','owner');
insert into public.professionals (id,organization_id,name,specialties,commission_bps) values
  ('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','Barbeiro público','Barba',2000);
insert into public.services (id,organization_id,name,description,duration_minutes,price_cents) values
  ('84000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','Corte','Descrição pública',30,5000);
insert into public.professional_services values
  ('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001');

create function pg_temp.booking_day() returns date language sql stable as $$
  select (now() at time zone 'America/Fortaleza')::date + 1;
$$;
create function pg_temp.when_slot(t time) returns timestamptz language sql stable as $$
  select (pg_temp.booking_day()+t) at time zone 'America/Fortaleza';
$$;
insert into public.working_hours (organization_id,professional_id,weekday,starts_at,ends_at,break_starts_at,break_ends_at)
values ('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001',
  extract(dow from pg_temp.booking_day()),'09:00','18:00','12:00','13:00');

create function pg_temp.public_request(t time default null, ticket text default null, name text default 'Cliente Teste',
    price integer default 5000, origin text default repeat('a',64))
returns jsonb language sql as $$
  select public.public_booking('publico-teste',origin,'84000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000001',pg_temp.booking_day(),pg_temp.when_slot(t),name,'+5586999912323',
    ('85000000-0000-4000-8000-00000000000'||ticket)::uuid,price,30);
$$;

select pg_temp.check_test(not has_function_privilege('anon','public.public_catalog(text)','execute')
  and not has_function_privilege('authenticated','public.public_booking(text,text,uuid,uuid,date,timestamptz,text,text,uuid,integer,integer)','execute'),
  1,'RPC não pode ser chamada por visitante ou sessão comum');
set local role service_role;
select pg_temp.check_test(public.public_catalog('publico-teste')->'offers'->0->>'description'='Descrição pública'
  and not (public.public_catalog('publico-teste')->'offers'->0 ? 'commission_bps'),2,'catálogo expõe apenas a oferta');
select pg_temp.check_test((pg_temp.public_request()->'slots') @> jsonb_build_array(pg_temp.when_slot('11:30'))
  and not ((pg_temp.public_request()->'slots') @> jsonb_build_array(pg_temp.when_slot('11:45'))),
  3,'encaixa antes da pausa e exclui um intervalo que a atravessa');
select pg_temp.check_test(pg_temp.public_request('11:45','1')->>'error'='conflict',4,'confirmação revalida pausa');
select pg_temp.check_test(pg_temp.public_request('09:00','1',price => 4999)->>'error'='offer',5,'exige aceite do preço atual');
select set_config('test.result',pg_temp.public_request('09:00','1')::text,true);
select pg_temp.check_test(current_setting('test.result')::jsonb->>'status'='confirmed'
  and not (current_setting('test.result')::jsonb ? 'phone'),6,'confirmação apresenta resumo sem contato');
select pg_temp.check_test(pg_temp.public_request('09:00','1')=current_setting('test.result')::jsonb,7,'repetição devolve a mesma confirmação');
select pg_temp.check_test(pg_temp.public_request('09:30','1')->>'error'='attempt',8,'mesma chave com pedido diferente falha');
select pg_temp.check_test(pg_temp.public_request('09:15','2')->>'error'='conflict',9,'sobreposição parcial é rejeitada');
select pg_temp.check_test(pg_temp.public_request('09:30','2','Outro Nome',origin => repeat('b',64))->>'status'='confirmed',
  10,'horário adjacente é aceito');
select pg_temp.check_test(pg_temp.public_request('10:30','3')->>'error'='rate',11,'limite de escrita por origem é aplicado');
reset role;
select pg_temp.check_test((select count(*)=1 and min(name)='Cliente Teste' from public.customers
  where organization_id='82000000-0000-4000-8000-000000000001')
  and (select count(*)=2 from public.appointments where organization_id='82000000-0000-4000-8000-000000000001'),
  12,'reservas reaproveitam o telefone sem alterar nome e sem gravar tentativas rejeitadas');
set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
select pg_temp.check_test((select count(*)=2 from public.appointments_period(
  '82000000-0000-4000-8000-000000000001',pg_temp.booking_day()-3,pg_temp.booking_day()+3)),
  13,'reservas públicas aparecem na agenda autorizada');
select pg_temp.check_test(exists (select 1 from public.appointments_period(
  '82000000-0000-4000-8000-000000000001',pg_temp.booking_day(),pg_temp.booking_day()) as a
  where a.starts_at=pg_temp.when_slot('09:00') and not public.change_appointment(
    '82000000-0000-4000-8000-000000000001',a.id,'reschedule',a.starts_at,pg_temp.when_slot('09:15'),null)),
  14,'reagendamento sobreposto preserva a reserva original');
select pg_temp.check_test(exists (select 1 from public.appointments_period(
  '82000000-0000-4000-8000-000000000001',pg_temp.booking_day(),pg_temp.booking_day()) as a
  where a.starts_at=pg_temp.when_slot('09:00') and public.change_appointment(
    '82000000-0000-4000-8000-000000000001',a.id,'reschedule',a.starts_at,pg_temp.when_slot('10:00'),null)),
  15,'reagendamento aceita intervalo disponível');
do $$
begin
  insert into public.time_off (organization_id,professional_id,starts_at,ends_at)
    values ('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001',
      pg_temp.when_slot('10:10'),pg_temp.when_slot('10:15'));
  raise exception 'bloqueio deveria ter falhado';
exception when sqlstate 'BF030' then null;
end;
$$;
select pg_temp.check_test(not exists (select 1 from public.time_off
  where organization_id='82000000-0000-4000-8000-000000000001'),16,'bloqueio conflitante não é gravado');
reset role;
insert into public.appointments (organization_id,professional_id,service_id,customer_id,starts_at,ends_at,status,
  price_cents,commission_bps,completed_at)
select organization_id,'83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001',id,
  now()-interval '2 days',now()-interval '2 days'+interval '30 minutes','completed',5000,2000,now()-interval '1 day'
from public.customers where phone='+5586999912323';
set local role authenticated;
select pg_temp.check_test((select jsonb_array_length(public.customer_history(organization_id,id)->'items')=3
  and public.customer_history(organization_id,id)->>'completed'='1'
  and public.customer_history(organization_id,id)->>'last_completed' is not null
  from public.customers where phone='+5586999912323'),17,'histórico mantém reservas e separa atendimentos concluídos');
rollback;
