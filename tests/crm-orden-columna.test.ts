// =============================================================================
// «Ordenar» en el «⋯» de cada columna del CRM (24/10/2026)
// =============================================================================
// Martín, textual: «En los 3 puntos de cada columna, lo primero debe ser nuevo lead. Y el editor de columnas abajo del
// todo, claro que eliminar siempre por ultimo. Y que no diga "Cambiar EL nombre", solo "Cambiar nombre". Y ahí pon la
// opción de "ordenar", y la sacas de filtros, que no este ordenamientos en el botón de filtros, sino que se pueda ordenar
// dentro de esos 3 puntos, y en este caso si pusiste un chip de "Respondió" se debe poder ordenar por eso... Aunque revisa
// porque estoy seguro que existen muchos otros posibles ordenamientos...».
//
// La pieza pura (app/crm/orden-kanban.ts) se EJECUTA; el menú (app/crm/menu-contextual-crm.ts) también. El cableado del
// tablero lo miran tests/crm-orden-manual.test.ts y tests/crm-menu-contextual.test.ts.
// Probado rompiéndolo: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conOrdenDe, ordenarColumna, ordenesDeColumna, type DatoParaOrdenar } from '../app/crm/orden-kanban';
import { itemsCrm, opcionesCrm, OPCION_CRM } from '../app/crm/menu-contextual-crm';
import type { ItemMenuContextual } from '../app/_ui/MenuContextual';

type T = { id: number } & Partial<DatoParaOrdenar>;
const dato = (t: T): DatoParaOrdenar => ({
  nombre: t.nombre ?? '', creado: t.creado ?? null, respondio: t.respondio ?? 2,
  monto: t.monto ?? null, reunion: t.reunion ?? null, vence: t.vence ?? null,
});
const ids = (xs: T[]) => xs.map((x) => x.id);

// La entrada llega como llega al tablero: por llegada, el más nuevo arriba.
const COLUMNA: T[] = [
  { id: 5, nombre: 'zoe', creado: '2026-10-24T10:00:00Z', respondio: 1, monto: 0, reunion: '2026-10-28T15:00:00Z' },
  { id: 4, nombre: 'Álvaro', creado: '2026-10-23T10:00:00Z', respondio: 0, monto: 1200 },
  { id: 3, nombre: '', creado: '2026-10-22T10:00:00Z', vence: '2026-10-25T00:00:00Z' },
  { id: 2, nombre: 'beto', creado: '2026-10-21T10:00:00Z', respondio: 0, monto: 300, reunion: '2026-10-26T15:00:00Z', vence: '2026-10-30T00:00:00Z' },
  { id: 1, nombre: 'Ana', creado: null },
];

test('cada criterio ordena la columna; lo que no tiene el dato va al final y el desempate es la llegada', () => {
  assert.deepEqual(ids(ordenarColumna(COLUMNA, 'llegada', dato)), [5, 4, 3, 2, 1], 'la llegada no se toca');
  assert.deepEqual(ids(ordenarColumna(COLUMNA, 'antiguos', dato)), [2, 3, 4, 5, 1], 'el más viejo arriba; sin fecha, al final');
  assert.deepEqual(ids(ordenarColumna(COLUMNA, 'nombre', dato)), [4, 1, 2, 5, 3], 'A-Z sin mayúsculas ni tildes; sin nombre, al final');
  // «Respondió»: los que contestaron (el chip), después los que están en una automatización, después el resto.
  assert.deepEqual(ids(ordenarColumna(COLUMNA, 'respondio', dato)), [4, 2, 5, 3, 1]);
  assert.deepEqual(ids(ordenarColumna(COLUMNA, 'monto', dato)), [4, 2, 5, 3, 1], 'el mayor arriba; 0 cuenta como sin monto');
  assert.deepEqual(ids(ordenarColumna(COLUMNA, 'reunion', dato)), [2, 5, 4, 3, 1], 'la más cercana arriba');
  assert.deepEqual(ids(ordenarColumna(COLUMNA, 'vence', dato)), [3, 2, 5, 4, 1], 'lo que vence antes arriba');
  // No muta la columna que le pasan.
  assert.deepEqual(ids(COLUMNA), [5, 4, 3, 2, 1]);
});

test('lo que no tiene con qué no se ofrece, salvo el elegido hoy', () => {
  const nada = { manual: false, respondio: false, monto: false, reunion: false, vence: false };
  assert.deepEqual(ordenesDeColumna(nada, 'llegada'), ['llegada', 'antiguos', 'nombre']);
  assert.deepEqual(ordenesDeColumna({ ...nada, manual: true, respondio: true }, 'manual'), ['manual', 'llegada', 'antiguos', 'nombre', 'respondio']);
  assert.deepEqual(ordenesDeColumna({ manual: true, respondio: true, monto: true, reunion: true, vence: true }, 'manual'),
    ['manual', 'llegada', 'antiguos', 'nombre', 'respondio', 'monto', 'reunion', 'vence']);
  // Elegido «Mayor monto» y después se fueron los que tenían plata: sigue a la vista, tildado, para poder cambiarlo.
  assert.ok(ordenesDeColumna(nada, 'monto').includes('monto'));
});

test('elegir en una columna no toca las otras, y volver a la base no guarda nada', () => {
  const a = conOrdenDe({}, 'nuevo', 'nombre');
  const b = conOrdenDe(a, 'ganado', 'monto');
  assert.deepEqual(b, { nuevo: 'nombre', ganado: 'monto' });
  assert.deepEqual(conOrdenDe(b, 'nuevo', null), { ganado: 'monto' });
  assert.deepEqual(a, { nuevo: 'nombre' }, 'no muta lo que le pasan');
});

test('el «⋯» de la columna: Nuevo lead primero, «Ordenar ›» con sus criterios y el de hoy tildado, «Cambiar nombre»', () => {
  const col = { sobre: 'columna' as const, mover: true, entrada: false, curso: null, borrable: true };
  const ops = opcionesCrm(col);
  assert.equal(ops[0], 'col_nuevo_lead', '«Nuevo lead» primero');
  assert.equal(ops[1], 'col_ordenar', '«Ordenar» con lo de los leads');
  assert.equal(ops[ops.length - 1], 'col_eliminar', '«Eliminar» siempre por último');
  assert.equal(OPCION_CRM.col_renombrar.texto, 'Cambiar nombre');
  const items = itemsCrm(ops, {
    etapas: [], equipo: [], etiquetas: null, funnels: [],
    orden: { opciones: ['manual', 'llegada', 'nombre'], actual: 'nombre' },
  });
  const ordenar = items.find((x): x is ItemMenuContextual => !!x && x.id === 'col_ordenar');
  assert.deepEqual(ordenar?.hijos?.map((h) => [h.id, h.label, !!h.marcado]),
    [['manual', 'Manual', false], ['llegada', 'Más nuevos primero', false], ['nombre', 'Nombre (A-Z)', true]]);
  assert.ok(ordenar?.hijos?.every((h) => !!h.icono), 'cada criterio con su ícono (AGENTS.md: un desplegable lleva ícono)');
  assert.equal(ordenar?.icono, 'ordenar');
});

// PROBADO ROMPIÉNDOLO (24/10/2026), contra una base de 4 / 0, de a una:
//   · `conHuecoAlFinal` devolviendo los huecos primero (`a == null ? -1`) → 3 / 1.
//   · `ordenesDeColumna` sin `|| o === actual` → 3 / 1.
//   · `conOrdenDe` sin el `delete` (null guardado como valor) → 3 / 1.
//   · `col_ordenar` sin `marcado` → 3 / 1.
