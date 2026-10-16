const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4175/');
    await page.evaluate(() => createLocalTable('master', 'Temas'));
    await page.evaluate(() => selectView('settings'));
    await page.locator('input[name="appearance"][value="dark"]').check();
    assert.equal(await page.evaluate(() => localStorage.getItem('mesa-arcana-theme')), 'dark');
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    for (const theme of ['dark', 'light']) {
      await page.evaluate(() => selectView('settings'));
      await page.locator(`input[name="appearance"][value="${theme}"]`).check();
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        for (const view of ['dashboard', 'master', 'players', 'messages', 'board', 'library', 'settings']) {
          await page.evaluate(view => selectView(view), view);
          const leaks = await page.evaluate(() => [...document.querySelectorAll('main *, .modal-backdrop:not(.hidden) *')].filter(node => {
            const rect = node.getBoundingClientRect();
            if (rect.width < 80 || rect.height < 30 || !node.checkVisibility()) return false;
            const color = getComputedStyle(node).backgroundColor.match(/[\d.]+/g)?.map(Number);
            return document.documentElement.dataset.theme === 'dark' && color && color[3] > .5 && color.slice(0, 3).every(channel => channel > 200);
          }).map(node => node.className || node.tagName));
          assert.deepEqual(leaks, [], `${theme}/${width}/${view}: bright surfaces`);
          await page.screenshot({ path: `test-results/theme-${theme}-${width}-${view}.png`, fullPage: true });
        }
        await page.evaluate(() => { selectView('master'); openMasterNpcForm(); });
        await page.screenshot({ path: `test-results/theme-${theme}-${width}-npc-modal.png`, fullPage: true });
        await page.evaluate(() => closeMasterNpcForm());
        await page.evaluate(() => { selectView('players'); openCharacterModal(data.players[0].id); });
        await page.screenshot({ path: `test-results/theme-${theme}-${width}-character-modal.png`, fullPage: true });
        await page.evaluate(() => closeCharacterModal());
        await page.evaluate(() => selectView('library'));
        await page.locator('#openLibraryModal').click();
        await page.screenshot({ path: `test-results/theme-${theme}-${width}-world-modal.png`, fullPage: true });
        await page.locator('#cancelLibraryModal').click();
      }
    }
    await page.evaluate(() => selectView('settings'));
    await page.locator('input[name="appearance"][value="dark"]').check();
    const anotherTab = await context.newPage();
    await anotherTab.goto('http://127.0.0.1:4175/');
    assert.equal(await anotherTab.locator('html').getAttribute('data-theme'), 'dark');
    await page.locator('input[name="appearance"][value="light"]').check();
    await anotherTab.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.evaluate(() => {
      const player = createTableRecord('Jogador tema', 'player', data);
      tableRegistry.push(player);
      openTable(player.id);
      selectView('settings');
    });
    await page.locator('input[name="appearance"][value="dark"]').check();
    for (const view of ['dashboard', 'players', 'messages', 'board', 'library', 'settings']) {
      await page.evaluate(view => selectView(view), view);
      assert.equal(await page.locator('#view-' + view).isVisible(), true);
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    }
    assert.deepEqual(errors, []);
    console.log('Themes OK: persistence, tab sync, both themes at desktop/mobile widths, master/player screens and character/NPC/world dialogs.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
