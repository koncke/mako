// =============================================================================
// Las capturas del relevo de landings: public/web-generator/outliers/<id>.jpg (11/11/2026)
// =============================================================================
// La portada de Web Generator (app/web-generator/OutliersLandings.tsx) muestra cada landing del relevo (lib/landing-outliers.ts,
// `RELEVO`) con su captura: la página pública vista desde arriba, a 1280×800, achicada a 640×400. Se sacan con un Chrome SIN
// ventana y con un perfil temporal (nunca el Chrome de Martín ni su sesión), de a una.
//
// Correr:  node --import tsx scripts/capturas-outliers-landings.mjs            (las que faltan)
//          node --import tsx scripts/capturas-outliers-landings.mjs --todas    (todas de nuevo)
//          node --import tsx scripts/capturas-outliers-landings.mjs <id> <id>  (esas)
// =============================================================================

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { RELEVO } from '../lib/landing-outliers.ts';

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DESTINO = resolve('public/web-generator/outliers');
mkdirSync(DESTINO, { recursive: true });

const args = process.argv.slice(2);
const todas = args.includes('--todas');
const pedidas = args.filter((a) => !a.startsWith('--'));
const lista = RELEVO.filter((r) => (pedidas.length ? pedidas.includes(r.id) : todas || !existsSync(join(DESTINO, `${r.id}.jpg`))));

const perfil = mkdtempSync(join(tmpdir(), 'mako-capturas-'));
let bien = 0;
try {
  for (const r of lista) {
    const png = join(perfil, `${r.id}.png`);
    try {
      execFileSync(CHROME, [
        '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check',
        `--user-data-dir=${join(perfil, 'chrome')}`, '--window-size=1280,800', '--virtual-time-budget=12000',
        '--lang=es-419', `--screenshot=${png}`, r.url,
      ], { stdio: 'ignore', timeout: 60_000 });
      if (!existsSync(png) || statSync(png).size < 5_000) throw new Error('captura vacía');
      await sharp(png).resize(640, 400, { fit: 'cover', position: 'top' }).jpeg({ quality: 72, mozjpeg: true }).toFile(join(DESTINO, `${r.id}.jpg`));
      bien++;
      console.log(`✓ ${r.id}  ${r.url}`);
    } catch (e) {
      console.log(`✗ ${r.id}  ${r.url}  (${e instanceof Error ? e.message.slice(0, 80) : e})`);
    }
  }
} finally {
  rmSync(perfil, { recursive: true, force: true });
}
console.log(`${bien} de ${lista.length} capturas en ${DESTINO}`);
