// =============================================================================
// MaKo en WhatsApp: el acuse es el 👍, y un texto de espera SÓLO cuando el turno lleva tiempo (24/10/2026)
// =============================================================================
// Martín, textual: «no quiero que MaKo en WhatsApp diga nada más como "En breves te contesto", basta con la reacción al
// mensaje y los clientes entienden que ya lo vio. A excepción de un proceso que lleve tiempo, como que le pidan el
// análisis de algo, o cambiar algo que lleve pensar, ahí le puede decir "Lo analizo y en breves te digo" o variaciones de
// eso dependiendo lo que le pidieron».
//
// Lo que se prueba:
//   · LA DECISIÓN (lib/doer-acuse.ts): qué es «lleva tiempo» y qué frase va, que no es la misma para todo; lo que NO
//     espera (una consulta, una carga, una propuesta, una adivinanza del clasificador); el trabajo largo de un «sí».
//   · SI EL 👍 FALLA: `conTope` nunca rechaza y el texto que lo reemplaza dice que llegó, sin «dame un momento».
//   · LA SALIDA DEL MODELO (lib/doer-salida.ts): la espera que escribe por su cuenta no sale, tampoco con herramientas
//     corridas si es lo último del mensaje.
//   · EL CABLEADO (lib/mako-doer-in.ts, leído como texto, el molde de tests/reaccion-emoji.test.ts): el 👍 sale antes de
//     procesar, sin `await` y sólo a lo que MaKo va a contestar; ningún acuse de texto; el texto de espera sólo si el 👍
//     falló o si el pedido lleva tiempo.
//
// PROBADO ROMPIÉNDOLO: ver el pie. Correr: node --import tsx --test tests/doer-acuse.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  esperaDelPedido, acuseSinReaccion, conTope, trabajoLargoDe, TOPE_REACCION_MS, type Espera,
} from '../lib/doer-acuse';
import { clasificarIntencion } from '../lib/mako-intencion';
import { sanearSalida, promesasDe, promesasFirmesDe, esperasAlFinal, SIN_HACER, SIN_HACER_LO_DEMAS } from '../lib/doer-salida';
import { marcasDeVoseo } from '../lib/puestas-data';
import { porId } from '../lib/api-mako/registro';

// ⚠️ Sin los `\r`: con `core.autocrlf` el checkout de Windows trae CRLF, y `cuerpo()` busca el `\n}\n` del final.
const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PENSAR = { intencion: 'pensar', dudosa: false } as const;
const frase = (e: Espera | null) => e?.frase ?? null;
/** Lo que decide el turno con la clasificación de verdad (sin pendientes ni media). */
const conClasificador = (t: string) => frase(esperaDelPedido(t, clasificarIntencion(t)));

// ── LA DECISIÓN ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('un análisis espera, y la frase nombra QUÉ se analiza', () => {
  assert.equal(conClasificador('Mako, analízame las campañas de esta semana'), 'Analizo las campañas y en breves te digo.');
  assert.equal(conClasificador('Hola MaKo! Hazme un análisis de mis leads de este mes'), 'Analizo los leads y en breves te digo.');
  // Una pregunta que PIDE el análisis llega como `consultar`, y el turno lo hace igual.
  assert.equal(conClasificador('¿Puedes analizar la llamada con Juan y decirme qué mejorar?'), 'Analizo la llamada y en breves te digo.');
  // Sin un objeto conocido, la frase de Martín tal cual.
  assert.equal(frase(esperaDelPedido('analízame esto que te pegué arriba', PENSAR)), 'Lo analizo y en breves te digo.');
  // Con una foto: lo que pide manda sobre la foto.
  assert.equal(frase(esperaDelPedido('analiza esta campaña', PENSAR, { media: 'image' })), 'Analizo la campaña y en breves te digo.');
});

test('cambiar algo que lleva pensar, escribir algo nuevo o leer un documento entero: cada uno con SU frase', () => {
  assert.equal(frase(esperaDelPedido('Hazme más directo el copy del anuncio, reescríbelo', PENSAR)), 'Reviso el copy y en breves te digo.');
  assert.equal(frase(esperaDelPedido('mejóralo, que suene más cercano', PENSAR)), 'Lo veo y en breves te digo.');
  assert.equal(frase(esperaDelPedido('escríbeme un mensaje para reactivar a los leads fríos', PENSAR)), 'Escribo el mensaje y en breves te lo paso.');
  assert.equal(frase(esperaDelPedido('redacta algo corto para mañana', PENSAR)), 'Lo escribo y en breves te lo paso.');
  assert.equal(frase(esperaDelPedido('', PENSAR, { media: 'document' })), 'Leo el PDF y en breves te digo.');
  // Una foto se mira de una: no espera.
  assert.equal(esperaDelPedido('¿qué opinas de esta foto?', PENSAR, { media: 'image' }), null);
});

test('lo que NO lleva tiempo no dice nada: el 👍 alcanza', () => {
  for (const t of [
    '¿cuántos leads entraron hoy?', 'pásame las reuniones de mañana', 'anota: llamar a Juan el lunes', 'gracias mako!',
    // Se PROPONE (queda una pendiente y sale enseguida): lo largo es el «sí».
    'analizá mi landing', 'créame una automatización que le escriba a los que no vinieron',
    // Pregunta por algo hecho, o cómo se hace: se contesta en un segundo.
    '¿analizaste la llamada de ayer?', '¿cómo analizo mis campañas?',
    // «cambia» en tercera persona no es una orden.
    'el mercado cambia mucho, ¿qué opinas?',
  ]) assert.equal(conClasificador(t), null, t);
  // Una consulta que pregunta CÓMO se analiza se contesta explicando, aunque traiga el infinitivo que pide.
  const CONSULTAR = { intencion: 'consultar', dudosa: false } as const;
  assert.equal(esperaDelPedido('¿Cómo puedo analizar mis campañas?', CONSULTAR), null);
  assert.equal(esperaDelPedido('MaKo, ¿cuál es la mejor forma de evaluar un anuncio?', CONSULTAR), null);
  assert.equal(frase(esperaDelPedido('¿Me puedes analizar las campañas?', CONSULTAR)), 'Analizo las campañas y en breves te digo.');
  // Un `pensar` sin un verbo que lo diga tampoco: opinar es corto.
  assert.equal(esperaDelPedido('qué opinas de este titular: Vende más sin anuncios', PENSAR), null);
});

test('⚠️ lo que el clasificador deja DUDOSO no espera: el turno lo ANOTA, y prometer el análisis sería mentir', () => {
  // «reescríbeme» (tuteo, fuera de la lista de imperativos) llega `capturar` dudosa: el turno lo carga al plan y dice
  // «si querías que lo investigue ahora…» (`avisoDeDuda`). Lo mismo un `pensar` dudoso.
  const v = clasificarIntencion('reescríbeme el copy del anuncio para que sea más directo');
  assert.ok(v.intencion === 'capturar' && v.dudosa, JSON.stringify(v));
  assert.equal(esperaDelPedido('reescríbeme el copy del anuncio para que sea más directo', v), null);
  assert.equal(esperaDelPedido('analízame las campañas', { intencion: 'pensar', dudosa: true }), null);
  assert.equal(esperaDelPedido('¿puedes analizar las campañas?', { intencion: 'consultar', dudosa: true }), null);
});

test('un lote se lee sin el encabezado del doer, y un archivo sin su contenido', () => {
  // El encabezado de `unirMensajes` (lib/mako-doer-buffer.ts) dice «un mensaje posterior»: leído como pedido, la frase
  // sería «Analizo el mensaje…».
  const lote = '[Te mandó 2 mensajes seguidos. Son UNA sola cosa: léelos todos antes de contestar, responde UNA vez por el conjunto y carga TODAS las tareas juntas, no de a una. Si un mensaje posterior corrige o amplía a uno anterior, gana el posterior.]\n\n(1) hola mako\n\n(2) analiza cómo vinieron las ventas de octubre';
  assert.equal(frase(esperaDelPedido(lote, PENSAR)), 'Analizo las ventas y en breves te digo.');
  // Lo que trae el archivo no es el pedido: «analiza las campañas» adentro no lo vuelve un análisis.
  const archivo = 'Te mando «notas.txt». Léelo y dime qué hacemos con esto.\n\n<<<ARCHIVO «notas.txt»>>>\nanaliza las campañas del mes\n<<<FIN DEL ARCHIVO>>>';
  assert.equal(frase(esperaDelPedido(archivo, PENSAR, { media: 'texto' })), 'Leo el archivo y en breves te digo.');
});

test('el «sí» que pone a correr un trabajo LARGO espera; el corto, el «no» y el de pantalla, no', () => {
  const CONFIRMAR = { intencion: 'confirmar', dudosa: false } as const;
  assert.equal(frase(esperaDelPedido('sí, dale', CONFIRMAR, { trabajoLargo: 'analizar_landing' })), 'Lo analizo y en breves te digo.');
  assert.equal(frase(esperaDelPedido('sí', CONFIRMAR, { trabajoLargo: 'replicar_landing' })), 'Lo armo y en breves te digo.');
  assert.equal(frase(esperaDelPedido('dale', CONFIRMAR, { trabajoLargo: 'cerrar_experimento' })), 'Lo hago y en breves te digo.');
  assert.equal(esperaDelPedido('no, mejor no', CONFIRMAR, { trabajoLargo: 'analizar_landing' }), null);
  assert.equal(esperaDelPedido('sí', CONFIRMAR), null);

  // `trabajoLargoDe`, con el registro de verdad: la MÁS RECIENTE, `lenta` y confirmada por el chat.
  assert.equal(porId('analizar_landing')?.tipo, 'accion');
  assert.equal(trabajoLargoDe([porId('analizar_landing')]), 'analizar_landing');
  assert.equal(trabajoLargoDe([porId('crear_tarea_plan') ?? null, porId('analizar_landing')]), null,
    'con dos pendientes, el «sí» contesta la última (la corta): prometer la larga es adivinar');
  assert.equal(trabajoLargoDe([porId('enviar_broadcast')]), null, 'se confirma en PANTALLA: el «sí» del grupo no la corre');
  assert.equal(trabajoLargoDe([]), null);
});

test('las frases varían según lo pedido, son cortas y van en «tú»', () => {
  const frases = new Set<string>();
  const casos: Array<[string, Parameters<typeof esperaDelPedido>[1], Parameters<typeof esperaDelPedido>[2]?]> = [
    ['analízame las campañas', PENSAR], ['analízame esto', PENSAR], ['reescríbelo', PENSAR], ['reescríbeme el copy', PENSAR],
    ['escríbeme un email', PENSAR], ['redacta algo', PENSAR], ['', PENSAR, { media: 'document' }], ['', PENSAR, { media: 'texto' }],
    ['sí', { intencion: 'confirmar', dudosa: false }, { trabajoLargo: 'analizar_landing' }],
    ['sí', { intencion: 'confirmar', dudosa: false }, { trabajoLargo: 'replicar_landing' }],
    ['sí', { intencion: 'confirmar', dudosa: false }, { trabajoLargo: 'verificar_dominio_landing' }],
  ];
  for (const [t, v, ctx] of casos) {
    const f = frase(esperaDelPedido(t, v, ctx));
    assert.ok(f, `«${t}» no esperó`);
    frases.add(f);
    assert.ok(f.length <= 60, `«${f}» es larga para un aviso`);
    assert.deepEqual(marcasDeVoseo(f), [], f);
    assert.doesNotMatch(f, /(?<!\p{L})\p{L}+(?:ás|és|ís)(?!\p{L})|dame un|te contesto/u, f);
  }
  assert.ok(frases.size >= 8, `la misma frase para todo: ${[...frases].join(' | ')}`);
});

// ── SI EL 👍 FALLA ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('la reacción con tope: true sólo si Evolution dijo que sí a tiempo, y NUNCA rechaza', async () => {
  assert.equal(await conTope(Promise.resolve(true), 50), true);
  assert.equal(await conTope(new Promise<boolean>((r) => setTimeout(() => r(true), 5)), 200), true);
  assert.equal(await conTope(Promise.resolve(false), 50), false, 'Evolution contestó que no');
  assert.equal(await conTope(Promise.reject(new Error('Evolution 500')), 50), false, 'un error no puede costar la respuesta');
  assert.equal(await conTope(new Promise<boolean>(() => {}), 20), false, 'Evolution no contestó a tiempo');
  // El tope: el texto que reemplaza al 👍 sale ANTES de que termine la ventana de silencio del lote (el turno arranca
  // después), y ningún turno medido contesta antes: la respuesta nunca es la señal (texto p50 44 s, medido el 24/10).
  // Se lee del fuente porque `lib/mako-doer-buffer.ts` es `server-only`. Desde el 31/10/2026 el número de PRODUCCIÓN viaja
  // envuelto en `reloj(…)` —la ventana se puede ACORTAR por entorno para los tests del doer— y lo que se compara sigue
  // siendo ese número, no lo que diga el entorno de esta corrida.
  const ventana = Number(/export const VENTANA_MS = (?:reloj\()?(\d+)/.exec(leer('../lib/mako-doer-buffer.ts'))?.[1]);
  assert.ok(Number.isFinite(ventana) && ventana > 0, 'no pude leer la ventana de silencio de producción: cambió la forma de `export const VENTANA_MS` y este guard dejó de mirar algo');
  assert.ok(TOPE_REACCION_MS < ventana, `el acuse de texto sale DESPUÉS de que el lote se cerró: tope ${TOPE_REACCION_MS} ms contra la ventana de ${ventana} ms`);
});

test('sin el 👍, UN texto corto que dice que llegó (o la espera, si ya se sabe larga); nunca «dame un momento»', () => {
  assert.equal(acuseSinReaccion('texto', null), 'Recibido 👍');
  assert.equal(acuseSinReaccion('audio', null), 'Me llegó tu audio 👍');
  assert.equal(acuseSinReaccion('imagen', null), 'Me llegó tu imagen 👍');
  assert.equal(acuseSinReaccion('archivo', null), 'Me llegó tu archivo 👍');
  const espera = esperaDelPedido('analízame las campañas', PENSAR);
  assert.equal(acuseSinReaccion('texto', espera), 'Analizo las campañas y en breves te digo.');
  for (const m of ['texto', 'audio', 'imagen', 'archivo'] as const) {
    assert.doesNotMatch(acuseSinReaccion(m, null), /momento|segundo|contesto|en breve/i);
    assert.equal(promesasDe(acuseSinReaccion(m, null)).length, 0, 'el acuse no promete nada');
  }
});

// ── LA SALIDA DEL MODELO ───────────────────────────────────────────────────────────────────────────────────────────────

test('la espera que escribe el MODELO no sale: la dice el código, antes y sólo si corresponde', () => {
  const sin = (t: string) => sanearSalida(t, { corrioHerramientas: false }).texto;
  // `finDeTurno`: lo que pasa el doer (lib/mako-doer-in.ts, ver el cableado abajo).
  const con = (t: string) => sanearSalida(t, { corrioHerramientas: true, finDeTurno: true }).texto;
  // Sin herramientas, la espera es una promesa como cualquier otra (ahora la ven las regex).
  assert.equal(sin('En breves te contesto.'), SIN_HACER);
  assert.equal(sin('Lo analizo y en breves te digo.'), SIN_HACER);
  // Con herramientas, lo de antes trae lo que hizo y queda; la última oración promete un después que no hay, y se dice
  // que LO DEMÁS no se hizo (con «Eso no lo llegué a hacer» se leería sobre las ventas).
  assert.equal(con('Tus ventas de octubre fueron 12. Dame un rato y te paso el detalle.'), `Tus ventas de octubre fueron 12.\n\n${SIN_HACER_LO_DEMAS}`);
  assert.equal(con('Tus ventas de octubre fueron 12. Lo analizo y en breves te digo qué cambiar.'), `Tus ventas de octubre fueron 12.\n\n${SIN_HACER_LO_DEMAS}`);
  assert.equal(con('Revisé tus campañas: la A trajo 3 leads y la B 5. Déjame ver el detalle de la B y te cuento.'),
    `Revisé tus campañas: la A trajo 3 leads y la B 5.\n\n${SIN_HACER_LO_DEMAS}`);
  // Si era SÓLO la espera, no hay nada que mandar: la verdad en una línea.
  assert.equal(con('En breve te contesto.'), SIN_HACER);
  // ⚠️ Sin `finDeTurno` (el aviso de un ticket cerrado, lib/tickets-cierre.ts) queda: ese «en breve» lo escribió Martín.
  const ticket = 'Ya quedó arreglado lo del link. En breve te confirmo la fecha del cambio de plan.';
  assert.equal(sanearSalida(ticket, { corrioHerramientas: true }).texto, ticket);
  // Lo que NO es una espera sin cumplir, y queda.
  for (const t of [
    'Dame un segundo: tienes 3 reuniones hoy.',                  // lo que sigue al «:» ES la respuesta
    'Si me pasas el CSV, en breve te digo cuántos son.',          // una condición
    'Revisé el plan: tienes 4 tareas. ¿Te cargo otra?',           // una pregunta
    'Ya revisé el tablero. Te cargo las tareas del plan.',        // el paso siguiente honesto (17/10/2026)
    'Te paso el link: https://hola-mako.com/plan',
  ]) assert.equal(con(t), t, t);
  // La frase del código, si el modelo la copiara, la vería esta red: es justo lo que el prompt le prohíbe.
  assert.deepEqual(esperasAlFinal('Analizo las campañas y en breves te digo.'), ['Analizo las campañas y en breves te digo.']);
});

test('sumar las esperas a PROMESAS no corre los índices del chat de la app (`promesasFirmesDe`)', () => {
  assert.equal(promesasFirmesDe('Déjame ver el plan.').length, 1);
  assert.equal(promesasFirmesDe('Dame un segundo.').length, 1);
  assert.equal(promesasFirmesDe('Voy a revisar tus campañas.').length, 1);
  assert.equal(promesasFirmesDe('Estoy revisando tus campañas.').length, 1);
  assert.equal(promesasFirmesDe('Te cargo las tareas.').length, 0, '«te cargo» es una oferta en el chat de la app');
});

// ── EL CABLEADO ────────────────────────────────────────────────────────────────────────────────────────────────────────

const SRC = leer('../lib/mako-doer-in.ts');
/** El cuerpo de una función de nivel superior: de su firma a la primera `}` de la columna 0. */
function cuerpo(firma: string): string {
  const i = SRC.indexOf(firma);
  assert.ok(i >= 0, `no está «${firma}»`);
  const fin = SRC.indexOf('\n}\n', i);
  return SRC.slice(i, fin);
}
const BUFFER = cuerpo('async function bufferearYResponder(');
const SI_NO_REACCIONO = cuerpo('function acusarSiNoReacciono(');
const PROCESAR = cuerpo('async function procesarDoer(');
const REACCION = 'reaccionarMensaje(jid, data.key, EMOJI_RECIBIDO)';

test('el 👍 sale ANTES de procesar, sin esperarlo, y no a un eco ni a una re-entrega', () => {
  const iReaccion = BUFFER.indexOf(REACCION);
  assert.ok(iReaccion > 0, 'el turno ya no reacciona');
  for (const despues of ['reclamar(jid', 'esperarSilencio(', 'procesarDoer(']) {
    assert.ok(iReaccion < BUFFER.indexOf(despues), `el 👍 quedó después de ${despues}`);
  }
  assert.ok(BUFFER.indexOf("skip: 'eco de mi propia respuesta'") < iReaccion, 'MaKo se reacciona a sí misma');
  assert.ok(BUFFER.indexOf("skip: 'ya estaba en la cola (re-entrega)'") < iReaccion, 'una re-entrega lleva otro 👍');
  assert.ok(!BUFFER.includes(`await ${REACCION}`), 'el 👍 se espera: una Evolution lenta frena el turno');
  assert.ok(BUFFER.includes(`${REACCION}.catch(`), 'una reacción caída tira el turno');
});

test('el 👍 va sólo a lo que MaKo va a contestar (prendido y enganchado), como la regla de `procesarDoer`', () => {
  // Desde el 27/10/2026 la regla recibe a quién mencionan (una @mención a la línea de MaKo es nombrarla, tests/doer-para-quien).
  // Y desde el 28/10/2026, no al «sí» que le contesta a otra persona de la cola (`contestaAOtroEnLaCola`, tests/doer-para-quien).
  assert.match(BUFFER, /const engancha = activo && !soloClave && \(!!audio \|\| !!adjunto \|\| \(\(await enganchaElTexto\(wsData, jid, texto, await mencionadosEn\(instance, data\)\)\)\n\s*&& !\(await contestaAOtroEnLaCola\(wsData, instance, jid, msgId, texto\)\)\)\);/);
  assert.match(BUFFER, new RegExp(`const reaccion = engancha && !deLaApp \\? ${REACCION.replace(/[().]/g, '\\$&')}`));
  // La regla del texto es la de `procesarDoer`: el modo, el nombre, la ventana y las pendientes.
  const regla = cuerpo('async function enganchaElTexto(');
  for (const parte of ["=== 'libre'", 'nombraAMaKo(texto)', 'ventanaVigente(', 'pendientesVigentes(']) assert.ok(regla.includes(parte), parte);
  assert.match(PROCESAR, /const enganchaTexto = modo === 'libre' \|\| nombraAMaKo\(textoDirecto\) \|\| quien\.aMaKo \|\| abierta \|\| vigentes\.length > 0;/);
});

test('ningún acuse de texto: lo único que el lote manda por su cuenta es el aviso de la clave tapada', () => {
  for (const viejo of [
    "'Te escucho 🎧 dame un momento y te contesto.'", "'Me llegó 📎 lo miro y te contesto.'",
    "'Claro, anoto eso 👇 dame un segundo.'", "'Recibido 👍 dame un momento y te contesto.'",
  ]) assert.ok(!SRC.includes(viejo), `volvió ${viejo}`);
  const envios = [...BUFFER.matchAll(/enviarAGrupoJid\(/g)];
  assert.equal(envios.length, 1, 'bufferearYResponder manda un texto más');
  assert.ok(BUFFER.lastIndexOf('avisoClaveTapadaEnElGrupo(', envios[0].index!) > 0, 'el único envío no es el de la clave');
});

test('el texto que reemplaza al 👍 sale SÓLO si el 👍 falló, y el turno no repite la espera', () => {
  const iTope = SI_NO_REACCIONO.indexOf('if (await conTope(reaccion, TOPE_REACCION_MS)) return { dijoEspera: false };');
  assert.ok(iTope > 0, 'el acuse de texto ya no mira si el 👍 salió');
  assert.ok(iTope < SI_NO_REACCIONO.indexOf('enviarAGrupoJid('), 'el texto sale sin mirar el 👍');
  assert.ok(SI_NO_REACCIONO.includes('acuseSinReaccion('), 'el texto no es el de `acuseSinReaccion`');
  assert.match(SI_NO_REACCIONO, /\}\)\(\)\.catch\(\(\) => \(\{ dijoEspera: false \}\)\);/, 'el acuse puede rechazar y tirar el turno');
  // Los dos caminos del lote le pasan el acuse a `procesarDoer`.
  // `linea` y no `instance` desde el 3/11/2026: un turno que arrancó en el grupo de la app no tiene línea, y puede traer en el lote uno de WhatsApp.
  assert.equal([...BUFFER.matchAll(/procesarDoer\(wsData, linea, [^\n]*, \{ acuse \}\);/g)].length, 2);
});

test('la espera con palabras va en `procesarDoer`, con el pedido entero, ANTES de armar el system, y sólo si lleva tiempo', () => {
  const iEspera = PROCESAR.indexOf('esperaDelPedido(texto, intencion,');
  assert.ok(iEspera > PROCESAR.indexOf('const intencion = clasificarIntencion('), 'la espera se decide sin la intención');
  assert.ok(iEspera < PROCESAR.indexOf('buildSystemPrompt('), 'la espera sale después de lo que tarda');
  assert.match(PROCESAR, /if \(espera && !\(await opts\.acuse\)\?\.dijoEspera\) \{\s*const env = await enviarAGrupoJid\(jid, espera\.frase, 0\);/);
  assert.match(PROCESAR, /trabajoLargoDe\(vigentes\.map\(\(p\) => porId\(p\.tipo\)\)\)/);
  // Y la respuesta del modelo se sanea como FIN de turno: su espera, si la escribe, no sale. Desde el 27/10/2026 lleva
  // también `enElGrupo` (el «hecho» sin respaldo, tests/doer-hecho-grupo.test.ts): por eso la cola queda abierta.
  assert.match(PROCESAR, /sanearSalida\(respuesta, \{\s*corrioHerramientas: corridasDelTurno > 0, finDeTurno: true[,\s]/);
});

// ── ROTURAS (24/10/2026) ───────────────────────────────────────────────────────────────────────────────────────────────
// Una por vez (reemplazar el texto, correr este archivo, devolverlo de memoria con un script node con `finally`; los
// archivos del índice son CRLF y el marcador de varias líneas se convierte al fin de línea del archivo). Medido de
// nuevo el 24/10/2026 tras la caída de la app. Base 16 pasan / 0 fallan, y 16 / 0 al restaurar:
//   lib/doer-acuse.ts
//   R1. `esperaDelPedido` sin la guarda de `dudosa` en `pensar`                                          → 1 falla
//   R2. ANALISIS con `analiz\w*` (la raíz en vez de las formas que piden)                                 → 1 falla
//   R3. sin `sinPrefijoDeLote` (el encabezado del lote se lee como pedido)                               → 1 falla
//   R4. sin el corte en `<<<ARCHIVO` (el contenido del archivo se lee como pedido)                       → 1 falla
//   R5. FRASE.cambio igual a FRASE.analisis (la misma frase para todo)                                   → 1 falla
//   R6. `trabajoLargoDe` sin `confirmacion === 'chat'`                                                   → 1 falla
//   R7. `trabajoLargoDe` busca en todas las pendientes (`find`) y no en la más reciente                  → 1 falla
//   R8. `conTope` deja pasar el rechazo (sin el segundo callback del `then`)                             → 1 falla
//   R9. `acuseSinReaccion('texto')` vuelve a «Recibido 👍 dame un momento y te contesto.»                → 1 falla
//   R15. sin `NIEGA`: «no, mejor no» a una pendiente lenta espera                                        → 1 falla
//   R16. `consultar` sin `comoSeHace` («¿cómo puedo analizar…?» espera)                                  → 1 falla (la
//        primera vez dio 0: «¿cómo analizo mis campañas?» no llega como `consultar`; se sumó el caso que sí)
//   R17. una foto también espera, como si fuera un documento                                             → 1 falla
//   lib/doer-salida.ts
//   R10. `esperasAlFinal` sólo con ESPERAS (sin `PROMESAS[0]`, el «déjame ver»)                          → 1 falla
//   R11. ESPERAS en el MEDIO de `PROMESAS` (corre los índices de `promesasFirmesDe`)                     → 1 falla
//   R12. ESPERAS fuera de `PROMESAS` (sin herramientas, «en breves te contesto» sale)                    → 1 falla
//   R13. `sanearSalida` ignora `finDeTurno` (con herramientas no se saca nada)                           → 1 falla
//   R14. con herramientas, `SIN_HACER` en vez de `SIN_HACER_LO_DEMAS` (se leería sobre lo hecho)         → 1 falla
//   lib/mako-doer-in.ts
//   R18. el 👍 vuelve a `void` antes del eco y sin guarda (el lugar del 25/8)                            → 2 fallan
//   R19. el 👍 con `await`                                                                               → 2 fallan (y 1 en
//        tests/reaccion-emoji.test.ts)
//   R20. el 👍 sin la guarda de `engancha` (a todo mensaje)                                              → 1 falla
//   R21. vuelve el «Recibido 👍 dame un momento y te contesto.» de texto en `bufferearYResponder`        → 1 falla
//   R22. `acusarSiNoReacciono` manda el texto sin mirar el 👍 (sin la línea de `conTope`)               → 1 falla
//   R23. `procesarDoer` repite la espera aunque el acuse de texto ya la dijo                             → 1 falla
//   R24. la espera de `procesarDoer` después de `buildSystemPrompt`                                      → 1 falla
//   R25. el doer sanea sin `finDeTurno`                                                                  → 1 falla
