/* Shared DOM-only smoke test for the upstream mobile layout editor. */
module.exports = async function layoutSmoke(page, check, snap) {
  await page.locator('#set-tabs [data-t="ctl"]').click();
  await page.locator('#set-layout').click();
  await page.waitForFunction(() => document.querySelector('#scr-layout h3')?.textContent === '將按鈕拖曳到想要的位置');
  const text = await page.locator('#scr-layout').innerText();
  check('mobile layout editor labels are translated', ['攻擊', '搖桿', '浮動', '固定', '重設', '儲存'].every(s => text.includes(s)));
  await page.locator('#lay-mode [data-m="fixed"]').click();
  const pause = await page.locator('.lay-pause').boundingBox();
  await page.mouse.move(pause.x + 20, pause.y + 20);
  await page.mouse.down(); await page.mouse.move(pause.x - 60, pause.y + 70, { steps: 5 }); await page.mouse.up();
  await snap('mobile-layout');
  await page.locator('#lay-save').click();
  const settings = () => page.evaluate(() => JSON.parse(localStorage.getItem('ps.settings')));
  const saved = await settings();
  check('translated layout saves dragged position and fixed joystick', saved.stickMode === 'fixed' && saved.pad.pause[0] < (pause.x + 20) / 844);
  await page.locator('#set-layout').click();
  check('layout reopens with saved fixed joystick', await page.locator('#lay-mode [data-m="fixed"]').evaluate(el => el.classList.contains('on')));
  await page.locator('#lay-reset').click();
  await page.locator('#lay-cancel').click();
  check('cancelling layout reset preserves saved controls', JSON.stringify(saved) === JSON.stringify(await settings()));
};
