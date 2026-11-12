// =============================================================================
// MaKo en WhatsApp sigue la conversación: el seguimiento sigue el pedido del hilo, y lo de antes vuelve como hechos
// =============================================================================
// Martín, 26/10/2026: «MaKo en WhatsApp (que no funciona muy bien, no guarda contexto)». lib/doer-hilo.ts.
//
// LO MEDIDO, con el clasificador y el armado de herramientas REALES (`clasificarIntencion` + `herramientasDelTurno`, la
// regla de docs/hallazgos-api-mako.md: un test que arma el turno a mano prueba otra cosa):
//   · seis seguimientos de un pedido que MaKo ya contestó: cuatro caían en «capturar (dudosa): sin señal clara» con 2
//     herramientas («pausala», «publicá la del webinar», «mandales un mensaje a esos 5», «pasale la segunda para mañana») y
//     dos en el área equivocada («ya lo conecté, analizá la última» sin el Closing). Con el hilo, los seis traen la
//     herramienta que hace lo que piden.
//   · el grupo de Pablo (ws18, mako_doer_conv del 16-17/10/2026, literal; los nombres y la dirección, cambiados): «Mago,
//     probá de vuelta agendarle a Pablo lo que te pidió en el calendario» llegó 19 horas después del pedido y de los datos:
//     afuera de las 14 horas de memoria, MaKo no sabía qué era «lo que te pidió». Ahora vuelve como hecho, con su fecha.
//
// ⚠️ Los primeros mensajes son reales (los del ws18 y el de Florencia del ws21, ya en el repo); los seguimientos de las
//    campañas, las landings y los leads son la forma que se repite, armados: el 26/10 la lectura de producción para medir
//    más conversaciones quedó frenada por el permiso «Production Reads» (docs/hallazgos-comunicacion.md).
//
// Probado rompiéndolo (26/10/2026), una rotura por vez: ver docs/hallazgos-comunicacion.md («MaKo en WhatsApp no seguía la
// conversación»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion, makoPreguntoAlgo } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import {
  bloqueLoQueMostraste, bloqueYaSeHablo, CLAVE_REFS, conElHilo, consultaDelTurno, LARGO_SEGUIMIENTO, partirMemoria, pedidoDelHilo,
  referenciasDeLaSalida, refiereAlHilo, TOPE_HECHOS, unirRefs, VIGENCIA_REFS_MS, type FilaDelHilo,
} from '../lib/doer-hilo';
import type { Vista } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

/** Las de siempre, pedidas a un node con la condición del server (el molde de tests/mako-en-whatsapp-pablo.test.ts). */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };

/** El turno como lo arma el doer: el mensaje, y el hilo si lo sigue (lib/mako-doer-in.ts). `pendientes`: los resúmenes de
 *  las vigentes del grupo, como se los pasa el doer. */
function turno(pedido: string, mako: string, mensaje: string, conHilo = true, pendientes: string[] = []) {
  const historial = [{ role: 'user' as const, content: pedido }, { role: 'assistant' as const, content: mako }];
  const hayPendientes = pendientes.length > 0;
  const delMensaje = clasificarIntencion(mensaje, { makoPregunto: makoPreguntoAlgo(mako), hayPendientes });
  const h = conHilo ? conElHilo(delMensaje, mensaje, pedidoDelHilo(historial), mako) : { veredicto: delMensaje, hilo: null };
  const t = herramientasDelTurno({ veredicto: h.veredicto, texto: mensaje, hilo: h.hilo, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes, resumenesPendientes: pendientes });
  return { veredicto: h.veredicto, nombres: t.tools.map((x) => x.name), areas: t.areas };
}

// Los seguimientos medidos: el pedido, lo que contestó MaKo, el seguimiento y la herramienta que lo hace.
const SEGUIMIENTOS: Array<[string, string, string, string]> = [
  ['¿qué tiene que hacer Pedro hoy?', 'Hoy Pedro tiene 3 tareas: 1) Llamar a Norma 2) Mandar el presupuesto 3) Revisar la landing. ¿Quieres que mueva alguna?', 'pasale la segunda para mañana', 'cambiar_fecha_tarea_plan'],
  ['¿cómo va la campaña del webinar?', 'La campaña «Webinar octubre» gastó USD 42 y trajo 9 leads a USD 4,7. Va bien.', 'pausala igual, que ya llenamos el cupo', 'proponer_estado_campana'],
  ['¿qué landings tengo?', 'Tienes 2 landings: «Curso inicial» (publicada) y «Webinar» (borrador).', 'publicá la del webinar', 'publicar_landing'],
  // El de Florencia (ws21, 22/10, literal) y lo que le contesta MaKo desde el 25/10.
  ['Estas analizando mis fathom?', 'Para analizar tus reuniones de Fathom primero hay que conectarlo 👇 https://hola-mako.com/integraciones?abrir=fathom', 'ya lo conecté, analizá la última', 'panorama_closing'],
  ['¿cuántos leads entraron esta semana?', 'Entraron 14 leads esta semana; 5 vienen de la campaña del webinar.', 'mandales un mensaje a esos 5', 'recomendar_mensajes_whatsapp'],
  // Código Inmobiliario, 26/10: pidió los nombres de los no-shows y MaKo contestó «no se lista nominalmente…».
  ['¿cuántos no-shows tuve este mes?', 'Este mes tuviste 25 no-shows y 14 reuniones sin marcar.', '¿cuáles son? pasame sus nombres', 'listar_leads_embudo_maduro'],
];

test('1. lo medido: el seguimiento SOLO no llegaba con su herramienta', () => {
  const sinHilo = SEGUIMIENTOS.map(([p, m, s, id]) => ({ s, id, r: turno(p, m, s, false) }));
  const caian = sinHilo.filter((x) => !x.r.nombres.includes(x.id)).map((x) => x.s);
  // Los cinco: es lo que hay que arreglar. Si alguno empieza a llegar solo, el clasificador cambió y el caso se revisa.
  assert.deepEqual(caian, SEGUIMIENTOS.map(([, , s]) => s));
  assert.equal(sinHilo.filter((x) => x.r.veredicto.intencion === 'capturar' && x.r.veredicto.dudosa).length, 4);
});

test('2. con el hilo, cada seguimiento sigue el pedido y trae la herramienta que lo hace', () => {
  for (const [p, m, s, id] of SEGUIMIENTOS) {
    const r = turno(p, m, s);
    assert.ok(r.nombres.includes(id), `«${s}» (después de «${p}») → ${r.veredicto.intencion} (${r.veredicto.porque}): no trae ${id}`);
    assert.equal(r.veredicto.sigueElHilo, true, `«${s}»: no marca que sigue el hilo`);
    assert.equal(r.veredicto.dudosa, false);
  }
  // Las áreas son las del PEDIDO; las de lo que contestó MaKo, sólo si el pedido no nombró ninguna, y sólo su tema: «9 leads»
  // o «revisar la landing» de paso corrían el presupuesto y dejaban afuera la herramienta del pedido.
  assert.deepEqual(turno(SEGUIMIENTOS[2][0], SEGUIMIENTOS[2][1], SEGUIMIENTOS[2][2]).areas, ['landing']);
  assert.deepEqual(turno(SEGUIMIENTOS[1][0], SEGUIMIENTOS[1][1], SEGUIMIENTOS[1][2]).areas, ['ads']);
  assert.deepEqual(turno(SEGUIMIENTOS[0][0], SEGUIMIENTOS[0][1], SEGUIMIENTOS[0][2]).areas, ['plan']);
  // La pregunta sola por los no-shows ya trae la que lista (el área de métricas los nombra desde el 27/10).
  assert.ok(turno('hola', 'Hola', '¿cuántos no-shows tuve este mes?', false).nombres.includes('listar_leads_embudo_maduro'));
  // Una acción del hilo PROPONE: por WhatsApp sigue pasando por el «sí» (lo que no cambia de esta red).
  const pausa = turno(SEGUIMIENTOS[1][0], SEGUIMIENTOS[1][1], SEGUIMIENTOS[1][2]);
  assert.equal(pausa.veredicto.intencion, 'actuar');
  // Los datos que MaKo PIDIÓ, en cualquier área (no sólo la agenda, `siguePedidoDeAgenda`): no apuntan a nada, contestan.
  const datos = 'Juan Pérez, 11 5555 5555';
  assert.ok(!refiereAlHilo(datos));
  const lead = turno('cargame un lead nuevo', 'Dale. ¿Cómo se llama y cuál es su teléfono?', datos);
  assert.ok(lead.nombres.includes('proponer_lead'), `«${datos}» → ${lead.veredicto.intencion} (${lead.veredicto.porque})`);
  assert.equal(turno('cargame un lead nuevo', 'Dale. ¿Cómo se llama y cuál es su teléfono?', datos, false).veredicto.intencion, 'capturar');
});

test('3. lo que NO es un seguimiento queda como estaba', () => {
  const [p, m] = SEGUIMIENTOS[4];
  // Una muletilla, una idea nueva, un agradecimiento: lo mismo que sin el hilo.
  for (const s of ['bueno', 'mmm', 'mañana tengo que llamar al contador', 'ok gracias', 'jaja']) {
    assert.deepEqual(turno(p, m, s).veredicto, turno(p, m, s, false).veredicto, `«${s}» cambió con el hilo`);
  }
  // «mmm» después de «¿Quieres que la pause?» no la pausa.
  assert.notEqual(turno('¿cómo va la campaña del webinar?', 'Gastó USD 42. ¿Quieres que la pause?', 'mmm').veredicto.intencion, 'actuar');
  // Un volcado largo es otro pedido, aunque diga «la del webinar».
  const largo = `la del webinar ${'y otra cosa que te quiero contar '.repeat(8)}`;
  assert.ok(largo.length > LARGO_SEGUIMIENTO);
  assert.equal(turno(SEGUIMIENTOS[2][0], SEGUIMIENTOS[2][1], largo).veredicto.sigueElHilo, undefined);
  // Sin respuesta de MaKo no hay hilo vivo: dos mensajes seguidos de la persona son un lote, no un seguimiento.
  assert.equal(pedidoDelHilo([{ role: 'assistant', content: 'Hola' }, { role: 'user', content: '¿cómo va la campaña del webinar?' }]), null);
  // Y un pedido nuevo que nombra su área se lee solo.
  const nuevo = turno(SEGUIMIENTOS[2][0], SEGUIMIENTOS[2][1], '¿cuántos leads entraron hoy?');
  assert.equal(nuevo.veredicto.sigueElHilo, undefined);
  assert.equal(nuevo.veredicto.intencion, 'consultar');
});

test('3-bis. un seguimiento levantado desde la duda NO confirma ni cancela lo pendiente; el «sí» y el «no» de verdad, sí', () => {
  // La revisión del 26/10/2026: la #400 pendiente (irreversible, ni a terceros ni plata) y MaKo preguntando «¿Confirmás?».
  const pedido = 'eliminá la etapa Seguimiento del funnel';
  const mako = 'Voy a eliminar la etapa «Seguimiento». ¿Confirmás?';
  const pend = ['#400: Eliminar la etapa «Seguimiento»'];
  for (const s of ['esperá, primero movamos esos leads', 'eso está mal', 'también la de Cierre']) {
    const r = turno(pedido, mako, s, true, pend);
    assert.equal(r.veredicto.sigueElHilo, true, `«${s}» dejó de seguir el hilo: el caso ya no se mide`);
    assert.equal(r.veredicto.noResuelvePendientes, true, `«${s}»`);
    for (const id of ['confirmar_accion', 'cancelar_accion']) assert.ok(!r.nombres.includes(id), `«${s}» trae ${id}: puede resolver la #400 sin el «sí»`);
  }
  // El «sí» y el «no» puros siguen siendo la confirmación de siempre, con sus dos herramientas.
  for (const s of ['sí', 'no', 'dale']) {
    const r = turno(pedido, mako, s, true, pend);
    assert.equal(r.veredicto.intencion, 'confirmar', `«${s}»`);
    assert.ok(r.nombres.includes('confirmar_accion') && r.nombres.includes('cancelar_accion'), `«${s}» perdió confirmar/cancelar`);
  }
});

test('4. qué es apuntar a lo hablado: el verbo con pronombre y la referencia, no cualquier «-la»', () => {
  for (const s of ['pausala', 'mandales', 'cambiale el título', 'pasale la segunda', 'publicá la del webinar', 'esos 5', 'la última', 'también a Ana', 'de vuelta'])
    assert.ok(refiereAlHilo(s), `«${s}» no apunta a lo hablado`);
  for (const s of ['hola', 'la escuela', 'solo quería saber', 'bueno', 'te paso el link', 'mañana tengo que llamar al contador'])
    assert.ok(!refiereAlHilo(s), `«${s}» se lee como si apuntara a lo hablado`);
});

// ── 2. Lo de antes de la ventana vuelve como HECHO ──────────────────────────────────────────────────────────────────

// El grupo de Pablo (ws18), literal en lo de MaKo y en el pedido; el nombre, la dirección y el colaborador, cambiados.
const PEDIDO_VISITA = 'Hola MaKo, ¿cómo estás? ¿Me agendás una visita en el Google Calendar mañana a las 9:30 horas?';
const PIDE_DATOS = 'Para dejártela agendada mañana sábado 17 a las 9:30, pásame el nombre o email del cliente y la dirección de la propiedad, así la creo con todos los datos.';
const DATOS = 'El nombre es Norma y la dirección es Calle Falsa 123';
const NO_PUDE = 'Desde este chat no tengo acceso para escribir en tu Google Calendar.';
const DE_VUELTA = 'Mago, probá de vuelta agendarle a Pedro lo que te pidió en el calendario.';
const AHORA = Date.parse('2026-10-17T13:30:00Z');
const GRUPO: FilaDelHilo[] = [
  // De lo más NUEVO a lo más viejo, como las trae la base.
  { role: 'assistant', content: NO_PUDE, created_at: '2026-10-16T18:21:00Z' },
  { role: 'user', content: DATOS, created_at: '2026-10-16T18:20:00Z' },
  { role: 'assistant', content: PIDE_DATOS, created_at: '2026-10-16T18:17:00Z' },
  { role: 'user', content: PEDIDO_VISITA, created_at: '2026-10-16T18:16:00Z' },
];

test('5. ws18: «probá de vuelta… lo que te pidió» llega 19 h después, y lo que se pidió vuelve como hecho con su fecha', () => {
  const m = partirMemoria(GRUPO, AHORA);
  // Afuera de las 14 horas: ningún turno (un «sí» de ahora no se pega a nada de ayer)…
  assert.deepEqual(m.reciente, []);
  assert.deepEqual(m.antes.map((f) => f.content), [PEDIDO_VISITA, PIDE_DATOS, DATOS, NO_PUDE], 'lo de antes no quedó en orden');
  // …y como hecho, con la fecha en la zona del negocio.
  const b = bloqueYaSeHablo(m.antes, [], new Date(AHORA), 'America/Argentina/Buenos_Aires');
  assert.match(b, /^LO QUE YA SE HABLÓ EN ESTE GRUPO/);
  assert.match(b, /- ayer 15:16, te escribieron: «Hola MaKo, ¿cómo estás\? ¿Me agendás una visita en el Google Calendar mañana a las 9:30 horas\?»/);
  assert.match(b, /- ayer 15:20, te escribieron: «El nombre es Norma y la dirección es Calle Falsa 123»/);
  assert.match(b, /  tú: «Desde este chat no tengo acceso/);
  assert.match(b, /No son pedidos de ahora: no los hagas ni los confirmes por un «sí» de ahora/, 'sin la advertencia, vuelve el «sí, cargalo» del 26/07');
  assert.match(b, /usa lo que ya te dijo en vez de volver a preguntarlo/);
  // Y el pedido de hoy se lee solo (no hay hilo vivo en la ventana): es un pedido de agenda.
  assert.equal(pedidoDelHilo(m.reciente), null);
  assert.equal(clasificarIntencion(DE_VUELTA).intencion, 'actuar');
});

test('6. la charla reciente sigue siendo de turnos: 12 como máximo, en las últimas 14 h, sin saltear ninguno', () => {
  const filas: FilaDelHilo[] = Array.from({ length: 20 }, (_, i) => ({
    role: i % 2 ? 'assistant' : 'user', content: `m${i}`, created_at: new Date(AHORA - i * 600_000).toISOString(),
  }));
  const m = partirMemoria(filas, AHORA);
  assert.equal(m.reciente.length, 12);
  assert.deepEqual(m.reciente.map((t) => t.content), Array.from({ length: 12 }, (_, i) => `m${11 - i}`));
  assert.deepEqual(m.antes.map((f) => f.content), Array.from({ length: 8 }, (_, i) => `m${19 - i}`));
  // Un hueco de más de 14 h corta la charla ahí: lo de más atrás va a «antes» aunque sean pocos.
  const conHueco = [filas[0], filas[1], { ...filas[2], created_at: new Date(AHORA - 15 * 3600_000).toISOString() }];
  assert.deepEqual(partirMemoria(conHueco, AHORA).reciente.map((t) => t.content), ['m1', 'm0']);
});

test('7. lo que MaKo propuso o hizo en el grupo: con su número, su fecha y cómo terminó; y el tope', () => {
  const b = bloqueYaSeHablo([], [
    { id: 381, resumen: 'Agendar visita con Norma, sáb 17/10 9:30, Calle Falsa 123', estado: 'vencida', resultado: null, created_at: '2026-10-16T18:22:00Z' },
    { id: 377, resumen: 'Mover la tarea «Mandar el presupuesto» al lunes', estado: 'ejecutada', resultado: 'ok', created_at: '2026-10-15T12:00:00Z' },
    { id: 375, resumen: 'Pausar la campaña «Webinar octubre»', estado: 'error', resultado: 'Meta contestó 400: token vencido', created_at: '2026-10-14T12:00:00Z' },
  ], new Date(AHORA), 'America/Argentina/Buenos_Aires');
  assert.match(b, /LO QUE PROPUSISTE O HICISTE AHÍ \(cómo terminó\):/);
  assert.match(b, /- ayer 15:22: #381 Agendar visita con Norma, sáb 17\/10 9:30, Calle Falsa 123 → venció sin confirmar/);
  assert.match(b, /#377 Mover la tarea «Mandar el presupuesto» al lunes → hecha$/m);
  assert.match(b, /#375 Pausar la campaña «Webinar octubre» → falló \(Meta contestó 400: token vencido\)/);
  // Sin nada, nada (no un encabezado vacío).
  assert.equal(bloqueYaSeHablo([], [], new Date(AHORA), 'UTC'), '');
  // Mucha charla: se van las líneas más VIEJAS, nunca el encabezado ni las acciones.
  const mucha: FilaDelHilo[] = Array.from({ length: 40 }, (_, i) => ({ role: 'user', content: `pedido número ${i} ${'x'.repeat(150)}`, created_at: new Date(AHORA - (40 - i) * 3600_000).toISOString() }));
  const tope = bloqueYaSeHablo(mucha, [{ id: 1, resumen: 'algo', estado: 'ejecutada', created_at: new Date(AHORA).toISOString() }], new Date(AHORA), 'UTC');
  assert.ok(tope.length <= TOPE_HECHOS, `${tope.length} caracteres`);
  assert.match(tope, /^LO QUE YA SE HABLÓ/);
  assert.match(tope, /pedido número 39/);
  assert.doesNotMatch(tope, /pedido número 0 /);
  assert.match(tope, /#1 algo → hecha/);
});

test('8. el conocimiento del negocio se busca por el tema de la charla, no sólo por «y eso?»', () => {
  assert.equal(consultaDelTurno('y eso?', null), 'y eso?');
  assert.equal(consultaDelTurno('pausala', '¿cómo va la campaña del webinar?'), '¿cómo va la campaña del webinar?\npausala');
});

// ── 3. El doer lo usa (el cableado; lo de arriba prueba la regla) ───────────────────────────────────────────────────

test('9. el doer: la memoria partida, el turno con el hilo, la consulta con el tema y los hechos sólo en su system', () => {
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /const memoria = hayInvitado \? [^\n]* : await memoriaDelGrupo\(wsData, jid, \{ turnos: 12, dias: DIAS_DE_HECHOS \}\);\n/);
  // Desde el 11/11/2026 el historial es la memoria FUNDIDA con el chat de verdad de la línea (lib/hilo-real.ts: lo que salió por la línea
  // sin pasar por el turno —un aviso, el equipo, un envío a mano— no estaba en la memoria; tests/hilo-del-superadmin.test.ts). Sin el
  // store, la memoria sola, como antes.
  // Y donde está prendida, la conversación del módulo común (lib/conversacion.ts, 12/11/2026) va primero.
  assert.match(doer, /const historial = conversacion \? conversacion\.turnos\n\s*: chatReal\n\s*\? conElChatReal\(memoria\.recienteFilas, chatReal, \{[^\n]*\}\)\n\s*: memoria\.reciente;/);
  // (`historialGrupo(wsData, jid, 1)` sí: es el último turno, para saber si un «ok» contesta una pregunta, lib/doer-para-quien.ts.)
  assert.doesNotMatch(doer, /const historial = await historialGrupo\(/, 'el doer volvió a leer la memoria sin lo de antes');
  // (Desde el 27/10/2026 pasa también por la corrección de monto: tests/doer-falla.test.ts.)
  assert.match(doer, /const conHilo = conElHilo\(delMensaje, texto, pedidoDelHilo\(historial\), typeof ultimoDeMako === 'string' \? ultimoDeMako : null\);\n(?:\s*\/\/[^\n]*\n|\s*const loDeAntes = [^\n]*\n)*\s*(?:const correccion = laCorreccion\(conHilo\.veredicto, [^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*const (?:intencion|porReglas) = (?:enElGrupoSinSenal\()?correccion\.veredicto|const intencion = conHilo\.veredicto)[,;)]/);
  assert.match(doer, /veredicto: intencion, texto, contextoDelSi, hilo: conHilo\.hilo,/, 'las herramientas no reciben el hilo');
  assert.match(doer, /query: consultaDelTurno\(texto, conHilo\.hilo\)/);
  assert.match(doer, /bloqueYaSeHablo\(\s*memoria\.antes,\s*await accionesDelGrupo\(wsData, jid, DIAS_DE_HECHOS\)/, 'lo de antes no llega a los hechos');
  // Los hechos y lo que mostraste van al system del turno y NUNCA al de la red de la plataforma, que corre sin datos de clientes.
  assert.match(doer, /const conMemoria = hayInvitado \? [^\n]*\n\s*: baseDelSystem === base \? \[(?:bloqueQuienEscribe\(data\.pushName\), )?(?:ctxCita, )?(?:ctxParaElEquipo, )?(?:ctxContacto, )?(?:ctxEquipo, ctxPedidos, )?ctxYaSeHablo, ctxMostrado(?:,\n\s*laPlataforma \? [^\]]*)?\]\.filter\(Boolean\)/);
  // (Desde el 12/11/2026 el último del system es el bloque de la plataforma, sólo en el grupo de SuperAdmin: lib/doer-plataforma.ts.)
  // Lo que mostraron las herramientas: se anota cada salida y se guarda al final del turno, si no fue un cartel.
  assert.match(doer, /if \(propuesta\) propuestasDelTurno\.set\(propuesta\.id, propuesta\);\n(?:[^\n]*(?:escribioDelTurno\+\+|leyoDelTurno = true);\n)*\s*\/\/ Los ids que mostró[^\n]*\n\s*const refs = referenciasDeLaSalida\(name, out\);/);
  assert.match(doer, /if \(!avisoDeSistema && !hayInvitado && refsDelTurno\.length\) await setSetting\(CLAVE_REFS\(jid\), unirRefs\(refsGuardadas, refsDelTurno, Date\.now\(\)\)\)/);
  assert.match(doer, /const refsGuardadas = await getSetting\(CLAVE_REFS\(jid\)\)\.catch\(\(\) => null\);\n\s*const ctxMostrado = bloqueLoQueMostraste\(refsGuardadas, Date\.now\(\)\);/);
  assert.match(doer, /\$\{ctxPuntos \? `\\n\\n\$\{ctxPuntos\}` : ''\}(?:\$\{ctxFalla\})?\$\{conMemoria\}`;/);
  assert.match(doer, /armarSystem\(toolsRed, [^\n]*, baseRed\)/);
  // La marca de contexto le dice que resuelva lo que señala con lo de arriba.
  assert.match(doer, /si el último mensaje se refiere a algo de acá \(«pausala», «la segunda», «esos 5», el dato que pediste\), resuélvelo con esto y no vuelvas a preguntar lo que ya te dijeron/);
  const herr = leer('lib/doer-herramientas.ts');
  assert.match(herr, /: v\.sigueElHilo && p\.hilo \? `\$\{p\.hilo\}\\n\$\{propio\}`/);
  const conv = leer('lib/mako-doer-conv.ts');
  // (Desde el 12/11/2026 devuelve además las filas recientes con su hora y su id, para fundir el chat de la línea: lib/hilo-real.ts.)
  assert.match(conv, /return \{ \.\.\.partirMemoria\(filas, Date\.now\(\), \{ turnos, horas: HORAS_CONTEXTO \}\), recienteFilas \};/);
  const pend = leer('lib/mako-pendientes.ts');
  assert.match(pend, /\.eq\('grupo_jid', grupoJid\)\.neq\('estado', 'pendiente'\)/, 'lo que hizo MaKo trae también las vigentes (ya van aparte)');
});

// ── 4. Lo que mostraron las herramientas, para el turno siguiente ───────────────────────────────────────────────────

test('10. de lo que devuelve una herramienta quedan sus ids y sus nombres (las `clave` de lo que MaKo recomendó también)', () => {
  // La forma de `que_recomienda_mako` (lib/api-mako/areas/mako.run.ts de «MaKo inteligente», 93d54117f): `clave` y `hacer`.
  // La forma exacta, de su chat: { pantalla, recomendaciones: [{ clave, hacer, cambia, porque[], de_donde[], abrir?, … }],
  // lo_que_mejoro: [{ clave, aceptada_el }], descartadas: [{ clave, como, cuando, motivo? }], nota? }.
  const rec = JSON.stringify({ pantalla: 'whatsapp', recomendaciones: [
    { clave: 'leads-esperando', hacer: 'Contestar a los 4 leads que esperan respuesta', cambia: 'responder antes', porque: ['hace 6 h'], de_donde: ['wa_mensajes'] },
    { clave: 'landing-sin-pixel', hacer: 'Poner el píxel en la landing del webinar', cambia: 'medir', porque: ['0 eventos'], de_donde: ['landing'], abrir: 'https://hola-mako.com/web-generator' },
  ], lo_que_mejoro: [], descartadas: [{ clave: 'subir-precio', como: 'no-aplica', cuando: '2026-10-20', motivo: 'ya lo subí en septiembre' }] });
  assert.deepEqual(referenciasDeLaSalida('que_recomienda_mako', rec), { herramienta: 'que_recomienda_mako', items: [
    { id: 'leads-esperando', nombre: 'Contestar a los 4 leads que esperan respuesta' },
    { id: 'landing-sin-pixel', nombre: 'Poner el píxel en la landing del webinar' },
    // La descartada también: su `clave` es la que pide una «reabierta».
    { id: 'subir-precio', nombre: 'ya lo subí en septiembre [descartadas]' },
  ] });
  // Una lista suelta, una adentro de otro objeto, un objeto solo y la salida de error del runner.
  assert.deepEqual(referenciasDeLaSalida('listar_tareas_plan', JSON.stringify([{ id: 12, titulo: 'Llamar a Norma' }, { id: 13, titulo: 'Mandar el presupuesto' }]))?.items.map((x) => x.id), ['12', '13']);
  assert.deepEqual(referenciasDeLaSalida('ver_landing_creada', JSON.stringify({ ok: true, landing: { id: 7, nombre: 'Webinar' } }))?.items, [{ id: '7', nombre: 'Webinar' }]);
  assert.deepEqual(referenciasDeLaSalida('x', { content: JSON.stringify([{ lead_id: 5, nombre: 'Ana' }]), isError: false })?.items, [{ id: '5', nombre: 'Ana' }]);
  // Lo que no tiene ids no deja nada: un texto, JSON sin ids, una lista de números.
  for (const s of ['Listo, la pausé.', JSON.stringify({ ok: true, total: 14 }), JSON.stringify([1, 2, 3])]) assert.equal(referenciasDeLaSalida('x', s), null, s);
  // Hasta diez cosas por lista: una lista de 300 leads no es contexto.
  assert.equal(referenciasDeLaSalida('listar_leads', JSON.stringify(Array.from({ length: 300 }, (_, i) => ({ id: i, nombre: `L${i}` }))))?.items.length, 10);
});

test('11. lo que mostraste vuelve al turno siguiente con los ids, y deja de valer pasada la ventana', () => {
  const ahora = Date.parse('2026-10-26T12:00:00Z');
  const guardado = JSON.stringify({ at: ahora - 3 * 60_000, refs: [{ herramienta: 'que_recomienda_mako', items: [{ id: 'leads-esperando', nombre: 'Contestar a los 4 leads' }, { id: 'landing-sin-pixel', nombre: 'Poner el píxel' }] }] });
  const b = bloqueLoQueMostraste(guardado, ahora);
  assert.match(b, /^LO QUE MOSTRARON TUS HERRAMIENTAS EN EL TURNO ANTERIOR \(los ids, para resolver «esa», «la segunda», «esos 5», «descarta esa»/);
  assert.match(b, /- que_recomienda_mako \(hace 3 min\):\n  1\) leads-esperando «Contestar a los 4 leads»\n  2\) landing-sin-pixel «Poner el píxel»/);
  assert.equal(bloqueLoQueMostraste(JSON.stringify({ at: ahora - VIGENCIA_REFS_MS - 1, refs: JSON.parse(guardado).refs }), ahora), '', 'lo de ayer sigue siendo «la segunda»');
  for (const g of [null, '', 'no es json', JSON.stringify({ at: ahora, refs: [] })]) assert.equal(bloqueLoQueMostraste(g, ahora), '');
  // Es por grupo.
  assert.equal(CLAVE_REFS('123@g.us'), 'mako.doer.refs.123@g.us');
});

test('12. lo de cada herramienta se recuerda aparte: «descartá esa» dos mensajes después sigue sabiendo cuál', () => {
  const t0 = Date.parse('2026-10-26T12:00:00Z');
  const rec = { herramienta: 'que_recomienda_mako', items: [{ id: 'leads-esperando', nombre: 'Contestar a los 4 leads' }] };
  const plan = { herramienta: 'listar_tareas_plan', items: [{ id: '12', nombre: 'Llamar a Norma' }] };
  // Turno 1: las recomendaciones. Turno 2: otra herramienta. Las recomendaciones siguen.
  const g1 = unirRefs(null, [rec], t0);
  const g2 = unirRefs(g1, [plan], t0 + 5 * 60_000);
  const b = bloqueLoQueMostraste(g2, t0 + 6 * 60_000);
  assert.match(b, /- que_recomienda_mako \(hace 6 min\):\n  1\) leads-esperando «Contestar a los 4 leads»/);
  assert.match(b, /- listar_tareas_plan \(hace 1 min\):\n  1\) 12 «Llamar a Norma»/);
  // La misma herramienta otra vez pisa lo suyo (la lista nueva es la que cuenta).
  const g3 = unirRefs(g2, [{ herramienta: 'listar_tareas_plan', items: [{ id: '20', nombre: 'Otra' }] }], t0 + 7 * 60_000);
  assert.doesNotMatch(bloqueLoQueMostraste(g3, t0 + 8 * 60_000), /Llamar a Norma/);
  // Lo vencido se va al guardar, y no más de seis herramientas.
  assert.doesNotMatch(unirRefs(g1, [plan], t0 + VIGENCIA_REFS_MS + 60_000), /leads-esperando/);
  const muchas = Array.from({ length: 9 }, (_, i) => ({ herramienta: `h${i}`, items: [{ id: String(i), nombre: '' }] }));
  assert.equal(JSON.parse(unirRefs(null, muchas, t0)).refs.length, 6);
  // El formato de antes (un `at` para todo) se sigue leyendo.
  assert.match(bloqueLoQueMostraste(JSON.stringify({ at: t0, refs: [rec] }), t0 + 60_000), /leads-esperando/);
});
