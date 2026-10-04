// =============================================================================
// funnel-comercial — el tramo comercial del tablero, resuelto contra EL funnel
// del workspace y no contra el embudo fijo de dos reuniones
// =============================================================================
// Puro y compartido (SIN 'server-only', a propósito): lo importa `lib/queries.ts`
// —que lo consume desde el server— y lo importan los tests. Adentro de un módulo
// con `server-only` ningún test lo podría importar, y terminaría siendo lo único
// sin red justo donde más duele. Mismo criterio que `lib/crm-auto-plan.ts`.
//
// EL PROBLEMA QUE CIERRA, medido sobre el código y sobre las plantillas de
// `FUNNEL_TEMPLATES` (lib/pipeline.ts):
//
//   `getFunnelEtapas` emitía SIEMPRE los cuatro pasos de un funnel de dos
//   reuniones —`form_agenda`, `agenda_asistio`, `asistio_calificado`,
//   `calificado_cierre`— y los contaba sobre la cohorte `fecha_junta_1` dentro de
//   la ventana. Los consumidores los buscan por esa key canónica:
//   `lib/retro-datos.ts` hacía `por.get('form_agenda')`, `por.get('agenda_asistio')`…
//
//   Para los workspaces que NO venden con reuniones —las plantillas `directa`
//   (lead al pago) y `conversaciones` (lead, charla, pago), o cualquier funnel
//   armado a mano sin ninguna etapa `kind: 'reunion'`— `fecha_junta_1` es null en
//   TODOS sus leads. O sea: la cohorte sale vacía, y con ella `asistencias`,
//   `limpias` y los CIERRES. El tramo comercial entero mide CERO, el `pct` sale
//   null, y no hay un solo error en ningún log: es el modo de falla que esta casa
//   persigue. Un cliente que cerró veinte ventas ve cuatro renglones en cero.
//
//   Y con UNA reunión (`simple`, `presencial`) el daño es más chico y de la misma
//   familia: `asistio_calificado` mide «cuántas pasan a la R2» sobre un funnel que
//   no tiene R2, así que su salida es 0 por construcción — y como esa salida es el
//   DENOMINADOR de `calificado_cierre`, los cierres también salen en null.
//
// LO QUE ESTE MÓDULO DECIDE: qué pasos tiene el tramo comercial de ESTE funnel y
// de qué contador sale cada lado de cada paso. Es TOLERANTE por diseño, con el
// molde de `umbralesDelWorkspace` (lib/crm-auto.ts): un workspace que no declaró
// funnel propio —o cuya lectura falló— resuelve las keys canónicas de siempre,
// carácter por carácter. No se puede romper a los que andan.
//
// ⚠️ LO QUE VARÍA ES CUÁNTAS REUNIONES TIENE EL FUNNEL, y no es una elección de
// este módulo: es lo único que la tabla `leads` sabe guardar. Hay DOS pares de
// columnas de reunión (`fecha_junta_1`/`asistio_j1` y `fecha_junta_2`/`asistio_j2`),
// así que `etapasDeReunion()` + `slotPorIndice()` ya topean en dos. De ahí los tres
// tramos de abajo, y de ahí que no haga falta un cuarto.
// =============================================================================

import { etapasDeReunion, slotPorIndice, type EtapaLite } from './funnel-etapas';

/**
 * Los números del tramo comercial que el tablero PONE EN PANTALLA. Son roles, no
 * keys: «las agendas», «quién asistió», «quién pasó al segundo encuentro», «los
 * cierres». La key del paso que los alimenta la decide el funnel del workspace.
 */
export type RolComercial = 'agendas' | 'r1' | 'r2' | 'cierres';

/**
 * De qué contador sale un lado de un paso. Los nombres son del NEGOCIO y no de la
 * columna, porque la columna cambia con el funnel: `entradas` es «los leads que
 * entraron en la ventana» y `cierres_entradas` «de ésos, cuántos están ganados».
 *
 * ⚠️ `cierres_cohorte` y `cierres_entradas` cuentan la misma cosa (`estado_lead =
 * 'ganado'`) sobre DOS cohortes distintas: la de la primera reunión y la del alta.
 * No son intercambiables — con un funnel sin reuniones la primera es siempre 0.
 */
export type ContadorComercial =
  | 'forms'              // instant forms completados (Meta Insights)
  | 'agendas'            // leads con la fecha de la 1ª reunión en la ventana
  | 'r1_cohorte'         // la misma cohorte, contada sobre las filas leídas
  | 'asistencias'        // de esa cohorte, cuántos asistieron a la 1ª
  | 'limpias'            // de los que asistieron, cuántos quedaron calificados
  | 'cierres_cohorte'    // de esa cohorte, cuántos están ganados
  | 'entradas'           // leads creados en la ventana
  | 'cierres_entradas';  // de los creados en la ventana, cuántos están ganados

/** Un paso de medición del tramo comercial, ya resuelto para un funnel. */
export type PasoComercialDef = {
  key: string;
  label: string;
  /** `puente` cruza dos sistemas (Meta a CRM); `comercial` vive entero en el CRM. */
  bloque: 'puente' | 'comercial';
  entrada: ContadorComercial;
  salida: ContadorComercial;
  /** El rol que mide la SALIDA de este paso. De acá sale `rolesComercialesDe`. */
  rol: RolComercial;
  benchmark: string;
  umbral: { rojo: number; ambar: number; max: number };
  fuenteKey: string | null;
};

/** Dónde leer un rol dentro de la lista de pasos ya calculada. */
export type FuenteDeRol = { key: string; campo: 'entrada' | 'salida' };

/** El mapa rol a de dónde sale su número. `null` = este funnel no tiene ese rol. */
export type RolesComerciales = Record<RolComercial, FuenteDeRol | null> & {
  /**
   * La ENTRADA del primer paso que vive entero en el CRM: cuánta gente entró al
   * tramo comercial. Es el denominador de «qué porcentaje de los que entraron
   * cerró». Con dos reuniones son las agendas de la R1 (igual que antes); sin
   * reuniones son los leads que se dieron de alta en la ventana, que es lo único
   * que ese negocio tiene para dividir.
   */
  base: FuenteDeRol | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Los tres tramos
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ EL DE DOS REUNIONES ES EL DE HOY, CARÁCTER POR CARÁCTER: mismas keys, mismos
// labels, mismos benchmarks, mismos umbrales, mismas fuentes y mismo orden. Es lo
// que hace que un workspace sin funnel propio siga viendo exactamente lo que ve.

const PUENTE_FORM_AGENDA: PasoComercialDef = {
  key: 'form_agenda',
  label: 'Formulario → Agenda',
  bloque: 'puente',
  entrada: 'forms',
  salida: 'agendas',
  rol: 'agendas',
  benchmark: 'Del instant form a agendar la R1 — el puente clave del camino principal. Cruza Meta (forms) y Calendly (agendas): tómalo como tendencia. Subirlo = mejor seguimiento y CTA del VSL.',
  umbral: { rojo: 25, ambar: 45, max: 100 },
  fuenteKey: 'meta_insights',
};

const AGENDA_ASISTIO: PasoComercialDef = {
  key: 'agenda_asistio',
  label: 'Agenda → Asistió R1',
  bloque: 'comercial',
  entrada: 'r1_cohorte',
  salida: 'asistencias',
  rol: 'r1',
  benchmark: 'No-show >35% (asistencia <65%) sugiere problema de recordatorios o calificación previa.',
  umbral: { rojo: 65, ambar: 75, max: 100 },
  fuenteKey: 'calendly',
};

const DOS_REUNIONES: readonly PasoComercialDef[] = [
  PUENTE_FORM_AGENDA,
  AGENDA_ASISTIO,
  {
    key: 'asistio_calificado',
    label: 'Asistió → Limpia',
    bloque: 'comercial',
    entrada: 'asistencias',
    salida: 'limpias',
    rol: 'r2',
    benchmark: 'Mide la calidad del lead que llega a R1. Bajo = atraes al perfil equivocado.',
    umbral: { rojo: 40, ambar: 60, max: 100 },
    fuenteKey: null, // carga manual — siempre "disponible"
  },
  {
    key: 'calificado_cierre',
    label: 'Limpia → Cierre',
    bloque: 'comercial',
    entrada: 'limpias',
    salida: 'cierres_cohorte',
    rol: 'cierres',
    benchmark: 'Ratio joya. ≥30% sano, 20-30% mixto, <20% problema de venta (R2, oferta, objeciones).',
    umbral: { rojo: 20, ambar: 30, max: 100 },
    fuenteKey: null,
  },
];

// UNA reunión: no hay «pasa a la R2», así que el cierre cuelga de la asistencia.
// Sin este paso, `calificado_cierre` dividía por `limpias` —una columna que este
// negocio no tiene por qué marcar— y los cierres salían en null.
const UNA_REUNION: readonly PasoComercialDef[] = [
  PUENTE_FORM_AGENDA,
  AGENDA_ASISTIO,
  {
    key: 'asistio_cierre',
    label: 'Asistió → Cierre',
    bloque: 'comercial',
    entrada: 'asistencias',
    salida: 'cierres_cohorte',
    rol: 'cierres',
    benchmark: 'De los que llegaron al encuentro, cuántos compraron. Es el ratio del cierre cuando el funnel tiene un solo encuentro.',
    umbral: { rojo: 20, ambar: 30, max: 100 },
    fuenteKey: null,
  },
];

// SIN reuniones (venta directa, conversaciones por chat): la cohorte no puede
// anclarse en la fecha de una reunión que nunca existe — ahí se ancla en el ALTA
// del lead, que es la única fecha que todo lead tiene. Mismo contrato de cohorte
// que los otros dos tramos, con otra fecha.
const SIN_REUNION: readonly PasoComercialDef[] = [
  {
    key: 'lead_cierre',
    label: 'Lead → Cierre',
    bloque: 'comercial',
    entrada: 'entradas',
    salida: 'cierres_entradas',
    rol: 'cierres',
    benchmark: 'De los leads que entraron en el período, cuántos compraron. Es el único ratio de cierre que se puede medir sin reuniones.',
    umbral: { rojo: 2, ambar: 5, max: 100 },
    fuenteKey: null,
  },
];

/**
 * Cuántas reuniones mide este funnel: 0, 1 o 2.
 *
 * Tolerante igual que `etapasDeReunion`: sin funnel a mano (la lectura falló, o el
 * workspace no declaró nada) cae al pipeline por defecto, donde las reuniones son
 * `agenda` y `agendaj2`. Y topea en 2 por `slotPorIndice`, que es el que sabe que
 * la tabla `leads` tiene exactamente dos pares de columnas: una tercera reunión no
 * tiene dónde guardar su fecha, así que no se puede medir.
 */
export function reunionesMedibles(stages?: readonly EtapaLite[] | null): 0 | 1 | 2 {
  const conSlot = etapasDeReunion(stages).filter((_, i) => slotPorIndice(i) !== null).length;
  return conSlot >= 2 ? 2 : conSlot === 1 ? 1 : 0;
}

/** Los pasos del tramo comercial del funnel de este workspace, EN ORDEN. */
export function pasosComercialesDe(stages?: readonly EtapaLite[] | null): PasoComercialDef[] {
  const n = reunionesMedibles(stages);
  const tramo = n === 2 ? DOS_REUNIONES : n === 1 ? UNA_REUNION : SIN_REUNION;
  return tramo.map((p) => ({ ...p }));
}

/**
 * Dónde está cada rol en los pasos de ese funnel. Es lo que consumen los tableros
 * en vez de la key canónica: `roles.cierres` apunta a `calificado_cierre` con dos
 * reuniones, a `asistio_cierre` con una y a `lead_cierre` con ninguna.
 *
 * `agendas` sale de la SALIDA del puente y, si ese paso no está, de la ENTRADA del
 * paso de asistencia — el mismo encadenado que `lib/retro-datos.ts` ya tenía
 * escrito a mano, para que ningún tramo pierda las agendas por el orden de la lista.
 */
export function rolesComercialesDe(stages?: readonly EtapaLite[] | null): RolesComerciales {
  const pasos = pasosComercialesDe(stages);
  const porRol: Record<RolComercial, FuenteDeRol | null> = { agendas: null, r1: null, r2: null, cierres: null };
  for (const p of pasos) porRol[p.rol] = { key: p.key, campo: 'salida' };
  if (!porRol.agendas) {
    const asistio = pasos.find((p) => p.rol === 'r1');
    if (asistio) porRol.agendas = { key: asistio.key, campo: 'entrada' };
  }
  const primeroDelCrm = pasos.find((p) => p.bloque === 'comercial');
  return { ...porRol, base: primeroDelCrm ? { key: primeroDelCrm.key, campo: 'entrada' } : null };
}

/** El rótulo de cada rol en el gráfico del cierre. No lo decide el funnel. */
export const ROL_LABEL: Record<RolComercial, string> = {
  agendas: 'Agendas',
  r1: 'R1',
  r2: 'R2',
  cierres: 'Cierres',
};

/** El orden en que los roles se leen de izquierda a derecha. */
export const ROLES_EN_ORDEN: readonly RolComercial[] = ['agendas', 'r1', 'r2', 'cierres'];
