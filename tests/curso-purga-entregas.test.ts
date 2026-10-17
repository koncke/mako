// =============================================================================
// Las entregas de los alumnos (voces y caras) entran a la purga del curso (17/10/2026)
// =============================================================================
// Hasta el 17/10/2026 el bucket `curso-entregas` (mig 0218) no lo barría nadie: lo que el alumno quitaba o
// regrababa, y lo de una clase o un lead borrados (sus filas de `curso_progreso` se van en CASCADA, el
// archivo no), quedaba para siempre (docs/hallazgos-customer-success.md → «El curso tipo Skool, tanda 1»).
// Las rutas viven ADENTRO de dos jsonb (`valores` y `valores_ia`), así que el bucket entra a la purga con
// un modo propio: las referencias salen de los jsonb y la segunda pregunta relee la tabla.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esEntregaSubida, pathsDeEntregas, type Valores } from '../lib/curso';
import { decidirPurga } from '../app/customer-success/curso/reglas';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const entre = (s: string, desde: string, hasta: string) => {
  const i = s.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = s.indexOf(hasta, i + desde.length);
  return s.slice(i, j < 0 ? undefined : j);
};

const U = (n: number) => `0000000${n}-0000-4000-8000-000000000000`.slice(-36);
const P = (clase: number, n: number, ext = 'webm') => `3/43/2664/${clase}/${U(n)}.${ext}`;
const VIEJO = '2026-10-10T00:00:00Z';
const AHORA = Date.parse('2026-10-17T12:00:00Z');

// Verificado rompiéndolo (el archivo da 3 / 0): la config sin `valores_ia` en sus rutas → 2 / 1 (éste).
test('las rutas en uso salen de valores Y de valores_ia; lo regrabado y lo de una clase borrada queda huérfano', () => {
  const valores: Valores = { voz: [{ path: P(165, 2), nombre: 'voz.webm' }] as unknown as Valores[string] };
  const valoresIa: Valores = { cara: [{ path: P(165, 3, 'mp4') }] as unknown as Valores[string] };
  const usadas = [...pathsDeEntregas(valores), ...pathsDeEntregas(valoresIa)];
  assert.deepEqual(usadas, [P(165, 2), P(165, 3, 'mp4')]);
  const archivos = [
    { path: P(165, 1), createdAt: VIEJO },          // regrabado: ya no lo nombra ninguna fila
    { path: P(165, 2), createdAt: VIEJO },          // en `valores`
    { path: P(165, 3, 'mp4'), createdAt: VIEJO },   // en `valores_ia`: la propuesta de la IA también es uso
    { path: P(999, 4), createdAt: VIEJO },          // de una clase borrada (su progreso se fue en cascada)
    { path: P(165, 5), createdAt: '2026-10-17T11:00:00Z' }, // recién subido: la guarda de 24 h lo salva
  ];
  const d = decidirPurga({ archivos, referencias: { ok: true, paths: usadas }, ahoraMs: AHORA, esPropio: esEntregaSubida });
  assert.deepEqual(d.borrar.sort(), [P(165, 1), P(999, 4)].sort());
  // La config de la purga lee las DOS columnas y saca las rutas de las dos.
  const src = leer('lib/curso-purga.ts');
  const cfg = entre(src, 'bucket: BUCKET_ENTREGAS', '\n  },\n];');
  assert.match(cfg, /tabla: 'curso_progreso'/);
  assert.match(cfg, /esPropio: esEntregaSubida/);
  assert.match(cfg, /columnas: 'valores, valores_ia'/);
  assert.match(cfg, /pathsDeEntregas\(f\.valores as Valores \| null\), \.\.\.pathsDeEntregas\(f\.valores_ia as Valores \| null\)/);
});

// Verificado rompiéndolo: sin el `if (cfg.jsonb)` de `rutasUsadas` (leería `valores` como si fuera una ruta) → 2 / 1.
test('rutasUsadas lee el jsonb entero, de TODOS los workspaces, y no filtra por una columna de ruta', () => {
  const src = leer('lib/curso-purga.ts');
  const rutas = entre(src, 'async function rutasUsadas(', '\n}\n');
  assert.match(rutas, /if \(cfg\.jsonb\) \{[\s\S]*leerTodo<Record<string, unknown>>\(getSupabaseServer\(\), cfg\.tabla, `id, \$\{jsonb\.columnas\}`, \{ orden: 'id' \}\)/);
  assert.doesNotMatch(src, /getTenantDb\(|runWithWorkspace\(/, 'cruzar el bucket contra UN inquilino borra lo de los demás');
});

// Verificado rompiéndolo: sin el `return r` cuando la relectura falla → 2 / 1 (éste).
test('la segunda pregunta de un jsonb relee la tabla ANTES de borrar, y si falla no borra nada', () => {
  const src = leer('lib/curso-purga.ts');
  const purgar = entre(src, 'async function purgarBucket(', '\nexport async function purgarHuerfanosDelCurso(');
  const iRelee = purgar.indexOf('vivosJsonb = new Set(await rutasUsadas(cfg));');
  assert.ok(iRelee > 0 && iRelee < purgar.indexOf('.remove(borrar)'), 'se borra sin volver a preguntar');
  assert.match(purgar, /catch \(e\) \{ r\.error = `releer \$\{cfg\.tabla\}: \$\{msg\(e\)\}`; return r; \}/);
  assert.ok(purgar.indexOf('if (!candidatos.length || !borra) return r;') < iRelee, 'el modo prueba relee de más');
});
