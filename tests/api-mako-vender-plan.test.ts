// =============================================================================
// Vender un plan de MaKo por la API (23/10/2026, P0-8 de la auditoría de la API)
// =============================================================================
// Pedido de Martín (23/10/2026, desde el Ops Center): «Y si hay que hacer una revisión completa de la API, porque creo
// que faltan muchas acciones posibles». crear_link_pago exige un producto del catálogo y no pone altaCapa: vender un
// plan desde el chat no creaba la cuenta al pagarse. Lo que este test fija:
//   · sólo la plataforma: el gating (soloPlataforma + admin) Y el runner, al proponer y al confirmar;
//   · el MISMO camino que /admin/cobros (venderPlan, lib/vender-plan.ts), con la venta validada antes del «sí»;
//   · el link no pasa por el modelo: va a la persona y en datos;
//   · sin HTTP, confirmado en PANTALLA (lo que mueve plata), con el email y el plan fijos al revisar.
//
// Probado rompiéndolo (23/10/2026, este archivo, base 4 / 0), cada rotura → 1 fallo y 3 pases:
//   · preparar sin preguntar si es la plataforma;
//   · ejecutar sin preguntar si es la plataforma;
//   · ejecutar con su propio crearCobro en vez de venderPlan;
//   · el link en el resumen;
//   · la def sin soloPlataforma;
//   · la def confirmada por chat en vez de en pantalla.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFS } from '../lib/api-mako/areas/cobros.def';
import { esAccion } from '../lib/api-mako/tipos';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const RUN = sinComentarios(leer('lib/api-mako/areas/cobros.run.ts'));
const RUNNER = (() => {
  const ini = RUN.indexOf('  vender_plan_mako: {');
  assert.ok(ini >= 0, 'no encontré el runner');
  const r = RUN.slice(ini, RUN.indexOf('\n};', ini));
  assert.ok(r.length > 500 && r.length < 6000, `el recorte mide ${r.length}: está mirando otra cosa`);
  return r;
})();
const PREPARAR = RUNNER.slice(0, RUNNER.indexOf('ejecutar:'));
const EJECUTAR = RUNNER.slice(RUNNER.indexOf('ejecutar:'));

test('la def: sólo la plataforma, sólo el admin, sin HTTP, en pantalla y con el email y el plan fijos', () => {
  const d = DEFS.find((x) => x.id === 'vender_plan_mako');
  assert.ok(d && esAccion(d), 'falta vender_plan_mako');
  assert.equal(d.gating?.soloPlataforma, true, 'un admin de cualquier negocio vendería planes de MaKo');
  assert.equal(d.gating?.rolMinimo, 'admin');
  assert.ok(!d.canales.includes('http'), 'vender un plan no sale a un token');
  assert.equal(d.confirmacion, 'pantalla', 'lo que mueve plata se confirma en una pantalla (decisión del Cerebro, 23/10/2026)');
  for (const p of ['email', 'capa']) {
    assert.equal(d.parametros.find((x) => x.nombre === p)?.fijoAlRevisar, true, `${p}: el resumen se armó con él; cambiarlo al revisar vende otra cosa a otro`);
  }
});

test('el runner vuelve a preguntar si es la plataforma, al proponer y al confirmar', () => {
  assert.match(PREPARAR, /if \(ctx\.ws !== plataforma\) return \{ error:/);
  assert.match(EJECUTAR, /if \(ctx\.ws !== \(await wsSuperAdmin\(\)\)\) return \{ ok: false/);
});

test('usa el camino de la pantalla, con la venta validada antes del «sí»', () => {
  assert.match(PREPARAR, /const val = ventaValida\(/);
  assert.match(EJECUTAR, /await venderPlan\(/);
  assert.doesNotMatch(RUNNER, /crearCobro\(/, 'un segundo camino para crear un cobro con alta de cuenta');
});

test('el link no pasa por el modelo: va a la persona y en datos', () => {
  assert.match(EJECUTAR, /paraLaPersona: `Link de pago: \$\{r\.link\}`/);
  assert.doesNotMatch(EJECUTAR, /resumen:[^\n]*r\.link/);
});
