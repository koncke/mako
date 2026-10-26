// =============================================================================
// conocimiento-palabras — buscar en el conocimiento por PALABRAS, sin ninguna IA (25/10/2026)
// =============================================================================
// El Cerebro, 25/10/2026 (docs/conexiones-y-ayuda.md): sin la IA del negocio (su OpenAI o su Gemini), el buscador de
// conocimiento busca por palabras, «nunca la Gemini de la plataforma y nunca "conecta tu Gemini"». Y es también lo que
// encuentra el método de MaKo para un negocio que embebe con su OpenAI: el método está embebido con Gemini (lib/embeddings.ts)
// y un coseno entre modelos distintos no significa nada.
//
// Se calcula en la app, sobre las filas que el buscador ya trajo (lib/mako-knowledge.ts, `searchKnowledge`): son las de UN
// negocio más el método, pocas, y así la regla se prueba con datos falsos de verdad. Sin tildes ni mayúsculas, sin las
// palabras que no dicen nada («de», «que», «para»), y el singular y el plural cuentan igual. El título pesa el doble.
//
// PURO y sin `server-only`: lo usan lib/mako-knowledge.ts y tests/conocimiento-sin-gemini.test.ts.
// =============================================================================

/** Las que no dicen de qué se habla. */
const VACIAS = new Set([
  'a', 'al', 'algo', 'ante', 'aqui', 'asi', 'como', 'con', 'cual', 'cuando', 'de', 'del', 'desde', 'donde', 'el', 'ella', 'en',
  'entre', 'era', 'es', 'esa', 'ese', 'eso', 'esta', 'este', 'esto', 'ha', 'hay', 'la', 'las', 'le', 'les', 'lo', 'los', 'mas',
  'me', 'mi', 'mis', 'muy', 'nada', 'ni', 'no', 'nos', 'o', 'para', 'pero', 'por', 'porque', 'que', 'quien', 'se', 'si', 'sin',
  'sobre', 'son', 'su', 'sus', 'tambien', 'te', 'tengo', 'ti', 'tu', 'tus', 'un', 'una', 'uno', 'unos', 'y', 'ya', 'yo',
  'hola', 'mako', 'quiero', 'puedo', 'puedes', 'hace', 'hacer', 'dime', 'decime',
]);

/** Sin tildes, en minúscula, y el plural en singular («objeciones» → «objecion», «leads» → «lead»). */
function raiz(p: string): string {
  if (p.length > 5 && p.endsWith('es')) return p.slice(0, -2);
  if (p.length > 3 && p.endsWith('s')) return p.slice(0, -1);
  return p;
}

/** Las palabras que cuentan de un texto, ya como raíz y sin repetir. */
export function palabrasDe(texto: string): string[] {
  const t = (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const out = new Set<string>();
  for (const p of t.split(/[^a-z0-9ñ]+/)) {
    if (p.length < 2 || VACIAS.has(p)) continue;
    out.add(raiz(p));
  }
  return [...out];
}

/**
 * Cuánto se parece una fila a la pregunta, de 0 a 1: el promedio entre la parte de las palabras de la pregunta que aparecen
 * en la fila (título o cuerpo) y la parte que aparece en el título. Todas en el cuerpo = 0,5; todas en el título = 1; ninguna
 * = 0. Una pregunta sin palabras que cuenten da 0 (no se devuelve todo).
 */
export function puntajePorPalabras(pregunta: string, fila: { titulo?: string | null; cuerpo?: string | null }): number {
  const buscadas = palabrasDe(pregunta);
  if (!buscadas.length) return 0;
  const enTitulo = new Set(palabrasDe(fila.titulo ?? ''));
  const enCuerpo = new Set(palabrasDe(fila.cuerpo ?? ''));
  const enAlguno = buscadas.filter((p) => enTitulo.has(p) || enCuerpo.has(p)).length;
  const delTitulo = buscadas.filter((p) => enTitulo.has(p)).length;
  return (enAlguno + delTitulo) / (2 * buscadas.length);
}

/**
 * Desde cuánto una fila encontrada por palabras entra: la mitad de las palabras de la pregunta en el cuerpo, o menos si
 * alguna está en el título. Con menos, una pregunta larga traía cualquier fila que compartiera un término.
 */
export const UMBRAL_PALABRAS = 0.25;
