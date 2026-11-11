// =============================================================================
// MaKo SIEMPRE responde en su grupo de WhatsApp (11/11/2026)
// =============================================================================
// Martín, 10/11/2026, desde su teléfono: «Mako en WhatsApp no responde... SIEMPRE debe responder, haz un relevo de eso para que no
// ocurra más». El freno de la línea (lib/linea-freno.ts, 4/11) callaba TODO lo que escribe la línea de MaKo: un 403 de UN chat la
// dejaba muda 6 horas en todos los grupos, también para contestarle a quien acababa de escribir. Y la respuesta que WhatsApp no tomaba
// se guardaba igual como dicha: el vigía no veía el silencio y nadie se enteraba.
//
// Corre REAL la salida de la línea (tests/_mako-responde-siempre-hijo.ts: PostgREST de mentira y Evolution en memoria) y ejecuta las
// reglas puras (lib/mako-salida-reglas.ts).
//
// Probado ROMPIÉNDOLO (11/11/2026), de a una, sobre 12 que pasan:
//   · `antesDeEscribir` sin la excepción de la respuesta (el freno calla todo, como antes)                → 4 fallos
//   · `ev` sin pasar el destino                                                                           → 5 fallos
//   · `esRespuestaEnCurso` sin comparar el grupo                                                          → 2 fallos
//   · `respondiendoA` con el turno solo, sin la puerta de la respuesta (un aviso del turno pasaba)        → 2 fallos
//   · `frenoSiguiente` sin escalar (una señal más grave durante el freno se tiraba)                       → 3 fallos
//   · `enviarTextoVozMaKo` con el tope del mismo texto también para la respuesta                          → 1 fallo
//   · `manejarEntranteDoer` / `manejarEntranteDeLaApp` sin abrir `conRespuestaA`                          → 1 fallo cada uno
//   · el «escribiendo…» sin la puerta, o `evFetch` sin el destino                                         → 1 fallo cada uno
//   · `siNoLlego` sin mirar, o la salida del DEBUG sin llamarla                                           → 1 fallo cada uno
//   · `motivoDeNoEntrega` crudo, o sin reconocer «Evolution 503: …» (un 503 o un timeout son «ruido»)     → 1 fallo cada uno
// Restaurado: 12 pasan. Y un cambio sin efecto (renombrar `noLlego`, `envios` o `jid`) lo deja verde: el cableado se busca por la forma.
//
// Correr: node --import tsx --test tests/mako-responde-siempre.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { destinoDeEscritura, esRespuestaEnCurso, frenoSiguiente, motivoDeNoEntrega, respuestaNoEntregada, textoDelFreno, nuevoFreno } from '../lib/mako-salida-reglas';
import { comoRespuesta, conRespuestaA, respondiendoA } from '../lib/respuesta-en-curso';
import { esRuido } from '../lib/errores-app-reglas';

const RAIZ = join(import.meta.dirname, '..');
const GRUPO = 'grupo-del-dueno@g.us';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let R: Record<string, any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const real = (): Record<string, any> => {
  if (R) return R;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_mako-responde-siempre-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 240_000,
  });
  R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length));
  return R!;
};

const sinComentarios = (src: string): string => src.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (ruta: string): string => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));
/** El cuerpo de una función, desde su firma hasta la siguiente declaración de nivel superior. */
const cuerpo = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.slice(i + firma.length).search(/\n(?:export )?(?:async )?function |\nconst |\nexport const /);
  return src.slice(i, fin < 0 ? undefined : i + firma.length + fin);
};

// ── Lo puro ──────────────────────────────────────────────────────────────────

test('la respuesta es sólo al MISMO grupo donde escribió una persona, y sólo mandar', () => {
  for (const ruta of ['/message/sendText/mako_ws9', '/message/sendMedia/mako_ws9', '/message/sendWhatsAppAudio/mako_ws9', '/message/sendReaction/mako_ws9', '/chat/sendPresence/mako_ws9']) {
    assert.equal(esRespuestaEnCurso(ruta, GRUPO, GRUPO), true, ruta);
  }
  assert.equal(esRespuestaEnCurso('/message/sendText/mako_ws9', 'otro@g.us', GRUPO), false, 'otro grupo no');
  assert.equal(esRespuestaEnCurso('/message/sendText/mako_ws9', GRUPO, null), false, 'sin turno abierto no');
  assert.equal(esRespuestaEnCurso('/group/updateParticipant/mako_ws9?groupJid=x', GRUPO, GRUPO), false, 'sumar gente no es contestar');
  assert.equal(esRespuestaEnCurso('/group/sendInvite/mako_ws9', GRUPO, GRUPO), false);
  assert.equal(esRespuestaEnCurso('/message/sendText/mako_ws9', '5491100000000@s.whatsapp.net', '5491100000000@s.whatsapp.net'), false, 'un chat 1 a 1 no');
  assert.equal(esRespuestaEnCurso('/message/sendText/mako_ws9', null, GRUPO), false, 'sin destino no');
});

test('el destino se lee del cuerpo: el texto, la reacción y marcar leído', () => {
  assert.equal(destinoDeEscritura(JSON.stringify({ number: GRUPO, text: 'hola' })), GRUPO);
  assert.equal(destinoDeEscritura({ key: { remoteJid: GRUPO, id: 'x' }, reaction: '👍' }), GRUPO);
  assert.equal(destinoDeEscritura({ readMessages: [{ remoteJid: GRUPO, id: 'x' }] }), GRUPO);
  assert.equal(destinoDeEscritura('no es json'), null);
  assert.equal(destinoDeEscritura(undefined), null);
});

test('el contexto: hace falta el turno Y la puerta de la respuesta; un chat 1 a 1 no lo abre', async () => {
  assert.equal(respondiendoA(), null);
  assert.equal(await conRespuestaA(GRUPO, async () => { await new Promise((r) => setTimeout(r, 1)); return comoRespuesta(() => respondiendoA()); }), GRUPO);
  assert.equal(conRespuestaA(GRUPO, () => respondiendoA()), null, 'el turno solo no: un aviso que dispara el turno no es la respuesta');
  assert.equal(comoRespuesta(() => respondiendoA()), null, 'la puerta sola, fuera de un turno, tampoco');
  assert.equal(conRespuestaA('5491100000000@s.whatsapp.net', () => comoRespuesta(() => respondiendoA())), null);
  assert.equal(respondiendoA(), null);
});

test('con la línea ya frenada, una señal que dura más reemplaza al freno, y el mail sale sólo si cambió el tipo', () => {
  const t0 = Date.parse('2026-11-10T12:00:00Z');
  const rate = nuevoFreno({ tipo: 'rate', pausaMin: 30 }, '/message/sendText/x', t0);
  const bloqueo = nuevoFreno({ tipo: 'bloqueo', pausaMin: 360 }, '/message/sendText/x', t0);
  const restringida = nuevoFreno({ tipo: 'restringida', pausaMin: 1440 }, '/message/sendText/x', t0 + 60_000);
  assert.deepEqual(frenoSiguiente(null, rate), { guardar: true, avisar: true });
  assert.deepEqual(frenoSiguiente(rate, restringida), { guardar: true, avisar: true }, 'un 463 durante un «rate» sube a 24 h y avisa');
  assert.deepEqual(frenoSiguiente(bloqueo, nuevoFreno({ tipo: 'bloqueo', pausaMin: 360 }, '/message/sendText/x', t0 + 60_000)), { guardar: true, avisar: false }, 'la misma señal lo extiende sin otro mail');
  assert.deepEqual(frenoSiguiente(restringida, nuevoFreno({ tipo: 'rate', pausaMin: 30 }, '/message/sendText/x', t0 + 120_000)), { guardar: false, avisar: false }, 'una que dura menos no toca nada');
});

test('una respuesta que no llegó a WhatsApp se detecta, y una del hilo de la app no cuenta como perdida', () => {
  assert.equal(respuestaNoEntregada([{ ok: true }, { ok: true }]), null);
  assert.equal(respuestaNoEntregada([{ ok: true, enApp: true }]), null, 'un turno de la app no va a WhatsApp');
  assert.equal(respuestaNoEntregada([]), null);
  assert.deepEqual(respuestaNoEntregada([{ ok: true, enApp: true, noEntregado: 'Evolution 500' }]), { faltan: 1, de: 1, motivo: 'Evolution 500' });
  assert.deepEqual(respuestaNoEntregada([{ ok: true }, { ok: false, error: 'Evolution 403' }]), { faltan: 1, de: 2, motivo: 'Evolution 403' });
});

test('el motivo del ticket: sin hora ni número de línea, y nunca como «ruido» (un 503 o un timeout son justo cuando MaKo quedó mudo)', () => {
  const freno = textoDelFreno(nuevoFreno({ tipo: 'bloqueo', pausaMin: 360 }, '/message/sendText/mako_ws9'));
  assert.equal(motivoDeNoEntrega(freno), 'la línea estaba frenada (WhatsApp rechazó un mensaje de esta línea)');
  for (const m of ['Evolution 503', 'Evolution 503: Service Unavailable', 'Evolution 429', 'The operation was aborted due to timeout', 'fetch failed', freno, 'Evolution 500', 'Evolution 403']) {
    const mensaje = `MaKo contestó y no llegó a WhatsApp: ${motivoDeNoEntrega(m)}`;
    assert.equal(esRuido({ nombre: 'contestar en WhatsApp', mensaje }), false, `«${m}» → «${mensaje}» se tiraría como ruido`);
    assert.doesNotMatch(mensaje, /\d\d:\d\d|mako_ws/, 'sin la hora ni la línea');
  }
});

// ── Lo real: la salida de la línea de MaKo ───────────────────────────────────

test('con la línea frenada, un aviso no sale y dice por qué; la respuesta y el 👍 al grupo donde escribieron, sí', () => {
  const r = real();
  assert.equal(r.avisoFrenado.res.ok, false);
  assert.deepEqual(r.avisoFrenado.llegaron, []);
  assert.match(r.avisoFrenado.res.error, /^WhatsApp rechazó un mensaje de esta línea\. Frené los envíos hasta las \d\d:\d\d UTC\.$/, 'el motivo es el del freno, no «no se pudo enviar»');
  assert.equal(r.respuesta.res.ok, true);
  assert.equal(r.respuesta.reaccion, true);
  assert.deepEqual(r.respuesta.llegaron, [`message/sendText → ${GRUPO}`, `message/sendReaction → ${GRUPO}`]);
});

test('con la línea frenada, durante el turno nada sale a OTRO grupo, un aviso al mismo grupo tampoco, y sin turno tampoco el 👍', () => {
  const r = real();
  assert.equal(r.aOtroGrupo.res.ok, false);
  assert.deepEqual(r.aOtroGrupo.llegaron, []);
  assert.equal(r.avisoEnElTurno.res.ok, false, 'el aviso de un flujo que corre en el turno no es la respuesta');
  assert.deepEqual(r.avisoEnElTurno.llegaron, []);
  assert.equal(r.reaccionSinTurno.res, false);
  assert.deepEqual(r.reaccionSinTurno.llegaron, []);
});

test('el mismo cartel le contesta a siete grupos (el tope de «el mismo texto a muchos» es para los avisos)', () => {
  const r = real();
  assert.deepEqual(r.mismoCartel.resultados, [true, true, true, true, true, true, true]);
  assert.equal(r.mismoCartel.salieron, 7);
});

test('un 403 a la respuesta frena la línea y avisa una vez; la respuesta siguiente lo vuelve a intentar, un aviso no', () => {
  const t = real().tras403;
  assert.equal(JSON.parse(t.freno).tipo, 'bloqueo');
  assert.equal(t.mails, 1);
  assert.deepEqual(t.intentos, [GRUPO, GRUPO], 'las dos respuestas le hablaron a WhatsApp; el aviso, no');
  assert.equal(t.aviso.ok, false);
});

test('con la línea frenada por un 403, un 463 a la respuesta sube el freno a 24 h y avisa; otro 463 no vuelve a avisar', () => {
  const t = real().tras463;
  assert.equal(JSON.parse(t.freno).tipo, 'restringida');
  assert.ok(Date.parse(JSON.parse(t.freno).hasta) - Date.now() > 20 * 3600_000, 'ahora dura 24 h');
  assert.equal(t.mails, 1);
  assert.equal(JSON.parse(t.frenoDespues).tipo, 'restringida');
});

// ── El cableado: quién abre el turno y quién mira lo que no llegó ────────────

test('las dos entradas del turno abren el contexto, `ev` pasa el destino, y el doer mira lo que no llegó antes de guardarlo', () => {
  const doer = fuente('lib/mako-doer-in.ts');
  assert.match(cuerpo(doer, 'export async function manejarEntranteDoer('), /conRespuestaA\(\w+,/, 'el webhook abre el turno');
  assert.match(cuerpo(doer, 'export async function flushHuerfanos('), /conRespuestaA\(\w+,/, 'el cron que levanta lo que quedó sin contestar, también');
  assert.match(cuerpo(doer, 'export async function manejarEntranteDeLaApp('), /conRespuestaA\(\w+,/, 'y el turno de la app, que comparte la cola');
  // Las puertas de la respuesta: el texto, el 👍 y el «escribiendo…» de un grupo salen marcados como la respuesta.
  assert.match(cuerpo(doer, 'async function enviarAGrupoJid('), /comoRespuesta\(\(\) => enviarAlGrupoPorJid\(/);
  assert.match(doer, /comoRespuesta\(\(\) => reaccionarEnElGrupo\(/);
  assert.match(cuerpo(doer, 'function escribiendo('), /comoRespuesta\(\(\) => enviarPresencia\(/);
  const grupo = fuente('lib/mako-grupo.ts');
  assert.match(cuerpo(grupo, 'async function ev('), /antesDeEscribir\(\w+, \(\) => destinoDeEscritura\(\w+\?\.body\)\)/);
  assert.match(cuerpo(fuente('lib/evolution.ts'), 'async function evFetch<'), /antesDeEscribir\(\w+, \(\) => destinoDeEscritura\(\w+\?\.body\)\)/, 'el «escribiendo…» sale por evFetch');
  const ayuda = cuerpo(doer, 'async function siNoLlego(');
  assert.match(ayuda, /respuestaNoEntregada\(\w+\)/, 'mira lo que no llegó');
  assert.match(ayuda, /registrarError\(\{ origen: 'mako', nombre, etiqueta,/, 'y abre su ticket');
  assert.equal((doer.match(/await siNoLlego\(/g) ?? []).length, 3, 'las tres salidas del turno: la respuesta, el TICKET y el DEBUG');
  assert.match(doer, /&& (\w+)\.some\(\((\w+)\) => \2\.ok\)\) await guardarTurno\(\w+, \w+, 'assistant'/, 'lo que no salió por ningún lado no se guarda como dicho');
});
