// =============================================================================
// nutricion-ambito — a QUÉ embudo le escribe una secuencia (#627)
// =============================================================================
// `nutricion_secuencias.funnel_id` existe desde la mig 0170 y su comentario lo
// dice en una línea: «NULL = sirve a TODOS los funnels (el tramo de cierre
// compartido). Con valor, solo a ese». Hasta hoy no lo leía NADIE, así que con
// dos embudos vivos `leadsDeCohorte` juntaba los leads de los dos y el mismo
// lead recibía los dos WhatsApp y los dos emails — sin error y sin log.
//
// Acá vive la DECISIÓN y no la consulta, por dos razones:
//
// · Sin `server-only` a propósito (igual que `lib/supabase-paginado.ts`): el
//   motor arrastra `lib/workspace` y con eso el runtime de Next, que bajo tsx no
//   carga, así que una condición escrita adentro de `lib/nutricion.ts` no la
//   puede importar ningún test. Y ésta es justo la que no puede quedar sin red:
//   equivocarla no da error, manda mensajes reales a los leads de otro producto
//   —o deja de mandarlos a todos—.
// · Es una decisión de TRES estados y dos de ellos se ven iguales desde el
//   `.eq`: ver abajo.
//
// ⚠️ LOS TRES ESTADOS, Y POR QUÉ NO SON DOS.
//
//   1. La secuencia NO declara embudo (`funnel_id` NULL) — hoy, las 62 filas de
//      la base. La cohorte se arma COMO HOY, sin filtrar. Aplicar el filtro
//      igual sería el peor resultado posible de este paquete: ninguna secuencia
//      enrolaría a nadie nunca más y se cortaría la nutrición de todos los
//      clientes, en silencio y sin que nada avise.
//   2. La secuencia declara el embudo POR DEFECTO (el del negocio). Ahí entran
//      también los leads con `funnel_id` NULL, porque en este repo **NULL ES EL
//      EMBUDO DEL NEGOCIO**, no «sin embudo»: `listLeadsDeFunnel(null)` pide los
//      suyos con `.is('funnel_id', null)` (lib/leads.ts) y los 1.530 leads de los
//      6 workspaces lo tienen en NULL. Filtrar por el id del default a secas
//      dejaría la cohorte VACÍA para todo el mundo — el mismo cero plausible que
//      `funnelDeLanding` (lib/landing-funnel.ts) evita mapeando ese id a `null`.
//   3. La secuencia declara un embudo SECUNDARIO. Sólo los suyos, por igualdad:
//      un producto nuevo arranca sin un lead, que es lo que lo hace un embudo
//      propio y no otra vista del mismo.
//
// Quién es el default NO se deduce del número: se lee de `funnels.es_default`
// (lo resuelve el caller, que es el único que tiene el cliente scopeado).
// =============================================================================

/**
 * El ámbito de embudo de UNA secuencia, ya resuelto.
 *
 * `negocio` y `propio` llevan el id igual, y no es redundante: el id del default
 * también puede estar escrito en un lead (`moverLeadDeFunnel` escribe el id
 * crudo, ver lib/mako-confirmaciones.ts), así que el embudo del negocio son DOS
 * valores en la columna y hay que pedir los dos.
 */
export type AmbitoFunnel =
  | { modo: 'todos' }
  | { modo: 'negocio'; id: number }
  | { modo: 'propio'; id: number };

/** Lo que hay que pedirle a la columna `leads.funnel_id`. `null` = nada. */
export type FiltroAmbito = { or: string } | { eq: number } | null;

/**
 * El ámbito de una secuencia, a partir de lo que declara y de si ese embudo es
 * el del negocio.
 *
 * TOLERANTE en las dos puntas, y las dos tolerancias caen del mismo lado (no
 * filtrar = lo de hoy):
 * · `funnel_id` NULL / vacío / no numérico → `todos`.
 * · `esDefault` que no se pudo resolver (`null`/`undefined`) → `todos`. Un
 *   embudo que no existe no puede pasar (la columna es
 *   `references funnels(id) on delete cascade`: borrar el embudo se lleva la
 *   secuencia), así que el único camino acá es una lectura que no contestó, y
 *   ahí cortar la nutrición de un cliente es peor que no acotar la cohorte.
 */
export function ambitoDeSecuencia(
  funnelId: number | string | null | undefined,
  esDefault: boolean | null | undefined,
): AmbitoFunnel {
  if (funnelId == null || funnelId === '') return { modo: 'todos' };
  // `Number(...)`: la columna es `bigint` y el día que un driver la devuelva
  // como texto («13»), un `===` contra un número sería false SIEMPRE.
  const id = Number(funnelId);
  if (!Number.isFinite(id)) return { modo: 'todos' };
  if (esDefault == null) return { modo: 'todos' };
  return esDefault ? { modo: 'negocio', id } : { modo: 'propio', id };
}

/**
 * El filtro de PostgREST que corresponde a un ámbito.
 *
 * Devuelve DATOS y no una consulta encadenada: así la decisión se ejecuta en un
 * test sin un cliente de Supabase, que es la única forma de verla fallar.
 */
export function filtroDeAmbito(ambito: AmbitoFunnel): FiltroAmbito {
  if (ambito.modo === 'todos') return null;
  if (ambito.modo === 'negocio') return { or: `funnel_id.is.null,funnel_id.eq.${ambito.id}` };
  return { eq: ambito.id };
}

/**
 * ¿ESTE lead entra en el ámbito? Es el MISMO criterio que `filtroDeAmbito`, resuelto en
 * memoria en vez de en PostgREST.
 *
 * ⚠️ VIVE PEGADO AL OTRO Y NO EN EL MÓDULO QUE LO USA, A PROPÓSITO: son dos formas de la
 * misma pregunta y la casa ya pagó lo que cuesta tenerlas en dos archivos. El día que la
 * semántica del ámbito cambie —por ejemplo, que el embudo del negocio deje de aceptar el
 * NULL— los dos tienen que cambiar juntos o el barrido del cron y el disparo por evento
 * empiezan a elegir leads distintos, sin que nada falle.
 *
 * El `Number(...)` por lo mismo que arriba: la columna es `bigint` y un driver la puede
 * devolver como texto, con lo cual un `===` contra un número sería false SIEMPRE y nadie
 * entraría nunca — un fail-closed silencioso que se lee como «la secuencia no dispara».
 */
export function leadEnAmbito(ambito: AmbitoFunnel, leadFunnelId: number | string | null | undefined): boolean {
  if (ambito.modo === 'todos') return true;
  // El embudo del negocio son DOS valores en la columna: el NULL de quien nunca se movió
  // y el id escrito a mano (`moverLeadDeFunnel` escribe el id crudo, incluso el default).
  if (leadFunnelId == null || leadFunnelId === '') return ambito.modo === 'negocio';
  const id = Number(leadFunnelId);
  if (!Number.isFinite(id)) return false;
  return id === ambito.id;
}
