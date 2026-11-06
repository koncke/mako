// =============================================================================
// Un solo fondo: una pantalla no pinta su propio fondo de página (6/11/2026)
// =============================================================================
// Martín, 6/11/2026, sobre el Marketing CoPilot: «fijate que el background no es igual en toda la tab de copilot, es blanco y crema
// en algunos lados, eso esta mal, ya varias veces cometes el mismo error». La causa: `.aa` pintaba un «apenas cálido» copiado de
// AdAmigo (el fondo de la casa con 5% del dorado de MaKo). Esa caja termina donde termina su contenido (y con A_SANGRE va de borde a
// borde pero no de arriba abajo), así que alrededor y debajo quedaba el fondo del layout: dos colores en la misma pantalla.
// La regla (AGENTS.md, «Una pantalla no pinta su propio fondo»): el fondo de la página es var(--bg), el del layout; lo que va encima
// son tarjetas (var(--surface)). Este test lo fija de dos formas:
//   1. en TODO el repo, ningún «casi fondo»: un color-mix con 70% o más de var(--bg) y otro color opaco (así nació --aa-calido);
//   2. en la tab, los contenedores de página no declaran otro fondo que var(--bg).
// La medida con el navegador (getComputedStyle a lo ancho y a lo alto, en claro y en oscuro): scripts/banco-copilot/medir-fondo.mjs.
// Probado rompiéndolo: al pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/** Un color hecho de casi todo el fondo de la casa y una pizca de otro color: un fondo de página propio, disfrazado. */
function casiFondos(css: string): string[] {
  const out: string[] = [];
  for (const m of sinComentarios(css).matchAll(/color-mix\(\s*in\s+[a-z]+\s*,\s*var\(--bg\)\s*(\d+)%\s*,\s*([^)]+?)\s*(?:\d+%)?\s*\)/gi)) {
    if (Number(m[1]) >= 70 && !/^transparent$/i.test(m[2].trim())) out.push(m[0]);
  }
  return out;
}

test('el detector: caza el «apenas cálido» y deja pasar un velo transparente', () => {
  assert.equal(casiFondos('--aa-calido: color-mix(in oklab, var(--bg) 95%, var(--mako) 5%);').length, 1);
  assert.equal(casiFondos('background: color-mix(in srgb, var(--bg) 40%, transparent);').length, 0);
  assert.equal(casiFondos('background: color-mix(in oklab, var(--bg) 90%, transparent);').length, 0);
  assert.equal(casiFondos('color: color-mix(in oklab, var(--primary) 55%, transparent);').length, 0);
});

test('en todo el repo, ninguna hoja pinta un «casi fondo»', () => {
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter((f) => /\.(css|tsx?)$/.test(f));
  assert.ok(archivos.length > 500, `miré ${archivos.length} archivos`);
  const malos = archivos.flatMap((f) => casiFondos(leer(f)).map((x) => `${f}: ${x}`));
  assert.deepEqual(malos, [], 'el fondo de una pantalla es var(--bg), el del layout: un tono propio deja otro color alrededor');
});

test('en el Marketing CoPilot, los contenedores de página no declaran otro fondo que el de la casa', () => {
  const PAGINA = ['.aa', '.aa-arranque', '.aa-copiloto', '.aa-hoy', '.aa-pagina', '.aa-ajustes', '.aa-sinanuncios', '.aa-hoja', '.mb'];
  const css = sinComentarios(leer('app/ads-manager/aa.css') + '\n' + leer('app/ads-manager/mb.css'));
  let vistos = 0;
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectores = m[1].split(',').map((s) => s.trim());
    if (!selectores.some((s) => PAGINA.includes(s))) continue;
    vistos++;
    for (const d of m[2].matchAll(/background(?:-color)?\s*:\s*([^;]+)/g)) {
      assert.match(d[1].trim(), /^(var\(--bg\)|var\(--mbx-banda\)|transparent|none)$/, `${m[1].trim()}: fondo «${d[1].trim()}»`);
    }
  }
  assert.ok(vistos >= 5, `encontré ${vistos} reglas de página: el test ya no mira lo que cree`);
  assert.match(leer('app/ads-manager/mb-paleta.css'), /--mbx-banda: var\(--bg\)/, 'la banda de Nueva campaña es el fondo de la casa');
  assert.match(css, /\.aa \{[^}]*background: var\(--bg\)/, '.aa pinta el fondo de la casa (el mismo del layout)');
});

// ── Probado rompiéndolo (6/11/2026) ───────────────────────────────────────────
//   1. devolver `--aa-calido: color-mix(in oklab, var(--bg) 95%, var(--mako) 5%)` a .aa            → 2 rojos (el repo y la tab).
//   2. `.aa-hoy, .aa-pagina { …; background: var(--surface) }`                                      → 1 rojo («los contenedores…»).
//   3. renombrar una variable local del detector (sin cambio de efecto)                             → verde.
