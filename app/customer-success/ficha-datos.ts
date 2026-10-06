// =============================================================================
// ficha-datos — lo que dibujan el «Resumen» y las «Llamadas» de la ficha (puro)
// =============================================================================
// Sin 'use client' ni 'server-only' a propósito: lo arma el server (page.tsx, con lo que
// lee `ficha-lectura.ts` y lo que ya leyó `carteraEnEntrega`), lo dibuja la ficha y lo
// ejecuta un test (tests/cs-ficha-resumen.test.ts). Acá no se lee ni se escribe nada:
// entran filas crudas y sale lo que se muestra.
//
// Pedido de Martín (05/10/2026): «una tab de "Resumen" antes de "Prioridades", que
// contenga los datos más importantes del cliente… y tal vez otra tab con las llamadas de
// fathom que se tuvo con ese cliente».
//
// ⚠️ NADA DE ESTO SE PIDE AL ABRIR LA FICHA. Viaja con el HTML por la misma razón que el
// tablero y el equipo (ver la cabecera de FichaCliente): un modal que consulta al abrirse
// tiene estado de carga por más rápida que sea la consulta. La única excepción son las
// Notas, que se REUSAN del CRM tal cual (`NotasCard`) y traen su propia lectura — una
// segunda forma de guardar notas sería la copia que diverge.

import { repartirEnEtapas, colorDeEtapa, faseDe, type EtapaEntrega, type FaseEntrega } from '@/lib/servicio-etapas';
import { etiquetaEsR2, urlComparable } from '@/lib/insights-llamada-reparto';
import { esRecurrente } from '@/lib/plan-recurrentes';
import { estaPendiente } from '@/lib/todo-estados';
import { hrefPlanDeCliente } from '@/app/plan/board/filtro-cliente';
import type { TrabajoDeCliente } from './trabajo';

// ── La entrega: en qué etapa de cada servicio está ────────────────────────────

/** En qué etapa de UN servicio está el cliente, como lo dibuja el Resumen. */
export type EntregaDeCliente = {
  productoId: number;
  servicio: string;
  /** El rótulo de la etapa. `null` = su fila apunta a una etapa que el catálogo ya no
   *  tiene (alguien borró esa columna): se dice, no se le inventa otra. */
  etapa: string | null;
  /** El rótulo de su fase, si la etapa pertenece a una. */
  fase: string | null;
  /** El color con el que el kanban pinta esa columna. Sale de `colorDeEtapa`, nunca de acá. */
  color: string | null;
  /** Desde cuándo está ahí (`etapa_desde`). `null` = nunca se movió: su reloj no arrancó. */
  desde: string | null;
};

type FilaEntrega = { etapa: string; etapa_desde: string };
type ServicioEntrega = { productoId: number; nombre: string; etapas: readonly EtapaEntrega[]; fases: readonly FaseEntrega[] };

/**
 * Dónde está este cliente en cada servicio.
 *
 * ⚠️ LA MISMA REGLA QUE EL KANBAN, DELEGADA Y NO COPIADA. Un cliente sin fila está en la
 * PRIMERA etapa (`repartirEnEtapas`), y una fila con una etapa que ya no existe es un
 * huérfano. Si esto decidiera por su cuenta, la tarjeta del kanban diría «Onboarding» y el
 * Resumen del MISMO cliente diría «sin etapa» — dos vistas de la misma cartera contando
 * cosas distintas, que es lo que el dueño ya reportó como «Jamás puede ser eso».
 *
 * Y va UN renglón por servicio, todos: el kanban de cada servicio dibuja a la cartera
 * entera, así que el Resumen no puede elegir cuáles mostrar sin contradecirlo.
 */
export function entregasDe(
  leadId: number,
  servicios: readonly ServicioEntrega[],
  porServicio: Readonly<Record<number, Readonly<Record<number, FilaEntrega>>>>,
): EntregaDeCliente[] {
  const out: EntregaDeCliente[] = [];
  for (const s of servicios) {
    const fila = porServicio[s.productoId]?.[leadId] ?? null;
    const { porEtapa, huerfanos } = repartirEnEtapas(s.etapas, [leadId], () => fila?.etapa ?? null);
    if (huerfanos.length) {
      out.push({ productoId: s.productoId, servicio: s.nombre, etapa: null, fase: null, color: null, desde: fila?.etapa_desde ?? null });
      continue;
    }
    const e = s.etapas.find((x) => porEtapa[x.key]?.includes(leadId));
    // Sin etapas no hay tablero, y entonces tampoco hay qué decir de ese servicio.
    if (!e) continue;
    out.push({
      productoId: s.productoId, servicio: s.nombre,
      etapa: e.label, fase: faseDe(s.fases, e.fase)?.label ?? null,
      color: colorDeEtapa(e, s.fases),
      // Sin fila, el reloj no arrancó: un «recién» ahí sería afirmar algo que nadie midió.
      desde: fila?.etapa_desde ?? null,
    });
  }
  return out;
}

// ── El trabajo: cuántos proyectos, tareas y recurrentes ──────────────────────

export type ConteoTrabajo = { proyectos: number; tareas: number; recurrentes: number };

/**
 * Los tres números del Resumen, sacados de las MISMAS filas que dibuja «Prioridades».
 *
 * ⚠️ NO DEL CRUCE DE LA TARJETA (`tableroDeLaCartera`), y es a propósito: la tarjeta
 * también ata por NOMBRE de proyecto, y este bloque lleva un botón al Plan filtrado a este
 * cliente, que filtra por la CLAVE. Con el cruce, el número de acá podía prometer trabajo
 * que el Plan no le muestra.
 *
 * «Tareas» son las ABIERTAS y con fin; las recurrentes van aparte y no se cuentan como
 * pendiente (mig 0163). El criterio de «abierta» es el de los dos tableros: en el del dueño
 * sale del avance, en el del cliente del estado (`estaPendiente`, que deja afuera lo que el
 * criterio no dejó pasar).
 */
export function conteoDeTrabajo(t: TrabajoDeCliente): ConteoTrabajo {
  let tareas = 0, recurrentes = 0;
  if (t.dueno) {
    for (const x of t.tareas) {
      if (esRecurrente(x)) { recurrentes++; continue; }
      if (x.progress < 100) tareas++;
    }
    return { proyectos: t.proyectos.length, tareas, recurrentes };
  }
  for (const x of t.tareas) {
    if (esRecurrente(x)) { recurrentes++; continue; }
    if (estaPendiente(x.estado)) tareas++;
  }
  return { proyectos: t.categorias.length, tareas, recurrentes };
}

/**
 * El Plan con el filtro de ESTE cliente puesto. La URL la arma el tablero (`hrefPlanDeCliente`,
 * que es quien la lee): escrita acá a mano era una segunda copia del nombre del parámetro, y
 * además aterrizaba en Prioridades — lo mismo que la ficha ya muestra. Va a «Tareas». La ficha
 * lo navega con el `Link` de la casa, que le suma el `?ws=` de la pestaña — sin eso el super
 * admin aterrizaría en SU plan.
 */
export const rutaPlanDeCliente = (leadId: number): string => hrefPlanDeCliente(leadId);

/** «1 proyecto · 3 tareas · 2 recurrentes». Siempre los tres: un cero también es un dato. */
export function fraseConteo(n: ConteoTrabajo): string {
  const p = (k: number, uno: string, varios: string) => `${k} ${k === 1 ? uno : varios}`;
  return [p(n.proyectos, 'proyecto', 'proyectos'), p(n.tareas, 'tarea', 'tareas'), p(n.recurrentes, 'recurrente', 'recurrentes')].join(' · ');
}

// ── Las llamadas ──────────────────────────────────────────────────────────────

/** Una llamada con el cliente, como la lista la tab «Llamadas». */
export type LlamadaCliente = {
  titulo: string;
  /** `YYYY-MM-DD`, el día de la llamada. `null` = no se sabe, y se dice así. */
  fecha: string | null;
  url: string | null;
  duracionMin: number | null;
  /** De qué fue, cuando el Closing Analyst lo clasificó: una venta o una sesión de la
   *  entrega. `null` = no clasificada (un link pegado a mano no trae categoría). */
  tipo: 'venta' | 'entrega' | null;
};

/** Una fila de `closing_analyses` (mig 0037), ya filtrada a este lead. */
export type FilaGrabacion = {
  title: string | null; call_date: string | null; started_at: string | null;
  duration_min: number | null; share_url: string | null; call_url: string | null;
  category: string | null;
};

/**
 * Las llamadas de un cliente: las grabaciones de Fathom que el Closing Analyst le atribuyó,
 * más los links de `leads.fathom_links` que ninguna de ellas cubre. Las más nuevas primero.
 *
 * ⚠️ DOS FUENTES Y NO UNA, porque cada una ve la mitad. `fathom_links` es lo que la ficha del
 * CRM muestra en «Reuniones», y sólo tiene R1 y R2 —las llamadas de VENTA, antes de ser
 * cliente— y sin fecha (`FathomLink` es `{ label, url }`). Las sesiones de la ENTREGA, que
 * son las que le importan a Customer Success, están en `closing_analyses` con
 * `category = 'entrega_servicio'`, con su título, su día y su duración. Con una sola fuente,
 * la tab de un cliente en plena entrega mostraría sólo cómo se le vendió.
 *
 * ⚠️ SE CRUZAN POR URL NORMALIZADA (`urlComparable`, la misma que usa el CRM para atar un
 * link con su análisis), o la misma grabación sale dos veces: una por cada fuente.
 *
 * ⚠️ Y LA FECHA DE UN LINK SUELTO ES LA DE SU REUNIÓN, con el mismo reparto que la ficha
 * del CRM (`etiquetaEsR2`; lo que no dice R2 va a R1). No es un dato nuevo: es la fecha
 * que el CRM ya dibuja al lado de ese mismo link.
 */
export function llamadasDe(opts: {
  grabaciones: readonly FilaGrabacion[];
  links: ReadonlyArray<{ label?: string | null; url?: string | null }>;
  fechaJ1: string | null;
  fechaJ2: string | null;
}): LlamadaCliente[] {
  const out: LlamadaCliente[] = [];
  const vistas = new Set<string>();
  const marcar = (u: string | null | undefined) => { const k = urlComparable(u); if (k) vistas.add(k); };

  for (const g of opts.grabaciones) {
    const url = g.share_url?.trim() || g.call_url?.trim() || null;
    marcar(g.share_url); marcar(g.call_url);
    out.push({
      titulo: g.title?.trim() || 'Llamada',
      // `call_date` ya está en el día del negocio (lo escribe closing.ts). `started_at` es
      // UTC: cortarlo a diez caracteres corre un día a las llamadas de la noche, así que
      // sólo se usa si no hay otra cosa.
      fecha: diaValido(g.call_date) ?? diaValido(g.started_at?.slice(0, 10)),
      url,
      duracionMin: typeof g.duration_min === 'number' && g.duration_min > 0 ? Math.round(g.duration_min) : null,
      tipo: g.category === 'venta' ? 'venta' : g.category === 'entrega_servicio' ? 'entrega' : null,
    });
  }

  // Al revés: `fathom_links` se escribe AGREGANDO al final, así que el último es el más
  // nuevo. Recorrido así, el orden estable de abajo deja primero lo más reciente cuando
  // dos links no tienen fecha que los distinga.
  for (const l of [...opts.links].reverse()) {
    const url = l.url?.trim();
    if (!url) continue;
    const k = urlComparable(url);
    if (vistas.has(k)) continue;
    vistas.add(k);
    out.push({
      titulo: l.label?.trim() || 'Grabación',
      fecha: diaValido(etiquetaEsR2(l.label) ? opts.fechaJ2 : opts.fechaJ1),
      url, duracionMin: null, tipo: null,
    });
  }

  // Las más nuevas primero; las que no tienen fecha, al final. `sort` es estable, así que
  // entre dos sin fecha queda el orden de arriba.
  return out
    .map((x, i) => ({ x, i }))
    .sort((a, b) => {
      if (a.x.fecha && b.x.fecha) return a.x.fecha < b.x.fecha ? 1 : a.x.fecha > b.x.fecha ? -1 : a.i - b.i;
      if (a.x.fecha) return -1;
      if (b.x.fecha) return 1;
      return a.i - b.i;
    })
    .map(({ x }) => x);
}

/** Un `YYYY-MM-DD` real o nada. Un texto que no es fecha no se dibuja como si lo fuera. */
function diaValido(s: string | null | undefined): string | null {
  const d = (s ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) ? d : null;
}

// ── Lo que viaja en cada cliente ─────────────────────────────────────────────

/** Los datos del lead que la grilla no necesita y la ficha sí. */
export type ContactoFicha = {
  telefono: string | null;
  /** `leads.monto_cierre_usd`: el valor con el que se cerró la venta. */
  montoCierreUsd: number | null;
  /** `leads.total_cobrado_usd`: lo cobrado, derivado de los pagos (Fase 8-bis). */
  totalCobradoUsd: number | null;
  fechaInicioServicio: string | null;
};

/**
 * Todo lo que la ficha dibuja además del tablero y el equipo.
 *
 * ⚠️ CADA MITAD TIENE SU `null`, y no es lo mismo que vacío. `llamadas: []` es «no tiene
 * ninguna» y `llamadas: null` es «no se pudo leer»: con un solo valor, una lectura caída le
 * diría a alguien que nunca habló con su cliente. Lo mismo `entregas` (la lectura de la
 * entrega falló) y `contacto` (la de leads).
 */
export type FichaExtra = {
  contacto: ContactoFicha | null;
  llamadas: LlamadaCliente[] | null;
  entregas: EntregaDeCliente[] | null;
};
