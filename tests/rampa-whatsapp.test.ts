// =============================================================================
// La rampa del número de WhatsApp (5/11/2026, Black November de Leila)
// =============================================================================
// A Mauricio le suspendieron la línea 24 h al pasar de unos 20 a 60 WhatsApp por día. El tope por día de la línea de las
// automatizaciones (`LimitesEnvio.wa.dia`) era fijo: ahora arranca en `wa.arranqueDia` (20) y sube `wa.arranqueSube` (20) cada día
// que llegó a su tope, hasta `wa.dia` (`topeConRampa`, lib/goteo.ts; la misma cuenta que la del dominio de email). Lo que se fija:
//   · la cuenta, con LO DE FÁBRICA: un número nuevo arranca en 20; uno que ya venía mandando sigue donde estaba (sus días llenos
//     cuentan, como en la difusión); uno que no llegó a su tope no sube; más de 2 días callado vuelve a empezar;
//   · la lectura (`topeDeLineaDeHoy`, lib/goteo-db.ts) EJECUTADA contra un PostgREST de mentira: cuenta SÓLO los WhatsApp que
//     salieron (ni los emails, ni los borradores, ni los fallos), por día en la zona del negocio;
//   · el «por qué no sale» de la ficha dice el tope de HOY con la rampa, no el de la línea;
//   · el aviso al activar dice cuánto arranca el número, y no lo dice si el goteo propio frena antes.
// El cableado del motor (`lineaWa`, el piso sin leer) lo fijan tests/automations-configuraciones.test.ts y
// tests/motor-freno-ventana.test.ts; la API (`ver_limites_envio`, `cambiar_limites_envio`), tests/email-campana-topes.test.ts.
//
// PROBADO ROMPIÉNDOLO (5/11/2026), sobre una base de 5 / 0:
//   R1 `rampaDeLinea` siempre null (sin rampa)                                  → 3 / 2
//   R2 `topeConRampa` sin los días (`new Map()`): la línea que ya venía mandando vuelve a empezar → 3 / 2
//   R3 `topeDeLineaDeHoy` sin `.eq('canal', canal)` (los emails suben el número)  → 4 / 1
//   R4 `topeDeLineaDeHoy` sin `.eq('estado', 'enviado')` (los borradores lo calientan) → 4 / 1
//   R5 el «por qué no sale» sin la rama de la rampa                             → 4 / 1
//   R6 el aviso al activar sin la frase del número                              → 4 / 1
// Restaurado, 5 / 0.
//
// Correr: node --import tsx --test tests/rampa-whatsapp.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { crearPostgrest, type Fila } from './_postgrest-de-mentira';
import { topeConRampa, rampaDeLinea } from '../lib/goteo';
import { topeDeLineaDeHoy, topeDelPrimerDia } from '../lib/goteo-db';
import { LIMITES_CONSTANTES, limitesDeFabrica, limitesParaGuardar, sanearLimites } from '../lib/limites-envio';
import { porQueNoSale, type ContextoDelEnvio, type FilaQueEspera } from '../lib/por-que-no-sale';
import { avisoDeRitmo } from '../lib/ritmo-al-activar';

const WA = LIMITES_CONSTANTES.wa;
const dias = (o: Record<string, number>) => new Map(Object.entries(o));
const HOY = '2026-11-05';

test('la cuenta, con lo de fábrica: 20 un número nuevo, y el que ya venía mandando sigue donde estaba', () => {
  assert.deepEqual([WA.arranqueDia, WA.arranqueSube, WA.dia], [20, 20, 40], 'lo de fábrica: 20 y sube 20 hasta 40 (la de la difusión)');
  assert.deepEqual(limitesDeFabrica({}).wa, WA, 'lo de fábrica del server lleva la rampa');
  assert.ok(rampaDeLinea(WA), 'arranca por debajo del tope: hay rampa');
  assert.equal(topeConRampa(WA, dias({}), HOY), 20, 'un número que nunca mandó arranca en 20');
  assert.equal(topeConRampa(WA, dias({ '2026-11-04': 20 }), HOY), 40, 'ayer llegó a 20: hoy 40');
  // Lo que pidió la tanda: «una línea que ya viene mandando no vuelve a empezar de cero».
  assert.equal(topeConRampa(WA, dias({ '2026-10-31': 40, '2026-11-01': 40, '2026-11-02': 38, '2026-11-03': 40, '2026-11-04': 40 }), HOY), 40, 'ya venía mandando 40 por día');
  assert.equal(topeConRampa(WA, dias({ '2026-11-04': 12 }), HOY), 20, 'ayer no llegó a su tope: no sube');
  assert.equal(topeConRampa(WA, dias({ '2026-10-20': 40, '2026-10-21': 40 }), HOY), 20, 'dos semanas callado: vuelve a empezar');
  assert.equal(topeConRampa({ ...WA, arranqueDia: 40 }, dias({}), HOY), 40, 'si arranca en el tope, no hay rampa');
  // El piso cuando no se puede leer lo que ya mandó: el del primer día (manda menos, nunca más).
  assert.equal(topeDelPrimerDia(WA), 20);
  assert.equal(topeDelPrimerDia({ ...WA, dia: 10 }), 10, 'nunca más que el tope de la línea');
});

test('la rampa se guarda y se cambia como los demás límites, y fuera de rango no', () => {
  assert.deepEqual(sanearLimites({ wa: { arranqueDia: 10, arranqueSube: 300 } }), { wa: { arranqueDia: 10 } }, 'fuera de rango queda ausente');
  const r = limitesParaGuardar({ ...LIMITES_CONSTANTES, wa: { ...WA, arranqueDia: 10 } }, LIMITES_CONSTANTES);
  assert.deepEqual(r.ok && JSON.parse(r.valor), { wa: { arranqueDia: 10 } }, 'sólo lo que difiere');
  const mal = limitesParaGuardar({ ...LIMITES_CONSTANTES, wa: { ...WA, arranqueSube: 0 } }, LIMITES_CONSTANTES);
  assert.equal(!mal.ok && mal.error, 'WhatsApp, cuánto sube por día: entre 1 y 150.');
});

// ── La lectura, EJECUTADA contra un PostgREST de mentira ───────────────────────────────────────
const pg = crearPostgrest({ tablas: ['nutricion_envios'] });
const db = createClient('http://supa.test', 'srk', {
  auth: { persistSession: false },
  global: { fetch: (async (entrada: RequestInfo | URL, init?: RequestInit) => pg.responder(new URL(String(entrada instanceof Request ? entrada.url : entrada)), init ?? {})) as typeof fetch },
}) as never;
let id = 1;
const envio = (canal: string, estado: string, created_at: string): Fila => ({ id: id++, workspace_id: 11, canal, estado, created_at });

test('lo que ya mandó: sólo los WhatsApp que SALIERON, por día en la zona del negocio', async () => {
  const ahora = Date.parse('2026-11-05T18:00:00Z'); // 12:00 en Ciudad de México
  const tabla = (pg.db as Record<string, Fila[]>).nutricion_envios;
  tabla.length = 0;
  // Ayer (4/11 en su zona): 19 WhatsApp enviados, y uno más a las 23:30 de su hora, que en UTC ya es el 5.
  for (let i = 0; i < 19; i++) tabla.push(envio('whatsapp', 'enviado', '2026-11-04T20:00:00Z'));
  tabla.push(envio('whatsapp', 'enviado', '2026-11-05T05:30:00Z'));
  // Lo que NO cuenta: emails, borradores y fallos.
  for (let i = 0; i < 50; i++) tabla.push(envio('email', 'enviado', '2026-11-04T20:00:00Z'));
  for (let i = 0; i < 30; i++) tabla.push(envio('whatsapp', 'borrador', '2026-11-04T20:00:00Z'));
  for (let i = 0; i < 5; i++) tabla.push(envio('whatsapp', 'fallo', '2026-11-04T20:00:00Z'));
  assert.equal(await topeDeLineaDeHoy(db, 'whatsapp', WA, 'America/Mexico_City', ahora), 40, 'los 20 de ayer (en su zona) suben el número a 40');
  // En Madrid el de las 05:30 UTC ya es el 5/11: ayer quedó en 19 y no sube.
  assert.equal(await topeDeLineaDeHoy(db, 'whatsapp', WA, 'Europe/Madrid', ahora), 20, 'el día es el de la zona del negocio');
  // El mismo lector, para el email: los 50 de ayer suben el dominio a 100.
  assert.equal(await topeDeLineaDeHoy(db, 'email', LIMITES_CONSTANTES.email, 'America/Mexico_City', ahora), 100);
  // Los borradores no calientan el número: con 19 enviados y 30 para aprobar, sigue en 20.
  tabla.splice(tabla.findIndex((f) => f.created_at === '2026-11-05T05:30:00Z'), 1);
  assert.equal(await topeDeLineaDeHoy(db, 'whatsapp', WA, 'America/Mexico_City', ahora), 20, 'tres días de borradores no calientan un número');
});

// ── Lo que se dice ─────────────────────────────────────────────────────────────────────────────
const AHORA = Date.parse('2026-11-05T18:00:00Z');
const ctx = (linea: ContextoDelEnvio['linea']): ContextoDelEnvio => ({ ahoraMs: AHORA, tz: 'America/Mexico_City', whatsappPrendido: true, linea });
const fila: FilaQueEspera = { proximoEnvioAt: '2026-11-05T17:00:00Z', automatizacionActiva: true, canal: 'whatsapp', hayLinea: true, horario: null };

test('el «por qué no sale» dice el tope de HOY del número, y hasta dónde sube', () => {
  const r = porQueNoSale(fila, ctx({ dia: 20, usadoDia: 20, hora: 6, usadoHora: 0, diaLinea: 40 }));
  assert.equal(r?.corto, 'Tope del día');
  assert.equal(r?.texto, 'No salió: tu número arranca de a poco y hoy llegó a su tope (20). Sube cada día que llega, hasta 40. Sale cuando se libere lugar.');
  // Ya en el tope de la línea: lo de siempre.
  assert.equal(porQueNoSale(fila, ctx({ dia: 40, usadoDia: 40, hora: 6, usadoHora: 0 }))?.texto, 'No salió: la línea llegó a su tope del día (40). Sale cuando se libere lugar.');
  assert.equal(porQueNoSale(fila, ctx({ dia: 20, usadoDia: 12, hora: 6, usadoHora: 0, diaLinea: 40 })), null, 'con lugar, nada lo frena');
});

test('el aviso al activar dice cuánto arranca el número, y calla si el goteo propio frena antes', () => {
  const topes = { wa: { dia: 40, hora: 6, rampa: { dia: 20, sube: 20 } }, email: { dia: 100 } };
  const a = avisoDeRitmo({ personas: 60, canal: 'whatsapp', goteo: null, horario: null, topes });
  assert.ok(a);
  assert.match(a!.texto, /Tu número arranca hoy con 20 mensajes y sube 20 cada día que llega, hasta 40\./);
  assert.match(a!.texto, /hasta 6 por hora y 20 por día/, 'lo que frena HOY es el tope de hoy');
  // Con un goteo propio más bajo que la línea, lo que frena es el goteo: no se nombra la rampa del número.
  const g = avisoDeRitmo({ personas: 60, canal: 'whatsapp', goteo: { minutos: 5, dia: 15 }, horario: null, topes });
  assert.doesNotMatch(g!.texto, /Tu número arranca/);
  // Con el arranque propio del goteo, se dice el del goteo (como antes).
  const ga = avisoDeRitmo({ personas: 60, canal: 'whatsapp', goteo: { minutos: 5, dia: 40, arranque: { dia: 10, sube: 10 } }, horario: null, topes });
  assert.match(ga!.texto, /Arranca con 10 por día y sube 10 por día\./);
  assert.doesNotMatch(ga!.texto, /Tu número arranca/);
  // Sin rampa (la línea ya llegó), nada.
  const sin = avisoDeRitmo({ personas: 60, canal: 'whatsapp', goteo: null, horario: null, topes: { wa: { dia: 40, hora: 6 }, email: { dia: 100 } } });
  assert.doesNotMatch(sin!.texto, /Tu número arranca/);
});
