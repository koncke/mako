// =============================================================================
// La pregunta pendiente manda: el PDF no sale mientras MaKo espera una respuesta (18/10/2026)
// =============================================================================
// Martín, probando en el ws 3: MaKo preguntó «¿cuál es el monto total de esas cuotas mensuales, o el rango si es
// flexible?» y, sin esperar, mandó «Listo: ordené lo que vendes en un PDF…» y siguió con la fase. «No me dio tiempo a
// responder y me mandó el pdf.» La causa: el arranque daba por sabido lo que vende apenas estaban las cinco piezas
// (`faltanDelArranque(...) === 0`), aunque la conversación terminara en una pregunta de MaKo.
//
// ROTURAS (18/10/2026, arnés romper-pregunta.js del scratchpad; base 2 / 0): `loQueVende` sin `preguntaAbierta` → 1 / 1
// · `preguntaAbierta` que no mira el «?» → 1 / 1 · que no mira las opciones → 1 / 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { preguntaAbierta, type OfferMensaje } from '../lib/offer-marco';

const RAIZ = join(__dirname, '..');
const m = (de: 'mako' | 'yo', texto: string, opciones?: string[]): OfferMensaje => ({ id: `${de}-${texto.length}`, de, texto, at: '2026-10-18T15:00:00Z', ...(opciones ? { opciones } : {}) });

test('una pregunta de MaKo sin contestar está abierta; la respuesta o el cierre la cierran', () => {
  const pregunta = m('mako', '¡Me encanta! ¿Cuál es el monto total de esas cuotas mensuales, o el rango si es flexible?');
  assert.equal(preguntaAbierta([m('yo', 'Cobro en cuotas'), pregunta]), true, 'el caso de Martín');
  assert.equal(preguntaAbierta([m('mako', 'Elige una', ['USD 500', 'USD 1.000'])]), true, 'una pregunta con opciones, aunque no lleve «?»');
  assert.equal(preguntaAbierta([pregunta, m('yo', 'Unos 1.500 dólares')]), false, 'ya contestó');
  assert.equal(preguntaAbierta([m('mako', 'Listo: ya entendí lo que vendes.')]), false, 'el turno que cierra no pregunta');
  assert.equal(preguntaAbierta([]), false);
});

test('el arranque no da por sabido lo que vende con una pregunta abierta', () => {
  const srv = readFileSync(join(RAIZ, 'lib/onboarding-arranque-server.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(srv, /loQueVende: !!sesion && faltanDelArranque\(sesion\.piezas\)\.length === 0 && !preguntaAbierta\(sesion\.mensajes\),/,
    'con las piezas completas y la pregunta sin contestar, salía el PDF y la etapa siguiente');
});
