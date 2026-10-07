// =============================================================================
// Agendar y mover reuniones en Google Calendar desde el grupo de MaKo
// =============================================================================
// El pedido (07/10/2026): un cliente inmobiliario quiere escribirle al grupo de
// WhatsApp de MaKo «agendá una visita con X» o «movela» y que pase. Ya existía
// agendar por CALENDLY; este cliente agenda en Google (y por Cal.com, no Calendly),
// y mover no existía por ningún lado.
//
// Lo que estos tests fijan es lo que NO se ve leyendo el código:
//   1. que el mensaje llegue con las tools: las del registro sólo entran al turno si
//      el mensaje NOMBRA el área (`areasDelMensaje`), y «visita» no estaba;
//   2. que entren en el presupuesto de caracteres del turno contra el resto del CRM;
//   3. que mover NUNCA cree una reunión nueva si no encuentra la que se nombró;
//   4. que no salgan por HTTP sin que alguien lo decida.
//
// Probado rompiéndolo (07/10/2026), una rotura por vez:
//   · sacar `visitas?` de AREA_KEYWORDS.crm            → 2 fallos (área y tools de «visita»)
//   · sacar `reagend`                                   → 2 fallos (área y tools de «reagendá»)
//   · sacar `crearSiNoExiste: false` del runner         → 1 fallo
//   · mover el chequeo detrás de crearEnAgenda(         → 1 fallo
//   · agregar 'http' a los canales de una de las tres   → 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { areasDelMensaje } from '../lib/mako-intencion';
import { toolsDelRegistro, porId, type Vista } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// El doer de WhatsApp corre como admin del grupo, con alcance ejecutar.
const vistaWhatsapp: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };

/** Lo que el doer le arma al turno, con los MISMOS números que usa mako-doer-in.ts. */
const toolsDelTurno = (mensaje: string) => toolsDelRegistro({
  vista: vistaWhatsapp, areas: areasDelMensaje(mensaje), incluirAcciones: true,
  maxChars: 12_000, relevanteA: mensaje,
}).map((t) => t.name);

const CASOS: Array<{ mensaje: string; espera: string[] }> = [
  { mensaje: 'agendá una visita con Juan Pérez el jueves a las 10', espera: ['proponer_agendar_agenda'] },
  { mensaje: 'agendame una reunión con Ana mañana a las 15', espera: ['proponer_agendar_agenda'] },
  { mensaje: 'pasá la visita de Juan al viernes a las 11', espera: ['reuniones_agenda_lead', 'proponer_mover_reunion'] },
  { mensaje: 'reagendá a Juan para el lunes', espera: ['reuniones_agenda_lead', 'proponer_mover_reunion'] },
  { mensaje: 'moveme la cita con Ana al martes 9:30', espera: ['reuniones_agenda_lead', 'proponer_mover_reunion'] },
];

test('el mensaje de agenda se reconoce como CRM, incluido el vocabulario de una inmobiliaria', () => {
  for (const { mensaje } of CASOS) {
    assert.ok(areasDelMensaje(mensaje).includes('crm'), `«${mensaje}» no se reconoce como CRM: el turno llega sin las tools de agenda`);
  }
});

test('las tools de agenda ENTRAN al turno con el presupuesto real, contra todo el CRM', () => {
  for (const { mensaje, espera } of CASOS) {
    const nombres = toolsDelTurno(mensaje);
    for (const id of espera) {
      assert.ok(nombres.includes(id), `«${mensaje}» no trae ${id} (llegaron ${nombres.length}: ${nombres.slice(0, 8).join(', ')}…)`);
    }
  }
});

test('mover desde WhatsApp NUNCA crea una reunión nueva si no encuentra la nombrada', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  const ini = run.indexOf('proponer_mover_reunion: {');
  const fin = run.indexOf('marcar_asistencia_reunion: {', ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré el runner de proponer_mover_reunion: cambió la forma y este test ya no mira nada');
  const bloque = run.slice(ini, fin);
  assert.match(bloque, /crearSiNoExiste:\s*false/, 'el runner de mover tiene que pasar crearSiNoExiste: false');

  // Y la librería tiene que honrarlo ANTES de crear: un chequeo después del POST no protege nada.
  const lib = sinComentarios(leer('lib/google-calendar.ts'));
  const iMover = lib.indexOf('export async function moverEventoDeReunion');
  const iFin = lib.indexOf('async function crearEnAgenda', iMover);
  assert.ok(iMover > 0 && iFin > iMover, 'no encontré moverEventoDeReunion / crearEnAgenda');
  const cuerpo = lib.slice(iMover, iFin);
  const iChequeo = cuerpo.indexOf('crearSiNoExiste === false');
  const iCrea = cuerpo.indexOf('crearEnAgenda(');
  assert.ok(iChequeo > 0, 'moverEventoDeReunion no mira crearSiNoExiste');
  assert.ok(iCrea > 0 && iChequeo < iCrea, 'el chequeo de crearSiNoExiste tiene que ir ANTES de crear');
});

test('agendar y mover en Google no salen por HTTP sin decidirlo', () => {
  for (const id of ['reuniones_agenda_lead', 'proponer_agendar_agenda', 'proponer_mover_reunion']) {
    const d = porId(id);
    assert.ok(d, `${id} no está en el registro`);
    assert.ok(!d.canales.includes('http'), `${id} sale por HTTP: exponer la agenda de Google a un bearer es una decisión (snapshot), no un default`);
    assert.ok(d.canales.includes('whatsapp'), `${id} tiene que salir por WhatsApp: es para eso`);
  }
});
