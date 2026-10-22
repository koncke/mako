// =============================================================================
// El feedback de Martín del 21/10/2026 sobre el tablero del CRM (tanda 1)
// =============================================================================
// Textual: «Quiero que elimines el botón de "nuevo lead" de donde está en las columnas y lo pongas dentro de los 3
// puntos de cada columna», «si le doy click derecho a las cards, debería poder ver la opción de "Personalizar
// tarjeta"» y «El ícono de "Asignar evento" que sea otro, no me gusta que tenga color, un ícono más simple, que se
// entienda» (adjuntó un calendario de línea con un check).
// El selector «Kanban · Lista» tiene su test aparte (tests/crm-vista-iconos.test.ts) y el clic derecho entero, el
// suyo (tests/crm-menu-contextual.test.ts).
//
// PROBADO ROMPIÉNDOLO (21/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · el placeholder «＋ Nuevo lead» de vuelta en el carril                          → 3 / 1
//   · el renglón «Nuevo lead» del «⋯» sin su `if (v === 'nuevo')`                    → 3 / 1
//   · «Asignar evento» con `<LogoMeet size={17} />` otra vez                         → 3 / 1
//   · el dibujo `evento` con `fill="#34A853"` en el check                             → 3 / 1
//   · el `case 'personalizar_tarjeta'` sin abrir el pop-up                            → 3 / 1
// Correr: node --import tsx --test tests/crm-feedback-21-10.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IconoMenu } from '../app/_ui/iconos-menu';
import { OPCION_CRM } from '../app/crm/menu-contextual-crm';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const BOARD = sinComentarios(leer('app/crm/CrmBoard.tsx'));
/** Las opciones del «⋯» de una columna, hasta su `onChange`, y el `onChange` hasta el cierre del Dropdown. */
const menuColumna = () => {
  const ini = BOARD.indexOf('ariaLabel={`Opciones de la etapa ${c.label}`}');
  const fin = BOARD.indexOf('/>', BOARD.indexOf('onChange={(v) => {', ini));
  assert.ok(ini > 0 && fin > ini, 'no encontré el «⋯» de la columna');
  return BOARD.slice(ini, fin);
};

test('«Nuevo lead» sale del carril y va al «⋯» de cada columna, por el mismo camino que antes', () => {
  const ini = BOARD.indexOf('<div data-carril');
  const carril = BOARD.slice(ini, BOARD.indexOf('{cards.map(', ini));
  assert.ok(ini > 0, 'no encontré el carril');
  assert.doesNotMatch(carril, /Nuevo lead|<button/, 'el placeholder volvió al carril');
  const menu = menuColumna();
  assert.match(menu, /\{ value: 'nuevo', label: 'Nuevo lead', icono: 'persona-mas' as const \}/);
  // Sin condición: está en TODAS las columnas (las cuatro terminales también; cada una abre lo suyo por `handleDrop`).
  assert.doesNotMatch(menu, /\? \[\{ value: 'nuevo'/);
  assert.match(menu, /if \(v === 'nuevo'\) \{ setAltaPendiente\(null\); setNuevoLead\(\{ etapa: c\.key \}\); return; \}/);
  // El clic derecho de la columna dice lo mismo y hace lo mismo.
  assert.equal(OPCION_CRM.col_nuevo_lead.texto, 'Nuevo lead');
  assert.match(BOARD, /case 'col_nuevo_lead': if \(c\) \{ setAltaPendiente\(null\); setNuevoLead\(\{ etapa: c\.key \}\); \} return;/);
});

test('«Asignar evento» con el calendario de línea de la casa, sin el logo a color', () => {
  assert.match(menuColumna(), /\{ value: 'evento', label: 'Asignar evento', icono: 'evento' as const \}/);
  assert.doesNotMatch(BOARD, /LogoMeet/);
  const modal = sinComentarios(leer('app/crm/EventosDeEtapaModal.tsx'));
  assert.doesNotMatch(modal, /LogoMeet/);
  assert.match(modal, /<IconoMenu nombre="evento" size=\{18\} \/> Asignar evento/);
  assert.equal(OPCION_CRM.col_evento.icono, 'evento');
  assert.match(BOARD, /case 'col_evento': if \(c\) setEventoDe\(\{ etapa: c\.key, nombre: c\.label \}\); return;/);
});

test('el dibujo `evento`: de línea, del color del texto, sin ningún color propio', () => {
  const svg = renderToStaticMarkup(createElement(IconoMenu, { nombre: 'evento' }));
  assert.match(svg, /^<svg [^>]*fill="none" stroke="currentColor"/);
  assert.ok((svg.match(/<(rect|path)\b/g) ?? []).length >= 3, 'el calendario, sus anillos y el check');
  assert.doesNotMatch(svg, /#[0-9a-f]{3,6}\b|rgb\(|fill="(?!none)/i, 'un color propio');
});

test('clic derecho en una tarjeta → «Personalizar tarjeta»; en el «⋯» de la barra, «Personalizar tarjetas»: el mismo pop-up', () => {
  assert.equal(OPCION_CRM.personalizar_tarjeta.texto, 'Personalizar tarjeta');
  assert.equal(OPCION_CRM.personalizar_tarjetas.texto, 'Personalizar tarjetas');
  assert.match(BOARD, /case 'personalizar_tarjeta':\s*case 'personalizar_tarjetas': setPersonalizando\(true\); return;/);
  assert.match(BOARD, /onPersonalizarTarjetas=\{\(\) => setPersonalizando\(true\)\}/);
  assert.match(sinComentarios(leer('app/crm/CrmToolbar.tsx')), /label="Personalizar tarjetas"/);
});
