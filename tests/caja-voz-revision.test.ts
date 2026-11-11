// =============================================================================
// Lo que encontró la revisión de caja-voz, arreglado (20/10/2026)
// =============================================================================
// La revisión adversarial de la rama caja-voz (af92c1549, cartero 1.17.2) frenó la subida con tres importantes y varios
// menores (notas compartidas, revision-caja-voz-20-10.md). Lo que se fija:
//   1. una pregunta de wrap_up queda SUPERADA cuando el chat siguió sin el formulario: un turno de Martín u otro chat
//      posterior (contestó en la app, en la caja o por Remote Control), o un wrap_up más nuevo. No cuenta como abierta, no
//      se contesta, y el formulario no se toca. Las de `preguntar` no se tocan;
//   2. la misma pregunta abierta no entra dos veces, aunque llegue en otra vuelta;
//   3. la caja del cliente no se apaga mientras MaKo trabaja: `ocupado` sólo hace girar la flecha; se puede dictar o grabar
//      el siguiente, y quien dictaba no pierde el botón de terminar (revisión de la ola 1, 21/10/2026);
//   4. el cartero (1.17.3): la pregunta de wrap_up lleva su origen, `armarPregunta` limpia como el servidor, un archivo
//      malformado no tumba la vuelta, sube la última de cada chat con el tope antes de mandar, y la marca de un chat no
//      avanza si su pregunta no entró (con un límite, para no dejarlo mudo);
//   5. la respuesta lleva el `message` del botón; un pegado de Word con imagen sigue siendo documento; si no se pudieron
//      guardar las preguntas, la vuelta no avanza las marcas.
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · `superarPreguntas` que no supera nada → 2 fallos (1 y 2: la reabierta entra repetida);
//   · `unirPreguntas` sin mirar el texto → 1 fallo (2);
//   · la caja con `quieto = enviando || apagado || ocupado` → 1 fallo (3);
//   · `preguntasSinRepetir` sin filtrar lo malformado → 1 fallo (4);
//   · `marcasQueAvanzan` que avanza siempre → 1 fallo (4);
//   · (21/10) `unirPreguntas` que deja la de wrap_up igual a una de `preguntar` → 1 fallo (2); que le saca el `origen`, como
//     91fae9527 → 1 fallo (2); `superarPreguntas` sin mirar `tambienPreguntar` → 1 fallo (2); `sanearPregunta` sin
//     guardarlo → 1 fallo (2);
//   · (21/10) `BotonMandar` girando con `ocupado` aunque se dicte → 1 fallo (3); la caja pasándole `girando` → 1 fallo (3).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esperaAMartinEnElChat, estaAbierta, sanearPregunta, sanearPreguntas, superarPreguntas, textoDeRespuesta, unirPreguntas, type PreguntaChat } from '../lib/centro-preguntas-chat';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const cartero = () => import('../scripts/operaciones/cartero.mjs');
const LOCAL = 'local_752add17-1111-4111-8111-111111111111';
const OTRO = 'local_22222222-2222-4222-8222-222222222222';
const pregunta = (id: string, at: string, extra: Partial<PreguntaChat> = {}): PreguntaChat => ({
  id, local: LOCAL, pregunta: '¿Hago el commit?', contexto: null,
  opciones: [{ titulo: 'Commit', detalle: 'Commiteá lo de hoy' }, { titulo: 'Ahora no', detalle: null }],
  recomendada: 0, varias: false, at, respuesta: null, ...extra,
});
const ID1 = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const ID3 = '33333333-3333-4333-8333-333333333333';

test('1. la pregunta de un wrap_up queda superada cuando el chat siguió sin el formulario', () => {
  const w = pregunta(ID1, '2026-10-20T21:11:00.000Z', { origen: 'wrap_up' });
  const yo = { local: LOCAL, rol: 'yo', at: '2026-10-20T21:12:00.000Z' };
  const [s] = superarPreguntas([w], [yo]);
  assert.equal(s.superada, '2026-10-20T21:12:00.000Z', 'Martín contestó en la app: superada');
  assert.equal(estaAbierta(s), false, 'y no espera a nadie (ni el globito ni «Espera tu respuesta»)');
  assert.equal(superarPreguntas([w], [{ ...yo, rol: 'otro' }])[0].superada, yo.at, 'otro chat también la deja atrás');
  assert.equal(superarPreguntas([w], [{ ...yo, at: '2026-10-20T21:10:00.000Z' }])[0].superada, undefined, 'un turno de ANTES no');
  assert.equal(superarPreguntas([w], [{ ...yo, rol: 'el' }])[0].superada, undefined, 'lo que dice el chat no');
  assert.equal(superarPreguntas([w], [{ ...yo, local: OTRO }])[0].superada, undefined, 'lo de otro chat no');
  const deni = pregunta(ID2, '2026-10-20T21:00:00.000Z');
  assert.equal(superarPreguntas([deni], [yo])[0].superada, undefined, 'una de `preguntar` no: ésa la cierra la respuesta');
  const nueva = pregunta(ID3, '2026-10-20T21:15:00.000Z', { origen: 'wrap_up', pregunta: '¿Y ahora el push?' });
  const dos = superarPreguntas([w, nueva], []);
  assert.deepEqual(dos.map((p) => !!p.superada), [true, false], 'un wrap_up más nuevo deja atrás al anterior');
  const sinCambio = [w];
  assert.equal(superarPreguntas(sinCambio, []), sinCambio, 'sin cambios, la misma lista (no se escribe la base)');
  // La pantalla y el servidor la respetan.
  assert.equal(sanearPregunta({ ...w, superada: yo.at })?.superada, yo.at, 'se guarda');
  assert.equal(sanearPreguntas([{ ...w, superada: yo.at }])[0].superada, undefined, 'lo que sube la PC nunca viene superado');
  // El globito cuenta con `esperaAMartinEnElChat` desde el 10/11/2026 (abierta Y para Martín): una superada no la cuenta.
  assert.equal(esperaAMartinEnElChat({ ...w, superada: yo.at }), false, 'el globito no la cuenta');
  assert.match(sinComentarios(leer('lib/centro-preguntas-chat-db.ts')), /const n = ps\.filter\(esperaAMartinEnElChat\)\.length;/, 'y cuenta con ésa');
  assert.match(sinComentarios(leer('lib/centro-preguntas-chat-db.ts')), /if \(p\.superada\) return \{ ok: false, error: 'Ya no espera tu respuesta: el chat siguió\.', yaContestada: true \};/, 'no se contesta');
  assert.match(sinComentarios(leer('lib/centro-turnos-db.ts')), /await superarConTurnos\(turnos, cadena\)/, 'guardar los turnos la supera (con la cadena del chat: tests/preguntas-cadena-y-ask.test.ts)');
  assert.match(sinComentarios(leer('lib/centro-preguntas-chat-db.ts')), /superarPreguntas\(unirPreguntas\(superarPreguntas\(antes, turnos, cadena\), nuevas\), turnos, cadena\)/, 'y guardar la pregunta también, si el turno llegó antes (y antes de unir)');
  assert.match(sinComentarios(leer('app/admin/operaciones/PreguntaChat.tsx')), /const abierta = !r && !p\.superada && !enviada && !!onResponder;/, 'el formulario no se toca');
});

test('2. la misma pregunta abierta no entra dos veces', () => {
  const vieja = pregunta(ID1, '2026-10-20T21:11:00.000Z', { origen: 'wrap_up' });
  const igual = pregunta(ID2, '2026-10-20T21:15:00.000Z', { origen: 'wrap_up', pregunta: '  ¿hago   el commit?' });
  assert.deepEqual(unirPreguntas([vieja], [igual]).map((p) => p.id), [ID1], 'otra vuelta, el mismo texto: no entra');
  assert.deepEqual(unirPreguntas([], [vieja, igual]).map((p) => p.id), [ID1], 'ni en la misma vuelta');
  // Una de `preguntar` igual a una de wrap_up abierta (revisión de la ola 1): queda UNA, que sigue siendo de wrap_up (su
  // respuesta lleva el message del botón) y que, como una de `preguntar`, cierra sólo una respuesta.
  const dePreguntar = pregunta(ID2, '2026-10-20T21:15:00.000Z');
  const unidas = unirPreguntas([vieja], [dePreguntar]);
  assert.deepEqual(unidas.map((p) => [p.id, p.origen ?? null, p.tambienPreguntar ?? null]), [[ID1, 'wrap_up', true]], 'una sola, de wrap_up y también de preguntar');
  assert.match(textoDeRespuesta(unidas[0], [0], null), /1\. Commit: Commiteá lo de hoy/, 'la respuesta lleva el message del botón (la segunda revisión)');
  // Lo que se guarda y se relee: la marca sobrevive a la base.
  const releida = sanearPregunta(JSON.parse(JSON.stringify(unidas[0])));
  assert.equal(releida?.tambienPreguntar, true, 'se guarda');
  const despues = [{ local: LOCAL, rol: 'otro', at: '2026-10-20T21:20:00.000Z' }];
  assert.equal(superarPreguntas([releida!], despues).filter(estaAbierta).length, 1, 'otro chat no la cierra');
  const otroWrap = pregunta(ID3, '2026-10-20T21:30:00.000Z', { origen: 'wrap_up', pregunta: '¿Y el push?' });
  assert.equal(superarPreguntas([releida!, otroWrap], []).filter(estaAbierta).length, 2, 'ni un wrap_up más nuevo');
  assert.equal(sanearPreguntas([{ ...releida!, tambienPreguntar: true }])[0].tambienPreguntar, undefined, 'la PC no la sube marcada');
  const contestada = { ...vieja, respuesta: { elegidas: [0], otra: null, at: '2026-10-20T21:12:00.000Z', trabajo: ID3 } };
  assert.equal(unirPreguntas([contestada], [igual]).length, 2, 'si la anterior ya se contestó, la nueva es otra pregunta');
  const superada = superarPreguntas([vieja], [{ local: LOCAL, rol: 'yo', at: '2026-10-20T21:12:00.000Z' }]);
  assert.equal(unirPreguntas(superada, [igual]).length, 2, 'y si quedó superada, también');
  assert.equal(unirPreguntas([vieja], [{ ...igual, local: OTRO }]).length, 2, 'la de otro chat es otra');
});

test('3. la caja del cliente no se apaga mientras MaKo trabaja', () => {
  // La caja no se dibuja en node (AdjuntosCaja importa su CSS): se mira el código, como tests/chat-unico.test.ts.
  const c = sinComentarios(leer('app/_chat/CajaChat.tsx'));
  // 24/10/2026: también bloqueada (sin la app de escritorio, `bloqueo`): ahí no se escribe nada (tests/caja-sin-app.test.ts).
  assert.match(c, /const quieto = enviando \|\| apagado \|\| !!p\.bloqueo;/, 'el campo, el «+» y los emojis se apagan sólo saliendo, sin cargar o bloqueada');
  assert.match(c, /const girando = enviando \|\| ocupado;/, 'la barra de la nota de voz no manda mientras MaKo trabaja');
  assert.match(c, /<BotonMandar [\s\S]{0,200}?enviando=\{enviando\} ocupado=\{ocupado\}/, 'el botón sabe que MaKo trabaja');
  const boton = sinComentarios(leer('app/admin/operaciones/Microfono.tsx'));
  assert.match(boton, /if \(enviando \|\| \(ocupado && hayQueMandar && !d\.escuchando && !d\.subiendo\)\) return <button type="button" className="co-enviar" disabled aria-label="Mandando">/,
    'mientras trabaja, la flecha espera; el micrófono (y el botón de terminar de dictar) no');
  assert.match(c, /aria-label=\{p\.placeholder\}\s*disabled=\{quieto\}/, 'el <textarea> mira `quieto`, no `ocupado`');
  // La caja del cliente es la de PiezasCliente.tsx (22/10/2026: la misma en la computadora y el teléfono).
  assert.match(leer('app/second-brain/PiezasCliente.tsx'), /ocupado=\{k\.enCurso\} apagado=\{!k\.cargado \|\| !!k\.errorCarga\}/, 'el chat del cliente usa `ocupado`');
});

test('4. el cartero: origen, limpieza, nada lo tumba, la última de cada chat, y la marca no avanza sin su pregunta', async () => {
  const c = await cartero();
  const q = c.preguntaDeWrapUp({ id: 'toolu_x', recap: 'r', ask: '¿Hago el commit?', actions: [{ label: 'Commit', message: 'x'.repeat(290) }, { label: 'Ahora no' }] }, '2026-10-20T21:11:00Z')!;
  assert.equal(q.origen, 'wrap_up', 'lleva su origen');
  assert.equal(q.opciones[0].detalle.length, 290, 'el message del botón entero (hasta 300)');
  assert.throws(() => c.armarPregunta({ pregunta: '¿Y?', opciones: [{ titulo: '\u0001\u0002' }, { titulo: 'B' }] }, LOCAL), /falta opciones\[0\]\.titulo/, 'un título de control no pasa en la PC (el servidor lo rechazaba después)');
  assert.doesNotThrow(() => c.preguntasSinRepetir([{ local: { toString: 1 }, pregunta: 'x' }], [{ ...q, local: LOCAL }]), 'un archivo malformado no tumba la vuelta');
  const de = (local: string, at: string, n: number) => ({ ...q, id: `${n}`, local, at, pregunta: `¿Pregunta ${n}?` });
  const ultima = c.preguntasParaSubir([], [de(LOCAL, '2026-10-20T21:00:00Z', 1), de(LOCAL, '2026-10-20T21:05:00Z', 2)]);
  assert.deepEqual(ultima.preguntas.map((x: { id: string }) => x.id), ['2'], 'de cada chat, la última');
  const muchas = Array.from({ length: 25 }, (_, n) => de(`local_${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`, new Date(Date.UTC(2026, 9, 20, 21, n)).toISOString(), n));
  const tope = c.preguntasParaSubir([], muchas);
  assert.equal(tope.preguntas.length, 20);
  assert.ok(tope.preguntas.some((x: { id: string }) => x.id === '24'), 'con el tope, entran las MÁS NUEVAS');
  assert.equal(tope.sinLugar.size, 5, 'y los chats de las que no entraron no avanzan');
  // La marca: no avanza si su pregunta no volvió; a las 30 vueltas, sigue; un servidor viejo no retiene.
  const marca = { archivo: `/x/${LOCAL}.json`, transcript: 't', offset: 900, pendiente: null };
  const previa = { transcript: 't', offset: 500, pendiente: null };
  const [retenida] = c.marcasQueAvanzan([marca], [{ ...q, local: LOCAL }], new Set(), [], () => previa);
  assert.deepEqual([retenida.offset, retenida.retenida], [500, 1], 'la marca queda donde estaba, contando');
  assert.equal(c.marcasQueAvanzan([marca], [{ ...q, local: LOCAL }], new Set(), [q.id], () => previa)[0].offset, 900, 'si entró, avanza');
  assert.equal(c.marcasQueAvanzan([marca], [{ ...q, local: LOCAL }], new Set(), undefined, () => previa)[0].offset, 900, 'un servidor sin preguntasIds no retiene');
  const avisos: string[] = [];
  assert.equal(c.marcasQueAvanzan([marca], [{ ...q, local: LOCAL }], new Set(), [], () => ({ ...previa, retenida: 29 }), (m: string) => avisos.push(m))[0].offset, 900, 'a las 30 vueltas, sigue');
  assert.equal(avisos.length, 1, 'con aviso');
  assert.equal(c.marcasQueAvanzan([marca], [{ ...q, local: LOCAL }], new Set(), [], () => null)[0].offset, 900, 'un chat nuevo no se relee desde cero');
  // La 1.17.3 o una posterior (la 1.17.4 suma `retirar`: tests/centro-preguntas-retirar.test.ts; la 1.18.0, AskUserQuestion).
  const v = /export const VERSION = '(\d+)\.(\d+)\.(\d+)';/.exec(leer('scripts/operaciones/cartero.mjs'))?.slice(1).map(Number) ?? [0, 0, 0];
  assert.ok(v[0] > 1 || (v[0] === 1 && (v[1] > 17 || (v[1] === 17 && v[2] >= 3))), `cartero ${v.join('.')}`);
});

test('5. la respuesta con el message, el pegado de Word, y la vuelta que no pudo guardar', () => {
  const w = pregunta(ID1, '2026-10-20T21:11:00.000Z', { origen: 'wrap_up' });
  assert.match(textoDeRespuesta(w, [0], null), /\n1\. Commit: Commiteá lo de hoy$/, 'lo que el mismo clic en la app le manda');
  assert.match(textoDeRespuesta({ ...w, origen: undefined }, [0], null), /\n1\. Commit$/, 'en una de `preguntar`, el título como siempre');
  assert.match(leer('app/second-brain/useChatCliente.ts'), /if \(e\.clipboardData\.files\.length && !Array\.from\(e\.clipboardData\.types\)\.includes\('text\/plain'\)\) return;/, 'un pegado con texto sigue siendo documento');
  assert.match(leer('lib/operaciones.ts'), /try \{ preguntasIds = await guardarPreguntas\(preguntas, cadena\); \} catch \(err\) \{ turnosOk = false;/, 'sin guardarlas, la marca no avanza');
});
