// =============================================================================
// /admin/cobros — Martín vendiendo MaKo: los cerrojos que no se ven en la pantalla
// =============================================================================
// Pedido de Martín (11/10/2026): «Lo voy a utilizar yo como superadmin para vender MaKo». La pantalla
// arma el link de pago de un plan, y al pagarse lib/cobros.ts crea la cuenta sola. Tres cosas pueden
// salir mal SIN un solo error, y por eso se fijan acá, leyendo el fuente:
//
//   1. Una action sin `getSesionAdmin()` primero. El id de una server action viaja en el bundle y
//      Next la ejecuta por cualquier puerta: «la página es de admin» no protege nada.
//   2. El workspace equivocado. OWNER_WS (1) es Mauricio, un CLIENTE, y la cookie del super admin
//      puede estar mirando a cualquiera: un plan de MaKo cobrado ahí entra al CRM de otro, con SU
//      Stripe. El ws sale de `wsSuperAdmin()` adentro de la action, y nunca de un parámetro.
//   3. La capa `superadmin` ofrecida como plan. No es un plan: es cómo se identifica la plataforma
//      (lib/capas.ts), y venderla le muda la identidad de MaKo a un cliente.
//
// ⚠️ Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez contra la base en verde de 6/6:
//   · el guard de anularCobroMakoAction movido abajo del chequeo del id → 5 pases, 1 fallo;
//   · `const ws = OWNER_WS` en venderPlanAction (con su import) → 5 pases, 1 fallo;
//   · `ws` como parámetro de anularCobroMakoAction → 5 pases, 1 fallo;
//   · un `for` delante de reembolsarCobro → 5 pases, 1 fallo;
//   · CAPAS_LISTA en lugar de CAPAS_VENDIBLES en VenderPlan.tsx → 5 pases, 1 fallo (desde el 6/11/2026 la venta es
//     Products › Checkout Links de la copia de Polar: el formulario ofrece los planes de planesMako(), y planValido rechaza
//     la capa de la plataforma);
//   · el guard de la página después de leer los cobros → 5 pases, 1 fallo;
//   · el item del nav con la key 'dev-cobros' → 5 pases, 1 fallo.
//   Restaurado a mano: 6 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_NAV, FAMILIAS, SUPERADMIN_MENU, USER_NAV, itemsDe } from '../app/_components/nav';
import { puedeVerItem } from '../lib/nav-visibilidad';
import { CAPAS_VENDIBLES } from '../lib/capas';
import { planValido, planesDeSetting } from '../lib/planes-mako';
import { PLANES_ASIGNABLES } from '../app/admin/_polar/datos/cliente';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const ACTIONS = sinComentarios(leer('app/admin/cobros/actions.ts'));
// «Vender un plan» vive en lib/vender-plan.ts desde el 23/10/2026 (lo usa también la API de MaKo, vender_plan_mako):
// sus cerrojos se fijan ahí, con las mismas reglas.
const LIB = sinComentarios(leer('lib/vender-plan.ts'));

/**
 * Cada `export async function` del archivo: su nombre, sus parámetros y su cuerpo. El cuerpo arranca
 * en la primera `{` FUERA de los `<…>` del tipo de retorno (`Promise<{ ok: boolean }>` también
 * tiene llaves) y termina donde se cierra.
 */
function acciones(src: string): Array<{ nombre: string; params: string; cuerpo: string }> {
  const out: Array<{ nombre: string; params: string; cuerpo: string }> = [];
  for (const m of src.matchAll(/^export async function (\w+)\s*\(/gm)) {
    let i = m.index! + m[0].length;
    let par = 1;
    const desde = i;
    while (par > 0 && i < src.length) { if (src[i] === '(') par++; else if (src[i] === ')') par--; i++; }
    const params = src.slice(desde, i - 1);
    let ang = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === '<') ang++;
      else if (c === '>' && src[i - 1] !== '=') ang--;
      else if (c === '{' && ang === 0) break;
      i++;
    }
    const ini = i + 1;
    let llaves = 1;
    i = ini;
    while (llaves > 0 && i < src.length) { if (src[i] === '{') llaves++; else if (src[i] === '}') llaves--; i++; }
    out.push({ nombre: m[1], params, cuerpo: src.slice(ini, i - 1) });
  }
  return out;
}

const LAS_CUATRO = ['venderPlanAction', 'cobrosDeMakoAction', 'anularCobroMakoAction', 'reembolsarCobroMakoAction'];

test('cada action pregunta por el super admin ANTES de hacer cualquier otra cosa', () => {
  const as = acciones(ACTIONS);
  // Sin esto, un parser que no encuentra nada da verde: «no revisé» no es «está bien».
  for (const n of LAS_CUATRO) assert.ok(as.some((a) => a.nombre === n), `no encontré ${n} en actions.ts`);
  for (const a of as) {
    assert.match(
      a.cuerpo.trimStart(),
      /^const (\w+) = await getSesionAdmin\(\);\s*if \(!\1\) return /,
      `${a.nombre}: la PRIMERA línea tiene que ser \`const admin = await getSesionAdmin(); if (!admin) return …\``,
    );
  }
});

test('los recibos (5/11/2026): cada action pregunta por el super admin ANTES de hacer cualquier otra cosa', () => {
  const as = acciones(sinComentarios(leer('app/admin/cobros/recibos-actions.ts')));
  for (const n of ['recibosAction', 'cargarPagoAction', 'reenviarReciboAction', 'anularReciboAction', 'marcarDevueltoReciboAction', 'guardarEmisorAction', 'guardarWaSoloAction']) {
    assert.ok(as.some((a) => a.nombre === n), `no encontré ${n} en recibos-actions.ts`);
  }
  for (const a of as) {
    assert.match(a.cuerpo.trimStart(), /^const (\w+) = await getSesionAdmin\(\);\s*if \(!\1\) return /, `${a.nombre}: la PRIMERA línea tiene que ser el super admin`);
  }
  // Las rutas que sirven los PDF y los comprobantes de TODOS los clientes: el super admin primero, además del proxy.
  for (const r of ['app/api/admin/recibos/[id]/pdf/route.ts', 'app/api/admin/recibos/[id]/comprobante/[pagoId]/route.ts', 'app/api/admin/recibos/comprobante/route.ts', 'app/api/admin/recibos/ejemplo/route.ts']) {
    const src = sinComentarios(leer(r));
    const cuerpo = src.slice(src.search(/export async function (GET|POST)/));
    assert.match(cuerpo, /^export async function (GET|POST)\([^)]*\) \{\s*if \(!\(await getSesionAdmin\(\)\)\) return /, `${r}: la primera línea tiene que ser getSesionAdmin`);
  }
});

test('el workspace es el de la plataforma, se resuelve adentro y nunca viaja desde la pantalla', () => {
  let total = 0;
  for (const src of [ACTIONS, LIB]) {
    assert.doesNotMatch(src, /\bOWNER_WS\b/, 'OWNER_WS es Mauricio, un cliente: lo de MaKo va en wsSuperAdmin()');
    assert.doesNotMatch(src, /\b(getWorkspaceActual|adminDeWorkspaceActual|resolverWsAdmin|WS_PRUEBA)\b/,
      'el ws de la cookie puede ser el de cualquier cliente que el super admin esté mirando');
    const definidos = new Set([...src.matchAll(/const (\w+) = await wsSuperAdmin\(\);/g)].map((m) => m[1]));
    const llamadas = [...src.matchAll(/\b(crearCobro|listarCobros|pasarelasConectadas|anularCobro|reembolsarCobro|runWithWorkspace)\((await wsSuperAdmin\(\)|[^,)]+)/g)];
    total += llamadas.length;
    for (const [, fn, arg] of llamadas) {
      const a = arg.trim();
      assert.ok(a === 'await wsSuperAdmin()' || definidos.has(a), `${fn}(${a}, …): el ws tiene que salir de wsSuperAdmin()`);
    }
  }
  assert.ok(total >= 6, `esperaba al menos 6 llamadas que reciben el ws, encontré ${total}`);
  for (const a of acciones(ACTIONS)) {
    assert.doesNotMatch(a.params, /\bws\b|workspace/i, `${a.nombre} recibe el workspace como parámetro: lo podría elegir cualquiera`);
  }
});

test('reembolsar mueve plata: una sola llamada, sin vueltas que la repitan', () => {
  const r = acciones(ACTIONS).find((a) => a.nombre === 'reembolsarCobroMakoAction');
  assert.ok(r, 'falta reembolsarCobroMakoAction');
  assert.equal((r.cuerpo.match(/\breembolsarCobro\(/g) ?? []).length, 1);
  assert.doesNotMatch(r.cuerpo, /\b(for|while)\s*\(|\.retry|reintent/i, 'lo que gasta plata ajena no se reintenta por default');
});

test('la capa de la plataforma no se ofrece como plan, ni en la pantalla ni en la action', () => {
  assert.ok(!CAPAS_VENDIBLES.some((c) => c.id === 'superadmin'));
  // Desde el 6/11/2026 «Vender un plan» es Products › Checkout Links (la copia de Polar): el formulario ofrece los PLANES de
  // MaKo (`productos`, leídos con planesMako() → productoDePlan), nunca el catálogo de capas; y un plan no puede tener la capa
  // de la plataforma (planValido la rechaza). El plan que se le pone a mano a un negocio (Editar, en su ficha) sale de
  // PLANES_ASIGNABLES, que es CAPAS_VENDIBLES.
  const form = sinComentarios(leer('app/admin/_polar/web/CheckoutLinks/CheckoutLinkForm.tsx'));
  assert.match(form, /productos\.filter\(\(p\) => p\.activo\)/, 'el formulario ofrece los planes activos que le pasan');
  assert.doesNotMatch(form, /\bCAPAS\b|\bCAPAS_LISTA\b/, 'el catálogo entero incluye la capa superadmin');
  assert.match(sinComentarios(leer('app/admin/_polar/datos/productos-server.ts')), /\(await planesMako\(\)\)\.map\(productoDePlan\)/, 'los planes salen de planesMako()');
  assert.equal(planValido({ id: 'x', nombre: 'X', capa: 'superadmin', precioUsd: 10 }), null, 'un plan con la capa de la plataforma no existe');
  assert.ok(planesDeSetting(JSON.stringify([{ id: 'x', nombre: 'X', capa: 'superadmin', precioUsd: 10 }])).every((p) => p.capa !== 'superadmin'));
  assert.ok(PLANES_ASIGNABLES.length > 0 && !PLANES_ASIGNABLES.some((p) => p.capa === 'superadmin'), 'Editar en la ficha no ofrece la capa de la plataforma');
  // Y el server lo vuelve a preguntar ANTES de crear un lead o un cobro: la pantalla no protege nada. La action delega en
  // lib/vender-plan.ts, donde ventaValida valida la capa y venderPlan la llama antes del lead y del cobro.
  const v = acciones(ACTIONS).find((a) => a.nombre === 'venderPlanAction')!;
  assert.match(v.cuerpo, /await venderPlan\(v, autorDe\(admin\)\)/, 'venderPlanAction no delega en el camino de lib/vender-plan.ts');
  // ventaValida vive en lib/vender-plan-reglas.ts (puro, sin server-only) desde la revisión adversarial del 23/10/2026.
  const REGLAS = sinComentarios(leer('lib/vender-plan-reglas.ts'));
  const valida = REGLAS.slice(REGLAS.indexOf('export function ventaValida('));
  assert.match(valida, /if \(!esCapaVendible\(capa\)\) return /, 'ventaValida no valida la capa con esCapaVendible');
  const vende = LIB.slice(LIB.indexOf('export async function venderPlan('), LIB.indexOf('async function leadDelComprador('));
  const chequeo = vende.indexOf('ventaValida(v)');
  assert.ok(chequeo > 0, 'venderPlan no valida la venta');
  assert.ok(chequeo < vende.indexOf('crearCobro('), 'la capa se valida ANTES de crear el cobro');
  assert.ok(chequeo < vende.indexOf('leadDelComprador('), 'y antes de crear un lead para nada');
});

test('la página es sólo del super admin, y el guard va antes de leer nada', () => {
  // Desde el 25/10/2026 /admin/cobros redirige a Admin; desde el 6/11/2026 a Sales (la copia de Polar), donde se leen los cobros.
  const page = sinComentarios(leer('app/admin/cobros/page.tsx'));
  const guard = page.search(/const admin = await getSesionAdmin\(\);\s*if \(!admin\) redirect\('\/inicio'\);/);
  assert.ok(guard > 0, 'falta el guard de /admin/estrategia: getSesionAdmin y si no, redirect');
  const destino = page.indexOf("redirect('/admin/sales')");
  assert.ok(destino > 0 && guard < destino, 'el guard va ANTES de mandarlo a Sales');
  const sales = sinComentarios(leer('app/admin/(polar)/sales/page.tsx'));
  const puerta = sales.indexOf('await exigirSuperAdmin()');
  assert.ok(puerta > 0, 'Sales sin la puerta del super admin');
  assert.ok(puerta < sales.indexOf('await vistaOrders()'), 'el guard va ANTES de leer los cobros');
  const guarda = sinComentarios(leer('app/admin/_polar/datos/guarda.ts'));
  assert.match(guarda, /const sesion = await getSesionAdmin\(\)\s*if \(!sesion\) redirect\('\/inicio'\)/, 'la puerta de Admin es el rol global');
  for (const p of [page, sales, guarda]) assert.doesNotMatch(p, /requireRolWs/, 'requireRolWs([]) la abriría al dueño de cada workspace');
  // Un cobro que no se pudo leer se DICE (un aviso), no se dibuja como una lista vacía.
  const ventas = sinComentarios(leer('app/admin/_polar/datos/ventas-server.ts'));
  assert.match(ventas, /cobrosDeMakoAction\(\)/, 'Sales lee los cobros con la acción del super admin');
  const orders = ventas.slice(ventas.indexOf('export async function vistaOrders('));
  assert.match(orders, /\.catch\(\(e\) => \(\{ ok: false as const, error: mensaje\(e\) \}\)\)/, 'una lectura que tira no tumba la página');
  assert.match(orders, /if \(!cobros\.ok\) avisos\.push\(/, 'los cobros que no se leyeron, en los avisos');
});

// Desde el 17/10/2026 la familia Admin salió de la barra: Cobros («Billing») es una SECCIÓN de Clients que sólo ve el
// super admin (app/_components/nav.ts → HERRAMIENTAS).
test('el item es del super admin, sin el prefijo de los registros, y ningún cliente lo ve', () => {
  const item = ADMIN_NAV.find((i) => i.href === '/admin/cobros');
  assert.equal(item?.key, 'admin-cobros', "la key va SIN 'dev-' (tests/dev-areas.test.ts lo reserva a los registros)");
  // Primero colgó de Clients; desde que Clients es una tab con sus sub-tabs adentro (17/10/2026), fue al menú de la foto; desde
  // el 25/10/2026 es la pestaña Billing de Customers y salió del menú (su entrada queda: el teléfono la abre por key).
  assert.ok(!SUPERADMIN_MENU.includes(item!), 'Billing volvió al menú de la foto: vive en Customers');
  assert.equal(item!.adminOnly, true);
  assert.deepEqual(FAMILIAS.flatMap(itemsDe).filter((i) => i.href.startsWith('/admin/cobros')).map((i) => i.key), [], 'Billing volvió a la barra');
  assert.equal(puedeVerItem(item!, { adminShell: false, rolWs: 'admin', capa: 'completo' }), false, 'el admin de un cliente lo vería');
  assert.deepEqual(USER_NAV.filter((i) => i.href.startsWith('/admin/cobros')).map((i) => i.key), []);
});
