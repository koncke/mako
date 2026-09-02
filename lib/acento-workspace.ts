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

/**
 * Las variedades que el generador sabe pedirle al modelo.
 *
 * ⚠️ LAS SIETE PRIMERAS CLAVES NO SE TOCAN NUNCA: están guardadas en el
 * `app_settings` de cada cliente. Renombrar una deja a ese workspace apuntando a
 * un acento que no existe, y el fallback lo manda al neutro sin avisar — un
 * cambio de nacionalidad a mitad del anuncio que no se ve al leer, sólo se oye.
 *
 * El resto se agregó el 02/09/2026: eran siete opciones para un producto que se
 * vende en toda Latinoamérica, así que a un peruano, un chileno o un boliviano no
 * les quedaba más que «latino neutro» — o sea, ninguna.
 */
export const ACENTOS_ES = {
  // ── México ──────────────────────────────────────────────────────────────
  'mx-norte': 'Northern Mexican Spanish (Baja California, Sonora, Sinaloa, Nuevo León)',
  'mx-cdmx': 'Mexico City Spanish (chilango)',
  'mx-occidente': 'Western Mexican Spanish (Jalisco, Guadalajara, Bajío)',
  'mx-sureste': 'Southeastern Mexican Spanish (Yucatán, Quintana Roo, Veracruz)',
  'mx-neutro': 'neutral Mexican Spanish',
  // ── Centroamérica y el Caribe ───────────────────────────────────────────
  'gt': 'Guatemalan Spanish',
  'sv': 'Salvadoran Spanish',
  'hn': 'Honduran Spanish',
  'ni': 'Nicaraguan Spanish',
  'cr': 'Costa Rican Spanish (tico)',
  'pa': 'Panamanian Spanish',
  'cu': 'Cuban Spanish',
  'do': 'Dominican Spanish',
  'pr': 'Puerto Rican Spanish',
  // ── Andes y Cono Sur ────────────────────────────────────────────────────
  'co': 'Colombian Spanish (Bogotá, rolo)',
  'co-paisa': 'Colombian Spanish (Medellín, paisa)',
  'co-costa': 'Colombian Caribbean Spanish (Barranquilla, Cartagena)',
  've': 'Venezuelan Spanish (Caracas)',
  'ec': 'Ecuadorian Spanish (Quito)',
  'ec-costa': 'Ecuadorian Coastal Spanish (Guayaquil)',
  'pe': 'Peruvian Spanish (Lima)',
  'bo': 'Bolivian Spanish',
  'cl': 'Chilean Spanish',
  'py': 'Paraguayan Spanish',
  'uy': 'Uruguayan Spanish (Montevideo)',
  'ar': 'Argentine Spanish (Rioplatense, Buenos Aires)',
  'ar-cordoba': 'Argentine Spanish (Córdoba)',
  // ── España y Estados Unidos ─────────────────────────────────────────────
  'es': 'Peninsular Spanish (Madrid, central Spain)',
  'es-andaluz': 'Andalusian Spanish (southern Spain)',
  'es-canario': 'Canarian Spanish (Canary Islands)',
  'us': 'US Latino Spanish (Spanish spoken in the United States)',
  // ── Sin marca ───────────────────────────────────────────────────────────
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

/**
 * Cómo se lo nombra en pantalla, y DÓNDE se habla.
 *
 * La zona no es decoración: «Mexicano del norte» no le dice nada a quien no
 * sabe cómo se llama su propio acento, y «Sonora, Sinaloa, Monterrey» sí. La
 * persona se reconoce por el lugar, no por la etiqueta lingüística.
 */
export const ETIQUETA_ACENTO: Record<AcentoId, string> = {
  'mx-norte': 'Mexicano del norte',
  'mx-cdmx': 'Mexicano de CDMX',
  'mx-occidente': 'Mexicano del occidente',
  'mx-sureste': 'Mexicano del sureste',
  'mx-neutro': 'Mexicano neutro',
  gt: 'Guatemalteco',
  sv: 'Salvadoreño',
  hn: 'Hondureño',
  ni: 'Nicaragüense',
  cr: 'Costarricense',
  pa: 'Panameño',
  cu: 'Cubano',
  do: 'Dominicano',
  pr: 'Puertorriqueño',
  co: 'Colombiano de Bogotá',
  'co-paisa': 'Colombiano paisa',
  'co-costa': 'Colombiano costeño',
  ve: 'Venezolano',
  ec: 'Ecuatoriano de la sierra',
  'ec-costa': 'Ecuatoriano de la costa',
  pe: 'Peruano',
  bo: 'Boliviano',
  cl: 'Chileno',
  py: 'Paraguayo',
  uy: 'Uruguayo',
  ar: 'Argentino (rioplatense)',
  'ar-cordoba': 'Argentino de Córdoba',
  es: 'Español de España',
  'es-andaluz': 'Español andaluz',
  'es-canario': 'Español canario',
  us: 'Español de Estados Unidos',
  latam: 'Latino neutro',
};

/**
 * Las variedades agrupadas por región, para que el desplegable no sea una lista.
 *
 * ⚠️ VIVE ACÁ Y NO EN LA PANTALLA. Es una propiedad del catálogo —de qué región es
 * cada variedad—, no una decisión de una vista; el día que se agregue una y el
 * agrupamiento esté escrito en un componente, la variedad nueva no aparece en
 * ninguna columna y no se puede elegir, sin error y sin síntoma.
 *
 * El tipo es a propósito una estructura plana y no la del componente `Dropdown`:
 * este módulo no importa UI, así que la pantalla la traduce al llegar.
 */
export const REGIONES: { titulo: string; acentos: AcentoId[] }[] = [
  { titulo: 'México', acentos: ['mx-norte', 'mx-cdmx', 'mx-occidente', 'mx-sureste', 'mx-neutro'] },
  { titulo: 'Centroamérica y el Caribe', acentos: ['gt', 'sv', 'hn', 'ni', 'cr', 'pa', 'cu', 'do', 'pr'] },
  { titulo: 'Sudamérica', acentos: ['co', 'co-paisa', 'co-costa', 've', 'ec', 'ec-costa', 'pe', 'bo', 'cl', 'py', 'uy', 'ar', 'ar-cordoba'] },
  { titulo: 'España', acentos: ['es', 'es-andaluz', 'es-canario'] },
  { titulo: 'Sin marca de país', acentos: ['us', 'latam'] },
];

/** La zona donde se habla, para que la persona se reconozca por el LUGAR. */
export const ZONA_DEL_ACENTO: Record<AcentoId, string> = {
  'mx-norte': 'Baja California, Sonora, Sinaloa, Monterrey',
  'mx-cdmx': 'Ciudad de México',
  'mx-occidente': 'Jalisco, Guadalajara, el Bajío',
  'mx-sureste': 'Yucatán, Quintana Roo, Veracruz',
  'mx-neutro': 'México, sin marca regional',
  gt: 'Guatemala',
  sv: 'El Salvador',
  hn: 'Honduras',
  ni: 'Nicaragua',
  cr: 'Costa Rica',
  pa: 'Panamá',
  cu: 'Cuba',
  do: 'República Dominicana',
  pr: 'Puerto Rico',
  co: 'Bogotá y el interior',
  'co-paisa': 'Medellín y Antioquia',
  'co-costa': 'Barranquilla, Cartagena, Santa Marta',
  ve: 'Venezuela',
  ec: 'Quito y la sierra',
  'ec-costa': 'Guayaquil y la costa',
  pe: 'Perú',
  bo: 'Bolivia',
  cl: 'Chile',
  py: 'Paraguay',
  uy: 'Uruguay',
  ar: 'Buenos Aires y el litoral',
  'ar-cordoba': 'Córdoba',
  es: 'Madrid y el centro de España',
  'es-andaluz': 'Andalucía',
  'es-canario': 'Islas Canarias',
  us: 'Estados Unidos',
  latam: 'Latinoamérica, sin marca de país',
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
  'mx-norte': ['pues', 'órale', 'ándale', 'fíjate', 'la neta', 'híjole', 'entonces', 'ni modo'],
  'mx-cdmx': ['o sea', 'neta', 'pues', 'la verdad', 'digamos', 'entonces', 'básicamente', 'güey'],
  'mx-occidente': ['pues', 'ándale', 'órale', 'la verdad', 'fíjate', 'entonces', 'o sea', 'ahí nomás'],
  'mx-sureste': ['pues', 'o sea', 'la verdad', 'fíjate', 'entonces', 'bueno', 'digamos', 'ándale'],
  'mx-neutro': ['pues', 'o sea', 'la verdad', 'fíjate', 'entonces', 'digamos', 'bueno', 'básicamente'],
  gt: ['pues', 'fíjese', 'o sea', 'la verdad', 'entonces', 'vaya', 'bueno', 'cabal'],
  sv: ['pues', 'o sea', 'la verdad', 'entonces', 'fíjese', 'bueno', 'va', 'cabal'],
  hn: ['pues', 'o sea', 'la verdad', 'entonces', 'fíjese', 'bueno', 'vaya', 'digamos'],
  ni: ['pues', 'o sea', 'la verdad', 'entonces', 'fíjese', 'bueno', 'digamos', 'ideay'],
  cr: ['diay', 'o sea', 'la verdad', 'entonces', 'pues', 'bueno', 'digamos', 'tuanis'],
  pa: ['o sea', 'la verdad', 'entonces', 'pues', 'bueno', 'digamos', 'ahí', 'chuleta'],
  cu: ['o sea', 'la verdad', 'entonces', 'bueno', 'imagínate', 'digamos', 'chico', 'oye'],
  do: ['o sea', 'la verdad', 'entonces', 'bueno', 'imagínate', 'digamos', 'vaina', 'dique'],
  pr: ['o sea', 'la verdad', 'entonces', 'bueno', 'imagínate', 'digamos', 'pues', 'wepa'],
  co: ['o sea', 'pues', 'entonces', 'la verdad', 'listo', 'digamos', 'bueno', 'vea'],
  'co-paisa': ['pues', 'o sea', 'entonces', 'la verdad', 'listo', 'vea', 'de una', 'hombre'],
  'co-costa': ['o sea', 'entonces', 'la verdad', 'bueno', 'ajá', 'listo', 'digamos', 'eche'],
  ve: ['o sea', 'la verdad', 'entonces', 'bueno', 'chamo', 'vale', 'digamos', 'imagínate'],
  ec: ['o sea', 'entonces', 'la verdad', 'pues', 'bueno', 'digamos', 've', 'nomás'],
  'ec-costa': ['o sea', 'entonces', 'la verdad', 'bueno', 've', 'pues', 'digamos', 'de una'],
  pe: ['o sea', 'entonces', 'la verdad', 'pues', 'bueno', 'digamos', 'ya', 'causa'],
  bo: ['o sea', 'entonces', 'la verdad', 'pues', 'bueno', 'digamos', 'nomás', 'ya'],
  cl: ['o sea', 'entonces', 'la verdad', 'bueno', 'cachai', 'po', 'digamos', 'igual'],
  py: ['o sea', 'entonces', 'la verdad', 'bueno', 'digamos', 'nomás', 'luego', 'pues'],
  // ⚠️ Sin `mirá` ni ningún imperativo voseante: estas palabras se PINTAN como
  // chips, o sea que son interfaz y las gobierna la guarda de voseo del repo. La
  // lista no tiene que ser exhaustiva —son ocho de las que la persona marca las
  // suyas—, así que se elige una sin forma verbal antes que abrirle una excepción
  // al guard y dejar este archivo sin revisar.
  uy: ['o sea', 'viste', 'digamos', 'la verdad', 'entonces', 'bo', 'ta', 'obvio'],
  ar: ['o sea', 'viste', 'digamos', 'la verdad', 'posta', 'entonces', 'obvio', 'bueno'],
  'ar-cordoba': ['o sea', 'viste', 'digamos', 'la verdad', 'entonces', 'obvio', 'vio', 'bueno'],
  es: ['o sea', 'vale', 'pues', 'en plan', 'la verdad', 'entonces', 'bueno', 'tío'],
  'es-andaluz': ['o sea', 'pues', 'quillo', 'la verdad', 'entonces', 'bueno', 'vamos', 'illo'],
  'es-canario': ['o sea', 'pues', 'la verdad', 'entonces', 'bueno', 'chacho', 'vale', 'mi niño'],
  us: ['o sea', 'la verdad', 'entonces', 'pues', 'bueno', 'digamos', 'like', 'básicamente'],
  latam: ['o sea', 'la verdad', 'digamos', 'entonces', 'bueno', 'básicamente', 'justamente', 'pues'],
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
  'America/Ciudad_Juarez': 'mx-norte',
  'America/Ojinaga': 'mx-norte',
  'America/Matamoros': 'mx-norte',
  'America/Bahia_Banderas': 'mx-occidente',
  'America/Mexico_City': 'mx-cdmx',
  'America/Merida': 'mx-sureste',
  'America/Cancun': 'mx-sureste',
  'America/Guatemala': 'gt',
  'America/El_Salvador': 'sv',
  'America/Tegucigalpa': 'hn',
  'America/Managua': 'ni',
  'America/Costa_Rica': 'cr',
  'America/Panama': 'pa',
  'America/Havana': 'cu',
  'America/Santo_Domingo': 'do',
  'America/Puerto_Rico': 'pr',
  'America/Bogota': 'co',
  'America/Caracas': 've',
  'America/Guayaquil': 'ec',
  'America/Lima': 'pe',
  'America/La_Paz': 'bo',
  'America/Santiago': 'cl',
  'Pacific/Easter': 'cl',
  'America/Asuncion': 'py',
  'America/Montevideo': 'uy',
  'America/Argentina/Buenos_Aires': 'ar',
  'America/Argentina/Cordoba': 'ar-cordoba',
  'America/Argentina/Mendoza': 'ar',
  'America/Argentina/Salta': 'ar',
  'America/Argentina/Tucuman': 'ar',
  'America/Argentina/Rosario': 'ar',
  'Europe/Madrid': 'es',
  'Atlantic/Canary': 'es-canario',
  'America/Los_Angeles': 'us',
  'America/Denver': 'us',
  'America/Phoenix': 'us',
  'America/Chicago': 'us',
  'America/New_York': 'us',
  'America/Miami': 'us',
};

/**
 * El acento que corresponde a una zona horaria IANA, o `null`.
 *
 * ⚠️ Devuelve `null` y NO un default: «no sé de dónde es» y «es latino neutro»
 * son cosas distintas, y la pantalla las muestra distinto. Un `latam` devuelto
 * acá se presentaría como una detección, que es justo la afirmación que no se
 * puede hacer.
 *
 * Lo consume la PANTALLA con la zona del navegador —`Intl.DateTimeFormat()`—,
 * que es la del aparato de la persona y no la del calendario del workspace. Se
 * eligió antes que la API de geolocalización a propósito: ésa abre un permiso
 * del navegador, y pedirle a alguien que acepte rastreo para adivinarle el
 * acento cuesta más de lo que resuelve.
 */
export function acentoDeZona(zona: string | undefined | null): AcentoId | null {
  const z = (zona ?? "").trim();
  return z && POR_ZONA[z] ? POR_ZONA[z] : null;
}

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
    etiqueta: ETIQUETA_ACENTO[id],
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
