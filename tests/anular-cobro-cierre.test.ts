// =============================================================================
// anularCobro (lib/cobros.ts) EJECUTADO: dice si la pasarela cerró el link, y quien va a crear otro no lo crea con el viejo pagable
// =============================================================================
// P27 (pendientes del 17/11/2026): `anularCobro` devolvía siempre `ok` y `cerrarLinkEnLaPasarela` se tragaba todo error. Un link anulado
// que seguía cobrable no lo sabía nadie, y `rehacerPrimerMes` / la renovación de la agencia creaban el link nuevo con el viejo todavía
// pagable: dos cobros posibles del mismo mes.
// Ahora: `ok: true` + `sigueAbierto` cuando la pasarela no lo cerró, y con `exigirCierre` (lo pide quien va a CREAR otro) la fila vuelve a
// como estaba y devuelve `ok: false`. Lo que la pasarela no sabe cerrar (un pago único de Creem) llega como `sigueAbierto` y no frena.
// lib/cobros.ts es server-only y habla con tres pasarelas: se carga con las pasarelas, la base y los demás módulos reemplazados (los puros,
// `cobros-tipos` y `cobros-reglas`, son los de verdad). Probado ROMPIÉNDOLO (17/11/2026): ver el pie.
// Correr: node --import tsx --test tests/anular-cobro-cierre.test.ts

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import { join } from 'node:path';

type Fila = Record<string, unknown>;
let filas: Fila[] = [];
const llamadas: string[] = [];
const eventos: string[] = [];
let stripeExpira: { ok: true } | { ok: false; status: number; error: string } = { ok: true };
let mpVence: { ok: true } | { ok: false; status: number; error: string } = { ok: true };
let mpCancela: { ok: true } | { ok: false; status: number; error: string } = { ok: true };
let credStripe: unknown = { pasarela: 'stripe', key: 'sk_test_x', acct: 'acct_1', cuenta: 'principal' };
let credStripeTira = false;
/** Lo que Stripe contesta al LEER la sesión cuando expirarla falló (ya vencida, ya pagada, o sigue abierta). */
let sesionStripe: { ok: true; estado: string } | { ok: false; status: number; error: string } = { ok: true, estado: 'open' };
let reabrirFalla = false;
let credCreem: unknown = { pasarela: 'creem', key: 'ck_test', webhookId: 'w', secretoAviso: 's', cuenta: 'principal' };

/** La tabla `cobros` mínima: select().eq().maybeSingle() y update().eq().in().select().maybeSingle(). */
const db = {
  from(_t: string) {
    return {
      select: () => ({ eq: (_c: string, id: number) => ({ maybeSingle: async () => ({ data: filas.find((f) => f.id === id) ?? null, error: null }) }) }),
      update: (patch: Fila) => {
        if (reabrirFalla && patch.estado === 'pendiente') throw new Error('la base no contesta');
        let id = 0; let estados: string[] | null = null;
        const q = {
          eq: (_c: string, v: number) => { id = v; return q; },
          in: (_c: string, v: string[]) => { estados = v; return q; },
          select: () => ({
            maybeSingle: async () => {
              const f = filas.find((x) => x.id === id);
              if (!f || (estados && !estados.includes(String(f.estado)))) return { data: null, error: null };
              Object.assign(f, patch);
              return { data: { ...f }, error: null };
            },
          }),
        };
        return q;
      },
    };
  },
};

const reales = new Set(['./cobros-tipos', './cobros-reglas', './cuentas-integracion', './pasarela-moneda', './cobrado-lead', './capas', './cobros-eventos', './planes-mako']);
const sinDefinir = new Proxy({}, {
  get: (_t, k) => (k === '__esModule' ? true : typeof k === 'string' ? (() => { throw new Error(`mock sin definir: ${k}`); }) : undefined),
});
const falsos: Record<string, unknown> = {
  './workspace': { runWithWorkspace: async (_ws: number, f: () => Promise<unknown>) => f(), getTenantDb: async () => db, wsSuperAdmin: async () => 9 },
  './cuentas-pago-server': {
    credStripeDe: async () => { if (credStripeTira) throw new Error('la base no contesta'); return credStripe; },
    credMpDe: async () => ({ pasarela: 'mercadopago', token: 'APP_USR-x', userId: '1', cuenta: 'principal' }),
    credCreemDe: async () => credCreem,
    cuentaDeIdentificador: async () => 'principal', cuentasDePago: async () => [],
  },
  './stripe-api': {
    expirarCheckoutStripe: async (_k: string, id: string) => { llamadas.push(`stripe.expirar ${id}`); return stripeExpira; },
    leerCheckoutStripe: async (_k: string, id: string) => { llamadas.push(`stripe.leer ${id}`); return sesionStripe; },
  },
  './mercadopago-api': {
    vencerPreferenciaMp: async (_t: string, id: string) => { llamadas.push(`mp.vencer ${id}`); return mpVence; },
    cancelarSuscripcionMp: async (_t: string, id: string) => { llamadas.push(`mp.cancelar ${id}`); return mpCancela; },
  },
  './creem-api': { cancelarSuscripcionCreem: async () => { llamadas.push('creem.cancelar'); return { ok: true }; }, leerCheckoutCreem: async () => ({ ok: true, suscripcionId: null }) },
  './leads': { logLeadEvent: async (_id: number, titulo: string) => { eventos.push(titulo); } },
};
type Cargador = (pedido: string, padre: { filename?: string } | null, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const original = M._load;
M._load = ((pedido: string, padre: { filename?: string } | null, esMain: boolean) => {
  if (pedido === 'server-only') return {};
  if (/[\\/]lib[\\/]cobros\.ts$/.test(padre?.filename ?? '') && pedido.startsWith('./') && !reales.has(pedido)) return falsos[pedido] ?? sinDefinir;
  return Reflect.apply(original, Module, [pedido, padre, esMain]);
}) as Cargador;

function cobro(extra: Fila = {}): Fila {
  return {
    id: 5, workspace_id: 9, token: 't', lead_id: 3, proveedor: 'stripe', cuenta: null, cuenta_ref: null, tipo: 'unico', concepto: 'MaKo Pro',
    monto: 97, moneda: 'USD', estado: 'pendiente', motivo: null, proveedor_ref: 'cs_123', ...extra,
  };
}
beforeEach(() => {
  filas = [cobro()]; llamadas.length = 0; eventos.length = 0;
  stripeExpira = { ok: true }; mpVence = { ok: true }; mpCancela = { ok: true };
  credStripe = { pasarela: 'stripe', key: 'sk_test_x', acct: 'acct_1', cuenta: 'principal' }; credStripeTira = false;
  sesionStripe = { ok: true, estado: 'open' }; reabrirFalla = false;
  credCreem = { pasarela: 'creem', key: 'ck_test', webhookId: 'w', secretoAviso: 's', cuenta: 'principal' };
  // Los warn de lo que falla a propósito no ensucian la salida.
  console.warn = () => undefined; console.error = () => undefined;
});
const anular = async (opts?: { exigirCierre?: boolean }) => (await import('../lib/cobros')).anularCobro(9, 5, 'test', opts);

test('Stripe cierra el link: ok, sin aviso, y la fila queda anulada', async () => {
  const r = await anular();
  assert.deepEqual(r, { ok: true });
  assert.equal(filas[0].estado, 'anulado');
  assert.deepEqual(llamadas, ['stripe.expirar cs_123']);
  assert.deepEqual(eventos, ['Link de pago']);
});

test('⚠️ Stripe NO lo cierra: queda anulado en MaKo y se DICE que sigue abierto (antes volvía ok a secas)', async () => {
  stripeExpira = { ok: false, status: 500, error: 'Stripe respondió 500' };
  const r = await anular();
  assert.equal(r.ok, true);
  assert.equal(r.sigueAbierto, 'Stripe respondió 500');
  assert.equal(filas[0].estado, 'anulado');
});

test('⚠️ la cuenta de Stripe ya no está conectada, o la base no contesta: tampoco es «cerrado», y no tira', async () => {
  credStripe = null;
  assert.match((await anular()).sigueAbierto ?? '', /Stripe no está conectado/);
  filas = [cobro()]; credStripeTira = true;
  const r = await anular();
  assert.equal(r.ok, true);
  assert.match(r.sigueAbierto ?? '', /la base no contesta/);
});

test('⚠️ Stripe no puede expirar una sesión que YA venció (la de ayer): se lee, y vencida cuenta como cerrada (antes frenaba rehacer el primer mes)', async () => {
  stripeExpira = { ok: false, status: 400, error: 'Only Checkout Sessions with a status in ["open"] can be expired.' };
  sesionStripe = { ok: true, estado: 'expired' };
  assert.deepEqual(await anular({ exigirCierre: true }), { ok: true });
  assert.deepEqual(llamadas, ['stripe.expirar cs_123', 'stripe.leer cs_123']);
});

test('⚠️ Stripe no puede expirarla porque YA SE PAGÓ: no es «cerrada» (la plata viene en camino) y exigirCierre no deja crear otro link', async () => {
  stripeExpira = { ok: false, status: 400, error: 'Only Checkout Sessions with a status in ["open"] can be expired.' };
  sesionStripe = { ok: true, estado: 'complete' };
  const r = await anular({ exigirCierre: true });
  assert.equal(r.ok, false);
  assert.match(r.error ?? '', /ya se pagó en Stripe/);
  assert.equal(filas[0].estado, 'pendiente');
});

test('si además la base no deja volver a abrir la fila, el mensaje NO dice «lo dejé como estaba»', async () => {
  stripeExpira = { ok: false, status: 500, error: 'Stripe respondió 500' };
  reabrirFalla = true;
  const r = await anular({ exigirCierre: true });
  assert.equal(r.ok, false);
  assert.match(r.error ?? '', /tampoco pude dejarlo como estaba/);
  assert.doesNotMatch(r.error ?? '', /así que lo dejé como estaba/);
});

test('Mercado Pago: la preferencia se vence y la suscripción se cancela; si falla, sigueAbierto', async () => {
  filas = [cobro({ proveedor: 'mercadopago', proveedor_ref: 'pref_1' })];
  assert.deepEqual(await anular(), { ok: true });
  assert.deepEqual(llamadas, ['mp.vencer pref_1']);
  filas = [cobro({ proveedor: 'mercadopago', tipo: 'suscripcion', proveedor_ref: 'pre_9' })]; llamadas.length = 0;
  mpCancela = { ok: false, status: 400, error: 'preapproval ya autorizada' };
  const r = await anular();
  assert.deepEqual(llamadas, ['mp.cancelar pre_9']);
  assert.equal(r.sigueAbierto, 'preapproval ya autorizada');
});

test('un cobro sin link en la pasarela (sin proveedor_ref) no tiene nada que cerrar: ok limpio y ninguna llamada', async () => {
  filas = [cobro({ proveedor_ref: null })];
  assert.deepEqual(await anular(), { ok: true });
  assert.deepEqual(llamadas, []);
});

test('Creem, pago único: no se puede cerrar (sigueAbierto), y ni siquiera exigirCierre lo frena (reintentar no ayuda)', async () => {
  filas = [cobro({ proveedor: 'creem', proveedor_ref: 'ch_1' })];
  const r = await anular({ exigirCierre: true });
  assert.equal(r.ok, true);
  assert.match(r.sigueAbierto ?? '', /Creem no deja cerrar un pago único/);
  assert.equal(r.imposible, true, 'las pantallas no muestran como error lo que la pasarela nunca podrá cerrar');
  assert.equal(filas[0].estado, 'anulado');
});

test('⚠️ exigirCierre y la pasarela NO lo cerró: la fila VUELVE a como estaba (pendiente, mismo motivo) y devuelve ok:false', async () => {
  filas = [cobro({ motivo: 'nota de antes' })];
  stripeExpira = { ok: false, status: 500, error: 'Stripe respondió 500' };
  const r = await anular({ exigirCierre: true });
  assert.equal(r.ok, false);
  assert.match(r.error ?? '', /no pude cerrar su link en Stripe \(Stripe respondió 500\)/);
  assert.equal(filas[0].estado, 'pendiente', 'queda UN solo link vivo: el de antes');
  assert.equal(filas[0].motivo, 'nota de antes');
  assert.deepEqual(eventos, [], 'no se anotó «Anulado» en la ficha de algo que no se anuló');
});

test('exigirCierre y la pasarela SÍ lo cerró: anulado, listo para crear el nuevo', async () => {
  const r = await anular({ exigirCierre: true });
  assert.deepEqual(r, { ok: true });
  assert.equal(filas[0].estado, 'anulado');
});

test('lo que quien va a CREAR otro link usa: rehacerPrimerMes y la renovación de la agencia piden exigirCierre', () => {
  const quitar = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
  const raiz = join(__dirname, '..');
  assert.match(quitar(readFileSync(join(raiz, 'lib/agencia-cobro.ts'), 'utf8')), /anularCobro\(plataforma, cobroId, autor, \{ exigirCierre: true \}\)/);
  assert.match(quitar(readFileSync(join(raiz, 'lib/agencia-plan.ts'), 'utf8')), /anularCobro\(plataforma, c\.id, p\.autor, \{ exigirCierre: true \}\)/);
  // Y a quien anula desde una pantalla o desde el chat se le dice.
  for (const rel of ['app/admin/cobros/actions.ts', 'app/crm/[id]/cobros-actions.ts', 'lib/api-mako/areas/cobros.run.ts']) {
    assert.match(readFileSync(join(raiz, rel), 'utf8'), /avisoLinkSigueAbierto\(r\.sigueAbierto\)/, rel);
  }
});

// Probado ROMPIENDO lib/cobros.ts (17/11/2026), una rotura por vez y restaurando de memoria. Con el código como está: 9 pases, 0 fallos.
// Rota (pases / fallos):
//   · anularCobro devuelve siempre `{ ok: true }` (como antes)                           → 5 / 4
//   · exigirCierre no vuelve a abrir la fila                                              → 8 / 1
//   · exigirCierre ignorado                                                               → 8 / 1
//   · exigirCierre frena también lo que la pasarela NO sabe cerrar (Creem)                → 8 / 1
//   · un fallo de Stripe al expirar cuenta como «cerrado»                                 → 7 / 2
//   · una cuenta de Stripe desconectada cuenta como «cerrado»                             → 8 / 1
