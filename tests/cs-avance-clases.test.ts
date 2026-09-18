// =============================================================================
// Qué clase vio cada cliente y qué hizo con su tarea
// =============================================================================
// `lib/cs-avance-clases.ts` decide qué ve Mauricio en la ficha de un cliente: por
// clase, si la vio (con fecha), si contestó y si aprobó. Los casos de abajo son
// los que, mal resueltos, le muestran una mentira que no puede detectar desde la
// pantalla:
//
//   · la clase que VIO y NO contestó, que es el motivo de toda la pantalla;
//   · las clases de los módulos POR ÁREA, donde la fila sin área es solo la marca
//     de «vio» y leerla como la tarea da «sin contestar» a una clase contestada;
//   · el ORDEN, que tiene que ser el del programa y no el alfabético del id.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avancePorClase, vistasSinContestar } from '../lib/cs-avance-clases';
import { CLASES, MODULOS_POR_AREA } from '../lib/programa-catalogo';

type Fila = Parameters<typeof avancePorClase>[0][number];
const fila = (x: Partial<Fila> & { clase_id: string }): Fila => ({
  area: '', estado: 'pendiente', visto_at: null, contestada_at: null, aprobada_at: null, ...x,
});

// Una clase de un módulo NORMAL y una de uno POR ÁREA, sacadas del catálogo real:
// si el programa cambia, el test no se queda apuntando a ids que ya no existen.
const NORMAL = CLASES.find((c) => !MODULOS_POR_AREA.includes(c.modulo.id))!.clase.id;
const POR_AREA = CLASES.find((c) => MODULOS_POR_AREA.includes(c.modulo.id))!.clase.id;

test('el caso que motiva la pantalla: vio la clase y no contestó la tarea', () => {
  const r = avancePorClase([fila({ clase_id: NORMAL, visto_at: '2026-09-10T12:00:00Z' })]);
  assert.equal(r.length, 1);
  assert.equal(r[0].vistoAt, '2026-09-10T12:00:00Z');
  assert.equal(r[0].tarea, 'sin-contestar');
  assert.equal(vistasSinContestar(r).length, 1);
});

test('una clase sin ninguna señal NO aparece: la ficha no es el temario', () => {
  assert.deepEqual(avancePorClase([fila({ clase_id: NORMAL })]), []);
});

test('contestó sin que haya registro de que la vio: entra igual, y NO cuenta como «vio y no contestó»', () => {
  const r = avancePorClase([fila({ clase_id: NORMAL, estado: 'contestada', contestada_at: '2026-09-11T00:00:00Z' })]);
  assert.equal(r[0].tarea, 'contestada');
  assert.equal(r[0].vistoAt, null);
  assert.equal(vistasSinContestar(r).length, 0);
});

test('vio → fecha de la PRIMERA vez, no la del último repaso', () => {
  // En los módulos por área `visto_at` puede estar en más de una fila.
  const r = avancePorClase([
    fila({ clase_id: POR_AREA, visto_at: '2026-09-15T00:00:00Z' }),
    fila({ clase_id: POR_AREA, area: 'ventas', visto_at: '2026-09-02T00:00:00Z' }),
  ]);
  assert.equal(r[0].vistoAt, '2026-09-02T00:00:00Z');
});

test('módulo por área: la fila sin área es la marca de «vio», NO la tarea', () => {
  // El webhook deja la fila sin área en `pendiente` para siempre: nadie contesta
  // sobre ella. Si se leyera como la tarea, una clase contestada en todas sus
  // áreas figuraría «sin contestar» — y encima como «vio y no contestó».
  const r = avancePorClase([
    fila({ clase_id: POR_AREA, visto_at: '2026-09-10T00:00:00Z' }), // la marca del webhook
    fila({ clase_id: POR_AREA, area: 'ventas', estado: 'aprobada', aprobada_at: '2026-09-12T00:00:00Z' }),
    fila({ clase_id: POR_AREA, area: 'operaciones', estado: 'aprobada', aprobada_at: '2026-09-13T00:00:00Z' }),
  ]);
  assert.equal(r[0].tarea, 'aprobada');
  assert.deepEqual(r[0].areas, { contestadas: 2, aprobadas: 2, total: 2 });
  assert.equal(r[0].aprobadaAt, '2026-09-13T00:00:00Z');
  assert.equal(vistasSinContestar(r).length, 0);
});

// Este test cazó un bug real en la primera versión, que es la prueba de que sirve:
// filtraba las clases «con señal» mirando solo la tarea agregada, y como la de un
// módulo por área es la del área menos avanzada, esta clase —un área APROBADA— salía
// «sin contestar» y DESAPARECÍA de la lista. Contra ese código daba `[]`.
test('módulo por área: la clase vale lo que su área MENOS avanzada', () => {
  const r = avancePorClase([
    fila({ clase_id: POR_AREA, area: 'ventas', estado: 'aprobada' }),
    fila({ clase_id: POR_AREA, area: 'operaciones', estado: 'pendiente' }),
  ]);
  assert.equal(r[0].tarea, 'sin-contestar');
  assert.equal(r[0].aprobadaAt, null, 'no está aprobada si falta un área');
  assert.deepEqual(r[0].areas, { contestadas: 1, aprobadas: 1, total: 2 });
});

test('módulo por área SIN filas por área todavía: manda la fila sin área', () => {
  // Es el estado de la m7c1 del lead 91: vista por webhook, ninguna área contestada.
  const r = avancePorClase([fila({ clase_id: POR_AREA, visto_at: '2026-09-10T00:00:00Z' })]);
  assert.equal(r[0].tarea, 'sin-contestar');
  assert.equal(r[0].areas, undefined);
  assert.equal(vistasSinContestar(r).length, 1);
});

test('el orden es el del PROGRAMA, no el alfabético del id', () => {
  // Alfabético, «m10…» iría antes que «m2…» y el módulo 6 no respeta ni su propio
  // orden de ids (m6c5 va antes que m6c4).
  const ids = CLASES.map((c) => c.clase.id);
  const desordenadas = [...ids].reverse().map((id) => fila({ clase_id: id, visto_at: '2026-09-01T00:00:00Z' }));
  assert.deepEqual(avancePorClase(desordenadas).map((x) => x.claseId), ids);
});

test('una fila con un clase_id que ya no existe en el programa no revienta: se ignora', () => {
  // Si una clase se borra del catálogo, sus respuestas viejas siguen en la base.
  const r = avancePorClase([fila({ clase_id: 'm99c99', visto_at: '2026-09-01T00:00:00Z' })]);
  assert.deepEqual(r, []);
});
