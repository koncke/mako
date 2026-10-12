// =============================================================================
// MaKo Mobile — Customer Success en el teléfono: lo puro de app/m/cs/reglas.ts
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · el conteo es sobre los MIEMBROS del servicio, no sobre las filas de cliente_entrega: un
//     cliente que nunca se movió no tiene fila y está en la PRIMERA etapa;
//   · el orden manual guardado primero, y el resto por nombre;
//   · un cliente en una etapa que ya no existe va a «Etapa borrada» (no desaparece);
//   · lo movido en la sesión (overlay) pisa a los props, y `null` lo devuelve a la primera;
//   · «21 días sin moverse» con 21 días EXACTOS (el umbral de escritorio, DIAS_TRABADO), y
//     «hace 20 días» un segundo antes.
//
// Nació como script del agente de Customer Success (11/10/2026) y se sumó al repo en la
// integración. Verificado ROMPIÉNDOLO (base 4 / 0), de a una y restaurando
// (scratchpad/integ/romper.py). El reparto y el umbral son reglas COMPARTIDAS con escritorio
// (repartirEnEtapas, tiempoEnEtapa): acá se rompió lo propio del teléfono:
//   · el orden manual ignorado (todo por nombre)                       → 3 / 1
//   · lo movido en OTRO servicio pisando éste (sin el prefijo)         → 3 / 1
//   · `etapaDe` sin «sin fila = la primera»                            → 3 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asignacionCon, claveMov, etapaDe, gruposDe, siguienteEtapa, tiempoDe, GRUPO_BORRADA, type EtapaCs, type ServicioCs,
} from '../app/m/cs/reglas';

const ahora = Date.parse('2026-10-11T12:00:00Z');
const etapa = (key: string, label: string) => ({ key, label }) as EtapaCs;
const s: ServicioCs = {
  id: 7,
  nombre: 'Servicio',
  etapas: [etapa('a', 'A'), etapa('b', 'B'), etapa('c', 'C')],
  miembros: [1, 2, 3, 4, 5],
  filas: { 2: { etapa: 'b', desde: '2026-09-01T00:00:00Z' }, 3: { etapa: 'b', desde: '2026-10-09T00:00:00Z' }, 4: { etapa: 'zz', desde: null } },
  orden: { b: [3] },
  curso: null,
};
const nombres: Record<number, string> = { 1: 'Zoe', 2: 'Ana', 3: 'Beto', 4: 'Ceci', 5: 'Abel' };
const nombreDe = (id: number) => nombres[id];

test('el conteo es sobre los miembros: sin fila = primera etapa; huérfano = «Etapa borrada»', () => {
  const g = gruposDe(s, asignacionCon(s, {}), nombreDe);
  assert.deepEqual(g[0], { key: 'a', label: 'A', ids: [5, 1], borrada: false });
  assert.deepEqual(g[2].ids, []);
  assert.equal(g[3].key, GRUPO_BORRADA);
  assert.deepEqual(g[3].ids, [4]);
  assert.equal(g.reduce((n, x) => n + x.ids.length, 0), 5, 'los cinco miembros, repartidos');
});

test('el orden manual primero, después por nombre', () => {
  const g = gruposDe(s, asignacionCon(s, {}), nombreDe);
  assert.deepEqual(g[1].ids, [3, 2]);
});

test('lo movido en la sesión pisa a los props; null devuelve a la primera etapa', () => {
  const a = asignacionCon(s, { [claveMov(7, 1)]: { etapa: 'c', desde: null }, [claveMov(7, 2)]: null, [claveMov(8, 5)]: { etapa: 'c', desde: null } });
  const g = gruposDe(s, a, nombreDe);
  assert.deepEqual(g[0].ids, [5, 2], 'el 5 se movió en OTRO servicio: acá no cambia');
  assert.deepEqual(g[2].ids, [1]);
  const asig = asignacionCon(s, {});
  assert.equal(etapaDe(s, asig, 5), 'a');
  assert.equal(etapaDe(s, asig, 4), null);
  assert.equal(siguienteEtapa(s.etapas, 'a')?.key, 'b');
  assert.equal(siguienteEtapa(s.etapas, 'c'), null);
  assert.equal(siguienteEtapa(s.etapas, null), null);
});

test('«21 días sin moverse» con 21 exactos; un segundo menos es «hace 20 días»', () => {
  const asig = asignacionCon(s, {});
  assert.deepEqual(tiempoDe(asig[2], ahora), { texto: '40 días sin moverse', trabado: true });
  assert.deepEqual(tiempoDe(asig[3], ahora), { texto: 'hace 2 días', trabado: false });
  assert.equal(tiempoDe(asig[5], ahora), null);
  assert.deepEqual(tiempoDe({ etapa: 'b', desde: '2026-09-20T12:00:00Z' }, ahora), { texto: '21 días sin moverse', trabado: true });
  assert.deepEqual(tiempoDe({ etapa: 'b', desde: '2026-09-20T12:00:01Z' }, ahora), { texto: 'hace 20 días', trabado: false });
});
