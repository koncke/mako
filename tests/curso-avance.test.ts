// =============================================================================
// curso-avance — el paso AUTOMÁTICO de etapa cuando el cliente termina sus tareas
// =============================================================================
// Ejecuta la DECISIÓN pura (`decidirAvance`, lib/curso-avance-regla.ts) y fija con un guard que
// `alEnviarTarea` (lib/curso-avance.ts, server-only: no se puede importar acá) la use y mueva por
// el choke point con autor MaKo.
//
// Probado ROMPIÉNDOLO (06/10/2026), una rotura por regla sobre lib/, restaurando de memoria
// (12 pass sin romper):
//   · sin el chequeo «la tarea es de otra etapa» → 10 pass / 2 fail (etapa pasada y futura).
//   · `etapaCompleta` cambiado por «alguna enviada» → 10 / 2 (falta una obligatoria; pendiente).
//   · `etapaSiguiente(…) ?? desde` (sin el corte de la última) → 11 / 1 (última etapa).
//   · sin el corte de «la etapa no tiene obligatorias» → 11 / 1 (etapa sin obligatorias).
//   · `alEnviarTarea` con `por: 'CRM'` en vez de POR_MAKO → 11 / 1 (el guard del choke point).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decidirAvance, etapaAnterior } from '../lib/curso-avance-regla';
import type { Clase, EstadoTarea } from '../lib/curso';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
/** Sin comentarios: el repo explica en prosa lo que se sacó, y un guard no se puede acusar a sí mismo. */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const ETAPAS = ['bienvenida', 'contexto', 'norte', 'instalado'];

const clase = (id: number, etapa: string, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 1, etapa, orden: id, titulo: `C${id}`, descripcion: '', tipo: 'clase', minutos: null,
  videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
});

// Contexto: dos obligatorias (1 y 2) y una optativa (3). Norte: dos clases. Instalado: una obligatoria.
const CLASES: Clase[] = [
  clase(1, 'contexto', { obligatoria: true, tarea: 'Tu PAS' }),
  clase(2, 'contexto', { obligatoria: true, tarea: 'Tus valores' }),
  clase(3, 'contexto', { tarea: 'Opcional' }),
  clase(4, 'norte', { obligatoria: true, tarea: 'Tu meta' }),
  clase(5, 'norte'),
  clase(6, 'instalado', { obligatoria: true, tarea: 'Cierre' }),
  // Bienvenida: sólo un video, sin tarea obligatoria.
  clase(7, 'bienvenida', { obligatoria: true }),
];

const estados = (m: Record<number, EstadoTarea>) => (id: number) => m[id];

test('completa la etapa en la que está → pasa a la siguiente, y cuenta sus clases', () => {
  const d = decidirAvance({ etapaDeLaClase: 'contexto', etapaActual: 'contexto', etapas: ETAPAS, clases: CLASES, estadoDe: estados({ 1: 'enviada', 2: 'enviada' }) });
  assert.deepEqual(d, { mover: true, desde: 'contexto', hacia: 'norte', clasesEnHacia: 2 });
});

test('una tarea APROBADA cuenta como enviada', () => {
  const d = decidirAvance({ etapaDeLaClase: 'contexto', etapaActual: 'contexto', etapas: ETAPAS, clases: CLASES, estadoDe: estados({ 1: 'aprobada', 2: 'enviada' }) });
  assert.equal(d.mover, true);
});

test('le falta una obligatoria → no se mueve (la optativa no cuenta para cerrar)', () => {
  const d = decidirAvance({ etapaDeLaClase: 'contexto', etapaActual: 'contexto', etapas: ETAPAS, clases: CLASES, estadoDe: estados({ 1: 'enviada', 3: 'enviada' }) });
  assert.deepEqual(d, { mover: false, desde: 'contexto', motivo: 'le faltan tareas de la etapa' });
});

test('una pendiente (guardada sin enviar) no cuenta', () => {
  const d = decidirAvance({ etapaDeLaClase: 'contexto', etapaActual: 'contexto', etapas: ETAPAS, clases: CLASES, estadoDe: estados({ 1: 'enviada', 2: 'pendiente' }) });
  assert.equal(d.mover, false);
});

test('la tarea es de una etapa YA PASADA → no se mueve (si no, iría hacia atrás)', () => {
  // Está en Norte y reenvía la última de Contexto: Contexto queda completa, pero no es SU etapa.
  const d = decidirAvance({ etapaDeLaClase: 'contexto', etapaActual: 'norte', etapas: ETAPAS, clases: CLASES, estadoDe: estados({ 1: 'enviada', 2: 'enviada' }) });
  assert.deepEqual(d, { mover: false, desde: 'norte', motivo: 'la tarea es de otra etapa' });
});

test('la tarea es de una etapa FUTURA → no salta columnas', () => {
  const d = decidirAvance({ etapaDeLaClase: 'norte', etapaActual: 'contexto', etapas: ETAPAS, clases: CLASES, estadoDe: estados({ 4: 'enviada' }) });
  assert.deepEqual(d, { mover: false, desde: 'contexto', motivo: 'la tarea es de otra etapa' });
});

test('completa la ÚLTIMA etapa → no hay a dónde moverlo', () => {
  const d = decidirAvance({ etapaDeLaClase: 'instalado', etapaActual: 'instalado', etapas: ETAPAS, clases: CLASES, estadoDe: estados({ 6: 'enviada' }) });
  assert.deepEqual(d, { mover: false, desde: 'instalado', motivo: 'última etapa' });
});

test('una etapa SIN obligatorias que piden algo no se completa sola', () => {
  // La 7 está marcada obligatoria pero no pide nada (sin tarea ni campos): no cuenta.
  const d = decidirAvance({ etapaDeLaClase: 'bienvenida', etapaActual: 'bienvenida', etapas: ETAPAS, clases: CLASES, estadoDe: estados({ 7: 'enviada' }) });
  assert.deepEqual(d, { mover: false, desde: 'bienvenida', motivo: 'la etapa no tiene tareas obligatorias' });
});

test('no está en la entrega de ese producto → no se mueve', () => {
  const d = decidirAvance({ etapaDeLaClase: 'contexto', etapaActual: null, etapas: ETAPAS, clases: CLASES, estadoDe: estados({ 1: 'enviada', 2: 'enviada' }) });
  assert.deepEqual(d, { mover: false, desde: null, motivo: 'no está en la entrega de ese producto' });
});

test('la etapa siguiente sin clases cargadas → se mueve con clasesEnHacia 0 (y no se avisa)', () => {
  const sinNorte = CLASES.filter((c) => c.etapa !== 'norte');
  const d = decidirAvance({ etapaDeLaClase: 'contexto', etapaActual: 'contexto', etapas: ETAPAS, clases: sinNorte, estadoDe: estados({ 1: 'enviada', 2: 'enviada' }) });
  assert.deepEqual(d, { mover: true, desde: 'contexto', hacia: 'norte', clasesEnHacia: 0 });
});

test('etapaAnterior: la clave de antes, null en la primera o si no existe', () => {
  assert.equal(etapaAnterior(ETAPAS, 'norte'), 'contexto');
  assert.equal(etapaAnterior(ETAPAS, 'bienvenida'), null);
  assert.equal(etapaAnterior(ETAPAS, 'nada'), null);
});

test('alEnviarTarea usa la decisión pura y mueve por el CHOKE POINT con autor MaKo, y avisa sólo si cambió', () => {
  const src = sinComentarios(leer('lib/curso-avance.ts'));
  const ini = src.indexOf('export async function alEnviarTarea');
  assert.ok(ini > 0, 'no encontré alEnviarTarea');
  const cuerpo = src.slice(ini);
  assert.match(cuerpo, /decidirAvance\(/, 'alEnviarTarea ya no usa la decisión pura: la regla quedaría sin test');
  assert.match(cuerpo, /moverClienteDeEtapa\(\{[^}]*por:\s*POR_MAKO/, 'el paso automático tiene que firmar como MaKo en el historial');
  assert.doesNotMatch(cuerpo, /from\('cliente_entrega'\)/, 'nadie escribe cliente_entrega por fuera del choke point');
  // El mensaje va DESPUÉS de comprobar que el movimiento cambió algo: un «ya estaba» no avisa.
  const iCambio = cuerpo.indexOf('mov.cambio');
  const iAviso = cuerpo.indexOf('avisarEntradaAEtapa(');
  assert.ok(iCambio > 0 && iAviso > iCambio, 'el aviso de la etapa nueva tiene que ir después de mirar `mov.cambio`');
  // Nunca tira: todo el cuerpo adentro de un try con su catch.
  assert.match(cuerpo, /Promise<ResultadoAvance>\s*\{\s*try\s*\{/, 'alEnviarTarea tiene que envolver todo en try/catch: la tarea ya está guardada');
});
