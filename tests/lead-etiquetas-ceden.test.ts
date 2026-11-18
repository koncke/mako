// =============================================================================
// Las etiquetas junto al nombre del lead CEDEN en un teléfono: la píldora «＋ Etiqueta» no queda afuera (18/11/2026)
// =============================================================================
// docs/feedback-diseno-pendiente.md (CRM, fila del 13/10, re-medida el 18/11/2026). Martín, 13/10: «poniendo la opción de
// etiquetas al lado del título, y si tienen más de una etiqueta que aparezca como "+2" y un desplegable». En escritorio
// estaba; en el teléfono, con una etiqueta larga, la píldora quedaba afuera y no se podía agregar otra, porque
// `.cl-junto` (app/crm/lead-view/CabeceraLead.tsx) era `flex:none`: el grupo medía lo que su contenido en UN renglón y el
// `flex-wrap` de adentro no se activaba nunca. Ahora el grupo cede (como mucho, su renglón), sus piezas bajan de renglón y
// la etiqueta larga se corta con tres puntos.
//
// Esto es LAYOUT, y sólo un navegador lo ejecuta: el test arma la cabecera con las DOS hojas de verdad (las que viven en
// CabeceraLead.tsx y CabeceraDetalle.tsx, leídas del fuente) y la mide en Chrome sin ventana, a 360 y 390 px, en las dos
// cabeceras (la del panel y la grande). Sin Chrome en la máquina se saltea diciendo por qué; la segunda parte (la cascada
// en jsdom) corre siempre.
//
// Correr: node --import tsx --test tests/lead-etiquetas-ceden.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (18/11/2026, base 2/0): devolverle `flex:none` a `.cl-junto` → 0 / 2 (las dos: la píldora a la
//    derecha de 514 px con la caja terminando en 306 a 360 px, y la cascada). Sacar sólo `.cl-junto > * > *{ min-width:0 }`
//    → 1 / 1 (la cascada). ⚠️ Chrome se arregla sin esa segunda regla: va por WebKit (el iPhone), que no se midió; por eso
//    la fija la cascada y no la medida.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
/** La hoja de una pieza: el template literal `const CSS = \`…\`` (es DATO: lo que el navegador aplica). */
function hoja(rel: string): string {
  const s = readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
  const ini = s.indexOf('const CSS = `');
  assert.ok(ini > 0, `no encontré la hoja de ${rel}: el test quedó viejo`);
  return s.slice(ini + 'const CSS = `'.length, s.indexOf('\n`;', ini));
}
const CSS = `${hoja('app/_components/CabeceraDetalle.tsx')}\n${hoja('app/crm/lead-view/CabeceraLead.tsx')}`;

// Lo que dibuja EtiquetasDelLead compacto (app/crm/lead-view/EtiquetasDelLead.tsx): el grupo inline-flex que envuelve,
// el chip (ChipEtiqueta, tope de 220) y la píldora de agregar (SelectorEtiqueta, 150 × 30). Nombres inventados.
const LARGA = 'Interesado en el programa de mentoría avanzada';
const grupo = (mas: string) => `<span class="cl-junto"><span style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0">
  <span class="chip" title="${LARGA}" style="display:inline-flex;align-items:center;gap:5px;max-width:220px;padding:4px 10px;border-radius:999px;font-size:12.5px;font-weight:600;border:1px solid #c66">
    <span style="width:7px;height:7px;border-radius:999px;background:#c66;flex:none"></span>
    <span class="txt" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${LARGA}</span>
    <button style="border:none;background:transparent;padding:0;font-size:13px">×</button>
  </span>${mas}
  <span style="display:inline-block"><button class="pildora" style="width:150px;height:30px;border-radius:999px;font-size:12.5px">＋ Etiqueta</button></span>
</span></span>`;
const NOMBRE = '<span class="cl-nom">María Fernanda González</span>';
const PANEL = `<div class="cl-cab cl-cab--panel"><div class="clp-fila"><button class="clp-volver">‹</button><button class="clp-cara" style="width:48px;height:48px"></button>
  <span class="clp-txt"><span class="cl-tit">${NOMBRE}${grupo('')}</span><span class="clp-bajada">Acme · WhatsApp</span></span><a class="clp-icono" href="#">⤢</a></div></div>`;
const GRANDE = `<div class="cl-cab"><div class="cd-fila" style="padding-left:16px"><span class="cd-txt"><span class="cl-tit">${NOMBRE}${grupo('<span><button style="height:26px;width:52px">+2</button></span>')}</span>
  <span class="cd-bajada">Lead #12 · creado 01/11/2026</span></span><span style="flex:1"></span></div></div>`;
const pagina = (ancho: number) => `<!doctype html><html><head><meta charset="utf-8"><style>:root{--ink:#111;--dim:#666;--surface-2:#eee;--primary:#36f;--touch:44px}body{margin:0;font-family:sans-serif}${CSS}</style></head><body>
<div data-caso="panel" style="width:${ancho}px;overflow:hidden">${PANEL}</div><div data-caso="grande" style="width:${ancho}px;overflow:hidden">${GRANDE}</div><pre id="out"></pre>
<script>addEventListener('load', () => { document.getElementById('out').textContent = JSON.stringify([...document.querySelectorAll('[data-caso]')].map((r) => {
  const p = r.querySelector('.pildora').getBoundingClientRect(); const caja = r.querySelector('.clp-txt, .cd-txt').getBoundingClientRect(); const t = r.querySelector('.txt');
  return { caso: r.dataset.caso, pildoraDer: Math.round(p.right), cajaDer: Math.round(caja.right), adentro: p.right <= caja.right + 0.5 && p.left >= caja.left - 0.5, corta: t.scrollWidth > t.clientWidth };
})); });</script></body></html>`;

// El Chrome de Linux (Actions y la nube). En la PC de Windows se saltea: el test no lleva rutas de Windows
// (scripts/rutas-windows-en-tests.mjs), y la cascada de abajo corre igual.
const CHROME = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));

test('en Chrome, a 360 y 390 px: la píldora queda adentro de su caja y la etiqueta larga se corta', (t) => {
  if (!CHROME) { t.skip('no hay Chrome en esta máquina: el layout no se puede medir (la cascada de abajo sí corre)'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'etiquetas-ceden-'));
  try {
    for (const ancho of [360, 390]) {
      const f = join(dir, `p${ancho}.html`);
      writeFileSync(f, pagina(ancho));
      let dom = '';
      try {
        dom = execFileSync(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--mute-audio', `--user-data-dir=${join(dir, `perfil${ancho}`)}`,
          '--window-size=500,900', '--virtual-time-budget=2000', '--dump-dom', `file://${f}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 90_000, stdio: ['ignore', 'pipe', 'ignore'] });
      } catch { t.skip('Chrome no arrancó: no se pudo medir (no es un rojo del código)'); return; }
      const m = /<pre id="out">([^<]*)<\/pre>/.exec(dom);
      if (!m) { t.skip('Chrome no devolvió la medida: no se pudo medir (no es un rojo del código)'); return; }
      const medidas = JSON.parse(m[1].replace(/&quot;/g, '"')) as Array<{ caso: string; pildoraDer: number; cajaDer: number; adentro: boolean; corta: boolean }>;
      assert.equal(medidas.length, 2, 'las dos cabeceras');
      for (const x of medidas) {
        assert.equal(x.adentro, true, `${ancho} px · ${x.caso}: la píldora termina en ${x.pildoraDer} y su caja en ${x.cajaDer}`);
        assert.equal(x.corta, true, `${ancho} px · ${x.caso}: la etiqueta larga se corta con tres puntos`);
      }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('la cascada (jsdom): el grupo puede encogerse hasta su renglón y sus piezas también', () => {
  const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (h: string) => { window: Window & typeof globalThis } };
  const w = new JSDOM(pagina(360)).window;
  const junto = w.document.querySelector('.cl-junto');
  const chip = w.document.querySelector('.chip');
  assert.ok(junto && chip, 'no se armó la cabecera');
  const s = w.getComputedStyle(junto);
  const c = w.getComputedStyle(chip);
  assert.notEqual(s.flexShrink, '0', 'el grupo no puede ser flex:none: no cede y la píldora queda afuera');
  assert.equal(parseFloat(s.minWidth), 0);
  assert.equal(s.maxWidth, '100%');
  assert.equal(parseFloat(c.minWidth), 0, 'la etiqueta tiene que poder achicarse a su renglón');
});
