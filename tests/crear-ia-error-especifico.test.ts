// =============================================================================
// Crear con IA: si lo que armó MaKo no pasa la revisión, el error DICE qué quedó mal (punto 10 del 13/10/2026)
// =============================================================================
// Martín, reunión del 13/10 (Fathom 858545195 @65:34): «ante un fallo en la generación por IA de un flujo, devuelva una
// descripción técnica específica en lugar de un aviso genérico». Decía «MaKo armó el flujo pero quedó mal» y el detalle
// iba sólo al log (los errores de `validarGrafo` traen ids internos). Ahora `falloDeRevision` (lib/flujo-ia.ts) dice el
// primero, con el id cambiado por el nombre de la tarjeta (`errorLegible`, el de Publicar), y cuántos más.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), cada rotura de a una y restaurada. Pasan / fallan:
//   R1 sin `errorLegible` (el id interno llega a la pantalla)                             → 2 / 1
//   R2 `generar` vuelve al texto genérico                                                  → 2 / 1
//
// Correr: node --import tsx --test tests/crear-ia-error-especifico.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { falloDeRevision } from '../lib/flujo-ia';
import type { PasoGrafo } from '../lib/flujo-grafo';

const PASOS: PasoGrafo[] = [{ id: 'm2', canal: 'whatsapp', cuerpo: 'Hola, te escribo por la reunión', siguiente: null, delay_horas: 0 }];

test('dice el primer problema con el NOMBRE de la tarjeta, no su id, y cuántos más hay', () => {
  const t = falloDeRevision(['tarjetas sueltas: m2', 'la condición c1 no tiene filas'], PASOS);
  assert.match(t, /^MaKo armó el flujo pero quedó mal: /);
  assert.ok(!/\bm2\b/.test(t), `llegó el id interno: ${t}`);
  assert.ok(t.includes('Hola, te escribo'), t);
  assert.ok(t.includes('(y 1 más)'), t);
});

test('un problema largo se corta: es un texto que se dibuja', () => {
  const t = falloDeRevision(['x'.repeat(500)], []);
  assert.ok(t.length < 260, `mide ${t.length}`);
});

const CREAR = readFileSync(new URL('../lib/flujo-ia-crear.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
test('generar() usa el motivo específico cuando la salida no pasó la revisión', () => {
  assert.match(CREAR, /return \{ error: falloDeRevision\(ultimo, \(ultimoR as \{ pasos\?: PasoGrafo\[\] \} \| null\)\?\.pasos \?\? \[\]\) \};/);
  assert.ok(!CREAR.includes("'MaKo armó el flujo pero quedó mal. Prueba de nuevo"), 'volvió el texto genérico');
});
