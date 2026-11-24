create function barberflow_private.appointments_period(p_organization_id uuid, p_first date, p_last date)
returns table (
  id uuid, starts_at timestamptz, ends_at timestamptz, status text, service_name text,
  professional_name text, customer_name text, price_cents integer, is_paid boolean, can_complete boolean, professional_id uuid
)
language sql stable security definer set search_path = '' as $$
  select a.*, item.professional_id from generate_series(0, least(p_last - p_first, 30)) as offset_day(day)
  cross join lateral public.list_appointments_with_payments(p_organization_id, p_first + offset_day.day) a
  join public.appointments item on item.id = a.id and item.organization_id = p_organization_id
  where p_last >= p_first
  order by a.starts_at, a.id;
$$;
create function public.appointments_period(p_organization_id uuid, p_first date, p_last date)
returns table (
  id uuid, starts_at timestamptz, ends_at timestamptz, status text, service_name text,
  professional_name text, customer_name text, price_cents integer, is_paid boolean, can_complete boolean, professional_id uuid
)
language sql stable security invoker set search_path = '' as $$
  select * from barberflow_private.appointments_period(p_organization_id, p_first, p_last);
$$;

create function barberflow_private.customer_history(p_organization_id uuid, p_customer_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with scoped as (
    select a.id, a.starts_at, a.status, s.name as service_name
    from public.appointments a
    join public.services s on (s.organization_id,s.id) = (a.organization_id,a.service_id)
    where a.organization_id = p_organization_id and a.customer_id = p_customer_id
      and p_organization_id in (select barberflow_private.admin_organization_ids())
  ), recent as (
    select * from scoped order by starts_at desc, id limit 100
  )
  select jsonb_build_object(
    'completed', (select count(*) from scoped where status = 'completed'),
    'last_completed', (select max(starts_at) from scoped where status = 'completed'),
    'items', coalesce(jsonb_agg(to_jsonb(recent) order by starts_at desc, id), '[]'::jsonb)
  ) from recent;
$$;
create function public.customer_history(p_organization_id uuid, p_customer_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select barberflow_private.customer_history(p_organization_id,p_customer_id);
$$;
revoke execute on function public.appointments_period(uuid,date,date), public.customer_history(uuid,uuid),
  barberflow_private.customer_history(uuid,uuid), barberflow_private.appointments_period(uuid,date,date) from public, anon, service_role;
grant execute on function public.appointments_period(uuid,date,date), public.customer_history(uuid,uuid),
  barberflow_private.customer_history(uuid,uuid), barberflow_private.appointments_period(uuid,date,date) to authenticated;
