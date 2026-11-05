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
// Y lo que sumó la revisión adversarial del mismo día (wf_fbeb8485-d3c: alguien sin admin que vende, un plan que no
// existe, el doble clic y un workspace que no es la plataforma; 16 confirmados):
//   · confirma y ejecuta el super admin GLOBAL, no el admin del workspace de la plataforma;
//   · nunca desde un flujo (un paso «⚡ Acción» se confirma solo);
//   · lo que va a cobrar (pasarela, moneda, dólares) se decide ANTES del lead y del «sí», y el resumen lo dice;
//   · un link pendiente del mismo plan no se duplica; el comprador sin mayúsculas; la cuenta que ya existe;
//   · ventaValida es PURA (lib/vender-plan-reglas.ts) y acá se EJECUTA.
//
// Probado rompiéndolo (23/10/2026, este archivo, base 12 / 0), cada rotura → al menos 1 fallo:
//   · preparar sin preguntar si es la plataforma;               · ejecutar sin preguntar si es la plataforma;
//   · ejecutar con su propio crearCobro en vez de venderPlan;   · el link en el resumen;
//   · la def sin soloPlataforma;                                · la def confirmada por chat en vez de en pantalla;
//   · faltaParaConfirmar sin el super admin;                    · ejecutar sin el super admin;
//   · preparar sin el corte de flujo;                           · NO_EN_FLUJOS sin vender_plan_mako;
//   · venderPlan creando el lead antes de la previa;            · venderPlan sin buscar el link abierto;
//   · el comprador por email exacto (.eq) en vez de ilike;      · ventaValida aceptando cualquier capa;
//   · ventaValida sin pasar el email a minúsculas;              · el resumen sin decir dónde queda el link.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFS } from '../lib/api-mako/areas/cobros.def';
import { esAccion } from '../lib/api-mako/tipos';
import { ventaValida } from '../lib/vender-plan-reglas';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const RUN = sinComentarios(leer('lib/api-mako/areas/cobros.run.ts'));
const RUNNER = (() => {
  const ini = RUN.indexOf('  vender_plan_mako: {');
  assert.ok(ini >= 0, 'no encontré el runner');
  // Hasta el runner SIGUIENTE (o el fin del objeto): desde el 5/11/2026 vender_plan_mako ya no es el último (la mensualidad
  // de una agencia va después), y cortar en el fin del objeto se llevaba los runners de otros.
  const sig = /\n  [a-z_]+: \{/g;
  sig.lastIndex = ini + 1;
  const proximo = sig.exec(RUN);
  const r = RUN.slice(ini, proximo ? proximo.index : RUN.indexOf('\n};', ini));
  assert.ok(r.length > 1500 && r.length < 7000, `el recorte mide ${r.length}: está mirando otra cosa`);
  return r;
})();
const PREPARAR = RUNNER.slice(0, RUNNER.indexOf('faltaParaConfirmar:'));
const EJECUTAR = RUNNER.slice(RUNNER.indexOf('ejecutar:'));
const LIB = sinComentarios(leer('lib/vender-plan.ts'));
const bloque = (src: string, ini: string, fin: string) => {
  const i = src.indexOf(ini);
  const f = src.indexOf(fin, i + 1);
  assert.ok(i >= 0 && f > i, `no encontré «${ini}» … «${fin}»`);
  return src.slice(i, f);
};
const VENDER = bloque(LIB, 'export async function venderPlan(', 'async function leadDelComprador(');

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

test('confirma y ejecuta el super admin GLOBAL, no el admin del workspace de la plataforma', () => {
  // rolMinimo: 'admin' + soloPlataforma es el admin DEL WORKSPACE; la pantalla de Cobros exige getSesionAdmin.
  assert.match(RUN, /async function esSuperAdmin\(\): Promise<boolean> \{\s*try \{ return \(await getSesionAdmin\(\)\) != null; \} catch \{ return false; \}/);
  assert.match(RUNNER, /faltaParaConfirmar: async \(\) => \(\(await esSuperAdmin\(\)\) \? null : NO_SUPER_ADMIN\)/);
  assert.match(EJECUTAR, /if \(!\(await esSuperAdmin\(\)\)\) return \{ ok: false, resumen: NO_SUPER_ADMIN \}/);
});

test('nunca desde un flujo: el runner lo rechaza y está en NO_EN_FLUJOS', () => {
  assert.match(PREPARAR, /if \(ctx\.canalKey\?\.startsWith\(PREFIJO_FLUJO\)\) return \{ error:/);
  const flujo = sinComentarios(leer('lib/api-mako/flujo.ts'));
  const m = flujo.match(/export const NO_EN_FLUJOS[^=]*= new Set\(\[([^\]]*)\]\)/);
  assert.ok(m, 'no encontré NO_EN_FLUJOS');
  assert.match(m[1], /'vender_plan_mako'/, 'un paso de un flujo se confirma solo: vendería un plan sin el super admin');
});

test('usa el camino de la pantalla, con la venta validada antes del «sí»', () => {
  assert.match(PREPARAR, /const val = ventaValida\(/);
  assert.match(EJECUTAR, /await venderPlan\(/);
  assert.doesNotMatch(RUNNER, /crearCobro\(/, 'un segundo camino para crear un cobro con alta de cuenta');
});

test('lo que va a cobrar se decide ANTES del lead y del «sí», y el resumen lo dice', () => {
  // En venderPlan: la previa antes de crear el lead, y el cobro con lo que dijo la previa.
  const previa = VENDER.indexOf('previaDeLaVenta(');
  assert.ok(previa >= 0, 'venderPlan sin previaDeLaVenta');
  assert.ok(previa < VENDER.indexOf('leadDelComprador('), 'el lead se crea antes de saber si se puede cobrar');
  assert.match(VENDER, /monto: p\.previa\.monto, moneda: p\.previa\.moneda, montoUsd: p\.previa\.montoUsd/);
  assert.match(VENDER, /pasarela: p\.previa\.pasarela/);
  // En el preparar: la previa, y el resumen con su pasarela y su moneda.
  assert.match(PREPARAR, /const p = await previaDeLaVenta\(v, plataforma\);\s*if \(!p\.ok\) return \{ error: p\.error, faltan: p\.faltan \}/);
  assert.match(PREPARAR, /NOMBRE_PASARELA\[p\.previa\.pasarela\]/);
  assert.match(PREPARAR, /formatoMonto\(p\.previa\.monto, p\.previa\.moneda\)/);
});

test('un link pendiente del mismo plan no se duplica', () => {
  const abierto = VENDER.indexOf('cobroAbiertoDelPlan(');
  assert.ok(abierto >= 0 && abierto < VENDER.indexOf('crearCobro('), 'venderPlan crea otro link sin mirar el pendiente');
  assert.match(VENDER, /yaEstaba: true/);
  const fn = bloque(LIB, 'export async function cobroAbiertoDelPlan(', 'export async function cuentaDelComprador(');
  assert.match(fn, /c\.alta_capa === capa/);
  assert.match(fn, /c\.estado === 'pendiente'/);
  assert.match(PREPARAR, /cobroAbiertoDelPlan\(plataforma, comprador\.id, v\.capa\)/);
  assert.match(PREPARAR, /yaEstaba: true/);
});

test('el comprador se busca sin mayúsculas: un patrón escapado trae candidatos y leadPorEmail decide', () => {
  const fn = bloque(LIB, 'async function compradorEnContexto(', 'export async function compradorEnLaPlataforma(');
  assert.match(fn, /email\.replace\(\/\[\\\\%_\]\/g/, 'sin escapar, un _ del email es un comodín');
  assert.match(fn, /\.ilike\('email', patron\)/);
  assert.match(fn, /leadPorEmail\(/);
  assert.doesNotMatch(LIB, /\.eq\('email'/, 'con el email exacto, un lead guardado con mayúsculas no se ve');
});

test('la cuenta que ya existe: la de la plataforma y la del equipo de otro negocio no se venden', () => {
  assert.match(PREPARAR, /if \(cuenta === 'plataforma'\) return \{ error:/);
  assert.match(PREPARAR, /if \(cuenta === 'equipo'\) return \{ error:/);
});

test('el link no pasa por el modelo: va a la persona y en datos, y el resumen dice dónde quedó', () => {
  assert.match(EJECUTAR, /paraLaPersona: `Link de pago: \$\{r\.link\}`/);
  // El resumen es un ternario de varias líneas: se mira entero, de `resumen:` a `paraLaPersona:` (con `[^\n]*` la rotura
  // daba verde).
  const resumen = bloque(EJECUTAR, 'resumen: r.yaEstaba', 'paraLaPersona:');
  assert.doesNotMatch(resumen, /r\.link/);
  // En /mako/revisar paraLaPersona no se muestra: el resumen dice que queda en Cobros, con su número.
  assert.match(EJECUTAR, /cobro #\$\{r\.cobroId\}[^`]*Queda en Cobros/);
  assert.match(PREPARAR, /El link queda en Cobros\./);
});

test('ventaValida (ejecutada): la capa en positivo', () => {
  const base = { email: 'ana@ejemplo.com', nombre: 'Ana', monto: 97, moneda: 'USD' };
  for (const capa of ['superadmin', 'una-que-no-existe', '', 'SUPERADMIN']) {
    const r = ventaValida({ ...base, capa });
    assert.equal(r.ok, false, `«${capa}» se vende`);
  }
  assert.equal(ventaValida({ ...base, capa: 'pm' }).ok, true);
});

test('ventaValida (ejecutada): el email, el nombre, el monto, la moneda y lo opcional', () => {
  const ok = ventaValida({ capa: 'pm', email: '  Ana.Perez@Ejemplo.COM ', nombre: ' Ana ', monto: 97, moneda: 'usd', montoUsd: -3, pasarela: 'paypal' as never });
  assert.ok(ok.ok);
  assert.equal(ok.venta.email, 'ana.perez@ejemplo.com', 'el alta crea al admin con este email: tiene que ir en minúsculas');
  assert.equal(ok.venta.nombre, 'Ana');
  assert.equal(ok.venta.moneda, 'USD');
  assert.equal(ok.venta.montoUsd, null, 'un valor en dólares negativo no es un valor');
  assert.equal(ok.venta.pasarela, null, 'una pasarela que no existe no se elige');
  assert.equal(ok.venta.tipo, 'unico');
  assert.equal(ventaValida({ capa: 'pm', email: 'ana@ejemplo.com', nombre: 'Ana', monto: 97, moneda: null }).ok, true, 'sin moneda = la de la cuenta');
  for (const malo of [
    { email: 'no-es-un-email' }, { nombre: 'A' }, { monto: 0 }, { monto: -1 }, { monto: Number.NaN }, { moneda: 'dólares' },
  ]) {
    assert.equal(ventaValida({ capa: 'pm', email: 'ana@ejemplo.com', nombre: 'Ana', monto: 97, moneda: 'USD', ...malo }).ok, false, JSON.stringify(malo));
  }
  assert.equal(ventaValida(null).ok, false);
});
