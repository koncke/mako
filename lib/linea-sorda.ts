// =============================================================================
// linea-sorda — la voz de MaKo que MANDA y no RECIBE: detectarla, reiniciarla y pedir el QR (11/11/2026)
// =============================================================================
// EL CASO (11/11/2026, Código Inmobiliario). Martín: «MaKo no responde nada… soluciona eso de una vez por todas». La voz
// (`mako_superadmin_muylqv8r`) estaba `open`, contestaba la sonda y MANDABA (avisos a las 14:03, 14:07, 20:39), pero desde las
// 12:14 UTC no le entró un solo mensaje de una persona: Juanfran mandó un audio, «mako labura», «hola?», «MAKOOOO»; Joan, «queremos
// pagar la cuenta de Nico Sellers». Nada llegó a Evolution. La cola estaba vacía y se leyó como «nadie escribió»: era sordera.
//   · La alarma de DEMORA (lib/linea-demora.ts) no la ve: si no entra nada, no hay nada atrasado.
//   · La sonda del socket (lib/canal-vigilante.ts) tampoco: una línea sorda contesta.
//   · `POST /instance/restart` NO la cura: medido el 11/09, el 9/11 y otra vez hoy (21:31 reiniciada, el «PRUEBA» de Martín de las
//     21:36 no llegó). Lo que la curó las dos veces fue re-vincular la línea (QR o código desde el teléfono de MaKo).
// LO QUE SE DECIDE ACÁ (puro, con test: tests/linea-sorda.test.ts):
//   1. ESTÁ SORDA si, en horario activo, MaKo mandó algo después del último mensaje de una persona y ese último tiene más de
//      `SORDA_MS`; o si OTRA línea vio mensajes de personas en un grupo compartido que la voz no tiene (la prueba directa).
//   2. LA PRIMERA VEZ: se reinicia (barato, a veces alcanza) y se avisa YA con los pasos del QR, por mail y por la campanita —nunca
//      por WhatsApp: la alarma de un canal no viaja por ese canal—. Si a los `ESPERA_TRAS_REINICIO_MS` sigue sorda, se insiste con el
//      QR (una vez por `REPETIR_QR_MS`).
//   3. Cuando vuelve a entrar un mensaje de una persona, se cierra y se avisa que volvió.
// =============================================================================

/** Sin un mensaje de persona en tanto tiempo, con MaKo mandando, la voz está sorda. Medido el 10/11: hubo huecos de 2 h 45 min sin sordera. */
export const SORDA_MS = 3 * 3_600_000;
export const ESPERA_TRAS_REINICIO_MS = 20 * 60_000;
export const REPETIR_QR_MS = 3 * 3_600_000;

/** Horario activo en Argentina (UTC-3, sin horario de verano): de 9 a 23. De noche el silencio no dice nada. */
export function horarioActivo(ahoraMs: number): boolean {
  const h = new Date(ahoraMs - 3 * 3_600_000).getUTCHours();
  return h >= 9 && h < 23;
}

/** Lo que se leyó de la voz: la hora (ms) del último mensaje de una persona y del último propio; y lo que otra línea vio y ella no. */
export type LecturaDeEscucha = { ultimaPersonaMs: number | null; ultimoPropioMs: number | null; ajenosQueNoVio: number };

export function estaSorda(l: LecturaDeEscucha, ahoraMs: number): { sorda: boolean; motivo: string } {
  if (l.ajenosQueNoVio > 0) return { sorda: true, motivo: `otra línea vio ${l.ajenosQueNoVio} mensaje(s) de personas que la voz no tiene` };
  if (!horarioActivo(ahoraMs)) return { sorda: false, motivo: 'fuera de horario' };
  if (l.ultimoPropioMs == null) return { sorda: false, motivo: 'MaKo no mandó nada' };
  const persona = l.ultimaPersonaMs ?? 0;
  if (ahoraMs - persona <= SORDA_MS) return { sorda: false, motivo: 'recibe' };
  if (l.ultimoPropioMs <= persona) return { sorda: false, motivo: 'MaKo tampoco mandó nada desde entonces' };
  const horas = l.ultimaPersonaMs == null ? null : Math.round((ahoraMs - l.ultimaPersonaMs) / 360_000) / 10;
  return { sorda: true, motivo: horas == null ? 'manda y nunca recibió de una persona' : `manda y no recibe de una persona hace ${horas} h` };
}

/** Lo que se guarda entre corridas (app_settings de la plataforma). ISO. */
export type MarcaDeSordera = { desde: string; reiniciadaAt: string | null; qrPedidoAt: string | null };

export type Accion = 'nada' | 'reiniciar-y-avisar' | 'pedir-qr' | 'volvio';

/** Qué hacer ahora, y la marca que queda. `marca` null = no estaba sorda. */
export function queHacerConLaSordera(sorda: boolean, marca: MarcaDeSordera | null, ahoraMs: number): { accion: Accion; marca: MarcaDeSordera | null } {
  const ahora = new Date(ahoraMs).toISOString();
  if (!sorda) return marca ? { accion: 'volvio', marca: null } : { accion: 'nada', marca: null };
  if (!marca || !marca.reiniciadaAt) return { accion: 'reiniciar-y-avisar', marca: { desde: marca?.desde ?? ahora, reiniciadaAt: ahora, qrPedidoAt: ahora } };
  const tras = ahoraMs - Date.parse(marca.reiniciadaAt);
  const ultimoQr = marca.qrPedidoAt ? ahoraMs - Date.parse(marca.qrPedidoAt) : Infinity;
  if (tras >= ESPERA_TRAS_REINICIO_MS && ultimoQr >= Math.min(REPETIR_QR_MS, tras)) return { accion: 'pedir-qr', marca: { ...marca, qrPedidoAt: ahora } };
  return { accion: 'nada', marca };
}

/** Los pasos para re-vincular la voz, como los midió el 10/11 (el panel no reconecta una línea que contesta la sonda). */
export const PASOS_QR = [
  '1. En el teléfono de MaKo (…2605): WhatsApp → Dispositivos vinculados → tocar el dispositivo de MaKo → Cerrar sesión.',
  '2. En hola-mako.com/agencia → «Conectar por QR», y escanearlo con ese mismo teléfono.',
  '3. Lo que llegue por la resincronización no lo atiende MaKo sola: hay que leer los grupos y contestar lo que quedó.',
].join('\n');

/** El aviso (mail y campanita) de cada acción, armado por el código. */
export function avisoDeSordera(accion: Exclude<Accion, 'nada'>, motivo: string, linea: string): { titulo: string; cuerpo: string } {
  if (accion === 'volvio') return { titulo: 'La voz de MaKo volvió a recibir', cuerpo: `${linea} volvió a recibir mensajes de personas.` };
  const cabeza = accion === 'reiniciar-y-avisar'
    ? `⛔ La voz de MaKo (${linea}) MANDA pero NO RECIBE: ${motivo}. Los clientes le escriben y MaKo no se entera. La reinicié; un reinicio casi nunca la cura (medido el 11/09, el 9/11 y el 11/11), así que hay que re-vincularla:`
    : `⛔ La voz de MaKo (${linea}) sigue sin recibir después del reinicio: ${motivo}. Hay que re-vincularla:`;
  return { titulo: accion === 'reiniciar-y-avisar' ? 'La voz de MaKo no recibe mensajes' : 'La voz de MaKo sigue sorda: hace falta el QR', cuerpo: `${cabeza}\n\n${PASOS_QR}` };
}
