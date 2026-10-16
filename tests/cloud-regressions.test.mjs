import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
test('Player uploads portrait and sheet only for their own character', () => {
  const scope = vm.createContext({ safeList: value => value || [], currentPlayerOwner: () => 'Ana', createId: () => 'id' });
  vm.runInContext(read('src/js/services/cloud.js'), scope);
  const remote = [{ id: 'a', kind: 'Jogador', character: 'Ana', cover: 'old', sheetImage: 'old-sheet' }, { id: 'b', kind: 'Jogador', character: 'Bia', cover: 'bia' }, { id: 'n', kind: 'NPC', character: 'Ana', cover: 'npc' }];
  const local = remote.map(character => ({ ...character, cover: 'new', sheetImage: 'new-sheet', playerAnnotations: { Ana: 'note' } }));
  const merged = scope.mergeCharacterAnnotations(remote, local, 'Ana');
  assert.equal(merged[0].cover, 'new');
  assert.equal(merged[0].sheetImage, 'new-sheet');
  assert.equal(merged[1].cover, 'bia');
  assert.equal(merged[2].cover, 'npc');
  const profiles = scope.mergePlayerProfiles([{ name: 'Ana', cover: 'old' }, { name: 'Bia', cover: 'remote-bia' }], [{ name: 'Ana', cover: 'new' }, { name: 'Bia', cover: 'stale-bia' }]);
  assert.equal(profiles.find(profile => profile.name === 'Ana').cover, 'new');
  assert.equal(profiles.find(profile => profile.name === 'Bia').cover, 'remote-bia');
});

test('Offline worker never intercepts cloud reads and does not serve HTML for failed assets', async () => {
  const handlers = {};
  let calls = 0;
  const cache = new Map();
  const scope = vm.createContext({
    URL,
    self: { location: { origin: 'https://example.com' }, registration: { scope: 'https://example.com/mesa-arcana/' }, addEventListener: (name, callback) => handlers[name] = callback },
    caches: { open: async () => ({ match: async request => cache.get(request.url), put: async (request, response) => cache.set(request.url, response) }) },
    fetch: async () => { calls++; return new Response('fresh', { status: 200 }); }
  });
  vm.runInContext(read('public/service-worker.js'), scope);
  let response;
  const event = url => ({ request: new Request(url), respondWith: promise => response = promise });
  handlers.fetch(event('https://project.supabase.co/rest/v1/mesa_arcana_tables'));
  assert.equal(response, undefined);
  handlers.fetch(event('https://example.com/mesa-arcana/not-an-asset'));
  assert.equal(response, undefined);
  const asset = 'https://example.com/mesa-arcana/assets/app.js';
  cache.set(asset, new Response('stale'));
  handlers.fetch(event(asset));
  assert.equal(await (await response).text(), 'fresh');
  assert.equal(calls, 1);
  scope.fetch = async () => { throw new Error('offline'); };
  handlers.fetch(event(asset));
  assert.equal(await (await response).text(), 'fresh');
  handlers.fetch(event('https://example.com/mesa-arcana/assets/theme.js'));
  await assert.rejects(response, /offline/);
});
