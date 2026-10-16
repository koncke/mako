// =============================================================================
// Deshacer un pago a mano sin inventar deuda, y un solo link vivo por cuota (mig 0295, 16/10/2026)
// =============================================================================
// Los dos pendientes de la revisión de la tab Pagos en bloques (docs/hallazgos-pagos.md §4), que pidió Cerebro:
//   1. Un pago SUELTO o una mensualidad registrada a mano nacen como una cuota ya cobrada, con vencimiento = el día del
//      pago. Deshacerlos los dejaba impagos y VENCIDOS («Debe $X», y la cobranza los recordaba). Ahora nacen con
//      `nacio_cobrada` y deshacerlos los QUITA (`marcarPago`). Se EJECUTA contra una base PostgREST de mentira.
//   2. Dos pedidos simultáneos podían crear dos links vivos para la misma cuota. Ahora un índice único parcial lo
//      impide y `crearCobro` devuelve el link que ganó.
//
// PROBADO ROMPIÉNDOLO (16/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura.
// Con el código como está: 6 pases, 0 fallos. Rota, cada una da 5 / 1: deshacer deja la deuda (sin quitar); quita
// también lo de la pasarela; lee la lista de columnas (rompe sin la migración); el pago suelto sin la marca; la
// mensualidad de Editar deal sin la marca; la acción no dice que la quitó; el Deshacer re-marca una fila que no
// existe; el segundo link no se resuelve; el índice cuenta también los pagados.
// Correr: node --import tsx --test tests/pagos-nacio-cobrada.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
  pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;

const RAIZ = join(__dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '').replace(/^[ \t]*\/\/.*$/gm, '');

// ── Una base PostgREST de mentira: lo justo para `marcarPago` y `registrarPagoSuelto` ─────────────────────────
type Fila = Record<string, unknown>;
const WS = 5;
let db: Record<string, Fila[]> = {};
let escrituras: string[] = [];
let proximoId = 1000;
const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
function cumple(f: Fila, u: URL): boolean {
  for (const [k, v] of u.searchParams) {
    if (['select', 'order', 'limit', 'columns', 'on_conflict', 'offset'].includes(k)) continue;
    if (v.startsWith('eq.') && String(f[k]) !== v.slice(3)) return false;
    if (v.startsWith('neq.') && String(f[k]) === v.slice(4)) return false;
    if (v === 'is.null' && f[k] != null) return false;
    if (v.startsWith('in.(') && !v.slice(4, -1).split(',').includes(String(f[k]))) return false;
  }
  return true;
}
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test' || !u.pathname.startsWith('/rest/v1/')) throw new Error(`fetch sin mock: ${u.href}`);
  const tabla = u.pathname.replace('/rest/v1/', '');
  const filas = (db[tabla] ??= []);
  const metodo = (init.method ?? 'GET').toUpperCase();
  const h = new Headers(init.headers);
  const uno = (h.get('Accept') ?? '').includes('vnd.pgrst.object');
  const devolver = (h.get('Prefer') ?? '').includes('return=representation');
  const responder = (rs: Fila[]) => (!uno ? json(200, rs) : rs.length === 1 ? json(200, rs[0]) : json(406, { code: 'PGRST116', message: `${rs.length} filas` }));
  if (metodo === 'GET') return responder(filas.filter((f) => cumple(f, u)));
  if (metodo === 'DELETE') { escrituras.push(`DELETE ${tabla}`); db[tabla] = filas.filter((f) => !cumple(f, u)); return json(204, undefined); }
  if (metodo === 'PATCH') {
    const cambios = JSON.parse(String(init.body ?? '{}')) as Fila;
    const tocadas = filas.filter((f) => cumple(f, u));
    for (const f of tocadas) Object.assign(f, cambios);
    escrituras.push(`PATCH ${tabla} ${JSON.stringify(cambios)}`);
    return devolver ? responder(tocadas) : json(204, undefined);
  }
  const cuerpo = JSON.parse(String(init.body ?? 'null')) as Fila | Fila[];
  const nuevas: Fila[] = [];
  for (const fila of Array.isArray(cuerpo) ? cuerpo : [cuerpo]) {
    escrituras.push(`POST ${tabla} ${JSON.stringify(fila)}`);
    const nueva = { id: proximoId++, ...fila };
    filas.push(nueva);
    nuevas.push(nueva);
  }
  return devolver ? responder(nuevas) : json(201, undefined);
}) as typeof fetch;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const LEAD = 60;
function sembrar(cuota: Fila) {
  proximoId = 1000;
  escrituras = [];
  db = {
    leads: [{ id: LEAD, workspace_id: WS, nombre: 'Propia', estado_lead: 'ganado' }],
    pagos: [{ id: 910, workspace_id: WS, lead_id: LEAD, numero: 1, monto_usd: 300, pagado: true, fecha_pago: '2026-10-10', fecha_esperada: '2026-10-10', proveedor: null, cobro_id: null, ...cuota }],
    cobros: [],
  };
}
const correr = async <T>(fn: () => Promise<T>): Promise<T> => {
  const { runWithWorkspace } = await import('../lib/workspace');
  return runWithWorkspace(WS, fn);
};

test('deshacer un pago que NACIÓ cobrado lo quita: no queda una deuda vencida que nunca existió', async () => {
  const { marcarPago } = await import('../lib/pagos');
  sembrar({ nacio_cobrada: true });
  const r = await correr(() => marcarPago(910, false, null));
  assert.deepEqual(r, { quitada: true });
  assert.ok(escrituras.includes('DELETE pagos'), escrituras.join(' | '));
  assert.equal(db.pagos.length, 0, 'la fila tenía que irse');
});

test('deshacer una cuota del PLAN la deja impaga, como siempre (no se borra)', async () => {
  const { marcarPago } = await import('../lib/pagos');
  sembrar({ nacio_cobrada: false });
  const r = await correr(() => marcarPago(910, false, null));
  assert.deepEqual(r, { quitada: false });
  assert.ok(!escrituras.includes('DELETE pagos'));
  assert.deepEqual([db.pagos[0].pagado, db.pagos[0].fecha_pago], [false, null]);
  // Sin la columna (la base sin la mig 0295), marcar sigue andando: se lee `*`, no la lista de columnas. La base de
  // mentira no rechaza una columna que no existe, así que eso se fija en el fuente.
  const p = fuente('lib/pagos.ts');
  assert.match(p.slice(p.indexOf('export async function marcarPago('), p.indexOf('export async function cobrarCuota(')), /\.from\('pagos'\)\s*\.select\('\*'\)\s*\.eq\('id', pagoId\)/);
  sembrar({});
  delete (db.pagos[0] as Fila).nacio_cobrada;
  assert.deepEqual(await correr(() => marcarPago(910, false, null)), { quitada: false });
});

test('lo que cobró la pasarela no se quita a mano aunque diga que nació cobrado (se revierte con «Devolver»)', async () => {
  const { marcarPago } = await import('../lib/pagos');
  sembrar({ nacio_cobrada: true, proveedor: 'stripe', cobro_id: 3 });
  assert.deepEqual(await correr(() => marcarPago(910, false, null)), { quitada: false });
  assert.equal(db.pagos.length, 1);
});

test('un pago suelto nace con la marca; la mensualidad de Editar deal también', async () => {
  const { registrarPagoSuelto } = await import('../lib/pagos');
  sembrar({});
  await correr(() => registrarPagoSuelto(LEAD, { monto: 150, fecha: '2026-10-16' }));
  const alta = escrituras.find((e) => e.startsWith('POST pagos'));
  assert.ok(alta && JSON.parse(alta.slice('POST pagos '.length)).nacio_cobrada === true, `el insert no lleva la marca: ${alta}`);
  const deal = fuente('app/crm/[id]/deal-actions.ts');
  const cobradas = deal.slice(deal.indexOf('const rows = cobradas.map((c, i) => ({'), deal.indexOf("const { error } = await db.from('pagos').insert(rows);"));
  assert.match(cobradas, /nacio_cobrada: true,/);
});

test('la pantalla, la API y Customer Success saben que se quitó: el Deshacer lo vuelve a registrar, no re-marca una fila que no existe', () => {
  const acc = fuente('app/crm/actions.ts');
  const fn = acc.slice(acc.indexOf('export async function marcarPagoAction('), acc.indexOf('export async function deleteLeadAction('));
  assert.match(fn, /const \{ quitada \} = await marcarPago\(pagoId, pagado, fechaPago\);/);
  assert.match(fn, /return \{ quitada \};/);
  const cobrar = fuente('app/crm/lead-view/ficha/pagos/cobrar.tsx');
  const des = cobrar.slice(cobrar.indexOf('const desmarcar = (q: Pago)'), cobrar.indexOf('const leadCobro ='));
  assert.ok(des.indexOf('if (quitada) {') > 0 && des.indexOf('await registrarPagoSueltoAction(lead.id, {') > des.indexOf('if (quitada) {'), 'el Deshacer de un pago quitado lo vuelve a registrar');
  assert.match(fuente('lib/api-mako/areas/crm.run.ts'), /const \{ quitada \} = await marcarPago\(Number\(payload\.pagoId\), pagado, fechaPago\);/);
  assert.match(fuente('app/crm/[id]/DealDetailsCard.tsx'), /if \(r\?\.quitada\) setFeedback\(\{ kind: 'ok', msg: 'Pago quitado\.' \}\); else setPagoToast\(/);
});

test('un solo link vivo por cuota: el índice en la base, y el segundo pedido devuelve el que ganó', () => {
  const mig = readFileSync(join(RAIZ, 'supabase/migrations/0295_pagos_nacio_cobrada_y_un_link_por_cuota.sql'), 'utf8');
  assert.match(mig, /alter table pagos add column if not exists nacio_cobrada boolean not null default false;/);
  assert.match(mig, /create unique index if not exists cobros_un_link_vivo_por_cuota\s+on cobros \(pago_id\)\s+where pago_id is not null and estado in \('pendiente', 'fallido'\);/);
  assert.match(mig, /ORDEN: ANTES del deploy/, 'el código ya escribe la columna: sin ella, registrar un pago falla');
  const c = fuente('lib/cobros.ts');
  assert.match(c, /if \(error && cuota && error\.code === '23505' && \/cobros_un_link_vivo_por_cuota\/\.test\(error\.message \?\? ''\)\) \{\s*const otra = await cuotaParaLink\(lead\.id, cuota\.id\);\s*if \(otra\.ok && otra\.pendiente\) return \{ ok: true, cobro: otra\.pendiente, link: linkDelCobro\(otra\.pendiente\.token\), yaEstaba: true \};/);
});
