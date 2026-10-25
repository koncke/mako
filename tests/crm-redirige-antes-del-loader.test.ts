// =============================================================================
// /crm redirige en su layout, antes del loader (25/10/2026)
// =============================================================================
// El Cerebro, 25/10: tres páginas del CRM redirigían adentro de `app/crm/loading.tsx` —el riesgo de los tickets #7
// (/general) y #9 (/web-generator): en una carga directa el `redirect()` va en el stream, no es un 307, y el router se
// puede caer con «Minified React error #310»—. El guard general (tests/redirige-antes-del-loader.test.ts, en la rama de
// Landings) las tenía como «conocidas». Y había cuatro más que ese guard no ve, porque redirigen por dentro de sus
// PUERTAS (`requireCapa`, `guardOnboarding`, `requireRolWs`): /crm, /crm/new, la ficha y prospectos.
//   1. qué ruta pasa por qué puerta (`redireccionDelLayoutCrm`, ejecutado) y el destino del resumen;
//   2. el layout usa LA MISMA puerta que cada página, que conserva la suya para la navegación;
//   3. toda página de /crm que redirige —a la vista o por una puerta— está en la regla: una nueva que no, falla.
// PROBADO ROMPIÉNDOLO: ver el pie.
// Correr: node --import tsx --test tests/crm-redirige-antes-del-loader.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { destinoDelResumen, redireccionDelLayoutCrm, type RedireccionCrm } from '../app/crm/layout-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. qué ruta pasa por qué puerta, y ninguna otra', () => {
  const casos: Array<[string, RedireccionCrm]> = [
    ['/crm', { tipo: 'tab' }], ['/crm/new', { tipo: 'tab' }], ['/crm/3445', { tipo: 'tab' }],
    ['/crm/prospectos', { tipo: 'prospectos' }],
    ['/crm/3445/resumen', { tipo: 'resumen', leadId: 3445 }],
    ['/crm/revisar', { tipo: 'pide-sesion' }], ['/crm/revisar/8f2c-ab', { tipo: 'pide-sesion' }],
  ];
  for (const [ruta, esperado] of casos) assert.deepEqual(redireccionDelLayoutCrm(ruta), esperado, ruta);
  for (const r of ['/crm/abc', '/crm/revisar/x/y', '/crm/abc/resumen', '/crm/3445/resumen/extra', '/crmx', '/general']) {
    assert.equal(redireccionDelLayoutCrm(r), null, `${r} no redirige: el layout no hace nada`);
  }
  assert.equal(redireccionDelLayoutCrm(null), null, 'sin el header del proxy no se adivina');
  assert.equal(destinoDelResumen(3445, 10), '/crm/3445/resumen?ws=10');
});

/** La puerta de cada página, escrita igual en el layout. */
const PUERTAS: Record<string, string[]> = {
  'app/crm/page.tsx': ["await requireCapa('crm');", 'await guardOnboarding();'],
  'app/crm/new/page.tsx': ["await requireCapa('crm');", 'await guardOnboarding();'],
  'app/crm/[id]/page.tsx': ["await requireCapa('crm');", 'await guardOnboarding();'],
  'app/crm/prospectos/page.tsx': ["await requireRolWs(['closer', 'setter'], { nav: 'crm' });"],
  'app/crm/[id]/resumen/page.tsx': ["await requireCapa('crm');", 'redirect(destinoDelResumen(leadId, wsDueno));'],
  'app/crm/revisar/page.tsx': ["if (!sesion) redirect(await rutaConWs('/inicio'));"],
  'app/crm/revisar/[id]/page.tsx': ["if (!sesion) redirect(await rutaConWs('/inicio'));"],
};

test('2. el layout usa la misma puerta de cada página, y ellas conservan la suya', () => {
  assert.ok(leer('app/crm/loading.tsx').length > 0, '/crm sin loader: este layout ya no hace falta');
  const lay = sinComentarios(leer('app/crm/layout.tsx'));
  assert.match(lay, /const r = redireccionDelLayoutCrm\(ruta\);/);
  assert.match(lay, /if \(r\?\.tipo === 'tab'\) \{\n\s*await requireCapa\('crm'\);\n\s*await guardOnboarding\(\);\n\s*\}/, 'la misma puerta y en el mismo orden que /crm');
  assert.match(lay, /if \(r\?\.tipo === 'prospectos'\) await requireRolWs\(\['closer', 'setter'\], \{ nav: 'crm' \}\);/);
  assert.match(lay, /if \(r\?\.tipo === 'pide-sesion' && !\(await getUsuarioActual\(\)\)\) redirect\(await rutaConWs\('\/inicio'\)\);/);
  assert.match(lay, /if \(r\?\.tipo === 'resumen'\) \{[\s\S]{0,120}await requireCapa\('crm'\);[\s\S]{0,300}workspaceDeLeadParaAdmin\(r\.leadId\)/, 'el dueño del lead se busca después de la puerta del CRM');
  assert.doesNotMatch(lay.slice(lay.indexOf("r?.tipo === 'resumen'")), /guardOnboarding/, 'el resumen NO pide el onboarding: se abre desde un WhatsApp');
  assert.match(lay, /if \(wsDueno != null && wsDueno !== wsActual\) redirect\(destinoDelResumen\(r\.leadId, wsDueno\)\);/, 'sin el !== es un bucle');
  assert.match(lay, /return children;\n\}/);
  for (const [p, puertas] of Object.entries(PUERTAS)) {
    const pag = sinComentarios(leer(p));
    for (const x of puertas) assert.ok(pag.includes(x), `${p} ya no tiene «${x}»: el layout la copia, cambiar los dos`);
  }
});

/** Cada página de /crm que redirige, con una ruta suya de ejemplo: la regla del layout tiene que cubrirla. */
const CUBIERTAS: Record<string, string> = {
  'app/crm/page.tsx': '/crm',
  'app/crm/new/page.tsx': '/crm/new',
  'app/crm/[id]/page.tsx': '/crm/12',
  'app/crm/prospectos/page.tsx': '/crm/prospectos',
  'app/crm/[id]/resumen/page.tsx': '/crm/12/resumen',
  'app/crm/revisar/page.tsx': '/crm/revisar',
  'app/crm/revisar/[id]/page.tsx': '/crm/revisar/abc',
};
/** Lo que redirige: el `redirect(` a la vista y las puertas de lib/tab-access.ts, que redirigen por dentro. */
const REDIRIGE = /\bredirect\(|\b(requireCapa|guardOnboarding|requireRolWs|requireSesion|requireRol)\(/;

test('3. toda página de /crm que redirige, a la vista o por una puerta, está en la regla del layout', () => {
  const paginas: string[] = [];
  const recorrer = (rel: string) => {
    for (const e of readdirSync(join(RAIZ, rel), { withFileTypes: true })) {
      if (e.isDirectory()) recorrer(`${rel}/${e.name}`);
      else if (e.name === 'page.tsx') paginas.push(`${rel}/page.tsx`);
    }
  };
  recorrer('app/crm');
  const redirigen = paginas.filter((p) => REDIRIGE.test(sinComentarios(leer(p))));
  assert.deepEqual(redirigen.filter((p) => !(p in CUBIERTAS)), [],
    'estas páginas de /crm redirigen debajo del loader: sumá su ruta a `redireccionDelLayoutCrm` y a CUBIERTAS');
  for (const [p, ruta] of Object.entries(CUBIERTAS)) {
    assert.ok(existsSync(join(RAIZ, p)), `${p} ya no existe: sacala de CUBIERTAS`);
    assert.notEqual(redireccionDelLayoutCrm(ruta), null, `${p} redirige y el layout no cubre ${ruta}`);
  }
});

// PROBADO ROMPIÉNDOLO (25/10/2026), contra una base de 3 / 0, de a una y restaurando de una copia:
//   · la regla sin la ficha (`/crm/<id>`)                                                   → 1 / 2 (el 1 y el 3)
//   · el layout sin el `!==` del resumen (redirigiría siempre: un bucle)                    → 2 / 1
//   · el layout con `guardOnboarding` también en el resumen                                → 2 / 1
//   · una página nueva de /crm con `requireCapa` que la regla no cubre                      → 2 / 1
