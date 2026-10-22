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

// =============================================================================
// LOS AGREGADOS: un CRM ve también a los leads que se le SUMARON (21/10/2026)
// =============================================================================
// «No se debe "Mover" se debe agregar al otro producto» (Martín, 06/10/2026): un lead en varios CRM tiene UNA casa
// (`leads.funnel_id`) y una fila de `lead_funnel` por cada otro, con su etapa en ESE CRM. Hasta hoy la cohorte de un
// CRON por etapa miraba sólo la casa, así que un CRM nuevo con sus leads agregados (la prospección del Sprint de
// Mauricio: 1.094 nunca contactados, todos con casa en el CRM principal) inscribía a CERO, sin un error.
//
// La regla, la MISMA que la de la casa con dos cambios:
//   · la etapa es la que el lead tiene EN ESE CRM (`lead_funnel.etapa`), no la de su casa;
//   · el «último hito» de la ventana de 90 días es cuándo se lo agregó o se lo movió en ese CRM
//     (`created_at` / `etapa_desde` de la fila): un lead de hace un año sumado ayer a la campaña entra.
// Y lo que NO cambia: sólo leads `abierto` (el estado es de la PERSONA, como en la casa), y una secuencia que no
// declara CRM (`todos`) sigue mirando sólo la casa — las 62 de antes del ámbito aplican a todos los productos, y
// sumarles las filas le escribiría dos veces a la misma persona (lib/lead-funnel.ts).
// Una fila que nombra la CASA del lead se ignora (no debería existir: «nunca hay fila para la casa», `productosDe`):
// ahí manda la etapa de la casa, que ya entra por el otro camino.
//
// ⚠️ Y UNA FILA QUE NACIÓ CON EL LEAD TAMPOCO ENTRA (revisión adversarial del 21/10/2026). Un lead nuevo de una campaña
// de Meta con varios CRM (o de una landing con varios) nace en su casa y, en el mismo alta, con una fila en cada otro
// (lib/leads.ts, «los otros funnels de la campaña»). La casa lo saluda por el EVENTO del lead nuevo; si la fila también
// entrara, el «Un Lead Entró» del otro CRM le mandaba una SEGUNDA bienvenida en el barrido de la hora. Una fila que se
// creó a `NACIDA_CON_EL_LEAD_MS` del alta del lead, y que no se movió después, es parte del alta: la saluda la casa,
// como hasta hoy. Sumarlo DESPUÉS (la campaña del Sprint, a mano o en lote) o moverlo en ese CRM sí entra.

/** Una fila de `lead_funnel` como la lee la cohorte. */
export type FilaAgregado = { lead_id: number | string; funnel_id: number | string; etapa: string | null; created_at?: string | null; etapa_desde?: string | null };
/** Lo que la cohorte necesita del lead de esa fila. */
export type LeadDelAgregado = { id: number | string; funnel_id: number | string | null; estado_lead: string | null; created_at?: string | null };

/** Cuánto después del alta del lead una fila se considera parte del alta (ver arriba). */
export const NACIDA_CON_EL_LEAD_MS = 10 * 60_000;

/** ¿La fila nació en el mismo alta que el lead y nadie la movió después? */
export function filaNacidaConElLead(f: Pick<FilaAgregado, 'created_at' | 'etapa_desde'>, leadCreatedAt: string | null | undefined): boolean {
  const fila = f.created_at ? Date.parse(f.created_at) : NaN;
  const lead = leadCreatedAt ? Date.parse(leadCreatedAt) : NaN;
  if (!Number.isFinite(fila) || !Number.isFinite(lead)) return false;
  if (Math.abs(fila - lead) > NACIDA_CON_EL_LEAD_MS) return false;
  const movida = f.etapa_desde ? Date.parse(f.etapa_desde) : NaN;
  return !Number.isFinite(movida) || movida - fila <= NACIDA_CON_EL_LEAD_MS;
}

/**
 * Los leads AGREGADOS a este CRM que entran a la cohorte de un CRON por etapa. `corteMs`: el borde de la ventana de
 * 90 días (lo calcula el motor, igual que para la casa). Sin ámbito propio (`todos`), nadie: ver arriba.
 */
export function agregadosQueEntran(
  ambito: AmbitoFunnel,
  etapas: readonly string[],
  corteMs: number,
  filas: readonly FilaAgregado[],
  leads: readonly LeadDelAgregado[],
): number[] {
  if (ambito.modo === 'todos' || !etapas.length) return [];
  const porId = new Map(leads.map((l) => [Number(l.id), l]));
  const out = new Set<number>();
  for (const f of filas) {
    if (Number(f.funnel_id) !== ambito.id) continue;
    if (!f.etapa || !etapas.includes(f.etapa)) continue;
    const id = Number(f.lead_id);
    const lead = porId.get(id);
    if (!lead || lead.estado_lead !== 'abierto') continue;
    // Su casa ES este CRM: decide la etapa de la casa (el otro camino), no esta fila.
    if (leadEnAmbito(ambito, lead.funnel_id)) continue;
    // Nació con el lead: lo saluda la casa por el evento del alta (ver arriba).
    if (filaNacidaConElLead(f, lead.created_at)) continue;
    const hito = Math.max(
      ...[f.created_at, f.etapa_desde].filter((x): x is string => Boolean(x)).map((x) => Date.parse(x)).filter((ms) => Number.isFinite(ms)),
      0,
    );
    if (hito < corteMs) continue;
    out.add(id);
  }
  return [...out];
}
