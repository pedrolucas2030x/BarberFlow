alter table public.appointments
  drop constraint appointments_status_check,
  drop constraint appointments_professional_id_tstzrange_excl,
  add column completed_at timestamptz,
  add constraint appointments_status_check check (status in ('confirmed', 'canceled', 'completed')),
  add constraint appointments_completion_check check (
    (status = 'completed') = (completed_at is not null)
    and (completed_at is null or completed_at >= starts_at)
  ),
  add constraint appointments_no_overlap exclude using gist (
    professional_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'canceled'),
  add constraint appointments_organization_id_id_key unique (organization_id, id);

create table public.payments (
  organization_id uuid not null,
  appointment_id uuid not null,
  amount_cents integer not null check (amount_cents > 0),
  method text not null check (method in ('pix', 'cash', 'debit', 'credit')),
  received_at timestamptz not null default now(),
  primary key (organization_id, appointment_id),
  foreign key (organization_id, appointment_id)
    references public.appointments (organization_id, id) on delete cascade
);

create index payments_organization_received_idx on public.payments (organization_id, received_at);

alter table public.payments enable row level security;
revoke all on public.payments from public, anon, authenticated, service_role;
grant select on public.payments to authenticated;
create policy read_admin_payments on public.payments for select to authenticated
  using (organization_id in (select barberflow_private.admin_organization_ids()));

create function barberflow_private.complete_appointment(p_organization_id uuid, p_appointment_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from barberflow_private.admin_organization_ids() as org(id) where id = p_organization_id) then
    raise exception using errcode = '42501', message = 'appointment access denied';
  end if;

  update public.appointments
    set status = 'completed', completed_at = now()
    where organization_id = p_organization_id and id = p_appointment_id
      and status = 'confirmed' and starts_at <= now();

  return found or exists (
    select 1 from public.appointments
    where organization_id = p_organization_id and id = p_appointment_id and status = 'completed'
  );
end;
$$;

create function barberflow_private.record_appointment_payment(
  p_organization_id uuid, p_appointment_id uuid, p_method text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  price integer;
  existing_method text;
begin
  if not exists (select 1 from barberflow_private.admin_organization_ids() as org(id) where id = p_organization_id) then
    raise exception using errcode = '42501', message = 'payment access denied';
  end if;

  if p_method is null or p_method not in ('pix', 'cash', 'debit', 'credit') then
    raise exception using errcode = 'BF010', message = 'invalid payment method';
  end if;

  select price_cents into price from public.appointments
    where organization_id = p_organization_id and id = p_appointment_id and status = 'completed'
    for update;
  if not found or price <= 0 then
    raise exception using errcode = 'BF011', message = 'appointment cannot be paid';
  end if;

  insert into public.payments (organization_id, appointment_id, amount_cents, method)
    values (p_organization_id, p_appointment_id, price, p_method)
    on conflict (organization_id, appointment_id) do nothing;

  if not found then
    select method into existing_method from public.payments
      where organization_id = p_organization_id and appointment_id = p_appointment_id;
    if existing_method is distinct from p_method then
      raise exception using errcode = 'BF012', message = 'appointment already paid with another method';
    end if;
  end if;
end;
$$;

create function barberflow_private.received_payments_day(p_organization_id uuid, p_day date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total_cents', coalesce(sum(receipt.amount_cents), 0),
    'payments', coalesce(jsonb_agg(to_jsonb(receipt) order by receipt.received_at desc, receipt.appointment_id), '[]'::jsonb)
  )
  from public.organizations as organization
  join lateral (
    select payment.appointment_id, payment.amount_cents, payment.method, payment.received_at,
      appointment.starts_at, service.name as service_name, professional.name as professional_name
    from public.payments as payment
    join public.appointments as appointment
      on (appointment.organization_id, appointment.id) = (payment.organization_id, payment.appointment_id)
    join public.services as service
      on (service.organization_id, service.id) = (appointment.organization_id, appointment.service_id)
    join public.professionals as professional
      on (professional.organization_id, professional.id) = (appointment.organization_id, appointment.professional_id)
    where payment.organization_id = organization.id
      and payment.received_at >= (p_day::timestamp at time zone organization.timezone)
      and payment.received_at < ((p_day + 1)::timestamp at time zone organization.timezone)
  ) as receipt on true
  where organization.id = p_organization_id
    and organization.id in (select barberflow_private.admin_organization_ids());
$$;

create function public.complete_appointment(p_organization_id uuid, p_appointment_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select barberflow_private.complete_appointment(p_organization_id, p_appointment_id);
$$;

create function public.record_appointment_payment(p_organization_id uuid, p_appointment_id uuid, p_method text)
returns void language sql security invoker set search_path = '' as $$
  select barberflow_private.record_appointment_payment(p_organization_id, p_appointment_id, p_method);
$$;

create function public.received_payments_day(p_organization_id uuid, p_day date)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select barberflow_private.received_payments_day(p_organization_id, p_day);
$$;

create function public.list_appointments_with_payments(p_organization_id uuid, p_day date)
returns table (
  id uuid, starts_at timestamptz, ends_at timestamptz, status text, service_name text,
  professional_name text, customer_name text, price_cents integer, is_paid boolean, can_complete boolean
)
language sql stable security invoker set search_path = '' as $$
  select agenda.*, case when agenda.price_cents is not null then payment.appointment_id is not null end,
    agenda.price_cents is not null and agenda.status = 'confirmed' and agenda.starts_at <= now()
  from public.list_appointments(p_organization_id, p_day) as agenda
  left join public.payments as payment on payment.organization_id = p_organization_id and payment.appointment_id = agenda.id
  order by agenda.starts_at, agenda.id;
$$;

revoke execute on function
  barberflow_private.complete_appointment(uuid, uuid),
  barberflow_private.record_appointment_payment(uuid, uuid, text),
  barberflow_private.received_payments_day(uuid, date),
  public.complete_appointment(uuid, uuid),
  public.record_appointment_payment(uuid, uuid, text),
  public.received_payments_day(uuid, date),
  public.list_appointments_with_payments(uuid, date)
from public, anon, authenticated, service_role;

grant execute on function
  barberflow_private.complete_appointment(uuid, uuid),
  barberflow_private.record_appointment_payment(uuid, uuid, text),
  barberflow_private.received_payments_day(uuid, date),
  public.complete_appointment(uuid, uuid),
  public.record_appointment_payment(uuid, uuid, text),
  public.received_payments_day(uuid, date),
  public.list_appointments_with_payments(uuid, date)
to authenticated;
