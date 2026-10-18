import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = path => fs.readFileSync(new URL('../src/js/' + path, import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const seed = () => ({ campaign: {}, players: [], playerProfiles: [{ name: 'Ana' }, { name: 'Beto' }], sessions: [{ id: 's', title: 'Sessão 1', date: '', diary: '', playerDiaries: {} }] });
function fixture(role = 'player', name = 'Ana', backend = null, saved = null) {
  const nodes = new Map(), handlers = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', innerHTML: '', readOnly: false, disabled: false, style: {}, classList: { add() {}, remove() {}, toggle() {} },
      querySelectorAll: () => [], addEventListener: (event, handler) => handlers.set(id + ':' + event, handler) });
    return nodes.get(id);
  };
  const table = saved ? clone(saved) : { id: 'local', role, playerName: name, onlineId: backend ? 'online' : '', updatedAt: '', data: seed() };
  const client = { from() {
    let payload, expected;
    return { select() { return this; }, eq(key, value) { if (key === 'updated_at') expected = value; return this; },
      async single() { return { data: { id: 'online', name: 'Mesa', ...clone(backend.row) } }; },
      update(value) { payload = clone(value); return this; },
      async maybeSingle() {
        if (backend.fail) return { error: new Error('offline') };
        if (expected !== backend.row.updated_at) { backend.conflicts++; return { data: null }; }
        backend.version++;
        backend.row = { ...payload, updated_at: new Date(2000000000000 + backend.version * 1000).toISOString() };
        return { data: { updated_at: backend.row.updated_at } };
      }
    };
  } };
  let persisted;
  const scope = vm.createContext({ data: clone(table.data), activeSessionId: null, console: { warn() {} }, initialData: { campaign: {} },
    document: { getElementById: node, querySelector: id => node(id.replace(/^#/, '')) },
    window: { clearTimeout() {}, setTimeout() {} }, createId: () => 'new-session', activeMasterPlayerName: '',
    cloudChangeVersion: 0, cloudSaveTimer: null, isSavingCloud: false, isRefreshingCloud: false,
    escapeHtml: String, render() {}, autoResizeTextarea() {} });
  for (const path of ['core/storage-and-vault.js','services/cloud.js','services/session-sync.js','services/personal-character-notes.js','features/characters-and-player.js','features/sessions.js']) vm.runInContext(read(path), scope);
  scope.getActiveTable = () => table;
  scope.getSupabaseClient = () => client;
  scope.getOnlineTableOrWarn = () => table;
  scope.saveTableRegistry = () => { persisted = clone(table); return true; };
  scope.setSupabaseStatus = text => { scope.lastStatus = text; };
  scope.setMessageStatus = () => {};
  const upload = scope.saveOnlineTable;
  // Control network timing explicitly, as if the app were offline between Save and Reload.
  scope.saveOnlineTable = () => {};
  const click = id => handlers.get(id + ':click')();
  return { scope, table, node, click, handlers, upload: () => upload(), persisted: () => persisted, setData: value => { scope.data = clone(value); } };
}
const server = () => ({ version: 0, conflicts: 0, row: { data: seed(), updated_at: new Date(2000000000000).toISOString() } });

test('Master summary survives saving when there are no players and is readable after player refresh', async () => {
  const backend = server(), m = fixture('master', '', backend);
  m.scope.data.playerProfiles = [];
  m.scope.openSession('s');
  m.node('sessionSummaryInput').value = 'Resumo escrito pelo mestre';
  m.click('saveSessionBtn');
  assert.equal(m.scope.data.sessions[0].diary, 'Resumo escrito pelo mestre');
  assert.equal(m.scope.data.sessions[0].playerDiaries[''], undefined);
  await m.upload();
  const a = fixture('player', 'Ana', backend);
  await a.scope.refreshOnlineTable({ force: true });
  a.scope.openSession('s');
  assert.equal(a.node('sessionSummaryInput').value, 'Resumo escrito pelo mestre');
  assert.equal(a.node('sessionSummaryInput').readOnly, true);
  assert.equal(a.node('sessionDiaryInput').value, '');
});

test('Player diary persists locally through reload and uploads for the master on another device', async () => {
  const backend = server(), a = fixture('player', 'Ana', backend);
  a.scope.openSession('s');
  a.node('sessionDiaryInput').value = 'Diário de Ana';
  a.click('saveSessionBtn');
  const saved = a.persisted();
  assert.equal(saved.data.sessions[0].playerDiaries.Ana, 'Diário de Ana');
  const reloaded = fixture('player', 'Ana', backend, saved);
  reloaded.scope.openSession('s');
  assert.equal(reloaded.node('sessionDiaryInput').value, 'Diário de Ana');
  await reloaded.upload();
  const m = fixture('master', '', backend);
  await m.scope.refreshOnlineTable({ force: true });
  m.scope.openSession('s');
  assert.equal(m.node('sessionDiaryInput').value, 'Diário de Ana');
  assert.equal(Object.keys(reloaded.table.pendingSessions).length, 0);
});

test('Unrelated player startup/profile save cannot replace a newer remote diary with stale empty data', async () => {
  const backend = server(), stale = fixture('player', 'Ana', backend);
  backend.row.data.sessions[0].diary = 'Resumo remoto';
  backend.row.data.sessions[0].playerDiaries.Ana = 'Diário que já foi salvo';
  await stale.upload();
  assert.equal(backend.row.data.sessions[0].diary, 'Resumo remoto');
  assert.equal(backend.row.data.sessions[0].playerDiaries.Ana, 'Diário que já foi salvo');
});

test('Master summary and two players saving concurrently preserve all three texts', async () => {
  const backend = server(), m = fixture('master', '', backend), a = fixture('player', 'Ana', backend), b = fixture('player', 'Beto', backend);
  for (const f of [m,a,b]) f.scope.openSession('s');
  m.node('sessionSummaryInput').value = 'Resumo';
  a.node('sessionDiaryInput').value = 'A';
  b.node('sessionDiaryInput').value = 'B';
  for (const f of [m,a,b]) f.click('saveSessionBtn');
  await Promise.all([m.upload(), a.upload(), b.upload()]);
  assert.ok(backend.conflicts > 0);
  assert.equal(backend.row.data.sessions[0].diary, 'Resumo');
  assert.equal(backend.row.data.sessions[0].playerDiaries.Ana, 'A');
  assert.equal(backend.row.data.sessions[0].playerDiaries.Beto, 'B');
  const staleMaster = fixture('master', '', backend);
  await staleMaster.upload();
  assert.equal(backend.row.data.sessions[0].playerDiaries.Beto, 'B');
});

test('Master can switch diary recipients without discarding unsaved text and finds owners absent from profiles', () => {
  const m = fixture('master', '');
  m.scope.data.sessions[0].playerDiaries = { ExJogador: 'Legado' };
  m.scope.openSession('s');
  m.node('sessionDiaryInput').value = 'Rascunho Ana';
  m.handlers.get('sessionDiaryPlayerSelect:change')({ target: { value: 'Beto' } });
  m.node('sessionDiaryInput').value = 'Rascunho Beto';
  m.handlers.get('sessionDiaryPlayerSelect:change')({ target: { value: 'Ana' } });
  assert.equal(m.node('sessionDiaryInput').value, 'Rascunho Ana');
  assert.match(m.node('sessionDiaryPlayerSelect').innerHTML, /ExJogador/);
  m.click('saveSessionBtn');
  assert.equal(m.scope.data.sessions[0].playerDiaries.Ana, 'Rascunho Ana');
  assert.equal(m.scope.data.sessions[0].playerDiaries.Beto, 'Rascunho Beto');
  assert.equal(m.scope.data.sessions[0].playerDiaries.ExJogador, 'Legado');
});

test('Cloud refresh updates the visible summary but preserves a player diary draft', async () => {
  const backend = server(), a = fixture('player', 'Ana', backend);
  a.scope.openSession('s');
  a.node('sessionDiaryInput').value = 'Ainda estou escrevendo';
  backend.row.data.sessions[0].diary = 'Novo resumo do mestre';
  await a.scope.refreshOnlineTable({ force: true });
  assert.equal(a.node('sessionSummaryInput').value, 'Novo resumo do mestre');
  assert.equal(a.node('sessionDiaryInput').value, 'Ainda estou escrevendo');
  a.click('saveSessionBtn');
  await a.upload();
  assert.equal(backend.row.data.sessions[0].playerDiaries.Ana, 'Ainda estou escrevendo');
});

test('Player cannot create/remove sessions or change the shared summary; deleting own diary preserves other texts', async () => {
  const backend = server();
  backend.row.data.sessions[0].diary = 'Resumo protegido';
  backend.row.data.sessions[0].playerDiaries = { Ana: 'Apagar', Beto: 'Manter' };
  const a = fixture('player', 'Ana', backend);
  await a.scope.refreshOnlineTable({ force: true });
  a.scope.openSession('s');
  a.click('addSessionBtn'); a.click('deleteSessionBtn');
  assert.equal(a.scope.data.sessions.length, 1);
  a.node('sessionSummaryInput').value = 'Tentativa de alterar';
  a.node('sessionDiaryInput').value = '';
  a.click('saveSessionBtn');
  await a.upload();
  assert.equal(backend.row.data.sessions[0].diary, 'Resumo protegido');
  assert.equal(backend.row.data.sessions[0].playerDiaries.Ana, '');
  assert.equal(backend.row.data.sessions[0].playerDiaries.Beto, 'Manter');
});

test('Failed local save keeps the form open and failed upload retains the durable pending diary', async () => {
  const backend = server(), a = fixture('player', 'Ana', backend);
  a.scope.openSession('s'); a.node('sessionDiaryInput').value = 'Não perder';
  a.scope.persistLocalData = () => false;
  a.click('saveSessionBtn');
  assert.equal(a.scope.activeSessionId, 's');
  assert.match(a.node('sessionSaveStatus').textContent, /Não foi possível salvar/);
  a.scope.persistLocalData = () => { a.table.data = clone(a.scope.data); return true; };
  a.click('saveSessionBtn'); backend.fail = true;
  await a.upload();
  assert.equal(a.table.pendingSessions.s.diaries.Ana, 'Não perder');
  assert.equal(a.table.pendingCloudSave, true);
});

test('Session create/delete operations and acknowledgement preserve edits made during upload', () => {
  const m = fixture('master', '');
  m.click('addSessionBtn');
  assert.equal(m.scope.activeSessionId, 'new-session');
  const merged = m.scope.mergePendingSessions(seed().sessions, m.scope.data.sessions, m.table.pendingSessions, 'master');
  assert.equal(merged.length, 2);
  m.click('deleteSessionBtn');
  const removed = m.scope.mergePendingSessions(merged, m.scope.data.sessions, m.table.pendingSessions, 'master');
  assert.equal(removed.length, 1);
  m.table.pendingSessions.s = { fields: {}, diaries: { Ana: 'novo' } };
  m.scope.acknowledgeSessionChanges(m.table, { s: { fields: {}, diaries: { Ana: 'antigo' } } });
  assert.equal(m.table.pendingSessions.s.diaries.Ana, 'novo');
});

test('Refresh accepts a changed server revision even when the local device clock is ahead', async () => {
  const backend = server(), a = fixture('player', 'Ana', backend);
  a.table.updatedAt = new Date(backend.row.updated_at).getFullYear() + 10 + '-01-01T00:00:00.000Z';
  backend.row.data.sessions[0].diary = 'Resumo com relógios diferentes';
  assert.equal(await a.scope.refreshOnlineTable(), true);
  assert.equal(a.scope.data.sessions[0].diary, 'Resumo com relógios diferentes');
});
