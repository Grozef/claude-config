// Chrome, Edge ou Chromium headless : rendu d'une page (mesures lues dans le DOM) et capture PNG. Utilise par build.mjs
// (mesure des largeurs de texte, controle de debordement, PNG).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Chrome, Edge ou Chromium : CDC_CHROME, chemins Windows et macOS connus, puis le PATH (Linux). CDC_CHROME=none : aucun.
const onPath = (n) => (process.env.PATH ?? '').split(path.delimiter).filter(Boolean).map((d) => path.join(d, n));
export const chrome = process.env.CDC_CHROME === 'none' ? undefined : [process.env.CDC_CHROME,
  ...['C:/Program Files', 'C:/Program Files (x86)', process.env.LOCALAPPDATA].filter(Boolean).flatMap((d) => [
    `${d}/Google/Chrome/Application/chrome.exe`, `${d}/Microsoft/Edge/Application/msedge.exe`]),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ...['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'].flatMap(onPath),
].find((p) => p && fs.existsSync(p) && fs.statSync(p).isFile());
export const fileUrl = (p) => pathToFileURL(path.resolve(p)).href;
// delai borne : une page qui bloque (ex. dialogue ouvert par un texte mal echappe) ne fige pas le build
export const CHROME_MS = 300000;

// page -> Chrome headless -> contenu JSON du <pre id="out"> ecrit par le script de la page
export function inChrome(file, html) {
  fs.writeFileSync(file, html);
  const dom = execFileSync(chrome, ['--headless=new', '--disable-gpu', '--dump-dom', fileUrl(file)], { encoding: 'utf8', maxBuffer: 1 << 28, timeout: CHROME_MS });
  const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
  return m ? JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')) : null;
}

// Largeur de chaque caractere de `chars` dans chaque style de `styles`, mesuree par le navigateur (police reelle)
export function measureChars(file, chars, styles) {
  return inChrome(file, `<!doctype html><meta charset="utf-8"><body>
<svg xmlns="http://www.w3.org/2000/svg" font-family="Tahoma, 'Segoe UI', sans-serif"><text id="t" style="white-space:pre"></text></svg>
<script>const C=${JSON.stringify([...chars])},S=${JSON.stringify(styles)},t=document.getElementById('t'),out={};
for(const k in S){t.setAttribute('style','white-space:pre;'+S[k]);const m=out[k]={};let mx=0;
for(const ch of C){t.textContent=ch.repeat(10);m[ch]=t.getComputedTextLength()/10;mx=Math.max(mx,m[ch])}m.__fallback=mx}
const p=document.createElement('pre');p.id='out';p.textContent=JSON.stringify(out);document.body.appendChild(p)</script>`);
}

// Capture PNG en double resolution d'une page statique de W x H
export function screenshot(pagePath, pngPath, W, H) {
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
    `--window-size=${W},${H}`, '--screenshot=' + path.resolve(pngPath), fileUrl(pagePath)], { stdio: 'ignore', timeout: CHROME_MS });
}
