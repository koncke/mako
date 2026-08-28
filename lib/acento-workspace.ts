// =============================================================================
// acento-workspace — con qué acento habla el avatar de ESTE cliente
// =============================================================================
// SIN `server-only`: la condición se testea con objetos literales, y la pantalla
// necesita el rótulo para mostrarlo.
//
// ── Por qué esto existe ─────────────────────────────────────────────────────
// El acento era un paso del wizard: se preguntaba en cada anuncio. El dueño lo
// sacó, y tiene razón — es un atributo del CLIENTE, no del anuncio. Nadie graba
// un video en norteño y el siguiente en rioplatense.
//
// ⚠️ Y equivocarlo no se nota al leer: se nota recién cuando alguien lo dice en
// voz alta. Por eso no puede quedar en un default silencioso.
//
// ── Esto es una INFERENCIA, y hay que decirlo ───────────────────────────────
// Hoy MaKo NO tiene un campo de país. Ni en el brief, ni en los avatares, ni en
// la personalidad, ni en la tabla `workspaces`. Lo más cerca es la zona horaria
// (`mako.timezone`), que se resuelve sola preguntándole a Cal.com o a Google
// Calendar — o sea, un dato real pero indirecto.
//
// Así que esto ADIVINA, y el tipo lo dice: `seguro: false` cuando salió de la
// zona horaria. El día que el onboarding de la tab pregunte el acento, ese valor
// gana y `seguro` pasa a true. Un dato inferido que se presenta como declarado es
// exactamente cómo se cuela un error que nadie audita.

/** Las variedades que el generador sabe pedirle al modelo. */
export const ACENTOS_ES = {
  'mx-norte': 'Northern Mexican Spanish (Baja California, Sonora, Sinaloa)',
  'mx-neutro': 'neutral Mexican Spanish',
  'mx-cdmx': 'Mexico City Spanish (chilango)',
  'co': 'Colombian Spanish (Bogotá)',
  'ar': 'Argentine Spanish (Rioplatense)',
  'es': 'Peninsular Spanish (Spain)',
  'latam': 'neutral Latin American Spanish',
} as const;

export type AcentoId = keyof typeof ACENTOS_ES;

export type AcentoResuelto = {
  id: AcentoId;
  /** El texto en inglés que viaja al modelo. */
  prompt: string;
  /** Cómo se lo nombra en pantalla. */
  etiqueta: string;
  /**
   * `false` cuando salió de una inferencia (la zona horaria) en vez de un dato
   * declarado. La pantalla lo muestra distinto, y con eso alguien lo corrige.
   */
  seguro: boolean;
  /** De dónde salió, para que se pueda auditar sin leer el código. */
  origen: 'declarado' | 'zona-horaria' | 'default';
};

const ETIQUETA: Record<AcentoId, string> = {
  'mx-norte': 'Mexicano del norte',
  'mx-neutro': 'Mexicano neutro',
  'mx-cdmx': 'Mexicano de CDMX',
  co: 'Colombiano',
  ar: 'Argentino (rioplatense)',
  es: 'Español de España',
  latam: 'Latino neutro',
};

/**
 * Zonas horarias → acento.
 *
 * Va en POSITIVO: solo se afirma lo que está en la tabla. Una zona que no está
 * NO cae en «entonces es mexicano»: cae en el neutro, marcado como inseguro.
 *
 * `America/Tijuana` es la primera fila y no es casual: es donde vive el primer
 * cliente (Mauricio, Baja California). El repo ya lo tiene documentado como «un
 * cliente norteño de México», y pedirle acento de CDMX costó una tanda entera de
 * guiones.
 */
const POR_ZONA: Record<string, AcentoId> = {
  'America/Tijuana': 'mx-norte',
  'America/Hermosillo': 'mx-norte',
  'America/Mazatlan': 'mx-norte',
  'America/Chihuahua': 'mx-norte',
  'America/Monterrey': 'mx-norte',
  'America/Mexico_City': 'mx-cdmx',
  'America/Merida': 'mx-neutro',
  'America/Cancun': 'mx-neutro',
  'America/Bogota': 'co',
  'America/Argentina/Buenos_Aires': 'ar',
  'America/Montevideo': 'ar',
  'Europe/Madrid': 'es',
};

function armar(id: AcentoId, origen: AcentoResuelto['origen']): AcentoResuelto {
  return {
    id,
    prompt: ACENTOS_ES[id],
    etiqueta: ETIQUETA[id],
    seguro: origen === 'declarado',
    origen,
  };
}

/**
 * Resuelve el acento de un workspace.
 *
 * @param declarado lo que el cliente eligió en el onboarding de la tab, si existe.
 *                  Gana siempre: un dato que alguien escribió le gana a cualquier
 *                  inferencia nuestra por buena que sea.
 * @param zona      su `mako.timezone`, que se resuelve sola contra su calendario.
 */
export function resolverAcento(declarado?: string | null, zona?: string | null): AcentoResuelto {
  const d = (declarado ?? '').trim();
  if (d && d in ACENTOS_ES) return armar(d as AcentoId, 'declarado');

  const z = (zona ?? '').trim();
  if (z && POR_ZONA[z]) return armar(POR_ZONA[z], 'zona-horaria');

  // Ni declarado ni reconocido: el neutro, y marcado como lo que es.
  return armar('latam', 'default');
}
