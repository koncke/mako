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
   * Las que la persona marcó como suyas, ya filtradas contra las de su variedad.
   * La pantalla las muestra para que se puedan corregir sin adivinar cuáles
   * quedaron guardadas.
   */
  muletillas: string[];
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
 * Las muletillas típicas de cada variedad, para ELEGIR — nunca para escribir.
 *
 * ⚠️ ES UNA LISTA PARA RECONOCERSE, y por eso existe. La gente se describe mal a
 * sí misma y se reconoce al instante: preguntarle «¿qué muletillas usas?» con un
 * campo vacío devuelve dos, y las obvias. Mostrarle las de su país y que marque
 * las suyas devuelve las que de verdad dice. Es el mismo principio que ya usa el
 * quiz de personalidad.
 *
 * ⚠️ Y LA DENSIDAD NO SE DECIDE ACÁ. El repo ya se equivocó una vez
 * (`lib/curso-avatar.ts`): se hizo la lista de muletillas de un cliente y se
 * repartieron por el guion hasta llegar a una densidad parecida. El cliente lo
 * marcó al instante — «exageraste el uso del pues, lo pusiste en lugares que no
 * tienen sentido». Por eso lo que viaja al modelo es que las usa NATURALMENTE, no
 * cuántas veces.
 */
export const MULETILLAS: Record<AcentoId, string[]> = {
  'mx-norte': ['pues', 'órale', 'ándale', 'fíjate', 'la neta', 'híjole', 'mira', 'entonces'],
  'mx-neutro': ['pues', 'o sea', 'la verdad', 'fíjate', 'mira', 'entonces', 'digamos', 'bueno'],
  'mx-cdmx': ['o sea', 'neta', 'pues', 'la verdad', 'digamos', 'mira', 'entonces', 'básicamente'],
  co: ['pues', 'o sea', 'listo', 'vea', 'de una', 'la verdad', 'mira', 'entonces'],
  // ⚠️ Sin `mirá`, y no es un olvido: estas palabras se PINTAN como chips en la
  // pantalla, así que son interfaz y las gobierna la guarda de voseo del repo.
  // La lista no tiene que ser exhaustiva —son ocho de las que la persona marca
  // las suyas—, así que se elige una sin forma verbal antes que abrirle una
  // excepción al guard y dejar este archivo sin revisar.
  ar: ['o sea', 'viste', 'digamos', 'la verdad', 'posta', 'entonces', 'obvio', 'bueno'],
  es: ['o sea', 'vale', 'pues', 'en plan', 'la verdad', 'mira', 'entonces', 'bueno'],
  latam: ['o sea', 'la verdad', 'digamos', 'mira', 'entonces', 'bueno', 'básicamente', 'justamente'],
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

function armar(id: AcentoId, origen: AcentoResuelto['origen'], muletillas: string[] = []): AcentoResuelto {
  // Sólo las que la persona marcó de SU variedad. Una muletilla de otro país
  // guardada antes de cambiar de acento sonaría a que el avatar cambió de
  // nacionalidad a mitad del anuncio — y eso no se ve al leer, se oye.
  const suyas = muletillas.filter((m) => MULETILLAS[id].includes(m));
  return {
    id,
    // ⚠️ LAS MULETILLAS VIAJAN PEGADAS AL ACENTO, y no por un slot nuevo del
    // template. `renderTemplate` deja literales los slots que no conoce, así que
    // un `{{muletillas}}` nuevo llegaría CRUDO a todo workspace que ya tenga el
    // prompt editado a mano — el mismo modo de falla que dejó «{{acento}}» sin
    // llenar durante meses, y que sólo se nota al oír el resultado.
    //
    // Y se dice «naturalmente», sin número: el repo ya se equivocó repartiendo
    // muletillas por densidad y el cliente lo marcó al instante.
    prompt: suyas.length
      ? `${ACENTOS_ES[id]}. The speaker naturally uses these filler words when speaking: ${suyas.map((m) => `"${m}"`).join(', ')}. Use them the way a person does — only where they fall naturally, never forced and never in every sentence.`
      : ACENTOS_ES[id],
    etiqueta: ETIQUETA[id],
    muletillas: suyas,
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
 * @param muletillas las que marcó como suyas. Se filtran contra las de SU
 *                  variedad: una de otro país es ruido, no un dato.
 */
export function resolverAcento(
  declarado?: string | null,
  zona?: string | null,
  muletillas?: string[] | null,
): AcentoResuelto {
  const m = Array.isArray(muletillas) ? muletillas : [];
  const d = (declarado ?? '').trim();
  if (d && d in ACENTOS_ES) return armar(d as AcentoId, 'declarado', m);

  const z = (zona ?? '').trim();
  if (z && POR_ZONA[z]) return armar(POR_ZONA[z], 'zona-horaria', m);

  // Ni declarado ni reconocido: el neutro, y marcado como lo que es.
  return armar('latam', 'default', m);
}
