// =============================================================================
// agente-redaccion — tapar lo que no debería viajar, antes de que viaje
// =============================================================================
// Corre en DOS lugares y esa duplicación es a propósito:
//   1. en la máquina del cliente, dentro del hook, ANTES de que el texto salga por la
//      red — que es el único momento en que sirve de verdad;
//   2. en el servidor, al recibir, como red por si el plugin es viejo o alguien
//      postea a mano.
// Por eso NO lleva `server-only` y no importa nada: tiene que poder copiarse tal cual
// al script del plugin.
//
// ⚠️ LA GUARDA MÁS FUERTE NO ESTÁ ACÁ. Es el filtro de «solo turnos escritos por la
// persona» que corre antes: las credenciales y los datos de terceros aparecen en las
// SALIDAS DE HERRAMIENTAS (un .env que el agente leyó, una fila de la base, un
// listado de leads), casi nunca en lo que alguien tipea. Estas expresiones son la
// segunda línea, no la primera — y si `redacciones` sube en producción, lo que hay
// que revisar es el filtro, no agregar más patrones acá.
//
// Y lo que estas reglas NO pueden ver, que hay que asumir y decir: el nombre de un
// cliente suyo escrito en prosa, una idea comercial, el precio que le cobra a alguien.
// Eso no se detecta con una regla y es la mitad de la protección que solo puede dar
// el propio usuario. Por eso el texto del consentimiento le pide explícitamente que
// no pegue credenciales ni datos de terceros en el chat.
// =============================================================================

export type Regla = { nombre: string; re: RegExp; con: string };

/**
 * El orden importa: lo más específico primero. Una regla golosa que corra antes se
 * come el texto que otra necesitaba ver.
 *
 * ⚠️ Se EXPORTA porque `lib/agente-plugin.ts` genera el script del hook a partir de
 * esta misma tabla, serializando cada `RegExp` por su `source` y su `flags`. Esa es la
 * razón de que no haya un `scripts/sync-*.mjs` para el plugin como sí lo hay para las
 * skills: acá no existe una copia que se pueda quedar vieja, el script se arma en el
 * momento de pedirlo. Si agregás una regla, el plugin la tiene en el próximo pedido.
 */
export const REGLAS: Regla[] = [
  // ── Claves de proveedor, por su prefijo característico ─────────────────────
  { nombre: 'anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, con: '«clave de Anthropic tapada»' },
  { nombre: 'openai', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, con: '«clave de OpenAI tapada»' },
  // Sin `\b` al final y con {30,}: una clave de Google real son 39 caracteres, pero
  // atarse al largo exacto hace que una variante de 37 se escape ENTERA — el `\b`
  // falla si el carácter siguiente también es de palabra. Ante la duda, tapar de más.
  { nombre: 'google', re: /\bAIza[0-9A-Za-z_-]{30,}/g, con: '«clave de Google tapada»' },
  { nombre: 'groq', re: /\bgsk_[A-Za-z0-9]{20,}/g, con: '«clave de Groq tapada»' },
  { nombre: 'github', re: /\bgh[pousr]_[A-Za-z0-9]{20,}/g, con: '«token de GitHub tapado»' },
  { nombre: 'slack', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g, con: '«token de Slack tapado»' },
  { nombre: 'stripe', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/g, con: '«clave de Stripe tapada»' },
  // Meta: tokens largos que arrancan con EAA. Es el que más aparece en este producto.
  { nombre: 'meta', re: /\bEAA[A-Za-z0-9]{40,}/g, con: '«token de Meta tapado»' },
  // JWT: tres bloques base64 separados por puntos.
  { nombre: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, con: '«token tapado»' },

  // ── Una línea de .env, con su valor ────────────────────────────────────────
  // Cubre el caso más común de todos: pegar media configuración en el chat.
  { nombre: 'env', re: /\b([A-Z][A-Z0-9_]{4,}(?:KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL)[A-Z0-9_]*)\s*[=:]\s*\S+/g, con: '$1=«tapado»' },

  // ── Datos de personas ──────────────────────────────────────────────────────
  // El email se tapa dejando el dominio: sirve para saber de qué empresa se habla sin
  // guardar a quién. Es la información que el dueño necesita y la que no.
  { nombre: 'email', re: /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g, con: '«alguien»@$1' },
  // Teléfono internacional. Se pide + y de 8 a 15 dígitos para no comerse importes ni
  // números de versión, que es el falso positivo clásico de esta regla.
  { nombre: 'telefono', re: /\+\d[\d\s().-]{7,17}\d/g, con: '«teléfono tapado»' },
  // El JID de WhatsApp, que en este producto viaja por todos lados.
  { nombre: 'whatsapp', re: /\b\d{8,15}@(?:s\.whatsapp\.net|c\.us|g\.us)\b/g, con: '«contacto tapado»' },
  // Tarjeta: 13 a 19 dígitos con separadores opcionales.
  { nombre: 'tarjeta', re: /\b(?:\d[ -]?){13,19}\b/g, con: '«tarjeta tapada»' },

  // ── Rutas del disco del cliente ────────────────────────────────────────────
  // No son secretas pero son suyas, y el nombre de usuario suele ser su nombre real.
  { nombre: 'ruta-win', re: /\b[A-Za-z]:\\Users\\[^\\\s"']+/g, con: 'C:\\Users\\«usuario»' },
  { nombre: 'ruta-unix', re: /\/(?:home|Users)\/[^/\s"']+/g, con: '/Users/«usuario»' },
];

export type Redactado = { texto: string; tapadas: number };

/**
 * Tapa lo que reconoce y devuelve cuántas veces tuvo que hacerlo. El conteo es la
 * señal de alarma: si en producción sube, el filtro de turnos humanos está fallando.
 *
 * ⚠️ ES AUTOCONTENIDA A PROPÓSITO —las reglas entran por PARÁMETRO y no toca nada del
 * módulo— porque `lib/agente-plugin.ts` la serializa con `.toString()` y la mete
 * adentro del script que corre en la máquina del cliente. Si usara cualquier cosa del
 * módulo (una constante, otra función, un import), el script generado la referenciaría
 * sin tenerla: rompería en la máquina del cliente y no acá. Y las reglas van por
 * parámetro y no por nombre porque un bundler que minifique renombra las variables del
 * módulo y la referencia deja de resolver, mientras que un parámetro se renombra de
 * forma consistente adentro de la propia función.
 *
 * O sea: el algoritmo tampoco tiene una copia. Ni la tabla ni el código.
 */
export function redactarCon(entrada: string, reglas: Regla[]): Redactado {
  // El molde del marcador temporal. Lleva NUL a los costados porque es lo único que
  // no aparece nunca en un texto tipeado por una persona.
  const MARCA = /\u0000(\d+)\u0000/g;
  let texto = typeof entrada === 'string' ? entrada : '';

  // ⚠️ CADA REGLA DEJA UN MARCADOR, NO SU TEXTO FINAL, y recién al final se cambian
  // todos por el texto de verdad. Sin esto, una regla se come el reemplazo de otra.
  // El caso real, con `ANTHROPIC_API_KEY=sk-ant-…`: la regla de Anthropic dejaba
  // «clave de Anthropic tapada» y después la regla de `.env` matcheaba
  // `ANTHROPIC_API_KEY=\S+`, donde `\S+` agarra solo hasta el primer espacio — o sea la
  // palabra «clave — y escupía `ANTHROPIC_API_KEY=«tapado» de Anthropic tapada»`.
  // El secreto quedaba tapado igual, así que no era un agujero; era un texto roto y,
  // peor, un contador inflado.
  const finales: string[] = [];
  let tapadas = 0;

  for (const r of reglas) {
    texto = texto.replace(r.re, (...args) => {
      const bruto = String(args[0]);
      // Si esta regla se está comiendo marcadores de reglas anteriores, esos secretos
      // YA se contaron y desaparecen adentro de este reemplazo. Descontarlos es lo que
      // mantiene honesto el contador — que no es cosmético: `redacciones` es la alarma
      // que avisa si el filtro de «solo turnos humanos» está dejando pasar salidas de
      // herramientas. Una alarma que cuenta de más no se puede mirar.
      tapadas += 1 - (bruto.match(MARCA) ?? []).length;
      // `$1` en `con` toma el primer grupo de captura (el dominio del mail, el nombre
      // de la variable de entorno). Sin esto, tapar un email borraría también de qué
      // empresa se estaba hablando, que es justo el dato útil y no sensible.
      finales.push(r.con.replace('$1', String(args[1] ?? '')));
      return `\u0000${finales.length - 1}\u0000`;
    });
  }

  texto = texto.replace(MARCA, (_, i) => finales[Number(i)] ?? '');
  return { texto, tapadas };
}

/** La de todos los días, con la tabla de este módulo. */
export function redactar(entrada: string): Redactado {
  return redactarCon(entrada, REGLAS);
}

/** Un turno escrito por la persona, ya limpio. */
export type TurnoHumano = { ts: string; texto: string };

/** Tope por turno. Un prompt de 40 kB no aporta nada que no aporten sus primeros
 *  2.000 caracteres, y evita que una sesión sola llene la tabla. */
export const TOPE_TURNO = 2_000;
/** Tope de turnos por sesión. */
export const TOPE_TURNOS = 200;

export function redactarTurnos(turnos: Array<{ ts?: unknown; texto?: unknown }>): { turnos: TurnoHumano[]; tapadas: number } {
  let tapadas = 0;
  const limpios: TurnoHumano[] = [];
  for (const t of (turnos ?? []).slice(0, TOPE_TURNOS)) {
    const crudo = typeof t?.texto === 'string' ? t.texto : '';
    if (!crudo.trim()) continue;
    const r = redactar(crudo.slice(0, TOPE_TURNO));
    tapadas += r.tapadas;
    limpios.push({ ts: typeof t?.ts === 'string' ? t.ts : new Date().toISOString(), texto: r.texto });
  }
  return { turnos: limpios, tapadas };
}
