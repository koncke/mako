// =============================================================================
// El bloque «Automatizaciones» de la ficha, funcional (24/10/2026, Martín: «la tarjeta de "Automatizaciones" que veo en
// Mauricio está bastante fea... No es funcional, rediseñala bien»)
// =============================================================================
// Lo que decía con los datos reales del negocio de Mauricio: «Paso 5 de 9: CRON», «Paso 2 de 4: CONDITION: Llegó hace
// menos de 3 día…», «WHATSAPP: Hola {{nombre}}, si no me…», «Hecho · WhatsApp» (un aviso al equipo), y ni cuándo contestó.
// Ahora cada tarjeta dice, en tres renglones, qué le salió (el mensaje como le llegó, con SU nombre), si contestó y
// cuándo, y qué sigue (qué le sale y cuándo, por qué no, o cómo terminó); el historial, plegado.
// Se prueba ejecutando lo puro (lib/automatizaciones-del-lead-reglas.ts y app/crm/automatizacion-lead.ts) y, leyendo el
// fuente, que la lectura trae el nombre y el «Contestó en» y que la pantalla dibuja los renglones.
//
// PROBADO ROMPIÉNDOLO: ver el pie. Correr: node --import tsx --test tests/ficha-automatizaciones-renglones.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  citaDelMensaje, pasoEnPalabras, leerContesto, primerNombre, detalleDe, respuestaDelLead, LARGO_CITA,
  type FilaInscripcionDetalle, type FilaAutomatizacion,
} from '../lib/automatizaciones-del-lead-reglas';
import { fechaCorta, lineaDelEnvio, lineaDelProximo, renglonesDeTarjeta, vistaDeDetalle, type InscripcionVista } from '../app/crm/automatizacion-lead';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const fecha = (iso: string) => `F(${iso.slice(11, 16)})`;

/** La forma de la #289 del negocio de Mauricio, con sus textos. */
const PASOS = [
  { id: 'ini', nodo: 'inicio', siguiente: 'm1' },
  { id: 'm1', canal: 'whatsapp', cuerpo: 'Hola {{nombre}}, ya me llegó tu pago, muchas gracias!', siguiente: 'c1' },
  { id: 'c1', nodo: 'condicion', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'contesto' }], siguiente: 'av' }], si_no: 'e1' },
  { id: 'av', canal: 'whatsapp', cuerpo: '', siguiente: null, accion: { operacion: 'avisar_al_equipo', params: { mensaje: 'Nuevo lead respondió' } } },
  { id: 'e1', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'm2' },
  { id: 'm2', canal: 'whatsapp', cuerpo: 'Hola {{nombre}}, si no me das tu email no podré agregarte a la capacitación. {{link_agenda}}', siguiente: null },
] as unknown as PasoGrafo[];

test('un mensaje se cita como le llegó: con SU nombre, sin variables crudas, en una línea y cortado', () => {
  assert.equal(citaDelMensaje('Hola {{nombre}}, ya me llegó tu pago', 'Victor'), 'Hola Victor, ya me llegó tu pago');
  assert.equal(citaDelMensaje('Hola {{ primer_nombre }} ,  ya', 'Ana'), 'Hola Ana, ya');
  // Sin nombre, no queda «Hola , ya…»; las otras variables no se inventan.
  assert.equal(citaDelMensaje('Hola {{nombre}}, mira esto: {{link_agenda}}', null), 'Hola, mira esto:');
  const largo = citaDelMensaje('x'.repeat(200), null);
  assert.equal(largo.length, LARGO_CITA);
  assert.ok(largo.endsWith('…'));
  assert.equal(primerNombre('Victor Basurto'), 'Victor');
  assert.equal(primerNombre('  '), null);
});

test('cada tarjeta del flujo en palabras de persona: lo que le llega, lo que hace MaKo, y lo del flujo sin su nombre de lienzo', () => {
  assert.deepEqual(pasoEnPalabras(PASOS[1], 'Victor Basurto'), { clase: 'mensaje', canal: 'whatsapp', que: '«Hola Victor, ya me llegó tu pago, muchas gracias!»' });
  assert.deepEqual(pasoEnPalabras(PASOS[3], 'Victor'), { clase: 'accion', canal: null, que: 'Aviso al equipo' });
  assert.equal(pasoEnPalabras(PASOS[0], null).que, 'La entrada');
  assert.equal(pasoEnPalabras(PASOS[2], null).que, 'Una condición');
  assert.equal(pasoEnPalabras(PASOS[4], null).que, 'Una espera');
  const email = { id: 'em', canal: 'email', asunto: 'Tu acceso, {{nombre}}', cuerpo: 'largo…' } as unknown as PasoGrafo;
  assert.deepEqual(pasoEnPalabras(email, 'Ana López'), { clase: 'mensaje', canal: 'email', que: '«Tu acceso, Ana»' });
  assert.equal(pasoEnPalabras({ id: 'au', canal: 'whatsapp', cuerpo: '' } as unknown as PasoGrafo, null).que, 'un mensaje');
  for (const p of PASOS) assert.doesNotMatch(pasoEnPalabras(p, 'V').que, /CRON|CONDITION|WHATSAPP|\{\{/, 'quedó el nombre del lienzo o una variable');
});

test('el detalle trae qué salió y qué sigue en palabras, y cuándo contestó en ESTA pasada', () => {
  assert.equal(leerContesto('Contestó en «Sprint · apertura»: sigue por «Contestó».'), 'Sprint · apertura');
  assert.equal(leerContesto('No volvió a entrar a «X»: …'), null);
  const sec: FilaAutomatizacion = { id: 289, nombre: 'Sprint · apertura', activa: true, archivada_at: null, pasos: PASOS };
  const fila = (o: Partial<FilaInscripcionDetalle>): FilaInscripcionDetalle => ({
    id: 1, lead_id: 2502, secuencia_id: 289, estado: 'activa', paso_actual: 5, nodo_actual: 'm2', proximo_envio_at: '2026-10-25T01:33:00Z',
    inscripto_at: '2026-10-24T01:00:00Z', updated_at: null, desenlace: null, ...o,
  });
  const d = detalleDe({
    zona: 'America/Tijuana', filas: [fila({})], secs: [sec], reentradaDe: () => 'una_vez', ahoraMs: Date.parse('2026-10-24T12:00:00Z'),
    envios: [{ inscripcion_id: 1, nodo_id: 'm1', canal: 'whatsapp', estado: 'enviado', error: null, created_at: '2026-10-24T01:09:37Z' }],
    audit: [
      // Dos de esta pasada (gana la más nueva, aunque venga segunda) y una de antes de que entrara: ésa es de otra vuelta.
      { valor_nuevo: 'Contestó en «Sprint · apertura»: sigue por «Contestó».', autor: 'MaKo', created_at: '2026-10-24T02:00:00Z' },
      { valor_nuevo: 'Contestó en «Sprint · apertura»: sigue por «Contestó».', autor: 'MaKo', created_at: '2026-10-24T03:49:57Z' },
      { valor_nuevo: 'Contestó en «Sprint · apertura»: sigue por «Contestó».', autor: 'MaKo', created_at: '2026-10-20T00:00:00Z' },
    ],
    nombreDelLead: 'Honorio Hernandez',
  });
  const i = d.inscripciones[0];
  assert.equal(i.contesto, '2026-10-24T03:49:57Z', 'no tomó la línea más nueva de esta pasada');
  // Cortado a `LARGO_CITA`, y sin el `{{link_agenda}}` crudo.
  assert.equal(i.proximo?.que?.que, '«Hola Honorio, si no me das tu email no podré agregarte a la capacitac…»');
  assert.equal(i.enviados[0].que?.que, '«Hola Honorio, ya me llegó tu pago, muchas gracias!»');
  const viejo = detalleDe({
    zona: 'UTC', filas: [fila({ inscripto_at: '2026-10-24T05:00:00Z' })], secs: [sec], reentradaDe: () => 'una_vez', ahoraMs: Date.parse('2026-10-24T12:00:00Z'),
    envios: [], audit: [{ valor_nuevo: 'Contestó en «Sprint · apertura»: x', autor: 'MaKo', created_at: '2026-10-24T03:49:57Z' }],
  });
  assert.equal(viejo.inscripciones[0].contesto, null, 'tomó una respuesta de antes de que entrara');
  // La lectura de producción trae las dos cosas (el nombre y el «Contestó en») y se las pasa.
  const lect = leer('lib/automatizaciones-del-lead.ts');
  assert.match(lect, /\.like\('valor_nuevo', 'Contestó en «%'\)/);
  assert.match(lect, /db\.from\('leads'\)\.select\('nombre'\)\.eq\('id', leadId\)\.maybeSingle\(\)/);
  assert.match(lect, /nombreDelLead: \(\(lead\.data as \{ nombre\?: string \| null \} \| null\)\?\.nombre \?\? null\),/);
  assert.match(lect, /audit: \[\.\.\.\(\(aud\.data \?\? \[\]\) as FilaAuditDetalle\[\]\), \.\.\.\(\(contesto\.data \?\? \[\]\) as FilaAuditDetalle\[\]\)\],/);
});

const base: InscripcionVista = {
  secuenciaId: 289, nombre: 'Sprint · apertura', link: '/automations?sec=289', estado: 'activa', automatizacionActiva: true,
  paso: { numero: 6, titulo: 'WHATSAPP: Hola {{nombre}}…', total: 6 },
  proximo: { at: '2026-10-25T01:33:00Z', titulo: '«Hola Honorio, si no me das tu email…»', clase: 'mensaje' },
  frenado: null, termino: null, contesto: null, puede: { frenar: true, empezarDeNuevo: true }, reentrada: 'una_vez',
  enviados: [
    { at: '2026-10-24T03:50:15Z', paso: 'Paso 4: MAKO', canal: 'whatsapp', estado: 'accion', error: null, que: 'Aviso al equipo', clase: 'accion' },
    { at: '2026-10-24T01:09:37Z', paso: 'Paso 2: WHATSAPP', canal: 'whatsapp', estado: 'enviado', error: null, que: '«Hola Honorio, ya me llegó tu pago»', clase: 'mensaje' },
  ],
};

test('la tarjeta en tres renglones: qué le salió, si contestó, qué sigue (o por qué no, o cómo terminó)', () => {
  // En curso: lo último que le LLEGÓ (el mensaje, no el aviso al equipo de después) y qué le sale.
  assert.deepEqual(renglonesDeTarjeta(base, fecha), [
    { tipo: 'salio', texto: 'Le salió F(01:09): «Hola Honorio, ya me llegó tu pago»', tono: 'ok' },
    { tipo: 'sigue', texto: 'Le sale F(01:33): «Hola Honorio, si no me das tu email…»', tono: 'mako' },
  ]);
  // Contestó: cuándo y QUÉ (citado), y que no le sale nada más.
  assert.deepEqual(renglonesDeTarjeta({ ...base, estado: 'respondio', contesto: '2026-10-24T03:49:57Z', respuesta: '«No hemos mandado pagos»' }, fecha).map((r) => r.texto), [
    'Le salió F(01:09): «Hola Honorio, ya me llegó tu pago»', 'Contestó F(03:49): «No hemos mandado pagos»', 'No le sale nada más de esta automatización.',
  ]);
  assert.equal(renglonesDeTarjeta({ ...base, estado: 'respondio', contesto: '2026-10-24T03:49:57Z' }, fecha)[1].texto, 'Contestó F(03:49)', 'sin el mensaje, sólo cuándo');
  // Contestó sin la hora: lo dice igual, sin inventar una.
  assert.equal(renglonesDeTarjeta({ ...base, estado: 'respondio' }, fecha)[1].texto, 'Contestó.');
  // Sin envíos todavía: lo dice (no un cero ni un hueco).
  assert.equal(renglonesDeTarjeta({ ...base, enviados: [] }, fecha)[0].texto, 'Todavía no le salió nada.');
  // Frenada por el horario: el porqué, como renglón frenado.
  const fr = renglonesDeTarjeta({ ...base, frenado: { texto: 'No salió: fuera del horario de oficina. Sale hoy 9:00.', corto: 'Sale 9:00' } }, fecha);
  assert.deepEqual(fr[1], { tipo: 'frenado', texto: 'No salió: fuera del horario de oficina. Sale hoy 9:00.', tono: 'gris' });
  // Terminada: cómo y cuándo.
  const t = renglonesDeTarjeta({ ...base, estado: 'completada', termino: { at: '2026-10-20T10:00:00Z', texto: 'Terminó el recorrido' } }, fecha);
  assert.deepEqual(t[t.length - 1], { tipo: 'termino', texto: 'Terminó el recorrido · F(10:00)', tono: 'gris' });
  // Ningún renglón dice el nombre del lienzo ni una variable.
  for (const r of [...renglonesDeTarjeta(base, fecha), ...fr, ...t]) assert.doesNotMatch(r.texto, /CRON|CONDITION|WHATSAPP|\{\{|Paso \d/);
});

test('qué contestó: el último mensaje suyo hasta que el motor lo anotó, desde que entró; uno sin texto, por lo que es', () => {
  const E = [
    { texto: 'Perdón de k trata ese pago', tipo: 'text', wa_timestamp: '2026-10-24T14:07:50Z' },
    { texto: 'un mensaje de antes de entrar', tipo: 'text', wa_timestamp: '2026-10-20T10:00:00Z' },
    { texto: 'algo que mandó DESPUÉS', tipo: 'text', wa_timestamp: '2026-10-24T18:00:00Z' },
  ];
  assert.equal(respuestaDelLead(E, '2026-10-24T14:08:00Z', '2026-10-23T23:00:00Z'), '«Perdón de k trata ese pago»');
  assert.equal(respuestaDelLead(E, '2026-10-21T00:00:00Z', '2026-10-23T23:00:00Z'), null, 'tomó un mensaje de antes de entrar');
  assert.equal(respuestaDelLead([{ texto: null, tipo: 'audio', wa_timestamp: '2026-10-24T14:07:50Z' }], '2026-10-24T14:08:00Z', null), 'un audio');
  // La lectura de producción trae lo que mandó él (sin reacciones ni avisos del sistema) y se lo pasa.
  const lect = leer('lib/automatizaciones-del-lead.ts');
  assert.match(lect, /db\.from\('wa_mensajes'\)\.select\('texto, tipo, wa_timestamp'\)\.eq\('lead_id', leadId\)\.eq\('from_me', false\)\n\s+\.not\('tipo', 'in', '\(evento,otro\)'\)/);
  assert.match(lect, /entrantes: \(entrantes\.data \?\? \[\]\) as FilaEntranteDetalle\[\],/);
  // Y nada del lienzo en el tablero ni en «no entró».
  assert.doesNotMatch(leer('app/crm/automatizacion-lead.ts').replace(/^\s*(\*|\/\/).*$/gm, ''), /\(va en el paso|adentro \(paso|paso sin ubicar|`paso \$\{a\.paso\.numero\}/);
});

test('cada envío y lo que sigue, en palabras; sin el dato de antes, como antes', () => {
  assert.equal(lineaDelEnvio(base.enviados[0], fecha).texto, 'Aviso al equipo · F(03:50)');
  assert.equal(lineaDelEnvio({ ...base.enviados[1], estado: 'fallo', error: 'el número no tiene WhatsApp' }, fecha).texto,
    'No le salió «Hola Honorio, ya me llegó tu pago» (F(01:09)): el número no tiene WhatsApp');
  assert.equal(lineaDelEnvio({ at: '2026-10-06T13:00:00Z', paso: null, canal: 'whatsapp', estado: 'enviado', error: null }, fecha).texto, 'Enviado · WhatsApp · F(13:00)');
  assert.equal(lineaDelProximo({ ...base, proximo: { at: '2026-10-25T01:00:00Z', titulo: 'Una espera', clase: 'otro' } }, fecha), 'Sigue F(01:00)');
  assert.equal(lineaDelProximo({ ...base, proximo: { at: '2026-10-25T01:00:00Z', titulo: 'Aviso al equipo', clase: 'accion' } }, fecha), 'Aviso al equipo · F(01:00)');
});

test('la fecha corta: hoy, ayer, mañana; si no, el día sin «de»', () => {
  const ahora = Date.parse('2026-10-24T18:00:00Z'); // sáb 24, 11:00 en Tijuana
  assert.equal(fechaCorta('2026-10-24T20:33:00Z', 'America/Tijuana', ahora), 'hoy 13:33');
  assert.equal(fechaCorta('2026-10-23T23:33:00Z', 'America/Tijuana', ahora), 'ayer 16:33');
  assert.equal(fechaCorta('2026-10-25T16:00:00Z', 'America/Tijuana', ahora), 'mañana 09:00');
  const lejos = fechaCorta('2026-10-20T16:00:00Z', 'America/Tijuana', ahora);
  assert.match(lejos, /^\S+ 20 oct, 09:00$/);
  assert.doesNotMatch(lejos, / de /);
  assert.equal(fechaCorta('no es fecha', 'UTC', ahora), '');
});

test('la pantalla: los renglones, el historial plegado sólo con más de un envío, y la fecha corta', () => {
  const p = leer('app/crm/lead-view/ficha/resumen/automatizaciones.tsx').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(p, /\{renglonesDeTarjeta\(a, fecha\)\.map\(\(r, k\) => \(/);
  assert.match(p, /const enviados = \(a: InscripcionVista, abierto: boolean\) => a\.enviados\.length > 1 && \(/);
  assert.match(p, /return \(iso\) => fechaCorta\(iso, tz, Date\.now\(\)\);/);
  assert.doesNotMatch(p, /lineaDelPaso/);
  // Y la vista pasa lo nuevo del detalle.
  const v = vistaDeDetalle({ zona: 'UTC', noEntro: [], inscripciones: [{
    secuenciaId: 1, nombre: 'S', link: '/automations?sec=1', automatizacionActiva: true, estado: 'respondio', desde: null, termino: null,
    reentrada: 'una_vez', reentradaTexto: 'Una sola vez', paso: null, frenado: null, puede: { frenar: true, empezarDeNuevo: true },
    proximo: null, contesto: '2026-10-24T03:49:57Z',
    enviados: [{ at: 'x', paso: null, canal: 'whatsapp', estado: 'enviado', error: null, que: { clase: 'mensaje', canal: 'whatsapp', que: '«Hola»' } }],
  }] });
  assert.equal(v.vivas[0].contesto, '2026-10-24T03:49:57Z');
  assert.deepEqual([v.vivas[0].enviados[0].que, v.vivas[0].enviados[0].clase], ['«Hola»', 'mensaje']);
});

// ── ROTURAS (24/10/2026) ────────────────────────────────────────────────────────────────────────────────
// Una por vez (reemplazar el texto, correr este archivo, devolverlo de memoria con un script con `finally`).
// Base 8 pasan / 0 fallan (pasan / fallan con cada una):
//   F1.  `citaDelMensaje` no reemplaza `{{nombre}}`                                         → 5 / 3
//   F2.  las otras variables quedan crudas («{{link_agenda}}»)                               → 7 / 1
//   F3.  el aviso al equipo cae en «Una acción»                                              → 7 / 1
//   F4.  «Contestó» toma una respuesta de antes de que entrara                               → 7 / 1
//   F5.  «Contestó» toma la primera línea y no la más nueva                                  → 7 / 1
//   F6.  el renglón 1 toma la última acción (el aviso al equipo) y no el último mensaje       → 7 / 1
//   F7.  sin envíos todavía, el renglón 1 no dice nada                                       → 7 / 1
//   F8.  contestó sin la hora: no lo dice                                                    → 7 / 1
//   F9.  la fecha corta sin «hoy»                                                            → 7 / 1
//   F10. la lectura de producción sin las líneas «Contestó en»                               → 7 / 1
//   F11. la pantalla vuelve a mostrar el paso con el nombre del lienzo                       → 7 / 1
//   F12. el historial plegado aparece con un solo envío (repite el renglón 1)                → 7 / 1
//   F13. el renglón de «Contestó» no dice QUÉ contestó                                       → 7 / 1
//   F14. qué contestó sin mirar desde cuándo (toma un mensaje de antes de entrar)            → 7 / 1
//   F15. la lectura de producción sin lo que mandó él                                        → 7 / 1
//   F16. «no entró» vuelve a decir «(va en el paso 2)»                                       → 7 / 1
