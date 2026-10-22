// =============================================================================
// doer-claves — MaKo en WhatsApp tapa las claves pegadas en el grupo (WA2, 22/10/2026)
// =============================================================================
// La pieza 1.6 (lib/claves-en-el-chat.ts) tapa las claves en el chat de la app desde el 20/10. En el grupo de WhatsApp no
// (docs/ia-del-cliente.md §13): una clave pegada llegaba al modelo y quedaba entera en `mako_doer_buffer` (el payload
// crudo) y en `mako_doer_conv`. Desde el 22/10 se les pide a los clientes su clave de API (IA4), y alguno la va a pegar en
// el grupo.
//
// Se tapa el MENSAJE ENTERO al entrar, antes de todo lo demás (`manejarEntranteDoer`): el texto, el caption de una foto o
// un documento, el mensaje citado (un «responder» trae copiado el texto del otro), y por eso también el payload que va a la
// cola. Desde ahí el crudo no se vuelve a leer. Los campos binarios (base64, miniaturas, llaves de medios) no se tocan: no
// los escribe una persona, y tapar un pedazo de base64 rompe la imagen.
//
// Lo que no se puede tapar: una clave DENTRO de una foto o un PDF (va nativo al modelo) y la que se dice en una nota de voz.
//
// Pura (sin `server-only`): la prueba la importa.
// =============================================================================

import { CLAVE_TAPADA, taparClaves } from './claves-en-el-chat';

/** Lo binario de un mensaje de Evolution: no lo escribe nadie, y tapar un pedazo lo rompe. */
const NO_SE_TOCA = new Set([
  'base64', 'jpegThumbnail', 'thumbnail', 'mediaKey', 'fileSha256', 'fileEncSha256', 'directPath', 'url',
  'thumbnailDirectPath', 'thumbnailSha256', 'thumbnailEncSha256', 'messageSecret', 'streamingSidecar', 'waveform',
]);

type Tapado = { tapadas: number; servicio: string | null };

function taparEn(v: unknown, cuenta: Tapado): unknown {
  if (typeof v === 'string') {
    const t = taparClaves(v);
    if (t.tapadas) { cuenta.tapadas += t.tapadas; cuenta.servicio ??= t.servicio; }
    return t.tapadas ? t.texto : v;
  }
  if (Array.isArray(v)) return v.map((x) => taparEn(x, cuenta));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = NO_SE_TOCA.has(k) ? x : taparEn(x, cuenta);
    return out;
  }
  return v;
}

/**
 * El mensaje con cada clave tapada en TODO lo que trae, salvo `key` (el id y el grupo, que no escribe nadie y deduplican la
 * cola) y lo binario, y cuántas tapó. Una copia: el original no se toca. Nunca tira.
 *
 * ⚠️ TODO EL MENSAJE, NO SÓLO `message` (revisión del lote 1, 22/10/2026). Evolution v2 manda la cita DOS veces: adentro de
 * `message.…contextInfo` y en `contextInfo.quotedMessage` en el nivel de arriba. Recorriendo sólo `message`, quien citaba el
 * mensaje con la clave la dejaba entera en `mako_doer_buffer.payload`, y el aviso decía «no la guardé».
 */
export function taparClavesDelMensaje<T extends object>(m: T): { mensaje: T; tapadas: number; servicio: string | null } {
  const cuenta: Tapado = { tapadas: 0, servicio: null };
  if (!m || typeof m !== 'object' || Array.isArray(m)) return { mensaje: m, tapadas: 0, servicio: null };
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(m as Record<string, unknown>)) out[k] = k === 'key' || NO_SE_TOCA.has(k) ? x : taparEn(x, cuenta);
  return cuenta.tapadas ? { mensaje: out as T, ...cuenta } : { mensaje: m, tapadas: 0, servicio: null };
}

/** ¿Después de tapar no queda nada que contestar? (el mensaje era sólo la clave). */
export const soloLaClave = (texto: string): boolean => !texto.split(CLAVE_TAPADA).join('').trim();

/**
 * Lo que se le dice en el grupo. En WhatsApp el mensaje con la clave SIGUE en el grupo (MaKo no puede borrar lo que manda
 * otro): por eso no dice «no quedó en el chat», como la app, sino que se la borre. Y el link a su conexión.
 */
export function avisoClaveTapadaEnElGrupo(link: string): string {
  return `🔒 Tapé tu clave: no la guardé ni se la pasé a la IA. Bórrala del grupo y pégala aquí: ${link}`;
}
