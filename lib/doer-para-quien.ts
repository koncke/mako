// =============================================================================
// doer-para-quien — ¿el mensaje del grupo es PARA MaKo? (27/10/2026, P8 de la lectura del Cerebro)
// =============================================================================
// ~16 de 58 turnos contestaban un acuse o una charla entre personas; a «Esto habla solo ? @joan» MaKo dio una descripción
// falsa, y a la persona que escribía la llamó por otro nombre. En el modo «libre» MaKo contesta TODO mensaje del grupo.
// Lo que no es para MaKo no dispara un turno (el 👍 de recibido ya salió):
//   · un ACUSE PURO («ok», «gracias», «genial», «jaja», «👍»), si MaKo no acaba de preguntar nada ni hay nada pendiente;
//   · una @MENCIÓN a otra persona, si el mensaje no nombra a MaKo.
// Un «ok» después de «¿Quieres que la pause?» ES un sí: con una pregunta de MaKo o una pendiente, el turno corre.
//
// PURO y sin `server-only`: lo usan lib/mako-doer-in.ts y tests/doer-para-quien.test.ts.
// =============================================================================

import { confirmacionPura, confirmaAOtro } from './confirmacion-pura';

/** Lo que sólo acusa recibo o agradece: el mensaje entero, sin nada más. */
// Los acuses y los saludos (28/10/2026, el diagnóstico del Cerebro, F5): «Bien», «Excelente», «Buen día! Geniall»,
// «Buendiaa», «Okk perfe» y «Vamos que arranca la semana!» no eran acuse, y MaKo los contestaba (contestar «Excelente» costó
// 15.630 tokens de entrada). Con la letra del final estirada como se escribe en WhatsApp.
const PALABRA_ACUSE = String.raw`(?:ok(?:ey|is)?|oka|dale|listo|genial|perfecto|perfe|excelente|(?:muy\s+)?bien|gracias|muchas gracias|mil gracias|buen[ií]simo|b[aá]rbaro|joya|de una|(?:ja)+j?|(?:je)+j?|👍|🙏|👌|🙌|❤️|💪)`;
const SALUDO = String.raw`(?:hola|buen\s?d[ií]a|buenos\s+d[ií]as|buenas(?:\s+(?:tardes|noches))?|vamos(?:\s+que\s+(?:arranca|empieza)\s+(?:la\s+semana|el\s+d[ií]a))?)`;
const ACUSE_PURO = new RegExp(String.raw`^(?:${PALABRA_ACUSE}|${SALUDO})(?:[\s,.!¡]+(?:${PALABRA_ACUSE}|${SALUDO}|mako|crack))*[\s.!¡]*$`, 'iu');
/** El acuse sin las anclas, para pegarle un nombre detrás («Gracias Martín»). */
const ACUSE_SIN_FIN = String.raw`(?:${PALABRA_ACUSE}|${SALUDO})(?:[\s,.!¡]+(?:${PALABRA_ACUSE}|${SALUDO}))*`;
/** «Buendiaa», «Geniall», «Okk»: la letra repetida AL FINAL de una palabra (en el medio, «arranca», es la palabra). */
const sinEstirar = (s: string): string => s.replace(/(\p{L})\1+(?=[^\p{L}]|$)/gu, '$1');

/**
 * ¿Le PREGUNTA algo a MaKo? (4/11/2026). Joan escribió «mako estas vivo?» en el grupo de un cliente, la IA lo leyó como charla, y
 * se quedó en el 👍: la pregunta, sin respuesta. Una charla o un «no es para MaKo» que le HABLA a MaKo (lo nombra, lo @menciona o lo
 * cita) y pregunta algo (un «¿» o un «?», o las reglas dicen `consultar` por una señal propia) se contesta, corto. La regla de Martín
 * del 24/10 («basta con la reacción») sigue para el «ok», el «gracias» y el «bien ahí»: ésos no preguntan.
 * ⚠️ El `consultar` del «sin señal clara» del grupo (`enElGrupoSinSenal`) NO cuenta: es un respaldo, y le daría consultar a «MaKo,
 * gracias». Quien llama pasa la lectura de las reglas sobre el mensaje solo, sin ese respaldo.
 */
export function preguntaAMaKo(o: { texto: string; leHabla: boolean; reglasConsultan: boolean }): boolean {
  if (!o.leHabla) return false;
  return /[¿?？]/u.test(o.texto || '') || o.reglasConsultan;
}

export function esAcusePuro(texto: string): boolean {
  return ACUSE_PURO.test(sinEstirar((texto || '').trim()));
}

// ── ¿LA CHARLA SE QUEDA EN EL 👍? (12/11/2026, Mauricio en el ws1) ──────────────────────────────────────────────────────────────────
// El equipo le escribió cómo pasar Resend a Pro «con la cuenta que conectaste a MaKo», y Mauricio contestó «yo no conecte a mako». La
// IA lo leyó como charla («Aclara que no conectó a MaKo») y MaKo puso el 👍 y se calló. Medido en los 7 días de antes: 8 de las 12
// charlas que callaron a MaKo traían algo adentro («Hola Mako, no trabajo esa zona», «el mail que me pediste de Sellers»). Martín, ese
// día: «no tomes absolutamente nada como charla del tipo gracias, ok, al menos que sean literalmente del tipo gracias, ok». La charla es
// la clase de lo que NO PIDE nada, pero un chat como uno con Claude contesta lo que le dicen. Se queda en el 👍 sólo lo que entero es:
//   · un acuse o un saludo (`esAcusePuro`: gracias, ok, listo, dale, 👍, buen día), un «sí» suelto (`confirmacionPura`), emojis;
//   · un agradecimiento con su motivo («bien ahí por la velocidad», «gracias por la info»), que nombró Martín el 24/10;
//   · el «no, gracias» a lo que MaKo ofreció.
// Lo que trae un dato se contesta aunque sea corto: «Respondido» o «ya lo contacté» al aviso de un lead (se probó dejarlos en el 👍, por
// el ruido en los negocios con muchos leads, y es justo lo que Martín no quiere). «Con» no es un motivo: «dale con la campaña» es un
// pedido. Un «no», un «pero» o un «todavía» lo sacan del agradecimiento: «gracias por no avisar» se contesta.
const LLAMADO_AL_ARRANQUE = /^(?:@\S+[\s,:]*)*(?:mako\b[\s,.:!¡]*)?/iu;
const SOLO_EMOJIS = /^[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u200d\ufe0f\s.,!¡]+$/u;
const AGRADECE = String.raw`(?:(?:muchas|mil)\s+)?gracias|(?:muy\s+)?bien|genial|excelente|perfecto|buen[ií]simo|b[aá]rbaro|joya`;
const AGRADECE_CON_MOTIVO = new RegExp(String.raw`^(?:${AGRADECE})(?:[\s,.!¡]+(?:${AGRADECE}))*(?:[\s,]+(?:ah[ií]|por(?:\s+[\p{L}\d]+){1,3}|mako|crack))+[\s.!¡]*$`, 'iu');
const NIEGA = /\b(?:no|nunca|pero|todavia|aun|falta|mal)\b/;
/** «No, gracias» a lo que MaKo ofreció: cierra, no pide. Un «no» solo, no: puede contestar «¿lo contactaron?». */
const NO_GRACIAS = /^no(?:[\s,.!]+(?:gracias|mil gracias|por ahora|hace falta|mako))+[\s.!]*$/;
const sinTildes = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function lineaQueCalla(linea: string): boolean {
  const t = sinEstirar(linea.trim().replace(LLAMADO_AL_ARRANQUE, '').trim());
  if (!t || SOLO_EMOJIS.test(t) || esAcusePuro(t) || confirmacionPura(t)) return true;
  const n = sinTildes(t);
  if (NO_GRACIAS.test(n)) return true;
  if (NIEGA.test(n)) return false;
  return AGRADECE_CON_MOTIVO.test(t);
}

/** ¿Una charla se queda en el 👍? Sólo si todo lo que escribió es eso (cada línea de un lote: quien llama le saca el encabezado). */
export function charlaQueCalla(texto: string): boolean {
  return (texto || '').split(/\n+/).every(lineaQueCalla);
}

/** Las @menciones del mensaje de WhatsApp (los jid de `contextInfo.mentionedJid`). */
export function mencionesDe(message: Record<string, unknown> | undefined): string[] {
  const ctx = ((message?.extendedTextMessage as { contextInfo?: { mentionedJid?: unknown } } | undefined)?.contextInfo
    ?? (message?.contextInfo as { mentionedJid?: unknown } | undefined));
  return Array.isArray(ctx?.mentionedJid) ? (ctx!.mentionedJid as unknown[]).filter((j): j is string => typeof j === 'string') : [];
}

/** A quién mencionan: `aMaKo`, si una mención es la línea que recibe; `aOtros`, las que seguro son de otra persona. */
export type Mencionados = { aMaKo: boolean; aOtros: string[] };

const ult10 = (d: string): string => d.slice(-10);
/** Los dígitos de un jid de TELÉFONO (`549…@s.whatsapp.net`, con `:device` o sin él); null si no lo es (un `@lid`, un grupo). */
function telefonoDelJid(jid: string): string | null {
  const m = /^(\d{8,15})(?::\d+)?@(?:s\.whatsapp\.net|c\.us)$/.exec(jid.trim());
  return m ? m[1] : null;
}

/**
 * Las menciones contra el número de la línea que RECIBE (la de MaKo en ese grupo, su `ownerJid`). Elegir a MaKo con la @ manda
 * su jid, no la palabra «mako»: sin esto, «@MaKo ¿cuántos leads entraron?» se leía como «a otro» y quedaba callado (la
 * revisión adversarial de 92d23e11d). Un `@lid` no se compara con un teléfono, y sin el número de la línea no se sabe: esas
 * menciones no cuentan como «a otro», y MaKo contesta como antes de P8. Se compara por los últimos 10 dígitos (el 9 de AR).
 */
export function quienesMencionados(menciones: readonly string[], numeroLinea: string | null): Mencionados {
  const linea = numeroLinea ? ult10(numeroLinea.replace(/\D/g, '')) : '';
  const aMaKo = !!linea && menciones.some((j) => { const t = telefonoDelJid(j); return !!t && ult10(t) === linea; });
  const aOtros = linea ? menciones.filter((j) => { const t = telefonoDelJid(j); return !!t && ult10(t) !== linea; }) : [];
  return { aMaKo, aOtros: aMaKo || aOtros.length < menciones.length ? [] : aOtros };
}

/**
 * EL LLAMADO A MaKo NO ES CONTENIDO: «@MaKo sí» es un «sí» (la verificación de 8cb034a18). Elegir a MaKo con la @ escribe el número
 * de su línea, y ese número contaba como una palabra más: `confirmacionPura` no lo daba por un «sí» solo, y el clasificador no
 * veía el «sí» del arranque (capturar, dudosa, sin `confirmar_accion`). Se saca, al arranque de cada mensaje (también en un lote,
 * «(2) @… sí»), la @ de la línea que recibe (al principio o al final: «sí @MaKo»), y un «MaKo,» de delante.
 * ⚠️ SÓLO SI LO QUE QUEDA ES UNA CONFIRMACIÓN («sí», «dale», «no»; la verificación de 9cef25dba): sacar el «MaKo» de «mako listo el
 * reporte?» o de «@MaKo ok, ¿cuántos leads?» los volvía «sí» con una pendiente viva. Un pedido queda como está. Sin la línea (o
 * en la línea del dueño, donde la @ es él: `mako-doer-in.ts`), el texto queda como está; un `@lid` tampoco se compara.
 */
export function sinElLlamadoAMaKo(texto: string, numeroLinea: string | null): string {
  const linea = numeroLinea ? ult10(numeroLinea.replace(/\D/g, '')) : '';
  const esLaLinea = (m: string, d: string): string => (linea && ult10(d) === linea ? ' ' : m);
  return (texto || '').split('\n').map((renglon) => {
    const [, numero = '', resto = renglon] = /^(\(\d+\) )?([\s\S]*)$/.exec(renglon) ?? [];
    let r = resto;
    for (let i = 0; i < 3; i++) {
      const antes = r;
      r = r.replace(/^\s*@(\d{8,15})(?!\d)[\s,:.!]*/, esLaLinea).replace(/[\s,]*@(\d{8,15})(?!\d)[\s.!]*$/, esLaLinea).trim();
      r = r.replace(/^mako[\s,:.!¡]+/iu, '').trim();
      // «@MaKo sí» escrito en la app: allá no hay menciones por número, y sin esto no sería una confirmación pura.
      r = r.replace(/^\s*@mako\b[\s,:.!¡]*/iu, '').replace(/[\s,]*@mako\b[\s.!]*$/iu, '').trim();
      if (r === antes) break;
    }
    // También un acuse que confirma solo («@MaKo ok», «mako listo»): la puerta de plata y terceros lo repregunta igual (no es puro).
    return r !== resto.trim() && (confirmacionPura(r) || /^(?:no|nop|mejor no|todav[ií]a no|ok(?:ey)?|listo|perfecto|claro|obvio|va|vale|bueno|de una)[\s.!]*$/iu.test(r)) ? `${numero}${r}` : renglon;
  }).join('\n');
}

/**
 * ¿Es el ECO de algo que mandó MaKo? Dos caminos:
 *   · SU ID ESTÁ EN EL ANILLO: es eco, venga como venga. ⚠️ CON DOS LÍNEAS DE MaKo EN UN GRUPO, `fromMe` NO ALCANZA (4/11/2026, ws13):
 *     lo que manda una le llega a la otra con `fromMe: false`, como si lo escribiera una persona, y MaKo se contestaba a sí misma
 *     (juntó su «Nuevo agendado» con el audio de Joan en un lote). Un id que mandó MaKo no lo puede tener el mensaje de una persona.
 *   · UN `fromMe` EN LA LÍNEA PROPIA DE MaKo (`voz`, leída estricta): ahí no escribe ninguna persona, esté o no su id en el anillo (la
 *     verificación de 8c1b7fa4e: con la base lenta, el id no llegaba a anotarse antes del eco, y en bucle). En la línea del dueño
 *     (donde él también escribe `fromMe`) decide sólo el anillo; y si la voz no se pudo leer (`voz` null), también.
 */
export function esEcoDeMaKo(p: { fromMe: boolean; msgId: string; instancia: string; voz: string | null; enviados: readonly string[] }): boolean {
  if (p.msgId && p.enviados.includes(p.msgId)) return true;
  return p.fromMe && p.voz !== null && !!p.instancia && p.voz === p.instancia;
}

/**
 * La voz que cuenta para decidir qué es eco. MaKo puede estar hablando por la línea de un NEGOCIO (`mako_ws<n>`: el botón de
 * /agencia, 03/11/2026, con la línea de MaKo baneada), que es el teléfono de una persona: ahí un `fromMe` también es ella
 * escribiendo, así que la línea no alcanza y decide el anillo. Es lo mismo que no conocer la voz: null.
 */
export function vozPropiaDeMaKo(voz: string | null): string | null {
  return voz !== null && /^mako_ws\d/.test(voz) ? null : voz;
}

/** El mensaje que CITA (responder a un mensaje en WhatsApp): su id y quién lo escribió, de `contextInfo`. */
export function citaDe(message: Record<string, unknown> | undefined): { id: string | null; autor: string | null } {
  const ctx = ((message?.extendedTextMessage as { contextInfo?: { stanzaId?: unknown; participant?: unknown } } | undefined)?.contextInfo
    ?? (message?.contextInfo as { stanzaId?: unknown; participant?: unknown } | undefined));
  return {
    id: typeof ctx?.stanzaId === 'string' && ctx.stanzaId ? ctx.stanzaId : null,
    autor: typeof ctx?.participant === 'string' && ctx.participant ? ctx.participant : null,
  };
}

/** Para quién es UN mensaje: 'mako' (lo nombra, lo menciona, o trae un audio o un adjunto: es deliberado), 'acuse' o 'a-otro'
 *  (no es para MaKo), o null (un pedido que no lo nombra: en «libre» es para MaKo). */
export type ParaQuien = 'mako' | 'acuse' | 'a-otro' | null;
/** Lo que el lote decidió, mensaje por mensaje: si alguno nombra a MaKo, o por qué ninguno es para MaKo (null: alguno lo es). */
export type ParaQuienDelLote = {
  nombra: boolean; noEs: 'acuse' | 'a-otro' | null;
  /** El ÚLTIMO de lo que queda le habla a MaKo (lo nombra o menciona su línea; un audio no): el «sí» de plata del lote. Lo pone el doer. */
  leHabla?: boolean;
};
/** Un mensaje de la cola: su texto, para quién es solo, y quién lo escribió (el `participant`; sin él, no se sabe). */
type ConAutor = { texto: string; para: ParaQuien; autor?: string | null };

/**
 * ⚠️ LA RESPUESTA A UN MENSAJE PARA OTRO TAMBIÉN ES PARA OTRO (la verificación de bb41ede4a): Ana «@Pedro ¿lo confirmo?» y Pedro
 * «sí». Sacar sólo el de Ana dejaba el «sí» solo, que con una pendiente se leía como confirmar y la EJECUTABA, aunque fuera de
 * plata. Una respuesta corta (`esRespuestaCorta`) que sigue a uno «a otro», sin uno para MaKo en el medio, va con él.
 * Y nadie se contesta a sí mismo (la verificación de 8cb034a18): Ana «@Leila mirá, ya lo encontró» y después Ana «sí», ese «sí»
 * es para MaKo. Lo que sigue a una RESPUESTA sí va con ella aunque sea del mismo: Pedro «sí» y Pedro «dale» le contestan los dos
 * a Ana. Sin el autor de alguno de los dos, se toma como respuesta: es lo que no ejecuta nada.
 * La usan el lote y el 👍 (que se decide mensaje por mensaje, antes del lote).
 */
export function conLasRespuestas<T extends ConAutor>(entrada: readonly T[]): T[] {
  let previo: { autor?: string | null; aOtro: boolean; respuesta: boolean } = { aOtro: false, respuesta: false };
  return entrada.map((m) => {
    const otraPersona = previo.respuesta || !previo.autor || !m.autor || previo.autor !== m.autor;
    const respuesta = m.para !== 'mako' && previo.aOtro && otraPersona && esRespuestaCorta(m.texto);
    previo = { autor: m.autor, aOtro: respuesta || m.para === 'a-otro', respuesta };
    return respuesta && m.para !== 'a-otro' ? { ...m, para: 'a-otro' as const } : m;
  });
}

/**
 * EL LOTE SE DECIDE MENSAJE POR MENSAJE (la verificación de 4d1d0a010). Con las menciones de todos juntas, una @mención a
 * Pedro callaba un «mako, ¿cuántos leads?» que ya tenía su 👍 (regresión contra producción), y una @mención a MaKo hacía
 * contestar en ventana cerrada también lo que era para Pedro. Ahora, si algún mensaje no es para otra persona, los que sí lo
 * son no entran al turno; y el lote lleva la decisión en vez de las menciones.
 */
export function paraQuienDelLote<T extends ConAutor>(entrada: readonly T[]): { quedan: T[]; decision: ParaQuienDelLote } {
  const mensajes = conLasRespuestas(entrada);
  const quedan = mensajes.some((m) => m.para !== 'a-otro') ? mensajes.filter((m) => m.para !== 'a-otro') : [...mensajes];
  const ningunoEs = quedan.every((m) => m.para === 'acuse' || m.para === 'a-otro');
  return {
    quedan,
    decision: {
      nombra: quedan.some((m) => m.para === 'mako'),
      noEs: ningunoEs ? (quedan.some((m) => m.para === 'a-otro') ? 'a-otro' : 'acuse') : null,
    },
  };
}

// ── EL MENSAJE PARA ALGUIEN DEL EQUIPO DE MaKo (29/10/2026, Leandro, ws10) ─────────────────────────────────────────────────
// «Hola Martin, probamos la automatización sec=680…», «Hola Martin, gracias por avisar lo del filtro…»: Leandro le escribe al
// EQUIPO por el grupo, y MaKo contestaba como si fuera Martín («Te entiendo perfecto y tienes toda la razón…») con lo que no
// sabía. Lo que hace ahora (el doer, lib/mako-doer-in.ts):
//   · un saludo o un «gracias» a esa persona, solo, no es para MaKo (sin turno, como un acuse);
//   · lo demás corre el turno con `bloqueParaElEquipo`: MaKo dice que es MaKo, contesta SÓLO lo que sus herramientas, los
//     pedidos abiertos o CÓMO FUNCIONA MAKO le dicen, y lo demás queda para el equipo;
//   · y el ticket queda SIEMPRE: si el modelo no dejó ninguna marca, el doer agrega `[[no-pude: …]]` (o lo suma al pedido abierto
//     que nombró, `[[ya-pedido: #N]]`). El mensaje era para el equipo: tiene que llegarle.

/** Los nombres del equipo de MaKo a los que un negocio le escribe en su grupo. `MAKO_EQUIPO_NOMBRES` (por comas) los cambia. */
export function nombresDelEquipo(): string[] {
  const env = process.env.MAKO_EQUIPO_NOMBRES?.trim();
  return (env ? env.split(',') : ['Martín']).map((s) => s.trim()).filter(Boolean);
}

/** El nombre con sus vocales con o sin tilde («Martin» y «Martín» son el mismo). */
const conOSinTildes = (nombre: string): string => nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  .replace(/a/gi, '[aá]').replace(/e/gi, '[eé]').replace(/i/gi, '[ií]').replace(/o/gi, '[oó]').replace(/u/gi, '[uúü]');
const SALUDO_A_ALGUIEN = String.raw`(?:(?:hola|buen\s?d[ií]a|buenos\s+d[ií]as|buenas(?:\s+(?:tardes|noches))?|che|ey|querido|querida)[\s,!¡.]+)?`;

/**
 * ¿El mensaje le habla a alguien del equipo? Arranca (él o una de sus líneas, un lote trae «(2) …») con su nombre, con o sin saludo
 * delante: «Hola Martin, …», «Martín: …», «Buen día Martín!». Su nombre como lo escribe el equipo y lo que dice después; o null.
 */
export function paraAlguienDelEquipo(texto: string, nombres: readonly string[] = nombresDelEquipo()): { nombre: string; resto: string } | null {
  const lineas = (texto || '').split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i].replace(/^\(\d+\)\s*/, '');
    for (const nombre of nombres) {
      const m = new RegExp(String.raw`^[\s¡!]*${SALUDO_A_ALGUIEN}@?${conOSinTildes(nombre)}(?![\p{L}\d])[\s,:;.!¡]*`, 'iu').exec(l);
      if (m) return { nombre, resto: [l.slice(m[0].length), ...lineas.slice(i + 1)].join('\n').trim() };
    }
  }
  return null;
}

/** Lo que el system del turno le dice a MaKo cuando el mensaje es para alguien del equipo. */
export function bloqueParaElEquipo(nombre: string): string {
  return `ESTE MENSAJE ES PARA ${nombre.toUpperCase()}, DEL EQUIPO DE MaKo, NO PARA TI. Tú eres MaKo, no ${nombre}: no contestes en su nombre ni como si fueras ${nombre} (nada de «gracias a ti», «te aviso» o «lo reviso»). Arranca en una línea: que eres MaKo y que esto lo ve ${nombre}. Después contesta SÓLO lo que te dicen tus herramientas de este turno, PEDIDOS ABIERTOS DE ESTE NEGOCIO o CÓMO FUNCIONA MAKO, con el dato; lo que no ves ahí no lo contestes ni lo adivines (ni cómo está el producto, ni qué tiene el equipo, ni pasos que no viste). Lo demás queda para ${nombre}: el sistema le deja el ticket solo.`;
}

/** Por qué el mensaje NO es para MaKo, o null si lo es. */
export function noEsParaMaKo(p: { texto: string; menciones: readonly string[]; nombraAMaKo: boolean; makoPregunto: boolean; hayPendientes: boolean }): 'acuse' | 'a-otro' | null {
  if (p.nombraAMaKo) return null;
  // Un saludo o un «gracias» a alguien del equipo («Hola Martín!», «Gracias Martín»: el nombre al final también), solo: es para él.
  const alEquipo = paraAlguienDelEquipo(p.texto);
  if (alEquipo && (!alEquipo.resto || esAcusePuro(alEquipo.resto))) return 'a-otro';
  if (nombresDelEquipo().some((n) => new RegExp(String.raw`^[\s¡!]*${ACUSE_SIN_FIN}[\s,]+${conOSinTildes(n)}[\s.!¡]*$`, 'iu').test(sinEstirar((p.texto || '').trim())))) return 'a-otro';
  // Una @mención a otra persona no es para MaKo AUNQUE haya algo pendiente (la verificación de bb41ede4a): «@Pedro sí,
  // confirmalo vos» no es el «sí» de la pendiente. Lo pendiente o la pregunta de MaKo convierten en «sí» sólo un acuse.
  // Salvo el «sí» a MaKo que nombra a otro como parte del pedido (la verificación de 8cb034a18): «sí, y avísale a @Pedro», con
  // una pendiente o una pregunta de MaKo. «@Pedro sí» o «sí @Pedro» siguen siendo para Pedro.
  if (p.menciones.length) return (p.hayPendientes || p.makoPregunto) && confirmaYNombraAOtro(p.texto) ? null : 'a-otro';
  if (p.hayPendientes || p.makoPregunto) return null;
  return esAcusePuro(p.texto) ? 'acuse' : null;
}

/** Lo que confirma, acusa o niega, solo: «sí», «dale», «ok», «listo», «no». */
const CONFIRMA = String.raw`(?:s[ií]+|sip|sep|no|nop|dale|ok(?:ey|is)?|oka|listo|claro(?:\s+que\s+s[ií])?|bueno|perfecto|de una|obvio|joya|va|vale|ya(?:\s+est[aá])?|hecho|confirmado|de acuerdo|genial|buen[ií]simo|b[aá]rbaro|(?:muchas\s+)?gracias|enseguida|ya mismo|ah[ií] va|todav[ií]a no|mejor no|eso|exacto|correcto|tal cual|se[nñ]ora?)`;
/** Lo que agrega el que contesta a quien le pidió algo: «ya te lo mando», «ahora lo veo», «en un rato te lo paso». */
const DEL_QUE_CONTESTA = String.raw`(?:(?:ya|ahora|ah[ií]|enseguida|en un rato|despu[eé]s|ma[nñ]ana)\s+)?(?:(?:te|se|les?)\s+)?(?:(?:lo|la|los|las)\s+)?(?:mando|paso|env[ií]o|hago|confirmo|reviso|miro|veo|subo|cargo|llamo|escribo|vi|hice|mand[eé]|pas[eé]|envi[eé]|confirm[eé]|revis[eé]|cargu[eé])`;
/** «sí Pedro», «dale Ana»: la confirmación con el nombre de la persona a la que le contesta (con mayúscula: sin `i`). */
const CON_SU_NOMBRE = /^(?:[Ss][IiÍí]+|[Dd]ale|[Oo][Kk]|[Ll]isto)[\s,]+\p{Lu}\p{Ll}+[\s.!]*$/u;
/** Lo que con mayúscula NO es el nombre de una persona (la verificación de 991abd4af): un imperativo con su pronombre («Ok
 *  Borralo», «Si Pausala»), a MaKo por su apodo («Dale Makito»), o algo de MaKo («Dale Meta», «Ok Calendly», «Sí, Leads»). */
// (Por la raíz del verbo y no por la terminación: «Leila», «Paola» o «Marcela» terminan igual que «pausala».)
const NO_ES_UN_NOMBRE = /(?<!\p{L})(?:borr|paus|cancel|carg|mand|pas|confirm|agend|activ|apag|prend|envi|hac|haz|pon|elimin|sac|cobr|mov|public|guard|cre|arm|edit|cambi|actualiz|agreg|anot|registr|mostr|abr|reprogram|resolv)\p{L}*(?:lo|la|los|las|le|les|me|nos)[\s.!]*$|(?<!\p{L})(?:mak\p{L}*|meta|calendly|leads?|google|zernio|whatsapp|instagram|facebook|stripe|fathom|zoom|drive|gmail|excel|crm|plan|ads|agenda|campañas?|landing)[\s.!]*$/iu;
/** Los nombres de persona que esa lista se come (la verificación de 96e7840e8): «sí Pascuala» sigue siendo una respuesta. */
const NOMBRE_QUE_PARECE = /(?<!\p{L})(?:pascuala|pasquale|mandela|guardiola|makena)[\s.!]*$/iu;
const RESPUESTA_CORTA = new RegExp(String.raw`^${CONFIRMA}(?:[\s,.!¡;:]+(?:${CONFIRMA}|${DEL_QUE_CONTESTA}))*[\s,.!¡]*(?:\p{Extended_Pictographic}\uFE0F?\s*)*$`, 'iu');
/**
 * Una RESPUESTA corta: pegada a un mensaje para otra persona, le contesta a esa persona. Es un acuse o una confirmación ENTERA
 * («sí», «sí, dale», «dale, ya te lo mando», «ok 👍»), sin nombrar a MaKo ni preguntar (la verificación de 8cb034a18: con sólo
 * el arranque, «listo, agenda a Juan el lunes», «bueno, pásame los leads» o «si entra un lead nuevo avísame» se volvían «a otro»
 * detrás de una mención, y quedaban con 👍 y sin respuesta).
 */
export function esRespuestaCorta(texto: string): boolean {
  const t = (texto || '').trim();
  // Y las confirmaciones CON VERBO («sí, hacelo», «dale, confirmalo», `confirmaAOtro`; la verificación de 9cef25dba): sin ellas,
  // detrás de «@Pedro ¿lo confirmo?» entraban al turno y ejecutaban lo que le llega a un tercero.
  return t.length <= 60 && !t.includes('?') && !/mako/i.test(t) && (esAcusePuro(t) || RESPUESTA_CORTA.test(t) || (CON_SU_NOMBRE.test(t) && (!NO_ES_UN_NOMBRE.test(t) || NOMBRE_QUE_PARECE.test(t))) || confirmaAOtro(t));
}

/** El arranque de un «sí» a MaKo («sí», «dale», «ok», «listo», «confirmo», «adelante»). */
const EMPIEZA_CONFIRMANDO = /^(?:s[ií]+|dale|ok(?:ey)?|listo|confirm\p{L}*|adelante|de una|perfecto|bueno)(?!\p{L})/iu;
/** ¿Confirma y nombra a otro como PARTE del pedido? Antes de la primera @ hay más que la confirmación, y la @ es el objeto
 *  («… avísale a @Pedro», «… agéndalo con @Ana», «… mándalo para @Juan»): no le habla a esa persona. */
export function confirmaYNombraAOtro(texto: string): boolean {
  const antes = (texto || '').trim().split('@')[0].trim();
  return EMPIEZA_CONFIRMANDO.test(antes) && /^\S+[\s,]+\S.*\s(?:a|al|con|para)$/iu.test(antes);
}

/** Quién escribe, para el system: el nombre de WhatsApp. Sin nombre (o uno que es un número), nada. */
export function bloqueQuienEscribe(pushName: string | null | undefined): string {
  const n = (pushName ?? '').trim();
  if (!n || /^\+?\d[\d\s-]*$/.test(n)) return '';
  return `QUIÉN TE ESCRIBE AHORA: ${n.slice(0, 60)} (su nombre de WhatsApp). Si lo nombras, con ese nombre: no lo confundas con el dueño ni con otra persona del grupo.`;
}
