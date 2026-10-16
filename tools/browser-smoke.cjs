const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Exercise Pages-style subfolder hosting using the same local static files.
  await page.route('**/mesa-arcana/**', async route => {
    const url = new URL(route.request().url());
    url.pathname = url.pathname.replace('/mesa-arcana/', '/');
    const response = await route.fetch({ url: url.href });
    await route.fulfill({ response });
  });
  await page.goto('http://127.0.0.1:4175/mesa-arcana/');
  await page.waitForFunction(() => typeof initializeApp === 'function');
  await page.evaluate(() => createLocalTable('master', 'Revisao local'));
  for (const view of ['dashboard', 'master', 'players', 'messages', 'board', 'library', 'settings']) {
    await page.evaluate(view => selectView(view), view);
    assert.equal(await page.locator('#view-' + view).isVisible(), true, view);
  }
  await page.evaluate(() => selectView('master'));
  for (const section of ['secrets', 'locations', 'clues', 'next']) {
    await page.locator(`[data-master-tab="${section}"]`).click();
    await page.locator('#openMasterClue').click();
    await page.locator('#masterClueName').fill('Teste ' + section);
    await page.locator('#masterClueBody').fill('Conteudo de revisao');
    await page.locator('#saveMasterClue').click();
    await page.locator('#masterList [data-edit-master-note]').first().click();
    assert.equal(await page.locator('#masterClueName').inputValue(), 'Teste ' + section);
    await page.locator('#cancelMasterClue').click();
  }
  await page.locator('[data-master-tab="npcs"]').click();
  await page.locator('#openMasterNpcForm').click();
  await page.locator('#masterNpcName').fill('NPC planejado');
  await page.locator('#addMasterNpc').click();
  await page.locator('[data-open-planned-npc]').first().click();
  assert.equal(await page.locator('#plannedNpcTitle').textContent(), 'NPC planejado');
  await page.locator('#closePlannedNpc').click();
  await page.evaluate(() => selectView('library'));
  await page.locator('#openLibraryModal').click();
  await page.locator('#libraryTitle').fill('Mapa de revisao');
  await page.locator('#libraryBody').fill('Detalhes do mapa');
  await page.locator('#libraryCover').setInputFiles({
    name: 'mapa.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGZkAAAAASUVORK5CYII=', 'base64')
  });
  await page.locator('#addLibrary').click();
  assert.equal(await page.locator('#libraryModal').isVisible(), false);
  await page.locator('#librarySearch').fill('Mapa de revisao');
  assert.equal(await page.locator('#libraryList .library-card').count(), 1);
  await page.locator('#libraryList [data-open-world-image]').click();
  assert.equal(await page.locator('#playerFileViewTitle').textContent(), 'Mapa de revisao');
  await page.evaluate(() => closePlayerFileView());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#openLibraryModal').click();
  assert.equal(await page.locator('#libraryTitle').inputValue(), '');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#cancelLibraryModal').click();
  await page.locator('#librarySearch').fill('');
  await page.locator('#mobileMoreToggle').click();
  assert.equal(await page.locator('#mobileMoreMenu button').count(), 3);
  await page.locator('#mobileMoreMenu button').filter({ hasText: 'Escudo do Mestre' }).click();
  assert.equal(await page.locator('#view-master').isVisible(), true);
  assert.equal(await page.locator('#mobileMoreMenu').isVisible(), false);
  const navLayout = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.nav > button, .nav > .nav-player-menu, .nav > .mobile-more-container')].filter(node => node.getBoundingClientRect().width > 0);
    return { count: nodes.length, tops: nodes.map(node => Math.round(node.getBoundingClientRect().top)) };
  });
  assert.equal(navLayout.count, 5);
  assert.equal(new Set(navLayout.tops).size, 1);
  await page.screenshot({ path: 'test-results/mobile-navigation.png', fullPage: true });
  await page.evaluate(() => {
    const table = createTableRecord('Jogador teste', 'player', data);
    tableRegistry.push(table);
    openTable(table.id);
  });
  assert.equal(await page.evaluate(() => data.masterNotes.length), 0);
  await page.locator('#mobileMoreToggle').click();
  assert.equal(await page.locator('#mobileMoreMenu button').count(), 2);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const view of ['dashboard', 'players', 'messages', 'board', 'library', 'settings']) {
    await page.evaluate(view => selectView(view), view);
    assert.equal(await page.locator('#view-' + view).isVisible(), true);
  }
  assert.deepEqual(errors, []);
  console.log('Browser OK: subfolder assets, desktop/mobile navigation, note create/edit, planned NPC, player privacy, world modal/upload/search/image viewer.');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
