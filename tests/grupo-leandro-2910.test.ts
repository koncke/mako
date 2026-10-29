// =============================================================================
// MaKo con Leandro en el grupo (ws10, Fiesta Music, 28/10 13:21 al 29/10 05:58): las seis fallas que mandó Martín
// =============================================================================
// Martín, 29/10: «Mira lo que le respondió MaKo en WhatsApp, sigue funcionando muy mal... A Leandro». Cada falla con su caso real,
// por la entrada REAL del grupo (`manejarEntranteDoer`, tests/_grupo-leandro-2910-hijo.ts) con los payloads de `mako_doer_buffer`:
//   1. (1702) «sumo tres cosas…», con cinco preguntas: «Listo, te armé el borrador» con un link a /plan/revisar. La lista numerada
//      lo hacía «dictado» y el clasificador lo mandaba a capturar. Una pregunta nunca es una carga de tareas. Tampoco con la IA
//      caída: el mensaje se guardaba CRUDO como borrador si traía una lista o el router decía «plan»; ahora decide la intención.
//   2. (1682) «darles de baja o reetiquetarlos manualmente»; (1700) «borra el registro de la inscripción anterior»: procedimientos
//      inventados y destructivos. MaKo NUNCA indica borrar datos: lo dice y queda el ticket.
//   3. (1700) «son limitaciones reales actuales del motor… ya están escaladas al equipo», «ya queda el registro técnico»: lo que no
//      sabe del producto no lo afirma; lo confirma el equipo, con su ticket.
//   4. (1676) «en este mensaje no puedo escuchar audios ni tengo la transcripción del tuyo», citando su nota de voz de 94 s. La nota
//      de voz 327 (19:24:52 UTC) llegó 45 s ANTES de que se subiera tren-v (la que va a Groq, 19:25:37 UTC): la atendió Gemini, que
//      cortó por tiempo (el cartel de las 19:26:29). La citada se escucha desde 62876b064; acá, el turno entero y la red de salida.
//   5. (1643) «Tal cual como lo hace manychat», doce segundos después de la nota de voz 316, que no se escuchó: el modelo contestó
//      el «tal cual» a ciegas. El audio que no se escuchó deja su marca EN SU LUGAR en el lote.
//   6. «Hola Martin, …»: Leandro le escribe al EQUIPO y MaKo contestaba como si fuera Martín. Ahora dice que es MaKo, contesta sólo
//      lo que sabe con datos y lo demás queda para el equipo con su ticket; un «gracias» suelto a Martín no es para MaKo.
//
// Probado rompiéndolo (29/10/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { clasificarIntencion } from '../lib/mako-intencion';
import { ESCUCHO_AUDIOS, SIN_BORRAR, SIN_SABER_DEL_PRODUCTO, sinLoQueMaKoNoDice } from '../lib/doer-salida';
import { bloqueParaElEquipo, noEsParaMaKo, paraAlguienDelEquipo } from '../lib/doer-para-quien';
import { AUDIO_DEL_LOTE_SIN_ESCUCHAR } from '../lib/audio-citado';
import { NUCLEO_GRUPO } from '../lib/nucleo-grupo';

type Escena = {
  r: { engaged: boolean; reply?: string; skip?: string }; salio: string[]; escuchas: string[]; reacciones: number;
  modelo: Array<{ system: string; persona: string; tools: string[] }>; tickets: Array<{ titulo: string; descripcion: string; ref: string }>;
};
let corrida: Record<string, Escena> | null = null;
/** El hijo corre UNA vez (seis turnos, ~8 s cada uno por la ventana de silencio) y cada test mira su escena. */
function escena(k: string): Escena {
  if (!corrida) {
    const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_grupo-leandro-2910-hijo.ts', import.meta.url))], { encoding: 'utf8', timeout: 400_000 });
    const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@LEANDRO@@'));
    assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
    const o = JSON.parse(linea.slice('@@LEANDRO@@'.length)) as Record<string, Escena> & { error?: string };
    assert.equal(o.error, undefined, String(o.error));
    corrida = o;
  }
  const e = corrida[k];
  assert.ok(e, `no corrió la escena ${k}`);
  return e;
}
const TICKET = /\n\nQuedó el ticket #\d+ para el equipo de MaKo\.$/;
/** La fuente del doer, sin comentarios (para el cableado que un turno de test no alcanza). */
const leerDoer = (): string => readFileSync(new URL('../lib/mako-doer-in.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('1. (1702) las cinco preguntas no son una carga del Plan: consulta, sin la herramienta del borrador', () => {
  const e = escena('f1');
  assert.equal(e.modelo.length, 1, 'el turno no llegó al modelo');
  assert.ok(e.modelo[0].tools.length > 0, 'una consulta sin herramientas no puede mirar nada');
  assert.ok(!e.modelo[0].tools.includes('proponer_tareas_plan'), 'llegó con la herramienta que arma el borrador del Plan');
  assert.ok(!e.salio.some((t) => t.includes('/plan/revisar')), 'salió un borrador del Plan');
  // Con la IA del negocio CAÍDA, el mensaje se guardaba crudo como borrador del Plan (la lista y la ruta «plan» del router):
  // «Listo, te armé el borrador» con las preguntas adentro. Ahora lo decide la intención: el cartel de la IA, sin borrador.
  const c = escena('f1caida');
  assert.ok(c.salio.length > 0, 'con la IA caída no dijo nada');
  assert.ok(!c.salio.some((t) => /\/plan\/revisar|te armé el borrador|lo dejé tal cual/i.test(t)), `guardó las preguntas como borrador del Plan: ${c.salio.join(' | ')}`);
  // El clasificador, con los textos reales y sus vecinos.
  const t336 = e.modelo[0].persona;
  assert.equal(clasificarIntencion(t336).intencion, 'consultar');
  assert.equal(clasificarIntencion('Ideas:\n- webinar\n- reels\n- ¿y un podcast?').intencion, 'capturar', 'un volcado con UNA pregunta sigue siendo un volcado');
  assert.equal(clasificarIntencion('Anotá esto:\n1. ¿hacemos un webinar?\n2. ¿y reels?').intencion, 'capturar', 'lo explícito gana');
});

test('2. (1682) MaKo nunca indica borrar datos: la oración sale, dice que no lo sabe y queda el ticket', () => {
  const e = escena('f2');
  assert.equal(e.salio.length, 1);
  const t = e.salio[0];
  assert.doesNotMatch(t, /dar(?:les)? de baja|reetiquet/i, 'le indicó dar de baja las inscripciones');
  assert.ok(t.includes(SIN_BORRAR), 'no dijo la verdad');
  assert.match(t, /1\. Sí, tal como lo notas/, 'se llevó lo que sí contestaba');
  assert.match(t, TICKET, 'sin la línea del ticket');
  assert.equal(e.tickets.length, 1, 'el ticket no quedó (o quedaron dos)');
  assert.match(e.tickets[0].descripcion, /cómo se hace sin borrar datos/);
  // Lo que no es indicar borrar, queda.
  for (const ok of ['No hace falta borrar nada: con «Volver a probar» entra de nuevo.', 'Borra el mensaje con tu clave del grupo, por seguridad.', 'Te armé el borrador de la campaña.', 'Quedó el registro del pago de Fabi.']) {
    assert.equal(sinLoQueMaKoNoDice(ok).texto, ok, `sacó «${ok}»`);
  }
});

test('3. (1700) lo que no sabe del producto no lo afirma, ni «ya está escalado»; tampoco «borra el registro»', () => {
  const e = escena('f3');
  const t = e.salio[0] ?? '';
  assert.doesNotMatch(t, /limitaciones reales|escaladas al equipo|registro técnico/i, 'afirmó cómo está el producto');
  assert.doesNotMatch(t, /borra el registro/i, 'le indicó borrar el registro');
  assert.doesNotMatch(t, /^\s*\d+\.\s*$/m, 'quedaron números de lista sueltos');
  assert.ok(t.includes(SIN_BORRAR), 'no dijo la verdad');
  assert.match(t, TICKET);
  assert.equal(e.tickets.length, 1);
  // Sólo lo del producto: su propia línea, y su ticket.
  const p = sinLoQueMaKoNoDice('Te entiendo perfecto, es el disparador. Son limitaciones reales actuales del motor, ya escaladas al equipo.');
  assert.deepEqual([p.texto, p.ticket], [`Te entiendo perfecto, es el disparador.\n\n${SIN_SABER_DEL_PRODUCTO}`, true]);
});

test('4. (1676) la nota de voz citada se escucha con Groq, el reclamo llega con herramientas, y «no puedo escuchar audios» no sale', () => {
  const e = escena('f4');
  assert.deepEqual(e.escuchas, ['api.groq.com'], 'no se escuchó por el Groq de la nota de voz del grupo');
  assert.equal(e.modelo.length, 1);
  assert.ok(e.modelo[0].persona.startsWith('No me respondiste lo de este audio\n\n(cita una nota de voz de 94 s; la escuchaste y dice: «Quiero que cuando comenten fiesta'), 'lo que dice el audio no llegó al turno');
  assert.ok(e.modelo[0].tools.length > 0, 'el reclamo llegó sin herramientas');
  const t = e.salio[0] ?? '';
  assert.doesNotMatch(t, /no puedo escuchar audios|no tengo la transcripci/i, 'dijo que no escucha audios');
  assert.doesNotMatch(t, /Mándame el texto exacto/i, 'pidió el texto de un audio que ya escuchó');
  assert.ok(t.includes(ESCUCHO_AUDIOS));
  assert.deepEqual(e.tickets, [], 'un ticket falso');
  // El reclamo sin la cita tampoco es charla (era «confirmación sin nada pendiente», sin herramientas).
  assert.notEqual(clasificarIntencion('No me respondiste lo de este audio').intencion, 'charlar');
  assert.equal(clasificarIntencion('No, gracias').intencion, 'charlar', 'un «no» de verdad sigue siendo charla');
  assert.match(NUCLEO_GRUPO, /Nunca le indiques borrar, eliminar ni dar de baja datos/);
  assert.match(NUCLEO_GRUPO, /Tampoco cómo está el producto ni qué tiene el equipo/);
});

test('5. (1643) el audio del lote que no se escuchó deja su marca EN SU LUGAR: el «tal cual» no se contesta a ciegas', () => {
  const e = escena('f5');
  assert.equal(e.salio.length, 2, 'el aviso del audio y la respuesta');
  assert.match(e.salio[0], /^Me llegó tu audio pero no lo pude escuchar/);
  assert.equal(e.modelo.length, 1);
  const p = e.modelo[0].persona;
  const marca = p.indexOf(`(1) ${AUDIO_DEL_LOTE_SIN_ESCUCHAR}`);
  assert.ok(marca >= 0, 'el modelo no sabe que antes hubo una nota de voz que no se escuchó');
  assert.ok(p.indexOf('(2) Tal cual como lo hace manychat') > marca, 'el «tal cual» no va después del audio');
  // Y si se escuchó, lo que dice va antes del «tal cual».
  const b = escena('f5escucha');
  assert.equal(b.salio.length, 1);
  assert.match(b.modelo[0].persona, /\(1\) Quiero que el bot responda los comentarios de Instagram\.\n\n\(2\) Tal cual como lo hace manychat/);
});

test('6. «Hola Martin, …» es para el equipo: MaKo no contesta como él, y el ticket queda aunque el modelo no lo marque', () => {
  const e = escena('f6');
  assert.equal(e.modelo.length, 1);
  assert.ok(e.modelo[0].system.includes(bloqueParaElEquipo('Martín')), 'el turno no sabe que el mensaje es para Martín');
  assert.match(e.salio[0] ?? '', TICKET, 'el mensaje para el equipo no dejó ticket');
  assert.equal(e.tickets.length, 1);
  assert.match(e.tickets[0].descripcion, /gracias por avisar lo del filtro.*\(lo que le escribió a Martín, del equipo de MaKo\)/s);
  // La clave del ticket sale de lo que pidió, no del saludo: dos mensajes a Martín no son el mismo ticket.
  assert.notEqual(e.tickets[0].ref, escena('f2').tickets[0]?.ref);
  // Un «gracias» suelto a Martín: ni 👍, ni turno.
  const g = escena('f6gracias');
  assert.deepEqual([g.r.skip, g.modelo.length, g.salio.length, g.reacciones], ['no es para MaKo (a-otro)', 0, 0, 0]);
  // En el grupo del propio equipo (el workspace SuperAdmin) hablarle a Martín es lo normal: ni el bloque ni un ticket por mensaje.
  // Se mira el cableado: ese grupo contesta con la IA de la plataforma, que en un test no llega al modelo.
  assert.match(leerDoer(), /const paraElEquipo = wsData === \(await wsSuperAdmin\(\)\.catch\(\(\) => null\)\) \? null : paraAlguienDelEquipo\(sinPrefijoDeLote\(texto\)\);/,
    'en el grupo del equipo (SuperAdmin), «Martín, …» abriría un ticket por mensaje');
  // A quién le habla.
  assert.deepEqual(paraAlguienDelEquipo('Hola Martin, probamos la 680'), { nombre: 'Martín', resto: 'probamos la 680' });
  assert.equal(paraAlguienDelEquipo('Martín: ¿y el filtro?')?.resto, '¿y el filtro?');
  assert.equal(paraAlguienDelEquipo('[Te mandó 2 mensajes]\n\n(1) ok\n\n(2) Buen día Martín! una duda')?.resto, 'una duda');
  assert.equal(paraAlguienDelEquipo('Hola Leandro, ¿subiste el reel?'), null);
  assert.equal(paraAlguienDelEquipo('Martina, ¿subiste el reel?'), null);
  assert.equal(paraAlguienDelEquipo('Hola Teo, ¿y el filtro?', ['Martín', 'Teo'])?.nombre, 'Teo');
  const base = { menciones: [], nombraAMaKo: false, makoPregunto: false, hayPendientes: false };
  assert.equal(noEsParaMaKo({ ...base, texto: 'Hola Martín!' }), 'a-otro');
  assert.equal(noEsParaMaKo({ ...base, texto: 'Hola Martín, gracias!' }), 'a-otro', 'el saludo con un «gracias» detrás del nombre');
  assert.equal(noEsParaMaKo({ ...base, texto: 'Hola Martin, ¿y el filtro?' }), null, 'una pregunta a Martín corre el turno (con el bloque)');
});

// ── Probado rompiéndolo (29/10/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   R1  sin la regla 3-quinquies (un dictado con 2+ preguntas es consulta)                       → falla el 1
//   R2  `indicaBorrar` nunca ve nada                                                             → fallan el 2 y el 3
//   R3  `afirmaDelProducto` nunca ve nada                                                         → falla el 3
//   R4  `niegaAudios` nunca ve nada                                                               → falla el 4
//   R5  el lote de la entrada vuelve al `continue` sin la marca del audio                         → falla el 5
//   R6  sin `bloqueParaElEquipo` en el system                                                     → falla el 6
//   R7  sin la marca de ticket que pone el código para el mensaje al equipo                       → falla el 6
//   R8  `QUEJA_NO_ANDA` sin «no me respondiste»                                                   → falla el 4
//   R9  sin «saludo + nombre + acuse» (`Hola Martín, gracias!`)                                   → no fallaba NINGUNO: la otra regla
//       («Gracias Martín») cubría «Hola Martín!». Se sumó ese caso; con él                        → falla el 6
//   R10 sin «acuse + nombre» (`¡Gracias Martín!`)                                                 → falla el 6
//   R11 `escuchoUnAudio` siempre en false (sale «Mándame el texto exacto»)                        → falla el 4
//   R12 la clave del ticket con el saludo («Hola Martin» delante: dos mensajes, un ticket)        → falla el 6
//   R13 sin la excepción del grupo del equipo (SuperAdmin)                                        → falla el 6
//   R14 con la IA caída, «era del Plan» vuelve a mirar la lista y la ruta, no la intención        → falla el 1
