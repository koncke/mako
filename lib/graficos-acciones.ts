// =============================================================================
// graficos-acciones — qué se puede hacer desde un número del Dashboard
// =============================================================================
// Punto 5 del feedback de Martín (11/10/2026): «Los gráficos interactivos... Sería bueno que identifiques
// botones de acción dentro de MaKo que podríamos usar». Un clic en un número (una KPI, una barra, una
// porción, una fila) abre su DETALLE: la lista de las cosas que lo forman (app/dashboard/Detalle.tsx,
// leída por lib/graficos-detalle.ts), y en cada fila las ACCIONES de este archivo. Arriba, «Filtrar la
// página por esto».
//
// PURO y sin `server-only`, a propósito: lo importan la pantalla (para dibujar los botones), el server (para
// armar la respuesta) y los tests. Nada del registro de la API de MaKo (lib/api-mako/registro.ts no se
// importa desde un `use client`), y nada de IA: los botones llaman a las server actions de PANTALLA que ya
// existen, y quien aprieta el botón es la persona que confirma.
//
// Lo que no se ve en la firma:
//   · Sólo REVERSIBLES y sin plata. Marcar calificado (manda conversiones a Meta que no se deshacen), marcar
//     que no asistió (borra el calificado) y tocar un presupuesto NO van acá: necesitan un Confirm con la
//     consecuencia pegada, y eso es su pantalla. El test lo frena.
//   · Qué acciones se ofrecen depende de la CAPA del workspace (`tabEnCapa`, calculado en el server y
//     devuelto en la respuesta del detalle). Sin eso, un workspace sin CRM ve botones que fallan.
//   · Los ids de una fila salen de la MISMA fila del server (`Fila.r`): la cuota y su lead viajan juntos,
//     porque `marcarPagoAction` no comprueba que la cuota sea de ese lead.

import { CAMPOS, ENTIDADES, fuenteDe, type DestinoDetalle, type EntidadDetalle, type FiltroDim, type Formato, type IdEntidad } from './graficos-catalogo';
import type { FilaEntidad } from './graficos-agregar';
import { diasAntes } from './date-utils';

/**
 * Lo que se clickeó. KPI → `{ dimension: null, valor: null }`; una barra, una fila o una porción → su
 * dimensión y la CLAVE del grupo (para una categoría es la etiqueta; para el tiempo, la fecha en que empieza
 * el día, la semana o el mes — «03/10» no se puede volver a leer). `metrica`: qué serie o qué escalón del
 * embudo, cuando no es la primera.
 */
export type SelDetalle = { dimension: string | null; valor: string | null; metrica?: string };

/** Qué tabs tiene el workspace: decide qué acciones se dibujan. La calcula el server. */
export type Capacidades = { crm: boolean; ads: boolean; closing: boolean; plan: boolean };
export const SIN_CAPACIDADES: Capacidades = { crm: false, ads: false, closing: false, plan: false };

/** Los ids de una fila del detalle (lib/graficos-catalogo.ts, `ENTIDADES[...].ids`). */
export type IdsFila = Partial<Record<IdEntidad, string>>;

/** El rótulo del estado de una cuota cobrada. Lo escribe el lector de pagos y lo mira «Marcar cobrada». */
export const ESTADO_COBRADO = 'Cobrado';

/**
 * Las dimensiones que el detalle usa para NOMBRAR una fila y que traen nombres de personas (`<conjunto>.<dim>`):
 * el lead, el cliente de una cuota o de una entrega, y los títulos de una llamada (suele decir con quién fue) y
 * de una tarea (suele decir a quién). Ninguna viaja a un modelo de IA (AGENTS: un dato con nombres de personas
 * no se le manda a ninguno): quedan FUERA de `DIMENSIONES_PUBLICAS` (lib/graficos-analisis.ts), y
 * tests/graficos-interactividad.test.ts cruza las dos listas — la próxima que se sume acá tiene que quedar
 * afuera de allá, o el test cae.
 */
export const DIMENSIONES_PERSONA: readonly string[] = ['leads.lead', 'pagos.cliente', 'entrega.cliente', 'llamadas.llamada', 'tareas.tarea'];

export type AccionId = 'abrir_ficha' | 'marcar_cobrada' | 'ver_anuncio' | 'ver_llamada' | 'abrir_tarea';
type Periodo = { desde: string; hasta: string };
export type AccionDef = {
  id: AccionId;
  titulo: string;
  /** Los ids que la fila tiene que traer, TODOS. */
  requiere: IdEntidad[];
  /** La tab que el workspace tiene que tener. */
  capa: keyof Capacidades;
  /** `ficha` abre la ficha del lead encima · `cobrar` llama a marcarPagoAction con Deshacer · `link` navega. */
  tipo: 'ficha' | 'cobrar' | 'link';
  href?: (ids: IdsFila, p: Periodo) => string;
};

/**
 * Las acciones, entidad por entidad. Lo que ya existe en MaKo, sin una sola implementación nueva:
 *   · lead    → la ficha (LeadEditModal, la misma de los desgloses de /general).
 *   · cuota   → «Marcar cobrada» (marcarPagoAction, app/crm/actions.ts), con Deshacer de 5 s.
 *   · anuncio → /anuncio/<ad_id>, la página del anuncio solo (misma puerta que el Ads Manager).
 *   · llamada → /closing?call=<recording_id>, que abre esa llamada directo.
 *   · tarea   → /plan?tarea=<id>, que abre esa tarjeta.
 */
export const ACCIONES: readonly AccionDef[] = [
  { id: 'abrir_ficha', titulo: 'Abrir ficha', requiere: ['lead'], capa: 'crm', tipo: 'ficha' },
  { id: 'marcar_cobrada', titulo: 'Marcar cobrada', requiere: ['pago', 'lead'], capa: 'crm', tipo: 'cobrar' },
  {
    id: 'ver_anuncio', titulo: 'Ver anuncio', requiere: ['anuncio'], capa: 'ads', tipo: 'link',
    href: (ids, p) => `/anuncio/${encodeURIComponent(ids.anuncio ?? '')}?desde=${p.desde}&hasta=${p.hasta}`,
  },
  { id: 'ver_llamada', titulo: 'Ver llamada', requiere: ['llamada'], capa: 'closing', tipo: 'link', href: (ids) => `/closing?call=${encodeURIComponent(ids.llamada ?? '')}` },
  { id: 'abrir_tarea', titulo: 'Abrir tarea', requiere: ['tarea'], capa: 'plan', tipo: 'link', href: (ids) => `/plan?tarea=${encodeURIComponent(ids.tarea ?? '')}` },
];

export type AccionFila = { id: AccionId; titulo: string; tipo: AccionDef['tipo']; href?: string };

/** Las acciones de UNA fila: las que tienen todos sus ids, cuya tab está en la capa, y que tienen sentido en su estado. */
export function accionesDeFila(fila: { ids: IdsFila; estado: string | null }, puede: Capacidades, periodo: Periodo): AccionFila[] {
  const out: AccionFila[] = [];
  for (const a of ACCIONES) {
    if (!puede[a.capa]) continue;
    if (!a.requiere.every((k) => typeof fila.ids[k] === 'string' && fila.ids[k] !== '')) continue;
    // Una cuota ya cobrada no se vuelve a cobrar (desmarcarla es un error de carga: va en su ficha).
    if (a.id === 'marcar_cobrada' && fila.estado === ESTADO_COBRADO) continue;
    out.push({ id: a.id, titulo: a.titulo, tipo: a.tipo, ...(a.href ? { href: a.href(fila.ids, periodo) } : {}) });
  }
  return out;
}

/**
 * El campo de los controles (CAMPOS) que corresponde a una dimensión de categoría: lo que usa «Filtrar la
 * página por esto». Uno compartido (Campaña) gana sobre el propio del conjunto, así filtra también los
 * gráficos de los otros conjuntos donde significa lo mismo. `null` = el tiempo o algo que no existe.
 */
export function campoParaFiltrar(fuenteId: string, dimension: string | null): string | null {
  if (!dimension) return null;
  const d = fuenteDe(fuenteId)?.dimensiones.find((x) => x.id === dimension);
  if (!d || d.clase !== 'categoria') return null;
  return CAMPOS.find((c) => c.en[fuenteId] === dimension)?.id ?? null;
}

const TIEMPOS = new Set(['dia', 'semana', 'mes']);
export const esDimensionTiempo = (d: string | null | undefined): boolean => !!d && TIEMPOS.has(d);
const dos = (n: number) => String(n).padStart(2, '0');

/** El tramo de días de un grupo de tiempo, desde su clave (el lunes de la semana, el 1 del mes). */
export function rangoDeClave(dim: string, clave: string): Periodo | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clave)) return null;
  if (dim === 'dia') return { desde: clave, hasta: clave };
  if (dim === 'semana') return { desde: clave, hasta: diasAntes(clave, -6) };
  if (dim === 'mes') {
    const [y, m] = clave.split('-').map(Number);
    const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { desde: `${y}-${dos(m)}-01`, hasta: `${y}-${dos(m)}-${dos(ultimo)}` };
  }
  return null;
}

export type PlanDetalle = {
  desde: string;
  hasta: string;
  /** Los filtros del gráfico y el del grupo clickeado, ya en las dimensiones del conjunto del detalle. */
  filtros: FiltroDim[];
  /** Los filtros del gráfico que el conjunto del detalle no puede aplicar (sus nombres): se dicen, no se callan. */
  noAplica: string[];
  /** El grupo clickeado no existe en el conjunto del detalle: listar sería listar TODO, y eso mentiría. */
  grupoPerdido: boolean;
};

/**
 * Cómo se lee el detalle: los filtros del gráfico (en las dimensiones de SU conjunto) traducidos al conjunto
 * del detalle por los CAMPOS compartidos, más el grupo clickeado — una categoría es un filtro más; un día,
 * una semana o un mes acotan el período. `agrupar` es el «agrupar por» que la vista le puso al gráfico: con
 * él, la clave clickeada es de una semana aunque el gráfico diga «por día».
 */
export function planDetalle(origen: string, destino: DestinoDetalle, filtros: FiltroDim[], sel: SelDetalle, periodo: Periodo, agrupar?: string | null): PlanDetalle {
  const traducir = (dim: string): string | null => {
    if (origen === destino.fuente) return dim;
    return CAMPOS.find((c) => c.en[origen] === dim)?.en[destino.fuente] ?? null;
  };
  const nombreDe = (dim: string) => CAMPOS.find((c) => c.en[origen] === dim)?.nombre ?? dim;
  const out: PlanDetalle = { desde: periodo.desde, hasta: periodo.hasta, filtros: [], noAplica: [], grupoPerdido: false };
  for (const f of filtros) {
    const d2 = traducir(f.dimension);
    if (d2) out.filtros.push({ ...f, dimension: d2 });
    else out.noAplica.push(nombreDe(f.dimension));
  }
  if (sel.dimension && sel.valor != null) {
    if (esDimensionTiempo(sel.dimension)) {
      const dimT = esDimensionTiempo(agrupar) ? agrupar! : sel.dimension;
      const r = rangoDeClave(dimT, sel.valor);
      if (!r) out.grupoPerdido = true;
      else {
        if (r.desde > out.desde) out.desde = r.desde;
        if (r.hasta < out.hasta) out.hasta = r.hasta;
      }
    } else {
      const d2 = traducir(sel.dimension);
      if (d2) out.filtros.push({ dimension: d2, valores: [sel.valor] });
      else out.grupoPerdido = true;
    }
  }
  return out;
}

/**
 * Lo leído, recortado al tramo clickeado cuando el conjunto se lee ENTERO (una fecha «hoy», `sinRango`): ese
 * lector no mira el período, así que el día, la semana o el mes del grupo se aplican acá. Sin esto, el detalle
 * de «las tareas creadas el 03/10» de un gráfico de tareas «hoy» listaba TODAS las tareas.
 */
export function recortarAlTramo<T extends { f: string | null }>(filas: T[], plan: Periodo, sel: SelDetalle, sinRango: boolean): T[] {
  if (!sinRango || !esDimensionTiempo(sel.dimension) || sel.valor == null) return filas;
  return filas.filter((x) => !!x.f && x.f >= plan.desde && x.f <= plan.hasta);
}

/** Una fila del detalle, lista para dibujar. */
export type FilaDetalle = {
  id: string;
  nombre: string;
  /** Lo que va chico abajo: la campaña y el conjunto de un anuncio, la etapa de un lead. */
  linea: string | null;
  /** La última fecha de la entidad en el período (la reunión, el pago). */
  fecha: string | null;
  /** En el orden de `columnas` de la respuesta. */
  valores: Array<number | null>;
  ids: IdsFila;
  estado: string | null;
};
export type ColumnaDetalle = { id: string; nombre: string; formato: Formato };
export type RespuestaDetalle =
  | {
    ok: true;
    /** `null` = ese número no tiene cosas atrás que listar: el detalle sólo ofrece filtrar. */
    entidad: EntidadDetalle | null;
    plural: string | null;
    columnas: ColumnaDetalle[];
    filas: FilaDetalle[];
    /** Las que aportaban y no entraron por el tope. */
    fuera: number;
    /** Las filas sin id (no se pueden listar como una cosa). */
    sinId: number;
    noAplica: string[];
    desde: string;
    hasta: string;
    puede: Capacidades;
    /** El hoy del negocio: la fecha con que se marca un cobro. */
    hoy: string;
  }
  | { ok: false; error: string };

/**
 * De una entidad agrupada a la fila que se dibuja: el nombre y la línea con las dimensiones que declara
 * `ENTIDADES`, los ids con sus referencias, y los valores de las columnas que se muestran (la métrica que
 * decide quién entra puede no ser una de ellas). `metricas` es el orden en que se agregó.
 */
export function aFilaDetalle(fuenteId: string, fe: FilaEntidad, metricas: string[], columnas: string[]): FilaDetalle | null {
  const ent = ENTIDADES[fuenteId];
  if (!ent) return null;
  const juntar = (dims: string[]) => dims.map((k) => fe.d[k]).filter((x): x is string => !!x && !!x.trim()).join(' · ');
  const ids: IdsFila = {};
  for (const [k, ref] of Object.entries(ent.ids) as Array<[IdEntidad, string]>) {
    const v = ref === ent.ref ? fe.id : fe.r[ref];
    if (v) ids[k] = v;
  }
  return {
    id: fe.id,
    nombre: juntar(ent.nombre) || '(sin nombre)',
    linea: juntar(ent.linea) || null,
    fecha: fe.hasta ?? null,
    valores: columnas.map((c) => { const i = metricas.indexOf(c); return i < 0 ? null : fe.valores[i] ?? null; }),
    ids,
    estado: fe.d.estado ?? null,
  };
}

// ── La leyenda que prende y apaga series (lo que hacía el selector de métricas de la vieja Tendencias) ──

/**
 * Prende o apaga la serie `k`. La ÚLTIMA visible no se apaga: un gráfico sin series se lee como «no hay
 * datos». Devuelve el mismo conjunto si no cambió nada (React no redibuja).
 */
export function alternarSerie(prev: ReadonlySet<string>, k: string, claves: readonly string[]): ReadonlySet<string> {
  const n = new Set(prev);
  if (n.has(k)) { n.delete(k); return n; }
  if (!claves.some((x) => x !== k && !n.has(x))) return prev;
  n.add(k);
  return n;
}
/** ¿La serie `k` está apagada? Si quedaron TODAS apagadas (cambiaron las métricas del gráfico), ninguna. */
export const serieOculta = (ocultas: ReadonlySet<string>, k: string, claves: readonly string[]): boolean =>
  ocultas.has(k) && claves.some((x) => !ocultas.has(x));
