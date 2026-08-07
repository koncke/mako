// =============================================================================
// supabase-paginado — leer una tabla ENTERA sin que PostgREST corte en silencio
// =============================================================================
// PostgREST devuelve como MÁXIMO 1000 filas por request y NO avisa: no hay
// error, no hay flag, la respuesta simplemente viene corta. `.limit(5000)` NO
// levanta ese techo (es un LIMIT que se aplica DESPUÉS del recorte del
// servidor). La única salida es paginar con `.range()` hasta que una página
// venga incompleta.
//
// El patrón estaba copiado a mano en media docena de módulos
// (evolution-contactos, evolution-mensajes, ads-analyst, importar-server,
// barrido-dump) y como `leerTodo` privado en landing-analyst. Vive acá para que
// el próximo no escriba la séptima copia — ni se olvide del ORDER BY, que es la
// mitad del truco (ver abajo). De esas seis copias, CUATRO paginaban sin ORDER BY
// o con un orden no único: el bucle "andaba" y devolvía filas repetidas y filas
// salteadas sin decir nada.
//
// Hay DOS entradas y no una porque no todas las lecturas entran en memoria:
//   · `leerTodo`       — junta todo en un array. Lo normal.
//   · `leerPorPaginas` — te da cada página y la tira. Para tablas grandes que se
//     agregan al vuelo (marketing_metrics_daily son ~1 fila por anuncio POR DÍA:
//     materializarla entera es medio millón de objetos para terminar con un Map
//     de cien claves).
//
// Sin 'server-only' A PROPÓSITO (igual que lib/formatos-archivo.ts): este módulo
// no importa nada del server — recibe el cliente YA scopeado por getTenantDb(),
// que es además lo que mantiene el aislamiento multi-inquilino en manos del
// caller. Como no arrastra 'server-only', los tests pueden ejercitar el bucle
// con un cliente falso, que es justo donde vive el bug caro: el corte silencioso.

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Techo de PostgREST por request. No es configurable DESDE EL CLIENTE (`.limit()`
 * no lo levanta), pero sí lo es del lado del servidor: es el `max-rows` de la API
 * de Supabase, y 1000 es su valor por defecto.
 *
 * ⚠️ ESTE NÚMERO TIENE QUE SER <= AL `max-rows` DEL PROYECTO. Si alguien lo baja
 * (a 500, digamos) y esta constante queda en 1000, la primera página vuelve con
 * 500 filas, el corte de abajo la toma por "última página" y se devuelve media
 * tabla — el mismo truncado silencioso que este módulo existe para matar, y encima
 * con un comentario que juraba lo contrario. No se puede detectar desde acá: una
 * página corta es indistinguible del final de la tabla sin pagar un request extra
 * en cada lectura. Si se toca `max-rows`, se toca esta constante en el mismo commit.
 */
export const PAGINA_POSTGREST = 1000;

/**
 * Tope de páginas de UNA lectura, por defecto (1000 × 1000 = 1M filas). Es un
 * CINTURÓN, no un límite de producto: existe para que un filtro roto o una tabla
 * que se escribe más rápido de lo que se lee no dejen el bucle girando para
 * siempre, y para que eso falle con una frase legible en vez de con un timeout.
 *
 * ⚠️ POR QUÉ ES TAN ALTO. Este número tiene que quedar POR ENCIMA de la lectura
 * legítima más grande de cualquier caller. Si queda por debajo, deja de ser un
 * cinturón y se convierte en el truncado que este módulo existe para matar —
 * agravado, porque el `throw` cae en el `catch` del caller y ahí se lee como
 * "no hay datos", no como "se rompió". Arrancó en 100 (100k filas) y ya estaba
 * por debajo de tres callers: `indiceContactos` (importar-server) paginaba hasta
 * 200k a mano, y `landing_visits` / `marketing_metrics_daily` no tenían tope
 * ninguno — con >100k visitas el análisis de la landing pasaba a decir "sin
 * datos de comportamiento" y el importador dejaba de importar del todo.
 *
 * Si una lectura necesita un techo REAL (truncar a propósito), no se baja esto:
 * se pasa `maxPaginas` en esa llamada, o mejor se corta devolviendo `false`
 * desde `onPagina`, que deja el truncado escrito en el call-site.
 */
const MAX_PAGINAS = 1000;

/**
 * La consulta con el `.select()` ya puesto. Se expone para que el caller le
 * enchufe SUS filtros (`.in`, `.gte`, `.not`, `.neq`…) sin que este módulo tenga
 * que ir conociendo uno por uno: lo que no se puede delegar es el bucle y el
 * ORDER BY, y eso es justo lo que se queda acá.
 */
export type ConsultaPaginada = ReturnType<ReturnType<SupabaseClient['from']>['select']>;

/** Una columna del ORDER BY. `asc` por defecto true. */
export type ColumnaOrden = { col: string; asc?: boolean };

/**
 * Orden del barrido. Puede ser una lista porque un orden que NO es único no
 * alcanza: con empates, Postgres puede acomodar las filas empatadas distinto en
 * cada request y el OFFSET de la página 2 se aplica sobre otro reparto. Regla
 * práctica: la ÚLTIMA columna del orden tiene que ser única (la PK).
 */
export type OrdenPaginado = string | ReadonlyArray<string | ColumnaOrden>;

export type OpcionesPaginado = {
  /** Tamaño de página. Solo se toca en los tests. */
  pagina?: number;
  /** Columna(s) del ORDER BY. Ver el porqué en el comentario de abajo. */
  orden?: OrdenPaginado;
  /** Filtros de igualdad (`.eq`) que se aplican antes de paginar. */
  eq?: Record<string, string | number | boolean>;
  /** Todo lo demás (`.in`, `.gte`, `.not`…). Se aplica a CADA página. */
  filtros?: (q: ConsultaPaginada) => ConsultaPaginada;
  /**
   * Cinturón de esta lectura, en páginas (default `MAX_PAGINAS`). Pasarlo NO es
   * "truncar acá": pasado el tope el barrido LANZA. Para truncar a propósito,
   * devolver `false` desde `onPagina`.
   */
  maxPaginas?: number;
};

/**
 * Qué hacer con cada página. Devolver `false` corta el barrido: la única forma
 * de truncar a propósito, y queda escrita en el call-site en vez de escondida
 * en un `desde < 20000` que nadie lee.
 */
export type OnPagina<T> = (filas: T[], pagina: number) => boolean | void;

function columnasOrden(orden: OrdenPaginado): ColumnaOrden[] {
  const lista = typeof orden === 'string' ? [orden] : orden;
  return lista.map((o) => (typeof o === 'string' ? { col: o } : o));
}

/**
 * Barre `tabla` entera y entrega las filas PÁGINA POR PÁGINA, sin acumularlas.
 * Para lecturas que se agregan al vuelo (un Map, un Set, un contador) y cuya
 * tabla puede tener cientos de miles de filas: juntarlas todas para tirarlas
 * después es memoria pura.
 *
 * `db` tiene que ser el cliente de getTenantDb(): el scoping por workspace lo
 * pone el proxy de lib/workspace.ts, este helper no sabe nada de inquilinos.
 */
export async function leerPorPaginas<T>(
  db: SupabaseClient,
  tabla: string,
  cols: string,
  onPagina: OnPagina<T>,
  opts: OpcionesPaginado = {},
): Promise<void> {
  const pagina = opts.pagina ?? PAGINA_POSTGREST;
  const orden = columnasOrden(opts.orden ?? 'id');
  const tope = Math.max(1, Math.trunc(opts.maxPaginas ?? MAX_PAGINAS));

  for (let p = 0; ; p++) {
    if (p >= tope) {
      throw new Error(`Paginado de ${tabla} pasó ${tope} páginas (${tope * pagina} filas): algo está mal en el filtro o la tabla creció fuera de escala`);
    }
    const desde = p * pagina;
    let q = db.from(tabla).select(cols) as ConsultaPaginada;
    if (opts.filtros) q = opts.filtros(q);
    for (const [col, val] of Object.entries(opts.eq ?? {})) q = q.eq(col, val) as ConsultaPaginada;
    // `.order()` NO es decorativo: sin ORDER BY, Postgres no garantiza el mismo
    // orden entre dos consultas, así que el OFFSET de la página 2 se aplica
    // sobre un orden distinto al de la página 1 → filas repetidas y filas
    // salteadas, sin ningún error. Con la tabla escribiéndose en vivo (leads que
    // entran por el webhook mientras se arma el worklist) es la norma, no el
    // caso raro. Y ordenar por una columna NO única (una fecha, un ad_id que se
    // repite por día) es la misma trampa con otra cara: los empates se reparten
    // distinto entre páginas.
    let ordenada = q;
    for (const o of orden) ordenada = ordenada.order(o.col, { ascending: o.asc ?? true }) as ConsultaPaginada;
    const { data, error } = await ordenada.range(desde, desde + pagina - 1);
    if (error) throw new Error(`Error leyendo ${tabla} (página ${p + 1}): ${error.message}`);
    const filas = (data ?? []) as unknown as T[];
    if (onPagina(filas, p + 1) === false) return;
    // Página incompleta = última página. Si vino EXACTA, hay que pedir otra
    // aunque esté vacía: no hay forma de distinguir "justo 1000" de "cortado".
    if (filas.length < pagina) return;
  }
}

/**
 * Lee TODAS las filas de `tabla` (columnas `cols`), paginando con `.range()`.
 * La forma normal de leer una tabla entera; si no entra en memoria, ver
 * `leerPorPaginas`.
 */
export async function leerTodo<T>(
  db: SupabaseClient,
  tabla: string,
  cols: string,
  opts: OpcionesPaginado = {},
): Promise<T[]> {
  const out: T[] = [];
  await leerPorPaginas<T>(db, tabla, cols, (filas) => { out.push(...filas); }, opts);
  return out;
}
