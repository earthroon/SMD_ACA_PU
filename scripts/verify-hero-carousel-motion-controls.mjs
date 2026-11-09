/** R1E PHYSICAL browser harness for real Nuxt hydration + animated controls.
 * Requires the local dev server and Playwright with Chromium already installed.
 */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch (error) {
  console.error('HERO_R1E_PLAYWRIGHT_UNAVAILABLE', String(error));
  process.exit(2);
}
const url = process.env.SMD_VERIFY_URL || 'http://127.0.0.1:3129/';
const browser = await chromium.launch({ headless: true });
const receipt = { contract: 'SMD-HOME-HERO-CAROUSEL-R1E-MOTION-CONTROLS', url, status: 'UNKNOWN' };
const rootSelector = '.smd-hero-carousel[data-hero-owner="active"]';
const currentIndex = async page => Number(await page.locator(rootSelector).getAttribute('data-hero-selected-index'));
async function beginSampling(page) {
  await page.evaluate(selector => {
    const root = document.querySelector(selector);
    const container = root?.querySelector('.smd-hero-carousel__container');
    if (!container) throw new Error('HERO_R1E_CONTAINER_MISSING');
    globalThis.__smdHeroMotionObserver?.disconnect();
    globalThis.__smdHeroSamples = [];
    const samples = globalThis.__smdHeroSamples;
    const observer = new MutationObserver(() => samples.push(container.style.transform));
    observer.observe(container, { attributes: true, attributeFilter: ['style'] });
    globalThis.__smdHeroMotionObserver = observer;
  }, rootSelector);
}
async function endSampling(page) {
  return page.evaluate(() => {
    globalThis.__smdHeroMotionObserver?.disconnect();
    return new Set(globalThis.__smdHeroSamples || []).size;
  });
}
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
try {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator(rootSelector).waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForFunction(selector => {
    const root = document.querySelector(selector);
    return root?.dataset.heroReady === 'true';
  }, rootSelector, { timeout: 20000 });
  const carousel = page.locator(rootSelector);
  assert.equal(await carousel.getAttribute('data-hero-delay-ms'), '3000');
  const previous = carousel.locator('[data-hero-carousel-action="previous"]');
  const next = carousel.locator('[data-hero-carousel-action="next"]');
  assert.equal(await previous.count(), 1);
  assert.equal(await next.count(), 1);
  assert.equal(await previous.getAttribute('aria-label'), '이전 이미지');
  assert.equal(await next.getAttribute('aria-label'), '다음 이미지');
  assert.ok(await previous.isEnabled());
  assert.ok(await next.isEnabled());
  const originalIndex = await currentIndex(page);
  await beginSampling(page);
  await next.click();
  await page.waitForFunction(({ selector, expected }) =>
    Number(document.querySelector(selector)?.dataset.heroSelectedIndex) === expected,
  { selector: rootSelector, expected: (originalIndex + 1) % 3 }, { timeout: 3000 });
  await page.waitForTimeout(900);
  const manualFrames = await endSampling(page);
  assert.ok(manualFrames >= 3, `HERO_R1E_MANUAL_TRANSITION_INSTANT samples=${manualFrames}`);
  await previous.click();
  await page.waitForFunction(({ selector, expected }) =>
    Number(document.querySelector(selector)?.dataset.heroSelectedIndex) === expected,
  { selector: rootSelector, expected: originalIndex }, { timeout: 3000 });
  await page.waitForTimeout(900);
  // Leaving the buttons must resume 3000ms autoplay instead of trapping focus forever.
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(150); // allow Vue hover/focus state to settle
  const beforeAuto = await currentIndex(page);
  await beginSampling(page);
  const start = performance.now();
  await page.waitForFunction(({ selector, initial }) =>
    Number(document.querySelector(selector)?.dataset.heroSelectedIndex) !== initial,
  { selector: rootSelector, initial: beforeAuto }, { timeout: 5500, polling: 50 });
  const autoWaitMs = Math.round(performance.now() - start);
  await page.waitForTimeout(900);
  const autoFrames = await endSampling(page);
  assert.ok(autoWaitMs >= 2300 && autoWaitMs <= 5300,
    `HERO_R1E_AUTOPLAY_DELAY_OUT_OF_RANGE: ${autoWaitMs}`);
  assert.ok(autoFrames >= 3, `HERO_R1E_AUTOPLAY_INSTANT samples=${autoFrames}`);
  Object.assign(receipt, { status: 'PASS', manualFrames, autoFrames, autoWaitMs,
    originalIndex, afterAuto: await currentIndex(page) });
  console.log('PASS_SMD_HOME_HERO_R1E_PHYSICAL', JSON.stringify(receipt));
} catch (error) {
  Object.assign(receipt, { status: 'FAIL', error: String(error?.stack ?? error) });
  throw error;
} finally {
  writeFileSync('hero-carousel-r1e-browser-receipt.json', JSON.stringify(receipt, null, 2));
  await context.close();
  await browser.close();
}
