import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = p => fs.readFileSync(new URL('../src/js/' + p, import.meta.url), 'utf8');
const clone = v => JSON.parse(JSON.stringify(v));
function fixture(role = 'master') {
  const table = { id: 't', name: 'Mesa', onlineId: 'online', role, data: {} };
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', value: '', classList: { add() {}, remove() {}, toggle() {} }, focus() {} });
    return nodes.get(id);
  };
  const messages = [
    { id: 'n1', sender_role: 'npc', sender_name: 'Isaac', body: 'A porta está aberta.', created_at: '' },
    { id: 'n2', sender_role: 'master', sender_name: 'Mestre', body: 'Você ouve passos.', created_at: '' },
    { id: 'p1', sender_role: 'player', sender_name: 'Ana', body: 'Eu entro.', created_at: '' }
  ];
  let saves = 0, persist = true;
  const scope = vm.createContext({ data: { messageOverrides: {} }, activeConversationId: 'c', initialData: {},
    safeList: v => Array.isArray(v) ? v : [], getActiveTable: () => table,
    document: { querySelector: node }, CSS: { escape: String },
    escapeHtml: v => String(v).replaceAll('<', '&lt;').replaceAll('"', '&quot;'), empty: String,
    setMessageStatus() {}, persistLocalData: () => { saves++; return persist; }, scheduleCloudTableSave() {}, askConfirm: async () => true
  });
  for (const p of ['core/storage-and-vault.js','features/messages.js','services/cloud.js']) vm.runInContext(read(p), scope);
  scope.getActiveTable = () => table;
  scope.persistLocalData = () => { saves++; return persist; };
  scope.scheduleCloudTableSave = () => {};
  scope.document = { querySelector: node };
  vm.runInContext('loadedMessageContext = { tableId: "t", conversationId: "c", messages: [] };', scope);
  scope.seedMessages = messages;
  vm.runInContext('loadedMessageContext.messages = seedMessages;', scope);
  return { scope, table, node, messages, saves: () => saves, failLocal: () => persist = false };
}

test('Only masters see edit/delete actions, and only on NPC/master messages', () => {
  const f = fixture(); f.scope.renderConversationMessages();
  assert.match(f.node('#messageThread').innerHTML, /data-edit-message="n1"/);
  assert.match(f.node('#messageThread').innerHTML, /data-hide-message="n2"/);
  assert.doesNotMatch(f.node('#messageThread').innerHTML, /data-edit-message="p1"/);
  f.table.role = 'player'; f.scope.renderConversationMessages();
  assert.doesNotMatch(f.node('#messageThread').innerHTML, /data-edit-message|data-hide-message/);
  assert.equal(f.scope.masterMessageContext('n1'), null);
});

test('Editing replaces the visible text without labels and retains the original record and other messages', () => {
  const f = fixture();
  f.scope.openEditMessage('n1');
  assert.equal(f.node('#editMessageBody').value, 'A porta está aberta.');
  f.node('#editMessageBody').value = 'A porta sempre esteve fechada.\n<img src=x>';
  f.scope.saveEditedMessage();
  const html = f.node('#messageThread').innerHTML;
  assert.match(html, /A porta sempre esteve fechada/);
  assert.match(html, /&lt;img/);
  assert.match(html, /Eu entro/);
  assert.doesNotMatch(html, /A porta está aberta|editada/);
  assert.equal(f.messages[0].body, 'A porta está aberta.');
  assert.equal(f.table.pendingMessageChanges.n1.body, f.node('#editMessageBody').value);
});

test('Deleting hides only the selected master message for both roles, without a deletion marker', async () => {
  const f = fixture(); await f.scope.hideMasterMessage('n1');
  f.table.role = 'player'; f.scope.renderConversationMessages();
  const html = f.node('#messageThread').innerHTML;
  assert.doesNotMatch(html, /A porta está aberta|apagada|excluída/);
  assert.match(html, /Você ouve passos/); assert.match(html, /Eu entro/);
  assert.equal(f.messages.length, 3);
});

test('Player messages and messages in a different table/conversation cannot be modified', async () => {
  const f = fixture(); await f.scope.hideMasterMessage('p1'); assert.equal(f.saves(), 0);
  const c = f.scope.masterMessageContext('n1'); f.scope.activeConversationId = 'other';
  assert.equal(f.scope.applyMasterMessageChange(c, { hidden: true }), false);
  f.scope.activeConversationId = 'c'; f.table.id = 'other';
  assert.equal(f.scope.applyMasterMessageChange(c, { hidden: true }), false);
});

test('Blank edits, canceled deletes, and failed local storage preserve all messages', async () => {
  const f = fixture(); f.scope.openEditMessage('n1'); f.node('#editMessageBody').value = '  ';
  f.scope.saveEditedMessage(); assert.equal(f.saves(), 0);
  f.scope.askConfirm = async () => false; await f.scope.hideMasterMessage('n1'); assert.equal(f.saves(), 0);
  f.failLocal(); assert.equal(f.scope.applyMasterMessageChange(f.scope.masterMessageContext('n1'), { hidden: true }), false);
  assert.deepEqual(clone(f.scope.data.messageOverrides), {});
  assert.equal(f.table.pendingMessageChanges, undefined);
});

test('Overrides survive normalization, ignore player messages, and do not cross conversations', () => {
  const f = fixture();
  f.scope.data.messageOverrides = { n1: { conversationId: 'other', hidden: true }, p1: { conversationId: 'c', hidden: true } };
  f.scope.data = f.scope.normalizeData(f.scope.data);
  f.scope.renderConversationMessages();
  assert.match(f.node('#messageThread').innerHTML, /A porta está aberta/);
  assert.match(f.node('#messageThread').innerHTML, /Eu entro/);
});

test('Player saves preserve remote master overrides and acknowledgements retain newer pending edits', () => {
  const f = fixture('player');
  f.scope.currentPlayerOwner = () => 'Ana';
  for (const name of ['mergeCharacterAnnotations','mergeOwnedCollection']) f.scope[name] = remote => remote;
  f.scope.mergePlayerProfiles = remote => remote;
  const remote = { messageOverrides: { n1: { conversationId: 'c', hidden: true } } };
  const forged = { messageOverrides: { n1: { conversationId: 'c', body: 'forged' } } };
  assert.deepEqual(clone(f.scope.mergePlayerWritableData(remote, forged).messageOverrides), remote.messageOverrides);
  const older = { n1: { conversationId: 'c', body: 'old', hidden: false } };
  f.table.pendingMessageChanges = { n1: { conversationId: 'c', body: 'new', hidden: false } };
  f.scope.acknowledgeMessageChanges(f.table, older);
  assert.equal(f.table.pendingMessageChanges.n1.body, 'new');
});

test('Cloud upload merges distinct master edits with the latest remote state and retains pending edits after failure', async () => {
  const f = fixture();
  const remote = { messageOverrides: { n2: { conversationId: 'c', body: 'Remote edit', hidden: false } } };
  let uploaded, fail = true;
  const client = { from() { return {
    select() { return this; }, eq() { return this; },
    async single() { return { data: { data: remote, updated_at: 'v1' } }; },
    update(value) { uploaded = value; return this; },
    async maybeSingle() { return fail ? { error: Error('offline') } : { data: { updated_at: 'v2' } }; }
  }; } };
  Object.assign(f.scope, { getSupabaseClient: () => client, getOnlineTableOrWarn: () => f.table,
    isSavingCloud: false, cloudChangeVersion: 1, cloudSaveTimer: null,
    window: { clearTimeout() {} }, console: { warn() {} }, saveTableRegistry() {}, setSupabaseStatus() {},
    mergePendingSessions: () => [], mergePersonalCharacterVersions: () => [], acknowledgePersonalCharacterVersions() {}, acknowledgeSessionChanges() {}
  });
  f.scope.applyMasterMessageChange(f.scope.masterMessageContext('n1'), { body: 'Local edit', hidden: false });
  await f.scope.saveOnlineTable();
  assert.equal(f.table.pendingCloudSave, true);
  assert.equal(f.table.pendingMessageChanges.n1.body, 'Local edit');
  fail = false;
  await f.scope.saveOnlineTable();
  assert.equal(uploaded.data.messageOverrides.n1.body, 'Local edit');
  assert.equal(uploaded.data.messageOverrides.n2.body, 'Remote edit');
  assert.equal(f.table.pendingCloudSave, false);
  assert.deepEqual(clone(f.table.pendingMessageChanges), {});
});
