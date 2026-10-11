// «Today» de MaKo Mobile: lo puro (lib/hoy-movil-modelo.ts) y dos cables del compositor.
//
// Verificado ROMPIENDO cada cosa que persigue (11/10/2026), con la base en 0 fallos:
//   · `fraseHeroe` sin la guarda de `fallas` (siempre «nada urgente» sin partes): 1 fallo.
//   · `fraseHeroe` sin las dos guardas de `fuentes` (#165): 1 fallo.
//   · `composicionHoy` sin `deLaAgencia` en `pulso` (superadmin con Pulso): 1 fallo.
//   · `sumaDe` devolviendo 0 en vez de null para una bandeja sin leer: 1 fallo.
//   · `alertasRestantes` sin sacar `alertaIdx`: 1 fallo.
//   · `horaEnZona` con la zona del proceso en vez de `tz`: 1 fallo.
//   · lib/hoy-movil.ts llamando `getPendientesDeMarcar` dos veces: 1 fallo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  alertasRestantes, composicionHoy, diasQueQuedan, fraseHeroe, horaEnZona, sumaDe, textoLampara, type EntradaHeroe,
} from '../lib/hoy-movil-modelo';
import type { AlertaGeneral } from '../lib/vista-general-modelo';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const texto = (e: EntradaHeroe) => fraseHeroe(e).map((s) => s.texto).join('');

const NADA: EntradaHeroe = { aprobaciones: 0, revisiones: 0, llamadas: 0, urgentes: 0, tareas: 0, leads: 0, fuentes: 'con-datos', fallas: 0 };

test('la frase lleva el número adentro y concuerda el verbo', () => {
  assert.equal(texto({ ...NADA, aprobaciones: 2, llamadas: 3 }), 'Te esperan 2 aprobaciones y 3 llamadas');
  assert.equal(texto({ ...NADA, llamadas: 1 }), 'Te espera 1 llamada');
  assert.equal(texto({ ...NADA, aprobaciones: 1, llamadas: 1, tareas: 2, leads: 4 }), 'Te esperan 1 aprobación, 1 llamada y 4 leads por decidir');
  const segs = fraseHeroe({ ...NADA, aprobaciones: 2 });
  assert.ok(segs.some((s) => s.numero && s.texto.startsWith('2 ')));
});

test('sin nada que contar: «nada urgente» SÓLO si se leyó todo y hay datos (#165)', () => {
  assert.equal(texto(NADA), 'Hoy no tienes nada urgente');
  assert.equal(texto({ ...NADA, fallas: 1 }), 'No pude leer todo lo de hoy');
  assert.equal(texto({ ...NADA, fuentes: 'sin-datos' }), 'Aún no hay datos de tu negocio');
  assert.equal(texto({ ...NADA, fuentes: 'sin-leer' }), 'No pude leer tus datos');
  // Sin Pulso (closer): no hay fuentes que mirar, y se lee igual.
  assert.equal(texto({ ...NADA, fuentes: null }), 'Hoy no tienes nada urgente');
  // Un null (no aplica / no se pudo) no es un cero contado.
  assert.equal(texto({ ...NADA, aprobaciones: null, fallas: 1 }), 'No pude leer todo lo de hoy');
});

test('composición por rol: la capa de la agencia no ve el Pulso aunque `general` la deje pasar', () => {
  const sa = composicionHoy('admin', 'superadmin');
  assert.deepEqual(sa, { pulso: false, reuniones: false, leadsPorDecidir: false, plan: true, vencimientos: true });
  const cliente = composicionHoy('admin', 'completo');
  assert.deepEqual(cliente, { pulso: true, reuniones: true, leadsPorDecidir: false, plan: true, vencimientos: false });
  const closer = composicionHoy('closer', 'completo');
  assert.deepEqual(closer, { pulso: false, reuniones: true, leadsPorDecidir: true, plan: true, vencimientos: false });
  const pm = composicionHoy('admin', 'pm');
  assert.equal(pm.pulso, false);
  assert.equal(pm.reuniones, false);
  assert.equal(pm.vencimientos, true);
  // Sin rol (sin sesión): nada gateado.
  assert.equal(composicionHoy(null, 'completo').pulso, false);
});

test('sumaDe: una bandeja sin leer es null, una que el rol no ve no suma', () => {
  assert.equal(sumaDe({ pendiente: 2, accion: 1 }, ['pendiente', 'accion', 'confirmacion']), 3);
  assert.equal(sumaDe({ pendiente: 2, accion: null }, ['pendiente', 'accion']), null);
  assert.equal(sumaDe({}, ['pendiente']), 0);
});

test('alertas restantes: sin la titular y sin las verdes', () => {
  const a = (nivel: AlertaGeneral['nivel'], titulo: string) => ({ tipo: 'cuotas-vencidas', nivel, titulo, detalle: '', href: '/crm', hrefLabel: 'CRM' }) as AlertaGeneral;
  const lista = [a('rojo', 'A'), a('ambar', 'B'), a('verde', 'C'), a('rojo', 'D')];
  assert.deepEqual(alertasRestantes(lista, 0).map((x) => x.titulo), ['B', 'D']);
  assert.deepEqual(alertasRestantes(lista, null).map((x) => x.titulo), ['A', 'B', 'D']);
});

test('la lámpara se dice en palabras, y apagada no afirma nada', () => {
  assert.equal(textoLampara({ estado: 'rojo', urgentes: 2, vigilar: 1 }, 'con-datos'), '2 urgentes');
  assert.equal(textoLampara({ estado: 'apagado', urgentes: 0, vigilar: 0 }, 'sin-leer'), 'No pude leer tus datos');
  assert.equal(textoLampara({ estado: 'apagado', urgentes: 0, vigilar: 0 }, 'sin-datos'), 'Sin datos todavía');
  assert.equal(textoLampara({ estado: 'verde', urgentes: 0, vigilar: 0 }, 'con-datos'), 'Todo en orden');
});

test('la hora de una reunión es la del NEGOCIO, no la del teléfono', () => {
  const iso = '2026-10-11T17:00:00Z';
  assert.equal(horaEnZona(iso, 'America/Tijuana'), '10:00');
  assert.equal(horaEnZona(iso, 'America/Argentina/Buenos_Aires'), '14:00');
  assert.equal(horaEnZona(null, 'America/Tijuana'), null);
  assert.equal(horaEnZona('no-es-fecha', 'America/Tijuana'), null);
});

test('días que quedan, contando hoy', () => {
  assert.equal(diasQueQuedan('2026-12-31', '2026-12-31'), 1);
  assert.equal(diasQueQuedan('2026-10-11', '2026-12-31'), 82);
  assert.equal(diasQueQuedan('2027-01-02', '2026-12-31'), 0);
});

test('el compositor llama UNA sola vez a getPendientesDeMarcar (escribe en la base)', () => {
  const src = sinComentarios(leer('lib/hoy-movil.ts'));
  assert.equal((src.match(/getPendientesDeMarcar\(/g) ?? []).length, 1);
  // Y el Inbox se CUENTA (no escribe), nunca se lee entero desde Today.
  assert.doesNotMatch(src, /leerParaDecidir/);
});

test('la página tiene su guard y su maxDuration', () => {
  const src = sinComentarios(leer('app/m/hoy/page.tsx'));
  assert.match(src, /await requireMovil\(/);
  assert.match(src, /export const maxDuration = 60;/);
  assert.doesNotMatch(src, /from 'next\/link'|from 'next\/navigation'/);
});
