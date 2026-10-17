import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { recipientsForMessage, validPushEndpoint, legacyHash } from '../supabase/functions/mesa-push/routing.mjs';

const table = { players: [{ id: 'npc1', kind: 'NPC' }], allowedContacts: [{ targetId: 'npc1', playerName: 'Ana' }], messageGroups: [{ id: 'g', playerNames: ['Ana'] }] };
const subscriptions = [{ id: 'm', role: 'master' }, { id: 'a', role: 'player', player_name: 'Ana' }, { id: 'b', role: 'player', player_name: 'Bia' }];
const conversation = { table_id: 't', npc_name: 'npc:npc1:Ana' };
test('Private message routes only to its recipient, never another player or sender', () => {
  assert.deepEqual(recipientsForMessage({ table_id: 't', sender_role: 'npc' }, conversation, table, subscriptions).map(item => item.id), ['a']);
  assert.deepEqual(recipientsForMessage({ table_id: 't', sender_role: 'player', sender_name: 'Ana' }, conversation, table, subscriptions).map(item => item.id), ['m']);
  assert.deepEqual(recipientsForMessage({ table_id: 'other', sender_role: 'npc' }, conversation, table, subscriptions), []);
  assert.deepEqual(recipientsForMessage({ table_id: 't', sender_role: 'player', sender_name: 'Bia' }, conversation, table, subscriptions), []);
  assert.deepEqual(recipientsForMessage({ table_id: 't', sender_role: 'npc' }, conversation, { ...table, allowedContacts: [] }, subscriptions), []);
});
test('Group deliveries follow the conversation participant', () => {
  assert.deepEqual(recipientsForMessage({ table_id: 't', sender_role: 'npc' }, { ...conversation, npc_name: 'group:g:Ana' }, table, subscriptions).map(item => item.id), ['a']);
  assert.deepEqual(recipientsForMessage({ table_id: 't', sender_role: 'npc' }, { ...conversation, npc_name: 'group:g:Bia' }, table, subscriptions), []);
});
test('Push destination validation rejects local and untrusted endpoints', () => {
  for (const endpoint of ['https://fcm.googleapis.com/send/1', 'https://web.push.apple.com/a', 'https://db5.notify.windows.com/a']) assert.equal(validPushEndpoint(endpoint), true);
  for (const endpoint of ['http://fcm.googleapis.com/a', 'https://127.0.0.1/a', 'https://fcm.googleapis.com.evil.test/a', 'https://user@fcm.googleapis.com/a', 'https://fcm.googleapis.com:999/a']) assert.equal(validPushEndpoint(endpoint), false);
  assert.equal(legacyHash('1234'), 'fallback-fdc422fd');
});
test('Service worker displays sender and text and opens a scoped conversation URL', async () => {
  const handlers = {}; let shown; let opened;
  const scope = vm.createContext({ URL, Date, self: {
    addEventListener: (name, handler) => handlers[name] = handler,
    registration: { scope: 'https://site.test/mesa-arcana/', showNotification: async (title, options) => { shown = { title, options }; } },
    clients: { matchAll: async () => [], openWindow: async url => { opened = url; } }
  } });
  vm.runInContext(fs.readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8'), scope);
  let pending;
  handlers.push({ data: { json: () => ({ sender: 'Samira', body: 'Encontre-me na escola.', tableId: 't', conversationKey: 'npc:npc1:Ana', messageId: '1' }) }, waitUntil: promise => pending = promise });
  await pending;
  assert.equal(shown.title, 'Samira');
  assert.equal(shown.options.body, 'Encontre-me na escola.');
  handlers.notificationclick({ notification: { close() {}, data: shown.options.data }, waitUntil: promise => pending = promise });
  await pending;
  assert.equal(new URL(opened).pathname, '/mesa-arcana/');
  assert.equal(new URL(opened).searchParams.get('pushConversation'), 'npc:npc1:Ana');
});

function masterActivationFixture(masterKey = '') {
  const listeners = {};
  const nodes = new Map();
  const saved = new Map();
  let prompts = 0;
  let saves = 0;
  const table = { role: 'master', onlineId: 'table', masterKey };
  const element = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { disabled: false, textContent: '', classList: { toggle() {} }, addEventListener: (event, callback) => listeners[selector] = callback });
    return nodes.get(selector);
  };
  const scope = vm.createContext({
    document: { querySelector: element },
    window: { isSecureContext: true, Notification: {}, PushManager: {} },
    Notification: { permission: 'granted', requestPermission: async () => 'granted' },
    navigator: { serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription: async () => ({ toJSON: () => ({ endpoint: 'test' }) }) } }) } },
    getActiveTable: () => table, supabaseConfig: { url: 'https://project.test', key: 'public' },
    readLocalValue: key => saved.get(key), writeLocalValue: (key, value) => saved.set(key, value),
    askInput: async () => { prompts++; return 'mestre-confirmado'; },
    saveTableRegistry: () => saves++, atob, Uint8Array
  });
  vm.runInContext(fs.readFileSync(new URL('../src/js/features/notifications.js', import.meta.url), 'utf8'), scope);
  return { scope, table, listeners, element, saved, prompts: () => prompts, saves: () => saves };
}

test('Master without a local key is prompted and activation saves the validated key', async () => {
  const fixture = masterActivationFixture();
  fixture.scope.callPushService = async input => {
    if (input.action === 'config') return { publicKey: 'AQ' };
    assert.equal(input.secret, 'mestre-confirmado');
    return { token: 'revoke-token' };
  };
  await fixture.listeners['#enablePush']();
  assert.equal(fixture.prompts(), 1);
  assert.equal(fixture.table.masterKey, 'mestre-confirmado');
  assert.equal(fixture.saves(), 1);
  assert.equal(fixture.saved.size, 1);
  assert.match(fixture.element('#pushStatus').textContent, /ativadas/);
});

test('Master with an outdated key can confirm a current key and retry', async () => {
  const fixture = masterActivationFixture('old-key');
  fixture.scope.callPushService = async input => {
    if (input.action === 'config') return { publicKey: 'AQ' };
    if (input.secret === 'old-key') { const error = new Error('Chave incorreta'); error.status = 403; throw error; }
    return { token: 'revoke-token' };
  };
  await fixture.listeners['#enablePush']();
  assert.equal(fixture.prompts(), 1);
  assert.equal(fixture.table.masterKey, 'mestre-confirmado');
  assert.match(fixture.element('#pushStatus').textContent, /ativadas/);
});

test('Activation failure remains visible after the interface refreshes', async () => {
  const fixture = masterActivationFixture('key');
  fixture.scope.callPushService = async () => { throw new Error('Falha de teste'); };
  await fixture.listeners['#enablePush']();
  fixture.scope.renderPushSettings();
  assert.equal(fixture.element('#pushStatus').textContent, 'Falha de teste');
  assert.equal(fixture.element('#enablePush').disabled, false);
});
