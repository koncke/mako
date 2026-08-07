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
// mitad del truco (ver abajo).
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
 * Tope de páginas de UNA lectura (100 × 1000 = 100k filas). Existe para que una
 * tabla que se escribe en vivo no pueda dejar el bucle girando para siempre:
 * mejor romper fuerte que colgar el request.
 */
const MAX_PAGINAS = 100;

export type OpcionesPaginado = {
  /** Tamaño de página. Solo se toca en los tests. */
  pagina?: number;
  /** Columna del ORDER BY. Ver el porqué en el comentario de abajo. */
  orden?: string;
  /** Filtros de igualdad (`.eq`) que se aplican antes de paginar. */
  eq?: Record<string, string | number | boolean>;
};

/**
 * Lee TODAS las filas de `tabla` (columnas `cols`), paginando con `.range()`.
 *
 * `db` tiene que ser el cliente de getTenantDb(): el scoping por workspace lo
 * pone el proxy de lib/workspace.ts, este helper no sabe nada de inquilinos.
 */
export async function leerTodo<T>(
  db: SupabaseClient,
  tabla: string,
  cols: string,
  opts: OpcionesPaginado = {},
): Promise<T[]> {
  const pagina = opts.pagina ?? PAGINA_POSTGREST;
  const orden = opts.orden ?? 'id';
  const out: T[] = [];

  for (let p = 0; ; p++) {
    if (p >= MAX_PAGINAS) {
      throw new Error(`Paginado de ${tabla} pasó ${MAX_PAGINAS} páginas (${MAX_PAGINAS * pagina} filas): algo está mal en el filtro o la tabla creció fuera de escala`);
    }
    const desde = p * pagina;
    let q = db.from(tabla).select(cols);
    for (const [col, val] of Object.entries(opts.eq ?? {})) q = q.eq(col, val);
    // `.order()` NO es decorativo: sin ORDER BY, Postgres no garantiza el mismo
    // orden entre dos consultas, así que el OFFSET de la página 2 se aplica
    // sobre un orden distinto al de la página 1 → filas repetidas y filas
    // salteadas, sin ningún error. Con la tabla escribiéndose en vivo (leads que
    // entran por el webhook mientras se arma el worklist) es la norma, no el
    // caso raro.
    const { data, error } = await q.order(orden, { ascending: true }).range(desde, desde + pagina - 1);
    if (error) throw new Error(`Error leyendo ${tabla} (página ${p + 1}): ${error.message}`);
    const filas = (data ?? []) as unknown as T[];
    out.push(...filas);
    // Página incompleta = última página. Si vino EXACTA, hay que pedir otra
    // aunque esté vacía: no hay forma de distinguir "justo 1000" de "cortado".
    if (filas.length < pagina) return out;
  }
}
