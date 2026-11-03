import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/js/features/messages.js', import.meta.url), 'utf8');
function fixture() {
  const table = { id: 'local', onlineId: 'online' };
  let active = table, calls = [], renders = 0, fail = false;
  const rows = [
    { npc_name: 'npc:n1:Ana', mesa_arcana_messages: [{ id: 'm1' }] },
    { npc_name: 'npc:n2:Ana', mesa_arcana_messages: [] },
    { npc_name: 'npc:n2:Bia', mesa_arcana_messages: [{ id: 'm2' }] }
  ];
  const client = { from(name) {
    calls.push(name);
    return { select() { return this; }, limit() { return this; }, eq() { return this; }, order() { return this; },
      async range() { return fail ? { error: Error('offline') } : { data: rows }; }
    };
  } };
  const scope = vm.createContext({ getActiveTable: () => active, getSupabaseClient: () => client, Date,
    safeList: v => Array.isArray(v) ? v : [], console: { warn() {} }
  });
  vm.runInContext(source, scope);
  scope.renderMessagesView = () => renders++;
  return { scope, table, calls, rows, renders: () => renders, fail: () => fail = true, switchTable: () => active = { id: 'other', onlineId: 'elsewhere' } };
}
const targets = [
  { id: 'empty', type: 'npc', conversationKey: 'npc:n2:Ana' },
  { id: 'known', type: 'npc', conversationKey: 'npc:n1:Ana' },
  { id: 'group', type: 'group', conversationKey: 'group:g:Ana' }
];

test('Groups appear first, contacts with real history second, and empty contacts last', async () => {
  const f = fixture(); await f.scope.syncMessageHistory();
  assert.deepEqual(Array.from(f.scope.orderedMessageTargets(targets, f.table), t => t.id), ['group', 'known', 'empty']);
  assert.deepEqual(targets.map(t => t.id), ['empty', 'known', 'group']);
  assert.equal(f.renders(), 1);
  assert.deepEqual(f.calls, ['mesa_arcana_conversations']);
});

test('History is isolated per player conversation and per table; new messages promote contacts', async () => {
  const f = fixture(); await f.scope.syncMessageHistory();
  assert.equal(f.scope.messageTargetRank(targets[0], f.table), 2);
  assert.equal(f.scope.messageTargetRank({ type: 'npc', conversationKey: 'npc:n2:Bia' }, f.table), 1);
  const other = { id: 'other', onlineId: 'elsewhere' };
  assert.equal(f.scope.messageTargetRank(targets[1], other), 2);
  f.scope.rememberMessageHistory(f.table, 'npc:n2:Ana');
  assert.equal(f.scope.messageTargetRank(targets[0], f.table), 1);
});

test('A failed history request retains known contacts and still keeps groups first', async () => {
  const f = fixture(); f.scope.rememberMessageHistory(f.table, 'npc:n1:Ana'); f.fail();
  await f.scope.syncMessageHistory();
  assert.deepEqual(Array.from(f.scope.orderedMessageTargets(targets, f.table), t => t.id), ['group', 'known', 'empty']);
});

test('Repeated renders reuse the history request instead of fetching again', async () => {
  const f = fixture(); await Promise.all([f.scope.syncMessageHistory(), f.scope.syncMessageHistory()]);
  await f.scope.syncMessageHistory();
  assert.equal(f.calls.length, 1);
});
