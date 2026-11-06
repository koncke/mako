// =============================================================================
// plantillas-propias-reglas — lo PURO de «Guardar como plantilla» en todas las tabs (6/11/2026)
// =============================================================================
// Leila (30/10/2026): plantillas propias, que se puedan guardar para el negocio o compartir con la comunidad, con
// estrellas. Martín (13/10/2026, el pedido de las estrellas): «para que los usuarios hagan sus creaciones y otros usuarios
// puedan puntuarles». Es el MISMO mecanismo que las creaciones (lib/creaciones.ts, mig 0273): una plantilla propia es una
// creación con `estado = 'privada'` (mig 0404), que sólo ve su negocio; compartirla la pasa a 'publicada'.
//
// Lo que gobierna, y por qué:
//   · PRIVADA NO SE LIMPIA: es del mismo negocio, y lo que la hace útil es justamente lo suyo (su precio, su link).
//   · PÚBLICA NUNCA LLEVA DATOS DEL NEGOCIO DE QUIEN LA COMPARTE. Dos capas, como toda regla de esta casa:
//       1. `limpiarTextos` reemplaza en CADA texto de la definición el nombre del negocio, el de su gente, los emails, los
//          teléfonos, los links, los @ y los precios por un `[DATO: …]`, que es la marca de las plantillas reales
//          (docs/plantillas-reales/README.md, 2.2): quien la usa ve qué completar.
//       2. `fugasDe` mira el JSON YA LIMPIO y, si queda algo de eso, el server NO publica. Una tab que olvida limpiar un
//          campo (o un formato que la capa 1 no conoce) frena acá, en vez de salir a todos.
//     Lo que no es texto (las fotos que subió el negocio, los ids, las rutas del storage) lo saca el enchufe de cada tipo
//     ANTES (`paraPublico`, lib/creaciones-enchufes.ts): sólo él sabe qué campo es una foto.
//   · `[DATO: …]` y no `[completar]`: el experto de cada tab ya lee esa marca (README 2.3, «lo que falta al adaptar»).
//
// SIN `server-only`: lo importan el server, la API y tests/plantillas-propias.test.ts.
// =============================================================================

export const VISIBILIDADES = ['privada', 'publica'] as const;
export type Visibilidad = (typeof VISIBILIDADES)[number];
export const esVisibilidad = (v: unknown): v is Visibilidad => typeof v === 'string' && (VISIBILIDADES as readonly string[]).includes(v);

/** Lo que identifica al negocio que comparte: su nombre (y el de su perfil), y los nombres de su gente. */
export type NegocioQueComparte = { nombres: readonly string[]; personas: readonly string[] };

export const DATO = {
  negocio: '[DATO: tu negocio]',
  persona: '[DATO: nombre]',
  email: '[DATO: email]',
  telefono: '[DATO: teléfono]',
  link: '[DATO: link]',
  usuario: '[DATO: usuario]',
  precio: '[DATO: precio]',
} as const;

const SIN_ACENTO = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '');
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Un nombre como patrón que ignora mayúsculas y tildes («Andrea Salcedo» encuentra «ANDREA SALCEDO» y «Andréa»). */
function patronNombre(nombre: string): RegExp | null {
  const base = SIN_ACENTO(nombre.normalize('NFC')).replace(/\s+/g, ' ').trim();
  // Un nombre de menos de 3 letras («Al», «Lu») reemplazaría pedazos de palabras comunes.
  if (base.length < 3) return null;
  const cuerpo = [...base].map((c) => {
    const v = 'aeioun'.includes(c.toLowerCase()) ? ({ a: 'aáàäâ', e: 'eéèëê', i: 'iíìïî', o: 'oóòöô', u: 'uúùüû', n: 'nñ' } as Record<string, string>)[c.toLowerCase()] : null;
    if (v) return `[${v}${v.toUpperCase()}]`;
    if (c === ' ') return '\\s+';
    return escapar(c);
  }).join('');
  // Bordes por letra Unicode: `\b` es ASCII y no ve el borde después de una «á» (AGENTS.md, la voz).
  return new RegExp(`(?<![\\p{L}\\p{N}])${cuerpo}(?![\\p{L}\\p{N}])`, 'giu');
}

/**
 * Las formas de un nombre de negocio: entero, y sin las palabras genéricas de adelante («Estudio», «Agencia»…) ni la forma
 * legal de atrás («S.A. de C.V.», «LLC»), porque así se lo nombra en un texto: «Estudio Brújula Norte» es «Brújula Norte».
 * Lo que queda tiene que ser de 2 palabras o de 6 letras: «Dental» suelto no es el negocio.
 */
const GENERICAS = /^(?:estudio|agencia|cl[ií]nica|grupo|consultora|despacho|academia|escuela|instituto|centro|tienda|taller|the|la|el|los|las|mi)\s+/iu;
const LEGALES = /[\s,]+(?:s\.?\s?a\.?(?:\s?de\s?c\.?\s?v\.?)?|s\.?a\.?s\.?|s\.?\s?de\s?r\.?l\.?|llc|inc\.?|ltda\.?|sas)$/iu;
function formasDeNegocio(nombres: readonly string[]): string[] {
  const out = new Set<string>();
  for (const n0 of nombres) {
    let n = (n0 ?? '').replace(/\s+/g, ' ').trim();
    if (!n) continue;
    out.add(n);
    n = n.replace(LEGALES, '').trim();
    out.add(n);
    let corto = n;
    while (GENERICAS.test(corto)) corto = corto.replace(GENERICAS, '').trim();
    if (corto && (corto.includes(' ') || corto.length >= 6)) out.add(corto);
  }
  return [...out].filter(Boolean).sort((a, b) => b.length - a.length);
}

/** Las personas: el nombre entero y, si tiene apellido, el nombre de pila de 4 letras o más («Hola, soy Andrea»). */
function nombresDePersona(personas: readonly string[]): string[] {
  const out = new Set<string>();
  for (const p of personas) {
    const t = (p ?? '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    out.add(t);
    const pila = t.split(' ')[0];
    if (t.includes(' ') && pila.length >= 4) out.add(pila);
  }
  // Primero los más largos: «Andrea Salcedo» antes que «Andrea», o quedaría «[DATO: nombre] Salcedo».
  return [...out].sort((a, b) => b.length - a.length);
}

const RE_EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const RE_URL = /\b(?:https?:\/\/|www\.)[^\s<>"'`)\]]+/gi;
// Un dominio suelto («pulsodental.com», «mi-sitio.mx/agenda»): con un dominio de primer nivel conocido, para no tomar
// «v1.2» ni «USD 1.500».
const RE_DOMINIO = /(?<![\p{L}\p{N}@./-])[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|net|org|mx|co|ar|pe|cl|uy|ec|bo|py|ve|gt|cr|pa|do|es|us|io|app|site|store|shop|info|biz|link|me|ly|lat|online|tech|ai)(?:\/[^\s<>"'`)\]]*)?(?![\p{L}\p{N}])/giu;
const RE_ARROBA = /(?<![\p{L}\p{N}@.])@[A-Za-z0-9_.]{2,30}(?![\p{L}\p{N}])/gu;
// El precio: con su moneda adelante («USD 1,500», «$1.500», «MXN 2,400,000») o atrás («1,500 dólares», «900 pesos»).
const RE_PRECIO_ANTES = /(?:US\$|USD|MXN|COP|PEN|ARS|CLP|EUR|U\$S|€|\$)\s?\d[\d.,]*(?:\s?(?:k|mil|millones|M)(?![\p{L}]))?/giu;
const RE_PRECIO_DESPUES = /(?<![\p{L}\p{N}])\d[\d.,]*\s?(?:k\s)?(?:USD|MXN|COP|PEN|ARS|CLP|EUR|d[oó]lares|pesos|s[o]les|euros)(?![\p{L}])/giu;
// Un teléfono: 8 dígitos o más, con espacios, puntos, guiones o paréntesis entre ellos, y con o sin «+» (nunca con comas:
// «2,400,000» es un precio). Lo que se marca se vuelve a contar abajo.
const RE_TEL = /(?<![\p{L}\p{N}$])\+?\d[\d\s().-]{6,}\d(?![\p{L}\p{N}])/gu;
const digitos = (t: string) => (t.match(/\d/g) ?? []).length;
/** «2024-2025», «1999 2000»: dos años no son un teléfono. */
const sonAnios = (t: string) => /^(?:19|20)\d\d\s*[-–/ ]\s*(?:19|20)\d\d$/.test(t.trim());
/** «2026-11-06», «06/11/2026»: una fecha tampoco. */
const esFecha = (t: string) => /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})$/.test(t.trim());
const esTelefono = (m: string) => digitos(m) >= 8 && !sonAnios(m) && !esFecha(m);

/** Un texto sin los datos del negocio que comparte: cada uno pasa a su `[DATO: …]`. */
export function sinDatosDelNegocio(texto: string, negocio: NegocioQueComparte): string {
  if (!texto) return texto;
  let t = texto.normalize('NFC');
  t = t.replace(RE_EMAIL, DATO.email);
  t = t.replace(RE_URL, DATO.link);
  t = t.replace(RE_DOMINIO, DATO.link);
  t = t.replace(RE_ARROBA, DATO.usuario);
  for (const n of formasDeNegocio(negocio.nombres)) { const re = patronNombre(n); if (re) t = t.replace(re, DATO.negocio); }
  for (const n of nombresDePersona(negocio.personas)) { const re = patronNombre(n); if (re) t = t.replace(re, DATO.persona); }
  t = t.replace(RE_PRECIO_ANTES, DATO.precio).replace(RE_PRECIO_DESPUES, DATO.precio);
  t = t.replace(RE_TEL, (m) => (esTelefono(m) ? DATO.telefono : m));
  return t;
}

/** Hasta dónde se baja en un JSON: una definición más honda que esto no es una plantilla, es un error. */
const PROFUNDIDAD = 40;

/**
 * Cada TEXTO de una definición, sin los datos del negocio. Las claves no se tocan (son la forma), los números tampoco (una
 * duración, una posición). Devuelve una copia: la definición privada que se guarda no cambia.
 */
export function limpiarTextos<T>(valor: T, negocio: NegocioQueComparte, hondo = 0): T {
  if (hondo > PROFUNDIDAD) throw new Error('La plantilla es demasiado honda para compartirla.');
  if (typeof valor === 'string') return sinDatosDelNegocio(valor, negocio) as unknown as T;
  if (Array.isArray(valor)) return valor.map((v) => limpiarTextos(v, negocio, hondo + 1)) as unknown as T;
  if (valor && typeof valor === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) out[k] = limpiarTextos(v, negocio, hondo + 1);
    return out as T;
  }
  return valor;
}

/** Los textos de un JSON, en un solo renglón por texto (para buscar fugas sin las claves). */
function textosDe(valor: unknown, out: string[] = [], hondo = 0): string[] {
  if (hondo > PROFUNDIDAD) return out;
  if (typeof valor === 'string') out.push(valor);
  else if (Array.isArray(valor)) for (const v of valor) textosDe(v, out, hondo + 1);
  else if (valor && typeof valor === 'object') for (const v of Object.values(valor as Record<string, unknown>)) textosDe(v, out, hondo + 1);
  return out;
}

export type Fuga = 'negocio' | 'persona' | 'email' | 'telefono' | 'link' | 'usuario' | 'precio';

/**
 * La segunda capa: lo que QUEDA de un dato del negocio en una definición que se va a hacer pública. Vacío = se puede
 * publicar. Se busca sobre los textos (no sobre `JSON.stringify`, que escapa comillas y une claves con valores).
 */
export function fugasDe(def: unknown, negocio: NegocioQueComparte): Fuga[] {
  const fugas = new Set<Fuga>();
  for (const t0 of textosDe(def)) {
    const t = t0.normalize('NFC');
    if (new RegExp(RE_EMAIL.source, 'i').test(t)) fugas.add('email');
    if (new RegExp(RE_URL.source, 'i').test(t) || new RegExp(RE_DOMINIO.source, 'iu').test(t)) fugas.add('link');
    if (new RegExp(RE_ARROBA.source, 'u').test(t)) fugas.add('usuario');
    if (new RegExp(RE_PRECIO_ANTES.source, 'iu').test(t) || new RegExp(RE_PRECIO_DESPUES.source, 'iu').test(t)) fugas.add('precio');
    for (const m of t.match(new RegExp(RE_TEL.source, 'gu')) ?? []) if (esTelefono(m)) fugas.add('telefono');
    for (const n of formasDeNegocio(negocio.nombres)) { const re = patronNombre(n); if (re && re.test(t)) fugas.add('negocio'); }
    for (const n of nombresDePersona(negocio.personas)) { const re = patronNombre(n); if (re && re.test(t)) fugas.add('persona'); }
  }
  return [...fugas];
}

/** Lo que dice la pantalla cuando una plantilla pública todavía trae algo del negocio (no debería pasar: es la red). */
export function textoDeFugas(f: readonly Fuga[]): string {
  const nombres: Record<Fuga, string> = {
    negocio: 'el nombre de tu negocio', persona: 'el nombre de alguien de tu equipo', email: 'un email', telefono: 'un teléfono',
    link: 'un link', usuario: 'un @', precio: 'un precio',
  };
  return `No se compartió: todavía trae ${f.map((x) => nombres[x]).join(', ')}. Guárdala sólo para tu negocio, o quítalo y vuelve a compartirla.`;
}

/**
 * La definición LISTA PARA TODOS, en un paso (lo usa el server, lib/creaciones.ts): lo que no es texto afuera (`paraPublico`
 * del enchufe del tipo), cada texto sin los datos del negocio, y la red. Con fugas, NO devuelve la definición: no se comparte.
 */
export function definicionParaTodos(def: unknown, negocio: NegocioQueComparte, paraPublico?: (d: unknown) => unknown):
  { ok: true; definicion: unknown } | { ok: false; fugas: Fuga[] } {
  const sinCosas = paraPublico ? paraPublico(def) : def;
  const limpia = limpiarTextos(sinCosas, negocio);
  const fugas = fugasDe(limpia, negocio);
  return fugas.length ? { ok: false, fugas } : { ok: true, definicion: limpia };
}
