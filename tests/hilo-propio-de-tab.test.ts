// =============================================================================
// La charla del Marketing CoPilot es SUYA: no se dibuja en otra tab ni es historial de otra (10/11/2026)
// =============================================================================
// Martín abrió MaKo en la tab Image y vio «desde Marketing CoPilot: Volvamos a empezar» y la respuesta del CoPilot («¿Cuánto te
// deja una venta, en dólares?»). La conversación del Cerebro es UNA y cada tab la dibujaba entera. Ahora (lib/chat-desde.ts →
// delHiloDeLaTab):
//   1. en una tab común, los turnos del CoPilot no van; lo demás sí (lo del Ops Center, lo de otras tabs comunes, la apertura);
//   2. en el CoPilot, sólo sus turnos;
//   3. sin tab (el Ops Center), todo;
//   4. lo usan el panel de cada tab (ConversacionCerebro), la primera entrada del CoPilot, su hoja del teléfono y el historial del
//      modelo (turnoApp).
//
// Correr: node --import tsx --test tests/hilo-propio-de-tab.test.ts
// PROBADO ROMPIÉNDOLO, ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABS_CON_HILO_PROPIO, conDesde, delHiloDeLaTab, sinDesde } from '../lib/chat-desde';
import { ORIGEN_COPILOTO } from '../lib/media-buyer/copiloto';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

type M = { role: 'user' | 'assistant'; content: string };
const yo = (tab: string | null, texto: string): M => ({ role: 'user', content: tab ? conDesde(texto, { tab, entidad: null, modo: null }) : texto });
const mako = (texto: string): M => ({ role: 'assistant', content: texto });
const origen = (m: M) => ({ dePersona: m.role === 'user', desde: m.role === 'user' ? sinDesde(m.content).desde : null });
const textos = (ms: readonly M[]) => ms.map((m) => sinDesde(m.content).texto);

// El hilo de Martín: una apertura del Cerebro, algo del Ops Center, la entrevista del CoPilot, algo de Image y del CRM.
const HILO: M[] = [
  mako('Hola, ¿en qué te ayudo hoy?'),
  yo(null, '¿Cómo vienen las ventas?'),
  mako('Este mes van 12.'),
  yo('Marketing CoPilot', 'Volvamos a empezar'),
  mako('¿Cuánto te deja una venta, en dólares?'),
  yo('Image', 'Haceme una portada para el reel'),
  mako('Listo, te dejé tres opciones.'),
  yo('Marketing CoPilot', '300'),
  mako('Con US$300 por venta te conviene la llamada.'),
  yo('CRM', 'Movelo a Ganado'),
  mako('Hecho.'),
];

test('1. en Image no va la entrevista del CoPilot; va lo del Ops Center, lo de otras tabs y la apertura', () => {
  assert.deepEqual(textos(delHiloDeLaTab(HILO, 'Image', origen)), [
    'Hola, ¿en qué te ayudo hoy?', '¿Cómo vienen las ventas?', 'Este mes van 12.',
    'Haceme una portada para el reel', 'Listo, te dejé tres opciones.', 'Movelo a Ganado', 'Hecho.',
  ]);
});

test('2. en el CoPilot, sólo sus turnos (también con una entidad en el chip)', () => {
  assert.deepEqual(textos(delHiloDeLaTab(HILO, ORIGEN_COPILOTO, origen)), [
    'Volvamos a empezar', '¿Cuánto te deja una venta, en dólares?', '300', 'Con US$300 por venta te conviene la llamada.',
  ]);
  const conEntidad = [{ role: 'user' as const, content: conDesde('¿y esta campaña?', { tab: ORIGEN_COPILOTO, entidad: { tipo: 'campana', id: 4, titulo: 'Black' }, modo: null }) }, mako('Va bien.')];
  assert.equal(delHiloDeLaTab(conEntidad, ORIGEN_COPILOTO, origen).length, 2);
  assert.equal(delHiloDeLaTab(conEntidad, 'Image', origen).length, 0);
});

test('3. sin tab (el Ops Center), todo', () => {
  assert.equal(delHiloDeLaTab(HILO, null, origen).length, HILO.length);
  assert.equal(delHiloDeLaTab(HILO, undefined, origen).length, HILO.length);
});

test('la lista de tabs con hilo propio nombra al CoPilot como lo nombra el CoPilot', () => {
  assert.ok(TABS_CON_HILO_PROPIO.includes(ORIGEN_COPILOTO));
});

test('4. lo usan el panel de cada tab, la primera entrada del CoPilot y el historial del modelo', () => {
  const panel = leer('app/_chat/MakoEnLaTab.tsx');
  assert.match(panel, /delHiloDeLaTab\(base\.items, tab, origenDelItem\)/, 'ConversacionCerebro filtra lo que dibuja por su tab');
  assert.match(panel, /const k = \{ \.\.\.base, items,/, 'y lo filtrado es lo que llega al hilo');
  assert.match(leer('app/ads-manager/PrimeraEntrada.tsx'), /delHiloDeLaTab\(motor\.items, ORIGEN_COPILOTO, origenDelItem\)/);
  assert.match(leer('app/m/ads/HojaDelCopiloto.tsx'), /delHiloDeLaTab\(base\.items, ORIGEN_COPILOTO, origenDelItem\)/, 'y la hoja del teléfono');
  assert.match(leer('lib/mako-turno-app.ts'), /historialParaModelo\(delHiloDeLaTab\(hilo, desde\?\.tab,/, 'el modelo lee de historial sólo lo de su tab');
});

// PROBADO ROMPIÉNDOLO (10/11/2026):
//   · `if (propia) return deTurno === tab;` → `return true;`: falla 2 (el CoPilot dibujaba Image y el CRM).
//   · sin el `deTurno !== tab` de la tab común: no cambia nada hoy (una sola tab con hilo propio); el 1 falla si se saca el
//     `TABS_CON_HILO_PROPIO.includes(deTurno)` (Image quedaba sin lo del CRM).
//   · `historialParaModelo(hilo, 12)` como antes en lib/mako-turno-app.ts: falla 4.
