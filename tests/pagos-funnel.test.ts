// =============================================================================
// #897: cada PAGO guarda de qué funnel es (mig 0310), y los lectores lo prefieren
// =============================================================================
// Un OKR o un KPI de UNOS funnels (mig 0306) repartía cada pago en el funnel donde estaba su lead el día del PAGO: una
// cuota de la venta del VSL cobrada DESPUÉS de agregar al lead a «Renovación» contaba en Renovación. Ahora el pago guarda
// el funnel de cuando SE CREÓ (un trigger, con la misma regla), y:
//   1. un hecho con `funnel` manda sobre `funnelDelMomento` (se EJECUTA `sumarEnFunnels` con el caso del VSL);
//   2. sin la columna (la migración sin aplicar), los lectores reintentan sin ella: nunca un cero ni una pantalla caída;
//   3. los TRES lectores lo usan igual: el avance de un OKR, los gráficos de pagos y el desglose de /general (si no, el
//      pop-up lista lo que el número no suma);
//   4. la migración: aditiva, el trigger sólo llena lo vacío al INSERTAR, el backfill con el día en que se creó.
//
// PROBADO ROMPIÉNDOLO (17/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · `filtrarEnFunnels` sin mirar el `funnel` del hecho                         → 3 / 1
//   · `faltaColumnaFunnel` que no reconoce el 42703                              → 3 / 1
//   · el desglose de /general sin pasar el `funnel` (funnels-elegidos-server)     → 3 / 1
//   · el trigger pisando un funnel que ya venía (sin `new.funnel_id is null`)     → 3 / 1
// Correr: node --import tsx --test tests/pagos-funnel.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { faltaColumnaFunnel, sumarEnFunnels, type Agregado, type Hecho } from '../lib/funnels-elegidos';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const VSL = 10;
const RENOVACION = 20;

test('el funnel que guardó el pago manda: la cuota del VSL cobrada después de pasar a Renovación es del VSL', () => {
  // El lead 1 es del VSL (su casa) y se lo agregó a Renovación el 13/10.
  const casas = new Map<number, number | null>([[1, VSL]]);
  const agregados = new Map<number, Agregado[]>([[1, [{ funnel: RENOVACION, desde: '2026-10-13T00:00:00Z' }]]]);
  const cuotaVieja: Hecho = { lead: 1, fecha: '2026-11-05', valor: 300, funnel: VSL };
  const renovacion: Hecho = { lead: 1, fecha: '2026-11-05', valor: 500, funnel: RENOVACION };
  const sinColumna: Hecho = { lead: 1, fecha: '2026-11-05', valor: 70 };
  assert.equal(sumarEnFunnels([cuotaVieja, renovacion, sinColumna], [VSL], casas, agregados), 300, 'la cuota de la venta del VSL es del VSL');
  // Sin el funnel guardado, la regla de siempre: el día del pago, ya estaba en Renovación.
  assert.equal(sumarEnFunnels([cuotaVieja, renovacion, sinColumna], [RENOVACION], casas, agregados), 570);
  // Los dos funnels juntos suman todo, sin contar nada dos veces.
  assert.equal(sumarEnFunnels([cuotaVieja, renovacion, sinColumna], [VSL, RENOVACION], casas, agregados), 870);
});

test('sin la columna (la migración sin aplicar), los lectores reintentan sin ella', () => {
  assert.equal(faltaColumnaFunnel({ code: '42703', message: 'column pagos.funnel_id does not exist' }), true);
  assert.equal(faltaColumnaFunnel(new Error('column "funnel_id" does not exist')), true);
  assert.equal(faltaColumnaFunnel(new Error('permission denied for table pagos')), false, 'otro error no se tapa');
  assert.equal(faltaColumnaFunnel({ code: '42703', message: 'column pagos.otra does not exist' }), false);
  const okr = leer('lib/objectives-fuentes.ts');
  assert.match(okr, /leerPagos\('id, lead_id, monto_usd, fecha_pago, funnel_id'\)\s*\.catch\(\(e: unknown\) => \{ if \(faltaColumnaFunnel\(e\)\) return leerPagos\('id, lead_id, monto_usd, fecha_pago'\); throw e; \}\);/);
  const graf = leer('lib/graficos-datos.ts');
  assert.match(graf, /if \(faltaColumnaFunnel\(e\)\) return leerPagos\('id, lead_id, numero, monto_usd, fecha_esperada, pagado, fecha_pago'\); throw e;/);
  const pagos = leer('lib/pagos.ts');
  assert.match(pagos, /cashCon\.error && faltaColumnaFunnel\(cashCon\.error\)\s*\? await cashSin\(\)/);
});

test('los tres lectores usan el funnel guardado: el OKR, los gráficos y el desglose de /general', () => {
  assert.match(leer('lib/objectives-fuentes.ts'), /funnel: p\.funnel_id == null \? null : Number\(p\.funnel_id\)/);
  assert.match(leer('lib/graficos-datos.ts'), /const funnel = x\.funnel_id != null \? Number\(x\.funnel_id\)/);
  assert.match(leer('lib/pagos.ts'), /leadId: Number\(r\.lead_id\), funnel: r\.funnel_id == null \? null : Number\(r\.funnel_id\) \}/);
  assert.match(leer('lib/funnels-elegidos-server.ts'), /\(x\) => \(\{ lead: x\.leadId, fecha: x\.fecha, funnel: x\.funnel \}\)/, 'el desglose no pasa el funnel: listaría lo que el número no suma');
});

test('la migración: aditiva, el trigger sólo llena lo vacío al insertar, y el backfill con el día en que se creó', () => {
  const m = leer('supabase/migrations/0310_pagos_funnel.sql');
  assert.match(m, /alter table pagos add column if not exists funnel_id bigint references funnels\(id\) on delete set null;/);
  assert.match(m, /if new\.funnel_id is null and new\.lead_id is not null then/, 'el trigger pisa un funnel que ya venía');
  assert.match(m, /create trigger pagos_funnel before insert on pagos for each row/);
  assert.doesNotMatch(m, /before update|drop column|delete from/i, 'la migración tiene que ser sólo aditiva');
  assert.match(m, /lf\.created_at::date <= p\.created_at::date/, 'el backfill usa el día en que se creó el pago');
  assert.match(m, /where l\.id = p\.lead_id and p\.funnel_id is null;/, 'el backfill no es idempotente');
  assert.match(m, /f\.es_default/, 'la casa NULL es el funnel del negocio');
});
