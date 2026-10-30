// =============================================================================
// La barra del Ops Center como la lista de Automations (22/10/2026, feedback 4 de Martín)
// =============================================================================
// Martín, con capturas: la sidebar del Ops Center, la del super admin y la del cliente, «parecida a lo que tenemos en
// Automations»:
//   1. arriba, en una fila: el tutorial (?), la búsqueda y el filtro, como en Automations; el filtro es el de allá (secciones,
//      casillas, «Quitar filtros»), con el Área (el jefe de cada chat) y, para el super admin, el Estado;
//   2. «Nuevo chat» con el diseño de «+ Nueva automatización»: la fila punteada con el +;
//   3. «Second Brain» y «Ticketera» bajan, junto al «Uso», y la Ticketera lleva un ícono de ticket.
//
// Correr: node --import tsx --test tests/ops-center-barra.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VALOR_FILTRO, pasaFiltroChats, seccionesDelFiltroChats } from '../lib/ops-center-filtro';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. arriba: el tutorial, la búsqueda y el filtro, en una fila; el filtro, con el Área y el Estado', () => {
  const offer = { titulo: 'Offer › Mi oferta' }, dash = { titulo: 'Dashboard › Editar con MaKo · Marketing' }, jefe = { titulo: 'Offer' };
  const trabaja = { titulo: 'CRM › Ficha', trabajando: true }, espera = { titulo: 'CRM', espera: true };
  const area = (j: string) => VALOR_FILTRO.area(j);
  assert.equal(pasaFiltroChats(offer, []), true, 'sin nada marcado, todos');
  assert.equal(pasaFiltroChats(offer, [area('Offer')]), true, 'el área es el jefe de su nombre');
  assert.equal(pasaFiltroChats(jefe, [area('offer')]), true, 'el jefe mismo, sin importar mayúsculas');
  assert.equal(pasaFiltroChats(dash, [area('Offer')]), false);
  assert.equal(pasaFiltroChats(dash, [area('Offer'), area('Dashboard')]), true, 'en una sección, cualquiera de lo marcado');
  assert.equal(pasaFiltroChats(trabaja, [area('CRM'), VALOR_FILTRO.espera]), false, 'entre secciones, todas');
  assert.equal(pasaFiltroChats(espera, [area('CRM'), VALOR_FILTRO.espera]), true);
  assert.equal(pasaFiltroChats(trabaja, [VALOR_FILTRO.espera, VALOR_FILTRO.trabajando]), true);
  // Las secciones: cada área en el orden en que aparece, con cuántos; el Estado sólo para el super admin.
  const s = seccionesDelFiltroChats([offer, dash, jefe], [], false);
  assert.deepEqual(s.map((x) => x.title), ['Área']);
  assert.deepEqual(s[0].options.map((o) => o.label), ['Offer · 2', 'Dashboard · 1']);
  assert.equal(s[0].resumen, 'Todas');
  const conEstado = seccionesDelFiltroChats([trabaja, espera], [VALOR_FILTRO.espera, area('Viejo')], true);
  assert.deepEqual(conEstado.map((x) => x.title), ['Área', 'Estado']);
  assert.ok(conEstado[0].options.some((o) => o.value === area('Viejo')), 'lo marcado sin filas se sigue ofreciendo (se puede desmarcar)');
  assert.equal(conEstado[1].resumen, 'Esperan tu respuesta');
  // Lo dibujado: en una fila, el ?, el buscador y el filtro (en ese orden), y nada más arriba.
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  const arriba = sb.slice(sb.indexOf('<div className="co-barra__arriba">'), sb.indexOf('<nav className="co-lista"'));
  // El «?» es la guía de la pestaña desde el 29/10/2026 (la del cliente: la del super admin no tiene a MaKo en su hilo).
  assert.match(arriba, /<div className="co-barra__fila">\n\s*(?:\{\}\n\s*)?\{!ops && \(\n\s*<button type="button" className="co-ayuda" onClick=\{\(\) => guia\.ofrecer\(\)\} aria-label="Que MaKo te enseñe esta pestaña"/);
  assert.ok(arriba.indexOf('co-ayuda') < arriba.indexOf('co-buscar') && arriba.indexOf('co-buscar') < arriba.indexOf('<FiltroChats'), 'el orden de Automations');
  assert.match(arriba, /valores=\{filtros\} onCambio=\{setFiltros\} conEstado=\{!!centro\} \/>/);
  assert.doesNotMatch(arriba, /Ticketera|Second Brain/, 'arriba ya no van');
  // Y las dos listas filtran de verdad: la del cliente (sobre lo que dejó la búsqueda) y la del super admin.
  assert.match(sb, /const restoFilas = filtros\.length \? todasLasFilas\.filter\(\(f\) => pasaFiltroChats\(\{ titulo: f\.titulo \}, filtros\)\) : todasLasFilas;/);
  assert.match(sb, /return filtros\.length \? buscados\.filter\(\(c\) => pasaFiltroChats\(filtrableCentro\(c\), filtros\)\) : buscados;/);
  assert.match(sinComentarios(leer('app/admin/operaciones/FiltroChats.tsx')), /<Dropdown\n\s*value="" varios=\{valores\}[\s\S]*?pie=\{n > 0 \? \{ label: 'Quitar filtros'/, 'el Dropdown de la casa, como el de Automations');
});

test('2. «Nuevo chat» con el diseño de «+ Nueva automatización»: la fila punteada con el +', () => {
  const piezas = sinComentarios(leer('app/admin/operaciones/PiezasCentro.tsx'));
  assert.match(piezas, /<button type="button" className="co-fila co-fila--nuevo co-nueva"[^\n]*onClick=\{onNuevo\}>\n\s*<span aria-hidden className="co-nueva__mas">＋<\/span>/);
  const css = leer('app/admin/operaciones/centro.css');
  assert.match(css, /\.co-nueva \{ border: 1px dashed var\(--border-strong\);/, 'punteada');
  assert.match(css, /\.co-nueva:hover \.co-nueva__mas, \.co-nueva:focus-visible \.co-nueva__mas \{ transform: rotate\(90deg\) scale\(1\.06\);/, 'el + gira, como allá');
});

test('3. «Ticketera» y «Second Brain» abajo, junto al Uso; la Ticketera con un ticket', () => {
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  const abajo = sb.slice(sb.indexOf('</nav>'), sb.indexOf('</aside>'));
  assert.ok(abajo.indexOf('<div className="co-barra__accesos">') >= 0, 'los accesos, después de la lista');
  assert.ok(abajo.indexOf('co-barra__accesos') < abajo.indexOf('<PieCentro') && abajo.indexOf('co-barra__accesos') < abajo.indexOf('<UsoDelCliente'), 'arriba del Uso');
  assert.equal((abajo.match(/<Icon name="ticket" size=\{17\} \/>Ticketera/g) ?? []).length, 2, 'la del super admin y la del cliente');
  assert.equal((abajo.match(/Second Brain\n/g) ?? []).length, 2, 'los dos «Second Brain»');
  assert.doesNotMatch(sb, /name="soporte"/, 'el salvavidas ya no');
  assert.match(leer('app/_components/icons.tsx'), /\n {2}ticket: \(<>/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 3/0):
//   · el filtro ignora el área                        → 2/1 (1)
//   · entre secciones vale cualquiera                 → 2/1 (1)
//   · la lista del cliente sin filtrar                → 2/1 (1)
//   · el ? sin abrir el tutorial                      → 2/1 (1)
//   · «Nuevo chat» vuelve al círculo                  → 2/1 (2)
//   · la Ticketera vuelve arriba                      → 1/2 (1, 3)
