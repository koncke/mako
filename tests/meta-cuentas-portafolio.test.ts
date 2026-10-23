// =============================================================================
// Las cuentas de los portafolios del token: business_management (23/10/2026)
// =============================================================================
// `/me/adaccounts` no trae una cuenta del portafolio que nadie asignó al usuario
// del sistema: la segunda cuenta de Sergio (ws20) se leía y MaKo no la ofrecía.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cuentasDePortafolios, MAX_CUENTAS_NUEVAS, type GetGraph } from '../lib/meta-cuentas-portafolio';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

/** Un Graph de mentira: path → respuesta. Lo que no está, contesta como Meta un objeto ajeno. */
function graph(rutas: Record<string, { data?: unknown[]; error?: string }>): GetGraph & { pedidos: string[] } {
  const pedidos: string[] = [];
  const f = (async (path: string) => {
    pedidos.push(path);
    const r = rutas[path];
    if (!r) return { body: {}, error: '(#200) Ad account owner has NOT grant ads_management or ads_read permission' };
    return r.error ? { body: {}, error: r.error } : { body: { data: r.data ?? [] } };
  }) as GetGraph & { pedidos: string[] };
  f.pedidos = pedidos;
  return f;
}

test('Suma la cuenta del portafolio que el token lee y nadie le asignó (el caso de Sergio)', async () => {
  const g = graph({
    // Un usuario del sistema: /me/businesses vacío (medido); el portafolio sale de su cuenta.
    '/me/businesses': { data: [] },
    '/me/adaccounts': { data: [{ id: 'act_4171287933095795', business: { id: '1810786259299103' } }] },
    '/1810786259299103/owned_ad_accounts': { data: [
      { id: 'act_4171287933095795', name: '4171287933095795', account_status: 1 },
      { id: 'act_702839088096495', name: '702839088096495', account_status: 1, currency: 'ARS' },
    ] },
    '/1810786259299103/client_ad_accounts': { data: [] },
    '/act_702839088096495': {},
  });
  const r = await cuentasDePortafolios(g, new Set(['act_4171287933095795']));
  assert.deepEqual(r, [{ id: 'act_702839088096495', nombre: '702839088096495', activa: true, moneda: 'ARS' }]);
});

test('Una cuenta del portafolio que el token NO lee no se ofrece (Meta lo dice dentro de un 200)', async () => {
  const g = graph({
    '/me/businesses': { data: [{ id: 'b1' }] },
    '/b1/owned_ad_accounts': { data: [{ id: 'act_1', name: 'Ajena', account_status: 1 }] },
    '/b1/client_ad_accounts': { data: [{ id: 'act_2', name: 'De un cliente', account_status: 1 }] },
    '/act_2': {},
    // act_1 no está: el GET de prueba contesta el #200.
  });
  const r = await cuentasDePortafolios(g, new Set());
  assert.deepEqual(r.map((c) => c.id), ['act_2']);
});

test('Sin business_management queda como antes: nada nuevo y ningún pedido de más', async () => {
  const g = graph({ '/me/businesses': { error: '(#100) Missing permissions' }, '/me/adaccounts': { error: '(#100) Missing permissions' } });
  assert.deepEqual(await cuentasDePortafolios(g, new Set(['act_9'])), []);
  assert.deepEqual(g.pedidos.sort(), ['/me/adaccounts', '/me/businesses']);
});

test('No repite lo que ya vino de /me/adaccounts ni la misma cuenta de dos portafolios, y tiene tope', async () => {
  const muchas = Array.from({ length: MAX_CUENTAS_NUEVAS + 10 }, (_, i) => ({ id: `act_${i}`, name: `C${i}`, account_status: 1 }));
  const rutas: Record<string, { data?: unknown[] }> = {
    '/me/businesses': { data: [{ id: 'b1' }, { id: 'b2' }] },
    '/b1/owned_ad_accounts': { data: muchas },
    '/b1/client_ad_accounts': { data: [] },
    '/b2/owned_ad_accounts': { data: [{ id: 'act_0', name: 'repetida' }] },
    '/b2/client_ad_accounts': { data: [] },
  };
  for (const c of muchas) rutas[`/${c.id}`] = {};
  const r = await cuentasDePortafolios(graph(rutas), new Set(['act_0']));
  assert.equal(r.length, MAX_CUENTAS_NUEVAS);
  assert.ok(!r.some((c) => c.id === 'act_0'));
  assert.equal(new Set(r.map((c) => c.id)).size, r.length);
});

test('El descubrimiento de Meta las suma a las de /me/adaccounts', () => {
  const src = leer('../lib/meta-descubrir.ts');
  assert.match(src, /cuentas\.push\(\.\.\.await cuentasDePortafolios\(\(p, q\) => get\(p, limpio, q\), new Set\(cuentas\.map\(\(c\) => c\.id\)\)\)\)/);
  // Antes del aviso de «ninguna cuenta asignada»: si el portafolio trae una, el aviso no va.
  assert.ok(src.indexOf('cuentasDePortafolios((p, q)') < src.indexOf('no tiene ninguna cuenta publicitaria asignada'));
});
