import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture(data) {
  const scope = vm.createContext({ data, safeList: value => Array.isArray(value) ? value : [], createId: () => 'id', activeCharacterId: null, activePlayerRelationId: null, save() {} });
  for (const file of ['src/js/core/storage-and-vault.js', 'src/js/features/characters-and-player.js']) vm.runInContext(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), scope);
  scope.save = () => {};
  return scope;
}

test('Old orphan sample profile is hidden without deleting real players or files', () => {
  const data = { players: [], playerProfiles: [{ name: 'Personagem a definir', cover: 'retained-image' }, { name: 'Angelina Damasco', pinHash: 'pin' }], playerFiles: [{ owner: 'Angelina Damasco' }] };
  const scope = fixture(data);
  assert.deepEqual(Array.from(scope.playerSheetProfiles(), profile => profile.name), ['Angelina Damasco']);
  assert.equal(data.playerProfiles.length, 2);
  assert.equal(data.playerProfiles[0].cover, 'retained-image');
  assert.equal(data.playerFiles.length, 1);
});

test('Deleting a player hides their selection and participant synchronization cannot revive it', () => {
  const data = { players: [{ id: 'a', kind: 'Jogador', character: 'Ana', name: 'Pessoa A' }], playerProfiles: [{ name: 'Ana', pinHash: 'pin' }, { name: 'Bia', pinHash: 'other' }] };
  const scope = fixture(data);
  scope.removeFrom('players', 'a');
  assert.deepEqual(Array.from(scope.playerSheetProfiles(), profile => profile.name), ['Bia']);
  scope.mergePlayerProfileNames(['Ana', 'Pessoa A']);
  assert.deepEqual(Array.from(scope.playerSheetProfiles(), profile => profile.name), ['Bia']);
  assert.equal(data.playerProfiles.length, 2);
});

test('A sample still linked to a character remains visible; NPC deletion leaves player profiles alone', () => {
  const data = { players: [{ id: 'a', kind: 'Jogador', character: 'Personagem a definir' }, { id: 'n', kind: 'NPC', character: 'Samira' }], playerProfiles: [{ name: 'Personagem a definir' }] };
  const scope = fixture(data);
  scope.removeFrom('players', 'n');
  assert.equal(scope.playerSheetProfiles().length, 1);
  assert.equal(data.hiddenPlayerProfiles, undefined);
});
