// =============================================================================
// onboarding-troleo — reconoce un mensaje de troll en el onboarding (lo usa lib/onboarding-guardia.ts)
// =============================================================================
// Es un DETECTOR: nombra las formas para reconocer lo que alguien ESCRIBE, voseo incluido («sos un inútil»), y por
// eso está en `FUERA_DE_ALCANCE` de la guarda de voseo (tests/puente-panel-copy.test.ts). Nada de acá se le muestra
// a nadie: el copy (los mensajes que lee el cliente) vive en lib/onboarding-guardia.ts, que sí está vigilado.
// =============================================================================

const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Insultos DIRIGIDOS, no malas palabras sueltas: «me va de la mierda» es alguien contando su mes, no un troll. Por eso
 * cuenta sólo el insulto a alguien (te/eres/sos/vos/… cerca) o los que no tienen otro uso.
 */
const INSULTO_SIEMPRE = /\b(?:hijo\s+de\s+puta|hdp|conchetumadre|concha\s+de\s+tu\s+madre|malparid[oa]|gonorrea|chupame|chupa\s+pija|la\s+concha\s+de\s+tu)\b/;
const PALABRA_INSULTO = '(?:idiota|imbecil|estupid[oa]|pelotud[oa]|forr[oa]|tarad[oa]|inutil|mierda|puto|puta|pendej[oa]|culer[oa]|cabron|mamon|retrasad[oa])';
/** «sos un inútil», «eres una idiota», «mako estúpido»: el insulto a ALGUIEN, con hasta dos palabras en el medio. */
const INSULTO_DIRIGIDO = new RegExp(`\\b(?:eres|sos|son|vos|bot|mako|maquina)\\s+(?:(?:un|una|muy|tan|re|el|la|lo|bien|mas|terrible)\\s+){0,2}${PALABRA_INSULTO}\\b`);
/** Un mensaje corto que es sólo el insulto («idiota», «cállate pendejo»). En uno largo, la palabra suele ser otra cosa. */
const INSULTO_SUELTO = new RegExp(`\\b${PALABRA_INSULTO}\\b`);

/** Intentos de sacar a MaKo de su papel para usarla gratis como un chat cualquiera (y pagarlo Martín). */
// «Actúa como…» sólo al principio de una oración (u «ahora actúa como»): «mi equipo actúa como consultor» es su negocio.
const INYECCION = /\b(?:ignora|olvida|olvidate)\b[^.]{0,40}\b(?:instrucciones|reglas|indicaciones)\b|\bsystem\s+prompt\b|\bprompt\s+del\s+sistema\b|(?:^|[.!?]\s*|\bahora\s+)act(?:ua|úa)\s+como\b|\bjailbreak\b|\bmodo\s+desarrollador\b|\bdan\s+mode\b/;

/** Basura: teclado aporreado, una letra repetida, o un texto largo sin palabras. */
function esBasura(t: string): boolean {
  const s = t.replace(/\s+/g, ' ').trim();
  if (s.length < 6) return false;
  if (/(.)\1{9,}/.test(s)) return true;
  if (/^(?:asdf|qwer|zxcv|jkl|hjkl)+/i.test(s.replace(/\s/g, ''))) return true;
  const letras = s.replace(/[^\p{L}]/gu, '');
  if (letras.length >= 20) {
    const vocales = letras.replace(/[^aeiouáéíóúAEIOUÁÉÍÓÚ]/g, '').length;
    if (vocales / letras.length < 0.12) return true;
  }
  // La misma palabra repetida una y otra vez («hola hola hola hola hola hola»).
  const palabras = s.toLowerCase().split(' ').filter(Boolean);
  if (palabras.length >= 8 && new Set(palabras).size <= 2) return true;
  return false;
}

/** ¿Este mensaje es una falta? Devuelve por qué, o null. Lo que es legítimo pasa: ante la duda, no es falta. */
export function falta(texto: string): 'insulto' | 'inyeccion' | 'basura' | null {
  const t = sinTildes(texto || '');
  if (!t.trim()) return null;
  if (INSULTO_SIEMPRE.test(t)) return 'insulto';
  if (INSULTO_DIRIGIDO.test(t)) return 'insulto';
  if (t.trim().split(/\s+/).length <= 4 && INSULTO_SUELTO.test(t)) return 'insulto';
  if (INYECCION.test(t)) return 'inyeccion';
  if (esBasura(texto)) return 'basura';
  return null;
}

