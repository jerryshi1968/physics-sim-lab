/* global window, document */
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { createStaticServer } from './serve-dist.mjs';
import { createLampCircuitExperiment } from '../src/experiments/lamp-circuits.ts';
import { createOpticalExperiment } from '../src/experiments/optical-bench.ts';
import { createLeverExperiment } from '../src/experiments/lever.ts';
import { createFrictionExperiment } from '../src/experiments/friction.ts';
import { createSpringExperiment } from '../src/experiments/spring.ts';
import { createProjectileExperiment } from '../src/experiments/projectile.ts';
import { createWorkbenchRegistry } from '../src/equipment/registry.ts';
import { validateSceneDocument } from '../src/core/scene/validate.ts';
import { simulateElectrical } from '../src/equipment/electrical/simulate.ts';
import { POWER, RESISTOR, SWITCH, AMMETER, VOLTMETER, LAMP } from '../src/equipment/electrical/definitions.ts';

const mode = process.argv[2] ?? 'smoke', channel = process.argv[3] ?? 'msedge', staticRoot = process.argv[4] ?? 'dist';
if (!['smoke', 'preflight', 'endurance'].includes(mode) || !['msedge', 'chrome'].includes(channel)) throw Error('Usage: node scripts/m7-audit.mjs smoke|preflight|endurance msedge|chrome');
const output = process.env.M7_AUDIT_OUTPUT ?? 'docs/acceptance', timestamp = new Date().toISOString(), registry = createWorkbenchRegistry();
await mkdir(output, { recursive: true });
const scenes = [createLampCircuitExperiment('m7-lamp', timestamp, 'series-same'), createOpticalExperiment('m7-optics', timestamp), createLeverExperiment('m7-lever', timestamp), createFrictionExperiment('m7-friction', timestamp), createSpringExperiment('m7-spring', timestamp), createProjectileExperiment('m7-projectile', timestamp)];
scenes[0].equipment.find(item => item.id === 'S').parameters.closed = true;
scenes[1].equipment.find(item => item.id === 'lens').pose.yM = .06;
scenes[1].equipment.find(item => item.id === 'screen').pose.xM = .65;
scenes[4].equipment.find(item => item.id === 'weight').parameters.springId = 'spring';
const stress = structuredClone(scenes[0]); stress.documentId = 'm7-stress'; stress.title = '性能基准：50器材100连接';
stress.viewport = { centerXM: 0, centerYM: 0, pixelsPerM: 220 };
stress.equipment = [[POWER, 'E'], [SWITCH, 'S'], [AMMETER, 'A'], [LAMP, 'L1'], [LAMP, 'L2'], ...Array.from({ length: 44 }, (_, i) => [RESISTOR, `R${i}`]), [VOLTMETER, 'V']].map(([type, id], i) => ({ id, type, definitionVersion: 1, pose: { xM: (i % 10 - 4.5) * .23, yM: (.5 - Math.floor(i / 10) / 4) * .8, rotationRad: 0 }, parameters: { ...registry.get(type, 1).defaultParameters, ...(type === SWITCH ? { closed: true } : {}) } }));
const branch = [['S', 'a', 'b'], ['A', 'high', 'common'], ['L1', 'a', 'b'], ['L2', 'a', 'b'], ...Array.from({ length: 44 }, (_, i) => [`R${i}`, 'a', 'b'])];
const pairs = [[['E', 'positive'], [branch[0][0], branch[0][1]]], ...branch.map((item, i) => [[item[0], item[2]], i + 1 < branch.length ? [branch[i + 1][0], branch[i + 1][1]] : ['E', 'negative']]), [['V', 'high'], ['E', 'positive']], [['V', 'common'], ['E', 'negative']]];
stress.connections = Array.from({ length: 100 }, (_, i) => { const [from, to] = pairs[i % pairs.length]; return { id: `load-wire-${i}`, kind: 'wire', from: { equipmentId: from[0], portId: from[1] }, to: { equipmentId: to[0], portId: to[1] }, routeWorldM: [{ x: (i % 10 - 4) * .2, y: (Math.floor(i / 10) - 4) * .08 }] }; });
for (const scene of [...scenes, stress]) if (!validateSceneDocument(scene, registry).ok) throw Error(`Invalid audit fixture: ${scene.title}`);
const solved = simulateElectrical(stress); if (!solved.result.ok) throw Error('Stress circuit must actually solve');
const percentile = (values, p) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1] : null;
const report = { mode, channel, date: timestamp, environment: { cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryBytes: os.totalmem(), os: `${os.platform()} ${os.release()}`, node: process.version, buildMode: 'Vite production, local HTTP, headless browser' }, stress: { equipment: stress.equipment.length, connections: stress.connections.length, nodes: solved.result.solution.nodes.length, note: '100 connections include parallel duplicate wires for drawing/union load; not a 100-unknown claim.', residuals: solved.result.solution.residuals }, results: [], externalRequests: [], errors: [] };
report.staticRoot = staticRoot;
const server = await createStaticServer(staticRoot); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel, headless: true }); report.environment.browser = await browser.version();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true });
  await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin === origin) return route.continue(); report.externalRequests.push(url.origin); return route.abort('internetdisconnected'); });
  await context.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window), WorkerClass = window.Worker;
    const data = window.__m7 = { frames: [], responses: [], workerMs: [], activeRaf: new Set(), workers: new Set(), createdWorkers: 0, delayedReplies: 0, delayReplies: false };
    window.requestAnimationFrame = callback => { const id = raf(time => { data.activeRaf.delete(id); callback(time); }); data.activeRaf.add(id); return id; };
    window.cancelAnimationFrame = id => { data.activeRaf.delete(id); cancel(id); };
    function tick(time) { data.frames.push(time); if (data.frames.length > 100000) data.frames.shift(); raf(tick); } raf(tick);
    document.addEventListener('input', event => { if (!event.target.matches('input:not([type=file]),select')) return; const start = performance.now(); raf(() => raf(() => data.responses.push(performance.now() - start))); }, true);
    window.Worker = class extends WorkerClass {
      constructor(url, options) { super(url, options); data.createdWorkers++; data.workers.add(this); let callback = null; Object.defineProperty(this, 'onmessage', { get: () => callback, set: value => { callback = value; } }); this.addEventListener('message', event => { if (this.started) data.workerMs.push(performance.now() - this.started); const saved = callback; if (data.delayReplies) { data.delayedReplies++; setTimeout(() => saved?.call(this, event), 350); } else saved?.call(this, event); }); }
      postMessage(...args) { this.started = performance.now(); return super.postMessage(...args); }
      terminate() { data.workers.delete(this); return super.terminate(); }
    };
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(origin); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  const cdp = await context.newCDPSession(page); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  async function load(scene) { await page.getByLabel('导入实验 JSON', { exact: true }).setInputFiles({ name: 'audit.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) }); await page.getByRole('button', { name: '确认替换当前实验', exact: true }).click(); await expect(page.locator('h1')).toHaveText(scene.title); await expect(page.getByTestId('scene-board').locator('[data-equipment-id]')).toHaveCount(scene.equipment.length); }
  async function exported() { const event = page.waitForEvent('download'); await page.getByRole('button', { name: '导出', exact: true }).click(); return JSON.parse(await readFile(await (await event).path(), 'utf8')); }
  async function property(id, label, value) { await page.getByLabel('选择器材', { exact: true }).selectOption(id); await page.getByLabel(label, { exact: true }).fill(String(value)); }
  async function settle() { await page.waitForFunction(() => window.__m7.workers.size === 0); }
  async function memory() { await settle(); await cdp.send('HeapProfiler.collectGarbage'); return { ...(await cdp.send('Memory.getDOMCounters')), ...(await cdp.send('Runtime.getHeapUsage')), ...(await page.evaluate(() => ({ activeRaf: window.__m7.activeRaf.size, workers: window.__m7.workers.size, createdWorkers: window.__m7.createdWorkers }))) }; }
  if (mode === 'smoke') {
    await page.reload(); await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    report.coldOffline = { cacheDisabled: true, network: 'all non-loopback page/Worker requests aborted; local HTTP retained; no OS adapter changes', serviceWorkers: await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length) };
    for (const scene of scenes) {
      await load(scene); const before = await exported(); expect(before.equipment).toEqual(scene.equipment);
      await page.getByRole('button', { name: '保存', exact: true }).click(); await page.reload(); await expect(page.locator('h1')).toHaveText(scene.title); expect((await exported()).equipment).toEqual(scene.equipment);
      await page.getByRole('tab', { name: '记录表', exact: true }).focus(); await page.keyboard.press('ArrowRight'); await expect(page.getByRole('tab', { name: '图线', exact: true })).toBeFocused(); await page.keyboard.press('ArrowRight'); await expect(page.getByRole('tab', { name: '模型说明', exact: true })).toBeFocused(); await page.getByRole('tab', { name: '记录表', exact: true }).click();
      for (const [width, height, zoom] of [[1366, 768, 1], [1920, 1080, 1.5], [820, 1180, 1]]) {
        await page.setViewportSize({ width, height }); await page.evaluate(zoom => { document.documentElement.style.zoom = String(zoom); }, zoom);
        await expect(page.getByRole('button', { name: '导出', exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        await page.getByLabel('选择器材', { exact: true }).selectOption(scene.equipment[0].id);
        await page.getByTestId('scene-board').locator('[data-equipment-id]').first().locator('.equipment-body').focus(); await page.keyboard.press('ArrowRight');
        const changed = await exported(); expect(changed.revision).toBeGreaterThan(before.revision); await page.getByRole('button', { name: '撤销', exact: true }).click();
        report.results.push({ experiment: scene.experimentId, width, height, cssZoom: zoom, keyboard: true, exportSaveReload: true, pageOverflow: false });
        if (scene === scenes[0]) await expect(page.getByText('自动更新 · 准静态直流', { exact: true }).first()).toBeVisible();
        await page.screenshot({ path: `${output}/m7-${channel}-${scene.experimentId}-${width}.png`, fullPage: true });
      }
      await page.evaluate(() => { document.documentElement.style.zoom = ''; }); await page.setViewportSize({ width: 1920, height: 1080 });
      if (scene === scenes[0]) { await expect(page.getByText('自动更新 · 准静态直流', { exact: true }).first()).toBeVisible(); expect(await page.locator('[data-meter-status="valid"]').count()).toBeGreaterThan(0); }
      if (scene === scenes[5]) { await page.getByRole('button', { name: '单步 Δt', exact: true }).click(); await expect(page.getByTestId('projectile-clock')).toHaveAttribute('data-time-s', '0.1'); }
    }
    const touch = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true }); await touch.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('internetdisconnected'));
    const tablet = await touch.newPage(); await tablet.goto(origin); await expect(tablet.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    for (const [entry, preview] of [['灯泡串并联实验', '预览实验'], ['凸透镜成像实验', '预览光学实验'], ['杠杆平衡实验', '预览杠杆实验'], ['滑动摩擦实验', '预览摩擦实验'], ['弹簧弹力实验', '预览弹簧实验'], ['平抛运动实验', '预览平抛实验']]) { await tablet.getByRole('button', { name: entry, exact: true }).tap(); if (entry === '灯泡串并联实验') await tablet.getByLabel('串联 · 相同灯泡', { exact: false }).check(); await tablet.getByRole('button', { name: preview, exact: true }).tap(); await tablet.getByRole('button', { name: '确认替换当前实验', exact: true }).tap(); await tablet.getByRole('button', { name: '放大', exact: true }).tap(); await tablet.getByRole('button', { name: '缩小', exact: true }).tap(); expect(await tablet.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true); }
    report.touch = { type: 'software touch context, not physical tablet', width: 820, height: 1180, sixEntrypoints: true }; await touch.close();
  } else {
    await load(scenes[1]); const before = await memory();
    const replacements = mode === 'endurance' ? 60 : 6;
    for (let i = 0; i < replacements; i++) { const scene = scenes[i % scenes.length]; await load(scene); if (i % 6 === 0) { await page.evaluate(() => { window.__m7.delayReplies = true; }); await property('E', '电源电压（V）', 6.1); await page.waitForFunction(() => window.__m7.delayedReplies > 0); } if (i % 6 === 3) await page.getByRole('button', { name: '开始牵引', exact: true }).click(); if (i % 6 === 5) await page.getByRole('button', { name: '发射 / 重新发射', exact: true }).click(); }
    await load(scenes[1]); await page.waitForTimeout(700); await page.evaluate(() => { window.__m7.delayReplies = false; }); const after = await memory(); expect(after.activeRaf).toBe(0); expect(after.workers).toBe(0); await expect(page.getByTestId('optical-status')).toContainText('清晰实像'); await expect(page.getByTestId('scene-board').locator('[data-meter-status]')).toHaveCount(0); report.switching = { replacements, before, after, delayedReplies: await page.evaluate(() => window.__m7.delayedReplies), note: 'Forced GC only for same-scene before/after retention checks; not proof of unlimited absence of leaks.' };
    const profiles = [...scenes, stress], starts = performance.now();
    for (let index = 0; index < profiles.length; index++) {
      const scene = profiles[index]; await load(scene); await settle();
      if (index === 3) await page.getByRole('button', { name: '开始牵引', exact: true }).click();
      const start = await page.evaluate(() => ({ now: performance.now(), frame: window.__m7.frames.length, response: window.__m7.responses.length, worker: window.__m7.workerMs.length }));
      let actions = 0; const until = performance.now() + (mode === 'endurance' ? 45000 : 1000);
      while (performance.now() < until) {
        if (index === 0 || index === 6) await property('E', '电源电压（V）', actions % 2 ? 6 : 6.1);
        else if (index === 1) await property('screen', '位置 x（m）', actions % 2 ? .65 : .64);
        else if (index === 2) await property('left', '钩码总质量（kg）', actions % 2 ? .1 : .2);
        else if (index === 3) await property('drive', '控制拉力（右正左负）（N）', actions % 2 ? 1 : 2);
        else if (index === 4) await property('weight', '钩码总质量（kg）', actions % 2 ? .025 : .05);
        else { await page.getByRole('button', { name: '发射 / 重新发射', exact: true }).click(); await property('launcher', '下次发射初速（m/s）', actions % 2 ? 2 : 2.1); }
        actions++; await page.waitForTimeout(700);
      }
      const data = await page.evaluate(start => { const d = window.__m7; return { elapsedMs: performance.now() - start.now, frames: d.frames.length - start.frame, responses: d.responses.slice(start.response), workers: d.workerMs.slice(start.worker), pendingRaf: d.activeRaf.size }; }, start);
      report.results.push({ experiment: scene.experimentId, title: scene.title, equipment: scene.equipment.length, connections: scene.connections.length, actions, seconds: data.elapsedMs / 1000, averageRafFps: data.frames / (data.elapsedMs / 1000), inputToTwoFramesP95Ms: percentile(data.responses, .95), workerRoundtripP95Ms: percentile(data.workers, .95), responseSamples: data.responses.length, pendingRaf: data.pendingRaf });
      console.log(JSON.stringify(report.results.at(-1)));
      await writeFile(`${output}/m7-task14-endurance-progress.json`, JSON.stringify(report, null, 2));
    }
    report.continuousSeconds = (performance.now() - starts) / 1000; await load(scenes[1]); report.finalMemory = await memory();
    if (mode === 'endurance') { expect(report.continuousSeconds).toBeGreaterThanOrEqual(300); expect(report.results.every(row => row.averageRafFps >= 30 && row.inputToTwoFramesP95Ms < 100)).toBe(true); }
  }
  expect(report.externalRequests).toEqual([]); expect(report.errors).toEqual([]); report.ok = true;
} catch (error) { report.ok = false; report.failure = String(error.stack ?? error); throw error; }
finally { await writeFile(`${output}/m7-task14-${mode}-${channel}.json`, JSON.stringify(report, null, 2) + '\n'); await browser?.close(); await new Promise(resolve => server.close(resolve)); }
