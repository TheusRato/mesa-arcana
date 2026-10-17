-- Mesa Arcana - estrutura inicial Supabase
-- Rode este arquivo no Supabase Dashboard > SQL Editor > New query.

create extension if not exists pgcrypto;

create table if not exists public.mesa_arcana_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_label text not null default 'Mestre',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mesa_arcana_participants (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.mesa_arcana_tables(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('master', 'player')),
  device_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.mesa_arcana_conversations (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.mesa_arcana_tables(id) on delete cascade,
  npc_name text not null,
  player_name text,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mesa_arcana_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.mesa_arcana_conversations(id) on delete cascade,
  table_id uuid not null references public.mesa_arcana_tables(id) on delete cascade,
  sender_role text not null check (sender_role in ('master', 'player', 'npc')),
  sender_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mesa_arcana_tables_updated_at on public.mesa_arcana_tables;
create trigger mesa_arcana_tables_updated_at
before update on public.mesa_arcana_tables
for each row execute function public.set_updated_at();

drop trigger if exists mesa_arcana_conversations_updated_at on public.mesa_arcana_conversations;
create trigger mesa_arcana_conversations_updated_at
before update on public.mesa_arcana_conversations
for each row execute function public.set_updated_at();

alter table public.mesa_arcana_tables enable row level security;
alter table public.mesa_arcana_participants enable row level security;
alter table public.mesa_arcana_conversations enable row level security;
alter table public.mesa_arcana_messages enable row level security;

-- No anonymous/browser access until the authenticated membership migration is installed.
-- Run supabase/migrations/20261017_individual_secrets.sql next.
-- Never restore the old permissive development policies.
revoke all on public.mesa_arcana_tables, public.mesa_arcana_participants,
  public.mesa_arcana_conversations, public.mesa_arcana_messages from anon, authenticated;
