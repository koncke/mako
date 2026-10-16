// =============================================================================
// «PROBAR»: EL ENCABEZADO DEL CASO, LA SIDEBAR Y EL LEAD QUE NO TARDA (16/10/2026)
// =============================================================================
// Feedback de Martín del 16/10 (por Cerebro, punto 2):
//   · «La animación arranca con el chip "Caso 1: Su reunión sigue en pie · Nunca le escribiste", pero con otro diseño,
//     para que no se confunda con un mensaje» → su propio tipo de mensaje ('caso') y su componente (`ChipDelCaso`);
//   · «En un AI Step, el chip del caso lo dice ("Caso 5: … · Contesta: Pregunta el precio")» → `contesta`;
//   · «los "escribiendo…" no tardan tanto» → el mensaje del lead se pide apenas aparece lo que contesta;
//   · «Los casos no van arriba: van en la sidebar típica de WhatsApp» → la columna desde 520 px (antes 640).
// Y lo que no se ve: el encabezado NO es parte de la charla (no se le pasa a la IA ni cuenta como el último mensaje).
//
// ⚠️ PROBADO ROMPIENDO (16/10/2026, scratchpad romper-chip.mjs; base 5 pass / 0 fail). El resultado MEDIDO de cada
// rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChipDelCaso } from '../app/automations/ChipDelCaso';
import { esDeLaCharla, ANCHO_PARA_COLUMNA } from '../app/automations/PanelProbar';

const leer = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PANEL = leer('app/automations/PanelProbar.tsx');

// rotura 1 (el chip sin «Contesta»): 4 pass / 1 fail, cae éste.
test('el encabezado del caso: el caso arriba, cada hecho una etiqueta y, en un AI Step, lo que contesta', () => {
  const html = renderToStaticMarkup(createElement(ChipDelCaso, { caso: { titulo: 'Caso 5', hechos: ['Su reunión sigue en pie', 'Nunca le escribiste'], contesta: 'Pregunta el precio' } }));
  assert.match(html, /data-chip-caso/);
  assert.match(html, />Caso 5</);
  assert.match(html, />Su reunión sigue en pie</);
  assert.match(html, />Nunca le escribiste</);
  assert.match(html, /data-chip-contesta[^>]*>💬 Contesta: Pregunta el precio</);
  assert.doesNotMatch(renderToStaticMarkup(createElement(ChipDelCaso, { caso: { titulo: 'Caso 1', hechos: ['x'] } })), /Contesta/);
});

// rotura 2 (el encabezado vuelve a ser una pastilla del sistema): 4 pass / 1 fail, cae éste.
test('Probar lo pone como su propio tipo, y los dos teléfonos lo dibujan', () => {
  assert.match(PANEL, /poner\(\{\n\s+id: nuevoId\('caso'\), fromMe: false, tipo: 'caso',/);
  assert.match(PANEL, /caso: \{ titulo: nombreDelCaso\(k\), hechos: caso\.cuando, contesta \}/);
  assert.match(PANEL, /const contesta = caso\?\.respuesta\?\.titulo \?\? null;/);
  assert.match(PANEL, /renderMensaje=\{\(m\) => \(m\.tipo === 'caso' && m\.caso \? <ChipDelCaso caso=\{m\.caso\} \/> : null\)\}/);
  assert.match(leer('app/automations/SimuladorSocial.tsx'), /if \(m\.tipo === 'caso' && m\.caso\) return <ChipDelCaso key=\{m\.id\} caso=\{m\.caso\} \/>;/);
});

// rotura 3 (el encabezado entra a la charla de la IA): 4 pass / 1 fail, cae éste.
test('el encabezado no es parte de la charla: ni para la IA, ni como el último mensaje', () => {
  assert.equal(esDeLaCharla({ tipo: 'caso' }), false);
  assert.equal(esDeLaCharla({ tipo: 'sistema' }), false);
  assert.equal(esDeLaCharla({ tipo: undefined }), true);
  assert.match(PANEL, /const historial = \(\): Turno\[\] => msgsRef\.current\n\s+\.filter\(esDeLaCharla\)/);
  assert.doesNotMatch(PANEL, /m\.tipo !== 'sistema'\)/, 'quedó un filtro que deja pasar el encabezado');
});

// rotura 4 (el mensaje del lead se pide recién al escribir): 4 pass / 1 fail, cae éste.
test('el mensaje del lead se pide apenas aparece lo que contesta, una vez por prueba', () => {
  assert.match(PANEL, /void pedirMensajeDelLead\(\);\n\s+luego\(ENTRE_MS \+ resto \+ LEAD_PIENSA_MS/);
  assert.match(PANEL, /if \(!mensajeDelLead\.current\) \{/);
  assert.match(PANEL, /leadEscribio\.current = false; mensajeDelLead\.current = null;/);
});

// rotura 5 (la sidebar vuelve a pedir 640): 4 pass / 1 fail, cae éste.
test('los casos van en la sidebar desde 520 px: en la pantalla de Martín (~645) ya no salen arriba', () => {
  assert.equal(ANCHO_PARA_COLUMNA, 520);
  assert.ok(645 >= ANCHO_PARA_COLUMNA);
});
