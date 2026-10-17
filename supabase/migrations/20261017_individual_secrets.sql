-- Apply AFTER supabase-setup.sql. Transactional, repeatable; never assigns legacy owners.
begin;
-- Do not silently publish or erase historical plaintext master data.
do $$ begin
  if exists (select 1 from public.mesa_arcana_tables t where
    jsonb_array_length(coalesce(t.data->'masterNotes','[]')) > 0 or
    jsonb_array_length(coalesce(t.data->'clocks','[]')) > 0 or
    jsonb_array_length(coalesce(t.data->'masterFiles','[]')) > 0 or
    exists (select 1 from jsonb_array_elements(coalesce(t.data->'players','[]')) p
      where jsonb_array_length(coalesce(p->'secrets','[]')) > 0)) then
    raise exception 'Legacy plaintext master data detected. Back up and encrypt with the master vault before migrating; see docs/segredos-privados.md';
  end if;
end $$;

alter table public.mesa_arcana_tables add column if not exists owner_id uuid references auth.users(id);
alter table public.mesa_arcana_tables alter column owner_id set default auth.uid();
create table if not exists public.mesa_arcana_members (
  table_id uuid not null references public.mesa_arcana_tables(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  primary key (table_id, user_id), unique (table_id, display_name)
);
create or replace function public.mesa_is_master(campaign uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.mesa_arcana_tables where id = campaign and owner_id = auth.uid())
$$;
create or replace function public.mesa_is_member(campaign uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.mesa_is_master(campaign) or exists(
    select 1 from public.mesa_arcana_members where table_id = campaign and user_id = auth.uid())
$$;
revoke all on function public.mesa_is_master(uuid), public.mesa_is_member(uuid) from public, anon;
grant execute on function public.mesa_is_master(uuid), public.mesa_is_member(uuid) to authenticated;

-- Replace ALL old policies: permissive policies combine with OR, so adding RLS alone is insufficient.
do $$ declare p record; begin
 for p in select schemaname, tablename, policyname from pg_policies where schemaname='public'
   and tablename in ('mesa_arcana_tables','mesa_arcana_participants','mesa_arcana_conversations','mesa_arcana_messages','mesa_arcana_members') loop
   execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
 end loop;
end $$;
alter table public.mesa_arcana_members enable row level security;
revoke all on public.mesa_arcana_members from public, anon, authenticated;
grant select, insert, update, delete on public.mesa_arcana_members to authenticated;
create policy member_read on public.mesa_arcana_members for select to authenticated
 using (user_id=auth.uid() or public.mesa_is_master(table_id));
create policy member_manage on public.mesa_arcana_members for all to authenticated
 using (public.mesa_is_master(table_id)) with check (public.mesa_is_master(table_id));

revoke all on public.mesa_arcana_tables, public.mesa_arcana_participants,
 public.mesa_arcana_conversations, public.mesa_arcana_messages from public, anon;
grant select, insert, update on public.mesa_arcana_tables to authenticated;
create policy campaign_read on public.mesa_arcana_tables for select to authenticated using (public.mesa_is_member(id));
create policy campaign_create on public.mesa_arcana_tables for insert to authenticated with check (owner_id=auth.uid());
create policy campaign_update on public.mesa_arcana_tables for update to authenticated
 using (public.mesa_is_member(id)) with check (public.mesa_is_member(id));
-- Ownership may only be assigned/transferred by the operator, never by a browser or old invite.
create or replace function public.mesa_guard_campaign()
returns trigger language plpgsql set search_path = '' as $$
begin
 if jsonb_array_length(coalesce(new.data->'masterNotes','[]')) > 0 or
    jsonb_array_length(coalesce(new.data->'clocks','[]')) > 0 or
    jsonb_array_length(coalesce(new.data->'masterFiles','[]')) > 0 or
    exists(select 1 from jsonb_array_elements(coalesce(new.data->'players','[]')) p
      where jsonb_array_length(coalesce(p->'secrets','[]')) > 0) then
  raise exception 'Master data must be encrypted in masterVault' using errcode='23514';
 end if;
 if TG_OP='UPDATE' and current_user in ('anon','authenticated') then
  if new.owner_id is distinct from old.owner_id or new.id is distinct from old.id then
   raise exception 'Campaign ownership is managed by the operator' using errcode='42501';
  end if;
  if not public.mesa_is_master(old.id) then
   new.data = (new.data - 'masterVault' - 'masterAccessHash') ||
     jsonb_build_object('masterVault',old.data->'masterVault','masterAccessHash',old.data->'masterAccessHash');
  end if;
 end if;
 return new;
end $$;
drop trigger if exists mesa_guard_campaign on public.mesa_arcana_tables;
create trigger mesa_guard_campaign before insert or update on public.mesa_arcana_tables
 for each row execute function public.mesa_guard_campaign();

-- Keep existing public campaign/chat features available to verified members only.
grant select, insert, update, delete on public.mesa_arcana_participants to authenticated;
grant select, insert, update on public.mesa_arcana_conversations to authenticated;
grant select, insert on public.mesa_arcana_messages to authenticated;
create policy participant_access on public.mesa_arcana_participants for all to authenticated
 using (public.mesa_is_member(table_id)) with check (public.mesa_is_member(table_id));
create policy conversation_access on public.mesa_arcana_conversations for all to authenticated
 using (public.mesa_is_member(table_id)) with check (public.mesa_is_member(table_id));
create policy message_read on public.mesa_arcana_messages for select to authenticated using (public.mesa_is_member(table_id));
create policy message_write on public.mesa_arcana_messages for insert to authenticated with check (
 public.mesa_is_member(table_id) and exists (select 1 from public.mesa_arcana_conversations c where c.id=conversation_id and c.table_id=mesa_arcana_messages.table_id));

create table if not exists public.mesa_arcana_character_secrets (
 table_id uuid not null,
 character_id text not null check (length(character_id) between 1 and 200),
 player_id uuid not null,
 secrets jsonb not null default '[]'::jsonb check (jsonb_typeof(secrets)='array' and octet_length(secrets::text)<=65536),
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 primary key (table_id, character_id, player_id),
 foreign key (table_id, player_id) references public.mesa_arcana_members(table_id,user_id)
);
alter table public.mesa_arcana_character_secrets enable row level security;
revoke all on public.mesa_arcana_character_secrets from public, anon, authenticated;
grant select, insert, update, delete on public.mesa_arcana_character_secrets to authenticated;
-- Also replace policies on rerun, including any accidentally permissive ones.
do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='mesa_arcana_character_secrets' loop
 execute format('drop policy %I on public.mesa_arcana_character_secrets',p.policyname); end loop;
end $$;
create policy secret_access on public.mesa_arcana_character_secrets for all to authenticated
 using (public.mesa_is_master(table_id) or (player_id=auth.uid() and public.mesa_is_member(table_id)))
 with check (public.mesa_is_master(table_id) or (player_id=auth.uid() and public.mesa_is_member(table_id)));

-- Invoker rights preserve RLS. CAS prevents a stale device overwriting a newer revision.
create or replace function public.mesa_save_character_secrets(
 campaign uuid, character text, recipient uuid, body jsonb, expected_revision bigint
) returns public.mesa_arcana_character_secrets language plpgsql security invoker set search_path = '' as $$
declare result public.mesa_arcana_character_secrets;
begin
 if jsonb_typeof(body) <> 'array' or exists(select 1 from jsonb_array_elements(body) e where jsonb_typeof(e)<>'string') then
  raise exception 'Secrets must be an array of strings' using errcode='22023';
 end if;
 if expected_revision=0 then
  insert into public.mesa_arcana_character_secrets(table_id,character_id,player_id,secrets)
   values(campaign,character,recipient,body) on conflict do nothing returning * into result;
 else
  update public.mesa_arcana_character_secrets set secrets=body, revision=revision+1,updated_at=now()
   where table_id=campaign and character_id=character and player_id=recipient and revision=expected_revision returning * into result;
 end if;
 if result.table_id is null then raise exception 'Secrets changed; reload before saving' using errcode='40001'; end if;
 return result;
end $$;
revoke all on function public.mesa_save_character_secrets(uuid,text,uuid,jsonb,bigint) from public, anon;
grant execute on function public.mesa_save_character_secrets(uuid,text,uuid,jsonb,bigint) to authenticated;

-- A master may bind an existing verified account. PINs and browser role labels are never consulted.
create or replace function public.mesa_add_member(campaign uuid, player_email text, player_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
 if not public.mesa_is_master(campaign) then raise exception 'Master only' using errcode='42501'; end if;
 select id into target from auth.users where lower(email)=lower(trim(player_email)) and email_confirmed_at is not null;
 if target is null then raise exception 'Player must verify their email first'; end if;
 insert into public.mesa_arcana_members(table_id,user_id,display_name) values(campaign,target,trim(player_name))
 on conflict(table_id,user_id) do update set display_name=excluded.display_name;
end $$;
revoke all on function public.mesa_add_member(uuid,text,text) from public, anon;
grant execute on function public.mesa_add_member(uuid,text,text) to authenticated;
commit;
