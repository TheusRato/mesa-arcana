import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = fs.readFileSync(new URL('../src/js/services/individual-secrets.js', import.meta.url), 'utf8');
function fixture(user = 'a', backend = new Map(), storage = new Map(), online = true) {
  const nodes = new Map();
  for (const id of ['individualSecretsInput', 'individualSecretsPlayer', 'individualSecretsStatus', 'saveIndividualSecrets']) {
    const node = { value: '', disabled: false, options: [], textContent: '' };
    Object.defineProperty(node, 'innerHTML', { set(value) { this.options = [...value.matchAll(/<option/g)]; } });
    nodes.set('#' + id, node);
  }
  const table = { id: 'local-campaign', onlineId: online ? 'campaign' : '', playerName: user, role: user === 'master' ? 'master' : 'player' };
  const calls = [];
  let failSave = false;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: user } } }) },
    from(name) {
      const filters = {};
      const query = {
        select() { return this; }, eq(key, value) { filters[key] = value; return this; },
        order() { return Promise.resolve({ data: [{ user_id: 'a', display_name: 'Ana' }, { user_id: 'b', display_name: 'Beto' }] }); },
        async single() {
          if (name === 'mesa_arcana_tables') return { data: { owner_id: 'master' } };
          return { data: { user_id: user, display_name: user === 'a' ? 'Ana' : 'Beto' } };
        },
        async maybeSingle() {
          calls.push({ name, filters });
          return { data: backend.get(`${filters.table_id}:${filters.character_id}:${filters.player_id}`) || null };
        }
      };
      return query;
    },
    async rpc(name, args) {
      calls.push({ name, args });
      if (failSave) return { error: { message: 'offline' } };
      const key = `${args.campaign}:${args.character}:${args.recipient}`;
      const previous = backend.get(key);
      if ((previous?.revision || 0) !== args.expected_revision) return { error: { code: '40001' } };
      const record = { secrets: args.body, revision: args.expected_revision + 1 };
      backend.set(key, record);
      return { data: record };
    }
  };
  const scope = vm.createContext({ document: { querySelector: id => nodes.get(id) }, getActiveTable: () => table, activeCharacterId: 'selene',
    getSupabaseClient: () => client, escapeHtml: String, askConfirm: async () => true,
    readLocalValue: key => storage.get(key), writeLocalValue: (key, value) => { storage.set(key, value); return true; },
    playerSheetProfiles: () => [{ name: 'Ana' }, { name: 'Beto' }] });
  vm.runInContext(source, scope);
  return { scope, input: nodes.get('#individualSecretsInput'), status: nodes.get('#individualSecretsStatus'), table, backend, storage, calls, fail: () => { failSave = true; } };
}

test('Ana saves Selene; reload and a new authenticated device read the persisted record', async () => {
  const a = fixture();
  await a.scope.loadIndividualSecrets();
  a.input.value = 'Selene conhece a cripta';
  await a.scope.saveIndividualSecrets();
  assert.match(a.status.textContent, /salvos no Supabase/);
  a.scope.clearIndividualSecrets();
  await a.scope.loadIndividualSecrets();
  assert.equal(a.input.value, 'Selene conhece a cripta');
  const device = fixture('a', a.backend);
  await device.scope.loadIndividualSecrets();
  assert.equal(device.input.value, a.input.value);
  assert.equal(a.table.data, undefined, 'individual secrets never enter shared campaign data');
  assert.equal(a.storage.size, 0, 'online secrets never enter local shared storage');
});

test('Player queries use the verified UID, independent of browser name, role or requested recipient', async () => {
  const b = fixture('b');
  b.table.role = 'master'; b.table.playerName = 'Ana';
  await b.scope.loadIndividualSecrets('a');
  assert.equal(b.calls.at(-1).filters.player_id, 'b');
  assert.equal(b.input.value, '');
});

test('Master selects recipients separately and writes for Ana', async () => {
  const master = fixture('master');
  await master.scope.loadIndividualSecrets('a');
  master.input.value = 'Mensagem do mestre';
  await master.scope.saveIndividualSecrets();
  await master.scope.loadIndividualSecrets('b');
  assert.equal(master.input.value, '');
  const a = fixture('a', master.backend);
  await a.scope.loadIndividualSecrets();
  assert.equal(a.input.value, 'Mensagem do mestre');
  const b = fixture('b', master.backend);
  await b.scope.loadIndividualSecrets();
  assert.equal(b.input.value, '');
});

test('Independent player saves retain both records; a stale same-player session retains its draft', async () => {
  const a = fixture(), b = fixture('b', a.backend), otherDevice = fixture('a', a.backend);
  await Promise.all([a.scope.loadIndividualSecrets(), b.scope.loadIndividualSecrets(), otherDevice.scope.loadIndividualSecrets()]);
  a.input.value = 'Ana'; b.input.value = 'Beto';
  await Promise.all([a.scope.saveIndividualSecrets(), b.scope.saveIndividualSecrets()]);
  assert.equal(a.backend.size, 2);
  otherDevice.input.value = 'Rascunho antigo';
  await otherDevice.scope.saveIndividualSecrets();
  assert.match(otherDevice.status.textContent, /Outra sessão/);
  assert.equal(otherDevice.input.value, 'Rascunho antigo');
  assert.deepEqual(Array.from(a.backend.get('campaign:selene:a').secrets), ['Ana']);
});

test('Removal persists, and network failure never reports a successful save or loses a draft', async () => {
  const a = fixture();
  await a.scope.loadIndividualSecrets();
  a.input.value = 'Segredo'; await a.scope.saveIndividualSecrets();
  a.input.value = ''; await a.scope.saveIndividualSecrets();
  await a.scope.loadIndividualSecrets();
  assert.equal(a.input.value, '');
  a.fail(); a.input.value = 'Ainda não salvo'; await a.scope.saveIndividualSecrets();
  assert.match(a.status.textContent, /Falha ao salvar/);
  assert.equal(a.input.value, 'Ainda não salvo');
});

test('Offline secrets use a separate device-local namespace and disclose the limitation', async () => {
  const a = fixture('a', new Map(), new Map(), false);
  await a.scope.loadIndividualSecrets(); a.input.value = 'Local'; await a.scope.saveIndividualSecrets();
  const reloaded = fixture('a', new Map(), a.storage, false);
  await reloaded.scope.loadIndividualSecrets();
  assert.equal(reloaded.input.value, 'Local');
  assert.match(reloaded.status.textContent, /outros usuários deste navegador/);
});

test('Late responses after closing cannot restore secret text', async () => {
  const a = fixture();
  const loading = a.scope.loadIndividualSecrets();
  a.scope.clearIndividualSecrets();
  await loading;
  assert.equal(a.input.value, '');
  assert.equal(a.input.disabled, true);
});

test('Existing encrypted master secrets round-trip unchanged and never appear in public campaign JSON', async () => {
  const scope = vm.createContext({ crypto: webcrypto, TextEncoder, TextDecoder,
    btoa: value => Buffer.from(value, 'binary').toString('base64'), atob: value => Buffer.from(value, 'base64').toString('binary'),
    safeList: value => Array.isArray(value) ? value : [], createId: () => 'id', initialData: { campaign: {} },
    console, setSupabaseStatus() {} });
  vm.runInContext(fs.readFileSync(new URL('../src/js/core/storage-and-vault.js', import.meta.url), 'utf8'), scope);
  const original = { players: [{ id: 'selene', kind: 'NPC', character: 'Selene', secrets: ['Antigo segredo do mestre'] }], masterNotes: [{ body: 'Nota antiga' }] };
  const cloud = await scope.cloudDataForMaster({ masterKey: 'master-key' }, original);
  assert.equal(cloud.players[0].secrets.length, 0);
  assert.equal(JSON.stringify(cloud).includes('Antigo segredo do mestre'), false);
  const restored = await scope.masterDataFromCloud(cloud, original, 'master-key');
  assert.equal(restored.players[0].secrets[0], original.players[0].secrets[0]);
  assert.equal(restored.masterNotes[0].body, 'Nota antiga');
});
