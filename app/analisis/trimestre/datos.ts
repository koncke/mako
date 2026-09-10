// =============================================================================
// Los números del trimestre junio–agosto 2026 — ws1 (Mauricio)
// =============================================================================
// Esto es una FOTO, no una consulta. Se leyó una vez de Supabase (workspace 1,
// modo solo lectura) el 09/09/2026 y quedó acá escrita. La diferencia con
// /analisis, que es la misma pregunta calculada en vivo, es deliberada: un
// informe que se cita tiene que dar el mismo número el día que se cita y seis
// meses después. Si esto consultara la base, cada corrección retroactiva del
// CRM cambiaría el argumento del texto sin que nadie lo note.
//
// ⚠️ POR ESO NO SE «ACTUALIZA» ESTE ARCHIVO. Un trimestre nuevo es un archivo
// nuevo; éste queda como quedó.
//
// ─────────────────────────────────────────────────────────────────────────────
// LA MONEDA, que es la única trampa de todo esto
// ─────────────────────────────────────────────────────────────────────────────
// Meta le cobra a Mauricio en PESOS MEXICANOS y sus contratos se firman en
// DÓLARES. Acá `spend` y todo lo que se derive de él viven en MXN porque es lo
// que devuelve la API de Meta: guardar el número ya convertido sería guardar
// una opinión (la del tipo de cambio del día que se corrió el script) haciéndose
// pasar por un dato.
//
// El informe se LEE entero en dólares —no aparece un peso en pantalla— y la
// conversión la hace la vista con el tipo de cambio del control de arriba.
// Cambiar ese número tiene que mover TODAS las cifras del informe, incluidas
// las que están adentro de las frases: por eso ningún monto se escribe a mano
// en el texto, todos salen de acá.
//
// `usd`, `cash` e `ingreso_total_usd` YA son dólares (así se cobra) y no se
// tocan con el tipo de cambio. Están marcados con el sufijo `_usd` o comentados
// uno por uno; el resto es MXN.
// =============================================================================

/** Pesos por dólar. Es un supuesto de lectura, no el tipo de cambio real de cada mes. */
export const FX_DEFAULT = 18.5;

export const PERIODO = {
  desde: '2026-06-01',
  hasta: '2026-08-31',
  etiqueta: 'Junio, julio y agosto de 2026',
  leido: '2026-09-09',
} as const;

export type MesTrimestre = {
  mes: string;
  /** MXN — lo que cobró Meta. */
  spend: number;
  impr: number;
  reach: number;
  clicks: number;
  /** Landing page views que reporta Meta. */
  lpv: number;
  /** Leads que reporta Meta (no siempre llegan al CRM: ver la fuga de captura). */
  meta_leads: number;
  /** ThruPlays y video views de 3 s. */
  v3: number;
  thru: number;
  visits: number;
  uniq: number;
  plays: number;
  crm_leads: number;
  agenda: number;
  j1: number;
  j1show: number;
  j2: number;
  cierres: number;
  /** USD — contratos firmados en el mes. */
  usd: number;
  /** USD — caja cobrada en el mes, sin importar cuándo se firmó. */
  cash: number;
};

export const MESES: MesTrimestre[] = [
  { mes: '2026-06', spend: 38942, impr: 255229, reach: 220809, clicks: 5032, lpv: 1096, meta_leads: 384, v3: 83824, thru: 29179, visits: 342, uniq: 299, plays: 422, crm_leads: 304, agenda: 9, j1: 12, j1show: 6, j2: 6, cierres: 5, usd: 30700, cash: 8098.03 },
  { mes: '2026-07', spend: 22453, impr: 237277, reach: 209055, clicks: 4353, lpv: 986, meta_leads: 357, v3: 75978, thru: 26413, visits: 1199, uniq: 981, plays: 576, crm_leads: 366, agenda: 7, j1: 4, j1show: 2, j2: 2, cierres: 2, usd: 13500, cash: 9564.25 },
  { mes: '2026-08', spend: 45632, impr: 279813, reach: 249033, clicks: 6971, lpv: 3682, meta_leads: 403, v3: 103086, thru: 40823, visits: 3902, uniq: 3008, plays: 2013, crm_leads: 301, agenda: 34, j1: 34, j1show: 14, j2: 9, cierres: 0, usd: 0, cash: 12676.21 },
];

export type CampanaTrimestre = {
  nombre: string;
  /** MXN. */
  spend: number;
  leads: number;
  impr: number;
  clicks: number;
  citas: number;
  shows: number;
};

export const CAMPANAS: CampanaTrimestre[] = [
  { nombre: '004. Leads / Agenda - Febrero / 2026', spend: 47145, leads: 860, impr: 458582, clicks: 9439, citas: 10, shows: 4 },
  { nombre: '029. Capta Dueños B2B - Sistema de Ejecución - MX', spend: 35325, leads: 50, impr: 123211, clicks: 4103, citas: 32, shows: 13 },
  { nombre: '013. Conversiones / Ganadores - Junio / 2026', spend: 16048, leads: 196, impr: 162553, clicks: 1915, citas: 1, shows: 1 },
  { nombre: '028. NqE™ | Retargeting Leads | Reenganche JUN2026', spend: 4037, leads: 0, impr: 8928, clicks: 555, citas: 0, shows: 0 },
  { nombre: '007. Reconocimiento / Capataz - Junio / 2026', spend: 551, leads: 11, impr: 3292, clicks: 81, citas: 0, shows: 0 },
  { nombre: '011. Reconocimiento / Recuperar - Junio / 2026', spend: 550, leads: 1, impr: 1697, clicks: 28, citas: 0, shows: 0 },
  { nombre: '012. Reconocimiento / Sistema - Junio / 2026', spend: 549, leads: 7, impr: 2515, clicks: 39, citas: 1, shows: 0 },
  { nombre: '010. Reconocimiento / Sistema - Junio / 2026', spend: 548, leads: 5, impr: 1986, clicks: 33, citas: 0, shows: 0 },
  { nombre: '005. Reconocimiento / Héroe - Junio / 2026', spend: 548, leads: 1, impr: 1641, clicks: 26, citas: 0, shows: 0 },
  { nombre: '006. Reconocimiento / Héroe - Junio / 2026', spend: 546, leads: 4, impr: 2125, clicks: 48, citas: 0, shows: 0 },
  { nombre: '008. Reconocimiento / Claridad - Junio / 2026', spend: 543, leads: 5, impr: 2447, clicks: 42, citas: 1, shows: 1 },
  { nombre: '009. Reconocimiento / Organización - Junio / 2026', spend: 530, leads: 4, impr: 1794, clicks: 36, citas: 0, shows: 0 },
];

/** El corte que separa «campaña con presupuesto» de «prueba de reconocimiento». MXN. */
export const CAMPANA_GRANDE_MXN = 4000;

/** Los dos protagonistas del informe. Se buscan por prefijo para no repetir el nombre largo. */
export const CAMPANA_VOLUMEN = '004.';
export const CAMPANA_CITAS = '029.';
export const CAMPANA_MUDA = '013.';

/**
 * Retención del VSL: de cada 100 que dan play, cuántas siguen ahí en cada tramo.
 * Junio queda fuera a propósito — el rastreo por persona arrancó el 15/06 y su
 * curva marca más gente en el 10 % que en el 5 %, o sea que no es comparable.
 */
export const VSL = {
  hitos: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 75, 80, 90, 100],
  series: {
    '2026-07': [30.0, 22.9, 20.1, 18.6, 17.4, 16.8, 15.5, 14.6, 14.1, 12.3, 10.8, 9.7, 10.1, 9.0, 7.5, 6.2],
    '2026-08': [23.7, 17.9, 14.6, 13.3, 12.0, 11.0, 10.4, 9.9, 9.2, 8.7, 7.4, 7.0, 6.6, 6.3, 5.4, 4.9],
  },
  base: { '2026-07': 576, '2026-08': 2013 },
} as const;

export type SemanaTrimestre = {
  semana: string;
  /** MXN. */
  spend: number;
  leads: number;
  /** MXN. Viene calculado de la base, no de spend/leads redondeado. */
  cpl: number;
};

export const SEMANAS: SemanaTrimestre[] = [
  { semana: '2026-06-01', spend: 12518, leads: 97, cpl: 129 },
  { semana: '2026-06-08', spend: 9835, leads: 120, cpl: 82 },
  { semana: '2026-06-15', spend: 9416, leads: 119, cpl: 79 },
  { semana: '2026-06-22', spend: 3755, leads: 24, cpl: 156 },
  { semana: '2026-06-29', spend: 11789, leads: 87, cpl: 136 },
  { semana: '2026-07-06', spend: 6161, leads: 77, cpl: 80 },
  { semana: '2026-07-13', spend: 1852, leads: 46, cpl: 40 },
  { semana: '2026-07-20', spend: 2693, leads: 109, cpl: 25 },
  { semana: '2026-07-27', spend: 5328, leads: 95, cpl: 56 },
  { semana: '2026-08-03', spend: 9003, leads: 108, cpl: 83 },
  { semana: '2026-08-10', spend: 9981, leads: 92, cpl: 108 },
  { semana: '2026-08-17', spend: 15835, leads: 122, cpl: 130 },
  { semana: '2026-08-24', spend: 6994, leads: 42, cpl: 167 },
  { semana: '2026-08-31', spend: 1867, leads: 6, cpl: 311 },
];

export type CohorteTrimestre = {
  mes_inicio: string;
  total_j1: number;
  asistencias: number;
  /** Asistencias con la calificación del prospecto efectivamente marcada. */
  limpias: number;
  cierres: number;
  /** USD. */
  ingreso_total_usd: number;
  dias_promedio_ciclo: number | null;
  estado_madurez: 'madura' | 'madurando' | 'reciente';
};

export const COHORTES: CohorteTrimestre[] = [
  { mes_inicio: '2025-11-01', total_j1: 2, asistencias: 2, limpias: 2, cierres: 2, ingreso_total_usd: 8700, dias_promedio_ciclo: 106, estado_madurez: 'madura' },
  { mes_inicio: '2025-12-01', total_j1: 12, asistencias: 3, limpias: 1, cierres: 1, ingreso_total_usd: 1500, dias_promedio_ciclo: 7, estado_madurez: 'madura' },
  { mes_inicio: '2026-02-01', total_j1: 6, asistencias: 2, limpias: 1, cierres: 1, ingreso_total_usd: 1700, dias_promedio_ciclo: 118, estado_madurez: 'madura' },
  { mes_inicio: '2026-03-01', total_j1: 12, asistencias: 6, limpias: 0, cierres: 0, ingreso_total_usd: 0, dias_promedio_ciclo: null, estado_madurez: 'madura' },
  { mes_inicio: '2026-04-01', total_j1: 15, asistencias: 13, limpias: 3, cierres: 3, ingreso_total_usd: 20500, dias_promedio_ciclo: 28.7, estado_madurez: 'madura' },
  { mes_inicio: '2026-05-01', total_j1: 13, asistencias: 8, limpias: 6, cierres: 3, ingreso_total_usd: 21500, dias_promedio_ciclo: 7.7, estado_madurez: 'madura' },
  { mes_inicio: '2026-06-01', total_j1: 12, asistencias: 6, limpias: 6, cierres: 2, ingreso_total_usd: 14500, dias_promedio_ciclo: 5, estado_madurez: 'madura' },
  { mes_inicio: '2026-07-01', total_j1: 4, asistencias: 2, limpias: 2, cierres: 1, ingreso_total_usd: 7500, dias_promedio_ciclo: 15, estado_madurez: 'madura' },
  { mes_inicio: '2026-08-01', total_j1: 34, asistencias: 14, limpias: 7, cierres: 0, ingreso_total_usd: 0, dias_promedio_ciclo: null, estado_madurez: 'madurando' },
  { mes_inicio: '2026-09-01', total_j1: 8, asistencias: 3, limpias: 3, cierres: 0, ingreso_total_usd: 0, dias_promedio_ciclo: null, estado_madurez: 'reciente' },
];

export type PagoTrimestre = {
  fecha: string;
  /** USD — así se cobra. */
  monto: number;
  cuota: number;
  cliente: string;
};

export const PAGOS: PagoTrimestre[] = [
  { fecha: '2026-06-04', monto: 3750, cuota: 1, cliente: 'Adrian Medina' },
  { fecha: '2026-06-12', monto: 2333.33, cuota: 1, cliente: 'Macario Romero Valencia' },
  { fecha: '2026-06-28', monto: 2014.7, cuota: 1, cliente: 'Francisco Javier Hernandez Baltazar' },
  { fecha: '2026-07-05', monto: 2333.33, cuota: 2, cliente: 'Rosina Patricia Muñoz López' },
  { fecha: '2026-07-11', monto: 3750, cuota: 2, cliente: 'RICARDO azpe' },
  { fecha: '2026-07-17', monto: 1147.59, cuota: 1, cliente: 'Jesus Cendejas hernandez' },
  { fecha: '2026-07-17', monto: 2333.33, cuota: 2, cliente: 'Macario Romero Valencia' },
  { fecha: '2026-08-03', monto: 3176.21, cuota: 2, cliente: 'Jesus Cendejas hernandez' },
  { fecha: '2026-08-05', monto: 2333.33, cuota: 3, cliente: 'Rosina Patricia Muñoz López' },
  { fecha: '2026-08-09', monto: 2500, cuota: 2, cliente: 'Sergio Esquer' },
  { fecha: '2026-08-14', monto: 2333.34, cuota: 3, cliente: 'Macario Romero Valencia' },
  { fecha: '2026-08-15', monto: 2333.33, cuota: 2, cliente: 'Teresa de Jesus Hernandez' },
  { fecha: '2026-09-03', monto: 3176.2, cuota: 3, cliente: 'Jesus Cendejas hernandez' },
];

/** Hechos sueltos que el texto cita y que no salen de las tablas de arriba. */
export const HECHOS = {
  /** Leads que reporta Meta contra los que entraron al CRM por webhook. */
  meta_leads_total: 1144,
  /** El anuncio que sostuvo el volumen todo el trimestre. */
  creativo_top: { nombre: '3 ADS RECON Capataz', leads: 792, /** MXN */ cpl: 35 },
  /** CPL mensual de la 004, en MXN. */
  cpl_004: { junio: 104, julio: 41, agosto: 33 },
  /** % de leads que agenda. */
  lead_a_cita: { julio: 1.9, agosto: 10.6 },
  ctr: { julio: 1.83, agosto: 2.49 },
  /** Asistencia a Junta 1 por mes, en %. */
  show: { abril: 87, mayo: 62, junio: 50, julio: 50, agosto: 41 },
  /** Envíos que registra la tabla de nutrición en todo el trimestre. */
  nutricion: { envios: 3, fallidos: 3, primero: '2026-09-08' },
  /** Última primera cuota de un cliente nuevo. */
  ultima_cuota_1: '2026-07-17',
  /** Citas que se pudieron atribuir a campaña resolviendo los UTM numéricos. */
  citas_atribuidas: 49,
} as const;

// ── Derivados ────────────────────────────────────────────────────────────────
// Se calculan y no se escriben: el total de una columna que alguien tipeó es el
// número que se queda viejo primero.

export const T = <K extends keyof MesTrimestre>(k: K): number =>
  MESES.reduce((a, m) => a + (Number(m[k]) || 0), 0);

/** Leads del trimestre que nunca agendaron. El activo grande y sin tocar. */
export const LEADS_SIN_CITA = T('crm_leads') - T('agenda');

/** Lo que costaron esos leads, prorrateado. MXN. */
export const GASTO_LEADS_SIN_CITA = (T('spend') / T('crm_leads')) * LEADS_SIN_CITA;
