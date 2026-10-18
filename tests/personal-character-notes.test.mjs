import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = file => fs.readFileSync(new URL('../src/js/' + file, import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
function fixture(owner = 'Ana', role = 'player', backend = null) {
  const character = { id: 'selene', kind: 'NPC', notes: 'Descrição original', secrets: ['Antigo segredo do mestre'], playerVersions: {} };
  const data = { campaign: {}, players: [character] };
  const table = { id: 'local', onlineId: backend ? 'online' : '', role, playerName: owner, pendingCloudSave: false };
  const nodes = new Map();
  const document = { querySelector(id) {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', disabled: false, classList: { toggle() {} } });
    return nodes.get(id);
  } };
  const client = { from() {
    let payload, expected;
    return {
      select() { return this; },
      eq(key, value) { if (key === 'updated_at') expected = value; return this; },
      async single() { return { data: clone(backend.row) }; },
      update(value) { payload = clone(value); return this; },
      async maybeSingle() {
        if (expected !== backend.row.updated_at) { backend.conflicts++; return { data: null }; }
        backend.row = { ...payload, updated_at: String(Number(backend.row.updated_at) + 1) };
        return { data: { updated_at: backend.row.updated_at } };
      }
    };
  } };
  const scope = vm.createContext({ data, activeCharacterId: 'selene', document, console, initialData: { campaign: {} }, createId: () => 'id',
    safeList: value => Array.isArray(value) ? value : [], getActiveTable: () => table, getCharacter: () => data.players[0],
    playerSheetProfiles: () => [{ name: 'Ana' }, { name: 'Beto' }], escapeHtml: String, currentPlayerOwner: () => owner,
    window: { clearTimeout() {}, setTimeout() {} }, cloudChangeVersion: 1, isSavingCloud: false, cloudSaveTimer: null,
    setSupabaseStatus() {}, saveTableRegistry: () => true });
  for (const path of ['core/storage-and-vault.js', 'services/cloud.js', 'services/personal-character-notes.js']) vm.runInContext(read(path), scope);
  scope.getActiveTable = () => table;
  scope.saveTableRegistry = () => true;
  scope.getSupabaseClient = () => client;
  scope.persistLocalData = () => { table.data = clone(data); return true; };
  scope.getOnlineTableOrWarn = () => table;
  return { scope, table, data, character, node: id => document.querySelector('#' + id) };
}

test('Player edits their description and secrets without changing master data; removal persists as an empty version', () => {
  const a = fixture();
  a.scope.renderPersonalCharacterNotes(a.character, 'Beto');
  a.node('personalCharacterDescription').value = 'Minha visão';
  a.node('personalCharacterSecrets').value = ' Segredo A \n';
  a.scope.savePersonalCharacterNotes();
  assert.equal(a.character.notes, 'Descrição original');
  assert.deepEqual(a.character.secrets, ['Antigo segredo do mestre']);
  assert.equal(a.table.data.players[0].playerVersions.Ana.description, 'Minha visão');
  assert.equal(a.character.playerVersions.Beto, undefined);
  const restored = a.table.data.players[0];
  assert.equal(a.scope.personalCharacterVersion(restored, 'Ana').secrets[0], 'Segredo A');
  assert.equal(a.scope.personalCharacterVersion(restored, 'Beto').secrets.length, 0);
  a.node('personalCharacterDescription').value = '';
  a.node('personalCharacterSecrets').value = '';
  a.scope.savePersonalCharacterNotes();
  assert.equal(a.scope.personalCharacterVersion(a.character, 'Ana').description, '');
  assert.equal(a.scope.personalCharacterVersion(a.character, 'Ana').secrets.length, 0);
});

test('Master selects and edits each player separately', () => {
  const m = fixture('', 'master');
  m.scope.renderPersonalCharacterNotes(m.character, 'Ana');
  m.node('personalCharacterSecrets').value = 'Para Ana';
  m.scope.savePersonalCharacterNotes();
  m.scope.renderPersonalCharacterNotes(m.character, 'Beto');
  assert.equal(m.node('personalCharacterSecrets').value, '');
  m.node('personalCharacterSecrets').value = 'Para Beto';
  m.scope.savePersonalCharacterNotes();
  assert.equal(m.scope.personalCharacterVersion(m.character, 'Ana').secrets[0], 'Para Ana');
  assert.equal(m.scope.personalCharacterVersion(m.character, 'Beto').secrets[0], 'Para Beto');
});

test('Failed local persistence keeps the draft marked as unsaved', () => {
  const a = fixture();
  a.scope.renderPersonalCharacterNotes(a.character);
  a.scope.persistLocalData = () => false;
  a.node('personalCharacterDescription').value = 'Rascunho';
  a.scope.savePersonalCharacterNotes();
  assert.equal(a.scope.personalCharacterDraftChanged(), true);
  assert.match(a.node('personalCharacterStatus').textContent, /Não foi possível salvar/);
});

test('Merge ignores stale cached versions and applies only the selected player changes', () => {
  const a = fixture();
  const remote = [{ id: 'selene', playerVersions: { Ana: { description: 'old' }, Beto: { description: 'new Beto' } } }];
  const local = [{ id: 'selene', playerVersions: { Ana: { description: 'stale A' }, Beto: { description: 'stale B' } } }];
  const pending = { selene: { Ana: { description: 'new Ana' }, Beto: { description: 'forged Beto' } } };
  const merged = a.scope.mergePersonalCharacterVersions(remote, local, pending, 'Ana');
  assert.equal(merged[0].playerVersions.Ana.description, 'new Ana');
  assert.equal(merged[0].playerVersions.Beto.description, 'new Beto');
});

test('Concurrent player saves retry timestamp conflicts and keep both records; stale master save preserves them', async () => {
  const backend = { row: { data: { campaign: {}, players: [{ id: 'selene', kind: 'NPC', notes: 'Base', secrets: [], playerVersions: {} }] }, updated_at: '1' }, conflicts: 0 };
  const a = fixture('Ana', 'player', backend), b = fixture('Beto', 'player', backend);
  for (const [f, text] of [[a, 'A'], [b, 'B']]) {
    f.scope.renderPersonalCharacterNotes(f.character);
    f.node('personalCharacterDescription').value = text;
    f.scope.savePersonalCharacterNotes();
  }
  await Promise.all([a.scope.saveOnlineTable(), b.scope.saveOnlineTable()]);
  assert.ok(backend.conflicts >= 1);
  assert.equal(backend.row.data.players[0].playerVersions.Ana.description, 'A');
  assert.equal(backend.row.data.players[0].playerVersions.Beto.description, 'B');
  assert.equal(Object.keys(a.table.pendingPlayerVersions).length, 0);
  const m = fixture('', 'master', backend);
  await m.scope.saveOnlineTable();
  assert.equal(backend.row.data.players[0].playerVersions.Ana.description, 'A');
  assert.equal(backend.row.data.players[0].playerVersions.Beto.description, 'B');
  const device = fixture('Ana');
  const restored = device.scope.personalCharacterVersion(clone(backend.row.data.players[0]), 'Ana');
  assert.equal(restored.description, 'A');
});

test('Acknowledgement does not delete changes made while a save was in flight', () => {
  const a = fixture();
  a.table.pendingPlayerVersions = { selene: { Ana: { description: 'newer' } } };
  a.scope.acknowledgePersonalCharacterVersions(a.table, { selene: { Ana: { description: 'old' } } });
  assert.equal(a.table.pendingPlayerVersions.selene.Ana.description, 'newer');
});
