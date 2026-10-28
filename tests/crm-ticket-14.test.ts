// =============================================================================
// Ticket #14 (Martín, ws9, 27/10/2026 20:14 UTC, /crm): «La pantalla CRM se rompió» con
// `TypeError: Cannot read properties of undefined (reading '…')` (el nombre de la propiedad, cortado; sin stack).
// =============================================================================
// No se pudo reproducir en el navegador (la rama no está desplegada y la sesión no tiene acceso al CRM de producción). Lo
// que se buscó: los accesos sin guarda del render de /crm que dan `undefined` con datos reales del ws9 (leads traídos de
// grupos de WhatsApp, sin nombre; links de Fathom guardados con otra forma). Los dos que leen `.trim()` —el `reading` del
// ticket— y los menores del mismo tipo, cada uno con su caso (docs/hallazgos-crm.md, «El ticket #14»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ordenarColumna, type DatoParaOrdenar } from '../app/crm/orden-kanban';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const fuente = (p: string) => sinComentarios(readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n'));

test('una columna ordenada por nombre con un lead SIN nombre no rompe el tablero', () => {
  type T = { id: number; nombre: string | null };
  const dato = (t: T) => ({ nombre: t.nombre, creado: null, respondio: 2, monto: null, reunion: null, vence: null }) as unknown as DatoParaOrdenar;
  const col: T[] = [{ id: 1, nombre: 'Zoe' }, { id: 2, nombre: null }, { id: 3, nombre: 'Ana' }];
  assert.deepEqual(ordenarColumna(col, 'nombre', dato).map((x) => x.id), [3, 1, 2], 'sin nombre, al final');
});

test('los links de Fathom con otra forma se normalizan antes de llegar a la pantalla', () => {
  // `fathomDeFila` vive en crm-map, que arrastra lecturas del server: se lee su cuerpo y se lo ejecuta aparte.
  const src = readFileSync(join(RAIZ, 'app/crm/crm-map.ts'), 'utf8').replace(/\r\n/g, '\n'); // con CRLF (autocrlf en Windows) no aparece el cierre de la función
  const ini = src.indexOf('export function fathomDeFila(');
  const fin = src.indexOf('\n}\n', ini) + 2;
  assert.ok(ini > 0 && fin > ini, 'no está fathomDeFila');
  const ts = src.slice(ini, fin).replace(/^export /, '').replace(/: unknown/g, '').replace(/: \{ label: string; url: string \}\[\]/g, '')
    .replace(/ as Record<string, unknown>/g, '');
  const fathomDeFila = new Function(`${ts}; return fathomDeFila;`)() as (v: unknown) => Array<{ label: string; url: string }>;
  assert.deepEqual(fathomDeFila([{ label: 'Reunión 1' }, 'https://fathom.video/x', { url: 'https://f/y', label: 'R2' }, null, 7, {}]), [
    { label: 'Reunión 1', url: '' }, { label: '', url: 'https://fathom.video/x' }, { label: 'R2', url: 'https://f/y' },
  ]);
  assert.deepEqual(fathomDeFila(null), []);
  assert.match(fuente('app/crm/crm-map.ts'), /fathom: fathomDeFila\(l\.fathom_links\),/);
});

test('el asistente de mover no lee `.trim()` de un link sin url, y el resto de los accesos tiene su guarda', () => {
  const d = fuente('app/crm/StageMoveDialog.tsx');
  assert.doesNotMatch(d, /f\.url\.trim\(\)|f\.label\.trim\(\)/, 'volvió un `f.url.trim()` sin guarda');
  assert.match(d, /\(r\.faltante \?\? \[\]\)\.map/);
  assert.match(fuente('app/crm/TarjetaReunion.tsx'), /\(r1\.objeciones \?\? \[\]\)\.map/);
  const b = fuente('app/crm/CrmBoard.tsx');
  assert.match(b, /if \(v\?\.length\) out\.set\(Number\(k\), v\);/);
  assert.match(b, /CATEGORY\[o\.category\]\?\.c \?\? 'var\(--dim\)'/);
});
