// =============================================================================
// Duodécima tanda de Automations (12/10/2026), paquete «chat-ui»: el chat de MaKo por automatización.
// Diseño: docs/diseno-duodecima-tanda.md §2.5, §2.6, §3.3, §3.4 y §3.6. Martín, textual: «tiene que tener un chat donde
// guarda el registro... como hoy lo hace Claude que te saltan una pregunta con tres opciones» y «que se guarde un
// registro tipo chat de las cosas que vos le fuiste pidiendo desde el primer pedido hasta el último».
//
// Lo que se fija (lo puro se EJECUTA; el cableado, en el fuente sin comentarios):
//   · ChatMako dibuja la pregunta VIVA con sus botones TAL CUAL, «Otra cosa» y «Elige tú» (las de antes, sin botones);
//   · cada botón manda la respuesta del contrato (`respuestaMako`), y cada turno re-POSTea el pedido ORIGINAL con las
//     respuestas acumuladas (`rondaAbierta`, `cuerpoIA`);
//   · el lector vive en app/automations/stream-ia.ts y lee un `Response` de verdad (fases, pregunta, listo, error, corte);
//   · editar con `disparadores` los guarda por `action: 'disparadores'` (la acción del panel del CRON), y la respuesta
//     del CRON sola no toca el lienzo (`edicionTocaPasos`);
//   · `?mako=1` y `alCrearConIA` abren el lienzo CON el chat abierto (SecuenciaPerfil dibujado con `makoAlAbrir`);
//   · la barra vieja («Pídele un cambio» + «Agregar») ya no se monta.
//
// DECIMOTERCERA TANDA (12/10/2026): el chat es el hilo de WhatsApp (`ChatHilo`, punto 6) y vive SÓLO en el lienzo (con
// tarjetas edita; vacío, crea sobre esa fila). La galería es `BarraPideselo`, que sólo pide (punto 2): lo nuevo se fija
// en tests/automations-decimotercera.test.ts; acá, lo de la duodécima con la forma nueva.
//
// PROBADO ROMPIÉNDOLO: ver el pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatMako, TarjetaPregunta, textoDeListo, juntarHilo, PLACEHOLDER_OTRA, PLACEHOLDER_EDITAR, NO_APLICADO } from '../app/automations/ChatMako';
import { cuerpoIA, eventoDeLinea, leerRespuestaIA, TOPE_CLIENTE_MS } from '../app/automations/stream-ia';
import { rondaAbierta, respuestaMako, edicionTocaPasos, ELIGE_TU, OTRA_COSA } from '../lib/flujo-ia-cliente';
import { SecuenciaPerfil } from '../app/automations/SecuenciaPerfil';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';
import type { MensajeChatMako, PreguntaMako } from '../lib/automatizacion-chat';
import { marcasDeVoseo } from '../lib/puestas-data';
import { respuestaDelCron, turnoDelUsuario } from '../lib/flujo-ia-preguntas';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas primero y los bloques después (AGENTS.md: un `/*` adentro de un comentario de línea).
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const tramo = (src: string, desde: string, hasta: string, tope = 4_000): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no está el cierre «${hasta}»`);
  assert.ok(j - i <= tope, `el tramo de «${desde}» mide ${j - i} (> ${tope})`);
  return src.slice(i, j + hasta.length);
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cuantas = (s: string, re: RegExp) => (s.match(re) ?? []).length;

const CHAT = sinComentarios(leer('app/automations/ChatMako.tsx'));
const LECTOR = sinComentarios(leer('app/automations/stream-ia.ts'));
const PERFIL = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
const APP = sinComentarios(leer('app/automations/ChatAgentApp.tsx'));
const LISTA = sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx'));

const AT = '2026-10-12T05:00:00.000Z';
const CANAL: PreguntaMako = {
  id: 'p1', sobre: 'canal', texto: '¿Por dónde le escribo?', otra: true,
  opciones: [{ valor: 'instagram', label: 'Instagram' }, { valor: 'messenger', label: 'Messenger' }, { valor: 'whatsapp', label: 'WhatsApp «línea 2» & más', detalle: 'el de siempre' }],
};
const PRODUCTO: PreguntaMako = {
  id: 'p2', sobre: 'producto', texto: '¿De qué producto?', otra: true,
  opciones: [{ valor: 'entrega:39:onboarding', label: 'Fiesta Music' }, { valor: 'entrega:10:onboarding', label: 'Service Delivery & Ops' }],
};
const PEDIDO = 'Mándale el lead magnet a quien comenta el reel';
const yo = (id: string, texto: string, o: Partial<MensajeChatMako> = {}): MensajeChatMako => ({ id, de: 'yo', texto, at: AT, via: 'app', ...o });
const mako = (id: string, texto: string, o: Partial<MensajeChatMako> = {}): MensajeChatMako => ({ id, de: 'mako', texto, at: AT, via: 'app', ...o });
const HILO: MensajeChatMako[] = [yo('y1', PEDIDO), mako('m1', CANAL.texto, { pregunta: CANAL })];
const R_CANAL = respuestaMako(CANAL, { valor: 'instagram' });
const HILO2: MensajeChatMako[] = [...HILO, yo('y2', R_CANAL.texto, { respuesta: R_CANAL.respuesta }), mako('m2', PRODUCTO.texto, { pregunta: PRODUCTO })];

// Con el lienzo vacío MaKo CREA sobre la fila; con tarjetas, EDITA (decimotercera tanda).
const PASO_LIENZO = { id: 'm1', orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: 'Hola', template_wa: null };
const dibujarChat = (inicial: MensajeChatMako[], modo: 'crear' | 'editar' = 'crear') => renderToStaticMarkup(createElement(ChatMako,
  { secuenciaId: 7, pasos: modo === 'editar' ? [PASO_LIENZO] : [], onListo: () => {}, inicial } as unknown as Parameters<typeof ChatMako>[0]));

// ── 1. La pregunta como tarjeta ─────────────────────────────────────────────────────────────────

test('ChatMako dibuja la pregunta VIVA: sus botones con los rótulos TAL CUAL, «Otra cosa» y «Elige tú»', () => {
  const html = dibujarChat(HILO);
  assert.equal(cuantas(html, /data-pregunta-mako="/g), 1);
  for (const o of CANAL.opciones) {
    assert.ok(html.includes(`data-opcion="${esc(o.valor)}"`), `falta el botón de ${o.valor}`);
    assert.ok(html.includes(`>${esc(o.label)}</button>`), `el rótulo de ${o.valor} no va tal cual`);
  }
  assert.equal(cuantas(html, /data-opcion="/g), CANAL.opciones.length, 'un botón de más o de menos');
  assert.match(html, new RegExp(`data-otra-cosa=""[^>]*>${OTRA_COSA}</button>`));
  assert.match(html, new RegExp(`data-elige-tu=""[^>]*>${ELIGE_TU}</button>`));
  // El pedido en el hilo (la burbuja de WhatsApp), y la barra lista para «Otra cosa».
  assert.ok(html.includes(`<span>${PEDIDO}</span>`));
  assert.ok(html.includes(`placeholder="${PLACEHOLDER_OTRA}"`));
  // La de ANTES (ya contestada) queda como texto, sin botones: sólo la viva los lleva.
  const html2 = dibujarChat(HILO2);
  assert.equal(cuantas(html2, /data-pregunta-mako="/g), 1);
  assert.match(html2, /data-pregunta-mako="producto"/);
  assert.doesNotMatch(html2, /data-opcion="instagram"/, 'la pregunta contestada sigue con botones');
  assert.ok(html2.includes('<span>Instagram</span>'), 'la respuesta no quedó en el hilo');
  // Sin pregunta, no hay tarjeta; en el lienzo la caja dice «Pídele un cambio».
  const sin = dibujarChat([yo('y1', PEDIDO), mako('m1', 'Cambié 1')], 'editar');
  assert.doesNotMatch(sin, /data-pregunta-mako/);
  assert.ok(sin.includes(`placeholder="${PLACEHOLDER_EDITAR}"`));
  // La tarjeta sola (la misma pieza que usa el hilo).
  const t = renderToStaticMarkup(createElement(TarjetaPregunta, { pregunta: PRODUCTO, onElegir: () => {}, onOtraCosa: () => {} }));
  assert.equal(cuantas(t, /<button/g), PRODUCTO.opciones.length + 2);
});

test('los avisos van en el mensaje de MaKo, y lo que se dibuja va en tú', () => {
  const html = dibujarChat([yo('y1', 'Cambia WhatsApp por Instagram'), mako('m1', 'Cambié 2', { avisos: ['Saqué el Si responde: por Instagram todavía no contesta'] })], 'editar');
  assert.match(html, /data-avisos-mako=""[^>]*><li>Saqué el Si responde: por Instagram todavía no contesta<\/li><\/ul>/);
  for (const s of [ELIGE_TU, OTRA_COSA, PLACEHOLDER_OTRA, PLACEHOLDER_EDITAR, NO_APLICADO,
    textoDeListo({ orden: ['a'] }), textoDeListo({ orden: ['a', 'b'] }), textoDeListo({ orden: [], disparadores: [{ id: 'd1', trigger_tipo: 'manual' }] as never })]) {
    assert.deepEqual(marcasDeVoseo(s), [], s);
    assert.ok(s.length <= 40, `«${s}» es largo para la pantalla`);
  }
  // El resumen del server manda; sin él, uno por código.
  assert.equal(textoDeListo({ resumen: 'Cambié 3 · saqué 1', orden: ['x'] }), 'Cambié 3 · saqué 1');
  assert.equal(textoDeListo({ orden: [] }), 'Listo');
});

// ── 2. Cada turno: el pedido original y las respuestas acumuladas ───────────────────────────────

test('cada botón manda la respuesta del contrato: el valor del catálogo, «Elige tú» = null, «Otra cosa» = null + texto', () => {
  assert.deepEqual(R_CANAL, { respuesta: { preguntaId: 'p1', sobre: 'canal', valor: 'instagram' }, texto: 'Instagram' });
  assert.deepEqual(respuestaMako(CANAL, { eligeTu: true }), { respuesta: { preguntaId: 'p1', sobre: 'canal', valor: null }, texto: ELIGE_TU });
  assert.deepEqual(respuestaMako(CANAL, { texto: 'Por los dos' }), { respuesta: { preguntaId: 'p1', sobre: 'canal', valor: null, texto: 'Por los dos' }, texto: 'Por los dos' });
  // El botón «Elige tú» del chat es ESE (y «Otra cosa» abre el texto, no manda nada).
  assert.match(tramo(CHAT, 'export function TarjetaPregunta(', '\n}\n', 2200), /data-elige-tu="" disabled=\{deshabilitado\} onClick=\{\(\) => onElegir\(\{ eligeTu: true \}\)\}/);
  // «Otra cosa» enfoca la barra del hilo (lo que se escriba es la respuesta), no manda nada.
  const tarjeta = tramo(CHAT, 'export function TarjetaPregunta(', '\n}\n', 2200);
  assert.match(tarjeta, /data-otra-cosa="" disabled=\{deshabilitado\} onClick=\{otraCosa\}/);
  assert.match(tarjeta, /querySelector<HTMLTextAreaElement>\('textarea'\)\?\.focus\(\);/);
  assert.doesNotMatch(tarjeta.slice(tarjeta.indexOf('const otraCosa')), /onElegir\(\{ texto/, '«Otra cosa» manda algo');
});

test('cada turno re-POSTea el pedido ORIGINAL con las respuestas acumuladas (y la galería, el hilo entero)', () => {
  // La ronda que queda abierta en un hilo guardado.
  assert.deepEqual(rondaAbierta(HILO), { pedido: PEDIDO, respuestas: [], pregunta: CANAL });
  assert.deepEqual(rondaAbierta(HILO2), { pedido: PEDIDO, respuestas: [R_CANAL.respuesta], pregunta: PRODUCTO });
  assert.equal(rondaAbierta([...HILO2, yo('y3', 'Fiesta Music', { respuesta: respuestaMako(PRODUCTO, { valor: 'entrega:39:onboarding' }).respuesta })]), null, 'contestada, no hay ronda abierta');
  assert.equal(rondaAbierta([]), null);
  // «¿Cambio qué la dispara?» sale con el resumen (`cambios`): una ronda NUEVA sobre el mismo pedido.
  const cron: PreguntaMako = { id: 'p3', sobre: 'cron', texto: '¿Cambio qué la dispara?', otra: true, opciones: [{ valor: 'instagram:comentario', label: 'Comenta un post' }, { valor: 'igual', label: 'Déjalo así' }] };
  const conResumen = [...HILO, yo('y2', 'Instagram', { respuesta: R_CANAL.respuesta }), mako('m2', 'Cambié 2', { cambios: { cambiadas: 2, quitadas: 0, agregadas: 0 }, pregunta: cron })];
  assert.deepEqual(rondaAbierta(conResumen), { pedido: PEDIDO, respuestas: [], pregunta: cron });
  // Y si el resumen va en un mensaje aparte, lo mismo.
  const aparte = [...HILO, yo('y2', 'Instagram', { respuesta: R_CANAL.respuesta }), mako('m2', 'Cambié 2'), mako('m3', cron.texto, { pregunta: cron })];
  assert.deepEqual(rondaAbierta(aparte), { pedido: PEDIDO, respuestas: [], pregunta: cron });

  // El cuerpo del POST.
  assert.deepEqual(cuerpoIA({ pedido: PEDIDO, modo: 'crear', respuestas: [R_CANAL.respuesta], historial: HILO2 }),
    { pedido: PEDIDO, modo: 'crear', respuestas: [R_CANAL.respuesta], historial: HILO2 });
  assert.deepEqual(cuerpoIA({ pedido: PEDIDO, modo: 'editar', secuenciaId: 7, pasos: [], respuestas: [] }),
    { pedido: PEDIDO, modo: 'editar', secuenciaId: 7, pasos: [] });
  // El cableado: una respuesta manda el pedido de la ronda, no el rótulo que tocó.
  const turno = tramo(CHAT, 'const turno = async (', '\n  };', 7000);
  assert.match(turno, /const enCurso = respuesta && ronda\s*\? \{ pedido: ronda\.pedido, respuestas: \[\.\.\.ronda\.respuestas, respuesta\] \}\s*: \{ pedido: dicho, respuestas: \[\] as RespuestaMako\[\] \};/);
  // Decimotercera: con el lienzo VACÍO crea sobre ESTA fila; con tarjetas, edita el borrador que se manda.
  assert.match(turno, /const modo = crea \? 'crear' : 'editar';\n\s+const base = modo === 'editar' \? p\.pasos : undefined;/);
  assert.match(turno, /pedido: enCurso\.pedido, modo, respuestas: enCurso\.respuestas, secuenciaId: p\.secuenciaId,/);
  // El hilo de ANTES del turno (`mensajes`): la ruta guarda el turno.
  assert.match(turno, /historial: mensajes,\n\s+\}\);/);
  // Por qué (lo hace la ruta, lib/flujo-ia-preguntas.ts): la pregunta que se contesta se busca EN EL HILO.
  const conCron = [...HILO, mako('m2', 'Cambié 2', { cambios: { cambiadas: 2, quitadas: 0, agregadas: 0 }, pregunta: cron })];
  const eligeTu = respuestaMako(cron, { eligeTu: true });
  assert.equal(respuestaDelCron(eligeTu.respuesta, conCron).disparadores?.length, 1, 'con el hilo, «Elige tú» toma la primera opción');
  assert.equal(respuestaDelCron(eligeTu.respuesta, []).disparadores, undefined, 'sin el hilo, «Elige tú» no cambia nada');
  const opcion = respuestaMako(cron, { valor: 'instagram:comentario' });
  assert.equal(turnoDelUsuario(PEDIDO, [opcion.respuesta], conCron, 'app')?.texto, 'Comenta un post', 'el turno se guarda con el rótulo');
  assert.equal(turnoDelUsuario(PEDIDO, [opcion.respuesta], [...conCron, yo('y3', 'Comenta un post')], 'app'), null, 'con el turno al final, no se guarda');
  // Lo escrito con una pregunta abierta ES «Otra cosa».
  assert.match(CHAT, /if \(ronda\) \{ const r = respuestaMako\(ronda\.pregunta, \{ texto: t \}\); return turno\(r\.texto, r\.respuesta, origen\); \}/);
});

// ── 3. El lector ─────────────────────────────────────────────────────────────────────────────────

const ndjson = (partes: string[], tipo = 'application/x-ndjson') => {
  const enc = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(c) { for (const p of partes) c.enqueue(enc.encode(p)); c.close(); },
  }), { headers: { 'content-type': tipo } });
};
const linea = (o: unknown) => `${JSON.stringify(o)}\n`;

test('el lector vive en stream-ia.ts y lee un stream de verdad: fases, pregunta, listo con lo de editar, error y corte', async () => {
  const fases: string[] = [];
  const alFase = (ev: { fase: string }) => { fases.push(ev.fase); };
  // Un `listo` partido entre dos pedazos, con las fases antes y lo de editar (§3.5).
  const listo = { t: 'listo', modo: 'editar', secuenciaId: 7, pasos: [], nombre: 'x', orden: [], avisos: [], etiquetasNuevas: [], resumen: 'Cambié qué la dispara', cambiadas: [], quitadas: [], disparadores: [{ id: 'd1', trigger_tipo: 'instagram', subtipo: 'comentario' }] };
  const l = JSON.stringify(listo);
  const f1 = await leerRespuestaIA(ndjson([linea({ t: 'fase', fase: 'contexto', leyendo: {}, texto: 'tu perfil' }), linea({ t: 'fase', fase: 'modelo' }), l.slice(0, 40), `${l.slice(40)}\n`]), alFase);
  assert.deepEqual(fases, ['contexto', 'modelo']);
  assert.equal(f1.t, 'listo');
  assert.deepEqual(f1.t === 'listo' ? f1.listo.disparadores : null, listo.disparadores);
  // La pregunta termina el stream (sin barra final: el último pedazo también se lee).
  const msj = mako('m9', CANAL.texto, { pregunta: CANAL });
  const f2 = await leerRespuestaIA(ndjson([JSON.stringify({ t: 'pregunta', pregunta: CANAL, mensaje: msj })]), alFase);
  assert.deepEqual(f2, { t: 'pregunta', pregunta: CANAL, mensaje: msj });
  // El error trae su link; una línea rota se saltea.
  const f3 = await leerRespuestaIA(ndjson(['{rota\n', linea({ t: 'error', error: 'Gemini rechazó tu key. Cámbiala en Integraciones.', link: '/integraciones?abrir=gemini' })]), alFase);
  assert.deepEqual(f3, { t: 'error', error: 'Gemini rechazó tu key. Cámbiala en Integraciones.', link: '/integraciones?abrir=gemini' });
  // Cerrado sin decir cómo terminó.
  assert.deepEqual(await leerRespuestaIA(ndjson([linea({ t: 'fase', fase: 'modelo' })]), alFase), { t: 'error', error: 'Se cortó. Prueba de nuevo.' });
  // El JSON plano de antes del stream.
  const r409 = new Response(JSON.stringify({ ok: false, error: 'Ya tiene tarjetas' }), { status: 409, headers: { 'content-type': 'application/json' } });
  assert.deepEqual(await leerRespuestaIA(r409, alFase), { t: 'error', error: 'Ya tiene tarjetas', status: 409 });
  assert.equal(eventoDeLinea(''), null);
  assert.equal(eventoDeLinea('[1,2]'), null);

  // El tope del cliente sigue siendo el de la ruta + margen, y corta el pedido de verdad.
  assert.equal(TOPE_CLIENTE_MS, 310_000);
  assert.match(LECTOR, /const tope = setTimeout\(\(\) => c\.abort\(\), TOPE_CLIENTE_MS\);/);
  // El chat usa ESE lector y no tiene otro.
  assert.match(CHAT, /import \{ useStreamIA, RUTA_IA, TOPE_CLIENTE_MS, TEXTO_FASE, ORDEN_FASES, type EstadoIA, type ListoStreamIA \} from '\.\/stream-ia';/);
  for (const [f, src] of [['ChatMako.tsx', CHAT], ['CrearConIA.tsx', sinComentarios(leer('app/automations/CrearConIA.tsx'))]] as const) {
    assert.doesNotMatch(src, /getReader\(|new TextDecoder|method: 'POST'/, `${f} lee el stream por su lado`);
  }
});

// ── 4. Editar aplica el resultado ────────────────────────────────────────────────────────────────

test('editar con `disparadores` los guarda YA por action «disparadores» (la del panel del CRON); sólo el CRON no toca el lienzo', () => {
  // Lo puro: la respuesta del CRON (pasos tal cual) no toca las tarjetas; un listo de antes, sí.
  assert.equal(edicionTocaPasos({ orden: [], cambiadas: [], quitadas: [] }), false);
  assert.equal(edicionTocaPasos({ orden: [] }), true, 'un listo de antes siempre agrega');
  assert.equal(edicionTocaPasos({ orden: ['n1'], cambiadas: [] }), true);
  assert.equal(edicionTocaPasos({ orden: [], cambiadas: ['m1'] }), true);
  assert.equal(edicionTocaPasos({ orden: [], cambiadas: [], quitadas: ['e2'] }), true);
  // El cableado en SecuenciaPerfil.
  const listo = tramo(PERFIL, 'const alListoIA = (r: ListoCrearIA)', '\n  };', 3500);
  const otra = listo.slice(listo.indexOf('} else {'));
  assert.match(otra, /if \(edicionTocaPasos\(r\)\) \{\s*if \(!edicionVigente\(r\.base, pasos\)\) \{ setErr\('Cambiaste el flujo: pídelo de nuevo'\); return false; \}\s*fotoAntes\(\);\s*setPasos\(nuevos\);\s*\}/);
  assert.match(otra, /if \(r\.disparadores\?\.length\) crons\.guardar\(r\.disparadores\);/);
  assert.doesNotMatch(otra, /setEditandoIA\(false\)/, 'el chat se cierra al terminar: el resumen y la pregunta no se ven');
  assert.match(PERFIL, /const crons = useDisparadores\(secuencia as SecuenciaConDisparadores, \{ onCambio, onError: \(m\) => setErr\(m\) \}\);/);
  // `crons.guardar` es el POST del panel del CRON (y relee la lista: `onCambio`).
  const editor = sinComentarios(leer('app/automations/EditorDisparadores.tsx'));
  assert.match(tramo(editor, 'const guardar = (nueva: Disparador[]) => {', '\n  };', 600), /const body = \{ action: 'disparadores', secuenciaId: secuencia\.id, disparadores: nueva \};/);
  assert.match(tramo(editor, 'const mandar = async (', '\n  };', 900), /cb\.current\.onCambio\(\);/);
  // El chat le pasa al padre lo que trajo el listo (también la pregunta, que dibuja él).
  const turno = tramo(CHAT, 'const turno = async (', '\n  };', 7000);
  assert.match(turno, /\.\.\.\(l\.disparadores !== undefined \? \{ disparadores: l\.disparadores \} : \{\}\),/);
  assert.match(turno, /setRonda\(l\.pregunta \? \{ pedido: enCurso\.pedido, respuestas: \[\], pregunta: l\.pregunta \} : null\);/);
});

// ── 5. Abierto al entrar ─────────────────────────────────────────────────────────────────────────

const PASO = { id: 'm1', orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: 'Hola', template_wa: null };
const SEC = {
  id: 7, clave: 'bienvenida', nombre: 'Bienvenida', etapa: 'nuevo', trigger_tipo: 'manual',
  activa: false, pasos: [PASO], inscriptos: 0, enviados: 0, estrategia: null, metricas: {},
} as unknown as SecuenciaDto;
const dibujarPerfil = (makoAlAbrir: boolean) => renderToStaticMarkup(createElement(SecuenciaPerfil, {
  secuencia: SEC, secuencias: [SEC], productos: [], disparadores: [], onAbrirClave: () => {}, objetivos: [],
  etiquetaEtapa: (k: string) => k, rolAdmin: true, audios: [], negocio: 'Mi negocio', canalCaido: false, tz: null,
  onAudioNuevo: () => {}, onCambio: () => {}, makoAlAbrir,
} as Parameters<typeof SecuenciaPerfil>[0]));

test('abierto al entrar: el lienzo con makoAlAbrir monta el chat; ?mako=1 y la fila que nace con un pedido lo piden', () => {
  // Dibujado de verdad: con `makoAlAbrir` el chat está, y el ✦ encendido; sin él, no.
  const con = dibujarPerfil(true);
  assert.match(con, /data-crear-ia="editar"[\s\S]*data-chat-mako="editar"/, 'makoAlAbrir no abrió el chat');
  const sin = dibujarPerfil(false);
  assert.doesNotMatch(sin, /data-chat-mako/, 'el chat se abre solo sin que nadie lo pida');
  // Por `abrirMako`, la del ✦, en el flanco y sólo si está cerrado.
  assert.match(PERFIL, /if \(makoAlAbrir !== makoPedido\) \{\s*setMakoPedido\(makoAlAbrir\);\s*if \(makoAlAbrir && !editandoIA\) abrirMako\(\);\s*\}/);
  // La lista lo pasa a ESA automatización (después de elegirla: `cambiarA` lo limpia).
  assert.match(LISTA, /export type AbrirSecuencia = \{ id: number; mako\?: true; pedido\?: string \};/);
  assert.match(LISTA, /setAbrirVisto\(abrir\);\s*elegir\(abrir\.id\);\s*setMakoPara\(abrir\.mako \? abrir\.id : null\);/);
  assert.match(LISTA, /makoAlAbrir=\{makoPara === sel\.id\}/);
  assert.match(tramo(LISTA, 'const cambiarA = (id: number) => {', '\n  };', 900), /setMakoPara\(null\);/);
  // La tab: la fila que nace con un pedido de «Pídeselo a MaKo» (decimotercera, punto 2), y el link `?sec=<id>&mako=1`.
  assert.match(tramo(APP, 'const crearNueva = async (pedido?: string) => {', '\n  };', 1900), /setAbrirSec\(\{ id, mako: true, pedido \}\);/);
  const ancla = APP.slice(APP.indexOf("const sec = params.get('sec');"), APP.indexOf('const etiquetaEtapa = useCallback('));
  assert.match(ancla, /const conMako = params\.get\('mako'\) === '1';\s*if \(hallada\) setAbrirSec\(conMako \? \{ id: hallada\.id, mako: true \} : \{ id: hallada\.id \}\);/);
  // Elegir otra saca `mako=1` de la URL: si no, el ancla le abriría el chat a la otra.
  assert.match(tramo(APP, 'const escribirSec = useCallback(', '}, [params, router]);', 600), /q\.set\('sec', String\(id\)\);\s*q\.delete\('mako'\);/);
  // Al abrir, el hilo va al último mensaje: lo hace el hilo de WhatsApp que el chat monta (decimotercera, punto 6).
  assert.match(CHAT, /<ChatHilo\n/);
  assert.match(sinComentarios(leer('app/whatsapp/_shared/ChatHilo.tsx')), /useEffect\(\(\) => \{ const el = scrollRef\.current; if \(el && stickRef\.current\) el\.scrollTop = el\.scrollHeight; \}, \[mensajes, typing\]\);/);
  // Y lee el chat guardado: si falla, arranca vacío (nada lo bloquea).
  assert.match(CHAT, /const r = await fetch\(`\$\{RUTA_IA\}\?secuenciaId=\$\{secId\}`, \{ cache: 'no-store' \}\);/);
  assert.deepEqual(juntarHilo([yo('a', '1')], [yo('a', '1'), yo('b', '2')]).map((m) => m.id), ['a', 'b']);
});

// ── 6. La barra vieja ────────────────────────────────────────────────────────────────────────────

test('la barra vieja («Pídele un cambio» + «Agregar») ya no se monta: en su lugar va el chat', () => {
  const html = dibujarPerfil(true);
  assert.doesNotMatch(html, /<input[^>]*placeholder="Pídele un cambio"/, 'volvió la barra de una línea');
  assert.doesNotMatch(html, />Agregar<\/button>/, 'volvió el «Agregar» de la barra');
  assert.match(html, /<textarea[^>]*placeholder="Pídele un cambio"/);
  assert.doesNotMatch(PERFIL, /<CrearConIA\b/);
  assert.match(PERFIL, /<ChatMako secuenciaId=\{secuencia\.id\} pasos=\{pasos\} onListo=\{alListoIA\} /);
  const galeria = sinComentarios(leer('app/automations/GaleriaPlantillas.tsx'));
  assert.doesNotMatch(galeria, /<CrearConIA\b|<ChatMako\b/);
  // Decimotercera (punto 2): la galería sólo PIDE; la fila nace en la tab y MaKo trabaja en su lienzo.
  // Decimoquinta (puntos 7 y 8): el «+» es de la caja (subir un archivo, pegar un flujo); un flujo pegado se crea con
  // «Pegar lo copiado» de la galería (`onPegar`).
  assert.match(galeria, /<BarraPideselo onPedido=\{\(t\) => props\.current\.onPedirAMako\?\.\(t\)\} deshabilitado=\{creando != null\} inicial=\{p\.pedidoInicial\}\s+onFlujo=\{p\.onPegar \? \(t\) => props\.current\.onPegar\?\.\(t\) : undefined\} \/>/);
  // CrearConIA.tsx ya no es un componente: quedan sus exportaciones compartidas.
  const caja = sinComentarios(leer('app/automations/CrearConIA.tsx'));
  assert.doesNotMatch(caja, /export function CrearConIA\b/);
  assert.match(caja, /export const EJEMPLOS = \[/);
  assert.match(caja, /export function useEjemploQueSeEscribe\(/);
});

// PROBADO ROMPIÉNDOLO (12/10/2026), de a una, con el arnés scratchpad/wf-duodecima/chat-ui/romper.mjs (guarda el
// original en memoria, reescribe, corre este archivo y restaura comprobando el sha1). Base: 8 pass / 0 fail.
//   R1.  la tarjeta sin «Elige tú»                                              → 6 / 2 (la tarjeta + el contrato)
//   R2.  el rótulo de la opción no va tal cual (toUpperCase)                     → 7 / 1 (la tarjeta)
//   R3.  las preguntas ya contestadas siguen con botones                        → 7 / 1 (la tarjeta)
//   R4.  la respuesta re-POSTea el rótulo, no el pedido original                → 7 / 1 (cada turno)
//   R5.  «Elige tú» manda '' en vez de null                                     → 7 / 1 (el contrato)
//   R6a. la pregunta del CRON (con `cambios`) arrastra las respuestas de antes  → 7 / 1 (cada turno)
//   R6b. un resumen en el medio no cierra la ronda                              → 7 / 1 (cada turno)
//   R7.  el lector pierde el link del error                                     → 7 / 1 (el lector)
//   R8.  el lector no lee el último pedazo sin salto de línea                   → 7 / 1 (el lector)
//   R9.  editar no guarda el CRON que eligió la persona                         → 7 / 1 (editar)
//   R10. la respuesta del CRON vuelve a tocar el lienzo                         → 7 / 1 (editar)
//   R11. el chat se cierra al terminar una edición (`setEditandoIA(false)`)     → 7 / 1 (editar)
//   R12. la lista no le pasa `makoAlAbrir` al lienzo                            → 7 / 1 (abierto al entrar)
//   R13. el lienzo recibe `makoAlAbrir` y no abre el chat                       → 6 / 2 (abierto al entrar + la barra)
//   R14. `alCrearConIA` abre sin el chat                                        → 7 / 1 (abierto al entrar)
//   R15. el ancla ignora `mako=1`                                               → 7 / 1 (abierto al entrar)
//   R16. elegir otra deja `mako=1` en la URL                                    → 7 / 1 (abierto al entrar)
//   R17. vuelve un campo de una línea (`<input>`) en vez del composer           → 7 / 1 (la barra)
//   R18. el hilo no va al último mensaje                                        → 7 / 1 (abierto al entrar)
//   R19. el chat lee el stream por su lado (`getReader`)                        → 7 / 1 (el lector)
//   R27. editar no manda el hilo («Elige tú» del CRON quedaba en «Lo dejé así»)  → 7 / 1 (cada turno)
//   R28. editar manda el hilo CON el turno al final (la ruta no guarda el turno) → 7 / 1 (cada turno)
