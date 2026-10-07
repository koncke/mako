import 'server-only';

// =============================================================================
// entrega — lo que la pantalla necesita para dibujar el kanban de la entrega
// =============================================================================
// Una sola lectura para TODOS los servicios, por lo mismo que el trabajo de la
// cartera viaja con el HTML: el kanban no puede tener estado de carga. Cambiar de
// servicio en el selector no pide nada — es un filtro sobre lo que ya llegó.
//
// ⚠️ LO QUE NO SE PUDO LEER SE DICE. `ok: false` NO es «este workspace no entrega
// nada»: son dos pantallas distintas, y un tablero vacío sobre una lectura caída le
// afirma a alguien que no tiene clientes en entrega.

import { listProductos } from '@/lib/productos';
import { getTenantDb } from '@/lib/workspace';
import { secuenciasPorEtapaDeEntrega } from '@/lib/nutricion';
import { entregasDeProductos, clientesEnEntrega, type ClienteEnEntrega } from '@/lib/entrega-servicio';
import type { EtapaEntrega, FaseEntrega } from '@/lib/servicio-etapas';
import { leerTodo } from '@/lib/supabase-paginado';
import { casaDeCliente, clientesEnEtapa } from './pertenencia';

/** Un servicio que se puede entregar, con las columnas de SU entrega. */
export type Servicio = {
  productoId: number;
  nombre: string;
  etapas: EtapaEntrega[];
  /**
   * Los tramos que agrupan a las columnas. Vacío es el caso normal.
   *
   * ⚠️ VIAJA CON LAS ETAPAS, no aparte: el color de una columna sale de las dos cosas
   * juntas (`colorDeEtapa`), así que una pantalla que reciba las etapas sin las fases
   * dibuja los colores propios — o sea el estado de ANTES de agrupar, que se lee como
   * que agrupar no hizo nada.
   */
  fases: FaseEntrega[];
  /** `default` = nadie configuró estas etapas. La pantalla lo tiene que DECIR. */
  origen: 'declarado' | 'default';
  /** Es el producto del embudo PRINCIPAL del CRM: no se puede eliminar (sí renombrar). */
  principal: boolean;
  /**
   * Tiene al menos un embudo VIVO en el CRM. Decide qué hace «Eliminar» con él
   * (`eliminarServicioAction`): con embudo lo ARCHIVA y vuelve desde «Productos eliminados»;
   * sin embudo lo da de baja con `activo = false`, y de ahí no vuelve desde ninguna pantalla.
   * La confirmación del editor dice de dónde se recupera SÓLO en el primer caso.
   *
   * ⚠️ `false` TAMBIÉN CUANDO NO SE PUDO LEER (la vista de embudos cayó): no saberlo es no
   * prometerlo. Al revés —prometer que vuelve sobre un producto que se da de baja— es mandar
   * a alguien a buscar en una lista donde no va a estar.
   */
  conEmbudo: boolean;
};

export type CarteraEnEntrega =
  | {
      ok: true;
      servicios: Servicio[];
      porServicio: Record<number, Record<number, ClienteEnEntrega>>;
      /**
       * Cuántas SECUENCIAS cuelgan de cada etapa de cada servicio.
       *
       * Lo necesita el editor: borrar una columna no sólo deja clientes sin lugar,
       * también deja secuencias apuntando a una etapa que no existe — y ésas dejan
       * de dispararse sin que nada avise. «Sacar algo de un catálogo no es borrarlo:
       * hay gente APUNTÁNDOLE», y los clientes eran sólo la mitad de esa gente.
       *
       * ⚠️ `null` = NO SE PUDO LEER, y hay que tratarlo distinto de un mapa vacío:
       * decir «ninguna secuencia» sobre una consulta caída es la afirmación que hace
       * apretar el botón. Las etapas sin secuencias vienen AUSENTES, no en cero: el
       * universo de etapas es de acá, no de la nutrición.
       */
      secuenciasPorServicio: Record<number, Record<string, number> | null>;
      /**
       * El producto de la CASA de cada cliente ganado: el de su embudo del CRM
       * (`casaDeCliente`, ./pertenencia.ts). Un cliente es de un producto si es su casa o
       * si tiene una fila ahí — ver la cabecera de pertenencia.ts.
       *
       * ⚠️ `null` = no tiene casa que se ofrezca y vive sólo donde lo pusieron. Un lead
       * ausente del mapa (la lectura de embudos falló) también da `null`, y entonces cada
       * tablero muestra sólo a los que tienen fila: de menos, nunca a todos en todos.
       */
      casaPorLead: Record<number, number | null>;
      /**
       * El orden MANUAL de cada columna (mig 0196): producto → etapa → leads en el orden en
       * que se arrastraron. Vale sólo con «Ordenar: Manual»; con otro criterio manda ése.
       * Vacío = nadie ordenó nada todavía.
       */
      ordenPorServicio: Record<number, Record<string, number[]>>;
    }
  | { ok: false; error: string };

/**
 * Los productos que esta pantalla ofrece como servicio: los activos MENOS los que el
 * CRM eliminó.
 *
 * ⚠️ «ACTIVO» NO ALCANZA, y lo midió Martín con una captura (05/10/2026): «haz puesto
 * otros que no existen… En el CRM de Mauricio, solo hay esos 2». Eliminar un producto en
 * el CRM ARCHIVA su embudo (`funnels.activo = false`, ver `archivarFunnel`) y deja el
 * producto con `activo = true`, así que leyendo sólo `productos` esta pantalla seguía
 * ofreciendo «Sistema DOS», que en el CRM vive en «Productos eliminados».
 *
 * La regla, en positivo: se ofrece todo producto activo que NO esté atado únicamente a
 * embudos archivados. Un producto SIN embudo se sigue ofreciendo — hay workspaces cuyos
 * productos nacieron en el catálogo antes de la cadena producto → oferta → embudo
 * (medido: el ws13 tiene tres, y una entrega real sobre uno), y exigir el embudo les
 * borraría el tablero. Restaurar el embudo desde el CRM lo devuelve acá sin hacer nada.
 *
 * Nunca tira: si la vista falla, se cae a «activos» como antes — mostrar de más es
 * recuperable; un tablero vacío sobre una lectura caída afirma que no hay servicios.
 */
type Ofrecibles = {
  productos: Awaited<ReturnType<typeof listProductos>>;
  principales: Set<number>;
  /** Los productos con al menos un embudo VIVO (ver `Servicio.conEmbudo`). Vacío si no se
   *  pudo leer: no saberlo es no prometer que vuelve. */
  conEmbudo: Set<number>;
  /** embudo → producto, para la CASA de cada cliente. El primero del catálogo si un
   *  embudo vende varios. */
  productoDeFunnel: Map<number, number>;
  /** El embudo principal, si está atado a algún producto (si no, no resuelve nada). */
  funnelDefault: number | null;
};

async function productosOfrecibles(opts: { estricto?: boolean } = {}): Promise<Ofrecibles> {
  const productos = await listProductos(true);
  const principales = new Set<number>();
  const conEmbudo = new Set<number>();
  const productoDeFunnel = new Map<number, number>();
  let funnelDefault: number | null = null;
  if (!productos.length) return { productos, principales, conEmbudo, productoDeFunnel, funnelDefault };
  try {
    const db = await getTenantDb();
    const ids = productos.map((p) => p.id);
    const { data: vp, error } = await db.from('v_funnel_productos').select('funnel_id, producto_id').in('producto_id', ids);
    if (error) throw new Error(error.message);
    const links = (vp ?? []) as Array<{ funnel_id: number; producto_id: number }>;
    if (!links.length) return { productos, principales, conEmbudo, productoDeFunnel, funnelDefault };
    // En el orden del catálogo, para que un embudo que vende dos productos caiga siempre
    // en el mismo — y en el mismo que el selector muestra primero.
    const orden = new Map(productos.map((p, i) => [p.id, i]));
    for (const l of [...links].sort((a, b) => (orden.get(Number(a.producto_id)) ?? 0) - (orden.get(Number(b.producto_id)) ?? 0))) {
      if (!productoDeFunnel.has(Number(l.funnel_id))) productoDeFunnel.set(Number(l.funnel_id), Number(l.producto_id));
    }
    const fids = [...new Set(links.map((l) => Number(l.funnel_id)))];
    const { data: fs, error: e2 } = await db.from('funnels').select('id, activo, es_default').in('id', fids);
    if (e2) throw new Error(e2.message);
    const filasF = (fs ?? []) as Array<{ id: number; activo: boolean; es_default: boolean }>;
    const vivo = new Map(filasF.map((f) => [Number(f.id), f.activo !== false]));
    // El producto del embudo PRINCIPAL no se puede eliminar (`archivarFunnel` lo frena):
    // la pantalla lo necesita para no dibujar un botón cuya única respuesta es «no».
    const defaults = new Set(filasF.filter((f) => f.es_default === true).map((f) => Number(f.id)));
    for (const l of links) if (defaults.has(Number(l.funnel_id))) principales.add(Number(l.producto_id));
    funnelDefault = [...defaults][0] ?? null;
    // producto → ¿tiene AL MENOS un embudo vivo? Los que no tienen ninguno no entran
    // al mapa y se ofrecen igual (ver arriba).
    const algunoVivo = new Map<number, boolean>();
    for (const l of links) {
      const pid = Number(l.producto_id);
      algunoVivo.set(pid, (algunoVivo.get(pid) ?? false) || (vivo.get(Number(l.funnel_id)) ?? false));
    }
    // ⚠️ LA MISMA PREGUNTA QUE HACE `eliminarServicioAction` ANTES DE ELEGIR CAMINO («¿tiene
    // algún embudo vivo?»): con embudo vivo archiva, sin ninguno da de baja. Un producto cuyos
    // embudos están TODOS archivados no llega acá (no se ofrece), así que entre los ofrecidos
    // `true` = archiva y vuelve, `false` = no tiene embudo.
    for (const [pid, si] of algunoVivo) if (si) conEmbudo.add(pid);
    return { productos: productos.filter((p) => algunoVivo.get(p.id) !== false), principales, conEmbudo, productoDeFunnel, funnelDefault };
  } catch (e) {
    // ⚠️ `estricto` LO PIDE QUIEN DECIDE A QUIÉN SE LE ESCRIBE (la cohorte de una secuencia,
    // `universoDeLaEntrega`). Sin el cruce con los embudos no hay CASA, y entonces cada cliente
    // sin fila cae al primer producto ofrecido: para dibujar eso es recuperable, para una
    // secuencia es mandarle a la cartera entera los mensajes del primer servicio.
    if (opts.estricto) throw e;
    console.warn('[entrega] no pude cruzar productos con embudos; se ofrecen todos los activos:', e instanceof Error ? e.message : e);
    return { productos, principales, conEmbudo, productoDeFunnel, funnelDefault };
  }
}

/**
 * Los productos que esta pantalla ofrece como servicio, con la MISMA regla que el selector del
 * kanban. Lo usa el editor de secuencias (`productosConEtapas`, lib/setting-secuencias.ts) para
 * ofrecer las etapas de entrega de un producto que no es el principal de ningún embudo: sin
 * esto, un servicio con kanban no se podía elegir como disparador.
 */
export async function productosDeLaEntrega(): Promise<Array<{ id: number; nombre: string }>> {
  const { productos } = await productosOfrecibles();
  return productos.map((p) => ({ id: p.id, nombre: p.nombre }));
}

/**
 * La casa de cada cliente ganado (ver `casaDeCliente`).
 *
 * ⚠️ UNA LECTURA DE `leads` APARTE, y no un campo más de `clientesGanados()`: esa lista la
 * comparten el picker del tablero y /admin, y el embudo de un cliente sólo le importa a
 * esta pantalla. Paginada por `id` (más de 1000 ganados no es imposible).
 *
 * Nunca tira: si falla, el mapa vuelve vacío y cada tablero muestra sólo a los que tienen
 * fila — de menos y no a todos en todos, que era el bug.
 */
async function casaDeLaCartera(
  ofrecidos: readonly number[],
  productoDeFunnel: ReadonlyMap<number, number>,
  funnelDefault: number | null,
  porServicio: Readonly<Record<number, Readonly<Record<number, unknown>>>>,
): Promise<Record<number, number | null>> {
  try {
    return (await casasDeLosGanados(ofrecidos, productoDeFunnel, funnelDefault, porServicio)).casa;
  } catch (e) {
    console.warn('[entrega] no pude leer el embudo de los clientes:', e instanceof Error ? e.message : e);
    return {};
  }
}

/**
 * Los leads ganados y la casa de cada uno. TIRA si no puede leer: la versión que no tira es
 * `casaDeLaCartera`, que es la de la pantalla.
 */
async function casasDeLosGanados(
  ofrecidos: readonly number[],
  productoDeFunnel: ReadonlyMap<number, number>,
  funnelDefault: number | null,
  porServicio: Readonly<Record<number, Readonly<Record<number, unknown>>>>,
): Promise<{ casa: Record<number, number | null>; ganados: Array<{ id: number; nombre: string }> }> {
  const db = await getTenantDb();
  const [filas, fuera] = await Promise.all([
    leerTodo<{ id: number; nombre: string | null; funnel_id: number | null }>(db, 'leads', 'id, nombre, funnel_id',
      { orden: 'id', eq: { estado_lead: 'ganado' } }),
    fueraDe(),
  ]);
  const out: Record<number, number | null> = {};
  for (const l of filas) {
    const tieneFilas = ofrecidos.some((p) => porServicio[p]?.[l.id] !== undefined);
    out[l.id] = casaDeCliente({
      funnelId: l.funnel_id == null ? null : Number(l.funnel_id),
      funnelDefault, productoDeFunnel, ofrecidos, tieneFilas, fuera: fuera.get(l.id),
    });
  }
  return { casa: out, ganados: filas.map((l) => ({ id: Number(l.id), nombre: (l.nombre ?? '').trim() })) };
}

/**
 * De qué productos sacaron a cada cliente (`cliente_entrega_fuera`, mig 0196): lead → productos.
 *
 * ⚠️ TIRA si no puede leer, y quien llama decide. Leído como «nadie está fuera», un cliente
 * que se sacó de su casa volvería a aparecer ahí — la decisión de una persona revertida por
 * una consulta caída.
 */
async function fueraDe(leadId?: number): Promise<Map<number, number[]>> {
  const db = await getTenantDb();
  const filas = await leerTodo<{ id: number; lead_id: number; producto_id: number }>(db, 'cliente_entrega_fuera',
    'id, lead_id, producto_id', { orden: 'id', ...(leadId != null ? { eq: { lead_id: leadId } } : {}) });
  const out = new Map<number, number[]>();
  for (const f of filas) {
    const k = Number(f.lead_id);
    out.set(k, [...(out.get(k) ?? []), Number(f.producto_id)]);
  }
  return out;
}

/**
 * El orden manual de las columnas (`cliente_entrega_orden`, mig 0196): producto → etapa → leads.
 *
 * Nunca tira: sin la lectura, cada columna va en el orden de «Ordenar», que es lo que había
 * antes de que existiera el orden manual — de menos, nunca algo inventado.
 */
async function ordenDe(productos: readonly number[]): Promise<Record<number, Record<string, number[]>>> {
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('cliente_entrega_orden')
      .select('producto_id, etapa, lead_ids').in('producto_id', [...productos]);
    if (error) throw new Error(error.message);
    const out: Record<number, Record<string, number[]>> = {};
    for (const f of (data ?? []) as Array<{ producto_id: number; etapa: string; lead_ids: Array<number | string> | null }>) {
      (out[Number(f.producto_id)] ??= {})[f.etapa] = (f.lead_ids ?? []).map(Number);
    }
    return out;
  } catch (e) {
    console.warn('[entrega] no pude leer el orden manual de las columnas:', e instanceof Error ? e.message : e);
    return {};
  }
}

/**
 * Los productos de UN cliente, calculados en el server con la MISMA regla que la pantalla.
 * Lo usa «Quitar de este producto» antes de escribir: el botón sólo se ofrece con dos o más
 * productos, pero esconder un botón no protege nada.
 */
export async function productosDelCliente(leadId: number): Promise<{ productos: number[]; casa: number | null }> {
  const { productos, productoDeFunnel, funnelDefault } = await productosOfrecibles();
  const ofrecidos = productos.map((p) => p.id);
  if (!ofrecidos.length) return { productos: [], casa: null };
  const db = await getTenantDb();
  const [{ data: lead, error: e1 }, { data: filas, error: e2 }, fuera] = await Promise.all([
    db.from('leads').select('funnel_id').eq('id', leadId).maybeSingle(),
    db.from('cliente_entrega').select('producto_id').eq('lead_id', leadId),
    fueraDe(leadId),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  const conFila = new Set(((filas ?? []) as Array<{ producto_id: number }>).map((f) => Number(f.producto_id)));
  const funnelId = (lead as { funnel_id: number | null } | null)?.funnel_id;
  const casa = casaDeCliente({
    funnelId: funnelId == null ? null : Number(funnelId),
    funnelDefault, productoDeFunnel, ofrecidos,
    tieneFilas: ofrecidos.some((p) => conFila.has(p)),
    fuera: fuera.get(leadId),
  });
  return { productos: ofrecidos.filter((p) => p === casa || conFila.has(p)), casa };
}

/**
 * Los servicios del workspace y en qué etapa está cada cliente en cada uno.
 *
 * ⚠️ SÓLO LOS PRODUCTOS QUE SE OFRECEN (`productosOfrecibles`). Un producto dado de baja
 * —o eliminado en el CRM— no es un servicio que se esté entregando, y ofrecerlo en el
 * selector obliga a quien mira a descartar a mano las opciones muertas. Las filas de
 * `cliente_entrega` de un producto dado de baja NO se borran: el histórico del cliente
 * dice lo que pasó.
 */
export async function carteraEnEntrega(): Promise<CarteraEnEntrega> {
  try {
    const { productos, principales, conEmbudo, productoDeFunnel, funnelDefault } = await productosOfrecibles();
    if (!productos.length) return { ok: true, servicios: [], porServicio: {}, secuenciasPorServicio: {}, casaPorLead: {}, ordenPorServicio: {} };

    const ids = productos.map((p) => p.id);
    const catalogos = await entregasDeProductos(ids);

    // Una consulta por servicio, en paralelo. Son tan pocas como productos activos
    // tenga el negocio (hoy, entre uno y un puñado) y cada una está indexada por
    // (workspace_id, producto_id, etapa) — el índice del tablero de la mig 0188.
    const filas = await Promise.all(ids.map(async (id) => [id, await clientesEnEntrega(id)] as const));
    // Las secuencias de cada servicio, en la misma tanda. Son una consulta chica por
    // producto y viajan con el HTML por lo mismo que todo lo demás de esta pantalla:
    // el editor se abre encima del tablero y no puede tener estado de carga.
    const secs = await Promise.all(ids.map(async (id) => [id, await secuenciasPorEtapaDeEntrega(id)] as const));

    const porServicio: Record<number, Record<number, ClienteEnEntrega>> = {};
    for (const [id, cs] of filas) {
      const m: Record<number, ClienteEnEntrega> = {};
      for (const c of cs) m[c.lead_id] = c;
      porServicio[id] = m;
    }

    const servicios: Servicio[] = productos.map((p) => {
      const cat = catalogos.get(p.id);
      return {
        productoId: p.id,
        nombre: p.nombre,
        etapas: cat?.etapas ?? [],
        fases: cat?.fases ?? [],
        origen: cat?.origen ?? 'default',
        principal: principales.has(p.id),
        conEmbudo: conEmbudo.has(p.id),
      };
    });
    const [casaPorLead, ordenPorServicio] = await Promise.all([
      casaDeLaCartera(ids, productoDeFunnel, funnelDefault, porServicio),
      ordenDe(ids),
    ]);
    return { ok: true, servicios, porServicio, secuenciasPorServicio: Object.fromEntries(secs), casaPorLead, ordenPorServicio };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude leer la entrega de tus servicios.' };
  }
}

/** Lo que `universoDeLaEntrega` devuelve. */
export type UniversoEntrega = {
  /** Los productos que Customer Success ofrece, con las etapas de su entrega. */
  servicios: Array<{ productoId: number; nombre: string; etapas: EtapaEntrega[] }>;
  /** producto → lead → la etapa que tiene ESCRITA (`cliente_entrega`). */
  filas: Record<number, Record<number, { etapa: string }>>;
  /** lead ganado → el producto de su casa (`casaDeCliente`), o null. */
  casa: Record<number, number | null>;
  /** El UNIVERSO: los leads ganados, por id. */
  ganados: Array<{ id: number; nombre: string }>;
};

/**
 * La entrega ENTERA del workspace, para quien DECIDE algo con ella (no para dibujarla):
 * la cohorte de una secuencia de entrega y lo que MaKo cuenta del curso de un cliente.
 *
 * ⚠️ TIRA SI CUALQUIER LECTURA FALLA, y es lo opuesto de `carteraEnEntrega` a propósito. La
 * pantalla prefiere dibujar de menos (defaults, todos en la primera columna) antes que no
 * dibujar; quien decide a quién se le escribe no puede: con `cliente_entrega` caída, los
 * catorce clientes «estarían» en la primera etapa y una secuencia de bienvenida le llegaría
 * a alguien que va por el hito tres. Una cohorte que no se pudo leer corta la corrida y el
 * cron vuelve en una hora (la política de `filasCohorte`, lib/nutricion.ts).
 *
 * Las filas se leen de TODOS los productos, ofrecidos o no: un producto dado de baja no tiene
 * tablero, pero las filas que alguien escribió ahí siguen siendo hechos.
 */
export async function universoDeLaEntrega(): Promise<UniversoEntrega> {
  const { productos, productoDeFunnel, funnelDefault } = await productosOfrecibles({ estricto: true });
  const ids = productos.map((p) => p.id);
  const db = await getTenantDb();
  const [catalogos, todas] = await Promise.all([
    entregasDeProductos(ids, { estricto: true }),
    // Paginado por `id`: una fila por cliente y por producto cruza las 1000 con el uso, y
    // el cliente que cae del corte no entraría a su secuencia NUNCA, sin un log.
    leerTodo<{ id: number; lead_id: number; producto_id: number; etapa: string }>(
      db, 'cliente_entrega', 'id, lead_id, producto_id, etapa', { orden: 'id' }),
  ]);
  const filas: Record<number, Record<number, { etapa: string }>> = {};
  for (const f of todas) (filas[Number(f.producto_id)] ??= {})[Number(f.lead_id)] = { etapa: f.etapa };
  const { casa, ganados } = await casasDeLosGanados(ids, productoDeFunnel, funnelDefault, filas);
  return {
    servicios: productos.map((p) => ({ productoId: p.id, nombre: p.nombre, etapas: catalogos.get(p.id)?.etapas ?? [] })),
    filas, casa, ganados,
  };
}

/**
 * Los clientes que HOY están en una etapa de la entrega: la cohorte de `entrega_actual`
 * (lib/nutricion.ts → `leadsDeCohorte`). La regla es `clientesEnEtapa` (./pertenencia.ts), la
 * misma del kanban; acá sólo se le junta el universo.
 *
 * `productoId` null = la entrega de cualquier producto (una secuencia vieja sin producto): se
 * pregunta producto por producto, con la regla de cada uno, y se juntan.
 *
 * ⚠️ Sin los dados de baja ni los graduados (`estadoCs`, ver `salioDeLaEntrega`), leídos
 * ESTRICTO como el resto: con `cs_clientes` caída no se sabe quién se fue, y una cohorte que
 * no se pudo leer corta la corrida en vez de escribirle a un cliente que ya no está.
 */
export async function clientesEnEtapaDeEntrega(productoId: number | null, etapa: string): Promise<number[]> {
  const key = (etapa ?? '').trim();
  if (!key) return [];
  const [u, estadoCs] = await Promise.all([universoDeLaEntrega(), estadosCsEstricto()]);
  const clientes = u.ganados.map((g) => g.id);
  const productos = productoId != null
    ? [productoId]
    : [...new Set([...u.servicios.map((s) => s.productoId), ...Object.keys(u.filas).map(Number)])];
  const out = new Set<number>();
  for (const p of productos) {
    const servicio = u.servicios.find((s) => s.productoId === p);
    for (const id of clientesEnEtapa({
      productoId: p, etapa: key, etapas: servicio ? servicio.etapas : null,
      clientes, casa: u.casa, asignacion: u.filas[p] ?? {}, estadoCs,
    })) out.add(id);
  }
  return [...out];
}

/**
 * lead → su estado en Customer Success (`cs_clientes.estado`). Sin fila = activo, y por eso no
 * entra al mapa. TIRA si no puede leer (`leerTodo` lanza con el error de PostgREST): es la
 * lectura que decide a quién NO escribirle.
 */
async function estadosCsEstricto(): Promise<Record<number, string>> {
  const db = await getTenantDb();
  const filas = await leerTodo<{ id: number; lead_id: number; estado: string | null }>(
    db, 'cs_clientes', 'id, lead_id, estado', { orden: 'id' });
  const out: Record<number, string> = {};
  for (const f of filas) if (f.estado) out[Number(f.lead_id)] = String(f.estado);
  return out;
}
