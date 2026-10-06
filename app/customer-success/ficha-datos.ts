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

import { etiquetaEsR2, urlComparable } from '@/lib/insights-llamada-reparto';
import { hrefPlanDeCliente } from '@/app/plan/board/filtro-cliente';

// ⛔ ACÁ VIVÍAN `entregasDe` (la etapa de cada servicio, para el renglón «Entrega» del
// Resumen) y `conteoDeTrabajo` / `fraseConteo` (el renglón «Trabajo»). Se fueron el 06/10/2026
// con esos dos renglones: la etapa pasó a los desplegables de la cabecera, que leen la
// asignación CON LO MOVIDO EN LA SESIÓN (./FichaEntrega.tsx) — una foto del server ahí
// diría una etapa vieja después de moverlo—, y el trabajo se mira en la tab Tareas.

// ── El Plan del cliente ───────────────────────────────────────────────────────

/**
 * El Plan con el filtro de ESTE cliente puesto. La URL la arma el tablero (`hrefPlanDeCliente`,
 * que es quien la lee): escrita acá a mano era una segunda copia del nombre del parámetro, y
 * además aterrizaba en Prioridades — lo mismo que la ficha ya muestra. Va a «Tareas». La ficha
 * lo navega con el `Link` de la casa, que le suma el `?ws=` de la pestaña — sin eso el super
 * admin aterrizaría en SU plan.
 */
export const rutaPlanDeCliente = (leadId: number): string => hrefPlanDeCliente(leadId);

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

/** Los datos del lead que la grilla no necesita y la ficha sí.
 *
 * ⚠️ SÓLO EL TELÉFONO desde el 06/10/2026: la venta, lo cobrado y el inicio del servicio se
 * fueron del Resumen y viven en la tab Pagos (el `DealDetailsCard` del CRM, que lee el lead
 * entero al abrirse). Traerlos con el HTML para no dibujarlos era bajarlos para nadie. */
export type ContactoFicha = {
  telefono: string | null;
  /** `leads.web` (mig 0194): la «Web» que reemplazó a «Dirección» en la Información
   *  principal del CRM, que es la que se monta en el Resumen. */
  web: string | null;
  /** `leads.foto_auto_url` (mig 0195): la foto de WhatsApp COPIADA a nuestro bucket por el cron
   *  del CRM. No vence, así que se prueba antes que el proxy de WhatsApp en vivo. */
  fotoGuardada: string | null;
};

/**
 * Todo lo que la ficha dibuja además del tablero y el equipo.
 *
 * ⚠️ CADA MITAD TIENE SU `null`, y no es lo mismo que vacío. `llamadas: []` es «no tiene
 * ninguna» y `llamadas: null` es «no se pudo leer»: con un solo valor, una lectura caída le
 * diría a alguien que nunca habló con su cliente. Lo mismo `contacto` (la lectura de leads).
 */
export type FichaExtra = {
  contacto: ContactoFicha | null;
  llamadas: LlamadaCliente[] | null;
  /** Su Gravatar, armado en el server (`urlGravatar`, con `d=404`). Es la SEGUNDA cara que
   *  se prueba si nadie eligió una: primero va la de WhatsApp (./foto-cliente.ts). */
  fotoEmail?: string | null;
};
