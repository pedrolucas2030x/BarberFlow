alter table public.customers alter column phone drop not null;

create function public.book_with_customer_name(
  p_organization_id uuid, p_professional_id uuid, p_service_id uuid,
  p_customer_name text, p_customer_phone text, p_starts_at timestamptz
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  customer_id uuid;
begin
  insert into public.customers (organization_id, name, phone)
    values (p_organization_id, btrim(p_customer_name), p_customer_phone)
    on conflict (organization_id, phone) do nothing returning id into customer_id;

  if not found then
    select id into customer_id from public.customers
    where organization_id = p_organization_id and phone = p_customer_phone;
  end if;

  return public.create_appointment(p_organization_id, p_professional_id, p_service_id, customer_id, p_starts_at);
end;
$$;

revoke execute on function public.book_with_customer_name(uuid, uuid, uuid, text, text, timestamptz) from public, anon, service_role;
grant execute on function public.book_with_customer_name(uuid, uuid, uuid, text, text, timestamptz) to authenticated;
