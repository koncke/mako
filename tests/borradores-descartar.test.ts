// =============================================================================
// El único camino para descartar borradores de una automatización (lib/borradores-descartar.ts)
// =============================================================================
// Lo usan archivar y el aviso al activar. Con una base de mentira que registra qué le pidieron: los tests de archivar leían el fuente, y un descarte mal
// dirigido o sin historial pasaba igual (lo encontró la revisión del 30/10/2026).
//
// Correr: node --import tsx --test tests/borradores-descartar.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descartarBorradoresAnotando, type BorradorDescartado, type DbDescarte } from '../lib/borradores-descartar';

function base(o: { filas?: (valores: readonly number[]) => BorradorDescartado[]; fallaEnTanda?: number; fallaHistorial?: boolean } = {}) {
  const pedidos: Array<{ estado: string; campo: string; valores: number[]; filtro: [string, string]; select: string }> = [];
  const historial: unknown[][] = [];
  const db: DbDescarte = {
    from(tabla: string) {
      return {
        update(v: { estado: string }) {
          assert.equal(tabla, 'wa_borradores');
          return {
            in: (campo: string, valores: readonly number[]) => ({
              eq: (c: string, valor: string) => ({
                select: async (s: string) => {
                  pedidos.push({ estado: v.estado, campo, valores: [...valores], filtro: [c, valor], select: s });
                  if (pedidos.length === o.fallaEnTanda) return { data: null, error: { message: 'se cayó' } };
                  return { data: o.filas ? o.filas(valores) : valores.map((x) => ({ lead_id: x, secuencia_id: 9 })), error: null };
                },
              }),
            }),
          };
        },
        insert: async (f: unknown[]) => {
          assert.equal(tabla, 'lead_audit');
          historial.push(f);
          return { data: null, error: o.fallaHistorial ? { message: 'sin historial' } : null };
        },
      };
    },
  };
  return { db, pedidos, historial };
}

test('por ids descarta esos, por automatización descarta los de ella, y siempre sólo los PENDIENTES', async () => {
  const a = base();
  assert.equal((await descartarBorradoresAnotando(a.db, { ids: [1, 2] }, () => 'x')).length, 2);
  assert.deepEqual(a.pedidos, [{ estado: 'descartado', campo: 'id', valores: [1, 2], filtro: ['estado', 'pendiente'], select: 'lead_id, secuencia_id' }]);
  const b = base();
  await descartarBorradoresAnotando(b.db, { secuencias: [282] }, () => 'x');
  assert.equal(b.pedidos[0].campo, 'secuencia_id');
  assert.deepEqual(b.pedidos[0].valores, [282]);
});

test('cada lead lo tiene en su historial, con el motivo y con quién fue; uno sin lead no se anota', async () => {
  const a = base({ filas: () => [{ lead_id: 10, secuencia_id: 282 }, { lead_id: null, secuencia_id: 282 }] });
  const r = await descartarBorradoresAnotando(a.db, { ids: [1, 2] }, (b) => `de la ${b.secuencia_id}`, 'alguien@negocio');
  assert.equal(r.length, 2, 'cuenta lo descartado, también el que no tiene lead');
  assert.deepEqual(a.historial, [[{ lead_id: 10, campo: 'Automatización', valor_anterior: null, autor: 'alguien@negocio', valor_nuevo: 'de la 282' }]]);
  // Por defecto lo firma MaKo, como archivar.
  const b = base();
  await descartarBorradoresAnotando(b.db, { ids: [1] }, () => 'x');
  assert.equal((b.historial[0][0] as { autor: string }).autor, 'MaKo');
  // Nada descartado, nada anotado.
  const c = base({ filas: () => [] });
  assert.deepEqual(await descartarBorradoresAnotando(c.db, { ids: [1] }, () => 'x'), []);
  assert.deepEqual(c.historial, []);
});

test('de a 200: una lista larga no entra en la URL', async () => {
  const a = base();
  const ids = Array.from({ length: 450 }, (_, i) => i + 1);
  assert.equal((await descartarBorradoresAnotando(a.db, { ids }, () => 'x')).length, 450);
  assert.deepEqual(a.pedidos.map((p) => p.valores.length), [200, 200, 50]);
  assert.deepEqual(a.pedidos.flatMap((p) => p.valores), ids);
});

test('⚠️ si una tanda falla, lo ya descartado se anota igual, y recién después avisa; no sigue con las otras', async () => {
  const a = base({ fallaEnTanda: 2 });
  const ids = Array.from({ length: 450 }, (_, i) => i + 1);
  await assert.rejects(descartarBorradoresAnotando(a.db, { ids }, () => 'x'), /se cayó/);
  assert.equal(a.pedidos.length, 2);
  assert.equal(a.historial[0].length, 200, 'los 200 de la primera tanda quedaron sin renglón');
});

test('si no se pudo anotar, el descarte vale: el mensaje ya no sale', async () => {
  const a = base({ fallaHistorial: true });
  const log = console.error;
  const dichos: string[] = [];
  console.error = (m: string) => { dichos.push(m); };
  try {
    assert.equal((await descartarBorradoresAnotando(a.db, { ids: [1] }, () => 'x')).length, 1);
  } finally { console.error = log; }
  assert.match(dichos.join(), /no pude anotar los borradores descartados: sin historial/);
});
