-- Real PostgreSQL RLS tests. Run only in the disposable database from bootstrap.sql.
\set ON_ERROR_STOP on
begin;
insert into auth.users values
 ('00000000-0000-0000-0000-000000000001','master@example.test',now()),
 ('00000000-0000-0000-0000-000000000002','ana@example.test',now()),
 ('00000000-0000-0000-0000-000000000003','beto@example.test',now()),
 ('00000000-0000-0000-0000-000000000004','outsider@example.test',now());
insert into public.mesa_arcana_tables(id,name,owner_id,data) values
 ('10000000-0000-0000-0000-000000000001','RLS test','00000000-0000-0000-0000-000000000001',
 '{"players":[{"id":"selene","kind":"NPC","character":"Selene","secrets":[]}],"masterVault":{"data":"original-encrypted-vault"},"masterAccessHash":"old-hash"}');
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.mesa_add_member('10000000-0000-0000-0000-000000000001','ana@example.test','Ana');
select public.mesa_add_member('10000000-0000-0000-0000-000000000001','beto@example.test','Beto');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select public.mesa_save_character_secrets('10000000-0000-0000-0000-000000000001','selene','00000000-0000-0000-0000-000000000002','["segredo A"]',0);
select pg_temp.assert_true((select secrets='["segredo A"]' from public.mesa_arcana_character_secrets),'1: Ana saves Selene');
-- Reestablish role/claims to simulate a new database connection; the app has no cached secret record.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true((select count(*)=1 from public.mesa_arcana_character_secrets),'2/3: account can read persisted data after reconnect');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true((select count(*)=0 from public.mesa_arcana_character_secrets),'4/5: direct SELECT as Beto returns no Ana records');
do $$ begin
 begin
  insert into public.mesa_arcana_character_secrets(table_id,character_id,player_id,secrets)
  values('10000000-0000-0000-0000-000000000001','other','00000000-0000-0000-0000-000000000002','["attack"]');
  raise exception 'FAIL: Beto inserted Ana secret';
 exception when insufficient_privilege then raise notice 'PASS: cross-user INSERT denied by RLS'; end;
 begin
  perform public.mesa_add_member('10000000-0000-0000-0000-000000000001','outsider@example.test','Intruso');
  raise exception 'FAIL: Beto granted membership';
 exception when insufficient_privilege then raise notice 'PASS: player cannot grant membership'; end;
 begin
  update public.mesa_arcana_tables set owner_id='00000000-0000-0000-0000-000000000003';
  raise exception 'FAIL: Beto became master';
 exception when insufficient_privilege then raise notice 'PASS: browser cannot claim campaign ownership'; end;
end $$;
with changed as (update public.mesa_arcana_character_secrets set secrets='["attack"]' where player_id='00000000-0000-0000-0000-000000000002' returning *)
 select pg_temp.assert_true((select count(*)=0 from changed),'cross-user UPDATE affects zero rows');
with removed as (delete from public.mesa_arcana_character_secrets where player_id='00000000-0000-0000-0000-000000000002' returning *)
 select pg_temp.assert_true((select count(*)=0 from removed),'cross-user DELETE affects zero rows');
select public.mesa_save_character_secrets('10000000-0000-0000-0000-000000000001','selene','00000000-0000-0000-0000-000000000003','["segredo B"]',0);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select pg_temp.assert_true((select count(*)=2 from public.mesa_arcana_character_secrets),'6/9: master sees two independent player records');
select public.mesa_save_character_secrets('10000000-0000-0000-0000-000000000001','selene','00000000-0000-0000-0000-000000000002','["segredo A","do mestre para A"]',1);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true((select secrets @> '["do mestre para A"]' from public.mesa_arcana_character_secrets),'7/8: Ana sees secret sent by master');
do $$ begin
 begin
  perform public.mesa_save_character_secrets('10000000-0000-0000-0000-000000000001','selene','00000000-0000-0000-0000-000000000002','["stale"]',1);
  raise exception 'FAIL: stale save overwrote new revision';
 exception when serialization_failure then raise notice 'PASS: stale save rejected'; end;
end $$;
-- Stale campaign synchronization cannot overwrite the master's old encrypted vault.
update public.mesa_arcana_tables set data=jsonb_set(data,'{masterVault}','null');
select pg_temp.assert_true((select data->'masterVault'->>'data'='original-encrypted-vault' from public.mesa_arcana_tables),'10: encrypted master vault survives player sync');
select pg_temp.assert_true((select not(data::text like '%segredo A%') from public.mesa_arcana_tables),'individual secrets absent from campaign responses');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true((select count(*)=1 and bool_and(player_id=auth.uid()) from public.mesa_arcana_character_secrets),'8: Beto still sees only Beto');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select pg_temp.assert_true((select count(*)=0 from public.mesa_arcana_character_secrets),'unrelated authenticated account sees no secrets');
select pg_temp.assert_true((select count(*)=0 from public.mesa_arcana_tables),'unrelated account sees no campaigns');
reset role;
set local role anon;
do $$ begin
 begin perform * from public.mesa_arcana_character_secrets;
 raise exception 'FAIL: anonymous read succeeded';
 exception when insufficient_privilege then raise notice 'PASS: anonymous direct access denied'; end;
end $$;
reset role;
rollback;
