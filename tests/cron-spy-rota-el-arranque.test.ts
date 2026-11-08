// =============================================================================
// El cron de Spy rota el arranque, o la cola no se lee nunca (8/11/2026)
// =============================================================================
// Martín: «agregaste un montón de competidores pero está vacío al entrar en detalles, no tiene
// nada». Medido en producción, ws 9: los 6 competidores viejos tenían entre 134 y 772 piezas y los
// 17 dados de alta después estaban los 17 en CERO, veinte horas y ~20 corridas más tarde.
//
// La causa: el cron recorría con `.order('id')` —siempre del más viejo al más nuevo— y corta
// cuando se le acaba el plazo. Los últimos no se leían TARDE: no se leían, y con orden fijo no les
// iba a llegar el turno nunca mientras los de adelante siguieran dando trabajo.
//
// ⚠️ La rotación va por HORA, no por un cursor guardado: el cron corre una vez por hora, así que en
// un día cada competidor arranca primero al menos una vez, y no hay estado nuevo que desincronizar.
//
// Correr: node --import tsx --test tests/cron-spy-rota-el-arranque.test.ts
// ROTURAS (8/11/2026, una por vez y restaurada; base 3 / 0): volver a recorrer `data` directo
// → 2 / 1; rotar con un índice fijo en vez de la hora → 2 / 1; sacar la guarda de lista vacía
// (que haría `% 0` = NaN y no recorrería nada) → 2 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'app/api/cron/spy-todo/route.ts'), 'utf8');

test('el recorrido arranca en un punto que depende de la hora', () => {
  assert.match(src, /const desde = lista\.length \? new Date\(\)\.getUTCHours\(\) % lista\.length : 0;/,
    'sin rotación, los últimos de la lista no se leen nunca');
  assert.match(src, /const enOrden = \[\.\.\.lista\.slice\(desde\), \.\.\.lista\.slice\(0, desde\)\];/,
    'y tiene que dar la vuelta completa: rotar sin envolver deja fuera a los de adelante');
  assert.match(src, /for \(const c of enOrden\)/, 'se recorre el rotado, no la lista cruda');
});

test('⚠️ con la lista vacía no se divide por cero', () => {
  // `% 0` da NaN y `slice(NaN)` se comporta como `slice(0)`: no rompería, pero la guarda deja la
  // intención escrita y evita que alguien la saque pensando que sobra.
  assert.match(src, /lista\.length \?/, 'la guarda de lista vacía va explícita');
});

test('⚠️ y el corte por plazo SIGUE: rotar no es procesar todo de una', () => {
  // La mitad que protege lo contrario. Sin el corte, la función se pasa del maxDuration y muere a
  // mitad, que es el bug hermano que ya costó caro en la transcripción de YouTube.
  assert.match(src, /if \(Date\.now\(\) \+ UN_PASO_MS > deadline\) break;/,
    'el plazo se respeta igual: lo que cambia es POR DÓNDE se empieza');
});
