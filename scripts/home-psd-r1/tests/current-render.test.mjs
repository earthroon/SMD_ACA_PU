import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { computed, createSSRApp, ref } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { homeFigmaText } from '../../../app/data/home-r2-copy.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const baselinePath = resolve(root, 'scripts/home-psd-r1/tests/fixtures/HomeFigmaText.vue');
const normalize = html => html
  .replace(/<!--.*?-->/g, '')
  .replace(/ data-(?:source-mode|psd-layers|psd-sha256)="[^"]*"/g, '')
  .replace(/<span([^>]*)>/g, (_, attrs) => {
    const entries = [...attrs.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)]
      .map(([, name, value]) => [name, value ?? '']).sort(([a], [b]) => a.localeCompare(b));
    return '<span' + entries.map(([name, value]) => ` ${name}="${value}"`).join('') + '>';
  });

test('all 76 current text nodes × 3 carousel captions retain baseline SSR text, styles and emphasis', async () => {
  const expected = JSON.parse(readFileSync(resolve(root, 'docs/migration/smd-home-psd-r1/source-lock.json'))).baselineRendererSha256;
  assert.equal(createHash('sha256').update(readFileSync(baselinePath)).digest('hex'), expected);
  const caption = ref(0);
  const previous = { computed: globalThis.computed, useState: globalThis.useState };
  globalThis.computed = computed;
  globalThis.useState = () => caption;
  const server = await createServer({ root, configFile: false, plugins: [vue()],
    resolve: { alias: { '~': resolve(root, 'app') } },
    server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const baseline = (await server.ssrLoadModule(baselinePath)).default;
    const current = (await server.ssrLoadModule(resolve(root, 'app/components/home/HomeFigmaText.vue'))).default;
    for (let slide = 0; slide < 3; slide++) {
      caption.value = slide;
      for (const key of Object.keys(homeFigmaText)) {
        const before = await renderToString(createSSRApp(baseline, { textKey: key }));
        const after = await renderToString(createSSRApp(current, { textKey: key }));
        assert.equal(normalize(after), normalize(before), `${key}, slide ${slide}`);
      }
    }
  } finally {
    await server.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
