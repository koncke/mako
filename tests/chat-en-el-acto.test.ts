// =============================================================================
// El chat en el acto (27/10/2026, Martín por el Ops Center, 21:53 a 21:58): el audio y los mensajes salen sin esperar, los
// tres puntos de «escribiendo», el encargo del Cerebro que no es suyo y el «Completado» que dice qué se hizo.
// =============================================================================
// Martín, textual:
//   1. «Acabo de enviar un audio y no se envía y me dijo un unexpected error JSON» · «Apenas envío el audio, en todos los chats
//      de todo MaKo, se debe enviar automáticamente; yo puedo reproducirlo» · «Los procesos siempre se tienen que ejecutar en
//      segundo plano: el usuario debe poder navegar por el resto de la aplicación mientras hay procesos ejecutándose».
//   2. «Exactamente lo mismo pasa cuando adjunto capturas o envío un mensaje: tarda un montón en verse en el chat».
//   3. «la animación de MaKo escribiendo, de los 3 puntos».
//   4. «Yo NO envié ese mensaje confuso y largo» (el encargo con el que el Cerebro abre un chat, con SU foto).
//   5. «Esa tarjeta de completado, la info no me dice nada... No sirve de nada si no sé en qué se trabajó claramente».
// Lo aprendido, en docs/hallazgos-operaciones.md («El chat en el acto»).
//
// Probado rompiéndolo (27/10/2026), una rotura por vez sobre los 9 tests de este archivo; cada una, 1 fallo:
//   · el `r.json()` de antes en transcribirNota → 1a · la caja transcribe antes de entregar la nota → 1b
//   · sin la cola por chat → 2 (el orden) · el fallo sin su porqué → 2 · el hilo sin el reloj → 2 (el hilo)
//   · Trabajando sin la burbuja → 3 · el encargo como de Martín → 4 · el «Ya está» que no cede al cierre de su ronda → 5a
//   · el cierre de CUALQUIER ronda le saca el lugar → 5a (la primera vez no falló: faltaba la ronda de un solo texto)
//   · el cierre plegado como «Avance» → 5a · el cartero sin la ronda → 5b · sin el resumen → 5b · el servidor lo tira → 5b
//   · (27/10 23:07, 5c) el cartero sin anotar lo de fondo · el aviso que no la saca de las vivas (la primera vez no falló: la
//     ronda de después no tenía cierre) · el Completado con fondo vivo · sin «Trabajando» con fondo vivo → 5c · la tarjeta sin
//     el «hecho» del cierre → 5b
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { porQueNoSeTranscribio } from '../app/_components/useDictar';
import { conLoQueSale, descartarEnvio, enviosEnCurso, escucharEnvios, esEnvioLocal, ponerEnCamino, reintentarEnvio, type EnvioLocal } from '../app/admin/operaciones/envios-en-curso';
import { ULTIMOS_TEXTO, esEncargoDeOtraSesion, esParaMartin, resumirTurnos, sanearTurnos, turnosDeLaConversacion, type TurnoChat } from '../lib/operaciones-reglas';
import { chatTrabajando, completadoSinVer, esYaEsta, completadosDelChat, hechoDelCompletado, lineasDeConversacion, nodoDeCompletado, turnosParaOtro, type LineaChat, type TrabajoP } from '../lib/centro-chats';
import { Trabajando } from '../app/admin/operaciones/Trabajando';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const bloque = (src: string, desde: string) => { const i = src.indexOf(desde); assert.ok(i >= 0, `no está ${desde}`); const j = src.indexOf('\n  }\n', i); return src.slice(i, j + 4); };
const LOCAL = 'local_9208f597-8883-41ae-943d-89f9d8040c08';
// El cartero es JS: TypeScript infiere sus turnos como una unión de literales sin `resumen`, `fin` ni `fondo`. El test los lee
// con el tipo que el servidor espera (los mismos campos que valida sanearTurnos).
type TurnoLeido = { uuid: string; rol?: string; inicio?: string; fin?: boolean; resumen?: string; fondo?: boolean; [k: string]: unknown };
type TurnosDeLineas = (lineas: string[]) => { turnos: TurnoLeido[] };

// ── 1 · el «unexpected JSON» del audio ───────────────────────────────────────────────────────────────────────────────

test('1a. lo que corta Vercel no es JSON: la nota dice qué pasó, no el error del parser', () => {
  assert.match(porQueNoSeTranscribio(413, 'Request Entity Too Large'), /muy larga para mandarla de una vez/);
  assert.match(porQueNoSeTranscribio(504, 'An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT'), /tardó más de lo que el servidor espera/);
  assert.match(porQueNoSeTranscribio(200, '<!DOCTYPE html><html><body>Entrar</body></html>'), /Volvió una página/);
  assert.match(porQueNoSeTranscribio(401, ''), /Se cerró tu sesión/);
  assert.match(porQueNoSeTranscribio(502, 'Bad Gateway'), /error 502/);
  const t = leer('app/_components/transcribir-nota.ts');
  const tr = t.slice(t.indexOf('export async function transcribirNota('), t.indexOf('export function porQueNoSeTranscribio('));
  assert.doesNotMatch(tr, /\.then\(\(r\) => r\.json\(\)\)/, 'volvió el r.json() que daba «Unexpected token… is not valid JSON»');
  assert.match(tr, /const crudo = await r\.text\(\);/);
  assert.match(leer('app/api/plan-dictado/route.ts'), /export const maxDuration = 300;/, 'una nota larga se cortaba a los 60 s con un 504 de texto');
});

// ── 1 · la nota sale en el acto, y lo que tarda corre fuera de la caja ─────────────────────────────────────────────

test('1b. con `onGrabada` la caja entrega la nota apenas se grabó, sin transcribir; la transcripción la corre la pantalla', () => {
  const n = leer('app/_chat/nota-que-se-manda.ts');
  const hook = n.slice(n.indexOf('export function useNotaQueSeManda('));
  const iGrabada = hook.indexOf('if (grabada.current) { grabada.current({ audio: blob, segundos: secs }); return; }');
  const iTranscribe = hook.indexOf('setTranscribiendo(true);');
  assert.ok(iGrabada > 0 && iTranscribe > iGrabada, 'la caja transcribe antes de entregar la nota: la nota espera');
  assert.match(leer('app/_chat/preparar-nota.ts'), /export async function prepararNota\(audio: Blob\)/);
  assert.doesNotMatch(leer('app/_chat/preparar-nota.ts'), /^\s*'use client';/m, 'el motor del Ops Center no la puede importar');
  assert.match(leer('app/_chat/CajaChat.tsx'), /onGrabada: p\.onGrabada \}\);/);
  // El Ops Center, en la computadora y en el teléfono, manda la nota por `mandarNota`.
  assert.match(leer('app/admin/operaciones/PiezasCentro.tsx'), /onGrabada=\{\(g\) => k\.mandarNota\(chat, g\.audio, g\.segundos\)\}/);
  assert.match(leer('app/m/operaciones/ChatsMovil.tsx'), /onGrabada=\{\(g\) => centro\?\.mandarNota\(elegido, g\.audio, g\.segundos\)\}/);
});

test('1c/2. `mandar` y `mandarNota` dibujan en el acto: subir, transcribir y firmar van ADENTRO de la tarea de la cola', () => {
  const c = leer('app/admin/operaciones/useCentro.ts');
  const mandar = c.slice(c.indexOf('  function mandar(c: ChatCentro) {'), c.indexOf('  function mandarNota('));
  const iCamino = mandar.indexOf('ponerEnCamino(w, async () => {');
  assert.ok(iCamino > 0, 'mandar ya no pone el mensaje en camino');
  assert.ok(mandar.indexOf('await subirAdjuntos(') > iCamino, 'sube los adjuntos ANTES de dibujar el mensaje');
  assert.ok(mandar.indexOf('await mandarFirmado(') > iCamino, 'firma ANTES de dibujar el mensaje');
  assert.doesNotMatch(mandar, /setEnviando\(true\)/, 'la caja vuelve a quedar trabada mientras sale');
  assert.match(mandar, /verFotosLocales\(id, archivos\);/, 'las capturas no se ven hasta que suben');
  const nota = c.slice(c.indexOf('  function mandarNota('), c.indexOf('  /** Reenviar un mensaje a otros chats'));
  assert.match(nota, /verVozLocal\(id, audio\);/, 'la nota no se escucha en el acto');
  assert.ok(nota.indexOf('await prepararNota(audio)') > nota.indexOf('ponerEnCamino('), 'la nota espera a transcribirse para verse');
});

const local = (id: string, clave = 'c1'): EnvioLocal => ({
  id, destino: LOCAL, destino_titulo: 'CRM', destino_cuenta: 'claude4', created_at: new Date().toISOString(), texto: id,
  estado: 'escrito', motivo: null, cierre: null, local: { fase: 'enviando', clave },
});
const real = (id: string): TrabajoP => ({ id, destino: LOCAL, destino_titulo: 'CRM', destino_cuenta: 'claude4', created_at: new Date().toISOString(), texto: id, estado: 'escrito', motivo: null, cierre: null });
const espera = () => new Promise((r) => setTimeout(r, 5));

test('2. lo que sale: se ve en el acto, sale EN ORDEN por chat, y si falla se reintenta o se descarta', async () => {
  let avisos = 0;
  const soltar = escucharEnvios(() => { avisos += 1; });
  const orden: string[] = [];
  let abrir!: () => void;
  const lento = new Promise<void>((r) => { abrir = r; });
  ponerEnCamino(local('local-a'), async () => { await lento; orden.push('a'); return { ok: true, trabajo: real('w-a') }; });
  ponerEnCamino(local('local-b'), async () => { orden.push('b'); return { ok: true, trabajo: real('w-b') }; });
  // En el acto, los dos, con su reloj, antes de que ninguno salga.
  assert.deepEqual(enviosEnCurso().filter(esEnvioLocal).map((w) => w.id).sort(), ['local-a', 'local-b']);
  assert.ok(avisos >= 2);
  await espera();
  assert.deepEqual(orden, [], 'el segundo salió antes que el primero del mismo chat');
  abrir();
  await espera(); await espera();
  assert.deepEqual(orden, ['a', 'b']);
  // Ya salidos: quedan como el trabajo de verdad hasta que la cola del servidor los trae, y ahí manda el del servidor.
  assert.deepEqual(enviosEnCurso().map((w) => w.id).filter((x) => x.startsWith('w-')).sort(), ['w-a', 'w-b']);
  assert.deepEqual(conLoQueSale([real('w-a')], enviosEnCurso()).filter((w) => w.id === 'w-a').length, 1, 'el mismo mensaje dos veces');

  let intentos = 0;
  ponerEnCamino(local('local-c', 'c2'), async () => { intentos += 1; return intentos === 1 ? { ok: false, error: 'No hay conexión' } : { ok: true, trabajo: real('w-c') }; });
  await espera();
  const fallo = enviosEnCurso().find((w) => w.id === 'local-c');
  assert.ok(fallo && esEnvioLocal(fallo) && fallo.local.fase === 'fallo' && fallo.local.error === 'No hay conexión', 'el fallo no dice qué falló');
  reintentarEnvio('local-c');
  await espera(); await espera();
  assert.ok(enviosEnCurso().some((w) => w.id === 'w-c'), 'Reintentar no lo volvió a mandar');

  ponerEnCamino(local('local-d', 'c3'), async () => ({ ok: false, error: 'x' }));
  await espera();
  descartarEnvio('local-d');
  assert.ok(!enviosEnCurso().some((w) => w.id === 'local-d'));
  soltar();
});

test('2. el hilo dibuja lo que sale con el reloj, sin el «Enviado → La PC lo recibió», y el fallo con Reintentar', () => {
  const h = leer('app/admin/operaciones/Hilo.tsx');
  assert.match(h, /\{w\.local \? <TickLocal local=\{w\.local\} \/> : <Tick estado=\{estado\} \/>\}/);
  assert.match(h, /const va = vivo && !w\.local \? estadoDelEnvio\(/);
  assert.match(h, /onClick=\{\(\) => reintentarEnvio\(w\.id\)\}>Reintentar<\/button>/);
});

// ── 3 · los tres puntos de «escribiendo» ───────────────────────────────────────────────────────────────────────────

test('3. «Trabajando» es la burbuja de escribiendo, con sus tres puntos, para todos los chats', () => {
  const html = renderToStaticMarkup(createElement(Trabajando, { titulo: 'CRM' }));
  assert.match(html, /<span class="co-escribiendo" aria-hidden="true"><span class="co-trabajando__puntos" aria-hidden="true"><i><\/i><i><\/i><i><\/i><\/span><\/span>/, 'sin la burbuja de los tres puntos');
  assert.match(html, /class="co-trabajando__texto co-oculto">Trabajando</, 'el lector de pantalla no oye que está trabajando');
  assert.match(leer('app/admin/operaciones/centro.css'), /@keyframes co-salta/);
});

// ── 4 · el encargo del Cerebro no es de Martín ─────────────────────────────────────────────────────────────────────

const ENCARGO = 'Background (from the session that started this one):\nMaKo es la app de Martín.\n\nTask:\nSos el chat «CRM y Chats». Cerrá la rama.';

test('4. el encargo de otra sesión se guarda como del Cerebro, plegado, y nunca con la foto de Martín', () => {
  assert.equal(esEncargoDeOtraSesion(ENCARGO), true);
  assert.equal(esEncargoDeOtraSesion('Hacé esto: Background (from the session…'), false);
  const [t] = sanearTurnos([{ local: LOCAL, uuid: 'u-encargo-01', rol: 'yo', texto: ENCARGO, at: '2026-10-27T23:50:00Z' }]);
  assert.equal(t.rol, 'otro', 'el encargo volvió a ser de Martín');
  assert.equal(t.de, 'Cerebro');
  assert.equal(t.encargo, true);
  assert.equal(esParaMartin(t), true, 'el encargo no se ve');
  const l: LineaChat = { tipo: 'turno', instante: Date.parse(t.at), turno: t };
  assert.equal(lineasDeConversacion([l]).length, 1);
  // Uno de Martín que escribió a mano sigue siendo suyo; un `otro` cualquiera sigue sin dibujarse.
  const [suyo] = sanearTurnos([{ local: LOCAL, uuid: 'u-yo-00000001', rol: 'yo', texto: 'Seguí con la tienda', at: '2026-10-27T23:51:00Z' }]);
  assert.equal(suyo.rol, 'yo');
  assert.equal(esParaMartin({ rol: 'otro', texto: 'READY' }), false);
  const h = leer('app/admin/operaciones/Hilo.tsx');
  const rama = h.slice(h.indexOf('  if (t.encargo) {'), h.indexOf('  return (\n    <FilaMia m={m} marcas={wa.marcas} foto={t.rol === \'yo\''));
  assert.match(rama, /<EncargoPlegado texto=\{t\.texto\} \/>/);
  assert.match(rama, /co-mifoto--otro/, 'el encargo lleva la foto de Martín');
  assert.match(h, /<span className="co-burbuja__cita">Encargo del Cerebro<\/span>/);
});

// ── 5 · el «Completado» dice qué se hizo ───────────────────────────────────────────────────────────────────────────

const turno = (uuid: string, rol: TurnoChat['rol'], texto: string, at: string, de: string | null = null, ronda: { inicio?: string; fin?: true } = {}): LineaChat =>
  ({ tipo: 'turno', instante: Date.parse(at), turno: { local: LOCAL, uuid, rol, de, texto, at, trabajo: null, ...ronda } });

test('5a. el caso del CRM (26/10): con las rondas del cartero 1.21.0, el Completado es el CIERRE, no el «Ya está probado…» de a mitad', () => {
  // Los turnos de verdad del chat CRM (app_settings `operaciones.turnos.<local>`, leídos el 27/10), con las marcas de ronda que
  // les pone el cartero 1.21.0: el de las 13:59 abrió su ronda (después de un aviso de tarea) y el de las 14:01 la cerró.
  const conRondas = [
    turno('t-cerebro-1', 'otro', 'Otro pedido de Martín para «Extraer»…', '2026-10-26T16:51:45Z', 'Cerebro'),
    turno('t-el-00001', 'el', 'Pedido nuevo: al terminar, volver a la pestaña EXACTA…', '2026-10-26T16:52:08Z', null, { inicio: 't-el-00001' }),
    turno('t-el-00002', 'el', 'Tengo dos CRM (87 y 88) y otra pestaña de MaKo…', '2026-10-26T16:55:18Z', null, { inicio: 't-el-00001', fin: true }),
    turno('t-el-00003', 'el', 'Ya está probado: con el código roto a propósito, el test falla… Ahora dejo escrito lo aprendido en los documentos del repo.', '2026-10-26T16:59:41Z', null, { inicio: 't-el-00003' }),
    turno('t-el-00004', 'el', '**Punta: ca01d4c82** en la rama `crm-extraer-2610`, sin pushear.', '2026-10-26T17:01:53Z', null, { inicio: 't-el-00003', fin: true }),
  ];
  assert.equal(completadoSinVer(conRondas, null)?.uuid, 't-el-00004', 'el Completado vuelve a ser el renglón suelto de las 13:59');
  const paraOtro = turnosParaOtro(conRondas);
  assert.equal(paraOtro.has('t-el-00004'), false, 'el cierre de verdad quedó plegado como «Avance»');
  assert.equal(paraOtro.has('t-el-00003'), true, 'el renglón de a mitad no se pliega con lo demás');
  // Su título es su primer renglón (no empieza con «Ya está»), y la tarjeta tiene de dónde sacarlo.
  assert.match(nodoDeCompletado((conRondas[4] as Extract<LineaChat, { tipo: 'turno' }>).turno, conRondas[4].instante).titulo, /Punta: ca01d4c82/);
  // ⚠️ Lo que el chat escribe en OTRA ronda no le saca el lugar a un «Ya está» que cerró la suya (la regla del 18/10: espera
  // su ✓ aunque el chat haya escrito después).
  const cerrado = [
    turno('t-el-00010', 'el', 'Ya está: el filtro del CRM', '2026-10-26T10:05:00Z', null, { inicio: 't-el-00009', fin: true }),
    turno('t-el-00011', 'el', 'Recibido, sigo con lo de la tienda.', '2026-10-26T10:09:00Z', null, { inicio: 't-el-00011' }),
    turno('t-el-00012', 'el', 'La tienda quedó lista.', '2026-10-26T10:15:00Z', null, { inicio: 't-el-00011', fin: true }),
  ];
  assert.equal(completadoSinVer(cerrado, null)?.uuid, 't-el-00010', 'otra ronda le sacó el lugar al «Ya está»');
  // Una ronda de un solo texto (el «Ya está» la abre y la cierra: el cartero no sube un cierre aparte) tampoco cede.
  const deUnTexto = [
    turno('t-el-00020', 'el', 'Ya está: el filtro del CRM', '2026-10-26T10:05:00Z', null, { inicio: 't-el-00020' }),
    turno('t-el-00021', 'el', 'Recibido, sigo con lo de la tienda.', '2026-10-26T10:09:00Z', null, { inicio: 't-el-00021' }),
    turno('t-el-00022', 'el', 'La tienda quedó lista.', '2026-10-26T10:15:00Z', null, { inicio: 't-el-00021', fin: true }),
  ];
  assert.equal(completadoSinVer(deUnTexto, null)?.uuid, 't-el-00020', 'el cierre de OTRA ronda le sacó el lugar al «Ya está»');
  // Sin las marcas (lo que subió un cartero de antes), como siempre: el «Ya está».
  const sinRondas = conRondas.map((l) => (l.tipo === 'turno' ? { ...l, turno: { ...l.turno, inicio: undefined, fin: undefined } } : l));
  assert.equal(completadoSinVer(sinRondas, null)?.uuid, 't-el-00003');
  assert.deepEqual(completadosDelChat(sinRondas).map((x) => x.turno.uuid), ['t-el-00003']);
});

test('5b. el cartero 1.21.0 sube el resumen del wrap_up con el cierre, y el servidor lo guarda', async () => {
  const c = await import('../scripts/operaciones/cartero.mjs');
  assert.equal(c.VERSION, '1.26.1'); // 1.26.1: la revisión del servicio (tests/cartero-servicio.test.ts); 1.26.0: lo que espera un chat cerrado le llega al Cerebro (tests/limbo-al-cerebro.test.ts); 1.25.0: el servicio de la PC; 1.24.0: el pedido delegado desde el grupo (tests/tickets-al-cerebro.test.ts); 1.23.0: los tickets que esperan a Martín le llegan al Cerebro (tests/tickets-al-cerebro.test.ts); 1.22.1: el pedido dice cómo se escribe el cierre (sin jerga, con viñetas); 1.22.0: los adjuntos del chat nuevo (tests/centro-nuevo-con-adjuntos.test.ts)
  const at = (m: number) => `2026-10-27T21:${String(m).padStart(2, '0')}:00Z`;
  const yo = JSON.stringify({ type: 'user', uuid: 'u-yo-1', timestamp: at(0), message: { role: 'user', content: 'Arreglá el CRM' } });
  const txt = (uuid: string, m: number, t: string) => JSON.stringify({ type: 'assistant', uuid, timestamp: at(m), message: { role: 'assistant', content: [{ type: 'text', text: t }] } });
  const wrap = JSON.stringify({ type: 'assistant', uuid: 'u-wrapup-01', timestamp: at(8), message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_w1', name: 'mcp__ccd_turn__wrap_up', input: { recap: 'Arreglé el CRM: ya no se rompe con un link viejo.' } }] } });
  const fin = JSON.stringify({ type: 'system', subtype: 'stop_hook_summary', uuid: 'fin-1', timestamp: at(10) });
  const r = (c.turnosDeLineas as TurnosDeLineas)([yo, txt('u-el-voy-01', 1, 'Voy a mirar el CRM.'), wrap, txt('u-el-cierre-2', 9, 'Le pasé la punta al Cerebro.'), fin]);
  const cierre = r.turnos.find((t: { uuid: string }) => t.uuid === 'u-el-cierre-2');
  assert.equal(cierre?.resumen, 'Arreglé el CRM: ya no se rompe con un link viejo.', 'el resumen del wrap_up se pierde cuando el cierre viene después');
  // Y las marcas de ronda: el primero la abre, el cierre la cierra (lib/centro-chats.ts → completadosDelChat).
  const primero = r.turnos.find((t: { uuid: string }) => t.uuid === 'u-el-voy-01');
  assert.equal(primero?.inicio, 'u-el-voy-01', 'el primer texto no dice qué ronda abre');
  assert.equal(cierre?.inicio, 'u-el-voy-01');
  assert.equal(cierre?.fin, true, 'el cierre no dice que cierra');
  // El wrap_up como último mensaje ya trae el resumen en su texto: no se repite.
  const r2 = (c.turnosDeLineas as TurnosDeLineas)([yo, txt('u-el-voy-01', 1, 'Voy a mirar el CRM.'), wrap, fin]);
  assert.equal(r2.turnos.find((t: { uuid: string }) => t.uuid === 'u-wrapup-01')?.resumen, undefined);
  const [guardado] = sanearTurnos([{ ...cierre, local: LOCAL }]);
  assert.equal(guardado.resumen, 'Arreglé el CRM: ya no se rompe con un link viejo.', 'el servidor tira el resumen');
  assert.equal(guardado.inicio, 'u-el-voy-01', 'el servidor tira la ronda');
  assert.equal(guardado.fin, true);
  const [deMartin] = sanearTurnos([{ local: LOCAL, uuid: 'u-yo-00000002', rol: 'yo', texto: 'hola', at: at(0), resumen: 'x' }]);
  assert.equal(deMartin.resumen, undefined, 'un turno de Martín no lleva resumen');
  const b = leer('app/admin/operaciones/BloqueCompletado.tsx');
  assert.match(bloque(b, 'function Respuesta({ t, hecho }: { t: TurnoChat; hecho?: string | null }) {'), /const terminado = t\.resumen \|\| hecho;\n\s*if \(terminado\) \{/, 'el Completado no muestra el resumen');
});

// ── 5c · con trabajo de fondo vivo no hay «Completado» (Martín, 27/10 23:07) ─────────────────────────────────────────
// «No me pongas "cosas en marcha" ni nada de eso en el mensaje de COMPLETADO, literalmente pierde su funcionalidad... El cuadro
// de COMPLETADO debe ser dopamínico: se completó una funcionalidad, se debuggeó A, B, C». Su captura: un COMPLETADO del
// Cerebro con «Hay cuatro cosas en marcha: …» debajo de un «Trabajando ••• Workflow».

test('5c. un turno que termina con trabajo de fondo vivo no es Completado: sigue «Trabajando»; la tarjeta dice lo terminado', async () => {
  const c = await import('../scripts/operaciones/cartero.mjs');
  const at = (m: number) => `2026-10-27T23:${String(m).padStart(2, '0')}:00Z`;
  const yo = JSON.stringify({ type: 'user', uuid: 'u-yo-fondo-1', timestamp: at(0), message: { role: 'user', content: 'Corré los tests' } });
  const txt = (uuid: string, m: number, t: string) => JSON.stringify({ type: 'assistant', uuid, timestamp: at(m), message: { role: 'assistant', content: [{ type: 'text', text: t }] } });
  const lanzo = JSON.stringify({ type: 'user', uuid: 'u-res-fondo-1', timestamp: at(2), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_x', content: 'Command running in background with ID: bgx123456. Output is being written to: C:/x.output' }] } });
  const fin = (m: number) => JSON.stringify({ type: 'system', subtype: 'stop_hook_summary', uuid: `fin-${m}`, timestamp: at(m) });
  const aviso = JSON.stringify({ type: 'user', uuid: 'u-aviso-fondo', timestamp: at(20), message: { role: 'user', content: '<task-notification>\n<task-id>bgx123456</task-id>\n<status>completed</status>\n</task-notification>' } });
  const r = (c.turnosDeLineas as TurnosDeLineas)([yo, txt('u-el-fondo-01', 1, 'Voy a correr los tests.'), lanzo, txt('u-el-fondo-02', 3, 'Ya está: los tests corren por detrás.'), fin(4),
    aviso, txt('u-el-fondo-03', 21, 'Miro cómo salieron.'), txt('u-el-fondo-04', 22, 'Ya está: los tests dieron verde.'), fin(23)]);
  const cierre = r.turnos.find((t: { uuid: string }) => t.uuid === 'u-el-fondo-02');
  assert.equal(cierre?.fondo, true, 'el turno que terminó con la tarea de fondo viva no lo dice');
  const despues = r.turnos.find((t: { uuid: string }) => t.uuid === 'u-el-fondo-04');
  assert.ok(despues, 'la ronda de después no cerró');
  assert.equal(despues?.fondo, undefined, 'el aviso de que terminó no la saca de las vivas');
  // El servidor la guarda, y el Centro: el de las 23:03 no es Completado (sigue «Trabajando»); el de las 23:22, sí.
  const guardados = sanearTurnos(r.turnos.map((t: object) => ({ ...t, local: LOCAL })));
  const lineas: LineaChat[] = guardados.map((t) => ({ tipo: 'turno', instante: Date.parse(t.at), turno: t }));
  assert.equal(guardados.find((t) => t.uuid === 'u-el-fondo-02')?.fondo, true, 'el servidor tira `fondo`');
  assert.deepEqual(completadosDelChat(lineas).map((x) => x.turno.uuid), ['u-el-fondo-04'], 'un turno con trabajo de fondo vivo se dibuja como Completado');
  const hastaElFondo = lineas.filter((l) => l.instante <= Date.parse(at(3)));
  assert.equal(chatTrabajando({ estado: 'quieto' as never, viejo: false }, hastaElFondo, Date.parse(at(10))), true, 'con trabajo de fondo vivo el chat no dice «Trabajando»');
  assert.equal(completadoSinVer(hastaElFondo, null), null);
  // Lo terminado, sin resumen: el «hecho» del cierre de su trabajo.
  const trabajo: LineaChat = { tipo: 'trabajo', instante: Date.parse(at(0)), trabajo: { id: 'w-1', destino: LOCAL, destino_titulo: 'Prueba', destino_cuenta: 'claude4', created_at: at(0), texto: 'Corré los tests', estado: 'hecho', motivo: null, cerrado_at: at(21),
    cierre: { decidido: '', hecho: 'Se arregló A, se debuggeó B y quedó C.', comprobado: '', sigue: '', prueba: null } } };
  assert.equal(hechoDelCompletado([trabajo, ...lineas], { at: at(21) }), 'Se arregló A, se debuggeó B y quedó C.');
  assert.match(leer('app/admin/operaciones/BloqueCompletado.tsx'), /<Respuesta key=\{t\.uuid\} t=\{t\} hecho=\{hechoDelCompletado\(lineas, t\)\} \/>/);
});

// ── 6 · la revisión de 928bdde0d (Cerebro, 27/10): C:/dev/revisiones/2710-chat-en-el-acto-928bdde0d.md ──────────────────

test('6a. la fila, la API y el chat abierto eligen el MISMO Completado aunque el chat escriba 3 cosas después del cierre', () => {
  const at = (m: number) => `2026-10-28T00:${String(m).padStart(2, '0')}:00Z`;
  const el = (uuid: string, m: number, texto: string, ronda: Partial<TurnoChat> = {}): TurnoChat => ({ local: LOCAL, uuid, rol: 'el', de: null, texto, at: at(m), trabajo: null, ...ronda });
  const turnos: TurnoChat[] = [
    el('t-ya-000001', 1, 'Ya está probado: el test falla al romperlo. Ahora dejo escrito lo aprendido.', { inicio: 't-ya-000001' }),
    el('t-fin-00001', 3, '**Punta: 1234567** en la rama `x`.', { inicio: 't-ya-000001', fin: true, resumen: 'Arreglé A, B y C. '.repeat(40) }),
    el('t-otro-0001', 5, 'Recibido, sigo con lo otro.', { inicio: 't-otro-0001' }),
    el('t-otro-0002', 6, 'Miro el log.', { inicio: 't-otro-0002' }),
    el('t-otro-0003', 7, 'Sigo.', { inicio: 't-otro-0003' }),
  ];
  const lineas = (ts: readonly TurnoChat[]): LineaChat[] => ts.map((t) => ({ tipo: 'turno', instante: Date.parse(t.at), turno: t }));
  const completo = completadoSinVer(lineas(turnos), null)?.uuid;
  assert.equal(completo, 't-fin-00001');
  const fila = resumirTurnos(turnos, Date.parse(at(10)), esYaEsta);
  assert.equal(completadoSinVer(lineas(fila), null)?.uuid, completo, 'la fila (y la API) pierden el Completado: el cierre de la ronda no viaja');
  assert.ok((fila.find((t) => t.uuid === 't-fin-00001')?.resumen ?? '').length <= ULTIMOS_TEXTO, 'el resumen viaja entero en cada refresco');
  // El chat abierto, con más turnos que los que guarda la conversación.
  const muchos = [...turnos, ...Array.from({ length: 70 }, (_, i) => el(`t-mas-${String(i).padStart(5, '0')}`, 11 + i % 40, 'Sigo trabajando.', { inicio: `t-mas-${i}` }))];
  assert.equal(completadoSinVer(lineas(turnosDeLaConversacion(muchos, esYaEsta)), null)?.uuid, completo, 'el chat abierto no trae el cierre de la ronda');
});

test('6b. lo escrito vuelve a la caja si el envío no quedó firmado (recarga o falla); y Reintentar una nota no la vuelve a transcribir', () => {
  const c = leer('app/admin/operaciones/useCentro.ts');
  const mandar = c.slice(c.indexOf('  function mandar(c: ChatCentro) {'), c.indexOf('  function mandarNota('));
  assert.doesNotMatch(mandar, /limpiarBorrador\(c\.clave\)/, 'el borrador guardado se borra ANTES de saber que salió');
  assert.match(mandar, /const salio = vaciarCajaHastaQueSalga\(c\.clave\);/);
  assert.ok(mandar.indexOf('salio();') > mandar.indexOf('if (!r.ok) return r;'), 'el borrador guardado se borra aunque no salga');
  assert.match(c, /return \(\) => \{ if \(\(editado\.current\[clave\] \?\? 0\) <= desde\) limpiarBorrador\(clave\); \};/, 'pisa lo que se escribió después');
  const nota = c.slice(c.indexOf('  function mandarNota('), c.indexOf('  /** Reenviar un mensaje a otros chats'));
  assert.match(nota, /if \(!preparada\) \{\n\s*const p = await prepararNota\(audio\);/, 'Reintentar vuelve a transcribir');
});
