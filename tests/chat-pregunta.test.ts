// =============================================================================
// MaKo pregunta con opciones, y hasta tener la respuesta no propone nada (20/10/2026, ola 1, pieza 1.9)
// =============================================================================
// docs/ops-center-principal.md §5. Hecho = «Con "todos los martes a las 3 a todo el funnel", MaKo pregunta y no propone
// nada hasta tener la respuesta». Lo que se fija (la regla la impone el código, lib/chat-pregunta.ts):
//   1. la pregunta se sanea como un G1: 2 a 4 opciones distintas; una que no calza vuelve como error y no se muestra;
//      una por turno;
//   2. desde que pregunta, el turno rechaza toda acción (una lectura sí corre), y lo propuesto antes se retira;
//   3. el turno lleva la herramienta cuando lleva alguna, la corre ANTES que todo, retira en la base lo que propuso antes
//      de preguntar, y guarda la pregunta con el mensaje;
//   4. el hilo la dibuja al volver el turno y al recargar, contestada si ya hubo respuesta, y las cuatro pantallas
//      mandan lo que se toca como el siguiente mensaje;
//   6. (revisión del 21/10/2026) tocar una opción mientras MaKo trabaja no dice «Respondiste» si no salió: las opciones
//      esperan mientras trabaja, y contestar escribiendo las apaga en el acto (`conRespuestas` al dibujar);
//   5. (revisión del 21/10/2026) lo que el turno propuso en una pantalla se retira EN LA BASE, cada uno con su descarte (el
//      borrador del plan, la ficha de lead, la propuesta de video, el borrador de WhatsApp, la genérica), sólo si lo creó
//      este turno; y el mensaje no dice «confírmalo abajo» sin nada abajo.
// ⚠️ La frase del «Hecho» hoy cae en `capturar`, sin herramientas: la pregunta no viaja con ella hasta que el clasificador
//    la mande a actuar (la 1.2, con la D1). Lo fija el test 3, para que el día que cambie se vea.
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · `bloquea` que deja pasar las acciones → 1 fallo (2);
//   · `retirar` que devuelve todo → 1 fallo (2);
//   · el turno sin guardar la pregunta con el mensaje → 1 fallo (3) (desde el 21/10, `conElMensaje` sin la pregunta);
//   · (21/10, Dashboard) `bloquesDelMensaje` que recorta la pregunta con 4 dibujos, como antes → 1 fallo (3);
//   · `itemsDeSesion` sin marcar la contestada → 1 fallo (4);
//   · (21/10) `aRetirar` sólo con la genérica, como antes → 1 fallo (5); que retira también la que ya estaba pendiente
//     → 1 fallo (5); el mensaje del borrador con una pregunta → 1 fallo (5); el turno sin retirar por clase → 1 fallo (5);
//   · `PreguntaHilo` que marca antes de mandar, como antes → 1 fallo (6); sin apagarse con `ocupado` → 1 fallo (6); el
//     hilo de la computadora sin `conRespuestas` → 1 fallo (6).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { REGISTRO, porId } from '../lib/api-mako/registro';
import { PREGUNTAR, TOOL_PREGUNTAR, crearGuardiaDePregunta, retirar } from '../lib/chat-pregunta';
import { clasificarIntencion } from '../lib/mako-intencion';
import { aRetirar, bloquesDelMensaje, herramientasDelChat, linksDeUnaAccion } from '../lib/mako-turno-app-reglas';
import { conRespuestas, itemsDeRespuesta, itemsDeSesion } from '../app/m/mako/chat-ui';
import type { Bloque } from '../lib/chat-bloques';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** Como el turno: una herramienta escribe si el registro dice que no es una lectura. */
const esAccion = (n: string) => { const d = porId(n); return d ? d.tipo !== 'lectura' : false; };
const PREGUNTA = {
  pregunta: '¿A qué etapa del funnel?',
  opciones: [{ titulo: 'Agendados', detalle: '12 leads' }, { titulo: 'Nuevos' }, { titulo: 'Todo el funnel' }],
  recomendada: 0,
};

test('1. la pregunta se sanea como un G1, y una por turno', () => {
  const g = crearGuardiaDePregunta(esAccion);
  assert.equal(g.preguntar({ pregunta: '¿Cuál?', opciones: [{ titulo: 'Una' }] }).ok, false, 'una sola opción no es una pregunta');
  assert.equal(g.pregunta, null, 'y no se muestra');
  assert.equal(g.preguntar(PREGUNTA).ok, true);
  assert.deepEqual(g.pregunta, { t: 'pregunta', ...PREGUNTA });
  assert.equal(g.preguntar({ ...PREGUNTA, pregunta: '¿Y otra?' }).ok, false, 'una por vez');
  assert.equal(TOOL_PREGUNTAR.name, PREGUNTAR);
  assert.deepEqual((TOOL_PREGUNTAR.input_schema as { required: string[] }).required, ['pregunta', 'opciones']);
});

test('2. desde que pregunta, ninguna acción; lo propuesto antes se retira', () => {
  const accion = 'crear_automatizacion_con_ia';
  const lectura = 'listar_leads';
  assert.ok(esAccion(accion) && !esAccion(lectura), 'una acción y una lectura del registro');
  const g = crearGuardiaDePregunta(esAccion);
  assert.equal(g.bloquea(accion), false, 'antes de preguntar, nada se rechaza');
  g.preguntar(PREGUNTA);
  assert.equal(g.bloquea(accion), true, 'después, la acción se rechaza');
  assert.equal(g.bloquea(lectura), false, 'una lectura sí corre');
  assert.equal(g.bloquea(PREGUNTAR), false);
  assert.deepEqual(retirar(g.pregunta, [1, 2], ['a']), { propuestas: [], pantallas: [] }, 'con una pregunta, nada propuesto en el turno');
  assert.deepEqual(retirar(null, [1, 2], ['a']), { propuestas: [1, 2], pantallas: ['a'] });
});

test('3. el turno: lleva la herramienta, la corre antes que todo, retira y guarda la pregunta', () => {
  const s = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(s, /const tools = herramientasDelModo\(turno\.tools\.length \? \[\.\.\.\(turno\.tools as ToolDef\[\]\), TOOL_PREGUNTAR\]/, 'viaja cuando hay herramientas');
  const correr = s.slice(s.indexOf('const runTool = async'), s.indexOf('const previo = memo.previo(name);'));
  assert.match(correr, /if \(name === PREGUNTAR\) \{[\s\S]*guardia\.preguntar\(input\)/, 'la pregunta la toma la guardia');
  assert.match(correr, /if \(guardia\.bloquea\(name\)\) return \{ content: JSON\.stringify\(\{ ok: false, error: ERROR_TRAS_PREGUNTAR \}\), isError: true \};/, 'y rechaza ANTES de correr nada');
  assert.match(s, /resolverPendiente\(ws, t\.pendienteId, 'cancelada', 'MaKo preguntó antes de proponer', \{ soloSiPendiente: true \}\)/, 'retira las tarjetas del turno en la base');
  assert.match(s, /\.\.\.capturados\.map\(\(l\) => retirarEnSuPantalla\(ws, aRetirar\(l\)\)\)/, 'y las propuestas de pantalla (test 5)');
  // Desde el 21/10 va junto con lo que dibujaron las herramientas (tests/chat-bloques-salida.test.ts).
  assert.match(s, /const conElMensaje = bloquesDelMensaje\(dibujos, pregunta, MAX_BLOQUES_MENSAJE\);/, 'la pregunta va con el mensaje');
  // Y nunca se recorta (lo encontró Dashboard, 21/10): con el tope lleno de dibujos, se recortan los dibujos.
  assert.deepEqual(bloquesDelMensaje(['d1', 'd2', 'd3', 'd4'], 'P', 4), ['d1', 'd2', 'd3', 'P'], 'con 4 dibujos, la pregunta igual va');
  assert.deepEqual(bloquesDelMensaje(['d1', 'd2'], 'P', 4), ['d1', 'd2', 'P']);
  assert.deepEqual(bloquesDelMensaje(['d1', 'd2', 'd3', 'd4', 'd5'], null, 4), ['d1', 'd2', 'd3', 'd4'], 'sin pregunta, el tope de siempre');
  // Desde el 12/11/2026 la respuesta va con «lo que leí» al final (una marca que no se dibuja, tests/chat-app-hilo.test.ts). La regla
  // sigue: la pregunta va en `conElMensaje`, y `conElMensaje` se guarda con la respuesta.
  assert.match(s, /const conLoLeido = \[\.\.\.conElMensaje\.map\(aGuardar\), \.\.\.\(leido \? \[marcaLeido\(leido\)\] : \[\]\)\];\s*await appendMessage\(s\.id, 'assistant', respuesta, conLoLeido\.length \? conLoLeido : undefined\);/);
  // La frase del «Hecho»: hoy, sin herramientas (es de la 1.2). Cuando el clasificador la mande a actuar, esto cambia.
  const frase = 'todos los martes a las 3 a todo el funnel';
  const v = clasificarIntencion(frase, { hayMedia: false });
  const t = herramientasDelChat({ veredicto: v, texto: frase, agendaAbierta: false, deSiempre: [], vista: { canal: 'app', alcance: 'proponer', ws: 9, rol: 'admin', tabs: null, plataforma: false }, hayPendientes: false });
  assert.deepEqual([v.intencion, t.tools.length], ['capturar', 0], 'hoy cae en capturar, sin herramientas: llega con la 1.2');
});

test('4. el hilo la dibuja, contestada si ya hubo respuesta, y lo que se toca sale como mensaje', async () => {
  const b = { t: 'pregunta' as const, ...PREGUNTA };
  const vuelta = itemsDeRespuesta({ ok: true, sesion: { id: 1, titulo: null, updatedAt: '' }, mensajes: [{ role: 'assistant', content: PREGUNTA.pregunta, bloques: [b] }], aviso: null, paraLaPersona: [], propuestas: [], pantallas: [] } as never);
  assert.deepEqual(vuelta.map((x) => x.k), ['msg', 'bloque'], 'al volver el turno, la pregunta debajo del mensaje');
  const hilo = itemsDeSesion([
    { role: 'user', content: 'todos los martes a las 3 a todo el funnel' },
    { role: 'assistant', content: PREGUNTA.pregunta, bloques: [b] },
    { role: 'user', content: 'Agendados' },
  ], []);
  const q = hilo.find((x) => x.k === 'bloque');
  assert.equal(q && q.k === 'bloque' ? q.respondida : null, 'Agendados', 'al recargar, contestada con lo que dijo');
  const { BloqueHilo } = await import('../app/_chat/BloqueHilo');
  const html = renderToStaticMarkup(createElement(BloqueHilo, { b: b as Bloque, onResponder: () => {}, respondida: 'Agendados' }));
  assert.match(html, /Respondiste: Agendados/);
  assert.equal((html.match(/class="ch-opcion" disabled=""/g) ?? []).length, 3, 'y no se vuelve a tocar');
  // Desde el 21/10 dicen si salió (test 6).
  assert.match(sinComentarios(leer('app/second-brain/PiezasCliente.tsx')), /onResponder=\{\(t\) => k\.enviar\(t\)\}/, 'el Ops Center');
  assert.match(sinComentarios(leer('app/crm/lead-view/MakoAnalystLead.tsx')), /onResponder=\{\(t\) => \{ if \(ocupadoRef\.current\) return false; enviar\(\{ texto: t, adjuntos: \[\] \}\); return true; \}\}/, 'el de la ficha');
});

test('5. lo propuesto en una pantalla se retira en la base, cada uno con su descarte, y el mensaje no lo ofrece', () => {
  const salida = (url: string, extra: Record<string, unknown> = {}, nueva = true) => JSON.stringify({ ...extra, ok: true, url, link: url, nueva });
  const video = REGISTRO.find((d) => d.area === 'video' && d.tipo === 'accion' && d.confirmacion === 'pantalla' && d.pantalla === '/video-editor')!;
  const casos: Array<[string, Record<string, unknown>, string, string]> = [
    ['proponer_tareas_plan', { tareas: [{ titulo: 'a' }] }, JSON.stringify({ ok: true, link: 'https://hola-mako.com/plan/revisar/propabc123?ws=9' }), 'borrador:propabc123'],
    ['proponer_lead', { nombre: 'Ana' }, salida('https://hola-mako.com/crm/revisar/lead77?ws=9'), 'lead:lead77'],
    [video.id, {}, salida('https://hola-mako.com/video-editor/proy-1?propuesta=vp42&ws=9'), 'editor:vp42'],
    ['crear_borrador_whatsapp_empresa', { leadId: 7, texto: 'hola' }, salida('https://hola-mako.com/whatsapp?canal=no-oficial&chat=x', { para: 'Juan', borradorId: 314 }), 'whatsapp:314'],
    ['proponer_estado_campana', {}, salida('https://hola-mako.com/mako/revisar/zz9?ws=9'), 'accion:zz9'],
  ];
  for (const [op, input, out, esperado] of casos) {
    const [l] = linksDeUnaAccion(op, input, out);
    const r = l ? aRetirar(l) : null;
    assert.equal(r ? `${r.clase}:${r.id}` : null, esperado, op);
  }
  const [vieja] = linksDeUnaAccion('proponer_lead', { nombre: 'Ana' }, salida('https://hola-mako.com/crm/revisar/lead77?ws=9', {}, false));
  assert.equal(aRetirar(vieja), null, 'la que ya estaba pendiente de antes no es de este turno: no se toca');
  const s = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(s, /const borrador = pregunta \? null : capturados\.find/, 'con una pregunta, el mensaje del borrador no sale');
  assert.match(s, /const lead = pregunta \? null : capturados\.find/, 'ni el de la ficha');
  const retiro = s.slice(s.indexOf('async function retirarEnSuPantalla'), s.indexOf('async function anotarEnHilo'));
  for (const f of ['descartarPropuesta(r.id)', 'descartarBorradorDelPlan(r.id)', "resolverPropuestaDeVideo({ ws, id: r.id, estado: 'descartada'", 'descartarBorrador(Number(r.id))']) {
    assert.ok(retiro.includes(f), `retira con ${f}`);
  }
});

test('6. una opción tocada mientras MaKo trabaja no dice «Respondiste» si no salió', async () => {
  const { BloqueHilo } = await import('../app/_chat/BloqueHilo');
  const b = { t: 'pregunta' as const, ...PREGUNTA } as Bloque;
  // Mientras trabaja, las opciones esperan.
  const ocupado = renderToStaticMarkup(createElement(BloqueHilo, { b, onResponder: () => true, ocupado: true }));
  assert.equal((ocupado.match(/class="ch-opcion" disabled=""/g) ?? []).length, 3, 'apagadas mientras MaKo trabaja');
  assert.doesNotMatch(ocupado, /Respondiste/);
  const libre = renderToStaticMarkup(createElement(BloqueHilo, { b, onResponder: () => true }));
  assert.equal((libre.match(/class="ch-opcion" disabled=""/g) ?? []).length, 0, 'y prendidas cuando no');
  // «Respondiste» sólo si salió: el orden lo fija la fuente (los efectos no corren en este render).
  const s = sinComentarios(leer('app/_chat/BloqueHilo.tsx'));
  assert.match(s, /if \(onResponder\?\.\(t\) === false\) \{ setNoSalio\(true\); return; \}\s*setNoSalio\(false\);\s*setEnviada\(t\);/, 'marca después de mandar, y sólo si salió');
  // Contestar ESCRIBIENDO la apaga en el acto: las pantallas dibujan con lo contestado.
  const hilo = conRespuestas([
    { k: 'bloque', id: 'q', b },
    { k: 'msg', id: 'u', role: 'user', texto: 'mejor los nuevos', at: null } as never,
  ]);
  assert.equal(hilo[0].k === 'bloque' ? hilo[0].respondida : null, 'mejor los nuevos');
  assert.match(sinComentarios(leer('app/_chat/HiloMako.tsx')), /conRespuestas\(items\)\.forEach\(/, 'la computadora');
  // La ficha, con el MISMO hilo desde el 22/10/2026 (CR3): `conRespuestas` lo aplica HiloMako.
  assert.match(sinComentarios(leer('app/crm/lead-view/MakoAnalystLead.tsx')), /<HiloMako key=\{leadId\} items=\{items\} quien=\{QUIEN\}/, 'la ficha');
});
