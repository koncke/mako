// =============================================================================
// «Crear con IA» arma el Recurrente que se pide, sólo con lo que se pide, y dice qué hizo (20/10/2026)
// =============================================================================
// Martín, 20/10/2026 (punto 4, texto entero en docs/relevo/chatbot.md): «revisa el chat de Leila con Automations... Le
// pidió literalmente que creara una automatización usando el CRON de Recurrente, y creó cualquier cosa... eso debería ser
// inteligente, no crear cosas por defecto». El caso es #284 de ws11 (NO se toca: lo decide Martín). Pidió «cada semana
// los días martes a las 3 de la tarde ... a todos los que tenemos en el funnel principal» y salió «Llega a «1ª sesión sin
// costo»» sin horario, 7 tarjetas de las que 6 no estaban pedidas (un «Si responde», 3 respuestas de IA y 2 «Avisar al
// equipo»), y al editar MaKo contestó «Cambié 2».
//
// Lo que fija (las dependencias de crear son de mentira y anotan cada escritura, como tests/flujo-ia-crear.test.ts):
//   (a) el pedido LITERAL de Leila sobre un contexto como el de ws11 da un Recurrente semana/martes/15:00 con TODAS las
//       etapas del Funnel principal, 1 mensaje, a lo sumo un AI Step con objetivo, ningún «Avisar al equipo», la
//       reentrada «Cada vez que vuelve a entrar», sin «hermosa» y un «Creé…» que dice cuándo, a quién y qué manda;
//   (b) con «los martes» sin hora, MaKo pregunta la hora en vez de crear (y no escribe nada); después, a quién;
//   (c) una edición de texto dice qué tarjeta cambió y cómo, y que falta Publicar;
//   (d) el motor: dos ocurrencias de un Recurrente inscriben dos veces al mismo lead (la segunda, al que terminó);
//   y las piezas: el parser del horario (la hora de AL LADO, no la de la sesión), el CRON por la puerta de la pantalla
//   (`recurrenteDeValorIA`), «corté la flecha» que ya no le llega a la clienta y la galería que no se mete.
//
// PROBADO ROMPIÉNDOLO (20/10/2026, arnés `romper.py` + `roturas-recurrente.json`): ver el pie.
//
// Correr: node --import tsx --test tests/crear-ia-recurrente.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearConIA, type DepsCrearIA } from '../lib/flujo-ia-crear-core';
import {
  horarioDelPedido, horarioConRespuestas, audienciaDelPedido, preguntaHorario, sinApodos, apodosDeVoz, ERROR_RECURRENTE_SIN_COHORTE,
} from '../lib/flujo-ia-recurrente';
import {
  deIA, deIAEdicion, userDeCrear, plantillaParaPedido, disparadoresParaIA, LISTA_BLANCA_IA, SUGERENCIA_AVISO, CIERRE_EDICION,
  type CtxIA,
} from '../lib/flujo-ia';
import { preguntaAntes } from '../lib/flujo-ia-preguntas';
import { opcionesCronIA, recurrenteDeValorIA, disparadorDeValorIA } from '../lib/disparadores';
import { claseDe, esPasoIA, type PasoGrafo } from '../lib/flujo-grafo';
import { esMako } from '../lib/flujo-conversacion';
import { puedeReentrar, barridoEsEvento } from '../lib/reentrada';
import { porId } from '../lib/api-mako/registro';
import type { RespuestaMako } from '../lib/automatizacion-chat';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El pedido de Leila, LITERAL (automatizacion.chat:284, 20/10/2026 20:45:48Z). */
const PEDIDO_LEILA = 'cada semana los días martes a las 3 de la tarde hay que mandar un recordatorio a todos los que tenemos en el funnel principal de que mañana es la sesión de lídermente a las 7:30 si van a asistir';

/** El Funnel principal de ws11 (funnel 4, el de por defecto), con las etapas que medimos el 20/10 (sin las salidas). */
const PRODUCTOS_WS11 = [{
  funnelId: 4, productoId: 31, nombre: 'Funnel principal', esDefault: true, etapasEntrega: [],
  etapas: [
    { value: 'nuevo', label: 'Contacto nuevo' }, { value: 'conversacion', label: 'Conversación abierta' },
    { value: 'agenda', label: '1ª sesión sin costo' }, { value: 'mensualidad', label: 'Esperando la mensualidad' },
    { value: 'activo', label: 'Miembro activo' }, { value: 'reactivacion', label: 'Nutrición - Reactivación' },
  ],
}];
const TODO_EL_FUNNEL = 'venta:4:nuevo,conversacion,agenda,mensualidad,activo,reactivacion';
const ETIQUETAS_WS11 = [{ id: 51, nombre: 'Lídermente', archivada_at: null }];
const acciones = LISTA_BLANCA_IA.map((id) => {
  const d = porId(id);
  if (!d) throw new Error(`la lista blanca nombra «${id}», que no está en el registro`);
  return { id: d.id, titulo: d.titulo, parametros: d.parametros };
});
const ctxWs11 = (pedido: string): CtxIA => ({
  etiquetas: ETIQUETAS_WS11.map((e) => ({ id: e.id, nombre: e.nombre })),
  productos: PRODUCTOS_WS11,
  disparadores: disparadoresParaIA(opcionesCronIA({ productos: PRODUCTOS_WS11, etiquetas: ETIQUETAS_WS11, conectados: { instagram: false, messenger: false, email: false, pagos: false } })),
  audios: [], archivos: [], acciones, links: {}, pedido,
});
/** La guía de voz de ws11 nombra «hermosa» (cuatro veces, medido el 20/10). */
const VOZ_WS11 = 'Escribo cercana y cálida. Saludo con «Holaa hermosa!» y uso emojis. Cierro con un abrazo.';

/** Lo que armó el modelo para #284 (la forma medida: 1 mensaje, «Si responde» con Confirma / No puede / otra cosa, 3 IA y 2 avisos). */
const COMO_284 = {
  nombre: 'Recordatorio sesión Lídermente', disparador: 'd3', inicio: 't1',
  tarjetas: [
    { id: 't1', tipo: 'mensaje', canal: 'whatsapp', texto: 'Holaa hermosa! Te recuerdo que mañana es la sesión de Lídermente a las 7:30. ¿Vas a poder asistir?' },
    { id: 'r1', tipo: 'si_responde', objetivo: 'Que confirme si asiste a la sesión', casos: [
      { titulo: 'Confirma', cuando: 'Dice que va', sigue: 'r2' },
      { titulo: 'No puede', cuando: 'Dice que no puede ir', sigue: 'r3' },
    ], otra_cosa: 'r4' },
    { id: 'r2', tipo: 'mensaje', canal: 'whatsapp', ia: true, texto: 'Agradécele y dile que la esperamos.', sigue: 'r5' },
    { id: 'r5', tipo: 'accion', operacion: 'avisar_al_equipo', datos: { mensaje: '{{nombre_completo}} confirmó la sesión' } },
    { id: 'r3', tipo: 'mensaje', canal: 'whatsapp', ia: true, texto: 'Dile que no pasa nada y que la próxima la esperamos.', sigue: 'r6' },
    { id: 'r6', tipo: 'accion', operacion: 'avisar_al_equipo', datos: { mensaje: '{{nombre_completo}} no puede ir' } },
    { id: 'r4', tipo: 'mensaje', canal: 'whatsapp', ia: true, texto: 'Contesta lo que pregunte sobre la sesión.' },
  ],
};

type Llamada = { op: string; args: unknown[] };
function deps(pedido: string, o: { contar?: number | null; modelo?: Record<string, unknown> } = {}) {
  const ll: Llamada[] = [];
  const anota = (op: string, ...args: unknown[]) => { ll.push({ op, args }); };
  let guardados: PasoGrafo[] | null = null;
  const d: DepsCrearIA = {
    contexto: async () => ({ ctx: ctxWs11(pedido), perfil: 'Programa de liderazgo para mujeres (Lídermente).', voz: VOZ_WS11 }),
    system: async () => 'system',
    generar: async (p) => {
      anota('generar', p.user);
      const tr = p.traducir(o.modelo ?? COMO_284);
      assert.deepEqual(tr.errores, [], 'el flujo de mentira no pasa la revisión');
      return { r: tr.r };
    },
    crearEtiquetas: async (nuevas) => { anota('etiquetas', nuevas.length); return { ids: new Map(), creadas: [] }; },
    filaDe: async () => ({ pasos: guardados ?? [], nombre: 'x' }),
    insertar: async (nombre) => { anota('insertar', nombre); return { id: 500, nombre: String(nombre) }; },
    borrar: async (id) => { anota('borrar', id); },
    pausar: async (id) => { anota('pausar', id); },
    guardarPasos: async (id, pasos) => { anota('guardar', id); guardados = pasos; },
    motivoDePasos: () => null,
    ponerDisparador: async (id, valor, cron) => { anota('cron', id, valor, cron ?? null); },
    motivoDeDisparador: () => null,
    ponerReentrada: async (id, modo) => { anota('reentrada', id, modo); },
    contar: async () => (o.contar === undefined ? 12 : o.contar),
    renombrar: async (id, nombre) => { anota('renombrar', id, nombre); return nombre || null; },
    guardarChat: async (id, mensajes) => { anota('chat', id, mensajes.map((m) => m.texto)); },
  };
  return { d, ll, guardados: () => guardados ?? [], ops: () => ll.map((x) => x.op) };
}
const ESCRITURAS = new Set(['etiquetas', 'insertar', 'borrar', 'pausar', 'guardar', 'cron', 'reentrada', 'renombrar', 'chat']);

// ── El horario, por código ───────────────────────────────────────────────────────

test('el horario del pedido de Leila: los martes a las 15:00 (la de AL LADO, no las 7:30 de la sesión)', () => {
  assert.deepEqual(horarioDelPedido(PEDIDO_LEILA), { completo: true, cron: { unidad: 'semana', cada: 1, hora: 15, minuto: 0, diaSemana: 2 } });
  const casos: Array<[string, unknown]> = [
    ['todos los días a las 9 de la mañana', { unidad: 'dia', cada: 1, hora: 9, minuto: 0 }],
    ['de lunes a viernes a las 18hs avisales', { unidad: 'semana', cada: 1, hora: 18, minuto: 0, diaSemana: 1, dias: [1, 2, 3, 4, 5] }],
    ['los lunes y jueves a las 10:30', { unidad: 'semana', cada: 1, hora: 10, minuto: 30, diaSemana: 1, dias: [1, 4] }],
    ['cada semana, el martes, a las tres y media de la tarde', { unidad: 'semana', cada: 1, hora: 15, minuto: 30, diaSemana: 2 }],
    ['el 15 de cada mes a las 12', { unidad: 'mes', cada: 1, hora: 12, minuto: 0, diaMes: 15 }],
    ['cada 2 horas', { unidad: 'hora', cada: 2, hora: 9, minuto: 0 }],
  ];
  for (const [t, cron] of casos) assert.deepEqual(horarioDelPedido(t), { completo: true, cron }, t);
  // No es un Recurrente: un evento, una espera.
  for (const t of ['cuando un lead llega a Agendado mandale un mensaje', 'espera 2 días y mandale otro', 'el martes le escribes']) assert.equal(horarioDelPedido(t), null, t);
  // Falta algo: lo dice, con lo que se sabe.
  const sinHora = horarioDelPedido('los martes mandales un recordatorio de la clase');
  assert.equal(sinHora?.completo, false);
  assert.equal(sinHora && !sinHora.completo && sinHora.falta, 'hora');
  assert.equal(horarioDelPedido('cada semana mandá un mensaje a todos')?.completo === false && (horarioDelPedido('cada semana mandá un mensaje a todos') as { falta: string }).falta, 'dia');
  // «el 15 a mis clientes» no es «15 a. m.».
  assert.equal((horarioDelPedido('el 15 a mis clientes los martes') as { falta?: string }).falta, 'hora');
  // El día 30 no existe todos los meses: se pregunta, no se corre al 1.
  assert.equal((horarioDelPedido('el 30 de cada mes a las 10') as { falta?: string }).falta, 'dia');
});

test('a quién: «todos los del funnel principal» son TODAS sus etapas; sin decir a quién, se pregunta', () => {
  const ctx = ctxWs11(PEDIDO_LEILA);
  assert.deepEqual(audienciaDelPedido(PEDIDO_LEILA, ctx), { valor: TODO_EL_FUNNEL, texto: 'todos los de «Funnel principal»' });
  // «Lídermente» es el TEMA del pedido, no una etiqueta a la que se le escribe (el pedido no habla de etiquetas).
  assert.equal('valor' in audienciaDelPedido(PEDIDO_LEILA, ctx), true);
  const sinQuien = audienciaDelPedido('los martes a las 3 recordales la clase', ctx);
  assert.ok('elige' in sinQuien && sinQuien.elige === 'preguntar');
  assert.deepEqual('opciones' in sinQuien ? sinQuien.opciones.map((x) => x.label) : [], ['Todos los de «Funnel principal»', 'Los de «Contacto nuevo»', 'Los de «Conversación abierta»', 'Los de «1ª sesión sin costo»']);
  // Nombra una etapa: la elige el modelo.
  assert.deepEqual(audienciaDelPedido('los martes a las 3 recordales a los de Miembro activo', ctx), { elige: 'modelo' });
});

test('el CRON del Recurrente sale por la puerta de la pantalla: la cohorte con su horario, y un evento no', () => {
  const cron = { unidad: 'semana' as const, cada: 1, hora: 15, minuto: 0, diaSemana: 2 };
  const [d] = recurrenteDeValorIA(TODO_EL_FUNNEL, cron);
  assert.equal(d.trigger_tipo, 'etapa_actual');
  assert.equal(d.funnel_id, 4);
  assert.deepEqual([d.etapa, ...(d.etapas ?? []).slice(1)], ['nuevo', 'conversacion', 'agenda', 'mensualidad', 'activo', 'reactivacion']);
  assert.deepEqual(d.cron, cron);
  // Sin horario, el de siempre; un evento no tiene a quién barrer en cada vez.
  assert.equal(disparadorDeValorIA(TODO_EL_FUNNEL)[0].cron ?? null, null);
  assert.deepEqual(recurrenteDeValorIA('instagram:dm', cron), []);
  assert.deepEqual(recurrenteDeValorIA('etiqueta_agregada', cron), []);
  assert.equal(recurrenteDeValorIA('etiqueta:51', cron)[0].cron?.hora, 15);
});

// ── (a) El pedido de Leila, entero ───────────────────────────────────────────────

test('(a) el pedido LITERAL de Leila: Recurrente martes 15:00 a todo el funnel, 1 mensaje, un AI Step, sin avisos ni «hermosa»', async () => {
  const { d, ll, guardados } = deps(PEDIDO_LEILA);
  const r = await crearConIA({ ws: 11, pedido: PEDIDO_LEILA }, d);
  assert.ok(r.ok, JSON.stringify(r));
  // El CRON: a quién lo puso el código (no la «1ª sesión sin costo» que eligió el modelo), con el horario.
  const cron = ll.find((x) => x.op === 'cron')!;
  assert.deepEqual(cron.args, [500, TODO_EL_FUNNEL, { unidad: 'semana', cada: 1, hora: 15, minuto: 0, diaSemana: 2 }]);
  assert.equal(r.disparador, TODO_EL_FUNNEL);
  assert.deepEqual(r.cron, { unidad: 'semana', cada: 1, hora: 15, minuto: 0, diaSemana: 2 });
  // Cada martes le vuelve a llegar a quien terminó el anterior.
  assert.deepEqual(ll.find((x) => x.op === 'reentrada')?.args, [500, 'siempre']);
  // Las tarjetas: 1 mensaje, a lo sumo un AI Step con objetivo, ningún «Avisar al equipo».
  const pasos = guardados();
  const mensajes = pasos.filter((p) => claseDe(p) === 'mensaje' && (p as { tipo?: string }).tipo !== 'ia');
  assert.equal(mensajes.length, 1, JSON.stringify(pasos));
  const ias = pasos.filter((p) => esPasoIA(p));
  assert.ok(ias.length <= 1, `${ias.length} AI Step`);
  for (const ia of ias) assert.ok(String((ia as { objetivo?: string }).objetivo ?? '').trim(), 'un AI Step sin objetivo');
  assert.equal(pasos.filter((p) => claseDe(p) === 'respuesta' && !esPasoIA(p)).length, 0, 'quedó un «Si responde» con hijas');
  assert.equal(pasos.filter((p) => esMako(p)).length, 0, 'quedó un «Avisar al equipo» que nadie pidió');
  // «hermosa» no va en un mensaje para todos: va {{nombre}}.
  const cuerpo = String((mensajes[0] as { cuerpo?: string }).cuerpo);
  assert.doesNotMatch(cuerpo, /hermosa/i);
  assert.match(cuerpo, /^Holaa \{\{nombre\}\}! Te recuerdo/);
  // Lo que dice MaKo: cuándo, a quién (cuántos hoy) y qué manda; la sugerencia del aviso, en palabras de la clienta.
  assert.match(r.texto, /^Creé «Recordatorio sesión Lídermente»: sale todos los martes a las 15:00 a todos los de «Funnel principal» \(12 hoy\)\. Manda «Holaa \{\{nombre\}\}! Te recuerdo/);
  assert.match(r.texto, /Quedó pausada\.$/);
  assert.ok(r.avisos.includes(SUGERENCIA_AVISO), r.avisos.join(' | '));
  assert.ok(r.avisos.some((a) => a.startsWith('Saqué «hermosa»')), r.avisos.join(' | '));
  assert.ok(!r.avisos.some((a) => /corté la flecha|no cuelga de ninguna/.test(a)), r.avisos.join(' | '));
  // El chat de la fila nueva lleva ese mismo texto.
  assert.equal((ll.find((x) => x.op === 'chat')!.args[1] as string[]).at(-1), r.texto);
  // Lo que vio el modelo: CUÁNDO y A QUIÉN ya puestos, sin DISPARADORES (no hay nada que elegir) y sin la plantilla.
  const user = String(ll.find((x) => x.op === 'generar')!.args[0]);
  assert.match(user, /CUÁNDO: Todos los martes a las 15:00 \(es un RECURRENTE y el horario ya está puesto\)/);
  assert.match(user, /A QUIÉN: todos los de «Funnel principal» \(ya está puesto/);
  assert.doesNotMatch(user, /DISPARADORES \(clave/);
  assert.doesNotMatch(user, /LA DE ESA CATEGORÍA/);
});

test('sin poder contar, «Creé…» va sin número (nunca un cero inventado)', async () => {
  const { d } = deps(PEDIDO_LEILA, { contar: null });
  const r = await crearConIA({ ws: 11, pedido: PEDIDO_LEILA }, d);
  assert.ok(r.ok);
  assert.match(r.texto, /a todos los de «Funnel principal»\. Manda/);
});

// ── (b) Falta la hora: pregunta ──────────────────────────────────────────────────

test('(b) «los martes» sin hora: MaKo pregunta la hora y no escribe NADA; contestada, pregunta a quién (con cuántos hay)', async () => {
  const pedido = 'los martes mandales un recordatorio de la clase';
  const { d, ops } = deps(pedido);
  const r = await crearConIA({ ws: 11, pedido }, d);
  assert.ok(!r.ok && 'pregunta' in r, JSON.stringify(r));
  const p = (r as { pregunta: import('../lib/automatizacion-chat').PreguntaMako }).pregunta;
  assert.equal(p.sobre, 'horario');
  assert.deepEqual(p.opciones.map((x) => x.label), ['Todos los martes a las 09:00', 'Todos los martes a las 12:00', 'Todos los martes a las 15:00', 'Todos los martes a las 18:00']);
  assert.deepEqual(ops().filter((x) => ESCRITURAS.has(x) || x === 'generar'), [], `escribió: ${ops().join(', ')}`);

  // Elige las 15:00 → ahora, a quién (el pedido no lo dice), con cuántos hay hoy en cada opción.
  const resp: RespuestaMako[] = [{ preguntaId: p.id, sobre: 'horario', valor: p.opciones[2].valor }];
  const r2 = await crearConIA({ ws: 11, pedido, respuestas: resp }, d);
  assert.ok(!r2.ok && 'pregunta' in r2, JSON.stringify(r2));
  const q = (r2 as { pregunta: import('../lib/automatizacion-chat').PreguntaMako }).pregunta;
  assert.equal(q.sobre, 'quien');
  assert.equal(q.opciones[0].label, 'Todos los de «Funnel principal»');
  assert.equal(q.opciones[0].detalle, '12 hoy');

  // Contestó las dos: crea, con ESE horario y ESE a quién.
  const { d: d3, ll } = deps(pedido);
  const r3 = await crearConIA({ ws: 11, pedido, respuestas: [...resp, { preguntaId: q.id, sobre: 'quien', valor: q.opciones[0].valor }] }, d3);
  assert.ok(r3.ok, JSON.stringify(r3));
  assert.deepEqual(ll.find((x) => x.op === 'cron')!.args, [500, TODO_EL_FUNNEL, { unidad: 'semana', cada: 1, hora: 15, minuto: 0, diaSemana: 2 }]);
});

test('la hora escrita a mano («Otra cosa») y «Elige tú» también completan el horario', () => {
  const pedido = 'los martes mandales un recordatorio de la clase';
  const h = horarioDelPedido(pedido);
  assert.ok(h && !h.completo);
  const pq = preguntaHorario(h);
  assert.deepEqual(horarioConRespuestas(pedido, [{ preguntaId: pq.id, sobre: 'horario', valor: null, texto: 'a las 4 de la tarde' }]),
    { completo: true, cron: { unidad: 'semana', cada: 1, hora: 16, minuto: 0, diaSemana: 2 } });
  assert.deepEqual(horarioConRespuestas(pedido, [{ preguntaId: pq.id, sobre: 'horario', valor: null }]),
    { completo: true, cron: { unidad: 'semana', cada: 1, hora: 9, minuto: 0, diaSemana: 2 }, porDefecto: true });
  // Falta el día y la hora: con el día escrito a mano, todavía falta la hora (no se pone una a escondidas).
  const sinNada = horarioConRespuestas('cada semana mandá un recordatorio a todos', [{ preguntaId: 'x', sobre: 'horario', valor: null, texto: 'los jueves' }]);
  assert.equal(sinNada && !sinNada.completo && sinNada.falta, 'hora');
  // Lo pregunta preguntaAntes, con TOPE_RONDAS.
  assert.equal(preguntaAntes(pedido, ctxWs11(pedido))?.sobre, 'horario');
});

// ── (c) Una edición dice qué cambió ──────────────────────────────────────────────

test('(c) una edición de texto dice qué tarjeta cambió, cómo quedó y que falta Publicar', () => {
  const base: PasoGrafo[] = [
    { id: 'm1', canal: 'whatsapp', cuerpo: 'Holaa hermosa! Mañana es la sesión.', siguiente: null } as PasoGrafo,
    { id: 'inicio', nodo: 'inicio', siguiente: 'm1' },
  ];
  const ctx = ctxWs11('no pongas hermosa, pon el nombre');
  const r = deIAEdicion({ cambiar: [{ id: 'm1', texto: 'Holaa {{nombre}}! Mañana es la sesión.' }] }, base, ctx, () => 0.5);
  assert.deepEqual(r.cambiadas, ['m1']);
  const [linea, cierre] = r.resumen.split('\n');
  // El nombre de la tarjeta como se lee en el lienzo (`nombreDeTarjeta`, que recorta el texto).
  assert.equal(linea, 'Cambié «WHATSAPP: Holaa hermosa! Mañana es…»: ahora «WHATSAPP: Holaa {{nombre}}! Mañana…»');
  assert.equal(cierre, CIERRE_EDICION);
  assert.doesNotMatch(r.resumen, /^Cambié \d/);
});

// ── (d) El motor: cada ocurrencia le vuelve a llegar a quien terminó ─────────────

test('(d) dos ocurrencias de un Recurrente inscriben DOS veces al mismo lead (la segunda, al que terminó la primera)', () => {
  const recurrente = { cron: { unidad: 'semana', cada: 1, hora: 15, minuto: 0, diaSemana: 2 } };
  const deEtapa = { cron: null };
  // El motor, en chico: la PRIMERA ocurrencia inscribe al que no tiene fila; la segunda decide con `puedeReentrar` y
  // `barridoEsEvento` (lo mismo que `aInscribir` le pasa a `reusablesDe`, ver el guard de abajo).
  const filas = new Map<number, { estado: string }>();
  const ocurrencia = (sec: { cron: unknown }, lead: number): boolean => {
    const f = filas.get(lead);
    if (!f) { filas.set(lead, { estado: 'activa' }); return true; }
    const v = puedeReentrar('siempre', { fila: { estado: f.estado } as never, marcas: {} as never, reunionNuevaMs: null, porEvento: barridoEsEvento(sec) });
    if (v.entra) f.estado = 'activa';
    return v.entra;
  };
  assert.equal(ocurrencia(recurrente, 7), true, '1ª ocurrencia');
  filas.get(7)!.estado = 'completada';
  assert.equal(ocurrencia(recurrente, 7), true, '2ª ocurrencia: le vuelve a llegar al que terminó');
  // Mientras la anterior corre, no se le corta a la mitad.
  assert.equal(ocurrencia(recurrente, 7), false);
  // Un barrido SIN horario (una etapa) no es un evento: corre cada tick y mira quién ESTÁ.
  filas.set(8, { estado: 'completada' });
  assert.equal(ocurrencia(deEtapa, 8), false);
});

test('(d) guard: `aInscribir` le pasa a `reusablesDe` si el barrido es una ocurrencia (y nada más lo cambia)', () => {
  const src = sinComentarios(leer('lib/nutricion.ts'));
  const i = src.indexOf('async function aInscribir(');
  const cuerpo = src.slice(i, src.indexOf('\n}\n', i));
  assert.match(cuerpo, /reusablesDe\(db, filas, \(\) => modo, barridoEsEvento\(sec\)\)/);
  assert.equal(barridoEsEvento({ cron: null }), false);
  assert.equal(barridoEsEvento({}), false);
});

// ── Las piezas sueltas ───────────────────────────────────────────────────────────

test('un apodo sólo se saca donde se le HABLA a alguien, y el primero se vuelve {{nombre}}', () => {
  const apodos = apodosDeVoz(VOZ_WS11);
  assert.deepEqual(apodos, ['hermosa']);
  const de = (cuerpo: string) => sinApodos([{ cuerpo }], ['hermosa', 'linda']).pasos[0].cuerpo;
  assert.equal(de('Holaa hermosa! Mañana es la sesión.'), 'Holaa {{nombre}}! Mañana es la sesión.');
  assert.equal(de('Hola {{nombre}}, hermosa, ¿vienes?'), 'Hola {{nombre}}, ¿vienes?');
  assert.equal(de('¿Cómo estás, hermosa?'), '¿Cómo estás, {{nombre}}?');
  assert.equal(de('Qué linda sesión tuvimos'), 'Qué linda sesión tuvimos', 'no es un apodo: no se toca');
  // Una guía de MaKo contesta a UNA persona: no se toca.
  assert.equal(sinApodos([{ cuerpo: 'Dile hermosa', tipo: 'ia' }], ['hermosa']).pasos[0].cuerpo, 'Dile hermosa');
  assert.deepEqual(apodosDeVoz(null), []);
});

test('sin pedir un aviso, «Crear con IA» lo saca y lo sugiere; pedido, queda', () => {
  const conAviso = { inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}', sigue: 't2' },
    { id: 't2', tipo: 'accion', operacion: 'avisar_al_equipo', datos: { mensaje: 'Llegó uno' } },
  ] };
  const sin = deIA(conAviso, { ...ctxWs11('mandales la bienvenida'), soloLoPedido: true }, () => 0.3);
  assert.equal(sin.pasos.filter((p) => esMako(p)).length, 0);
  assert.ok(sin.avisos.includes(SUGERENCIA_AVISO));
  const con = deIA(conAviso, { ...ctxWs11('mandales la bienvenida y avísame en el grupo'), soloLoPedido: true }, () => 0.3);
  assert.equal(con.pasos.filter((p) => esMako(p)).length, 1);
  // «Avísales» es al lead: no es pedir un aviso al equipo.
  const ales = deIA(conAviso, { ...ctxWs11('avísales que mañana hay clase'), soloLoPedido: true }, () => 0.3);
  assert.equal(ales.pasos.filter((p) => esMako(p)).length, 0);
  // Editar y lo de siempre (sin la marca) no cambian.
  assert.equal(deIA(conAviso, ctxWs11('mandales la bienvenida'), () => 0.3).pasos.filter((p) => esMako(p)).length, 1);
});

test('un «Si responde» que nadie pidió y que ningún mensaje busca, se saca', () => {
  const json = { inicio: 't1', tarjetas: [
    { id: 't1', tipo: 'mensaje', texto: 'Hola {{nombre}}, mañana hay clase.' },
    { id: 'r1', tipo: 'si_responde', objetivo: 'Que confirme', casos: [{ titulo: 'Confirma', cuando: 'Dice que va', sigue: 'r2' }] },
    { id: 'r2', tipo: 'mensaje', ia: true, texto: 'Agradécele.' },
  ] };
  const r = deIA(json, { ...ctxWs11('recordales que mañana hay clase'), soloLoPedido: true }, () => 0.3);
  assert.equal(r.pasos.filter((p) => claseDe(p) === 'respuesta').length, 0);
  // Si el mensaje pregunta algo, queda (y es UN AI Step).
  const pregunta = { ...json, tarjetas: [{ ...json.tarjetas[0], texto: 'Hola {{nombre}}, mañana hay clase. ¿Vienes?' }, ...json.tarjetas.slice(1)] };
  const r2 = deIA(pregunta, { ...ctxWs11('recordales que mañana hay clase'), soloLoPedido: true }, () => 0.3);
  assert.equal(r2.pasos.filter((p) => esPasoIA(p)).length, 1);
  // Una flecha del mensaje al «Si responde» se corta SIN decirle a la clienta «corté la flecha» (jerga de una reparación).
  const conFlecha = { ...pregunta, tarjetas: [{ ...pregunta.tarjetas[0], sigue: 'r1' }, ...pregunta.tarjetas.slice(1)] };
  const r3 = deIA(conFlecha, { ...ctxWs11('recordales que mañana hay clase'), soloLoPedido: true }, () => 0.3);
  assert.ok(!r3.avisos.some((a) => /corté la flecha|no cuelga de ninguna/.test(a)), r3.avisos.join(' | '));
});

test('un Recurrente le escribe a una COHORTE: si el modelo elige un evento como «a quién», es un error para el reintento', async () => {
  const pedido = 'los martes a las 3 recordales la clase a los de Miembro activo';
  const ctx = ctxWs11(pedido);
  const evento = ctx.disparadores.findIndex((x) => x.value === 'etiqueta_agregada');
  assert.ok(evento >= 0, 'el CRON ofrece «Se agrega etiqueta a un lead»');
  let errores: string[] = [];
  const { d } = deps(pedido);
  d.generar = async (p) => {
    errores = p.traducir({ ...COMO_284, disparador: `d${evento + 1}` }).errores;
    return { error: 'sin flujo' };
  };
  await crearConIA({ ws: 11, pedido }, d);
  assert.ok(errores.includes(ERROR_RECURRENTE_SIN_COHORTE), errores.join(' | '));
});

test('la galería no se mete en un Recurrente ni en una difusión, y el system ya no pide el aviso «completo»', () => {
  assert.equal(plantillaParaPedido('mandá un mensaje masivo a toda la base con el recordatorio'), null);
  assert.ok(plantillaParaPedido('recordatorio antes de la reunión'), 'el de siempre sigue');
  const ctx = ctxWs11(PEDIDO_LEILA);
  const user = userDeCrear(ctx, { perfil: '', voz: null, pedido: 'recordatorio de la reunión', recurrente: { linea: 'CUÁNDO: x', conQuien: false } });
  assert.doesNotMatch(user, /LA DE ESA CATEGORÍA/);
  // Lo que cuida: que la lista de a quién (las etapas, con sus claves) viaje para que el modelo elija. El encabezado
  // «(clave y qué lo dispara)» se sacó el 5/11/2026 para entrar en el techo de Groq: se mira la lista, no el rótulo.
  assert.match(user, /\nDISPARADORES:\n- Etapa \(llega a\): d1 /, 'sin a quién puesto, el modelo elige la cohorte');
  const system = leer('lib/flujo-ia.ts');
  assert.match(system, /8\. Arma SÓLO lo que pide el pedido: sin avisos al equipo, etiquetas, esperas, seguimientos ni "si_responde" que no pida\./);
  assert.doesNotMatch(system, /Una automatización por categoría, completa/);
  assert.doesNotMatch(system.slice(system.indexOf('LA FORMA (un ejemplo')), /"operacion": "avisar_al_equipo"/);
});

test('la API de MaKo declara las dos respuestas nuevas y pregunta con los conteos', () => {
  const def = porId('crear_automatizacion_con_ia');
  const nombres = (def?.parametros ?? []).map((p) => p.nombre);
  assert.ok(nombres.includes('horario') && nombres.includes('quien'), nombres.join(', '));
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  assert.match(run, /error: preguntaParaWhatsApp\(await conConteos\(p, contarCohorte\)\)/);
  // El conteo es la cohorte del MOTOR (con su ventana), no los leads del embudo.
  const crear = sinComentarios(leer('lib/flujo-ia-crear.ts'));
  assert.match(crear, /const ids = await leadsDeCohorte\(d\.trigger_tipo,/);
  assert.match(crear, /ponerDisparador: async \(id, valor, cron\) => \{\n\s+const lista = cron \? recurrenteDeValorIA\(valor, cron\) : disparadorDeValorIA\(valor\);/);
});

// PROBADO ROMPIÉNDOLO (20/10/2026, arnés `romper.py` + `roturas-recurrente.json`, una rotura por vez y restaurada con
// md5 igual). Base 16 / 0. Pasan / fallan:
//    1. la hora: la ÚLTIMA del texto (las 7:30 de la sesión)                → 14 / 2
//    2. a quién no lo impone el código (queda la etapa del modelo)          → 13 / 3
//    3. el CRON sin el horario                                              → 14 / 2
//    4. sin la reentrada «Cada vez que vuelve a entrar»                     → 15 / 1
//    5. sin la pregunta del horario                                         → 14 / 2
//    6. crear sin `soloLoPedido`                                            → 15 / 1
//    7. sin «Otra cosa» como escenario (queda el «Si responde» con hijas)   → 15 / 1
//    8. sin sacar los apodos                                                → 15 / 1
//    9. «Creé…» sin el detalle                                              → 14 / 2
//   10. el resumen de editar vuelve a contar                               → 15 / 1
//   11. el motor: `aInscribir` con `false`                                 → 15 / 1
//   12. `barridoEsEvento` siempre false                                    → 15 / 1
//   13. «avísales» cuenta como pedir un aviso                              → 15 / 1
//   14. el apodo sin mirar si se le habla a alguien                        → 15 / 1
//   15. la difusión vuelve a la galería                                    → 15 / 1
//   16. el Recurrente vuelve a la galería                                  → 14 / 2
//   17. «¿A quién le llega?» sin los conteos                               → 15 / 1
//   18. sin el error de un evento como «a quién»                           → 15 / 1
//   19. vuelve «corté la flecha»                                           → 15 / 1
//   20. el aviso no pedido se queda                                        → 14 / 2
//   21. la etiqueta del TEMA cuenta como a quién                           → 13 / 3
//   22. «todo el funnel» con una sola etapa                                → 13 / 3
