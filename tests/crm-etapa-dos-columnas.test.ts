// =============================================================================
// El desplegable de etapa de la ficha, en DOS COLUMNAS (24/10/2026)
// =============================================================================
// Martín, 03/07 (memoria ficha-lead-v5-pedido.md, punto 4; docs/feedback-diseno-pendiente.md, «El CRM, medido aparte»):
// «dividido en 2 secciones lado a lado (pipeline | nutrición agrupada) para evitar scroll». Desde el 12/10 el desplegable
// vive en la cabecera y es un árbol (funnel › etapas); adentro de cada funnel las etapas iban en UNA lista larga.
// Ahora: el recorrido a la izquierda; nutrición y descarte a la derecha; «Quitar de este funnel» abajo, a todo el ancho.
// Es un campo OPCIONAL del Dropdown compartido (97 pantallas lo usan): sin `dosColumnas`, nada cambia.
//
// PROBADO ROMPIÉNDOLO: con el corte en cualquier línea (no la primera), falla el primero; con la línea de la primera de la
// derecha conservada, el primero; sin `alPie` respetado, el segundo; sin `dosColumnas` en el árbol, el tercero; con el
// Dropdown dibujando siempre en columnas (sin mirar el campo), el cuarto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { columnasDeSeccion } from '../app/components/dropdown-reglas';
import { seccionesDelArbol, type FunnelDelArbol } from '../app/crm/lead-view/arbol-funnels';

type O = { value: string; lineaArriba?: boolean; alPie?: boolean };
const v = (os: O[]) => os.map((o) => o.value);

test('el corte va en la PRIMERA línea: el recorrido a la izquierda, lo demás a la derecha con sus líneas', () => {
  const opts: O[] = [
    { value: 'lead' }, { value: 'r1' }, { value: 'ganado' },
    { value: 'nutri', lineaArriba: true }, { value: 'manual' },
    { value: 'perdido', lineaArriba: true }, { value: 'descal' },
  ];
  const c = columnasDeSeccion(opts);
  assert.deepEqual(v(c.izquierda), ['lead', 'r1', 'ganado']);
  assert.deepEqual(v(c.derecha), ['nutri', 'manual', 'perdido', 'descal']);
  assert.equal(c.derecha[0].lineaArriba, false, 'la primera de la derecha encabeza su columna, sin línea');
  assert.equal(c.derecha[2].lineaArriba, true, 'la línea entre nutrición y descarte se queda');
  assert.deepEqual(c.pie, []);
  // Sin líneas, no hay qué partir.
  assert.deepEqual(v(columnasDeSeccion([{ value: 'a' }, { value: 'b' }]).izquierda), ['a', 'b']);
  assert.deepEqual(columnasDeSeccion([{ value: 'a' }, { value: 'b' }]).derecha, []);
});

test('lo que va al pie no entra a ninguna columna', () => {
  const c = columnasDeSeccion([{ value: 'a' }, { value: 'n', lineaArriba: true }, { value: 'quitar', lineaArriba: true, alPie: true }]);
  assert.deepEqual(v(c.izquierda), ['a']);
  assert.deepEqual(v(c.derecha), ['n']);
  assert.deepEqual(v(c.pie), ['quitar']);
});

test('el árbol de la ficha pide las dos columnas, con «Quitar» al pie', () => {
  const f: FunnelDelArbol = {
    id: 1, nombre: 'Principal', esta: true, esCasa: true, etapa: 'lead',
    etapas: [
      { key: 'lead', label: 'Lead entrante', dot: '#000', kind: 'entrada' },
      { key: 'ganado', label: 'Ganado', dot: '#000', kind: 'cierre' },
      { key: 'nutri', label: 'Nutrición', dot: '#000', kind: 'nutricion' },
    ],
  } as unknown as FunnelDelArbol;
  const [s] = seccionesDelArbol([f], true);
  assert.equal(s.dosColumnas, true);
  const quitar = s.options.find((o) => o.label === 'Quitar de este funnel');
  assert.equal(quitar?.alPie, true);
});

test('las dos columnas no se envuelven, y la ficha les da lugar para no scrollear (medido en Chrome)', () => {
  // Con `wrap` + base 160, la barra de scroll de Windows bajaba la columna derecha; con base 0, el menú no medía el texto.
  const src = readFileSync(join(__dirname, '..', 'app/components/Dropdown.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /<div data-dos-columnas style=\{\{ display: 'flex', gap: 4 \}\}>/);
  assert.equal((src.match(/<div style=\{\{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' \}\}>\{(izquierda|derecha)\.map\(fila\)\}<\/div>/g) ?? []).length, 2);
  const ficha = readFileSync(join(__dirname, '..', 'app/crm/lead-view/ProductoDelLead.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(ficha, /menuAlto=\{460\}/, 'con el alto de siempre (340) ocho etapas y el buscador ya scrollean');
  assert.match(ficha, /menuAncho=\{typeof window === 'undefined' \? 420 : Math\.min\(420, window\.innerWidth - 24\)\}/, 'el ancho nunca pasa la pantalla');
});

test('el Dropdown dibuja en columnas SÓLO la sección que lo pide', () => {
  const src = readFileSync(join(__dirname, '..', 'app/components/Dropdown.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /\{abierta\.dosColumnas \? \(\(\) => \{\n\s+const \{ izquierda, derecha, pie \} = columnasDeSeccion\(abierta\.options\);/);
  assert.match(src, /\}\)\(\) : abierta\.options\.map\(\(o\) => conLinea\(o, renderOption\(/, 'sin el campo, la lista de siempre');
  assert.match(src, /dosColumnas\?: boolean \};/);
});
