// =============================================================================
// metricas-modelo — la FORMA del reporte de números y sus salidas (puro)
// =============================================================================
// SIN `server-only` A PROPÓSITO, que es la regla de la casa: lo que decide cómo
// se agrupa un período y cómo sale un número a un archivo tiene que poder
// testearse, y un módulo que importa Supabase no se puede importar desde un test.
// Mismo motivo por el que existen `lib/cerebro-modelo.ts` y `lib/closing-internos.ts`.
//
// Lo que vive acá son las tres decisiones que se rompen solas y en silencio:
//   · en qué bucket cae una fecha (`claveDe`);
//   · qué períodos APARECEN aunque no hayan tenido nada (`clavesDelRango`) — un
//     mes que se omite se lee como «no se midió», que es lo contrario de la
//     verdad;
//   · cómo sale un `null` a un CSV. Un 0 en la celda «inversión» es una
//     afirmación falsa sobre el negocio; la celda vacía es la verdad.
//
// El que LEE la base es `lib/metricas-negocio.ts`, que sí lleva `server-only`.
// =============================================================================

import { lunesDeFecha, esFechaValida, diasAntes } from './date-utils';

/** Cómo se agrupan las filas. `mes` es el default: es el grano en el que se
 *  pregunta por un trimestre. */
export type Grano = 'dia' | 'semana' | 'mes';

export const GRANOS: readonly Grano[] = ['dia', 'semana', 'mes'] as const;

/** Rango por defecto: los últimos 90 días (un trimestre móvil). */
export const DIAS_DEFAULT = 90;

/**
 * Tope de seguridad del rango. No es para ahorrar: es para que un `?desde=1970`
 * no barra la tabla entera y muera por timeout con un 500 mudo. Cinco años cubre
 * cualquier pregunta real de un negocio que existe hace dos.
 */
export const MAX_DIAS = 1830;

/**
 * Una fila del reporte.
 *
 * Los `number | null` de Meta y del landing son **null cuando NO HAY FUENTE**
 * (integración sin conectar, tabla sin una sola fila en el rango) y **0 cuando la
 * fuente existe y ese período de verdad no tuvo nada**. Los del CRM nunca son
 * null: la tabla `leads` siempre existe, así que un 0 ahí es un 0 de verdad.
 *
 * Es la regla que gobierna el módulo entero: un cero AFIRMA un hecho del negocio
 * («no invertiste»), un null dice lo único que sabemos («no tenemos de dónde
 * leerlo»). Confundirlos es el error que hace que un tablero en verde tape algo
 * que se está perdiendo.
 */
export type FilaMetricas = {
  /** '2026-03' (mes) · '2026-03-02' (lunes de la semana) · '2026-03-15' (día). */
  periodo: string;

  // ── Meta Ads ───────────────────────────────────────────────────────────────
  /** El número REAL que cobró Meta, en la moneda de la cuenta. Ver `moneda`. */
  meta_inversion: number | null;
  /** Derivado con un tipo de cambio FIJO. Ver la advertencia de `moneda`. */
  meta_inversion_usd: number | null;
  meta_impresiones: number | null;
  meta_clics: number | null;
  meta_clics_link: number | null;
  /** Landing page views SEGÚN EL PÍXEL DE META. No es lo mismo que
   *  `landing_visitas`, que sale del snippet propio: uno cuenta lo atribuible a
   *  un anuncio, el otro cuenta a todo el que llegó. Van los dos a propósito. */
  meta_landing_views: number | null;
  /** Formularios instantáneos completados, según Meta. */
  meta_formularios: number | null;

  // ── Landing y VSL (tracking propio) ────────────────────────────────────────
  /** Pageviews de la landing. Sin tráfico de prueba ni preview del editor. */
  landing_visitas: number | null;
  /** Visitantes distintos DENTRO del período. Sumar esta columna entre períodos
   *  NO da el único del total: la misma persona puede volver en otro mes. */
  landing_visitantes: number | null;
  /** Arranques del VSL pedidos por una persona (sin autoplay). */
  vsl_plays: number | null;
  vsl_visitantes: number | null;

  // ── CRM ────────────────────────────────────────────────────────────────────
  /** Leads creados en el período (`leads.created_at`). */
  leads_nuevos: number;
  /** Leads cuyo AGENDAMIENTO se registró en el período (`fecha_agenda`). Es
   *  «cuándo reservó», no «cuándo es la reunión». */
  agendas_creadas: number;
  /** Reuniones 1 CON FECHA EN EL PERÍODO. La cita cae acá, se haya hecho o no. */
  j1_programadas: number;
  /** …y de esas, a cuántas asistió (`asistio_j1 = true`). Esto es «J1 realizada». */
  j1_realizadas: number;
  j1_noshow: number;
  /** J1 programadas todavía sin marcar asistencia. Si esto es alto, `j1_realizadas`
   *  está subestimada por falta de carga, no por el negocio. */
  j1_sin_marcar: number;
  j2_programadas: number;
  j2_realizadas: number;
  j2_noshow: number;
  j2_sin_marcar: number;
  /** Cierres con fecha en el período (`cerro = true`). Misma definición que
   *  `v_cohortes_mensuales`, para que reconcilie con /comercial. */
  ganados: number;
  ingreso_usd: number;
};

/** De dónde salió (o no salió) cada bloque de columnas. Es lo que impide leer un
 *  null como un cero. */
export type CoberturaFuente = {
  /** true = hay de dónde leer. false = las columnas de este bloque van en null. */
  hay_datos: boolean;
  /** Filas leídas dentro del rango pedido. */
  filas: number;
  /** Qué mirar si `hay_datos` es false. Vacío si está todo bien. */
  nota: string;
};

export type Cobertura = {
  meta: CoberturaFuente;
  landing: CoberturaFuente;
  vsl: CoberturaFuente;
  crm: CoberturaFuente;
};

export type ReporteMetricas = {
  periodo: { desde: string; hasta: string; grano: Grano; zona: string };
  moneda: {
    /** La moneda REAL de `meta_inversion`. Sale de la cuenta publicitaria. */
    meta: string;
    tipo_cambio_usd_mxn: number;
    nota: string;
  };
  filas: FilaMetricas[];
  totales: Omit<FilaMetricas, 'periodo'>;
  cobertura: Cobertura;
  /** Lo que hay que saber para no leer mal un número. Nunca vacío por diseño. */
  advertencias: string[];
};

// ── Agrupación ───────────────────────────────────────────────────────────────

/** La clave de agrupación de una fecha 'YYYY-MM-DD'. */
export function claveDe(fecha: string, grano: Grano): string {
  if (grano === 'mes') return fecha.slice(0, 7);
  if (grano === 'semana') return lunesDeFecha(fecha);
  return fecha;
}

/**
 * Todas las claves del rango, **incluidas las que no tuvieron ni una fila**.
 *
 * Un mes sin nada tiene que aparecer con ceros: si se omite, el que lee la tabla
 * no distingue «no pasó nada» de «no se midió», y esas dos cosas llevan a
 * decisiones opuestas.
 *
 * Se avanza DÍA a día y se deduplica por clave: son 1830 vueltas en el peor caso
 * y evita escribir la aritmética de «sumar un mes», que es donde viven los bugs
 * de fin de mes (31 de enero + 1 mes).
 */
export function clavesDelRango(desde: string, hasta: string, grano: Grano): string[] {
  const out: string[] = [];
  const vistas = new Set<string>();
  let cursor = desde;
  for (let i = 0; i <= MAX_DIAS && cursor <= hasta; i++) {
    const k = claveDe(cursor, grano);
    if (!vistas.has(k)) { vistas.add(k); out.push(k); }
    cursor = diasAntes(cursor, -1);
  }
  return out;
}

/**
 * Valida y completa el rango pedido. `hoy` entra por parámetro —y no se lee del
 * reloj— para que la función sea pura: el que sabe qué día es en la zona del
 * workspace es el caller.
 *
 * Lanza con un mensaje que dice QUÉ HACER, no solo qué pasó: lo lee un agente
 * que puede corregirse solo si le decimos cómo.
 */
export function validarRango(
  hoy: string,
  desdeRaw?: string | null,
  hastaRaw?: string | null,
): { desde: string; hasta: string } {
  const hasta = (hastaRaw ?? '').trim() || hoy;
  const desde = (desdeRaw ?? '').trim() || diasAntes(hasta, DIAS_DEFAULT - 1);

  if (!esFechaValida(desde)) throw new Error(`«desde» no es una fecha válida (YYYY-MM-DD): ${desde}`);
  if (!esFechaValida(hasta)) throw new Error(`«hasta» no es una fecha válida (YYYY-MM-DD): ${hasta}`);
  if (desde > hasta) throw new Error(`el rango está al revés: desde=${desde} es posterior a hasta=${hasta}`);

  const dias = Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;
  if (dias > MAX_DIAS) {
    throw new Error(`el rango pedido son ${dias} días y el tope es ${MAX_DIAS} (5 años). Pide un tramo más corto.`);
  }
  return { desde, hasta };
}

// ── Salidas ──────────────────────────────────────────────────────────────────

/** El orden de las columnas. Explícito y no `Object.keys()`: el orden de una
 *  tabla que alguien va a leer es una decisión, no un detalle del objeto. */
export const COLUMNAS: Array<keyof FilaMetricas> = [
  'periodo',
  'meta_inversion', 'meta_inversion_usd', 'meta_impresiones', 'meta_clics', 'meta_clics_link',
  'meta_landing_views', 'meta_formularios',
  'landing_visitas', 'landing_visitantes', 'vsl_plays', 'vsl_visitantes',
  'leads_nuevos', 'agendas_creadas',
  'j1_programadas', 'j1_realizadas', 'j1_noshow', 'j1_sin_marcar',
  'j2_programadas', 'j2_realizadas', 'j2_noshow', 'j2_sin_marcar',
  'ganados', 'ingreso_usd',
];

/**
 * Una celda de CSV. Comillas dobles si hay coma, comilla, punto y coma o salto —y
 * la comilla se duplica, que es el escape del formato.
 *
 * ⚠️ Un `null` sale VACÍO, nunca `0` ni la palabra «null».
 */
export function celda(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * El reporte como CSV, listo para abrir en una planilla.
 *
 * ⚠️ Lleva BOM. Sin él, Excel en Windows abre el archivo en la codificación del
 * sistema y los acentos de los encabezados salen rotos («Sesión» → «SesiÃ³n»).
 */
export function metricasACsv(r: ReporteMetricas): string {
  const lineas: string[] = [COLUMNAS.join(',')];
  for (const f of r.filas) lineas.push(COLUMNAS.map((c) => celda(f[c])).join(','));
  // El total va como una fila más, rotulada, ADENTRO del mismo archivo: un total
  // en un archivo aparte es un total que nadie abre.
  lineas.push(COLUMNAS.map((c) => (c === 'periodo' ? 'TOTAL' : celda(r.totales[c as keyof typeof r.totales]))).join(','));
  return `﻿${lineas.join('\n')}\n`;
}

/** El reporte como tabla markdown: lo que un agente lee mejor y lo que se puede
 *  pegar en un mensaje. */
export function metricasAMarkdown(r: ReporteMetricas): string {
  const filaMd = (vals: Array<string | number | null>) =>
    `| ${vals.map((v) => (v == null ? '—' : String(v))).join(' | ')} |`;
  const out: string[] = [
    `# Números del negocio · ${r.periodo.desde} → ${r.periodo.hasta} (por ${r.periodo.grano})`,
    '',
    filaMd([...COLUMNAS]),
    `|${COLUMNAS.map(() => '---').join('|')}|`,
    ...r.filas.map((f) => filaMd(COLUMNAS.map((c) => f[c] as string | number | null))),
    filaMd(COLUMNAS.map((c) => (c === 'periodo' ? 'TOTAL' : (r.totales[c as keyof typeof r.totales] as number | null)))),
    '',
    '## Cómo leer esto',
    '',
    ...r.advertencias.map((a) => `- ${a}`),
  ];
  const faltantes = Object.entries(r.cobertura).filter(([, c]) => !c.hay_datos);
  if (faltantes.length) {
    out.push('', '## Columnas vacías y por qué', '');
    for (const [k, c] of faltantes) out.push(`- **${k}**: ${c.nota}`);
  }
  return `${out.join('\n')}\n`;
}
