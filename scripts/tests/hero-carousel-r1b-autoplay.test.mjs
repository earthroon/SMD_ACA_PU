/** R1B: Embla 8.6 active=false plugin initialization regression.
 * Executes the actual syncAutoplay/onReInit bodies extracted from the Vue SFC
 * with mocked Embla API lifecycles. Not a browser or physical execution test.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const source=readFileSync(resolve(root,'app/components/home/HomeHeroCarousel.vue'),'utf8');
const take=(start,end)=>{
  const i=source.indexOf(start), j=source.indexOf(end,i+start.length);
  assert.ok(i>=0&&j>i,`HERO_CAROUSEL_RUNTIME_EXTRACT_FAILED: ${start}`);
  return source.slice(i,j);
};
const sync=take('function syncAutoplay(): void {','function onSelected(').replace('function syncAutoplay(): void {','function syncAutoplay() {');
const reinit=take('function onReInit(api: EmblaInstance): void {','watch(emblaApi,')
  .replace('function onReInit(api: EmblaInstance): void {','function onReInit(api) {');

function harness({pluginPresent=false,canPlay=true,owner=true,lease=null,apiPresent=true,playing=false}={}){
  const trace=[];
  let isPlaying=playing;
  const autoplay={
    isPlaying:()=>isPlaying,
    play:(restart)=>{trace.push(['play',restart]);isPlaying=true;},
    stop:()=>{trace.push(['stop']);isPlaying=false;},
  };
  const api=apiPresent?{plugins:()=>pluginPresent?{autoplay}:undefined}:undefined;
  const env={
    emblaApi:{value:api},canPlay:{value:canPlay},autoplay,autoplayLease:{value:lease},
    instanceId:'case-r1b',owner:{value:owner},alignToSelection:()=>trace.push(['align']),
  };
  const f=vm.runInNewContext(`${sync}\n${reinit}\n({syncAutoplay,onReInit})`,env);
  return { ...f, env, autoplay, api, trace };
}

test('R1B source: both plugin reads are guarded through plugins() result',()=>{
  assert.match(source,/Boolean\(api\?\.plugins\(\)\?\.autoplay\)/);
  assert.match(source,/emblaApi\.value\?\.plugins\(\)\?\.autoplay/);
  assert.doesNotMatch(source,/\?\.plugins\(\)\.autoplay/);
});

test('R1B model: null Embla API is a pending state, no throw or lease',()=>{
  const h=harness({apiPresent:false,canPlay:true});
  assert.doesNotThrow(()=>h.syncAutoplay());
  assert.equal(h.env.autoplayLease.value,null);
  assert.deepEqual(h.trace,[]);
});

test('R1B model: active=false Embla returns undefined plugins()',()=>{
  const h=harness({pluginPresent:false,canPlay:false});
  assert.doesNotThrow(()=>h.syncAutoplay());
  assert.equal(h.env.autoplayLease.value,null);
  assert.deepEqual(h.trace,[]);
});

test('R1B model: owner transition before plugin init does not throw or claim lease',()=>{
  const h=harness({pluginPresent:false,canPlay:true});
  assert.doesNotThrow(()=>h.syncAutoplay());
  assert.equal(h.env.autoplayLease.value,null);
});

test('R1B model: after reInit plugin is registered, one timer starts',()=>{
  const h=harness({pluginPresent:true,canPlay:true});
  h.onReInit(h.api);
  assert.equal(h.env.autoplayLease.value,'case-r1b');
  assert.deepEqual(h.trace.map(x=>x[0]),['align','play']);
  assert.equal(h.trace[1][1],false);
  h.syncAutoplay();
  assert.deepEqual(h.trace.map(x=>x[0]),['align','play']);
});

test('R1B model: active owner without plugin after reInit errors explicitly',()=>{
  const h=harness({pluginPresent:false,owner:true,canPlay:true});
  assert.throws(()=>h.onReInit(h.api),/HERO_CAROUSEL_AUTOPLAY_PLUGIN_UNAVAILABLE/);
  assert.equal(h.env.autoplayLease.value,null);
});

test('R1B model: losing visibility stops timer and releases lease',()=>{
  const h=harness({pluginPresent:true,canPlay:false,lease:'case-r1b',playing:true});
  h.syncAutoplay();
  assert.deepEqual(h.trace,[['stop']]);
  assert.equal(h.env.autoplayLease.value,null);
});

test('R1B model: other instance lease is not stolen',()=>{
  const h=harness({pluginPresent:true,canPlay:true,lease:'another-instance'});
  h.syncAutoplay();
  assert.equal(h.env.autoplayLease.value,'another-instance');
  assert.deepEqual(h.trace,[]);
});
