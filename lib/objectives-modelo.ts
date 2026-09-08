// =============================================================================
// objectives-modelo — la aritmética de Objectives y KPIs, sin tocar la base
// =============================================================================
// SIN `server-only` A PROPÓSITO. Acá viven las decisiones que hay que poder
// testear: en qué Q cae una fecha, qué período cubre un KPI, y sobre todo
// `estadoKpi`, que es la que decide de qué color se pinta algo en la pantalla de
// entrada del negocio. Si esto viviera adentro del módulo que habla con Supabase,
// ningún test lo podría importar — y sería lo único sin red justo donde más duele.
//
// Es la misma razón por la que `exigirClienteDePrueba` vive en `lib/auth-session`
// y no adentro del que hace el trabajo sucio.
//
// El vocabulario, que es contrato:
//   · OBJECTIVE — el resultado. Se mide, no se hace. Vive en un año o en un Q.
//   · KPI       — lo que lo mueve. Se hace, y por eso tiene compromiso, cadencia
//                 y umbral.
//
// ⚠️ «Palanca» no se usa: es vocabulario del cliente que inspiró esto, no de la
// app (regla de nombres, 06/09/2026).
// =============================================================================

import { diasAntes, lunesDeFecha } from './date-utils';
import type { Semaforo } from './mako-gramatica';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type MetricaObjetivo = 'cash_usd' | 'sold_usd' | 'cierres' | 'agendas' | 'leads' | 'libre';
export type UnidadObjetivo = 'usd' | 'cantidad';
export type Cadencia = 'diaria' | 'semanal';
export type FuenteKpi = 'auto' | 'manual';

/**
 * Los cuatro estados de un KPI. `sin-datos` NO es un cuarto color decorativo: es
 * la diferencia entre «la fuente dice cero» y «no pude leer la fuente», que es
 * exactamente lo que hoy hace mentir al Semáforo de /general con un workspace
 * recién conectado (tarea #165).
 */
export type EstadoKpi = 'verde' | 'ambar' | 'rojo' | 'sin-datos';

/**
 * El nombre corto de cada métrica, para rotular QUÉ se está mostrando.
 *
 * ⚠️ «Facturación» a secas no alcanza y por eso esto existe: `cash_usd` (lo que
 * entró) y `sold_usd` (lo que se firmó) son dos números distintos que pueden
 * convivir en el mismo trimestre, y un hero que dice «Facturación $127.400» sin
 * decir cuál de los dos es, miente por omisión. El texto largo de cada una vive en
 * `METRICAS` de `app/general/EditarObjetivo.tsx`, que es donde se elige.
 */
export const METRICA_LABEL: Record<MetricaObjetivo, string> = {
  cash_usd: 'Cobrado',
  sold_usd: 'Firmado',
  cierres: 'Cierres',
  agendas: 'Reuniones agendadas',
  leads: 'Leads nuevos',
  libre: 'Lo mides tú',
};

/** Las dos métricas que son PLATA. Las únicas que llevan desglose por lead y `US$`. */
export const ES_PLATA = (m: MetricaObjetivo): boolean => m === 'cash_usd' || m === 'sold_usd';

export type Objective = {
  id: string;
  anio: number;
  /** 1..4, o null si el objetivo es ANUAL. */
  quarter: number | null;
  titulo: string;
  metrica: MetricaObjetivo;
  metaValor: number;
  unidad: UnidadObjetivo;
  avanceManual: number | null;
  orden: number;
  estado: 'activo' | 'cerrado';
  origen: string;
};

/**
 * Cuál de los objetivos manda: el que ocupa la cabecera de /general y el que
 * adoptan por defecto los KPIs nuevos.
 *
 * ⚠️ ANTES NO EXISTÍA Y ESO ERA EL BUG. La pantalla tomaba `objetivos[0]`, que es el
 * primero por `orden` — y `listObjectives` mezcla a propósito los ANUALES con los del
 * Q, así que el primero podía ser el objetivo del AÑO. La cabecera habría mostrado el
 * número del año arriba de una pantalla cuyo resto es del trimestre, sin decirlo.
 *
 * El orden de preferencia, y cada escalón tiene su porqué:
 *   1. cobrado del Q      la plata que ENTRÓ es la que decide si el trimestre va bien
 *   2. firmado del Q      si nadie mide lo cobrado, lo firmado es la mejor aproximación
 *   3. cualquiera del Q   un objetivo de cierres o de agendas también es un norte
 *   4. lo mismo, anual    recién acá se acepta el año, y la pantalla lo rotula «2026»
 *
 * A igualdad de métrica gana SIEMPRE el del trimestre (`quarter !== null`), que es el
 * período del resto de la pantalla. Devuelve `null` sólo si no hay ni uno.
 */
export function elegirObjetivoPrincipal<T extends Objective>(objetivos: T[]): T | null {
  const delQ = objetivos.filter((o) => o.quarter !== null);
  const anual = objetivos.filter((o) => o.quarter === null);
  for (const grupo of [delQ, anual]) {
    const cobrado = grupo.find((o) => o.metrica === 'cash_usd');
    if (cobrado) return cobrado;
    const firmado = grupo.find((o) => o.metrica === 'sold_usd');
    if (firmado) return firmado;
    if (grupo.length > 0) return grupo[0];
  }
  return null;
}

export type Kpi = {
  id: string;
  objectiveId: string | null;
  nombre: string;
  cadencia: Cadencia;
  compromiso: number;
  unidad: UnidadObjetivo;
  /** PORCENTAJE del compromiso, no un valor absoluto. */
  umbralVerde: number;
  umbralAmbar: number;
  fuente: FuenteKpi;
  fuenteId: string | null;
  orden: number;
  activo: boolean;
  origen: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Quarters
// ─────────────────────────────────────────────────────────────────────────────

export type Quarter = { anio: number; q: number };

/** `2026-Q3`. Lleva el año porque un «Q3» solo es ambiguo apenas cruza diciembre. */
export const quarterKey = (qt: Quarter): string => `${qt.anio}-Q${qt.q}`;

const RE_QKEY = /^(\d{4})-Q([1-4])$/;

/** Parsea `2026-Q3`. Devuelve null ante cualquier cosa que no sea exactamente eso. */
export function parseQuarterKey(s: string | null | undefined): Quarter | null {
  if (!s) return null;
  const m = RE_QKEY.exec(s.trim());
  if (!m) return null;
  return { anio: Number(m[1]), q: Number(m[2]) };
}

/** En qué Q cae una fecha `YYYY-MM-DD`. */
export function quarterDe(fecha: string): Quarter {
  const [y, m] = fecha.split('-').map(Number);
  return { anio: y, q: Math.floor((m - 1) / 3) + 1 };
}

const ultimoDia = (anio: number, mes: number): number => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/** El rango cerrado `[desde, hasta]` de un Q, en `YYYY-MM-DD`. */
export function rangoQuarter(qt: Quarter): { desde: string; hasta: string } {
  const mesIni = (qt.q - 1) * 3 + 1;
  const mesFin = mesIni + 2;
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    desde: `${qt.anio}-${p(mesIni)}-01`,
    hasta: `${qt.anio}-${p(mesFin)}-${p(ultimoDia(qt.anio, mesFin))}`,
  };
}

/** El rango cerrado de un año entero. */
export const rangoAnio = (anio: number): { desde: string; hasta: string } =>
  ({ desde: `${anio}-01-01`, hasta: `${anio}-12-31` });

export function siguienteQuarter(qt: Quarter): Quarter {
  return qt.q === 4 ? { anio: qt.anio + 1, q: 1 } : { anio: qt.anio, q: qt.q + 1 };
}

/** Días de calendario entre dos fechas ISO, inclusivo del primero y del último. */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / 86400_000) + 1;
}

export type ProgresoQuarter = {
  qt: Quarter;
  desde: string;
  hasta: string;
  diasTotales: number;
  /** Cuántos días del Q ya pasaron, contando hoy. Topea en `diasTotales`. */
  diasTranscurridos: number;
  diasRestantes: number;
  /** 0..1 — cuánto del período se consumió. */
  fraccion: number;
};

export function progresoQuarter(qt: Quarter, hoy: string): ProgresoQuarter {
  const { desde, hasta } = rangoQuarter(qt);
  const diasTotales = diasEntre(desde, hasta);
  const crudo = hoy < desde ? 0 : hoy > hasta ? diasTotales : diasEntre(desde, hoy);
  const diasTranscurridos = Math.max(0, Math.min(diasTotales, crudo));
  return {
    qt, desde, hasta, diasTotales, diasTranscurridos,
    diasRestantes: Math.max(0, diasTotales - diasTranscurridos),
    fraccion: diasTotales > 0 ? diasTranscurridos / diasTotales : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// El período de un KPI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El período vigente de un KPI en una fecha dada. La `clave` es lo que se guarda
 * en `kpi_registros.fecha`: para un KPI diario es el día, para uno semanal es el
 * LUNES de esa semana.
 *
 * Guardar el inicio del período y no «el día en que alguien apretó el botón» es
 * lo que hace idempotente al registro: marcar dos veces la misma semana pisa la
 * fila en vez de duplicarla.
 */
export function periodoDe(cadencia: Cadencia, fecha: string): { clave: string; desde: string; hasta: string } {
  if (cadencia === 'diaria') return { clave: fecha, desde: fecha, hasta: fecha };
  const lunes = lunesDeFecha(fecha);
  return { clave: lunes, desde: lunes, hasta: diasAntes(lunes, -6) };
}

/** El período ANTERIOR al vigente. Sirve para «venís peor que la semana pasada». */
export function periodoAnterior(cadencia: Cadencia, fecha: string): { clave: string; desde: string; hasta: string } {
  const actual = periodoDe(cadencia, fecha);
  return periodoDe(cadencia, diasAntes(actual.desde, cadencia === 'diaria' ? 1 : 7));
}

export const CADENCIA_LABEL: Record<Cadencia, string> = { diaria: 'hoy', semanal: 'esta semana' };

// ─────────────────────────────────────────────────────────────────────────────
// El color de un KPI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El estado de un KPI en su período.
 *
 * ⚠️ `valor === null` significa «no pude leer la fuente» y devuelve `sin-datos`,
 * NUNCA rojo. Un timeout de Meta pintando el KPI de inversión en rojo dispara una
 * acción prioritaria falsa arriba de todo en la pantalla de entrada — que es peor
 * que no mostrar nada, porque manda a trabajar sobre un problema que no existe.
 *
 * ⚠️ Y un compromiso de 0 tampoco es verde: un KPI sin compromiso no está cumplido,
 * está SIN CONFIGURAR. Devolverle verde es exactamente la mentira de la #165.
 */
export function estadoKpi(
  valor: number | null,
  compromiso: number,
  umbralVerde = 100,
  umbralAmbar = 70,
): EstadoKpi {
  if (valor === null || !Number.isFinite(valor)) return 'sin-datos';
  if (!(compromiso > 0)) return 'sin-datos';
  const pct = (valor / compromiso) * 100;
  if (pct >= umbralVerde) return 'verde';
  if (pct >= umbralAmbar) return 'ambar';
  return 'rojo';
}

/** Cuánto del compromiso se cumplió, 0..100 y topeado. Null si no se pudo leer. */
export function pctKpi(valor: number | null, compromiso: number): number | null {
  if (valor === null || !Number.isFinite(valor) || !(compromiso > 0)) return null;
  return Math.max(0, Math.min(100, (valor / compromiso) * 100));
}

/** Peso para ordenar: primero lo que está peor. `sin-datos` va después del rojo. */
export const PESO_ESTADO: Record<EstadoKpi, number> = { rojo: 0, ambar: 1, 'sin-datos': 2, verde: 3 };

/**
 * El puente al Semáforo canónico de la casa (`lib/mako-gramatica.ts`).
 *
 * ⚠️ SON DOS TIPOS A PROPÓSITO, y esto es lo único que los une. `EstadoKpi` dice
 * QUÉ PASA («no pude leer la fuente») y `Semaforo` dice CÓMO SE VE. Colapsarlos en
 * uno obligaría a que el dominio hable en colores —y entonces `gris` tendría que
 * significar dos cosas distintas según quién lo mire— o a que la pantalla invente
 * su propia escala, que es la mitad del problema que `mako-gramatica` vino a
 * cerrar: tres pantallas escribiendo tres nombres para el mismo estado.
 *
 * La regla práctica: nada fuera de acá traduce un `EstadoKpi` a un color.
 */
export const SEMAFORO_DE_ESTADO: Record<EstadoKpi, Semaforo> = {
  verde: 'verde', ambar: 'ambar', rojo: 'rojo', 'sin-datos': 'gris',
};

/** Cómo se NOMBRA cada estado. El color nunca es el único portador del dato. */
export const ESTADO_LABEL: Record<EstadoKpi, string> = {
  verde: 'cumplido',
  ambar: 'ajustado',
  rojo: 'atrasado',
  'sin-datos': 'sin datos',
};

// ─────────────────────────────────────────────────────────────────────────────
// El ritmo de un objetivo
// ─────────────────────────────────────────────────────────────────────────────

export type Ritmo = {
  /** Lo que debería llevar acumulado a esta altura del período, si fuera parejo. */
  esperado: number;
  /** Positivo = va adelantado; negativo = atrasado. En unidades del objetivo. */
  desvio: number;
  /** El desvío como % de lo esperado. Null si todavía no se esperaba nada. */
  desvioPct: number | null;
  /** Fecha estimada de llegada al ritmo actual, o null si no hay ritmo. */
  llegadaEstimada: string | null;
  alDia: boolean;
};

/**
 * El ritmo de un objetivo contra su período, prorrateado LINEALMENTE.
 *
 * ⚠️ Lineal es un supuesto, no una verdad: un negocio con estacionalidad no factura
 * parejo. Se elige igual porque es el único prorrateo que se puede explicar en una
 * línea, y porque la alternativa —modelar la curva— necesita un histórico que la
 * mayoría de los workspaces todavía no tiene. Cuando se pueda medir la curva real,
 * esto se reemplaza; hasta entonces la pantalla dice «a este ritmo», que es lo que
 * de verdad está calculando.
 */
export function ritmoObjetivo(actual: number, meta: number, p: ProgresoQuarter, hoy: string): Ritmo {
  const esperado = meta * (p.diasTotales > 0 ? p.diasTranscurridos / p.diasTotales : 0);
  const desvio = actual - esperado;
  const porDia = p.diasTranscurridos > 0 ? actual / p.diasTranscurridos : 0;
  const faltan = Math.max(0, meta - actual);
  // `faltan === 0` es LLEGÓ, y llegó no es «sin ritmo»: la fecha es hoy. Sin este
  // caso, un objetivo cumplido caía en el mismo `null` que uno sin movimiento y la
  // pantalla decía lo mismo para el mejor y el peor escenario.
  const diasQueFaltan = faltan === 0 ? 0 : porDia > 0 ? Math.ceil(faltan / porDia) : null;
  return {
    esperado,
    desvio,
    desvioPct: esperado > 0 ? (desvio / esperado) * 100 : null,
    llegadaEstimada: diasQueFaltan === null ? null : diasAntes(hoy, -diasQueFaltan),
    alDia: desvio >= 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Las fuentes automáticas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El catálogo CERRADO de lo que MaKo puede medir solo. Es data pura; quien las
 * LEE es `lib/objectives-fuentes.ts`, que sí habla con la base.
 *
 * ⚠️ Un `fuente_id` que no esté acá se trata como fuente ROTA y el KPI queda en
 * `sin-datos` — nunca en cero. Es la misma regla que gobierna un timeout.
 */
export type FuenteDef = {
  id: string;
  label: string;
  unidad: UnidadObjetivo;
  /** Qué mide, en una línea. Es lo que lee la persona al elegir la fuente. */
  que: string;
};

const FUENTES_DEF = [
  { id: 'inversion_usd', label: 'Inversión en anuncios', unidad: 'usd', que: 'Lo gastado en Meta en el período, convertido a USD.' },
  { id: 'agendas', label: 'Reuniones agendadas', unidad: 'cantidad', que: 'Leads con R1 en el período.' },
  { id: 'leads_nuevos', label: 'Leads nuevos', unidad: 'cantidad', que: 'Contactos que entraron al CRM en el período.' },
  { id: 'cierres', label: 'Cierres', unidad: 'cantidad', que: 'Leads marcados como ganados en el período.' },
  { id: 'cash_usd', label: 'Cobrado', unidad: 'usd', que: 'Pagos cobrados en el período.' },
  { id: 'sold_usd', label: 'Firmado', unidad: 'usd', que: 'Monto de los cierres del período. Comprometido, todavía no cobrado.' },
  { id: 'llamadas_analizadas', label: 'Llamadas analizadas', unidad: 'cantidad', que: 'Grabaciones que MaKo procesó en el período.' },
  { id: 'vsl_plays', label: 'Reproducciones del VSL', unidad: 'cantidad', que: 'Veces que alguien le dio play al VSL en el período.' },
  { id: 'contenido_publicado', label: 'Contenido publicado', unidad: 'cantidad', que: 'Piezas publicadas desde Content Machine en el período.' },
] as const satisfies readonly FuenteDef[];

/**
 * ⚠️ ESTE TIPO ES EL GUARD, y por eso se DERIVA del array de arriba en vez de
 * escribirse a mano.
 *
 * `lib/objectives-fuentes.ts` declara sus lectores como `Record<FuenteId, Lector>`,
 * así que el compilador exige la paridad EN LAS DOS DIRECCIONES: una fuente nueva
 * en el catálogo sin lector no compila, y un lector que no está en el catálogo
 * tampoco. Sin eso el modo de falla es el de siempre —«una integración son TRES
 * registros y ninguno falla ruidoso»—: la fuente aparece en el selector, alguien la
 * elige, y el KPI nace contestando «fuente desconocida».
 *
 * Va en el compilador y no en un test a propósito: el módulo de los lectores tiene
 * `server-only`, así que ningún test lo puede importar. Un guard que no se puede
 * correr no es un guard.
 */
export type FuenteId = (typeof FUENTES_DEF)[number]['id'];

export const FUENTES_KPI: readonly FuenteDef[] = FUENTES_DEF;

const FUENTES_POR_ID = new Map(FUENTES_DEF.map((f) => [f.id as string, f as FuenteDef]));
export const fuenteKpi = (id: string | null | undefined): FuenteDef | undefined =>
  (id ? FUENTES_POR_ID.get(id) : undefined);

// ─────────────────────────────────────────────────────────────────────────────
// El seed: qué KPIs propone MaKo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los candidatos. Una pantalla en blanco es donde muere toda feature de objetivos,
 * así que nadie arranca de cero: MaKo propone y la persona ajusta o borra.
 *
 * ⚠️ REGLA DE LA PROPUESTA: se prefiere lo que MaKo puede medir SOLO. Eso maximiza
 * la mitad automática del registro, que es la única que sobrevive a la segunda
 * semana. Los manuales entran sólo cuando cubren algo que ninguna fuente cubre.
 *
 * `requiere` decide si el candidato aplica a este negocio. Vacío = aplica siempre.
 */
export type CandidatoKpi = {
  nombre: string;
  cadencia: Cadencia;
  compromiso: number;
  unidad: UnidadObjetivo;
  fuente: FuenteKpi;
  fuenteId?: string;
  /** Por qué se lo propone a ESTE negocio. Se muestra al lado del candidato. */
  porque: string;
  /** Etapas del funnel que tienen que existir para que este KPI tenga sentido. */
  requiereEtapa?: string[];
  /** Cuellos de la fase del negocio a los que este KPI le pega de lleno. */
  paraCuello?: string[];
};

export const CANDIDATOS_KPI: CandidatoKpi[] = [
  {
    nombre: 'Inversión diaria en anuncios', cadencia: 'diaria', compromiso: 55, unidad: 'usd',
    fuente: 'auto', fuenteId: 'inversion_usd',
    porque: 'Si la inversión se corta un día, el embudo entero se queda sin entrada.',
    paraCuello: ['conversion', 'sistema', 'foco'],
  },
  {
    nombre: 'Leads nuevos', cadencia: 'semanal', compromiso: 20, unidad: 'cantidad',
    fuente: 'auto', fuenteId: 'leads_nuevos',
    porque: 'Es la boca del embudo: sin volumen arriba, no hay nada que mejorar abajo.',
  },
  {
    nombre: 'Reuniones agendadas', cadencia: 'semanal', compromiso: 5, unidad: 'cantidad',
    fuente: 'auto', fuenteId: 'agendas',
    porque: 'Tu funnel pasa por una reunión, así que las agendas son el paso que manda.',
    requiereEtapa: ['agenda', 'agendaj2'],
  },
  {
    nombre: 'Cierres', cadencia: 'semanal', compromiso: 1, unidad: 'cantidad',
    fuente: 'auto', fuenteId: 'cierres',
    porque: 'El resultado de la semana, contado igual que en el resto del tablero.',
  },
  {
    nombre: 'Cobrado', cadencia: 'semanal', compromiso: 2000, unidad: 'usd',
    fuente: 'auto', fuenteId: 'cash_usd',
    porque: 'Facturar no es cobrar, y lo que sostiene al negocio es lo segundo.',
    requiereEtapa: ['facturando', 'ganado'],
  },
  {
    nombre: 'Llamadas analizadas', cadencia: 'semanal', compromiso: 3, unidad: 'cantidad',
    fuente: 'auto', fuenteId: 'llamadas_analizadas',
    porque: 'Revisar las llamadas es lo que sube la tasa de cierre sin gastar un peso más.',
    paraCuello: ['conversion', 'oferta'],
  },
  {
    nombre: 'Contenido publicado', cadencia: 'semanal', compromiso: 7, unidad: 'cantidad',
    fuente: 'auto', fuenteId: 'contenido_publicado',
    porque: 'El orgánico solo compone si sale sí o sí todas las semanas.',
    paraCuello: ['foco', 'delegacion'],
  },
  {
    nombre: 'Seguimientos hechos', cadencia: 'diaria', compromiso: 5, unidad: 'cantidad',
    fuente: 'manual',
    porque: 'Lo que se pierde no es el lead: es el segundo contacto que nadie hizo.',
    paraCuello: ['sistema', 'delegacion'],
  },
];

/**
 * Los candidatos que aplican a este negocio, ordenados y topeados.
 *
 * `etapas` son las keys del pipeline real del cliente (`funnel_config`) y `cuello`
 * el de su fase. Los dos son OPCIONALES: sin ellos se devuelve el set genérico, que
 * es mejor que una pantalla vacía.
 *
 * ⚠️ Se topea en 8 a propósito. Un tablero de quince filas no se lee de un vistazo,
 * y el punto entero de esta pantalla es que se lea de un vistazo.
 */
export function proponerCandidatos(
  etapas: string[] | null,
  cuello: string | null,
  tope = 8,
): CandidatoKpi[] {
  const set = new Set(etapas ?? []);
  const aplica = CANDIDATOS_KPI.filter((c) => {
    if (!c.requiereEtapa || c.requiereEtapa.length === 0) return true;
    // Sin funnel declarado no se descarta nada: no saber no es saber que no.
    if (!etapas || etapas.length === 0) return true;
    return c.requiereEtapa.some((e) => set.has(e));
  });
  // Primero los que le pegan al cuello de la fase, después los automáticos.
  return aplica
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const pegaA = cuello && a.c.paraCuello?.includes(cuello) ? 0 : 1;
      const pegaB = cuello && b.c.paraCuello?.includes(cuello) ? 0 : 1;
      if (pegaA !== pegaB) return pegaA - pegaB;
      const autoA = a.c.fuente === 'auto' ? 0 : 1;
      const autoB = b.c.fuente === 'auto' ? 0 : 1;
      if (autoA !== autoB) return autoA - autoB;
      return a.i - b.i;
    })
    .slice(0, tope)
    .map((x) => x.c);
}

// ─────────────────────────────────────────────────────────────────────────────
// Capacidad instalada
// ─────────────────────────────────────────────────────────────────────────────

export type Capacidad = {
  /** El cupo declarado. null = nadie lo cargó todavía, y entonces no se afirma nada. */
  cupo: number | null;
  activos: number;
  libres: number | null;
  /** 0..100, o null sin cupo. */
  ocupacionPct: number | null;
};

export function capacidadDe(cupo: number | null, activos: number): Capacidad {
  if (cupo === null || !(cupo > 0)) return { cupo: null, activos, libres: null, ocupacionPct: null };
  return {
    cupo,
    activos,
    libres: Math.max(0, cupo - activos),
    ocupacionPct: Math.min(100, (activos / cupo) * 100),
  };
}

/** Meses que un cliente de pago único ocupa un lugar. Default = el programa típico. */
export const MESES_ENTREGA_DEFAULT = 4;

// ─────────────────────────────────────────────────────────────────────────────
// Ids
// ─────────────────────────────────────────────────────────────────────────────

/** Id corto y ordenable en el tiempo, mismo molde que el board del plan. */
export const nuevoId = (prefijo: string): string =>
  `${prefijo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
