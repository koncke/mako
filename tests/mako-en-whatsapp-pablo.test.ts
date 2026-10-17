// =============================================================================
// MaKo en el grupo de Pablo (ws18, 16/10/2026): lo que dijo que no podía, lo que prometió y no hizo, y cómo habló
// =============================================================================
// Las frases son las LITERALES del grupo (mako_doer_conv del ws18, 16/10 entre las 18:16 y las 22:35 UTC). El turno
// se arma con lo MISMO que corre el doer: `clasificarIntencion` + `herramientasDelTurno` (la regla de
// docs/hallazgos-api-mako.md: un test que arma el turno a mano prueba otra cosa). Lo que se midió ese día, con el
// código de main:
//
//   «probá el calendario de google»             → capturar (dudosa), 2 herramientas del plan → «primero debes activar
//                                                  la integración», con Google Calendar CONECTADO desde las 12:03.
//   «Hola MaKo, ¿cómo estás? ¿Me agendás…?»    → consultar: en una pregunta no viajan las que escriben.
//   «El nombre es Nancy y la dirección es…»     → capturar (dudosa), 2 herramientas → «desde este chat no tengo acceso
//                                                  para escribir en tu Google Calendar».
//   «¿qué tiene que hacer Pablo hoy…?»          → consultar CON ver_plan y listar_tareas_plan, y el modelo (Gemini
//                                                  flash-lite, 28 tokens) contestó «Déjame ver el plan…» sin llamarlas.
//   Y la voz: «la cagada es real», «vendehumo», «para no clavarte», «bótame», «sin que lo caguen».
//
// Probado rompiéndolo (17/10/2026), una rotura por vez y con todo en verde antes: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion, makoPidioDatos, esPedidoDeAgenda, makoPreguntoAlgo } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { promesasDe, groseriasDe, sanearSalida, SIN_HACER } from '../lib/doer-salida';
import type { Vista } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Los nombres de las herramientas de siempre, pedidos a un node con la condición del server (el molde de
 *  tests/agenda-whatsapp.test.ts: una lista escrita a mano se queda vieja). */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 18, rol: 'admin', tabs: null };

type Ctx = Parameters<typeof clasificarIntencion>[1];
function turno(mensaje: string, ctx: Ctx = {}, contextoDelSi: string | null = null) {
  const veredicto = clasificarIntencion(mensaje, ctx);
  const t = herramientasDelTurno({
    veredicto, texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes: false,
    contextoDelSi: veredicto.sigueOfrecimiento ? contextoDelSi : null, sinCalendly: true,
  });
  return { veredicto, nombres: t.tools.map((x) => x.name) };
}
const trae = (m: string, id: string, r: ReturnType<typeof turno>) =>
  assert.ok(r.nombres.includes(id), `«${m}» → ${r.veredicto.intencion}${r.veredicto.dudosa ? ' (dudosa)' : ''} (${r.veredicto.porque}): no trae ${id} (llegaron ${r.nombres.length}: ${r.nombres.slice(0, 8).join(', ')}…)`);
const ESCRITURAS_AGENDA = /^proponer_(agendar|mover|cambiar|cancelar)_/;

// Lo que dijo MaKo, literal.
const PIDE_DATOS = 'Para dejártela agendada mañana sábado 17 a las 9:30, pásame el nombre o email del cliente y la dirección de la propiedad, así la creo con todos los datos.';
const PEDIDO_VISITA = 'Hola MaKo, ¿cómo estás? ¿Me agendás una visita en el Google Calendar mañana a las 9:30 horas?';

// --- 1. El turno ---------------------------------------------------------------------------------

test('«probá el calendario de google» llega con la lectura del estado de Google, y sin escribir nada', () => {
  const m = 'probá el calendario de google';
  const r = turno(m);
  assert.equal(r.veredicto.intencion, 'consultar', `«${m}»: ${r.veredicto.porque}`);
  trae(m, 'ver_estado_google_calendar', r);
  assert.deepEqual(r.nombres.filter((n) => ESCRITURAS_AGENDA.test(n)), [], 'probar una integración no escribe nada');
  // Y «prueba» suelto sigue siendo el saludo con que se estrena un canal.
  assert.equal(clasificarIntencion('prueba').intencion, 'charlar');
});

test('«¿cómo estás?» antes del pedido se pela, y «¿me agendás una visita…?» es una acción con su herramienta', () => {
  const r = turno(PEDIDO_VISITA);
  assert.equal(r.veredicto.intencion, 'actuar', `${r.veredicto.porque}`);
  trae(PEDIDO_VISITA, 'proponer_agendar_agenda', r);
  // Sin el saludo, también: el pronombre adelante («me agendás») es el verbo.
  const sin = '¿Me agendás una visita en el Google Calendar mañana a las 9:30 horas?';
  trae(sin, 'proponer_agendar_agenda', turno(sin));
  // «cómo están los leads» es una pregunta por un dato, no un saludo: no se pela.
  assert.equal(clasificarIntencion('cómo están los leads de esta semana?').intencion, 'consultar');
  assert.equal(clasificarIntencion('hola, cómo estás?').intencion, 'charlar');
});

test('los datos que MaKo pidió para la visita siguen el pedido, con la herramienta de agendar', () => {
  assert.ok(makoPidioDatos(PIDE_DATOS), 'un «pásame…» sin signo de pregunta no cuenta como pedirle algo');
  assert.ok(!makoPreguntoAlgo(PIDE_DATOS), 'si esto da verdadero, el caso dejó de ser el del 16/10 (no había «?»)');
  assert.ok(esPedidoDeAgenda(PEDIDO_VISITA), 'el pedido anterior no se reconoce como de agenda');
  const m = 'El nombre es Nancy y la dirección es Alem 1987';
  // El doer arma `siguePedidoDeAgenda` así (lib/mako-doer-in.ts) y el «sí» elige por el pedido + lo que pidió MaKo.
  const r = turno(m, { siguePedidoDeAgenda: true }, `${PEDIDO_VISITA}\n${PIDE_DATOS}`);
  assert.equal(r.veredicto.intencion, 'actuar', `«${m}»: ${r.veredicto.porque}`);
  trae(m, 'proponer_agendar_agenda', r);
  // Sin el pedido de antes, es lo de siempre: material.
  assert.notEqual(clasificarIntencion(m).intencion, 'actuar');
  // Y una pregunta nueva después del «pásame…» es una pregunta: en una pregunta MaKo ofrece.
  assert.equal(clasificarIntencion('¿cuántos leads entraron hoy?', { siguePedidoDeAgenda: true }).intencion, 'consultar');
});

test('el doer le dice al clasificador si la respuesta sigue un pedido de agenda', () => {
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  const cls = doer.slice(doer.indexOf('clasificarIntencion(texto, {'), doer.indexOf('});', doer.indexOf('clasificarIntencion(texto, {')));
  assert.match(cls, /siguePedidoDeAgenda:\s*makoPidioDatos\(/, 'el doer no le pasa siguePedidoDeAgenda: «Nancy, Alem 1987» vuelve a caer a material');
  assert.match(cls, /esPedidoDeAgenda\(r\.content\)/, 'siguePedidoDeAgenda no mira los pedidos anteriores de la persona');
});

test('«¿qué tiene que hacer Pablo hoy?» llega con las del plan (lo que faltó fue LLAMARLAS)', () => {
  const m = 'mentira, ya esta conectado, que tiene que hacer pablo hoy, que tareas les quedan agendadas?';
  const r = turno(m);
  trae(m, 'listar_tareas_plan', r);
  trae(m, 'ver_estado_google_calendar', r);
});

// --- 1-bis. Lo que encontró el vigía en su primera pasada (10 al 17/10, todos los grupos) -----------------------------

test('ws13: «Si 18 de noviembre» —la fecha que MaKo pidió— sigue el pedido de agenda, y no sale por el camino barato', () => {
  const pedido = 'Agendame para el 18 de diciembre el cumpleaños de José, ¿cómo es tu apellido? A ver, ¿cómo es tu apellido? Pontaroli. ¿José? Pontaroli. Pontaroli, 18 de noviembre. Agendame un evento durante el día para festejarle el cumpleaños, para decirle feliz cumple.';
  const pidio = 'Pásame la fecha definitiva y la hora que te quede cómoda para armarte el evento de **«Cumpleaños de José Pontaroli»** y dejártelo listo para confirmar.';
  assert.ok(esPedidoDeAgenda(pedido) && makoPidioDatos(pidio));
  const m = 'Si 18 de noviembre';
  const r = turno(m, { siguePedidoDeAgenda: true }, `${pedido}\n${pidio}`);
  assert.equal(r.veredicto.intencion, 'actuar', r.veredicto.porque);
  trae(m, 'proponer_agendar_agenda', r);
  // El router lo leía como charla («si») y el camino barato corría SIN herramientas, antes de mirar la intención.
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  assert.match(doer, /const pideHerramientas = intencion\.intencion !== 'charlar' && !intencion\.dudosa;/);
  assert.match(doer, /if \(ruta\.tier === 'cheap' && !mediaBlocks && !pideHerramientas\)/, 'el camino barato vuelve a correr sin mirar si el clasificador pidió herramientas');
});

test('ws13: «Pasamelo» después de «Eso lo miro y te lo paso» reclama el pedido de antes, con sus herramientas', () => {
  const pedido = 'MaKo pasame todas las reuniones que tengo hoy, nombre, apellido, número de teléfono y horario de la reunión.';
  const prometio = 'Eso lo miro y te lo paso.';
  assert.ok(promesasDe(prometio).length > 0, 'la frase literal del 13/10 no se ve como promesa');
  const previa = clasificarIntencion(pedido).intencion;
  const r = turno('Pasamelo', { pedidoPrometido: previa }, `${pedido}\n${prometio}`);
  assert.equal(r.veredicto.intencion, previa, r.veredicto.porque);
  assert.ok(r.veredicto.reclamaPromesa);
  trae('Pasamelo', 'agenda_del_dia', r);
  // Sin promesa, «Pasamelo» es lo de siempre; y «no, dejá» no reclama nada.
  assert.notEqual(clasificarIntencion('Pasamelo').intencion, previa);
  assert.notEqual(clasificarIntencion('no, dejá', { pedidoPrometido: previa }).porque, 'le reclama a MaKo lo que le prometió');
  // El doer elige las herramientas por el pedido prometido, no por el «ok» que vino en el medio.
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  assert.match(doer, /pedidoPrometido: pedidoPrometido\?\.v\?\.intencion/, 'el doer no le pasa al clasificador el pedido prometido');
  assert.match(doer, /intencion\.reclamaPromesa && pedidoPrometido \? pedidoPrometido\.c/, 'las herramientas se eligen por el «ok» y no por el pedido');
});

test('una propuesta que pide el «sí», o un «dime la hora y te lo agendo», no son promesas', () => {
  // ws9, 10/10/2026: la propuesta de agenda de siempre. Y ws13, 13/10: pide el dato que le falta.
  assert.deepEqual(promesasDe('Voy a agendar la visita con Demo Lead para el martes 13 a las 11:00 en tu Google Calendar con invitación a su correo. ¿Confirmas con un «sí»?'), []);
  assert.deepEqual(promesasDe('Listo, con el **18 de noviembre** confirmado.\n\nDime a qué hora exacta quieres que te ponga la alerta en el calendario para el cumpleaños de José Pontaroli y te lo agendo de una.'), []);
});

// --- 2. Lo que sale ------------------------------------------------------------------------------

const PROMESAS_DEL_16 = [
  'Perdón, me colgué con el desvío. Déjame ver el plan y las tareas para Pablo en este momento.',
  'Jajaja, acepto el reto. Si no te resuelvo, bótame.\n\nDéjame revisar primero el tablero para no duplicar nada y te cargo las tareas del plan de 1 semana directo al plan.',
];

test('una promesa sin ninguna herramienta corrida no sale: se dice que no se hizo', () => {
  for (const r of PROMESAS_DEL_16) {
    assert.ok(promesasDe(r).length > 0, `no se ve la promesa en «${r}»`);
    const s = sanearSalida(r, { corrioHerramientas: false });
    assert.ok(!/d[eé]jame (ver|revisar)|te cargo/i.test(s.texto), `salió la promesa: «${s.texto}»`);
    assert.ok(s.texto.endsWith(SIN_HACER), `sin la promesa no se dice que no se hizo: «${s.texto}»`);
  }
  // Con una herramienta corrida, «te cargo…» puede ser el paso siguiente honesto: se deja.
  assert.equal(sanearSalida(PROMESAS_DEL_16[1], { corrioHerramientas: true }).promesas.length, 0);
});

test('un ofrecimiento es una PREGUNTA y no se toca', () => {
  for (const o of [
    '¿Quieres que te anote este plan con nombre propio en el tablero para empezar a tachar tareas?',
    '¿Te la agendo mañana a las 12 en tu Google Calendar?',
    'Listo, quedó propuesto. ¿Te cargo también la visita de Nancy?',
  ]) assert.deepEqual(promesasDe(o), [], `un ofrecimiento se leyó como promesa: «${o}»`);
  // Y lo que ya pasó no es una promesa.
  assert.deepEqual(promesasDe('Ya te cargué las 4 tareas en el plan.'), []);
});

const GROSERAS_DEL_16 = [
  'Te entiendo perfecto, la cagada es real. Quedé como un vendehumo prometiendo algo que por acá no puedo hacer.\n\nMete la visita a mano en tu Google Calendar para Nancy en Alem 1987 mañana a las 9:30 y seguimos.',
  'Cárgala directo en tu calendario para no clavarte: **Nancy**, mañana **sábado 17 a las 9:30 hs** en **Alem 1987**.',
  'Busca liquidez para zafar de una urgencia o destrabar su próximo paso sin que lo caguen con el precio.',
  'Jajaja, acepto el reto. Si no te resuelvo, bótame.',
];

test('las groserías del 16/10 se ven, y la oración que las trae no sale', () => {
  for (const r of GROSERAS_DEL_16) {
    assert.ok(groseriasDe(r).length > 0, `no se ve la grosería en «${r}»`);
    const s = sanearSalida(r, { corrioHerramientas: true });
    assert.deepEqual(groseriasDe(s.texto), [], `salió igual: «${s.texto}»`);
  }
  // Lo que no es grosero queda: se saca la oración, no el mensaje.
  const s = sanearSalida(GROSERAS_DEL_16[0], { corrioHerramientas: true });
  assert.match(s.texto, /Mete la visita a mano/);
  // Y las palabras neutras no se marcan.
  assert.deepEqual(groseriasDe('Hay que salir a quemar las naves y clavar la idea en el primer segundo. Ponle un forro al celular.'), []);
});

test('el doer sanea ANTES de mandar, con las herramientas que corrieron, y lo deja en el Saldo de IA', () => {
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  const i = doer.indexOf('sanearSalida(respuesta, { corrioHerramientas: corridasDelTurno > 0 })');
  assert.ok(i > 0, 'el doer no sanea la salida, o no le pasa si corrió alguna herramienta');
  assert.ok(i < doer.indexOf('const v = validarRespuestaDoer(respuesta'), 'el saneo quedó después de la compuerta');
  assert.ok(i < doer.indexOf('enviarAGrupoJid(jid, enviar[i])'), 'el saneo quedó después del envío');
  assert.match(doer.slice(i - 400, i + 900), /recordUsage\('saneo-doer'/, 'lo saneado no queda en ningún lado: el vigía no lo ve');
  // El contador se suma en CADA corrida (también lo que devuelve el memo: eso se hizo).
  const rt = doer.slice(doer.indexOf('const runTool = async'), doer.indexOf('const previo = memo.previo(name)'));
  assert.match(rt, /corridasDelTurno\+\+/, 'corridasDelTurno no cuenta las corridas');
  // Y prometer sin hacer en la cascada barata se reintenta con la herramienta obligatoria.
  assert.match(doer, /corridasDelTurno === corridasAntes && tools\.length && promesasDe\(texto2\)\.length/, 'la promesa sin hacer no se reintenta');
});

test('la voz del grupo prohíbe prometer y putear, en el preámbulo que va SIEMPRE', () => {
  const doer = leer('lib/mako-doer-in.ts');
  const voz = doer.slice(doer.indexOf('const DOER_WA_VOZ = `'), doer.indexOf('const DOER_WA_TOOLS'));
  assert.match(voz, /NO PROMETAS LO QUE NO HACES/);
  assert.match(voz, /SIN groserías/);
  assert.match(voz, /NO AFIRMES EL ESTADO DE UNA INTEGRACIÓN/);
});

// Probado rompiéndolo (17/10/2026), una rotura por vez, todo en verde antes (13 de 13). 19 roturas, todas con su fallo:
//   · CORTESIA fuera de SALUDOS                                  → 2 fallos (el «¿cómo estás?» y Nancy, que lo usa).
//   · sin «(me|nos|le|les) agendás» en VERBO_AGENDAR              → 2 fallos (los mismos dos).
//   · sin la regla 2-bis (probar una integración)                 → 1 fallo.
//   · sin la regla 3-bis-bis (los datos que pidió MaKo)           → 1 fallo.
//   · `makoPidioDatos` = `makoPreguntoAlgo`                       → 1 fallo.
//   · el doer sin `siguePedidoDeAgenda`                           → 1 fallo.
//   · una pregunta cuenta como promesa                            → 1 fallo.
//   · `sanearSalida` sin `SIN_HACER`                              → 1 fallo.
//   · sin «botame» en GROSERIAS                                   → 1 fallo.
//   · el saneo con `corrioHerramientas: true` fijo                → 1 fallo.
//   · `runTool` sin `corridasDelTurno++`                          → 1 fallo.
//   · sin el reintento de la promesa en la cascada barata         → 1 fallo.
//   · el preámbulo sin «SIN groserías ni lunfardo»                → 1 fallo.
//   Las del vigía (ws13, ws9):
//   · sin la regla 3-ter-promesa (la promesa reclamada)           → 1 fallo.
//   · el camino barato sin mirar si el clasificador pidió herramientas → 1 fallo.
//   · las herramientas por el «ok» y no por el pedido prometido   → 1 fallo.
//   · el doer sin `pedidoPrometido`                               → 1 fallo.
//   · una propuesta que termina pidiendo el «sí» cuenta como promesa → 1 fallo.
//   · pedir un dato («dime la hora y te lo agendo») cuenta como promesa → 1 fallo.
