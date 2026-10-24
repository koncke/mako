// =============================================================================
// doer-acuse — cómo le dice MaKo al grupo «lo vi»: el 👍, y un texto SÓLO cuando lleva tiempo
// =============================================================================
// PEDIDO DE MARTÍN (24/10/2026), textual: «no quiero que MaKo en WhatsApp diga nada más como "En breves te contesto",
// basta con la reacción al mensaje y los clientes entienden que ya lo vio. A excepción de un proceso que lleve tiempo,
// como que le pidan el análisis de algo, o cambiar algo que lleve pensar, ahí le puede decir "Lo analizo y en breves te
// digo" o variaciones de eso dependiendo lo que le pidieron».
//
// ⚠️ EL 👍 YA SALÍA, Y LLEGABA. El diagnóstico con que vino el pedido («`reaccionarMensaje` existe y nadie la llama») era
// falso: la llamaba lib/mako-doer-in.ts desde el 25/8. Medido el 24/10 en el store de Evolution (sólo lectura, 30 días,
// 11 grupos): 119 de 119 mensajes de personas tienen el 👍 de MaKo. Lo que sobraba era el TEXTO que salía además —84
// acuses («Recibido 👍 dame un momento y te contesto.», «Claro, anoto eso 👇 dame un segundo.», «Te escucho 🎧…», «Me
// llegó 📎…») en esos mismos 30 días—, que docs/hallazgos-comunicacion.md ya marcaba como «DUPLICADO» desde agosto.
//
// Lo que decide este módulo, y nada más:
//   1. `esperaDelPedido`: ¿el turno lleva tiempo DE VERDAD, y qué frase va? Por lo que se pidió, no por el reloj: medido
//      el 24/10 (139 turnos de 45 días, `mako_doer_buffer` → `mako_doer_conv`), TODO turno tarda: texto p50 44 s, audio
//      p50 81 s, y hasta la charla barata p50 33 s. Un umbral de segundos mandaría el texto siempre, que es lo que Martín
//      no quiere. «Lleva tiempo» es un análisis, una reescritura o un trabajo de IA que el «sí» pone a correr.
//   2. `acuseSinReaccion`: el texto que va SÓLO si el 👍 no salió (ver abajo, «SI LA REACCIÓN FALLA»).
//   3. `conTope`: la reacción con un tope de tiempo, que nunca rechaza.
//
// PURO y sin `server-only`: lo usan el doer (lib/mako-doer-in.ts) y tests/doer-acuse.test.ts.
// =============================================================================

import { sinPrefijoDeLote, type VeredictoIntencion } from './mako-intencion';

/** Qué tipo de espera es. Va al log y elige la frase. */
export type TipoEspera = 'analisis' | 'cambio' | 'escritura' | 'lectura' | 'trabajo';
export type Espera = { tipo: TipoEspera; frase: string };

/**
 * SI LA REACCIÓN FALLA (decisión del 24/10/2026). Sin el 👍 y sin texto, el cliente no tiene ninguna señal durante lo que
 * tarda el turno —44 s la mitad de las veces—, y eso es justo lo que se sintió como «MaKo está caída» en agosto (el dueño
 * reenvió un audio a los 2 min 43 s y salieron dos borradores). «La respuesta misma es la señal si sale en segundos» no
 * vale para NINGÚN tipo de turno medido. Así que: si Evolution rechaza la reacción, o no contesta en `TOPE_REACCION_MS`,
 * sale UN texto corto que dice que llegó (la frase de espera si el pedido ya se sabe largo). El «escribiendo…» no cuenta
 * como señal: sale por la misma Evolution y nadie sabe si se vio.
 */
export const TOPE_REACCION_MS = 4000;

/** Sin tildes y en minúsculas, como mako-intencion. */
const norm = (s: string): string => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ⚠️ LAS FORMAS QUE PIDEN, NO LA RAÍZ. «¿analizaste la llamada?» o «el análisis de ayer» preguntan por algo hecho y se leen
// en un segundo: con `analiz\w*` les tocaba «Lo analizo y en breves te digo». Valen en cualquier lugar el imperativo con
// pronombre (sin tildes «analízame» es «analizame»), el infinitivo («¿puedes analizar…?») y el subjuntivo («quiero que
// analices»). La forma SUELTA («analiza», «mejora», «cambia») es también la tercera persona («el mercado cambia mucho, ¿qué
// opinas?»), así que cuenta sólo al ARRANQUE de una oración, que es como se da una orden (la regla de `esPedidoDeLanding`).
const ANALISIS = /\b(?:analiz(?:ame|anos|alo|ala|alos|alas|ar|arlo|arla|arlos|arlas|arme)|analic(?:e|es|emos)|diagnostic(?:ame|alo|ala|ar|arlo|arla)|evalu(?:ame|alo|ala|alos|alas|ar|arlo|arla|es)|audit(?:ame|alo|ala|ar|arlo|arla)|compar(?:ame|alos|alas|ar|arlos|arlas)|(?:haz|hazme|haceme|hace|hacer|hacerme|hagas|armame|arma|necesito|quiero|dame)\s+(?:un|una)\s+(?:analisis|diagnostico|auditoria|comparacion|comparativa|evaluacion))\b/;
const ANALISIS_SUELTO = /^(?:analiza|diagnostica|evalua|audita|compara)\b/;
// Cambiar algo que lleva pensar: reescribir, mejorar, rehacer. «cámbiale la etapa a Juan» también lo dice, pero llega como
// `actuar` (una propuesta que se confirma) y acá sólo entra `pensar`: lo que el modelo reescribe EN el turno.
const CAMBIO = /\b(?:reescrib(?:eme|ime|ilo|ila|elo|ela|ir|irlo|irla)|mejor(?:ame|alo|ala|ar|arlo|arla)|rehac(?:eme|elo|ela|er|erlo|erla)|rehaz(?:lo|la|me)|reformul(?:ame|alo|ala|ar)|corrig(?:eme|elo|ela)|corregi(?:me|lo|la|r)|ajust(?:ame|alo|ala|ar)|cambi(?:ame|ale|alo|ala|ar|arlo|arla)|modific(?:ame|alo|ala|ar))\b/;
const CAMBIO_SUELTO = /^(?:reescribe|mejora|rehace|rehaz|reformula|corrige|ajusta|cambia|modifica)\b/;
// Escribir algo nuevo con la voz de la marca (el COPY del router, lib/mako-router.ts, con las formas que piden).
const ESCRITURA = /\b(?:escrib(?:eme|enos|ime|ir|irme|ilo|ila|elo|ela)|redact(?:ame|alo|ala|ar|arme)|(?:arma|armame|haz|hazme|haceme|prepara|preparame|crea|creame)\s+(?:un|una|el|la)\s+(?:copy|guion|texto|mensaje|email|mail|correo|secuencia|post|caption))\b/;
const ESCRITURA_SUELTO = /^(?:escribe|redacta)\b/;
/** Lo que se dice antes de la orden («Hola MaKo, porfa…»): se pela para ver con qué ARRANCA la oración. */
const PRELUDIO = /^(?:[\s,.:;!¡¿?"'-]*(?:mako|maco|che|porfa|por favor|oye|ey|hola|buenas|buen dia|buenos dias|ok|okey|dale|bueno|y|ahora|tambien|ademas)\b)*[\s,.:;!¡¿?"'-]*/;
/** ¿Lo pide? Con pronombre, infinitivo o subjuntivo en cualquier lugar; la forma suelta, al arranque de una oración. */
const pide = (n: string, siempre: RegExp, suelto: RegExp): boolean =>
  siempre.test(n) || n.split(/[.!?\n]+/).some((o) => suelto.test(o.replace(PRELUDIO, '')));
/** Una negación al arranque: «no, cancela» sobre una pendiente larga no pone nada a correr. */
const NIEGA = /^[\s¡!¿?]*(?:no|nop|nel|cancela|cancelala|mejor no)(?![a-z])/;

/**
 * QUÉ se está pidiendo, con su artículo y el pronombre que lo retoma («te LO paso»). El primero que aparece en el pedido
 * gana: «analízame las campañas y los anuncios» habla de las campañas. Lista cerrada: lo que no está acá va sin objeto
 * («Lo analizo y en breves te digo»), que es la frase de Martín.
 */
const OBJETOS: ReadonlyArray<readonly [RegExp, string, 'lo' | 'la' | 'los' | 'las']> = [
  [/\bcampanas\b/, 'las campañas', 'las'], [/\bcampana\b/, 'la campaña', 'la'],
  [/\banuncios\b/, 'los anuncios', 'los'], [/\banuncio\b/, 'el anuncio', 'lo'],
  [/\blandings?\b/, 'la landing', 'la'], [/\b(?:pagina|sitio|web)\b/, 'la página', 'la'],
  [/\bllamadas\b/, 'las llamadas', 'las'], [/\bllamada\b/, 'la llamada', 'la'],
  [/\breuniones\b/, 'las reuniones', 'las'], [/\breunion\b/, 'la reunión', 'la'],
  [/\bventas\b/, 'las ventas', 'las'], [/\b(?:numeros|metricas|resultados)\b/, 'los números', 'los'],
  [/\b(?:embudo|funnel)\b/, 'el embudo', 'lo'], [/\bleads\b/, 'los leads', 'los'],
  [/\bofertas?\b/, 'la oferta', 'la'], [/\bguion(?:es)?\b/, 'el guion', 'lo'], [/\bcopy\b/, 'el copy', 'lo'],
  [/\b(?:email|mail|correo)s?\b/, 'el email', 'lo'], [/\bsecuencias?\b/, 'la secuencia', 'la'],
  [/\bcompetencia\b/, 'la competencia', 'la'], [/\bmensaje\b/, 'el mensaje', 'lo'],
];
type Objeto = { nombre: string; pron: 'lo' | 'la' | 'los' | 'las' };

function objetoDe(n: string): Objeto | null {
  let mejor: { i: number; o: Objeto } | null = null;
  for (const [re, nombre, pron] of OBJETOS) {
    const m = re.exec(n);
    if (m && (!mejor || m.index < mejor.i)) mejor = { i: m.index, o: { nombre, pron } };
  }
  return mejor?.o ?? null;
}

/** El objeto de un adjunto, cuando el pedido no nombra otro. */
const OBJETO_MEDIA: Readonly<Record<'image' | 'document' | 'texto', Objeto>> = {
  image: { nombre: 'la imagen', pron: 'la' }, document: { nombre: 'el PDF', pron: 'lo' }, texto: { nombre: 'el archivo', pron: 'lo' },
};

const FRASE: Readonly<Record<Exclude<TipoEspera, 'trabajo'>, (o: Objeto | null) => string>> = {
  analisis: (o) => (o ? `Analizo ${o.nombre} y en breves te digo.` : 'Lo analizo y en breves te digo.'),
  cambio: (o) => (o ? `Reviso ${o.nombre} y en breves te digo.` : 'Lo veo y en breves te digo.'),
  escritura: (o) => (o ? `Escribo ${o.nombre} y en breves te ${o.pron} paso.` : 'Lo escribo y en breves te lo paso.'),
  lectura: (o) => `Leo ${(o ?? OBJETO_MEDIA.texto).nombre} y en breves te digo.`,
};

/**
 * La espera de un «sí» que pone a correr un trabajo LARGO: la acción pendiente es `lenta` en el registro (lib/api-mako),
 * que es el mismo criterio con el que el chat de la app la manda a segundo plano (`confirmarDesdeTarjeta`,
 * lib/mako-turno-app.ts). Por el id: analizar es analizar; crear y escribir, armar; el resto, hacer.
 */
function fraseDeTrabajo(id: string): string {
  if (/^(?:analizar|diagnosticar|evaluar|auditar|generar_conclusiones|generar_insight|proponer_reanalizar)/.test(id)) return 'Lo analizo y en breves te digo.';
  if (/^(?:crear|generar|escribir|replicar|armar|editar)/.test(id)) return 'Lo armo y en breves te digo.';
  return 'Lo hago y en breves te digo.';
}

/** Lo que el registro dice de una operación, y nada más (sin importarlo: este módulo es puro). */
type DefDeOperacion = { id: string; tipo: string; lenta?: boolean; confirmacion?: string };

/**
 * El trabajo LARGO que un «sí» pondría a correr: el id de la pendiente MÁS RECIENTE si es una acción `lenta` que se
 * confirma por el chat; si no, null. `defs`: las definiciones de las pendientes vigentes, la más reciente primero (el orden
 * de `pendientesVigentes`). ⚠️ Sólo la más reciente: un «sí» suelto contesta la última pregunta, y con dos pendientes
 * prometer la larga cuando el «sí» confirma la corta es prometer sobre una adivinanza. ⚠️ Y sólo `confirmacion: 'chat'`:
 * la que se confirma en PANTALLA no corre con un «sí» del grupo (lib/mako-doer-acciones.ts la cierra sin ejecutar), y su
 * «Lo hago y en breves te digo» no se cumpliría nunca.
 */
export function trabajoLargoDe(defs: ReadonlyArray<DefDeOperacion | null | undefined>): string | null {
  const d = defs[0];
  return d && d.tipo === 'accion' && d.lenta && d.confirmacion === 'chat' ? d.id : null;
}

/**
 * ¿Este turno lleva tiempo de verdad? Devuelve la frase de espera, o null (lo de siempre: el 👍 alcanza).
 *
 *  · `pensar` (lo que el modelo razona o escribe EN el turno, lib/mako-intencion.ts) y además un verbo que lo dice:
 *    analizar → «Analizo las campañas y en breves te digo»; reescribir/mejorar → «Reviso el copy…»; escribir algo nuevo →
 *    «Escribo el mensaje y en breves te lo paso»; un PDF o un archivo para leer → «Leo el PDF…».
 *  · Un «sí» a una pendiente `lenta` (`trabajoLargo`): ahí corre el análisis de la landing, la automatización con IA…
 *  · ⛔ Nada más. Ni una consulta, ni una carga al plan, ni una acción que se PROPONE: «analizá mi landing» llega como
 *    `actuar` y el turno sólo deja la pendiente («¿confirmas?»), que sale enseguida; lo largo es el «sí». Ni una
 *    clasificación DUDOSA: prometer sobre una adivinanza es lo contrario de «nada por detrás».
 *
 * `texto` es el turno entero (un lote trae su encabezado, que se pela; un archivo de texto trae su contenido, que no es el
 * pedido y no se lee). `media`: el adjunto que viaja (null si no hay). `trabajoLargo`: el id de la pendiente lenta que el
 * «sí» confirmaría, si la hay.
 */
export function esperaDelPedido(
  texto: string,
  veredicto: Pick<VeredictoIntencion, 'intencion' | 'dudosa'>,
  ctx: { media?: 'image' | 'document' | 'texto' | null; trabajoLargo?: string | null } = {},
): Espera | null {
  const pedido = norm(sinPrefijoDeLote(texto || '').split('<<<ARCHIVO')[0]).slice(0, 1500);
  if (veredicto.intencion === 'confirmar') {
    if (!ctx.trabajoLargo || NIEGA.test(pedido)) return null;
    return { tipo: 'trabajo', frase: fraseDeTrabajo(ctx.trabajoLargo) };
  }
  const obj = objetoDe(pedido) ?? (ctx.media ? OBJETO_MEDIA[ctx.media] : null);
  // «¿Puedes analizar la llamada con Juan?» llega como `consultar` (es una pregunta) y el turno la analiza igual: cuenta, sólo
  // el análisis y no una pregunta de cómo se hace («¿cómo analizo mis campañas?» se contesta explicando).
  if (veredicto.intencion === 'consultar' && !veredicto.dudosa) {
    const comoSeHace = /^(?:como|cual(?:es)?|cuando|donde|por ?que)\b/.test(pedido.replace(PRELUDIO, ''));
    return !comoSeHace && pide(pedido, ANALISIS, ANALISIS_SUELTO) ? { tipo: 'analisis', frase: FRASE.analisis(obj) } : null;
  }
  // ⚠️ Lo que la clasificación deja DUDOSO no espera: «reescríbeme el copy» (tuteo) sale `capturar` dudosa y el turno lo
  // trata como algo para anotar. Prometer un análisis ahí es prometer lo que el turno no va a hacer.
  if (veredicto.intencion !== 'pensar' || veredicto.dudosa) return null;
  if (pide(pedido, ANALISIS, ANALISIS_SUELTO)) return { tipo: 'analisis', frase: FRASE.analisis(obj) };
  if (pide(pedido, CAMBIO, CAMBIO_SUELTO)) return { tipo: 'cambio', frase: FRASE.cambio(obj) };
  if (pide(pedido, ESCRITURA, ESCRITURA_SUELTO)) return { tipo: 'escritura', frase: FRASE.escritura(obj) };
  // Un documento entero para leer lleva su tiempo (el único turno con PDF medido: 65 s). Una foto no: se mira de una.
  if (ctx.media === 'document' || ctx.media === 'texto') return { tipo: 'lectura', frase: FRASE.lectura(OBJETO_MEDIA[ctx.media]) };
  return null;
}

/** Cómo llegó el mensaje, para el texto que reemplaza al 👍. */
export type Medio = 'texto' | 'audio' | 'imagen' | 'archivo';

/**
 * El texto que va cuando el 👍 NO salió (ver `TOPE_REACCION_MS`): la frase de espera si el pedido ya se sabe largo; si no,
 * que llegó, y nada más. ⚠️ Sin «dame un momento» ni «en breves te contesto»: es lo que Martín pidió sacar, y acá sólo
 * reemplaza a la reacción.
 */
export function acuseSinReaccion(medio: Medio, espera: Espera | null): string {
  if (espera) return espera.frase;
  if (medio === 'audio') return 'Me llegó tu audio 👍';
  if (medio === 'imagen') return 'Me llegó tu imagen 👍';
  if (medio === 'archivo') return 'Me llegó tu archivo 👍';
  return 'Recibido 👍';
}

/**
 * La reacción con tope: true sólo si Evolution dijo que sí antes de `ms`. Un rechazo, un error o el tope son false, y
 * NUNCA rechaza: una reacción caída no puede costar la respuesta.
 */
export function conTope(p: Promise<boolean>, ms = TOPE_REACCION_MS): Promise<boolean> {
  return new Promise((res) => {
    const t = setTimeout(() => res(false), ms);
    p.then((ok) => { clearTimeout(t); res(ok === true); }, () => { clearTimeout(t); res(false); });
  });
}
