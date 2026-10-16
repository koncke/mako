// =============================================================================
// UNA sola `normalizarUrl`, y las llaves ya guardadas siguen cruzando (15/10/2026)
// =============================================================================
// Había dos funciones con el mismo nombre y contratos opuestos: la del Pixel (lib/landing-paginas.ts:
// conserva el www y el query que no es de medición, funde los deploys de Netlify, devuelve null) y la del
// Landing Analyst (lib/landing-url.ts: tira el www y el query entero, tira si no puede). Se importaban una
// por otra sin que nada avisara. Queda UNA `normalizarUrl` (la del Pixel) y la del Analyst pasa a llamarse
// `claveDeLanding`: contesta OTRA pregunta y su resultado es la llave de `landing_analyses.url`.
//
// Lo que fija este test:
//   1. Las dos devuelven EXACTAMENTE lo mismo que antes del cambio, entrada por entrada (las copias de
//      abajo son las de origin/main c4ef8a68e, congeladas). Cambiar la forma cambia la llave de lo que ya
//      está guardado en landing_analyses, landing.paginas, landing.config y landing.snapshot.
//   2. Las formas guardadas siguen cruzando: cada llave guardada se reproduce desde las URLs crudas que la
//      originan y es un punto fijo (normalizar una llave da la misma llave).
//   3. En el repo hay UNA `normalizarUrl` exportada, y todo import de ese nombre viene de landing-paginas.
//
// PROBADO ROMPIÉNDOLO (15/10/2026), con un arnés que restaura de memoria y verifica el hash. Base 4 / 0.
//   · `claveDeLanding` derivada de la del Pixel (sacándole www y query: «que llame a la única») → 2 / 2
//     (1 y 2: el deploy de Netlify, las credenciales, el puerto y el host sin punto cambian de llave).
//   · `claveDeLanding` que conserva la barra final (el «arreglo» obvio del 403) → 1 / 3 (1, 2 y la llave).
//   · la del Pixel que tira el www (la otra forma de «unificar») → 2 / 2 (1 y 2).
//   · lib/landing-url.ts vuelve a exportar `claveDeLanding as normalizarUrl` → 3 / 1 (3).
//   · diagnostico.ts vuelve a importar `normalizarUrl` de '../landing-url' → 3 / 1 (3).
//   Restaurado: 4 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizarUrl } from '../lib/landing-paginas';
import { claveDeLanding, direccionParaBajar, urlTalCual } from '../lib/landing-url';
import { filasDelPanel } from '../app/web-generator/panel-reglas';
import { PARAM_LEER } from '../lib/editor-landing/lector';

const RAIZ = join(__dirname, '..');

// ── Las implementaciones de ANTES, congeladas (origin/main c4ef8a68e) ─────────────────────────────────

/** lib/landing-url.ts:34 de antes (la del Analyst). */
function viejaDelAnalisis(input: string): string {
  const bruto = input.trim();
  const conEsquema = /^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`;
  const u = new URL(conEsquema);
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.hash = '';
  u.search = '';
  if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
  if (u.port === '80' || u.port === '443') u.port = '';
  return u.toString().replace(/\/$/, '');
}

const VIEJOS_PARAMS_DE_MEDICION = [
  'mko_test', 'l',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'gclid', 'fbclid', 'msclkid', 'ttclid', 'twclid',
  'gad_source', 'gbraid', 'wbraid', 'igshid', 'mc_cid', 'mc_eid', 'ref', '_ga',
  '__lovable_sha', '__lovable_load_id', 'forceHideBadge',
];

/** lib/landing-paginas.ts:118 de antes (la del Pixel). */
function viejaDelPixel(crudo: string): string | null {
  const s = (crudo ?? '').trim();
  if (!s) return null;
  const conEsquema = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(conEsquema);
    if (!u.hostname.includes('.')) return null;
    u.hash = '';
    for (const p of VIEJOS_PARAMS_DE_MEDICION) u.searchParams.delete(p);
    const path = u.pathname.replace(/\/+$/, '');
    const h = u.hostname.toLowerCase();
    const m = /^([0-9a-f]{20,})--(.+)$/.exec(h);
    return `${u.protocol}//${m ? m[2] : h}${u.port ? `:${u.port}` : ''}${path}${u.search}`;
  } catch {
    return null;
  }
}

/** Lo que devuelve una función que puede tirar, como valor comparable. */
const resultado = (f: (x: string) => string | null, x: string): string | null | { tira: true } => {
  try { return f(x); } catch { return { tira: true }; }
};

/**
 * Las formas que llegan de verdad: lo que pega la gente, lo que escribe el beacon (`location.href`, con UTM,
 * click-ids, el token de lead, el query de una agenda con nombre y email), los deploys de Netlify, el editor
 * de Lovable, las landings nuestras antes y después de la mudanza, y la basura que alguien puede escribir.
 */
const CORPUS = [
  'https://ejemplo.com', 'https://ejemplo.com/', 'ejemplo.com', 'ejemplo.com/', 'HTTPS://WWW.Ejemplo.com/a/?b=1#c',
  'https://www.ejemplo.com/oferta/', 'https://ejemplo.com/oferta', 'https://ejemplo.com/oferta//', 'https://ejemplo.com/Oferta/Clase',
  'http://ejemplo.com/oferta/', 'http://www.ejemplo.com/a/', 'https://ejemplo.com:8080/a/', 'https://ejemplo.com:443/a',
  'https://ejemplo.com:80/a', 'http://ejemplo.com:443/a', 'https://usuario:clave@ejemplo.com/a',
  'https://ejemplo.com/a?utm_source=fb&fbclid=1', 'https://ejemplo.com/a/?mko_test=abc&l=tok', 'https://ejemplo.com/?plan=pro',
  'https://ejemplo.com/?page_id=245', 'https://ejemplo.com/gracias?name=Codigo+Inmobiliario&email=a%40b.com',
  'https://ejemplo.com/a?q=a%20b&utm_campaign=x', 'https://ejemplo.com/a?', 'https://ejemplo.com/a#seccion',
  'https://6a7f350eb436ad1a599d0dcb--que-es-lidermente.netlify.app/', 'https://staging--sitio.netlify.app/',
  'https://0123456789abcdef012--sitio.com', 'https://id-preview--1234.lovable.app/?__lovable_sha=abc',
  'https://mi-proyecto.lovable.app/?forceHideBadge=true', 'https://mi-proyecto.lovable.app/?plan=pro',
  'https://hola-mako.com/l/mi-oferta/gracias', 'hola-mako.site/mi-oferta?utm_source=fb', 'https://www.hola-mako.com/l/mi-oferta/',
  'https://ñandú.com/página/', 'https://EJEMPLO.com./a', '  https://ejemplo.com/a  ',
  'localhost', 'https://localhost:3000/a', '169.254.169.254/latest', 'https://[::1]/a',
  '', '   ', 'no es una url', 'javascript:alert(1)//.xx', 'ftp://ejemplo.com/a', '//ejemplo.com/a', 'https://', 'http://a b.com',
];

test('1 · las dos devuelven exactamente lo de antes: cambiar la forma cambia las llaves guardadas', () => {
  for (const x of CORPUS) {
    assert.deepEqual(resultado(claveDeLanding, x), resultado(viejaDelAnalisis, x), `claveDeLanding(${JSON.stringify(x)}) cambió de forma`);
    assert.deepEqual(resultado(normalizarUrl, x), resultado(viejaDelPixel, x), `normalizarUrl(${JSON.stringify(x)}) cambió de forma`);
  }
});

test('2 · las llaves ya guardadas siguen cruzando: se reproducen desde lo crudo y son un punto fijo', () => {
  // landing_analyses.url (la llave del Analyst): sin www, sin query, sin barra final, con su protocolo y el
  // host del deploy de Netlify TAL CUAL (si se derivara de la del Pixel, esa fila quedaría huérfana).
  const delAnalisis: Record<string, string[]> = {
    'https://ejemplo.com': ['https://www.ejemplo.com/', 'ejemplo.com', 'https://ejemplo.com/?fbclid=1#x'],
    'https://ejemplo.com/oferta': ['https://www.ejemplo.com/oferta/', 'HTTPS://EJEMPLO.COM/oferta//?utm_source=fb'],
    'https://6a7f350eb436ad1a599d0dcb--que-es-lidermente.netlify.app': ['https://6a7f350eb436ad1a599d0dcb--que-es-lidermente.netlify.app/'],
    'http://ejemplo.com/a': ['http://www.ejemplo.com/a/'],
    'https://hola-mako.site/mi-oferta': ['hola-mako.site/mi-oferta?utm_source=fb', 'https://www.hola-mako.site/mi-oferta/'],
  };
  for (const [guardada, crudas] of Object.entries(delAnalisis)) {
    assert.equal(claveDeLanding(guardada), guardada, `la llave guardada ${guardada} ya no es un punto fijo`);
    for (const c of crudas) assert.equal(claveDeLanding(c), guardada, `${c} dejó de cruzar con ${guardada}`);
  }
  // landing.paginas / landing.config / landing.snapshot (la del Pixel): con www, con el query que no es de
  // medición, y el deploy de Netlify fundido con el sitio.
  const delPixel: Record<string, string[]> = {
    'https://www.ejemplo.com/oferta?plan=pro': ['https://www.ejemplo.com/oferta/?plan=pro&utm_source=fb&fbclid=1#top', 'www.ejemplo.com/oferta?mko_test=1&plan=pro'],
    'https://que-es-lidermente.netlify.app': ['https://6a7f350eb436ad1a599d0dcb--que-es-lidermente.netlify.app/'],
    'https://ejemplo.com/gracias': ['https://ejemplo.com/gracias/?l=tok&utm_campaign=x', 'ejemplo.com/gracias#formulario'],
    'https://hola-mako.com/l/mi-oferta/gracias': ['https://hola-mako.com/l/mi-oferta/gracias/?gclid=1'],
  };
  for (const [guardada, crudas] of Object.entries(delPixel)) {
    assert.equal(normalizarUrl(guardada), guardada, `la página guardada ${guardada} ya no es un punto fijo`);
    for (const c of crudas) assert.equal(normalizarUrl(c), guardada, `${c} dejó de cruzar con ${guardada}`);
  }
});

test('la llave NO es una dirección: pierde la barra, el www y el query, y la dirección los conserva', () => {
  // El 403 «sin la barra final» del relevo: hay hosts que sólo sirven `/oferta/` (o sólo con www). Para BAJAR
  // va `urlTalCual`; la llave sólo para buscar la fila.
  const pegada = 'https://www.ejemplo.com/oferta/?page_id=245';
  assert.equal(claveDeLanding(pegada), 'https://ejemplo.com/oferta');
  assert.equal(urlTalCual(pegada), pegada);
});

// ── 3. Una sola en el repo ───────────────────────────────────────────────────────────────────────────

const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Los fuentes que NOMBRAN normalizarUrl, por `git grep` (el índice más los nuevos sin agregar: `--untracked`).
 * Leer los ~5.300 fuentes de app, lib, tests y scripts (~70 MB) tardaba 15-30 s en esta máquina.
 */
function fuentesQueLaNombran(): string[] {
  return execFileSync('git', ['grep', '-l', '-I', '--untracked', '-e', 'normalizarUrl', '--', 'app', 'lib', 'tests', 'scripts'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').map((f) => f.trim()).filter((f) => /\.(ts|tsx|mts|mjs|js)$/.test(f));
}

test('3 · hay UNA `normalizarUrl` exportada, y todo import de ese nombre viene de landing-paginas', () => {
  const archivos = fuentesQueLaNombran();
  assert.ok(archivos.length >= 15, `git grep devolvió ${archivos.length} fuentes: esto no corrió en el repo`);
  const exportan: string[] = [];
  const importanMal: string[] = [];
  for (const rel of archivos) {
    const src = sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));
    if (/export\s+(?:async\s+)?function\s+normalizarUrl\b|export\s+(?:const|let|var)\s+normalizarUrl\b/.test(src)) exportan.push(rel);
    for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) if (/\bnormalizarUrl\b/.test(m[1])) exportan.push(`${rel} (re-export)`);
    for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
      if (/\bnormalizarUrl\b/.test(m[1]) && !/(?:^|\/)landing-paginas$/.test(m[2])) importanMal.push(`${rel} ← ${m[2]}`);
    }
  }
  assert.deepEqual(exportan, ['lib/landing-paginas.ts'], 'volvió a haber más de una `normalizarUrl`');
  assert.deepEqual(importanMal, [], 'alguien importa `normalizarUrl` de otro módulo (la del Analyst es `claveDeLanding`)');
});

// ── 4. Para BAJAR va la dirección real, no la llave (el 403 «sin la barra / con la barra») ──────────────
// La llave de `landing_analyses` (sin barra final, sin www, sin query) busca la fila; algunos sitios le contestan
// 403 y 200 a la dirección real. La barra del Web Generator abría una analizada bajando la llave.
// Roturas (15/10/2026, a mano y restaurado; base en verde: 5 pasan, 0 fallan):
//   · `direccionParaBajar` devuelve siempre `urlFinal` (sin mirar la llave) ............ 4 / 1
//   · `filasDelPanel` vuelve a `url: a.url` .............................................. 4 / 1

test('4 · para bajar una analizada va su dirección real (url_final) si es la misma landing; la llave sólo busca', () => {
  const llave = claveDeLanding('https://www.ejemplo.com/');
  assert.equal(direccionParaBajar(llave, 'https://www.ejemplo.com/'), 'https://www.ejemplo.com/');
  assert.equal(direccionParaBajar(llave, 'https://otra.com/'), null, 'una url_final de OTRA landing no se baja en su lugar');
  assert.equal(direccionParaBajar(llave, null), null);
  assert.equal(direccionParaBajar(llave, 'no es una url'), null);
  const filas = filasDelPanel([], [{ url: llave, leer: 'https://www.ejemplo.com/', veredicto: null, score: null }], []);
  const fila = filas.find((f) => f.tipo === 'analizada');
  assert.ok(fila && fila.tipo === 'analizada');
  assert.equal(fila.url, 'https://www.ejemplo.com/', 'el renglón baja la dirección real');
  const sinLeer = filasDelPanel([], [{ url: llave, veredicto: null, score: null }], []).find((f) => f.tipo === 'analizada');
  assert.ok(sinLeer && sinLeer.tipo === 'analizada' && sinLeer.url === llave, 'sin url_final, se baja la llave como antes');
  assert.equal(fila.clave, sinLeer.clave, 'la clave del renglón sigue saliendo de la llave');
  assert.equal(fila.nombre, sinLeer.nombre, 'y el nombre también');
});

// ── 5. La lectura de MaKo no deja una página por lectura (revisión de la tanda 8, 16/10/2026) ─────────────────────────
// Un Pixel pegado antes del 16/10 que pierde la ventana de MaKo (la página se recargó sola) mide la lectura como visita,
// con `?mako_leer=<id>` distinto cada vez. `mako_leer` es un parámetro de medición: cae en la misma página.
// Rotura (a mano y restaurado; base en verde: 6 / 0): sin «'mako_leer'» en PARAMS_DE_MEDICION → 5 / 1 (éste).
test('5 · `?mako_leer=` no cambia la página (es de medición, como los utm)', () => {
  assert.equal(PARAM_LEER, 'mako_leer', 'el nombre que lib/landing-paginas.ts escribe a mano');
  assert.equal(normalizarUrl('https://su-landing.com/oferta?mako_leer=AbCdEfGhIjKlMnOpQr'), normalizarUrl('https://su-landing.com/oferta'));
  assert.equal(normalizarUrl('https://su-landing.com/oferta?plan=pro&mako_leer=AbCdEfGhIjKlMnOpQr'), normalizarUrl('https://su-landing.com/oferta?plan=pro'));
});
