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
//   · CAPAS_LISTA en lugar de CAPAS_VENDIBLES en VenderPlan.tsx → 5 pases, 1 fallo;
//   · el guard de la página después de leer los cobros → 5 pases, 1 fallo;
//   · el item del nav con la key 'dev-cobros' → 5 pases, 1 fallo.
//   Restaurado a mano: 6 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_FAMILIAS, FAMILIAS, USER_NAV, itemsDe } from '../app/_components/nav';
import { CAPAS_VENDIBLES } from '../lib/capas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const ACTIONS = sinComentarios(leer('app/admin/cobros/actions.ts'));

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

test('el workspace es el de la plataforma, se resuelve adentro y nunca viaja desde la pantalla', () => {
  assert.doesNotMatch(ACTIONS, /\bOWNER_WS\b/, 'OWNER_WS es Mauricio, un cliente: lo de MaKo va en wsSuperAdmin()');
  assert.doesNotMatch(ACTIONS, /\b(getWorkspaceActual|adminDeWorkspaceActual|resolverWsAdmin|WS_PRUEBA)\b/,
    'el ws de la cookie puede ser el de cualquier cliente que el super admin esté mirando');
  const definidos = new Set([...ACTIONS.matchAll(/const (\w+) = await wsSuperAdmin\(\);/g)].map((m) => m[1]));
  const llamadas = [...ACTIONS.matchAll(/\b(crearCobro|listarCobros|pasarelasConectadas|anularCobro|reembolsarCobro|runWithWorkspace)\((await wsSuperAdmin\(\)|[^,)]+)/g)];
  assert.ok(llamadas.length >= 6, `esperaba al menos 6 llamadas que reciben el ws, encontré ${llamadas.length}`);
  for (const [, fn, arg] of llamadas) {
    const a = arg.trim();
    assert.ok(a === 'await wsSuperAdmin()' || definidos.has(a), `${fn}(${a}, …): el ws tiene que salir de wsSuperAdmin()`);
  }
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
  const vp = sinComentarios(leer('app/admin/cobros/VenderPlan.tsx'));
  assert.match(vp, /CAPAS_VENDIBLES\.map\(/, 'los planes se listan desde CAPAS_VENDIBLES');
  assert.doesNotMatch(vp, /\bCAPAS\b|\bCAPAS_LISTA\b/, 'el catálogo entero incluye la capa superadmin');
  // Y la action lo vuelve a preguntar ANTES de crear un lead o un cobro: la pantalla no protege nada.
  const v = acciones(ACTIONS).find((a) => a.nombre === 'venderPlanAction')!;
  const chequeo = v.cuerpo.search(/if \(!esCapaVendible\(capa\)\) return /);
  assert.ok(chequeo > 0, 'venderPlanAction no valida la capa con esCapaVendible');
  assert.ok(chequeo < v.cuerpo.indexOf('crearCobro('), 'la capa se valida ANTES de crear el cobro');
  assert.ok(chequeo < v.cuerpo.indexOf('leadDelComprador('), 'y antes de crear un lead para nada');
});

test('la página es sólo del super admin, y el guard va antes de leer nada', () => {
  const page = sinComentarios(leer('app/admin/cobros/page.tsx'));
  const guard = page.search(/const admin = await getSesionAdmin\(\);\s*if \(!admin\) redirect\('\/inicio'\);/);
  assert.ok(guard > 0, 'falta el guard de /admin/estrategia: getSesionAdmin y si no, redirect');
  assert.ok(guard < page.indexOf('cobrosDeMakoAction()'), 'el guard va ANTES de leer los cobros');
  assert.doesNotMatch(page, /requireRolWs/, 'requireRolWs([]) la abriría al dueño de cada workspace');
});

test('el item vive en la familia de Admin, sin el prefijo de los registros, y ningún cliente lo enlaza', () => {
  const item = ADMIN_FAMILIAS.flatMap(itemsDe).find((i) => i.href === '/admin/cobros');
  assert.equal(item?.key, 'admin-cobros', "la key va SIN 'dev-' (tests/dev-areas.test.ts lo reserva a los registros)");
  const deClientes = [...FAMILIAS.flatMap(itemsDe), ...USER_NAV].filter((i) => i.href.startsWith('/admin/cobros'));
  assert.deepEqual(deClientes.map((i) => i.key), []);
});
