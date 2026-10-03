#!/usr/bin/env node
// archify-snap.mjs — capture PNG du seul diagramme d'un HTML archify (thème clair),
// pour l'inclure dans un CDC (skill cdc). Réutilise le client Chrome/CDP d'archify.
// Usage : node archify-snap.mjs <diagram.html> <out.png>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error('usage: archify-snap.mjs <diagram.html> <out.png>');
  process.exit(2);
}
const vc = path.join(os.homedir(), '.claude', 'skills', 'archify', 'bin', 'visual-check.mjs');
const { findChrome, ChromeVisualBrowser } = await import(pathToFileURL(vc).href);

const chrome = findChrome();
if (!chrome) {
  console.error('archify-snap: Chrome introuvable (définir ARCHIFY_CHROME)');
  process.exit(2);
}

const browser = new ChromeVisualBrowser(chrome);
try {
  const sessionId = await browser.sessionPromise;
  const send = (method, params = {}) => browser.cdp.send(method, params, sessionId, 20000);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result?.value;
  };

  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 2, mobile: false });
  const url = new URL(pathToFileURL(path.resolve(input)).href);
  url.searchParams.set('theme', 'light');
  const loaded = browser.cdp.waitFor('Page.loadEventFired', sessionId);
  const nav = await send('Page.navigate', { url: url.href });
  if (nav.errorText) throw new Error(`navigation: ${nav.errorText}`);
  await loaded;

  // Même préparation que visual-check : pas d'animation, vue READ, layout stable.
  const rect = await evaluate(`(async function () {
    document.documentElement.setAttribute('data-motion', 'still');
    var panel = document.querySelector('.diagram-container');
    if (panel) panel.setAttribute('data-detail-level', 'read');
    // Masque le dock de navigation du viewer (PATH/MAP/LENS/zoom), superposé au SVG.
    document.querySelectorAll('.diagram-nav').forEach(function (el) { el.style.display = 'none'; });
    if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(function () {});
    if (window.Archify && Archify.readerLayout && typeof Archify.readerLayout.whenStable === 'function') {
      await Archify.readerLayout.whenStable();
    }
    var svg = panel && (panel.querySelector(':scope > svg') || panel.querySelector(':scope > .diagram-stage > svg'));
    if (!svg) return null;
    var r = svg.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
  })()`);
  if (!rect || !rect.width || !rect.height) throw new Error('SVG du diagramme introuvable dans .diagram-container');

  const shot = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true, clip: { ...rect, scale: 1 },
  });
  if (!shot.data) throw new Error('capture vide');
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, Buffer.from(shot.data, 'base64'));
  console.log(`${output} (${Math.round(rect.width)}x${Math.round(rect.height)} css px, x2)`);
} catch (error) {
  console.error(`archify-snap: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
