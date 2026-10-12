// =============================================================================
// crm-map — Lead (Supabase) → CrmLead (view-model del CRM)
// =============================================================================
// Extraído de /crm/page.tsx para que tanto la página del CRM como la server
// action getCrmLeadAction (modal de edición in-place) armen el MISMO view-model.

import { resolverNombreCampana } from '@/lib/queries';
import { deriveStageKey } from '@/lib/pipeline';
import type { Lead } from '@/lib/leads';
import { origenLista, SIN_ORIGEN_LISTA, canalDeLead } from './origen-lead';
import type { CrmLead } from './CrmBoard';
import { origenAds, type Anuncio } from '@/lib/campana-atribucion';
import { etapaDeEntrada } from '@/lib/lead-funnel-reglas';
import { suscripcionDeFila } from '@/lib/venta-tipo';

export type VisitasMap = Map<string, { total_visitas: number; dias_distintos: number }>;

/**
 * Las columnas de ESTE tablero, y cuál es la de ENTRADA.
 *
 * Es el `Set` de claves de siempre (el mapper sólo pregunta `.has`) con un dato más: por qué
 * columna se entra a este producto. Lo necesitan los AGREGADOS (mig 0207, `Lead.de_fila`):
 * si la etapa de su fila ya no existe acá, caen a la entrada — no a la etapa derivada, que
 * sale del recorrido de su CASA (ver `mapToCrmLead`).
 *
 * Viaja pegado al `Set` y no como un quinto parámetro para que la página siga llamando al
 * mapper con la misma firma; lo arma ESTA función, así que la entrada sale siempre de
 * `etapaDeEntrada` (lib/lead-funnel-reglas.ts), la misma regla con la que `agregarAProducto`
 * elige la etapa de una fila nueva.
 */
export type EtapasDelTablero = Set<string> & { entrada?: string | null };

export function etapasDelTablero(stages: readonly { key: string; kind?: string | null }[]): EtapasDelTablero {
  return Object.assign(new Set(stages.map((s) => s.key)), { entrada: etapaDeEntrada(stages) });
}


export function origenLegible(lead: Lead, campMap: Record<string, string>): string {
  const nombreMeta = lead.meta_ad_name?.trim() || lead.meta_campaign_name?.trim();
  if (nombreMeta) return nombreMeta;
  if (lead.utm_campaign?.trim()) {
    const r = resolverNombreCampana(lead.utm_campaign, campMap);
    if (r.texto) return r.texto;
  }
  if (lead.meta_lead_id || lead.meta_ad_id) return 'Meta · sin nombre';
  // ⚠️ ESTE ES EL QUE SE VE. `origin` lo dibuja la tarjeta del tablero (CrmBoard) y
  // además ARMA las opciones del filtro de origen, que se derivan de los valores
  // presentes. Antes contestaba «Directo» para todo lo que no tuviera campaña: los
  // 1.000 contactos de una importación y los que llegaron solos, en la misma bolsa y
  // con una etiqueta que afirmaba de los dos que habían llegado por su cuenta.
  return origenLista(lead.origen_lead);
}

export function fmtDay(s: string | null): string | null {
  if (!s) return null;
  const d = s.length <= 10 ? new Date(`${s}T00:00:00Z`) : new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(d);
}

export function calendlyDe(l: Lead): { q: string; a: string }[] {
  const pairs: Array<[string, string | null]> = [
    ['¿A qué te dedicas?', l.respuesta_objetivo],
    ['Facturación mensual actual', l.respuesta_facturacion],
    ['Colaboradores', l.respuesta_colaboradores],
    ['¿Cuándo quieres empezar?', l.respuesta_cuando_empezar],
    ['¿Listo para invertir?', l.respuesta_inversion],
    ['¿Eres el decisor?', l.respuesta_decisor],
  ];
  return pairs.filter(([, a]) => !!a && a.trim()).map(([q, a]) => ({ q, a: a as string }));
}

export function mapToCrmLead(
  l: Lead,
  campMap: Record<string, string>,
  /** Las columnas del tablero. Con `etapasDelTablero(stages)` trae además la de entrada. */
  validStageKeys?: Set<string> | EtapasDelTablero,
  /** Para el filtro por campaña y por creativo. Sin esto, los cuatro campos van en null. */
  atrib?: { anuncios: Map<string, Anuncio>; adMap: Record<string, string> },
): CrmLead {
  // Etapa efectiva: el override manual SOLO si sigue existiendo en el funnel
  // actual; si el override quedó huérfano (etapa eliminada del funnel), se ignora
  // y se usa la etapa derivada de los campos del lead — salvo un AGREGADO, abajo.
  const override = l.pipeline_stage;
  const huerfano = !!override && !!validStageKeys && !validStageKeys.has(override);
  /**
   * ⚠️ UN AGREGADO (`de_fila`, mig 0207) NO SE DERIVA. Está en este tablero por una fila de
   * `lead_funnel` y su `pipeline_stage` ya viene reemplazado por la etapa de ESA fila
   * (`listLeadsDeFunnel`). La derivada sale de SUS campos —asistencias, fechas de reunión,
   * `estado_lead`—, que son el recorrido de su CASA: un lead ganado en el producto principal
   * y agregado ayer a otro se dibujaría acá en «Ganado» con el avance de otro producto, que
   * es exactamente lo que el modelo de varios productos vino a separar.
   *
   * Si la etapa de su fila ya no existe en este embudo, cae a la ETAPA DE ENTRADA, que es por
   * donde se entra a un producto (la misma regla que eligió la etapa al agregarlo). Y el dato
   * no se borra: `stageFuera` lo sigue diciendo en la tarjeta, como para cualquier huérfano.
   */
  const deFila = l.de_fila != null ? Number(l.de_fila) : null;
  // Con un `Set` pelado (sin `etapasDelTablero`) la entrada es la primera columna, que es
  // también lo que `etapaDeEntrada` contesta cuando ninguna se declara de entrada.
  const entrada = (validStageKeys as EtapasDelTablero | undefined)?.entrada
    ?? (validStageKeys ? validStageKeys.values().next().value : undefined)
    ?? null;
  const derived = deFila == null
    ? deriveStageKey(l)
    : (override && !huerfano ? override : (entrada ?? override ?? ''));
  const stage = override && (!validStageKeys || validStageKeys.has(override)) ? override : derived;
  return {
    id: l.id,
    ...(deFila != null ? { deFila } : {}),
    // Posición REAL en el funnel (ignora override manual) — la usa el worklist. Para un
    // agregado es la de su fila: el worklist es del recorrido de la casa y no lo mira
    // (app/crm/page.tsx lo acota), y una derivada acá sería el avance de otro producto.
    derivedStage: derived,
    /**
     * La etapa que el lead DICE tener y que este funnel ya no contiene.
     *
     * ⚠️ HASTA EL 27/09/2026 ESTE HECHO SE DESTRUÍA ACÁ. El override huérfano se
     * descartaba en silencio y el lead caía en la etapa derivada —y `effStage`, si
     * ni esa existe, lo manda a la PRIMERA COLUMNA—: 1.057 leads del ws1 dibujados
     * como si estuvieran en «Nuevo» por tener `reactivacion`, `noshow_r1` o
     * `noshow_r2`, que son etapas que el funnel dejó de tener.
     *
     * Descartar el override para UBICARLO es correcto: no se puede dibujar una
     * columna que no existe. Lo que no se puede es además borrar el dato — «no
     * poder hacer X con este dato no es que el dato sea falso» (AGENTS.md). Se
     * conserva para poder DECIRLO en la tarjeta, que es la diferencia entre un
     * tablero que miente y uno que avisa.
     */
    stageFuera: huerfano ? override : null,
    name: l.nombre,
    email: l.email ?? '',
    company: l.empresa ?? 'Sin empresa',
    origin: origenLegible(l, campMap),
    canal: canalDeLead(l),
    ...(atrib ? origenAds(l, atrib.anuncios, campMap, atrib.adMap) : { campanaKey: null, campanaNombre: null, anuncioKey: null, anuncioNombre: null }),
    stage,
    created: fmtDay(l.created_at) ?? '—',
    monto: l.monto_cierre_usd ?? 0,
    totalCobrado: l.total_cobrado_usd ?? 0,
    // El ingreso ESTIMADO (mig 0258, punto 21 del 12/10/2026): lo que alguien cree que vale el
    // lead mientras está abierto, en USD. Lo suma el encabezado de cada columna con la marca de
    // estimado (CrmBoard). NO es el `monto`: ése es la venta y lo cuenta Revenue. `null` = nadie
    // lo cargó, que no es 0. El `Number` porque un `numeric` de Postgres puede llegar como texto
    // por un driver que no sea supabase-js, y una suma con un string concatena en vez de sumar.
    ingresoEstimado: l.ingreso_estimado == null ? null : (Number.isFinite(Number(l.ingreso_estimado)) ? Number(l.ingreso_estimado) : null),
    // El tipo de venta (LISTA_COLS ya baja `venta_tipo`). Sin esto el wizard del tablero
    // le pedía el monto a un becado (#747): ver `CrmLead.ventaTipo`.
    ventaTipo: l.venta_tipo ?? null,
    // ⚠️ La plata de una SUSCRIPCIÓN no está en `monto_cierre_usd` (queda NULL a propósito):
    // está en `suscripcion_monto_usd`. Sin estas dos, la tarjeta de Ganado de una suscripción
    // decía «$0» con la mensualidad guardada (Fabi, ws11: 444/mes, 08/10/2026), y el wizard
    // del tablero la reabría vacía. LISTA_COLS ya baja las dos columnas. Ver lib/venta-tipo.ts.
    ...suscripcionDeFila(l),
    // Fecha de R1 canónica: misma prioridad que fechaJ1 y que el recorrido
    // (fecha_junta_1 gana; fecha_agenda es el fallback). Antes divergían y el
    // modal mostraba dos fechas distintas para la misma reunión.
    agenda: fmtDay(l.fecha_junta_1 ?? l.fecha_agenda),
    j2: fmtDay(l.fecha_junta_2),
    fechaJ1: l.fecha_junta_1 ?? l.fecha_agenda,
    fechaJ2: l.fecha_junta_2,
    phone: l.telefono ?? '—',
    telefonoNorm: l.telefono_normalizado ?? null,
    estadoLead: l.estado_lead,
    asistioJ1: l.asistio_j1,
    asistioJ2: l.asistio_j2,
    calificado: l.calificado,
    closer: l.closer ?? '',
    setter: l.setter ?? '',
    fathom: (l.fathom_links as { label: string; url: string }[] | null) ?? [],
    motivo: l.motivo_perdida ?? '',
    calendly: calendlyDe(l),
    confirmacion: fmtDay(l.fecha_confirmacion),
    cierre: fmtDay(l.fecha_cierre),
    // Fechas crudas (ISO) para construir la línea de tiempo del recorrido.
    createdISO: l.created_at,
    agendaISO: l.fecha_agenda,
    confirmacionISO: l.fecha_confirmacion,
    primerPagoISO: l.fecha_primer_pago ?? null,
    cierreISO: l.fecha_cierre,
    nutriManualDeadline: l.nutricion_manual_deadline ?? null,
  };
}
