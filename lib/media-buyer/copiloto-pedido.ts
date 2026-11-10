// =============================================================================
// Marketing CoPilot — leer lo que ESCRIBE la persona: ¿pregunta por otro funnel o lo pide? (9/11/2026)
// =============================================================================
// En un archivo propio porque reconoce el voseo de quien escribe («guardalo», «hacelo»): está declarado en
// tests/puente-panel-copy.test.ts → FUERA_DE_ALCANCE (es un detector, no copy que le hable a nadie). Así lib/media-buyer/copiloto.ts
// sigue dentro del barrido de voseo.
// =============================================================================

import { plano } from './copiloto';

/**
 * ¿La persona PREGUNTA por otro funnel («¿y si en vez de anuncios hago orgánico?», «¿me conviene YouTube?») en vez de pedirlo?
 * La batería del 9/11/2026 (tres corridas): el modelo cambiaba el funnel con una tarjeta ante la pregunta, aunque la regla B del
 * prompt le dijera que compare primero. Lo cumple el CÓDIGO (lib/api-mako/areas/ads.run.ts → `copiloto_media_buyer`): con una pregunta
 * así no se propone cambiar el funnel. Un pedido claro («cambiemos a orgánico», «dale, guardalo», «prefiero YouTube») sí pasa.
 */
export function esPreguntaHipotetica(texto: string | null | undefined): boolean {
  const l = plano(texto ?? '');
  if (!l.includes('?')) return false;
  const hipotesis = /\by si\b|\bque pasa si\b|\ben vez de\b|\ben lugar de\b|\bconviene\b|\bme sirve\b|\bsirve\b|\bes mejor\b|\bvale la pena\b|\bfunciona\b/.test(l);
  const pide = /\bguarda|\bguardalo\b|\bcambi(a|alo|emos|ar a)\b|\bdale\b|\bhacelo\b|\bhazlo\b|\bprefiero\b|\bquiero (cambiar|pasar|ir con|hacer|probar)\b|\bvamos con\b/.test(l);
  return hipotesis && !pide;
}
