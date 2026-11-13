/** Isolated component harness; creates no application route and publishes nothing. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const option = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const output = resolve(option('--out') ?? resolve(root, 'artifacts/home-psd-r1'));
mkdirSync(output, { recursive: true });
const fontPath = resolve(option('--font') ?? resolve(output, 'PretendardVariable.woff2'));
const fontUrl = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2';
const receipt = { schema: 'SMD_HOME_PSD_BROWSER_CONTRACT_V1', tier: 'RUNTIME', status: 'RUNNING',
  scope: 'Isolated HomeSourceText component; not full homepage or PSD pixel parity',
  fontUrl, checks: [], viewports: [], pixelParity: 'NOT_CLAIMED' };
let browser, server, temporary;
try {
  if (!existsSync(fontPath)) {
    const response = await fetch(fontUrl);
    if (!response.ok) throw new Error(`HOME_PSD_BROWSER_FONT_DOWNLOAD:${response.status}`);
    writeFileSync(fontPath, Buffer.from(await response.arrayBuffer()));
  }
  const font = readFileSync(fontPath);
  assert.equal(font.subarray(0, 4).toString(), 'wOF2');
  receipt.fontSha256 = createHash('sha256').update(font).digest('hex');
  temporary = mkdtempSync(resolve(root, '.home-psd-browser-'));
  const entry = `
    import { createApp, h, ref, nextTick } from 'vue';
    import HomeSourceText from ${JSON.stringify(resolve(root, 'app/components/home/HomeSourceText.vue'))};
    import ${JSON.stringify(resolve(root, 'app/assets/css/main.css'))};
    import ${JSON.stringify(resolve(root, 'app/assets/css/home-r2.css'))};
    const ids = ['110','2063','2066','241','242','469','125','153','1267'];
    const live = ref('110');
    window.homePsdContract = { setLayer(id) { live.value = id; }, nextTick };
    createApp({ setup: () => () => h('main', {class:'smd-home'}, [
      ...ids.map(id => h('article', {'data-case':id}, [h('small', id), h(HomeSourceText, {mode:'psd',layerId:id})])),
      h('article', {'data-case':'live'}, [h('small','live'),h(HomeSourceText,{mode:'psd',layerId:live.value})])
    ]) }).mount('#app');
  `;
  writeFileSync(resolve(temporary, 'entry.mjs'), entry);
  const harness = {
    name: 'home-psd-contract-harness',
    configureServer(vite) {
      vite.middlewares.use(async (request, response, next) => {
        if (request.url === '/font.woff2') {
          response.setHeader('content-type', 'font/woff2'); response.end(font); return;
        }
        if (request.url?.split('?')[0] !== '/') return next();
        const missing = request.url.includes('font=missing');
        const html = `<!doctype html><html><head><meta charset="UTF-8"><style>
          ${missing ? '' : '@font-face{font-family:"Pretendard Variable";src:url(/font.woff2);font-weight:45 920;font-style:normal}'}
          article{padding:24px;margin:16px;background:#d4d9e2;min-height:120px;overflow:visible}
          small{display:block;margin-bottom:20px;color:#222;font:14px monospace}
        </style></head><body><div id="app"></div><script type="module" src="/@fs${resolve(temporary, 'entry.mjs')}"></script></body></html>`;
        response.setHeader('content-type', 'text/html');
        response.end(await vite.transformIndexHtml('/', html));
      });
    },
  };
  server = await createServer({ root, configFile: false, plugins: [vue(), harness],
    resolve: { alias: { '~': resolve(root, 'app') } },
    server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  await server.listen();
  const port = server.httpServer.address().port;
  const executablePath = option('--chromium') ?? process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  receipt.browser = browser.version();
  for (const deviceScaleFactor of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => document.querySelectorAll('[data-text-gate="READY"]').length === 10);
    const data = await page.evaluate(() => {
      const first = document.querySelector('[data-case="2063"] .smd-home-source-text__paint text');
      const numeral = document.querySelector('[data-case="469"] .smd-home-source-text__paint text');
      const heading = document.querySelector('[data-case="242"] .smd-home-source-text__paint text');
      const matrix = document.querySelector('[data-case="110"] .smd-home-source-text__paint > g').getAttribute('transform');
      return { firstTransform: first.getAttribute('transform'), firstWeight: getComputedStyle(first).fontWeight,
        numeralStyle: getComputedStyle(numeral).fontStyle, headingWeight: getComputedStyle(heading).fontWeight,
        firstInk: getComputedStyle(first).fill, matrix,
        allFinite: [...document.querySelectorAll('.smd-home-source-text__paint text')].every(node => {
          const b = node.getBBox(); return [b.x,b.y,b.width,b.height].every(Number.isFinite) && b.width > 0 && b.height > 0;
        }) };
    });
    assert.match(data.firstTransform, /scale\(0\.97 1\)/);
    assert.equal(data.firstWeight, '700');
    assert.match(data.numeralStyle, /oblique/);
    assert.equal(data.headingWeight, '800');
    assert.equal(data.firstInk, 'rgb(50, 50, 50)');
    assert.match(data.matrix, /1138\.4379615683551 1260\.082108484734/);
    assert.equal(data.allFinite, true);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: resolve(output, `source-text-dpr-${deviceScaleFactor}.png`), fullPage: true });
    receipt.viewports.push({ width: 1200, height: 1000, deviceScaleFactor, ...data });
    // Delayed old-font work must not commit after the source layer changes.
    await page.evaluate(async () => {
      const original = document.fonts.load.bind(document.fonts);
      const delayed = [];
      document.fonts.load = (...args) => new Promise((ok, fail) => delayed.push(() => original(...args).then(ok, fail)));
      window.homePsdContract.setLayer('125');
      await window.homePsdContract.nextTick();
      await new Promise(requestAnimationFrame);
      window.homePsdContract.setLayer('242');
      await window.homePsdContract.nextTick();
      await new Promise(requestAnimationFrame);
      document.fonts.load = original;
      delayed.reverse().forEach(release => release());
    });
    await page.waitForFunction(() => document.querySelector('[data-case="live"] [data-text-gate]')?.getAttribute('data-text-gate') === 'READY'
      && document.querySelector('[data-case="live"] [data-psd-layers]')?.getAttribute('data-psd-layers') === '242');
    assert.equal(await page.locator('[data-case="live"] .smd-home-source-text__paint text').allTextContents().then(a => a.join('')), '제공할 수 있는 4가지');
    await context.close();
  }
  receipt.checks.push('DPR 1/2: source transform, mixed weights, 97% horizontal scale, faux italic, color and finite SVG ink', 'Stale asynchronous font measurement rejected on source change');
  const missingContext = await browser.newContext();
  const missingPage = await missingContext.newPage();
  await missingPage.goto(`http://127.0.0.1:${port}/?font=missing`);
  await missingPage.waitForFunction(() => document.querySelectorAll('[data-text-gate="ERROR"]').length === 10);
  assert.equal(await missingPage.locator('.smd-home-source-text__paint text').count(), 0);
  assert.match(await missingPage.locator('[role="alert"]').first().textContent(), /PRETENDARD_NOT_LOADED/);
  receipt.checks.push('Missing Pretendard emits explicit error and paints no fallback glyphs');
  await missingContext.close();
  receipt.status = 'PASS';
} catch (error) {
  receipt.status = 'FAIL';
  receipt.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
  if (temporary) rmSync(temporary, { recursive: true, force: true });
  writeFileSync(resolve(output, 'browser-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
}
