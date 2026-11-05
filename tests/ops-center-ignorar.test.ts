// =============================================================================
// La fecha y el «Ignorar» de lo que espera a Martín en el Ops Center (5/11/2026)
// =============================================================================
// Martín, desde el teléfono: le llegó para contestar una pregunta del 30/10 sobre una revisión que ya no importaba, y no había cómo
// saber que era vieja ni cómo sacarla. «Debería haber una sección que marque la fecha de los pedidos o decisiones y un botón de
// ignorar». Lo que se fija:
//   1. «Ignorar» deja la pregunta ignorada (no espera, no sube el globito); «Volver a mostrar» la devuelve; una contestada no se
//      ignora; lo que sube la PC nunca viene ignorado, y volver a subirla no la des-ignora;
//   2. una respuesta firmada de una ignorada no se entrega: la vuelta REAL del Runner la cancela (con su motivo) y entrega las demás
//      en su orden; sin poder leer las preguntas, no entrega ninguna respuesta (sí lo demás); al ignorar, la que esperaba se cancela;
//   3. la fecha a la vista: «hace 6 días · 30 oct, 10:52», la entera en el `title`, y «Vieja» con más de 48 horas;
//   4. la más nueva primero en el bloque, pero las respuestas salen en el orden en que se hicieron las preguntas;
//   5. el bloque dibuja la fecha, «Vieja», «Ignorar» e «Ignoradas · N», en las dos pantallas y con el alto de un dedo;
//   6. en la conversación, una ignorada no dice «Decisión enviada»; la cancelada vuelve al bloque si sigue abierta;
//   7. las decisiones de la Ticketera se ignoran igual (mig 0394): no esperan, no cuentan, no se contestan y van a «Ignoradas».
//
// Correr: node --import tsx --test tests/ops-center-ignorar.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  estaAbierta, ignoradaQueContesta, ignorarEnLaLista, mostrarDeNuevoEnLaLista, sanearPregunta, sanearPreguntas, textoDeRespuesta, unirPreguntas,
  type PreguntaChat,
} from '../lib/centro-preguntas-chat';
import { VIEJA_MS, edadDe } from '../lib/centro-fechas';
import { BloqueDePreguntas, armarIgnorar, itemsDelBloque, ordenDeEntrega } from '../app/admin/operaciones/PreguntasDelChat';
import { Hilo } from '../app/admin/operaciones/Hilo';
import { esperasPorChat, preguntasIgnoradas, preguntasParaElBloque, type LineaChat } from '../lib/centro-chats';
import { esperaAMartin, filaADecision, repartir, type Decision } from '../app/admin/runway/decisiones';
import { ignoradasDelChat, preguntasDelChat } from '../lib/centro-preguntas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const LOCAL = 'local_22222222-2222-4333-8444-555555555555';
const AHORA = Date.parse('2026-11-05T13:52:00Z');
const pregunta = (n: number, at: string, extra: Partial<PreguntaChat> = {}): PreguntaChat => ({
  id: `bbbbbbbb-0000-4000-8000-00000000000${n}`, local: LOCAL, pregunta: `¿Reviso la ${n}?`, contexto: null,
  opciones: [{ titulo: 'Sí', detalle: null }, { titulo: 'No', detalle: null }], recomendada: 0, varias: false, at, respuesta: null, ...extra,
});
const VIEJA = pregunta(1, '2026-10-30T13:52:00Z');
const DE_HOY = pregunta(2, '2026-11-05T13:30:00Z');

test('1. «Ignorar» la saca de lo que espera, «Volver a mostrar» la devuelve; una contestada no se ignora', () => {
  const r = ignorarEnLaLista([VIEJA, DE_HOY], VIEJA.id, new Date(AHORA));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.pregunta.ignorada, new Date(AHORA).toISOString());
  assert.deepEqual(r.preguntas.map(estaAbierta), [false, true], 'sólo ésa deja de esperar');
  assert.equal(sanearPregunta(r.pregunta)?.ignorada, r.pregunta.ignorada, 'la marca sobrevive a la lectura de la base');
  assert.equal(sanearPreguntas([r.pregunta])[0].ignorada, undefined, 'lo que sube la PC nunca viene ignorado');
  assert.equal(unirPreguntas(r.preguntas, sanearPreguntas([VIEJA]))[0].ignorada, r.pregunta.ignorada, 'volver a subirla no la des-ignora');
  assert.ok(!ignorarEnLaLista(r.preguntas, VIEJA.id).ok, 'ignorar dos veces no pisa la hora');
  const v = mostrarDeNuevoEnLaLista(r.preguntas, VIEJA.id);
  assert.ok(v.ok && estaAbierta(v.pregunta) && !('ignorada' in v.pregunta), 'vuelve a esperar, sin la marca');
  assert.ok(!mostrarDeNuevoEnLaLista([DE_HOY], DE_HOY.id).ok, 'una que no estaba ignorada no se toca');
  const contestada = pregunta(3, '2026-11-01T10:00:00Z', { respuesta: { elegidas: [0], otra: null, at: '2026-11-01T11:00:00Z', trabajo: '11111111-1111-4111-8111-111111111111' } });
  const c = ignorarEnLaLista([contestada], contestada.id);
  assert.ok(!c.ok && /contestaste/.test(c.error), 'una contestada no se ignora');
  assert.equal(sanearPregunta({ ...contestada, ignorada: '2026-11-02T00:00:00Z' })?.ignorada, undefined, 'y en la base, la respuesta gana');
});

test('2a. la respuesta de una ignorada se reconoce por el id EXACTO de su marca, y sólo entre las de su destino', () => {
  const ignorada = { ...VIEJA, ignorada: '2026-11-05T10:00:00Z' };
  assert.equal(ignoradaQueContesta(textoDeRespuesta(ignorada, [0], null), [ignorada, DE_HOY])?.id, ignorada.id);
  assert.equal(ignoradaQueContesta(textoDeRespuesta(DE_HOY, [0], null), [ignorada, DE_HOY]), null, 'la de una abierta sale');
  assert.equal(ignoradaQueContesta(textoDeRespuesta(ignorada, [0], null), [DE_HOY]), null, 'sin la pregunta en ese destino, no se adivina');
  assert.equal(ignoradaQueContesta('Sigue con el filtro', [ignorada]), null, 'un mensaje común no es una respuesta');
});

/** Lo REAL del servidor, en un node aparte (`server-only`, `--conditions=react-server`): una vez, para los dos tests que lo leen. */
let corrida: { r: ReturnType<typeof spawnSync>; escenas: Record<string, any> } | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
function hijo() {
  if (!corrida) {
    const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', join(RAIZ, 'tests/_ops-ignorar-hijo.ts')], {
      cwd: RAIZ, encoding: 'utf8', timeout: 240_000, env: { ...process.env, NODE_ENV: 'test' },
    });
    assert.equal(r.status, 0, `el hijo falló: ${String(r.stderr).slice(-2000)}`);
    const escenas = Object.fromEntries(String(r.stdout).split('\n').filter((l) => l.startsWith('@@IGNORAR@@'))
      .map((l) => JSON.parse(l.slice('@@IGNORAR@@'.length))).map((e) => [e.escena, e]));
    corrida = { r, escenas };
  }
  return corrida;
}

test('2b. la vuelta REAL del Runner no entrega la respuesta de una ignorada; sin leer, no entrega respuestas; ignorar cancela la que esperaba', () => {
  const { r, escenas } = hijo();
  const id = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
  const v = escenas.vuelta;
  assert.ok(v, `sin la escena de la vuelta: ${String(r.stdout).slice(-1000)}`);
  assert.deepEqual(v.p1, { estado: 'cancelado', motivo: 'Ignoraste esa pregunta' }, 'la respuesta de la ignorada se cancela, con su motivo');
  assert.deepEqual(v.entregados, [id(2), id(3)], 'las demás salen, en el orden de la cola');
  const s = escenas['sin-leer'];
  assert.deepEqual(s.entregados, [id(3)], 'sin poder leer las preguntas sale sólo lo que no es una respuesta');
  assert.equal(s.p1.estado, 'escrito', 'y las respuestas esperan a la vuelta siguiente (no se pierden ni se cancelan a ciegas)');
  assert.equal(s.p2.estado, 'escrito');
  const g = escenas.ignorar;
  assert.ok(g.ok && g.ignorada, 'ignorar la guarda con su hora');
  assert.deepEqual(g.abiertas, {}, 'y deja de contar en el globito');
  assert.equal(g.canceladas, 1);
  assert.deepEqual(g.p2, { estado: 'cancelado', motivo: 'Ignoraste esa pregunta' }, 'su respuesta que esperaba se cancela');
  assert.equal(g.p1.estado, 'escrito', 'la de OTRA pregunta no se toca');
  assert.equal(g.p3.estado, 'escrito', 'un mensaje común no se toca');
  assert.equal(g.otraVez, 'Ya la ignoraste.');
  assert.deepEqual(g.marcar, { error: 'La ignoraste: vuelve a mostrarla para contestarla.', ignorada: true }, 'contestada en otro dispositivo: no se marca');
  assert.equal(g.respuestaGuardada, null);
  assert.ok(g.vuelve && g.trasVolver === null, '«Volver a mostrar» le saca la marca');
  assert.deepEqual(g.abiertasTrasVolver, { [LOCAL]: 1 }, 'y vuelve a contar');
});

test('3. la fecha: «hace 6 días», el día y la hora al lado, la entera en el title, y «Vieja» pasadas las 48 horas', () => {
  const e = edadDe(VIEJA.at, AHORA)!;
  assert.equal(e.hace, 'hace 6 días');
  assert.equal(e.cuando, '30 oct, 10:52', 'el día y la hora de Argentina');
  assert.match(e.completa, /viernes.*30.*octubre.*2026.*10:52/);
  assert.equal(e.vieja, true);
  assert.equal(edadDe(DE_HOY.at, AHORA)!.hace, 'hace 22 minutos');
  assert.equal(edadDe(DE_HOY.at, AHORA)!.cuando, 'Hoy, 10:30');
  assert.equal(edadDe(new Date(AHORA - VIEJA_MS + 60_000).toISOString(), AHORA)!.vieja, false, '47:59 todavía no es vieja');
  assert.equal(edadDe(new Date(AHORA - VIEJA_MS - 60_000).toISOString(), AHORA)!.vieja, true);
  assert.equal(edadDe('no es una fecha', AHORA), null, 'sin fecha no se inventa una');
});

const decision = (id: number, creadaAt: string, extra: Partial<Decision> = {}): Decision => ({
  id, ref: `d-${id}`, chat: 'CRM', pregunta: `¿Decisión ${id}?`, opciones: [{ clave: 'A', texto: 'Sí' }, { clave: 'B', texto: 'No' }],
  destraba: null, contexto: null, recomendada: 'A', urgencia: 'bloquea', href: null, orden: 100, respuesta: null, respuestaTexto: null,
  respondidaAt: null, recogidaAt: null, creadaAt, destino: LOCAL, ...extra,
});

test('4. la más nueva primero, a la vista; las respuestas salen en el orden en que se hicieron las preguntas', () => {
  const t = decision(7, '2026-11-02T09:00:00Z');
  const items = itemsDelBloque([t], [VIEJA, DE_HOY], []);
  assert.deepEqual(items.map((x) => x.id), [`c:${DE_HOY.id}`, 't:7', `c:${VIEJA.id}`], 'la de hoy arriba; la del 30/10 al final');
  assert.deepEqual(ordenDeEntrega(items).map((x) => x.id), [`c:${VIEJA.id}`, `c:${DE_HOY.id}`], 'la entrega, de la más vieja a la más nueva');
  assert.match(sinComentarios(leer('app/admin/operaciones/PreguntasDelChat.tsx')), /= ordenDeEntrega\(items\);/, 'y es la que usa «enviar»');
});

test('5. el bloque dibuja la fecha, «Vieja», «Ignorar» e «Ignoradas · N»; sin ignorar, no lo ofrece', () => {
  const ignorada = { ...pregunta(3, '2026-10-28T09:00:00Z'), ignorada: '2026-11-04T09:00:00Z' };
  const ignorar = armarIgnorar({ pregunta: async () => null, decision: async () => null, decisiones: [] }, [ignorada]);
  const html = renderToStaticMarkup(createElement(BloqueDePreguntas, { chat: LOCAL, delChat: [VIEJA, DE_HOY], onResponder: async () => null, ignorar, ahora: AHORA }));
  assert.match(html, /¿Reviso la 2\?/, 'abre en la de hoy');
  assert.match(html, /<time dateTime="2026-11-05T13:30:00.000Z" title="[^"]*2026, 10:30">hace 22 minutos<\/time>/, 'su fecha, con la entera a mano');
  assert.match(html, / · Hoy, 10:30/);
  assert.doesNotMatch(html, />Vieja</, 'la de hoy no es vieja');
  assert.match(html, /<button type="button" class="co-preg__ignorar"[^>]*aria-label="Ignorar: ¿Reviso la 2\?"[^>]*>Ignorar<\/button>/);
  assert.match(html, /class="co-ignoradas__link"[^>]*>Ignoradas · <!-- -->1<\/button>|class="co-ignoradas__link"[^>]*>Ignoradas · 1<\/button>/, '«Ignoradas · 1», chica y aparte');
  // La vieja sola: «Vieja» y el color de aviso.
  const vieja = renderToStaticMarkup(createElement(BloqueDePreguntas, { chat: LOCAL, delChat: [VIEJA], onResponder: async () => null, ignorar, ahora: AHORA }));
  assert.match(vieja, /class="co-preg__edad co-preg__edad--vieja"><span class="co-preg__vieja">Vieja<\/span><time[^>]*>hace 6 días<\/time>/);
  // Sin `ignorar`, no se ofrece (las sugerencias de una tab tampoco: tienen «Ahora no»).
  const sin = renderToStaticMarkup(createElement(BloqueDePreguntas, { chat: LOCAL, delChat: [VIEJA], onResponder: async () => null, ahora: AHORA }));
  assert.doesNotMatch(sin, /co-preg__ignorar|Ignoradas/);
  assert.match(sin, /hace 6 días/, 'la fecha sí, siempre');
  const tab = renderToStaticMarkup(createElement(BloqueDePreguntas, { chat: 'tab:CRM', ignorar, deLaTab: [{ id: 's', pregunta: '¿Algo?', opciones: [{ titulo: 'Hacerlo' }] }] }));
  assert.doesNotMatch(tab, /co-preg__ignorar/, 'una sugerencia no se ignora');
  // Sólo «Ignoradas», sin nada que espere: el link igual está.
  const nada = renderToStaticMarkup(createElement(BloqueDePreguntas, { chat: LOCAL, ignorar, ahora: AHORA }));
  assert.match(nada, /co-ignoradas__link/);
  // En las dos pantallas, con el alto de un dedo.
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /<BloqueDePreguntas [\s\S]*?ignorar=\{\w+\} ahora=\{ahora\} deLaApp=\{deLaApp\} \/>/, `${f}: le pasa «Ignorar» y el reloj`);
    assert.match(src, /armarIgnorar\(/, `${f}: armado con la misma pieza`);
  }
  const css = sinComentarios(leer('app/admin/operaciones/centro.css'));
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\) \{\n\s*\.co-preg__ignorar \{ height: 44px;/, 'en el teléfono, del alto de un dedo');
  assert.doesNotMatch(css, /\.co-preg__pie[^{]*\.co-preg__meta|\.co-preg__meta[^{]*display: none/, 'la fecha y el botón no se esconden en el teléfono');
});

test('6. en la conversación una ignorada no dice «Decisión enviada»; la de respuesta cancelada vuelve al bloque si sigue abierta', () => {
  const ignorada = { ...VIEJA, ignorada: '2026-11-05T10:00:00Z' };
  const trabajo = (estado: 'escrito' | 'cancelado') => ({ id: 'cccccccc-0000-4000-8000-000000000001', destino: LOCAL, destino_titulo: 'CRM', destino_cuenta: 'claude3', created_at: '2026-11-05T10:00:00Z', texto: textoDeRespuesta(DE_HOY, [0], null), estado });
  const lineas: LineaChat[] = [
    { tipo: 'pregunta', instante: Date.parse(ignorada.at), pregunta: ignorada, trabajo: null },
    { tipo: 'pregunta', instante: Date.parse(DE_HOY.at), pregunta: DE_HOY, trabajo: trabajo('cancelado') },
  ];
  assert.deepEqual(preguntasParaElBloque(lineas).map((p) => p.id), [DE_HOY.id], 'la ignorada no; la de respuesta cancelada, sí');
  assert.deepEqual(preguntasIgnoradas(lineas).map((p) => p.id), [ignorada.id]);
  const conRespuestaEnCamino: LineaChat[] = [{ tipo: 'pregunta', instante: Date.parse(DE_HOY.at), pregunta: DE_HOY, trabajo: trabajo('escrito') }];
  assert.deepEqual(preguntasParaElBloque(conRespuestaEnCamino), [], 'con la respuesta en camino, no se vuelve a preguntar');
  const html = renderToStaticMarkup(createElement(Hilo, { lineas, pushes: [], ahora: AHORA, vacio: 'vacío', quien: { titulo: 'CRM', animo: 'despierto' } }));
  assert.doesNotMatch(html, /Decisión enviada|¿Reviso la/, 'ninguna de las dos dice que se mandó algo');
  const html2 = renderToStaticMarkup(createElement(Hilo, { lineas: conRespuestaEnCamino, pushes: [], ahora: AHORA, vacio: 'vacío', quien: { titulo: 'CRM', animo: 'despierto' } }));
  assert.match(html2, /Decisión enviada/, 'la que salió, sí');
});

test('7. las decisiones de la Ticketera: ignoradas no esperan, no cuentan, van a «Ignoradas» y la base no las contesta', () => {
  const abierta = decision(1, '2026-11-05T09:00:00Z');
  const ignorada = decision(2, '2026-10-30T09:00:00Z', { ignoradaAt: '2026-11-05T11:00:00Z' });
  assert.equal(esperaAMartin(abierta), true);
  assert.equal(esperaAMartin(ignorada), false);
  const chat = { miembros: [LOCAL] };
  const carteros = [{ cuenta: 'claude3', chats: [] }];
  assert.deepEqual(preguntasDelChat(chat, [abierta, ignorada], carteros).map((d) => d.id), [1]);
  assert.deepEqual(ignoradasDelChat(chat, [abierta, ignorada], carteros).map((d) => d.id), [2]);
  assert.deepEqual(esperasPorChat([abierta, ignorada], carteros), { [LOCAL]: 1 }, 'el globito no la cuenta');
  const r = repartir([abierta, ignorada]);
  assert.deepEqual(r.pendientes.bloquea.map((d) => d.id), [1], 'la Ticketera tampoco la da por pendiente');
  assert.deepEqual(r.ignoradas.map((d) => d.id), [2]);
  // Leída de la base (mig 0394): con la columna; sin ella, nada está ignorado; una contestada no queda ignorada.
  const fila = { id: 2, ref: 'd-2', chat: 'CRM', pregunta: '¿X?', opciones: [], urgencia: 'criterio', orden: 1, creada_at: '2026-10-30T09:00:00Z' };
  assert.equal(filaADecision({ ...fila, ignorada_at: '2026-11-05T11:00:00Z' }).ignoradaAt, '2026-11-05T11:00:00Z');
  assert.equal(filaADecision(fila).ignoradaAt, null, 'sin la migración');
  assert.equal(filaADecision({ ...fila, respuesta: 'A', ignorada_at: '2026-11-05T11:00:00Z' }).ignoradaAt, null);
  // En «Ignoradas» del bloque, con las preguntas: la última ignorada primero.
  const p = { ...VIEJA, ignorada: '2026-11-05T12:00:00Z' };
  const ig = armarIgnorar({ pregunta: async () => null, decision: async () => null, decisiones: [ignorada] }, [p]);
  assert.deepEqual(ig?.ignoradas.map((x) => x.id), [`c:${p.id}`, 't:2']);
  assert.match(leer('supabase/migrations/0394_decisiones_ignoradas.sql'), /alter table admin_decisiones add column if not exists ignorada_at timestamptz;/);
});

test('7b. la base de verdad (lib/admin-decisiones.ts): ignorar no contesta, ignorada no se contesta, y sin la mig 0394 lo dice', () => {
  const { r, escenas } = hijo();
  const d = escenas.decision;
  assert.ok(d, `sin la escena de la decisión: ${String(r.stdout).slice(-800)}`);
  assert.ok(d.ignorar && d.ignoradaAt, 'ignorar la marca con su hora');
  assert.equal(d.contestarIgnorada, 'La ignoraste: vuelve a mostrarla para contestarla.', 'ignorada no se contesta (no le llega un aviso al chat)');
  assert.equal(d.respuestaTrasIntento, null);
  assert.equal(d.dosVeces, 'Ya no espera tu respuesta.', 'ignorar dos veces no pisa la hora');
  assert.equal(d.contestada, 'Ya no espera tu respuesta.', 'una contestada no se ignora');
  assert.ok(d.volver && d.trasVolver === null, '«Volver a mostrar» le saca la marca');
  assert.ok(d.contestarVuelta && d.respuestaFinal === 'B', 'y se contesta como siempre');
  const s = escenas['sin-migracion'];
  assert.deepEqual(s, { escena: 'sin-migracion', ok: false, error: 'Todavía no se puede: falta un cambio en la base.', respuesta: null });
});

// PROBADO ROMPIÉNDOLO (5/11/2026, con la base en 9/0; cada pieza restaurada desde memoria, nunca con `git checkout`):
//   · `estaAbierta` sin mirar `ignorada`                                        → 6/3 (1, 2b, 6: vuelve al bloque y al globito)
//   · la vuelta del Runner deja pasar todo (`if (true) return cand…`)           → 8/1 (2b: la respuesta de la ignorada sale)
//   · «no pude leer» que entrega igual                                          → 8/1 (2b: sin-leer)
//   · `cancelarRespuestasDe` sin comparar el id (cancela todo lo escrito)       → 8/1 (2b)
//   · `marcarContestada` sin mirar `ignorada`                                   → 8/1 (2b)
//   · `itemsDelBloque` sin ordenar por fecha                                    → 7/2 (4, 5: abre en la vieja)
//   · `ordenDeEntrega` de la más nueva a la más vieja                           → 8/1 (4)
//   · `edadDe` con «Vieja» a las 24 horas                                       → 8/1 (3)
//   · el Hilo sin la línea de la ignorada                                       → 8/1 (6: «Decisión enviada»)
//   · `respuestaEnCamino` sin mirar el cancelado                                → 8/1 (6)
//   · `esperasPorChat` sin mirar `ignoradaAt`                                   → 8/1 (7)
//   · `sanearPreguntas` sin sacar `ignorada` (la PC la podría subir)            → 8/1 (1)
//   · el botón «Ignorar» apagado                                                → 8/1 (5)
//   · `ignorarDecision` sin `.is('respuesta', null)`                            → 8/1 (7b)
//   · `guardarRespuesta` que contesta una ignorada                              → 8/1 (7b)
