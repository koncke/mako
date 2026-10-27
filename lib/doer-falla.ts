// =============================================================================
// doer-falla — cuando la persona le cuenta a MaKo que algo NO ANDA: el ticket a mano, y la causa si se sabe (27/10/2026)
// =============================================================================
// Leila (26/10), cuatro intentos: «no puede analizar la llamada de fathom» → MaKo: «puede deberse a un problema con la
// grabación». Ella: «y tú eres el servicio técnico». La causa era SU Claude sin crédito, y el propio MaKo se lo había avisado a
// las 15:31. Dos huecos:
//   · el reporte caía en charlar o en «capturar (dudosa)», y `levantar_ticket` sólo viaja en «actuar»
//     (lib/doer-herramientas.ts): MaKo no podía ofrecer el ticket, contestaba como un manual;
//   · MaKo no sabía que SU IA estaba fallando: eso vive en `anthropic_usage` (lib/su-clave.ts, `estadoDeSusClaves`).
// El mismo criterio que el chat de la app («lo que no existe se dice y sale el ticket», «MaKo inteligente»).
//
// PURO y sin `server-only`: lo usan lib/mako-doer-in.ts y tests/doer-falla.test.ts.
// =============================================================================

import type { EstadoSuClave, ProvSuClave } from './su-clave-reglas';

/**
 * ¿Cuenta que algo de MaKo no anda? «no puede analizar la llamada», «no me deja agendar», «sigue sin funcionar», «tras 4
 * intentos», «dejó de andar», «y tú eres el servicio técnico». ⚠️ Un lead que no contesta no es una falla de MaKo: eso lo
 * decide el modelo con la nota (`bloqueDeLaFalla`), que pide distinguirlo; acá sólo se abre la puerta del ticket. Los bordes
 * son de letra (`\p{L}`), no ``: el de JavaScript es ASCII y «se colgó» no tenía borde después de la «ó».
 */
const FALLA = new RegExp([
  String.raw`(?<!\p{L})no\s+(?:me\s+|te\s+|le\s+|lo\s+|la\s+)?(?:funciona|anda|carga|deja|puede|pudo|pude|sale|llega|abre|guarda|analiza|responde|aparece|muestra|conecta|sincroniza)(?!\p{L})`,
  String.raw`(?<!\p{L})no\s+est[aá]\s+(?:funcionando|andando|cargando)(?!\p{L})`,
  String.raw`(?<!\p{L})dej[oó]\s+de\s+(?:funcionar|andar|cargar)(?!\p{L})`,
  String.raw`(?<!\p{L})sigue\s+sin(?!\p{L})`,
  String.raw`(?<!\p{L})(?:tras|despu[eé]s\s+de)\s+\d+\s+intentos(?!\p{L})`,
  String.raw`(?<!\p{L})(?:da|tira|sale|aparece)\s+(?:un\s+)?error(?!\p{L})`,
  String.raw`(?<!\p{L})se\s+(?:rompi[oó]|colg[oó]|trab[oó]|cay[oó])(?!\p{L})`,
  String.raw`(?<!\p{L})(?:est[aá]|qued[oó])\s+roto(?!\p{L})`,
  String.raw`(?<!\p{L})(?:eres|sos)\s+(?:el\s+)?(?:servicio\s+t[eé]cnico|soporte)(?!\p{L})`,
].join('|'), 'iu');

export function reportaFalla(texto: string): boolean {
  return FALLA.test(texto || '');
}

const NOMBRE: Record<ProvSuClave, string> = { anthropic: 'tu Claude', openai: 'tu GPT', gemini: 'tu Gemini' };

/** Las claves del negocio que están FALLANDO ahora: su último fallo es más nuevo que su último «anduvo». */
export function clavesQueFallan(estados: readonly EstadoSuClave[] | null | undefined): EstadoSuClave[] {
  return (estados ?? []).filter((e) => e.fallo && (!e.anduvo || Date.parse(e.fallo.at) > Date.parse(e.anduvo)));
}

const hace = (iso: string, ahora: number): string => {
  const min = Math.max(1, Math.round((ahora - Date.parse(iso)) / 60_000));
  return min < 60 ? `hace ${min} min` : min < 48 * 60 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} días`;
};

/**
 * La nota del system para un turno que REPORTA una falla: proponer el ticket (con lo que pasó) en vez de contestar como un
 * manual, y nombrar la causa si una IA del negocio está fallando. Sin `estados` (no se pudieron leer), no se afirma nada.
 */
export function bloqueDeLaFalla(estados: readonly EstadoSuClave[] | null | undefined, ahora: number): string {
  const fallan = clavesQueFallan(estados);
  const causa = fallan.length
    ? `\nLO QUE YA SABES: ${fallan.map((e) => `${NOMBRE[e.proveedor]} viene fallando (${hace(e.fallo!.at, ahora)}: «${e.fallo!.motivo}»)`).join('; ')}. Si lo que no anda depende de su IA, ÉSA es la causa: dila primero, con el link para arreglarla, y no inventes otra («puede deberse a la grabación»).`
    : '';
  return `LA PERSONA TE CUENTA QUE ALGO NO ANDA. Si es una falla de MaKo (no de un lead ni de un tercero): no contestes como un manual de soporte. Di qué sabes de la causa, y propón levantar un ticket con levantar_ticket, con lo que pasó y cuántas veces lo intentó; queda propuesto hasta su «sí».${causa}`;
}
