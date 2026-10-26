// =============================================================================
// La ficha del lead dice que ESPERA que toque un botón (25/10/2026)
// =============================================================================
// El Cerebro (25/10, con el pedido de Leandro): «la ficha no conoce el toque». Un lead parado en un DM de Instagram con botones
// (el motor lo deja ahí hasta el toque: `avanceDesde`, `tocarBoton`) se leía «Corriendo» / «En curso», como si algo fuera a
// salir. Fija `botonesQueEspera` (lib/automatizaciones-del-lead-reglas.ts) y cómo lo dicen la tarjeta, el chip y la lista.
// Correr: node --import tsx --test tests/ficha-espera-toque.test.ts
// ROTURAS (25/10/2026, una por vez y restaurada; base 4 / 0): `botonesQueEspera` sin mirar el próximo envío → 3 / 1; la
// ficha sin pasarlo (`detalleDe`) → 3 / 1; la tarjeta sin decirlo (`estadoDeTarjeta`) → 3 / 1; la lista sin él → 3 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { botonesQueEspera, detalleDe, enAutomatizacionesDe, textoEsperaToque, type FilaAutomatizacion } from '../lib/automatizaciones-del-lead-reglas';
import { vistaDeDetalle, estadoDeTarjeta, chipDeInscripcion, estadoDeAutomatizacion } from '../app/crm/automatizacion-lead';
import type { PasoGrafo } from '../lib/flujo-grafo';

const PASOS: PasoGrafo[] = [
  { id: 'cron', nodo: 'inicio', canal: 'instagram', siguiente: 'm1' } as PasoGrafo,
  { id: 'm1', canal: 'instagram', cuerpo: '¡Ey! Te dejo el recurso:', siguiente: null, botones: [{ id: 'b1', titulo: 'Obtener recurso', siguiente: 'c1' }] } as PasoGrafo,
  { id: 'c1', nodo: 'condicion', canal: 'instagram', ramas: [], si_no: null } as PasoGrafo,
  { id: 'm2', canal: 'instagram', cuerpo: 'Mira', siguiente: null, botones: [{ id: 'b1', titulo: 'Ver', url: 'https://x.example' }] } as PasoGrafo,
];
const SEC: FilaAutomatizacion = { id: 7, nombre: 'Recurso Fiesta', activa: true, archivada_at: null, pasos: PASOS };
const FILA = { id: 1, lead_id: 50, secuencia_id: 7, estado: 'activa', paso_actual: 1, nodo_actual: 'm1', proximo_envio_at: null, inscripto_at: '2026-10-25T03:00:00Z', updated_at: '2026-10-25T03:00:00Z', desenlace: null };

test('espera un toque: corre, sin próximo envío, parado en un DM con botones de flujo', () => {
  assert.deepEqual(botonesQueEspera(FILA, PASOS[1]), ['Obtener recurso']);
  assert.equal(botonesQueEspera({ ...FILA, proximo_envio_at: '2026-10-25T05:00:00Z' }, PASOS[1]), null, 'con un envío por delante no está quieto');
  assert.equal(botonesQueEspera({ ...FILA, estado: 'respondio' }, PASOS[1]), null);
  assert.equal(botonesQueEspera(FILA, PASOS[3]), null, 'un botón de link no mueve el flujo');
  assert.equal(botonesQueEspera(FILA, PASOS[2]), null);
  assert.equal(textoEsperaToque(['Obtener recurso']), 'Espera que toque «Obtener recurso»');
  assert.equal(textoEsperaToque(['A', 'B', 'C']), 'Espera que toque «A», «B» o «C»');
});

test('la ficha: la tarjeta y el chip lo dicen (no «En curso»)', () => {
  const d = detalleDe({ zona: 'America/Tijuana', filas: [FILA], secs: [SEC], reentradaDe: () => 'una_vez', envios: [], audit: [], ahoraMs: Date.parse('2026-10-25T04:00:00Z') });
  assert.deepEqual(d.inscripciones[0].esperaToque, ['Obtener recurso']);
  const v = vistaDeDetalle(d).vivas[0];
  assert.equal(estadoDeTarjeta(v).texto, 'Espera que toque «Obtener recurso»');
  assert.deepEqual(chipDeInscripcion(v), { texto: 'Espera un toque', tono: 'mako' });
});

test('la lista de siempre (el tablero, el teléfono) también lo dice', () => {
  const [a] = enAutomatizacionesDe([FILA], [SEC]).get(50)!;
  assert.deepEqual(a.esperaToque, ['Obtener recurso']);
  assert.equal(estadoDeAutomatizacion(a, () => 'x'), 'Espera que toque «Obtener recurso»');
});

test('sin botones, como siempre', () => {
  const otra = { ...FILA, nodo_actual: 'c1', paso_actual: 2 };
  const [a] = enAutomatizacionesDe([otra], [SEC]).get(50)!;
  assert.equal(a.esperaToque, undefined);
  assert.equal(estadoDeAutomatizacion(a, () => 'x'), 'Corriendo');
});
