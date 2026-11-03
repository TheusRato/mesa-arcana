import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture(role = 'master') {
  const table = { id: 'local-table', onlineId: 'cloud-table', role };
  const group = { id: 'existing-group', name: 'Os cabaços', npcIds: ['isaac'], playerNames: ['Ana', 'Bia'] };
  const elements = new Map();
  let selected = [], saves = 0, loads = 0;
  const node = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', attributes: {}, hidden: true,
      classList: { add() {}, remove() {}, toggle(name, value) { node(id).hidden = value; } },
      setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this.attributes[key]; }, focus() {} });
    return elements.get(id);
  };
  const scope = vm.createContext({ data: { messageGroups: [group], players: [
    { id: 'isaac', kind: 'NPC', character: 'Isaac' }, { id: 'marcos', kind: 'NPC', character: 'Marcos' }
  ] }, getActiveTable: () => table, safeList: value => Array.isArray(value) ? value : [],
    playerSheetProfiles: () => [{ name: 'Ana' }, { name: 'Bia' }, { name: 'Cris' }],
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'),
    contactAllowedForPlayer: () => true, playerNamesForTarget: () => ['Ana'], currentPlayerOwner: () => 'Ana', activeMasterPlayerName: '', activeMessageTargetId: 'group:existing-group:Ana', activeMessageNpc: group.name,
    save: () => saves++, empty: message => message,
    document: { querySelector: node, querySelectorAll: () => selected },
    // Any accidental cloud writes from membership actions must fail this test.
    getSupabaseClient: () => { throw new Error('Membership must not write conversation or message records'); }
  });
  vm.runInContext(fs.readFileSync(new URL('../src/js/features/messages.js', import.meta.url), 'utf8'), scope);
  scope.renderMessagesView = () => {};
  scope.loadConversationMessages = () => loads++;
  scope.syncParticipantsFromCloud = async () => false;
  scope.openGroupDetails();
  return { scope, table, group, node, setSelected: value => selected = value, saves: () => saves, loads: () => loads };
}

test('Players can inspect NPC and player members but cannot mutate membership', async () => {
  const f = fixture('player');
  const before = JSON.stringify(f.group);
  assert.match(f.node('#groupMembersList').innerHTML, /Isaac/);
  assert.match(f.node('#groupMembersList').innerHTML, /Ana/);
  assert.match(f.node('#groupMembersList').innerHTML, /Bia/);
  assert.doesNotMatch(f.node('#groupMembersList').innerHTML, /data-remove-group-member/);
  assert.equal(f.node('#groupMemberControls').hidden, true);
  f.scope.removeGroupMember('npc', 'isaac');
  f.setSelected([{ value: 'marcos', dataset: { memberType: 'npc' } }]);
  f.scope.addSelectedGroupPeople();
  await f.scope.openAddGroupPeople();
  assert.equal(JSON.stringify(f.group), before);
  assert.equal(f.saves(), 0);
});

test('Master adds only available people, deduplicates, and retains the existing conversation keys', async () => {
  const f = fixture();
  const keys = Array.from(f.scope.getMasterMessageTargets().filter(t => t.type === 'group'), t => t.conversationKey);
  await f.scope.openAddGroupPeople();
  assert.match(f.node('#groupAvailablePeople').innerHTML, /Marcos/);
  assert.match(f.node('#groupAvailablePeople').innerHTML, /Cris/);
  assert.doesNotMatch(f.node('#groupAvailablePeople').innerHTML, /Isaac/);
  f.setSelected([
    { value: 'marcos', dataset: { memberType: 'npc' } },
    { value: 'marcos', dataset: { memberType: 'npc' } },
    { value: 'Cris', dataset: { memberType: 'player' } },
    { value: 'unknown', dataset: { memberType: 'player' } }
  ]);
  f.scope.addSelectedGroupPeople();
  assert.equal(f.group.id, 'existing-group');
  assert.deepEqual(Array.from(f.group.npcIds), ['isaac', 'marcos']);
  assert.deepEqual(Array.from(f.group.playerNames), ['Ana', 'Bia', 'Cris']);
  const after = Array.from(f.scope.getMasterMessageTargets().filter(t => t.type === 'group'), t => t.conversationKey);
  for (const key of keys) assert.ok(after.includes(key));
  assert.equal(f.saves(), 1);
  assert.equal(f.loads(), 1);
});

test('Removing and readding a member restores the same history route and never deletes a group', () => {
  const f = fixture();
  f.scope.removeGroupMember('player', 'Ana');
  assert.deepEqual(Array.from(f.group.playerNames), ['Bia']);
  assert.deepEqual(Array.from(f.group.npcIds), ['isaac']);
  f.scope.removeGroupMember('npc', 'isaac');
  assert.equal(f.group.npcIds.length, 0);
  assert.equal(f.scope.data.messageGroups[0], f.group);
  f.setSelected([{ value: 'Ana', dataset: { memberType: 'player' } }, { value: 'isaac', dataset: { memberType: 'npc' } }]);
  f.scope.addSelectedGroupPeople();
  assert.ok(f.scope.getMasterMessageTargets().some(t => t.conversationKey === 'group:existing-group:Ana'));
  assert.equal(f.group.name, 'Os cabaços');
});

test('An open membership screen cannot modify a different table after switching', () => {
  const f = fixture();
  f.table.id = 'different-table';
  f.scope.removeGroupMember('npc', 'isaac');
  assert.equal(f.saves(), 0);
  assert.deepEqual(Array.from(f.group.npcIds), ['isaac']);
});

test('Only group headers expose an accessible button', () => {
  const f = fixture();
  f.scope.configureGroupHeader({ type: 'group', npcName: 'Grupo' });
  assert.equal(f.node('#messageGroupHeader').attributes.role, 'button');
  assert.equal(f.node('#messageGroupHeader').attributes.tabindex, '0');
  f.scope.configureGroupHeader({ type: 'npc' });
  assert.equal(f.node('#messageGroupHeader').attributes.role, undefined);
});
