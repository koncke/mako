// =============================================================================
// El Archivero guarda DE DÓNDE vino cada documento (17/10/2026, mig 0316)
// =============================================================================
// docs/relevo/offer.md: «`archivero_files` no guarda de dónde vino un documento (pide migración)». Desde el 15/10 el
// chat de Offer deja sus archivos en El Archivero y desde el 17/10 el onboarding deja «Lo que vendes»: en la lista se
// veían igual que lo que la persona subió a mano. Ahora cada fila dice su `origen`, y la lista lo muestra.
// La migración puede llegar antes o después del deploy: sin la columna, se lee y se escribe sin ella.
//
// PROBADO ROMPIÉNDOLO (17/10/2026): `faltaOrigen` sin PGRST204 → 3 / 2; `insertarConOrigen` que no reintenta → 4 / 1;
// que reintenta ante cualquier error → 4 / 1; el chat de Offer sin `origen: 'offer'` → 4 / 1; la lista sin el rótulo
// → 4 / 1. Base: 5 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { faltaOrigen, insertarConOrigen, leerConOrigen, type FilaDb } from '../lib/archivero-registro';
import { ORIGENES_ARCHIVERO, ROTULO_ORIGEN } from '../lib/archivero-subida';

const leer = (p: string): string => readFileSync(join(__dirname, '..', p), 'utf8');
const SIN_COLUMNA_LEER = { code: '42703', message: 'column archivero_files.origen does not exist' };
const SIN_COLUMNA_ESCRIBIR = { code: 'PGRST204', message: "Could not find the 'origen' column of 'archivero_files' in the schema cache" };
const callar = (): void => {};

test('faltaOrigen: sólo cuando el error es la columna `origen` (al leer o al escribir)', () => {
  assert.equal(faltaOrigen(SIN_COLUMNA_LEER), true);
  assert.equal(faltaOrigen(SIN_COLUMNA_ESCRIBIR), true);
  assert.equal(faltaOrigen({ code: '42703', message: 'column archivero_files.campos does not exist' }), false);
  assert.equal(faltaOrigen({ code: '23505', message: 'duplicate key value violates unique constraint' }), false);
  assert.equal(faltaOrigen(null), false);
});

test('insertar: con la columna va el origen; sin ella, la fila entra igual; otro error NO se reintenta', async () => {
  const fila: FilaDb = { id: 'a', nombre: 'oferta.pdf' };
  const conColumna: FilaDb[] = [];
  assert.equal(await insertarConOrigen(async (x) => { conColumna.push(x); return { error: null }; }, fila, 'offer', callar), null);
  assert.deepEqual(conColumna, [{ id: 'a', nombre: 'oferta.pdf', origen: 'offer' }]);

  const sinColumna: FilaDb[] = [];
  const e1 = await insertarConOrigen(async (x) => { sinColumna.push(x); return { error: 'origen' in x ? SIN_COLUMNA_ESCRIBIR : null }; }, fila, 'offer', callar);
  assert.equal(e1, null);
  assert.deepEqual(sinColumna, [{ id: 'a', nombre: 'oferta.pdf', origen: 'offer' }, { id: 'a', nombre: 'oferta.pdf' }]);

  let veces = 0;
  const dup = { code: '23505', message: 'duplicate key' };
  assert.deepEqual(await insertarConOrigen(async () => { veces++; return { error: dup }; }, fila, 'offer', callar), dup);
  assert.equal(veces, 1);

  const sinOrigen: FilaDb[] = [];
  await insertarConOrigen(async (x) => { sinOrigen.push(x); return { error: null }; }, fila, undefined, callar);
  assert.deepEqual(sinOrigen, [fila]);
});

test('leer: sin la columna se lee de nuevo sin ella; con otro error no', async () => {
  let sin = 0;
  const r = await leerConOrigen<FilaDb[]>(async () => ({ data: null, error: SIN_COLUMNA_LEER }), async () => { sin++; return { data: [{ id: 'a' }], error: null }; }, callar);
  assert.deepEqual(r, { data: [{ id: 'a' }], error: null });
  assert.equal(sin, 1);
  const otro = { code: '57014', message: 'canceling statement due to statement timeout' };
  const r2 = await leerConOrigen<FilaDb[]>(async () => ({ data: null, error: otro }), async () => { sin++; return { data: [], error: null }; }, callar);
  assert.deepEqual(r2.error, otro);
  assert.equal(sin, 1);
});

test('cada puerta dice de dónde viene, y la migración permite exactamente esos', () => {
  assert.match(leer('lib/archivero.ts'), /registrarDocumentoSinPisar[\s\S]*?insertFile\(ws, \{[^}]*origen: 'offer' \}\)/);
  assert.match(leer('lib/onboarding-arranque-server.ts'), /razonamiento: RAZON_LO_QUE_VENDES, campos: \{\}, origen: 'onboarding' \}/);
  const ruta = leer('app/api/onboarding/archivero/route.ts');
  assert.equal((ruta.match(/origen: 'archivero' \}/g) ?? []).length, 2);
  assert.equal((ruta.match(/origen: 'link' \}/g) ?? []).length, 1);
  const sql = leer('supabase/migrations/0316_archivero_origen.sql');
  const permitidos = /origen in \(([^)]*)\)/.exec(sql)?.[1].split(',').map((x) => x.trim().replace(/'/g, ''));
  assert.deepEqual(permitidos, [...ORIGENES_ARCHIVERO]);
});

test('la lista de El Archivero muestra lo que NO subió la persona', () => {
  assert.match(leer('lib/archivero.ts'), /origen: f\.origen \?\? null/);
  const ui = leer('app/onboarding/Archivero.tsx');
  assert.match(ui, /f\.origen && ROTULO_ORIGEN\[f\.origen\] \? ` · \$\{ROTULO_ORIGEN\[f\.origen\]\}`/);
  assert.equal(ROTULO_ORIGEN.offer, 'Del chat de Offer');
  assert.equal(ROTULO_ORIGEN.onboarding, 'Del onboarding');
  assert.equal(ROTULO_ORIGEN.archivero, undefined);
});
