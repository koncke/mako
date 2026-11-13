// =============================================================================
// linea-sorda — la voz de MaKo que MANDA y no RECIBE: detectarla, avisar y dar el QR en un paso (11/11/2026)
// =============================================================================
// EL CASO (11/11/2026, Código Inmobiliario). Martín: «MaKo no responde nada… soluciona eso de una vez por todas». La voz
// (`mako_superadmin_muylqv8r`) estaba `open`, contestaba la sonda y MANDABA (avisos a las 14:03, 14:07, 20:39), pero desde las
// 12:14 UTC no le entró un solo mensaje de una persona: Juanfran mandó un audio, «mako labura», «hola?», «MAKOOOO»; Joan, «queremos
// pagar la cuenta de Nico Sellers». Nada llegó a Evolution. La cola estaba vacía y se leyó como «nadie escribió»: era sordera.
//   · La alarma de DEMORA (lib/linea-demora.ts) no la ve: si no entra nada, no hay nada atrasado.
//   · La sonda del socket (lib/canal-vigilante.ts) tampoco: una línea sorda contesta.
//   · LA CAUSA DE FONDO (informe del 11/11 a la noche, docs/hallazgos-comunicacion.md «La línea sorda»): Evolution 2.3.7 con Baileys
//     7.0.0-rc.9 traba los dispositivos de a uno (Evolution #2647, Baileys #2491). 5 de 10 líneas, no sólo la voz.
//   · ⛔ `POST /instance/restart` NO la cura y no se manda más: es el mismo dispositivo con la misma cola (medido el 11/09, el 9/11 y el
//     11/11 a las 21:31). La primera versión de esto reiniciaba; se sacó. Lo que la cura —por horas o días— es un dispositivo NUEVO:
//     desvincular y escanear el QR.
// LO QUE SE DECIDE ACÁ (puro, con test: tests/linea-sorda.test.ts):
//   1. ESTÁ SORDA, con lo que pasó DESDE QUE SE VINCULÓ (lo de antes es de otro dispositivo), si:
//      · OTRA línea vio mensajes de personas en un grupo compartido que la voz no tiene (la prueba directa, a cualquier hora); o
//      · en horario activo, MaKo mandó 2 o más mensajes a grupos en 30 min y no entró NADA de una persona desde media hora antes del
//        primero (la regla del informe: una respuesta siempre tiene su pedido justo antes); o
//      · en horario activo, MaKo mandó algo después del último mensaje de una persona y ese último tiene más de `SORDA_MS`.
//   2. LA PRIMERA VEZ se avisa por mail y por la campanita —nunca por WhatsApp: la alarma de un canal no viaja por ese canal— con el
//      QR en un paso (`puedeSoltarseSorda`: el panel la desvincula sola). Mientras siga, se repite cada `REPETIR_QR_MS`.
//   3. Cuando vuelve a entrar un mensaje de una persona, se cierra y se avisa que volvió.
// =============================================================================

/** Sin un mensaje de persona en tanto tiempo, con MaKo mandando, la voz está sorda. Medido el 10/11: hubo huecos de 2 h 45 min sin sordera. */
export const SORDA_MS = 3 * 3_600_000;
/** La ráfaga del informe: tantos mensajes de MaKo a grupos en tanto tiempo, sin que entre nada. */
export const RAFAGA_MS = 30 * 60_000;
export const RAFAGA_MIN = 2;
export const REPETIR_QR_MS = 3 * 3_600_000;

/** Horario activo en Argentina (UTC-3, sin horario de verano): de 9 a 23. De noche el silencio no dice nada. */
export function horarioActivo(ahoraMs: number): boolean {
  const h = new Date(ahoraMs - 3 * 3_600_000).getUTCHours();
  return h >= 9 && h < 23;
}

/** Desde cuándo está vinculado el dispositivo de una línea, según `fetchInstances` (ms): su último corte terminal (`disconnectionAt`:
 *  un logout o «Cerrar sesión» desde el teléfono, lo que precede a escanear un QR; medido el 11/11 21:50:20) o su creación. */
export function vinculadaDesdeDe(fila: { createdAt?: unknown; disconnectionAt?: unknown } | null | undefined): number | null {
  const t = [fila?.createdAt, fila?.disconnectionAt].map((x) => (typeof x === 'string' ? Date.parse(x) : NaN)).filter(Number.isFinite);
  return t.length ? Math.max(...t) : null;
}

/** Lo que se leyó de la voz, ya recortado a lo de después de vincularse: la hora (ms) del último mensaje de una persona y del último
 *  propio; lo que otra línea vio y ella no; y la ráfaga (mensajes propios a grupos en los últimos `RAFAGA_MS` y si entró algo). */
export type LecturaDeEscucha = {
  ultimaPersonaMs: number | null; ultimoPropioMs: number | null; ajenosQueNoVio: number;
  aGruposEnRafaga?: number; entroEnRafaga?: boolean; vinculadaDesdeMs?: number | null;
};

export function estaSorda(l: LecturaDeEscucha, ahoraMs: number): { sorda: boolean; motivo: string } {
  if (l.ajenosQueNoVio > 0) return { sorda: true, motivo: `otra línea vio ${l.ajenosQueNoVio} mensaje(s) de personas que la voz no tiene` };
  if (!horarioActivo(ahoraMs)) return { sorda: false, motivo: 'fuera de horario' };
  if ((l.aGruposEnRafaga ?? 0) >= RAFAGA_MIN && l.entroEnRafaga === false) {
    return { sorda: true, motivo: `mandó ${l.aGruposEnRafaga} mensajes a grupos en ${Math.round(RAFAGA_MS / 60_000)} min y no entró ninguno` };
  }
  if (l.ultimoPropioMs == null) return { sorda: false, motivo: 'MaKo no mandó nada' };
  // Recién vinculada y sin nadie que escriba todavía: el silencio se cuenta desde que se vinculó, no desde siempre.
  const persona = Math.max(l.ultimaPersonaMs ?? 0, l.vinculadaDesdeMs ?? 0);
  if (ahoraMs - persona <= SORDA_MS) return { sorda: false, motivo: 'recibe' };
  if (l.ultimoPropioMs <= persona) return { sorda: false, motivo: 'MaKo tampoco mandó nada desde entonces' };
  const horas = l.ultimaPersonaMs == null ? null : Math.round((ahoraMs - l.ultimaPersonaMs) / 360_000) / 10;
  return { sorda: true, motivo: horas == null ? 'manda y no recibió de una persona desde que se vinculó' : `manda y no recibe de una persona hace ${horas} h` };
}

/** Un mensaje como lo devuelve `findMessages` de Evolution (lo que se usa). */
export type MensajeDeLaLinea = { key?: { id?: string; fromMe?: boolean; remoteJid?: string; participantAlt?: string }; messageTimestamp?: number | string; messageType?: string };

/**
 * La lectura de la voz a partir de su store: sin duplicados (Evolution guarda dos veces cada envío, con el mismo `key.id`; medido el
 * 11/11), sin reacciones (un 👍 no es un mensaje), y sólo lo de DESPUÉS de vincularse. `esDeMaKo` reconoce lo que MaKo escribió visto
 * como ajeno (su número en `participantAlt`).
 */
export function lecturaDeLaVoz(mensajes: readonly MensajeDeLaLinea[], ahoraMs: number, o: { vinculadaDesdeMs?: number | null; esDeMaKo?: (alt: unknown) => boolean } = {}): Omit<LecturaDeEscucha, 'ajenosQueNoVio'> {
  const desde = o.vinculadaDesdeMs ?? 0;
  const vistos = new Set<string>();
  const ts = (m: MensajeDeLaLinea) => Number(m.messageTimestamp) * 1000;
  const unicos = mensajes.filter((m) => {
    const id = m.key?.id;
    if (id) { if (vistos.has(id)) return false; vistos.add(id); }
    return m.messageType !== 'reactionMessage' && Number.isFinite(ts(m)) && ts(m) > desde && ts(m) <= ahoraMs + 60_000;
  });
  const personas = unicos.filter((m) => !m.key?.fromMe && !(o.esDeMaKo?.(m.key?.participantAlt) ?? false));
  const suyos = unicos.filter((m) => m.key?.fromMe);
  const enRafaga = suyos.filter((m) => String(m.key?.remoteJid ?? '').endsWith('@g.us') && ahoraMs - ts(m) <= RAFAGA_MS);
  const primero = enRafaga.length ? Math.min(...enRafaga.map(ts)) : null;
  return {
    ultimaPersonaMs: personas.length ? Math.max(...personas.map(ts)) : null,
    ultimoPropioMs: suyos.length ? Math.max(...suyos.map(ts)) : null,
    aGruposEnRafaga: enRafaga.length,
    entroEnRafaga: primero == null ? undefined : personas.some((m) => ts(m) >= primero - RAFAGA_MS),
    vinculadaDesdeMs: o.vinculadaDesdeMs ?? null,
  };
}

/** Lo que se guarda entre corridas (app_settings de la plataforma). ISO, salvo `vinculadaDesde` (ms, de Evolution). `linea` y
 *  `vinculadaDesde` son lo que mira el panel para dar el QR en un paso (`puedeSoltarseSorda`). */
export type MarcaDeSordera = { desde: string; avisadaAt: string | null; linea?: string; vinculadaDesde?: number | null; motivo?: string };

export type Accion = 'nada' | 'avisar' | 'pedir-qr' | 'volvio';

/** Qué hacer ahora, y la marca que queda. `marca` null = no estaba sorda. La marca vieja (`reiniciadaAt`/`qrPedidoAt`, la versión que
 *  reiniciaba) se lee igual: lo último que se avisó.
 *  ⚠️ «NO ESTÁ SORDA» NO ES «VOLVIÓ» (12/11/2026). `estaSorda` dice que no también cuando no puede decidir: de noche («fuera de
 *  horario»: nadie escribe entre las 3 y las 8 de Argentina, medido en 8 días) o si MaKo no mandó nada. Con eso, cada noche a las 23 la
 *  marca se borraba con un mail de «volvió a recibir» falso, y el panel perdía el QR en un paso. Volvió sólo con la PRUEBA: un mensaje
 *  de una persona con hora POSTERIOR a la marca (`ultimaPersonaMs`; lo que llega tarde, en tanda, trae su hora vieja y no cuenta). Si
 *  la re-vincularon después de marcarla, la marca es de otro dispositivo: se limpia sin aviso, que nadie escribió todavía. */
export function queHacerConLaSordera(sorda: boolean, marca: MarcaDeSordera | null, ahoraMs: number, extra: Pick<MarcaDeSordera, 'linea' | 'vinculadaDesde' | 'motivo'> = {}, ultimaPersonaMs: number | null = null): { accion: Accion; marca: MarcaDeSordera | null } {
  const ahora = new Date(ahoraMs).toISOString();
  if (!sorda) {
    if (!marca) return { accion: 'nada', marca: null };
    if (ultimaPersonaMs != null && ultimaPersonaMs > Date.parse(marca.desde)) return { accion: 'volvio', marca: null };
    if (extra.vinculadaDesde != null && marca.vinculadaDesde != null && extra.vinculadaDesde > marca.vinculadaDesde) return { accion: 'nada', marca: null };
    return { accion: 'nada', marca };
  }
  if (!marca) return { accion: 'avisar', marca: { desde: ahora, avisadaAt: ahora, ...extra } };
  const vieja = marca as MarcaDeSordera & { qrPedidoAt?: string | null; reiniciadaAt?: string | null };
  const ultimo = vieja.avisadaAt ?? vieja.qrPedidoAt ?? vieja.reiniciadaAt ?? null;
  const sigue = { desde: marca.desde, avisadaAt: ultimo, ...extra };
  if (!ultimo || ahoraMs - Date.parse(ultimo) >= REPETIR_QR_MS) return { accion: 'pedir-qr', marca: { ...sigue, avisadaAt: ahora } };
  return { accion: 'nada', marca: sigue };
}

/**
 * ¿El panel puede desvincular esta línea y dar el QR aunque la sonda diga «viva»? Sólo si está MARCADA (sorda o atrasada) y la marca
 * se midió sobre la MISMA vinculación que tiene ahora. ⛔ Si se re-vinculó después de marcarla (otro QR, otro dispositivo), la marca
 * es de un dispositivo que ya no existe: soltar la línea nueva sería desvincular a la que se acaba de curar. Sin saber cuándo se
 * vinculó, tampoco: el guard de la sonda queda en pie.
 */
export function puedeSoltarseSorda(marca: { vinculadaDesde?: number | null } | null | undefined, vinculadaAhora: number | null): boolean {
  return !!marca && marca.vinculadaDesde != null && vinculadaAhora != null && marca.vinculadaDesde >= vinculadaAhora;
}

/**
 * Lo que el panel dice de una línea que figura CONECTADA y no recibe, o null si no hay nada que decir (13/11/2026).
 *
 * «Tu número» (/agencia) dibujaba «Vincular por QR» sólo con la línea desconectada, y una sorda figura conectada: para re-vincular el
 * …3479, Martín tenía que cerrar el dispositivo desde el teléfono primero. `conectar` (lib/evolution.ts) ya sabía soltarla y dar el
 * QR en un paso; faltaba el botón. Se ofrece con la MISMA condición con la que `conectar` la suelta (`puedeSoltarseSorda`): si el
 * botón apareciera sin ella, el clic diría «ya está conectada» y no daría nada.
 */
export function motivoParaVolverAVincular(
  marca: { motivo: string; vinculadaDesde?: number | null } | null | undefined,
  vinculadaAhora: number | null,
): string | null {
  return marca && puedeSoltarseSorda(marca, vinculadaAhora) ? marca.motivo : null;
}

/** Los pasos para re-vincular la voz. Con la marca, el panel la desvincula solo y da el QR (lib/mako-canal.ts, `conectarCanalMaKo`). */
export const PASOS_QR = [
  '1. En hola-mako.com/agencia → «Conectar por QR»: como está marcada sorda, la desvincula sola y muestra el QR.',
  '2. Escanearlo con el teléfono de MaKo (…2605).',
  '3. Lo que llegue por la resincronización no lo atiende MaKo sola: hay que leer los grupos y contestar lo que quedó.',
  'Si el panel igual dice que ya está conectada: en ese teléfono, WhatsApp → Dispositivos vinculados → Cerrar sesión, y otra vez «Conectar por QR».',
].join('\n');

/** Los pasos cuando la voz es la línea de Martín (el …3479, «Tu número»: su decisión del 13/11/2026). Mismo panel, otro botón y otro teléfono. */
export const PASOS_QR_TU_NUMERO = [
  '1. En hola-mako.com/agencia → «Tu número» → «Volver a vincular por QR»: como está marcada sorda, la desvincula sola y muestra el QR.',
  '2. Escanearlo con tu teléfono personal: WhatsApp → Dispositivos vinculados → Vincular un dispositivo.',
  '3. Lo que llegue por la resincronización no lo atiende MaKo sola: hay que leer los grupos y contestar lo que quedó.',
  'Si el botón no aparece: en ese teléfono, WhatsApp → Dispositivos vinculados → Cerrar sesión del dispositivo de MaKo, y «Vincular por QR».',
].join('\n');

/**
 * Los pasos para la línea que es la voz. ⚠️ No son siempre los del canal: el 13/11/2026 la voz estaba en el …3479 y el aviso decía
 * «Conectar por QR» y «el teléfono de MaKo (…2605)», el botón y el teléfono equivocados.
 */
export const pasosQrDe = (linea: string): string => (linea.startsWith('mako_superadmin') ? PASOS_QR : PASOS_QR_TU_NUMERO);

/** El aviso (mail y campanita) de cada acción, armado por el código. */
export function avisoDeSordera(accion: Exclude<Accion, 'nada'>, motivo: string, linea: string): { titulo: string; cuerpo: string } {
  if (accion === 'volvio') return { titulo: 'La voz de MaKo volvió a recibir', cuerpo: `${linea} volvió a recibir mensajes de personas.` };
  const cabeza = accion === 'avisar'
    ? `⛔ La voz de MaKo (${linea}) MANDA pero NO RECIBE: ${motivo}. Los clientes le escriben y MaKo no se entera. Un reinicio no la cura (medido el 11/09, el 9/11 y el 11/11): hay que re-vincularla.`
    : `⛔ La voz de MaKo (${linea}) sigue sin recibir: ${motivo}. Hay que re-vincularla.`;
  const fondo = 'La causa de fondo es la versión de la librería de WhatsApp de Evolution (Baileys 7.0.0-rc.9): el QR la cura por horas o días.';
  return { titulo: accion === 'avisar' ? 'La voz de MaKo no recibe mensajes' : 'La voz de MaKo sigue sorda: hace falta el QR', cuerpo: `${cabeza}\n\n${pasosQrDe(linea)}\n\n${fondo}` };
}
