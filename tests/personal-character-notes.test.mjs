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

test('Player version includes every editable field, preserves existing description and uses its own secrets', () => {
  const a = fixture();
  const saved = a.scope.storePersonalCharacterVersion(a.character, {
    kind: 'Jogador', name: 'Meu vínculo', character: 'Selene vista por Ana',
    focus: 'Investigar', state: 'Suspeita', description: 'Minha visão', secrets: ['Segredo A']
  });
  assert.equal(saved, true);
  assert.equal(a.character.notes, 'Descrição original');
  assert.deepEqual(a.character.secrets, ['Antigo segredo do mestre']);
  const shown = a.scope.characterForCurrentView(a.character);
  assert.equal(shown.character, 'Selene vista por Ana');
  assert.equal(shown.kind, 'Jogador');
  assert.equal(shown.name, 'Meu vínculo');
  assert.equal(shown.focus, 'Investigar');
  assert.equal(shown.state, 'Suspeita');
  assert.equal(shown.notes, 'Minha visão');
  assert.equal(shown.secrets[0], 'Segredo A');
  a.scope.storePersonalCharacterVersion(a.character, { description: '', secrets: [] });
  assert.equal(a.scope.personalCharacterVersion(a.character, 'Ana').description, '');
  assert.equal(a.scope.personalCharacterVersion(a.character, 'Ana').secrets.length, 0);
});

test('Master selector contains players only and reads their saved versions without a duplicate editor', () => {
  const m = fixture('', 'master');
  m.character.playerVersions = { Ana: { description: 'Descrição de Ana', secrets: ['A'] }, Beto: { description: 'Descrição de Beto', secrets: ['B'] } };
  m.node('editCharacterFromModal').classList.remove = () => {};
  m.scope.renderCharacterVersionSelect(m.character, 'Ana');
  assert.equal(m.scope.characterForCurrentView(m.character).notes, 'Descrição de Ana');
  m.scope.renderCharacterVersionSelect(m.character, 'Beto');
  assert.equal(m.scope.characterForCurrentView(m.character).secrets[0], 'B');
  assert.equal(m.node('characterVersionPlayerSelect').innerHTML.includes('Original'), false);
  const html = fs.readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  assert.equal(html.includes('personalCharacterBox'), false);
  assert.equal(html.includes('savePersonalCharacterNotes'), false);
});

test('Existing description-only versions migrate by fallback without exposing master secrets', () => {
  const a = fixture();
  a.character.playerVersions = { Ana: { description: 'Texto anterior', secrets: ['Anterior'] } };
  const version = a.scope.personalCharacterVersion(a.character, 'Ana');
  assert.equal(version.description, 'Texto anterior');
  assert.equal(version.character, a.character.character || '');
  assert.equal(version.secrets[0], 'Anterior');
  assert.equal(a.scope.personalCharacterVersion(a.character, 'Beto').secrets.length, 0);
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
    f.scope.storePersonalCharacterVersion(f.character, { description: text });
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

test('Existing edit dialog loads all personal fields, hides photo upload, and saves without changing master fields', () => {
  const a = fixture();
  const scope = a.scope;
  const hidden = new Map();
  const listeners = new Map();
  const originalQuery = scope.document.querySelector;
  scope.document.querySelector = selector => {
    const node = originalQuery(selector);
    node.classList = {
      toggle(name, flag) { hidden.set(selector, Boolean(flag)); },
      add() { hidden.set(selector, true); }, remove() { hidden.set(selector, false); }, contains() { return hidden.get(selector); }
    };
    node.nextElementSibling = {};
    node.closest = () => ({ classList: { toggle(name, flag) { hidden.set('cover-label', flag); } } });
    node.focus = () => {};
    node.addEventListener = (event, handler) => listeners.set(selector + ':' + event, handler);
    return node;
  };
  scope.document.getElementById = id => scope.document.querySelector('#' + id);
  scope.setSelectValuePreservingLegacy = (id, value) => { scope.document.querySelector(id).value = value; };
  scope.editingCharacterId = null;
  scope.newCharacterCover = '';
  scope.activeCharacterMasterView = false;
  scope.data.hiddenPlayerProfiles = [];
  scope.render = () => {};
  vm.runInContext(read('features/characters-and-player.js'), scope);
  scope.renderSecretInputs = secrets => { scope.testSecrets = Array.from(secrets); };
  scope.getSecretInputs = () => ['Novo segredo'];
  a.character.character = 'Selene';
  a.character.cover = 'foto-original';
  a.character.playerVersions = { Ana: { character: 'Minha Selene', focus: 'Meu objetivo', description: 'Texto já salvo', secrets: ['Anterior'] } };
  scope.openEditCharacterModal();
  assert.equal(a.node('characterName').value, 'Minha Selene');
  assert.equal(a.node('playerFocus').value, 'Meu objetivo');
  assert.equal(a.node('playerNotes').value, 'Texto já salvo');
  assert.deepEqual(Array.from(scope.testSecrets), ['Anterior']);
  assert.equal(hidden.get('cover-label'), true);
  assert.equal(hidden.get('#newCharacterCoverPreview'), true);
  // Closing the sheet while opening Edit must retain the underlying character id.
  assert.equal(scope.activeCharacterId, null);
  assert.equal(scope.editingCharacterId, 'selene');
  const events = read('ui/events.js');
  const start = events.indexOf('    document.querySelector("#addPlayer").addEventListener');
  const end = events.indexOf('    document.querySelector("#modalCharacterCover")', start);
  vm.runInContext(events.slice(start, end), scope);
  scope.openCharacterModal = id => { scope.reopenedId = id; };
  a.node('characterName').value = 'Selene editada';
  a.node('playerNotes').value = 'Nova descrição';
  listeners.get('#addPlayer:click')();
  assert.equal(scope.reopenedId, 'selene');
  assert.equal(a.character.playerVersions.Ana.character, 'Selene editada');
  assert.equal(a.character.playerVersions.Ana.description, 'Nova descrição');
  assert.equal(a.character.playerVersions.Ana.secrets[0], 'Novo segredo');
  assert.equal(a.character.character, 'Selene');
  assert.equal(a.character.cover, 'foto-original');
  assert.equal(a.character.notes, 'Descrição original');
  assert.deepEqual(a.character.secrets, ['Antigo segredo do mestre']);
});
