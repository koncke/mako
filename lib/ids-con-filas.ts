// =============================================================================
// ids-con-filas — «¿cuáles de estos ids tienen AL MENOS UNA fila?», sin el corte
// =============================================================================
// PostgREST corta toda respuesta en 1000 filas y no avisa (ver la cabecera de
// lib/supabase-paginado.ts). Las guardas de la nutrición preguntaban «¿a cuáles
// de estos leads ya les escribimos?» con un `.in('lead_id', ids)` suelto sobre
// wa_mensajes: un solo lead de ws1 tiene 1.194 mensajes nuestros, así que la
// respuesta podía venir llena de ESE lead y los demás quedaban como «nunca
// contactado». Resultado: el audio de apertura se presentaba de cero a gente con
// la que ya se venía hablando, y el guard anti-ban dejaba encimar mensajes.
//
// Paginar sería el arreglo equivocado: para saber si existe UNA fila habría que
// bajar las miles de cada lead. Lo que se hace es excluir: cada vuelta pide solo
// por los ids que TODAVÍA no aparecieron. Si la vuelta vuelve incompleta (< tope)
// es la respuesta completa para esos ids y se termina; si vuelve llena, los que
// aparecieron salen de la lista y se pregunta de nuevo por el resto. No hay
// OFFSET, así que no hace falta ORDER BY: no hay página 2 que pueda desfasarse.
//
// Sin 'server-only' y sin supabase: recibe la consulta como función, para que el
// test pueda simular el corte de 1000, que es justo lo que se rompía.

/** Techo de PostgREST por request (el mismo `max-rows` que supabase-paginado). */
export const TOPE_RESPUESTA = 1000;

/**
 * Devuelve el subconjunto de `ids` para los que `consultar` trae al menos una
 * fila. `consultar(pendientes)` tiene que filtrar por esos ids (`.in(...)`) y
 * devolver el id de cada fila; puede venir cortada en `tope` filas.
 */
export async function idsConAlMenosUnaFila(
  ids: readonly number[],
  consultar: (pendientes: number[]) => Promise<Array<number | null>>,
  tope: number = TOPE_RESPUESTA,
): Promise<Set<number>> {
  const encontrados = new Set<number>();
  const universo = [...new Set(ids)];
  for (;;) {
    const pendientes = universo.filter((id) => !encontrados.has(id));
    if (pendientes.length === 0) return encontrados;
    const filas = await consultar(pendientes);
    const antes = encontrados.size;
    const buscados = new Set(pendientes);
    for (const id of filas) if (id != null && buscados.has(id)) encontrados.add(id);
    // Respuesta incompleta = completa para estos ids: no hay más que buscar.
    if (filas.length < tope) return encontrados;
    // Llena pero sin ningún id nuevo: la consulta no está filtrando por los
    // pendientes. Seguir sería un bucle infinito; mejor que se note.
    if (encontrados.size === antes) {
      throw new Error('idsConAlMenosUnaFila: la consulta devolvió filas llenas sin ids nuevos (¿falta el filtro por los pendientes?)');
    }
  }
}

/** Parte `xs` en tandas de `n`. Para no mandar un `.in()` de mil ids en la URL. */
export function enTandas<T>(xs: readonly T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/**
 * Descubre los valores DISTINTOS de una columna sin bajar la tabla entera: cada
 * vuelta pide las filas más nuevas EXCLUYENDO los valores ya vistos, así que
 * cada una trae al menos uno nuevo o termina. Para columnas de pocos valores
 * sobre tablas enormes (los videos de vsl_events: una decena de ids sobre
 * decenas de miles de eventos), donde paginar todo para quedarse con diez claves
 * es lo que el censo llama «paginar para tirar el 90%».
 *
 * `consultar(excluidos)` tiene que excluir esos valores (`.not(col, 'in', …)`)
 * y puede venir cortada en `tope`. `onFila` ve cada fila que llegó, en orden.
 * `maxVueltas` es un cinturón: pasado, LANZA (no trunca callado).
 */
export async function distintosPorExclusion<T, K>(
  consultar: (excluidos: K[]) => Promise<T[]>,
  clave: (fila: T) => K | null | undefined,
  onFila: (fila: T) => void,
  opts: { tope?: number; maxVueltas?: number } = {},
): Promise<Set<K>> {
  const tope = opts.tope ?? TOPE_RESPUESTA;
  const maxVueltas = opts.maxVueltas ?? 100;
  const vistos = new Set<K>();
  for (let vuelta = 0; ; vuelta++) {
    if (vuelta >= maxVueltas) {
      throw new Error(`distintosPorExclusion: más de ${maxVueltas} vueltas (${vistos.size} valores): la columna no es de pocos valores`);
    }
    const filas = await consultar([...vistos]);
    const antes = vistos.size;
    for (const f of filas) {
      const k = clave(f);
      if (k == null) continue;
      vistos.add(k);
      onFila(f);
    }
    if (filas.length < tope) return vistos;
    if (vistos.size === antes) {
      throw new Error('distintosPorExclusion: la consulta devolvió filas llenas sin valores nuevos (¿falta la exclusión?)');
    }
  }
}

/** Una lista para `.not(col, 'in', …)` de PostgREST, con cada valor entre comillas
 *  (un id con coma o paréntesis rompería la lista sin comillas). */
export function listaPostgrest(valores: readonly string[]): string {
  return `(${valores.map((v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')})`;
}
