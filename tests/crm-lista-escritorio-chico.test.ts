// =============================================================================
// /crm en LISTA en un escritorio chico: columnas con prioridad y nada que se pise (21/10/2026)
// =============================================================================
// Martín, 21/10/2026: su Chrome al 60 % de 1920×1080 con escala 125 % (~934×639 px de CSS). Los encabezados se pisaban
// («¿AGENDÓMONTCREADO»), la etapa se montaba sobre la fecha y el nombre se cortaba a 8 letras. Medido en un navegador
// con los componentes reales (tests/_crm-lista-arnes.tsx, la barra lateral abierta = 244 px):
//   · ANTES  934×639: 5 textos fuera de su celda («¿Agendó?», «Creado», la etapa de las 3 filas), nombre en 82 px (11 letras)
//            1024×768: 4 fuera, nombre en 102 px (13 letras)
//   · AHORA  934×639: 0 fuera; nombre, etapa y ¿Agendó?; nombre en 178 px (24 de 26 letras del más largo, 20 de 20 el resto)
//            1024×768: 0 fuera; nombre en 230 px (entero). Con la barra plegada (68 px) entran Creado y Empresa; 0 fuera.
// Acá se fija lo que no necesita navegador:
//   1. la regla (`columnasQueEntran`): por prioridad con su mínimo, corta en la primera que no entra, nombre y etapa
//      siempre, lo de siempre en un escritorio grande y antes de medir;
//   2. lo que dibujan los componentes: el rótulo y la etapa se recortan adentro de su celda; la Empresa que no entra va
//      debajo del nombre;
//   3. CrmBoard mide el recuadro y usa la MISMA plantilla en el encabezado y en cada fila.
//
// PROBADO ROMPIÉNDOLO (21/10/2026), con el archivo en 3 / 0, una rotura por vez y restaurada:
//   · las siete columnas siempre (lo de antes)                                          → 2 / 1
//   · una de menos prioridad ocupando el lugar de otra (sin cortar en la primera)        → 2 / 1
//   · el rótulo del encabezado sin recortarse adentro del botón                         → 2 / 1
//   · la etapa sin recortarse en su chip                                                → 2 / 1
//   · la Empresa oculta sin pasar a la fila                                             → 2 / 1
//   · CrmBoard con una plantilla fija en vez de la medida                               → 2 / 1
// Correr: node --import tsx --test tests/crm-lista-escritorio-chico.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { anchoMinimo, columnasQueEntran, plantillaDeColumnas, ORDEN_EN_PANTALLA, PRIORIDAD } from '../app/crm/tabla-columnas';
import { CeldasLead, ThCrm } from '../app/crm/TablaListaLeads';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** El recuadro de la tabla en una pantalla: la ventana, menos la barra lateral, el relleno de /crm (44 × 2) y el borde. */
const recuadro = (ventana: number, barra: number) => ventana - barra - 88 - 2;

test('la regla: por prioridad con su mínimo, cortando en la primera que no entra', () => {
  assert.deepEqual(columnasQueEntran(recuadro(934, 244)), ['nombre', 'etapa', 'agenda'], '934 con la barra abierta');
  assert.deepEqual(columnasQueEntran(recuadro(934, 68)), ['nombre', 'etapa', 'agenda', 'creado'], '934 con la barra plegada');
  assert.deepEqual(columnasQueEntran(recuadro(1024, 244)), ['nombre', 'etapa', 'agenda'], '1024 abierta: no entra Creado, y Monto no le gana el lugar');
  assert.deepEqual(columnasQueEntran(recuadro(1024, 68)), ['nombre', 'empresa', 'etapa', 'agenda', 'creado']);
  assert.deepEqual(columnasQueEntran(recuadro(1920, 244)), [...ORDEN_EN_PANTALLA], 'un escritorio grande: todas, como siempre');
  assert.deepEqual(columnasQueEntran(null), [...ORDEN_EN_PANTALLA], 'antes de medir: todas');
  assert.deepEqual(columnasQueEntran(200), ['nombre', 'etapa'], 'el nombre y la etapa siempre');
  // Nunca una de menos prioridad sin todas las de más: entra un PREFIJO de la prioridad.
  for (let w = 300; w <= 1400; w += 7) {
    const c = new Set(columnasQueEntran(w));
    const n = PRIORIDAD.filter((x) => c.has(x)).length;
    assert.deepEqual(PRIORIDAD.slice(0, n).filter((x) => c.has(x)).length, n, `a ${w} px entró una de menos prioridad sin las de más`);
    // y lo que entra cabe con sus mínimos
    if (n > 2) assert.ok(anchoMinimo([...c]) <= w, `a ${w} px las columnas no caben con su mínimo`);
  }
  assert.equal(plantillaDeColumnas(['nombre', 'etapa']), '34px minmax(170px, 2fr) minmax(140px, 1.4fr) 64px');
});

test('lo que dibujan: el rótulo y la etapa se recortan en su celda; la Empresa oculta va debajo del nombre', () => {
  const th = renderToStaticMarkup(createElement(ThCrm, { activo: true, dir: 'desc', onSort: () => {}, children: '¿Agendó?' }));
  assert.match(th, /<button[^>]*style="[^"]*min-width:0;max-width:100%/, 'el botón de ordenar se achica');
  assert.match(th, /<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">¿Agendó\?<\/span>/, 'el rótulo termina en «…», no se monta');
  const props = { nombre: 'Daniel Fernández', email: 'daniel@x.com', empresa: 'Inmobiliaria del Sur', origen: 'Meta', agenda: 'Sí', monto: { texto: '$1', ganado: false }, creado: '21/10/2026', etapa: { rotulo: 'Nutrición – Reactivación', estilo: { display: 'inline-block', whiteSpace: 'nowrap' } as const } };
  const sin = renderToStaticMarkup(createElement(CeldasLead, { ...props, cols: ['nombre', 'etapa', 'agenda'] }));
  assert.match(sin, />daniel@x\.com · Inmobiliaria del Sur</, 'la Empresa que no entra pasa a la fila');
  assert.doesNotMatch(sin, /21\/10\/2026/, 'Creado no entra: no se dibuja');
  assert.match(sin, /title="Nutrición – Reactivación" style="[^"]*max-width:100%;overflow:hidden;text-overflow:ellipsis/, 'la etapa se recorta adentro de su chip');
  const con = renderToStaticMarkup(createElement(CeldasLead, { ...props, cols: [...ORDEN_EN_PANTALLA] }));
  assert.match(con, />daniel@x\.com</, 'con la columna Empresa, debajo va sólo el email');
  assert.doesNotMatch(con, /daniel@x\.com · /);
});

test('CrmBoard: mide el recuadro y usa la MISMA plantilla en el encabezado y en cada fila', () => {
  const b = leer('app/crm/CrmBoard.tsx');
  assert.match(b, /const colsTabla = useMemo\(\(\) => columnasQueEntran\(anchoTabla\), \[anchoTabla\]\);/);
  assert.match(b, /const plantillaTabla = useMemo\(\(\) => plantillaDeColumnas\(colsTabla\), \[colsTabla\]\);/, 'la plantilla sale de las columnas que entran');
  assert.match(b, /new ResizeObserver\(medir\)/, 'el ancho se vuelve a medir al cambiar (la barra se pliega, el panel de MaKo se abre)');
  assert.match(b, /<div ref=\{tablaRef\} style=\{\{ background: 'var\(--surface\)'/, 'se mide el recuadro de la tabla');
  assert.match(b, /style=\{estiloEncabezado\(plantillaTabla, anchoMinimo\(colsTabla\)\)\}/);
  assert.match(b, /\.\.\.estiloFila\(plantillaTabla, anchoMinimo\(colsTabla\)\),/);
  assert.doesNotMatch(b, /COLS_TABLA|gridTemplateColumns: '34px 2fr/, 'volvió una plantilla fija');
});
