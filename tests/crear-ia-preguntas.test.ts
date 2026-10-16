// =============================================================================
// MaKo PREGUNTA antes de crear, con opciones del catálogo; la ruta guarda el chat (duodécima tanda, 12/10/2026)
// =============================================================================
// docs/diseno-duodecima-tanda.md §2.4, §2.5 y §3.4. Martín (la prueba con Fiesta Music, ws10): «antes de generar la
// automatización haga preguntas para clarificarlo... como hoy lo hace Claude que te saltan una pregunta con tres
// opciones» y «la regla de MaKo es que no genere fricción». Lo que fija (lo puro se EJECUTA):
//   1. `preguntaAntes` pregunta SÓLO lo decisivo: el producto del «Onboarding» de ws10, el evento de un pedido por
//      Instagram que no dice qué hace la persona, y el canal con una señal social débil. Sin señal, nada. Tope: 2 rondas.
//   2. Lo contestado lo impone el CÓDIGO (`aplicarRespuestas`): el producto filtra el CRON, el evento lo fuerza.
//   3. La pregunta del MODELO (`preguntaDeIA`) con menos de 2 opciones válidas es un error para el reintento.
//   4. `crearConIA`: con pregunta no escribe NADA; al nacer la fila vuelca el chat; si el chat falla, es un aviso.
//   5. La ruta: el GET exige admin, editar con «Déjalo así» no llama al modelo, y la API de MaKo pregunta numerado.
//
// PROBADO ROMPIÉNDOLO: ver las roturas al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { opcionesCronIA, type CanalesConectadosIA, type EntradaCronIA } from '../lib/disparadores';
import { disparadoresParaIA, deIA, type CtxIA } from '../lib/flujo-ia';
import { ETAPAS_ENTREGA_DEFAULT } from '../lib/servicio-etapas';
import {
  preguntaAntes, preguntaDeIA, aplicarRespuestas, respuestaDeTexto, preguntaParaWhatsApp, respuestaDelCron, turnoDelUsuario,
  sanearRespuestas, TEXTO_PREGUNTA, VALOR_IGUAL, ERROR_NO_PREGUNTES,
} from '../lib/flujo-ia-preguntas';
import { crearConIA, AVISO_SIN_CHAT, type DepsCrearIA } from '../lib/flujo-ia-crear-core';
import { TOPE_RONDAS, type MensajeChatMako, type RespuestaMako } from '../lib/automatizacion-chat';
import type { PasoGrafo } from '../lib/flujo-grafo';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── ws10 como se midió el 12/10/2026 (relevo-crear-ia/ctx10.mjs): el embudo 2 sin producto, el 26 de «Fiesta Music»
// (producto 39) y «Service Delivery & Ops» (producto 10) sin embudo. Los dos productos, con la entrega de fábrica. ──
const ENTREGA = ETAPAS_ENTREGA_DEFAULT.map((e) => ({ value: e.key, label: e.label }));
const PRODUCTOS_WS10: EntradaCronIA['productos'] = [
  { funnelId: 2, productoId: null, nombre: 'Funnel principal', etapas: [{ value: 'nuevo', label: 'Nuevo' }, { value: 'agendado', label: 'Agendado' }], etapasEntrega: [] },
  { funnelId: 26, productoId: 39, nombre: 'Fiesta Music', etapas: [{ value: 'nuevo', label: 'Nuevo' }, { value: 'cerrado', label: 'Cerrado' }], etapasEntrega: ENTREGA },
  { funnelId: null, productoId: 10, nombre: 'Service Delivery & Ops', etapas: [], etapasEntrega: ENTREGA },
];
const NINGUNO: CanalesConectadosIA = { instagram: false, messenger: false, email: false, pagos: false };
const IG: CanalesConectadosIA = { ...NINGUNO, instagram: true };
const IG_Y_FB: CanalesConectadosIA = { ...NINGUNO, instagram: true, messenger: true };

function ctxWs10(conectados: CanalesConectadosIA, pedido = ''): CtxIA {
  return {
    etiquetas: [], audios: [], archivos: [], acciones: [], links: {}, pedido,
    productos: PRODUCTOS_WS10.map((p) => ({ ...p, etapas: [...p.etapas], etapasEntrega: [...(p.etapasEntrega ?? [])] })),
    disparadores: disparadoresParaIA(opcionesCronIA({ productos: PRODUCTOS_WS10, etiquetas: [], conectados })),
  };
}
const respuesta = (sobre: RespuestaMako['sobre'], valor: string | null, texto?: string): RespuestaMako => ({ preguntaId: `pregunta-${sobre}`, sobre, valor, ...(texto ? { texto } : {}) });

// ── 1. Lo que el código pregunta ─────────────────────────────────────────────────

test('ws10: «Llega una persona a onboarding» pregunta el PRODUCTO (Fiesta Music / Service Delivery & Ops), con los rótulos del catálogo', () => {
  const pedido = 'Llega una persona a onboarding, dale la bienvenida';
  const p = preguntaAntes(pedido, ctxWs10(IG_Y_FB), []);
  assert.ok(p, 'no preguntó el producto');
  assert.equal(p.sobre, 'producto');
  assert.equal(p.texto, TEXTO_PREGUNTA.producto);
  assert.ok(p.texto.split(' ').length <= 6);
  assert.deepEqual(p.opciones, [{ valor: '39', label: 'Fiesta Music' }, { valor: '10', label: 'Service Delivery & Ops' }]);
  assert.equal(p.otra, true);
  // Nombrando el producto, no hay duda.
  assert.equal(preguntaAntes('Llega una persona a onboarding de Fiesta Music', ctxWs10(IG_Y_FB), []), null);
  // Una etapa de un solo producto («Cerrado», del embudo de Fiesta Music), tampoco.
  assert.equal(preguntaAntes('Cuando un lead llega a cerrado, avísame', ctxWs10(NINGUNO), []), null);
});

test('con «reel» NO pregunta el canal (es la palabra fuerte), pero sí el EVENTO si no dice qué hace la persona', () => {
  const p = preguntaAntes('Mándale el lead magnet a los que vienen del reel', ctxWs10(IG_Y_FB), []);
  assert.ok(p, 'no preguntó el evento');
  assert.equal(p.sobre, 'evento');
  assert.equal(p.texto, TEXTO_PREGUNTA.evento);
  // Las 3 primeras de EVENTOS_INSTAGRAM sin apagado, con el valor del CRON y su rótulo.
  assert.deepEqual(p.opciones.map((o) => o.valor), ['instagram:comentario', 'instagram:historia', 'instagram:dm']);
  assert.equal(p.opciones[0].label, 'El usuario comenta tu publicación o Reel');
  // Diciendo qué hace, no pregunta nada.
  assert.equal(preguntaAntes('Mándale el lead magnet a los que comentan el reel', ctxWs10(IG_Y_FB), []), null);
  // Sin Instagram conectado no hay opciones que ofrecer: no pregunta (el aviso «Conecta Instagram» lo pone `deIA`).
  assert.equal(preguntaAntes('Mándale el lead magnet a los que vienen del reel', ctxWs10(NINGUNO), []), null);
});

test('el CANAL se pregunta sólo con una señal social débil y 2 o más conectados; sin señal, no pregunta', () => {
  const sin = 'Dale la bienvenida a los leads que agendan una llamada';
  assert.equal(preguntaAntes(sin, ctxWs10(IG_Y_FB), []), null, 'preguntó sin señal social');
  const debil = 'Cuando alguien comenta mi publicación, mándale el link';
  const p = preguntaAntes(debil, ctxWs10(IG_Y_FB), []);
  assert.ok(p);
  assert.equal(p.sobre, 'canal');
  assert.equal(p.texto, TEXTO_PREGUNTA.canal);
  assert.deepEqual(p.opciones, [{ valor: 'whatsapp', label: 'WhatsApp' }, { valor: 'instagram', label: 'Instagram' }, { valor: 'messenger', label: 'Messenger' }]);
  // Sólo WhatsApp conectado: no hay qué elegir.
  assert.equal(preguntaAntes(debil, ctxWs10(NINGUNO), []), null);
  // Con el canal nombrado (aunque sea WhatsApp), tampoco.
  assert.equal(preguntaAntes('Cuando alguien comenta mi publicación, escríbele por WhatsApp', ctxWs10(IG_Y_FB), []), null);
});

test('una pregunta respondida no se repite, y con TOPE_RONDAS respuestas no pregunta más', () => {
  const debil = 'Cuando alguien comenta mi publicación, mándale el link';
  const ctx = ctxWs10(IG_Y_FB);
  // Contestó Instagram: «comenta» ya dice qué hace la persona → nada más.
  assert.equal(preguntaAntes(debil, ctx, [respuesta('canal', 'instagram')]), null);
  // Sin el «comenta» en lo que hace: después del canal viene el evento.
  const seguidor = 'Escríbele a mis seguidores nuevos';
  assert.equal(preguntaAntes(seguidor, ctx, [])?.sobre, 'canal');
  assert.equal(preguntaAntes(seguidor, ctx, [respuesta('canal', 'instagram')])?.sobre, 'evento');
  assert.equal(preguntaAntes(seguidor, ctx, [respuesta('canal', 'whatsapp')]), null);
  // «Elige tú» también cuenta como respondida.
  assert.notEqual(preguntaAntes(seguidor, ctx, [respuesta('canal', null)])?.sobre, 'canal');
  // El tope.
  assert.equal(TOPE_RONDAS, 2);
  const dos = [respuesta('condicion', null, 'algo más'), respuesta('condicion', null, 'y otra cosa')];
  assert.equal(preguntaAntes('Llega una persona a onboarding', ctx, dos.slice(0, 1))?.sobre, 'producto', 'con una ronda todavía pregunta');
  assert.equal(preguntaAntes('Llega una persona a onboarding', ctx, dos), null, 'preguntó con el tope de rondas');
});

// ── 2. Lo contestado lo impone el código ────────────────────────────────────────

test('la respuesta de PRODUCTO filtra el CRON: sólo quedan los kanbans de ese producto, y la etapa se resuelve sola', () => {
  const pedido = 'Llega una persona a onboarding, dale la bienvenida';
  const ctx = ctxWs10(IG, pedido);
  const valores = (c: CtxIA) => c.disparadores.map((d) => d.value);
  assert.ok(valores(ctx).some((v) => v.startsWith('entrega:10:')) && valores(ctx).some((v) => v.startsWith('venta:2:')));
  // Sin la respuesta, la segunda capa NO adivina el producto (está en dos).
  assert.equal(deIA({ disparador: null, tarjetas: [] }, ctx).disparador, null);
  const a = aplicarRespuestas(ctx, pedido, [respuesta('producto', '39')]);
  assert.ok(!valores(a.ctx).some((v) => v.startsWith('entrega:10:')), 'quedó la entrega del otro producto');
  assert.ok(!valores(a.ctx).some((v) => v.startsWith('venta:2:')), 'quedó el embudo de otro producto');
  assert.ok(valores(a.ctx).some((v) => v.startsWith('entrega:39:')) && valores(a.ctx).some((v) => v.startsWith('venta:26:')));
  assert.ok(valores(a.ctx).some((v) => v.startsWith('instagram:')), 'un evento no es de ningún producto: se queda');
  assert.equal(deIA({ disparador: null, tarjetas: [] }, a.ctx).disparador, 'entrega:39:onboarding');
  // Un producto que no existe no filtra nada; «Elige tú» tampoco.
  assert.equal(aplicarRespuestas(ctx, pedido, [respuesta('producto', '999')]).ctx.disparadores.length, ctx.disparadores.length);
  assert.equal(aplicarRespuestas(ctx, pedido, [respuesta('producto', null)]).ctx.disparadores.length, ctx.disparadores.length);
});

test('canal → canalElegido; evento → disparador forzado (sólo si está en el desplegable); condición y «Otra cosa» → al pedido', () => {
  const ctx = ctxWs10(IG_Y_FB, 'x');
  assert.equal(aplicarRespuestas(ctx, 'x', [respuesta('canal', 'messenger')]).ctx.canalElegido, 'messenger');
  assert.equal(aplicarRespuestas(ctx, 'x', [respuesta('canal', 'telegram')]).ctx.canalElegido, undefined);
  const ev = aplicarRespuestas(ctx, 'x', [respuesta('evento', 'instagram:dm')]);
  assert.equal(ev.disparadorForzado, 'instagram:dm');
  assert.equal(aplicarRespuestas(ctxWs10(NINGUNO), 'x', [respuesta('evento', 'instagram:dm')]).disparadorForzado, undefined, 'forzó un evento que el CRON no ofrece');
  const otra = aplicarRespuestas(ctx, 'Bienvenida', [respuesta('condicion', null, 'sólo a los que pagaron 300')]);
  assert.match(otra.pedido, /sólo a los que pagaron 300$/);
  assert.equal(otra.ctx.pedido, otra.pedido);
  assert.ok(otra.ctx.numerosPermitidos?.includes(300), 'el número que escribió la persona no quedó permitido');
});

// ── 3. La pregunta del modelo ───────────────────────────────────────────────────

test('preguntaDeIA: con 1 opción válida es un error para el reintento; con 2, la pregunta con los rótulos del catálogo; con el tope, error', () => {
  const ctx = ctxWs10(IG_Y_FB);
  const k = (v: string) => `d${ctx.disparadores.findIndex((d) => d.value === v) + 1}`;
  const una = preguntaDeIA({ pregunta: { sobre: 'cron', texto: '¿Cuál?', opciones: [k('entrega:39:onboarding'), 'd999'] } }, ctx, 0);
  assert.ok(una && 'error' in una, JSON.stringify(una));
  assert.ok(una.error.includes(ERROR_NO_PREGUNTES));
  const dos = preguntaDeIA({ pregunta: { sobre: 'cron', texto: '¿Cuál vale?', opciones: [k('entrega:39:onboarding'), k('entrega:10:onboarding')] } }, ctx, 0);
  assert.ok(dos && 'pregunta' in dos, JSON.stringify(dos));
  assert.deepEqual(dos.pregunta.opciones.map((o) => o.valor), ['entrega:39:onboarding', 'entrega:10:onboarding']);
  assert.ok(dos.pregunta.opciones.every((o) => ctx.disparadores.some((d) => d.label === o.label)), 'un rótulo que no es del desplegable');
  assert.equal(dos.pregunta.texto, '¿Cuál vale?');
  // Un texto largo o con voseo se cambia por el del código.
  const largo = preguntaDeIA({ pregunta: { sobre: 'cron', texto: 'Decime vos cuál de todas estas opciones querés', opciones: [k('entrega:39:onboarding'), k('entrega:10:onboarding')] } }, ctx, 0);
  assert.equal(largo && 'pregunta' in largo ? largo.pregunta.texto : '', TEXTO_PREGUNTA.cron);
  // Condiciones: sólo ids del desplegable (un id inventado no cuenta).
  const cond = preguntaDeIA({ pregunta: { sobre: 'condicion', opciones: ['tiene_email', 'pago_en_cuotas_inventado'] } }, ctx, 0);
  assert.ok(cond && 'error' in cond, JSON.stringify(cond));
  // «Pagó» con un CRON de entrega no está en el desplegable: tampoco cuenta.
  const pago = preguntaDeIA({ pregunta: { sobre: 'condicion', opciones: ['pago', 'tiene_email'] } }, ctx, 0, 'entrega');
  assert.ok(pago && 'error' in pago, JSON.stringify(pago));
  const bien = preguntaDeIA({ pregunta: { sobre: 'condicion', opciones: ['pago', 'tiene_email'] } }, ctx, 0, 'adquisicion');
  assert.deepEqual(bien && 'pregunta' in bien ? bien.pregunta.opciones : null, [{ valor: 'pago', label: 'Pagó' }, { valor: 'tiene_email', label: 'Tiene email' }]);
  assert.ok(preguntaDeIA({ pregunta: { sobre: 'cron', opciones: [k('entrega:39:onboarding'), k('entrega:10:onboarding')] } }, ctx, TOPE_RONDAS) && 'error' in preguntaDeIA({ pregunta: { sobre: 'cron', opciones: [k('entrega:39:onboarding'), k('entrega:10:onboarding')] } }, ctx, TOPE_RONDAS)!);
  assert.equal(preguntaDeIA({ tarjetas: [] }, ctx, 0), null);
});

// ── 4. crearConIA: la pregunta no escribe; el chat nace con la fila ──────────────

const DEL_MODELO = { nombre: 'Bienvenida', disparador: null, inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola, te damos la bienvenida.' }] };

function deps(ctx: CtxIA, o: { modelo?: Record<string, unknown>; chatTira?: boolean } = {}) {
  const ops: string[] = [];
  const chats: MensajeChatMako[][] = [];
  const errores: string[][] = [];
  let guardados: PasoGrafo[] | null = null;
  const d: DepsCrearIA = {
    contexto: async () => ({ ctx, perfil: 'Vendemos música para fiestas.', voz: null }),
    system: async () => 'system',
    generar: async (p) => { ops.push('generar'); const tr = p.traducir(o.modelo ?? DEL_MODELO); errores.push(tr.errores); return { r: tr.r }; },
    crearEtiquetas: async () => { ops.push('etiquetas'); return { ids: new Map(), creadas: [] }; },
    filaDe: async () => (guardados ? { pasos: guardados, nombre: 'Bienvenida' } : { pasos: [], nombre: '' }),
    insertar: async (nombre) => { ops.push('insertar'); return { id: 600, nombre: String(nombre) }; },
    borrar: async () => { ops.push('borrar'); },
    pausar: async () => { ops.push('pausar'); },
    guardarPasos: async (_id, pasos) => { ops.push('guardar'); guardados = pasos; },
    motivoDePasos: () => null,
    ponerDisparador: async (_id, valor) => { ops.push(`cron:${valor}`); },
    motivoDeDisparador: () => null,
    renombrar: async (_id, n) => n,
    guardarChat: async (_id, mensajes) => { ops.push('chat'); if (o.chatTira) throw new Error('la base'); chats.push(mensajes); },
  };
  return { d, ops, chats, errores };
}

test('crearConIA: con pregunta del código no llama al modelo ni escribe NADA; con la respuesta, el CRON sale del producto elegido', async () => {
  const pedido = 'Llega una persona a onboarding, dale la bienvenida';
  const a = deps(ctxWs10(IG, pedido));
  const r = await crearConIA({ ws: 10, pedido }, a.d);
  assert.ok(!r.ok && 'pregunta' in r && r.pregunta.sobre === 'producto', JSON.stringify(r));
  assert.deepEqual(a.ops, [], `hizo: ${a.ops.join(', ')}`);
  const b = deps(ctxWs10(IG, pedido));
  const ok = await crearConIA({ ws: 10, pedido, respuestas: [respuesta('producto', '39')] }, b.d);
  assert.ok(ok.ok, JSON.stringify(ok));
  assert.equal(ok.ok && ok.disparador, 'entrega:39:onboarding');
  assert.ok(b.ops.includes('cron:entrega:39:onboarding'), b.ops.join(', '));
});

test('crearConIA: el EVENTO elegido se fuerza aunque el modelo pida otro CRON', async () => {
  const pedido = 'Mándale el lead magnet a los que vienen del reel';
  const ctx = ctxWs10(IG, pedido);
  const otro = `d${ctx.disparadores.findIndex((d) => d.value === 'entrega:39:onboarding') + 1}`;
  const a = deps(ctx, { modelo: { ...DEL_MODELO, disparador: otro, tarjetas: [{ id: 't1', tipo: 'mensaje', canal: 'instagram', texto: 'Hola, aquí va.' }] } });
  const r = await crearConIA({ ws: 10, pedido, respuestas: [respuesta('evento', 'instagram:historia')] }, a.d);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.ok && r.disparador, 'instagram:historia');
  assert.deepEqual(a.errores[0], [], a.errores[0].join(' | '));
});

test('crearConIA: la pregunta del MODELO vuelve sin escribir; con 1 opción válida va al reintento', async () => {
  const ctx = ctxWs10(NINGUNO, 'Bienvenida');
  const k = (v: string) => `d${ctx.disparadores.findIndex((d) => d.value === v) + 1}`;
  const buena = deps(ctx, { modelo: { pregunta: { sobre: 'cron', texto: '¿Cuál?', opciones: [k('entrega:39:onboarding'), k('entrega:10:onboarding')] } } });
  const r = await crearConIA({ ws: 10, pedido: 'Bienvenida' }, buena.d);
  assert.ok(!r.ok && 'pregunta' in r, JSON.stringify(r));
  assert.deepEqual(buena.ops, ['generar']);
  const mala = deps(ctx, { modelo: { pregunta: { sobre: 'cron', opciones: [k('entrega:39:onboarding')] } } });
  await crearConIA({ ws: 10, pedido: 'Bienvenida' }, mala.d).catch(() => null);
  assert.ok(mala.errores[0].some((e) => e.includes(ERROR_NO_PREGUNTES)), mala.errores[0].join(' | '));
});

test('al NACER la fila se vuelca el chat (historial + turno + MaKo, con los avisos) DESPUÉS del CRON; si falla, es un aviso', async () => {
  const historial: MensajeChatMako[] = [
    { id: 'h1', de: 'yo', texto: 'Llega una persona a onboarding', at: '2026-10-12T10:00:00.000Z', via: 'app' },
    { id: 'h2', de: 'mako', texto: '¿De qué producto?', at: '2026-10-12T10:00:01.000Z', via: 'app', pregunta: { id: 'pregunta-producto', sobre: 'producto', texto: '¿De qué producto?', opciones: [{ valor: '39', label: 'Fiesta Music' }, { valor: '10', label: 'Service Delivery & Ops' }], otra: true } },
  ];
  const pedido = 'Llega una persona a onboarding';
  const a = deps(ctxWs10(NINGUNO, pedido));
  const r = await crearConIA({ ws: 10, pedido, respuestas: [{ preguntaId: 'pregunta-producto', sobre: 'producto', valor: '39' }], historial, via: 'whatsapp' }, a.d);
  assert.ok(r.ok, JSON.stringify(r));
  const escrituras = a.ops.filter((x) => x !== 'generar');
  assert.deepEqual(escrituras, ['etiquetas', 'insertar', 'guardar', 'cron:entrega:39:onboarding', 'chat']);
  const c = a.chats[0];
  assert.deepEqual(c.slice(0, 2).map((m) => m.id), ['h1', 'h2']);
  assert.equal(c[2].de, 'yo');
  assert.equal(c[2].texto, 'Fiesta Music', 'el turno dice lo que eligió, con el rótulo de la pregunta');
  assert.equal(c[3].de, 'mako');
  assert.equal(c[3].via, 'whatsapp');
  assert.ok(c.every((m) => m.via === 'app' || m.via === 'whatsapp'));
  // Si el chat no se guarda, la automatización queda igual, con el aviso.
  const b = deps(ctxWs10(NINGUNO, pedido), { chatTira: true });
  const r2 = await crearConIA({ ws: 10, pedido, respuestas: [{ preguntaId: 'pregunta-producto', sobre: 'producto', valor: '39' }] }, b.d);
  assert.ok(r2.ok && r2.avisos.includes(AVISO_SIN_CHAT), JSON.stringify(r2));
  // Con id (la fila ya existía) el chat lo escribe la ruta, no esto.
  const cId = deps(ctxWs10(NINGUNO, pedido));
  await crearConIA({ ws: 10, pedido, secuenciaId: 77, respuestas: [respuesta('producto', '39')] }, cId.d);
  assert.ok(!cId.ops.includes('chat'));
  // Las dependencias de verdad escriben con `agregarAlChat` y el ws de ESTE pedido (lib/automatizacion-chat-db.ts).
  assert.match(sinComentarios(leer('lib/flujo-ia-crear.ts')), /guardarChat: async \(id, mensajes\) => \{ await agregarAlChat\(ws, id, mensajes\); \},/);
});

test('el turno de la persona no se escribe dos veces si el historial ya termina con él', () => {
  const h: MensajeChatMako[] = [{ id: 'h1', de: 'yo', texto: 'Bienvenida', at: '2026-10-12T10:00:00.000Z', via: 'app' }];
  assert.equal(turnoDelUsuario('Bienvenida', [], h, 'app'), null);
  assert.equal(turnoDelUsuario('Bienvenida', [], [], 'app')?.texto, 'Bienvenida');
  assert.equal(turnoDelUsuario('x', [respuesta('canal', null)], [], 'app')?.texto, 'Elige tú');
  assert.deepEqual(sanearRespuestas([{ preguntaId: 'p', sobre: 'canal', valor: 'instagram' }, { sobre: 'nada' }, 'basura']), [{ preguntaId: 'p', sobre: 'canal', valor: 'instagram' }]);
});

// ── 5. La ruta y la API de MaKo ─────────────────────────────────────────────────

const RUTA = sinComentarios(leer('app/api/chat-agent/secuencias/ia/route.ts'));

test('la ruta: el GET exige admin (el MISMO guard que el POST) y lee el chat con el ws del pedido', () => {
  const get = RUTA.slice(RUTA.indexOf('export async function GET('), RUTA.indexOf('export async function POST('));
  assert.ok(get.length > 50, 'no hay GET');
  assert.match(get, /const ws = await adminDelWs\(\);\n\s*if \(ws == null\) return Response\.json\(\{ ok: false, error: '[^']+' \}, \{ status: 403 \}\);/);
  assert.match(get, /const chat = await leerChat\(ws, secuenciaId\);/);
  assert.match(get, /return Response\.json\(\{ ok: true, mensajes: chat\.mensajes \}\);/);
  const post = RUTA.slice(RUTA.indexOf('export async function POST('));
  assert.match(post, /const ws = await adminDelWs\(\);\n\s*if \(ws == null\) \{\n\s*return Response\.json\(\{ ok: false, error: '[^']+' \}, \{ status: 403 \}\);/);
  assert.match(RUTA, /async function adminDelWs\(\): Promise<number \| null> \{\n\s*const \[ws, rol\] = await Promise\.all\(\[getWorkspaceActual\(\), getRolWsEfectivo\(\)\]\);\n\s*return ws != null && rol === 'admin' \? ws : null;/);
});

test('la ruta: editar con la respuesta del CRON NO llama al modelo; «Déjalo así» no toca nada', () => {
  const i = RUTA.indexOf("const delCron = [...respuestas].reverse().find((x) => x.sobre === 'cron');");
  const fin = RUTA.indexOf('return;', i);
  assert.ok(i > 0 && fin > i, 'no hay rama del CRON');
  // Editar lee el contexto y el CRON guardado juntos (`Promise.all([armarContexto(ws, pedido), cronGuardado()])`, enchufe
  // del cierre): se busca la llamada, y que exista (un indexOf -1 dejaría la comparación sin sentido). Roto cambiando la
  // llamada (12/10, en un espejo): 15 / 1, cae éste.
  const contexto = RUTA.indexOf('armarContexto(ws, pedido)');
  assert.ok(contexto > 0, 'editar no lee el contexto');
  assert.ok(fin < contexto && fin < RUTA.indexOf('await generar({'), 'la rama del CRON llega al modelo');
  assert.match(RUTA.slice(i, fin), /respuestaDelCron\(delCron, historial\)/);
  assert.match(RUTA.slice(i, fin), /pasos: base,/);
  assert.match(RUTA.slice(i, fin), /cambiadas: \[\], quitadas: \[\], \.\.\.\(listo\.disparadores \? \{ disparadores: listo\.disparadores \} : \{\}\)/);
  // Ejecutado: «Déjalo así» → sin `disparadores`; una opción → el CRON que guarda la pantalla.
  assert.equal(VALOR_IGUAL, 'igual');
  assert.equal(respuestaDelCron(respuesta('cron', 'igual'), []).disparadores, undefined);
  assert.equal(respuestaDelCron(respuesta('cron', 'instagram:dm'), []).disparadores?.[0]?.trigger_tipo, 'instagram');
  assert.equal(respuestaDelCron(respuesta('cron', 'basura:x'), []).disparadores, undefined);
  // Editar pasa su propio motivo a la cascada y usa la revisión de editar.
  assert.match(RUTA, /generar\(\{ system, user, hastaMs: inicio \+ PLAZO_MODELO_MS, traducir, motivo: 'Editar una automatización con IA' \}\)/);
  // (15/10/2026: una RESPUESTA del modelo no cambió nada y no se revisa: «no cambió nada» la reintentaría,
  // tests/flujo-ia-consulta.test.ts.)
  assert.match(RUTA, /return \{ r, errores: r\.respuesta \? \[\] : erroresEdicion\(base, r, ctx\) \};/);
});

test('la ruta: con la fila, el turno se anota al EMPEZAR y la pregunta, el resumen o el error al terminar; sin fila no', () => {
  const turno = RUTA.indexOf("await anotar([turnoDelUsuario(pedido, respuestas, historial, 'app')]);");
  assert.ok(turno > 0 && turno < RUTA.indexOf("if (modo === 'crear') {", turno), 'el turno no va al empezar');
  assert.match(RUTA, /if \(secuenciaId == null \|\| !lista\.length\) return;/);
  assert.match(RUTA, /const mensaje = mensajeDePregunta\(pregunta, 'app'\);\n\s*await anotar\(\[mensaje\]\);\n\s*send\(\{ t: 'pregunta', pregunta, mensaje \}\);/);
  assert.match(RUTA, /crearFlujoConIA\(\{ ws, pedido, secuenciaId, inicio, plazoMs: PLAZO_MODELO_MS, signal: req\.signal, alFase: send, respuestas, historial, via: 'app' \}\)/);
  assert.match(RUTA, /const send = \(o: EventoIA \| EventoPreguntaIA\) =>/);
});

test('la API de MaKo: `preparar` pregunta numerado ANTES de proponer; la respuesta llega por canal, producto o evento', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  const op = run.slice(run.indexOf('crear_automatizacion_con_ia: {'), run.indexOf('crear_automatizacion_desde_plantilla: {'));
  const preparar = op.slice(op.indexOf('preparar:'), op.indexOf('ejecutar:'));
  assert.match(preparar, /const p = preguntaAntes\(pedido, cx, respuestas\);/);
  assert.match(preparar, /if \(!dado\) return \{ error: preguntaParaWhatsApp\(p\), faltan: \[p\.sobre\] \};/);
  assert.ok(preparar.indexOf('preguntaAntes(') < preparar.indexOf('return { payload:'), 'propone antes de preguntar');
  assert.match(op, /respuestas: sanearRespuestas\(payload\.respuestas\), via \}\);/);
  // Ejecutado: el texto numerado y la vuelta.
  const p = preguntaAntes('Llega una persona a onboarding', ctxWs10(NINGUNO), [])!;
  assert.equal(preguntaParaWhatsApp(p), '¿De qué producto? Responde con el número: 1) Fiesta Music 2) Service Delivery & Ops 3) Elige tú');
  assert.equal(respuestaDeTexto(p, '1').valor, '39');
  assert.equal(respuestaDeTexto(p, 'service delivery & ops').valor, '10');
  assert.equal(respuestaDeTexto(p, '3').valor, null);
  assert.equal(respuestaDeTexto(p, 'Elige tú').valor, null);
  assert.deepEqual(respuestaDeTexto(p, 'el de las fiestas'), { preguntaId: p.id, sobre: 'producto', valor: null, texto: 'el de las fiestas' });
});

// ROTURAS (12/10/2026), una por vez en un ESPEJO del worktree y restaurada con sha1 igual (arnés
// scratchpad/wf-duodecima/ia-preguntas-ruta/romper.mjs; corre este archivo + flujo-ia-crear + flujo-ia-ruta).
// Base: 34 pass / 0 fail. Restaurado: 34 / 0. Todas cazadas:
//   R1  el producto se pregunta con UN solo producto con esa etapa              → 33 / 1 (ws10 onboarding)
//   R2  el producto se pregunta aunque el pedido lo nombre                     → 33 / 1 (ws10 onboarding)
//   R3  el canal se pregunta sin la señal social débil                         → 30 / 4 (canal, ws10, rondas, crearConIA)
//   R4  el evento se pregunta aunque el pedido diga qué hace                   → 32 / 2 (reel, rondas)
//   R5  sin el tope de TOPE_RONDAS                                             → 33 / 1 (rondas)
//   R6  la respuesta de producto no filtra el CRON                             → 33 / 1 (filtra el CRON)
//   R7  la pregunta del modelo vale con 1 opción                               → 32 / 2 (preguntaDeIA, crearConIA)
//   R8  los canales de la pregunta sin mirar el CRON (todos «conectados»)      → 33 / 1 (canal)
//   R9  «1» en el grupo es la segunda opción                                   → 33 / 1 (API de MaKo)
//   R10 el turno de la persona se escribe dos veces                            → 33 / 1 (el turno)
//   R11 crearConIA sin preguntar antes del modelo                              → 33 / 1 (crearConIA sin escribir)
//   R12 el CRON elegido (evento) no se fuerza                                  → 33 / 1 (el evento se fuerza)
//   R13 la pregunta del modelo se ignora                                       → 33 / 1 (la pregunta del modelo)
//   R14 un chat que no se guarda tumba la creación                             → 33 / 1 (al nacer la fila)
//   R15 el core escribe el chat también con id                                 → 32 / 2 (al nacer, y «con id» de flujo-ia-crear)
//   R16 el chat se escribe ANTES del CRON                                      → 31 / 3 (al nacer, y los dos órdenes de flujo-ia-crear)
//   R17 el GET sin el guard de admin                                           → 33 / 1 (el GET)
//   R18 editar con la respuesta del CRON sigue hasta el modelo                 → 33 / 1 (editar con el CRON)
//   R19 la ruta no le pasa respuestas ni historial a crear                     → 31 / 3 (éste, y uno en cada guard de la ruta)
//   R20 `preparar` de la API propone sin preguntar                             → 33 / 1 (API de MaKo)
//   R21 las dependencias de verdad no escriben el chat                         → 33 / 1 (al nacer la fila)
//   R22 editar sin su `motivo`                                                 → 33 / 1 (editar con el CRON)
//   R23 el link de la API sin `&mako=1`                                        → 33 / 1 (flujo-ia-crear, el link)
