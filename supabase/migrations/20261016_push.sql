-- Apply after supabase-setup.sql. Only the Edge Function may access these tables.
create table if not exists public.mesa_arcana_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.mesa_arcana_tables(id) on delete cascade,
  endpoint_hash text not null,
  role text not null check (role in ('master', 'player')),
  player_name text not null default '',
  credential_fingerprint text not null,
  subscription jsonb not null,
  revoke_hash text not null,
  updated_at timestamptz not null default now(),
  unique (table_id, endpoint_hash)
);
alter table public.mesa_arcana_push_subscriptions enable row level security;
revoke all on public.mesa_arcana_push_subscriptions from anon, authenticated;
grant all on public.mesa_arcana_push_subscriptions to service_role;

create table if not exists public.mesa_arcana_push_deliveries (
  message_id uuid not null references public.mesa_arcana_messages(id) on delete cascade,
  subscription_id uuid not null references public.mesa_arcana_push_subscriptions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, subscription_id)
);
alter table public.mesa_arcana_push_deliveries enable row level security;
revoke all on public.mesa_arcana_push_deliveries from anon, authenticated;
grant all on public.mesa_arcana_push_deliveries to service_role;

create table if not exists public.mesa_arcana_push_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 1
);
alter table public.mesa_arcana_push_rate_limits enable row level security;
revoke all on public.mesa_arcana_push_rate_limits from anon, authenticated;
grant all on public.mesa_arcana_push_rate_limits to service_role;

create or replace function public.mesa_arcana_push_rate_limit(rate_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare count_attempts integer;
begin
  delete from public.mesa_arcana_push_rate_limits where window_start < now() - interval '1 day';
  insert into public.mesa_arcana_push_rate_limits as limits(key) values (rate_key)
  on conflict (key) do update set
    attempts = case when limits.window_start < now() - interval '1 minute' then 1 else limits.attempts + 1 end,
    window_start = case when limits.window_start < now() - interval '1 minute' then now() else limits.window_start end
  returning attempts into count_attempts;
  return count_attempts <= 10;
end;
$$;
revoke all on function public.mesa_arcana_push_rate_limit(text) from public, anon, authenticated;
grant execute on function public.mesa_arcana_push_rate_limit(text) to service_role;
