// =============================================================================
// El compare-and-set de app_settings con un valor LARGO (28/10/2026)
// =============================================================================
// `cambiarSettingSi` comparaba con `.eq('value', esperado)`, y PostgREST pone ese filtro en la URL: pasados ~6 KB se cae
// como «fetch failed» (medido el 12/10). Estaba escrito (docs/hallazgos-infra.md) y Copywriter volvió a caer el 28/10; ese
// día el historial del onboarding ya pasaba los 6 KB en cuatro negocios. Ahora, con un `esperado` largo, cambiarSettingSi
// lee la fila, compara en el server y escribe filtrando por `updated_at` (lib/settings-cas.ts).
// Corre lib/settings.ts REAL en un node aparte (`--experimental-test-module-mocks`, como tests/onboarding-hilo-carrera),
// con una base de mentira que anota cada filtro: un `esperado` largo NUNCA viaja en un `.eq('value', …)`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { CAS_ESPERADO_MAX, cabeEnLaUrl, despuesDe, largoEnLaUrl } from '../lib/settings-cas';

const RAIZ = join(import.meta.dirname, '..');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

test('qué cabe en la URL: se mide codificado, y null siempre cabe', () => {
  assert.equal(cabeEnLaUrl(null), true);
  assert.equal(cabeEnLaUrl('a'.repeat(CAS_ESPERADO_MAX)), true);
  assert.equal(cabeEnLaUrl('a'.repeat(CAS_ESPERADO_MAX + 1)), false);
  // Un JSON de 3 KB con comillas pesa más del triple en la URL.
  const json = JSON.stringify({ t: '"'.repeat(2500) });
  assert.ok(json.length < CAS_ESPERADO_MAX && largoEnLaUrl(json) > CAS_ESPERADO_MAX);
  assert.equal(cabeEnLaUrl(json), false);
});

test('despuesDe: la de ahora, o 1 ms después de la leída si el reloj no avanzó', () => {
  const t = '2026-10-28T20:00:00.000Z';
  assert.equal(despuesDe(t, Date.parse(t)), '2026-10-28T20:00:00.001Z');
  assert.equal(despuesDe(t, Date.parse(t) + 5000), '2026-10-28T20:00:05.000Z');
  assert.equal(despuesDe(null, Date.parse(t)), t);
});

const HIJO = `
import { mock } from 'node:test';
const filas = new Map();          // key -> { value, updated_at }
const filtros = [];               // cada .eq/.is que se pidió: [columna, valor]
let antesDeEscribir = null;       // para simular otro escritor entre la lectura y la escritura
const consulta = (op, cambio) => {
  const conds = [];
  const q = {
    eq(c, v) { conds.push([c, v]); filtros.push([c, v]); return q; },
    is(c, v) { conds.push([c, v]); filtros.push([c, v]); return q; },
    select() { return q; },
    async maybeSingle() { const k = conds.find(([c]) => c === 'key')[1]; const f = filas.get(k); return { data: f ? { ...f } : null, error: null }; },
    then(res, rej) {
      return (async () => {
        if (antesDeEscribir) { const f = antesDeEscribir; antesDeEscribir = null; f(); }
        const k = conds.find(([c]) => c === 'key')[1];
        const f = filas.get(k);
        if (op === 'update') {
          const ok = f && conds.every(([c, v]) => c === 'workspace_id' || c === 'key' || (c === 'value' ? f.value === v : f.updated_at === v));
          if (!ok) return { data: [], error: null };
          filas.set(k, { ...f, ...cambio });
          return { data: [{ key: k }], error: null };
        }
        return { data: [], error: null };
      })().then(res, rej);
    },
  };
  return q;
};
mock.module(${url('lib/supabase.ts')}, { namedExports: { getSupabaseServer: () => ({ from: () => ({
  select: () => consulta('select'),
  update: (cambio) => consulta('update', cambio),
  upsert: () => consulta('upsert'),
}) }) } });
mock.module(${url('lib/workspace.ts')}, { namedExports: { getWorkspaceActual: async () => 3, wsObligatorio: async () => 3, WS_NINGUNO: 0 } });
mock.module(${url('lib/webhook-routing.ts')}, { namedExports: { upsertRouting: async () => {} } });
const { cambiarSettingSi } = await import(${url('lib/settings.ts')});
const largo = JSON.stringify({ guion: 'x'.repeat(20000) });
const nuevo = JSON.stringify({ guion: 'y'.repeat(20000) });
const out = {};

filas.set('g', { value: largo, updated_at: '2026-10-28T20:00:00.000Z' });
out.gana = await cambiarSettingSi('g', largo, nuevo);
out.quedo = filas.get('g').value === nuevo;
out.fechaAvanzo = filas.get('g').updated_at > '2026-10-28T20:00:00.000Z';
out.valorLargoEnFiltro = filtros.some(([c, v]) => c === 'value' && typeof v === 'string' && v.length > 6000);

filtros.length = 0;
out.otroValor = await cambiarSettingSi('g', largo, 'z');          // ya no vale «largo»: pierde y no escribe
out.siguio = filas.get('g').value === nuevo;

filas.set('h', { value: largo, updated_at: '2026-10-28T21:00:00.000Z' });
antesDeEscribir = () => filas.set('h', { value: largo, updated_at: '2026-10-28T21:00:01.000Z' });   // otro escribió en el medio
out.carrera = await cambiarSettingSi('h', largo, nuevo);
out.carreraNoPiso = filas.get('h').value === largo;

filas.set('c', { value: 'corto', updated_at: '2026-10-28T22:00:00.000Z' });
filtros.length = 0;
out.corto = await cambiarSettingSi('c', 'corto', 'nuevo');
out.cortoPorValor = filtros.some(([c, v]) => c === 'value' && v === 'corto');
console.log('RESULTADO ' + JSON.stringify(out));
`;

test('cambiarSettingSi con un valor largo: compara en el server, filtra por updated_at y pierde si otro escribió en el medio', () => {
  const salida = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', HIJO,
  ], { cwd: RAIZ, encoding: 'utf8' });
  const linea = salida.split('\n').find((l) => l.startsWith('RESULTADO '));
  assert.ok(linea, salida);
  const r = JSON.parse(linea.slice('RESULTADO '.length));
  assert.equal(r.gana, true, 'el valor largo que sigue igual gana');
  assert.equal(r.quedo, true);
  assert.equal(r.fechaAvanzo, true, 'escribe una fecha posterior a la leída');
  assert.equal(r.valorLargoEnFiltro, false, 'un esperado largo nunca va en el filtro de la URL');
  assert.equal(r.otroValor, false, 'si ya no vale lo esperado, pierde');
  assert.equal(r.siguio, true, 'y no escribe');
  assert.equal(r.carrera, false, 'si otro escribió entre la lectura y la escritura, pierde');
  assert.equal(r.carreraNoPiso, true, 'y no pisa lo del otro');
  assert.equal(r.corto, true, 'un valor corto sigue como siempre');
  assert.equal(r.cortoPorValor, true, 'comparando el valor en el filtro');
});
