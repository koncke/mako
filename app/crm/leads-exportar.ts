// =============================================================================
// leads-exportar — qué se lleva un export de leads (catálogo compartido)
// =============================================================================
// Client-safe a propósito (sin 'server-only'): lo usan el modal (para preguntar),
// la action (para filtrar y armar el archivo) y el generador de Markdown, así los
// tres hablan del MISMO filtro y no se desincronizan.
//
// Antes esto era un único "alcance" de cuatro opciones y el usuario se quejó con
// razón: "en ningún momento me dejaste filtrar por etapas ni muchas otras cosas".
// Ahora el filtro tiene seis dimensiones (etapa · fecha · origen · persona · dinero
// · campos), pero el wizard SOLO pregunta las que el usuario pidió acotar — por eso
// existe `acotar`: es lo que decide qué pasos aparecen (ver ExportarLeadsModal).
//
// ⚠️ La etapa NO se filtra por la columna `pipeline_stage`: esa columna es un
// override manual y está en NULL en la mayoría de los leads. La etapa real es
// `pipeline_stage ?? deriveStageKey(lead)` y se resuelve en memoria (ver
// app/crm/actions.ts → etapaEfectivaDe). Filtrar por la columna devolvía CERO
// leads en nutrición aunque el Kanban mostrara cientos.

import { diasAntes, finDeMesDeFecha, primerDiaDelMesDeFecha } from '@/lib/date-utils';
import { armarCsv } from '@/lib/csv-celda';

// ── Grupos de campos que puede llevar cada lead ──────────────────────────────

export type CampoLead =
  | 'contacto' | 'etapa' | 'montos' | 'reuniones' | 'equipo'
  | 'origen' | 'fechas' | 'respuestas' | 'perdida' | 'tracking';

export type FormatoLeads = 'csv' | 'md';

export const CAMPOS_LEAD: Array<{ id: CampoLead; label: string; sub: string }> = [
  { id: 'contacto',   label: 'Contacto',                 sub: 'email, teléfono y empresa' },
  { id: 'etapa',      label: 'Etapa y estado',           sub: 'en qué parte del funnel está' },
  { id: 'montos',     label: 'Montos',                   sub: 'vendido, cobrado y lo que falta cobrar' },
  { id: 'reuniones',  label: 'Reuniones',                sub: 'fechas de R1/R2 y si asistió' },
  { id: 'equipo',     label: 'Closer y Setter',          sub: 'quién agendó y quién cerró' },
  { id: 'origen',     label: 'Origen',                   sub: 'campaña, anuncio y UTMs' },
  { id: 'fechas',     label: 'Fechas',                   sub: 'creación, agenda y cierre' },
  { id: 'respuestas', label: 'Respuestas del formulario', sub: 'lo que contestó al agendar' },
  { id: 'perdida',    label: 'Por qué se perdió',        sub: 'el motivo cargado al descartarlo' },
  { id: 'tracking',   label: 'Tracking del VSL',         sub: 'identificador anónimo del visitante' },
];

export const CAMPOS_LEAD_HABITUALES: CampoLead[] = ['contacto', 'etapa', 'montos'];

/** Las preguntas del formulario de agenda, con la columna donde vive cada respuesta. */
export const PREGUNTAS_FORM: Array<[columna: string, pregunta: string]> = [
  ['respuesta_objetivo', '¿A qué se dedica?'],
  ['respuesta_facturacion', 'Facturación mensual actual'],
  ['respuesta_colaboradores', 'Colaboradores'],
  ['respuesta_cuando_empezar', '¿Cuándo quiere empezar?'],
  ['respuesta_inversion', '¿Listo para invertir?'],
  ['respuesta_decisor', '¿Es el decisor?'],
];

/**
 * Columnas reales de `leads` por grupo. id y nombre van siempre (no se listan acá).
 * Las que empiezan con `#` son DERIVADAS (no existen en la base): se calculan en
 * memoria al armar el archivo — ver `esColumnaDerivada`.
 */
export const COLUMNAS_POR_CAMPO: Record<CampoLead, Array<[string, string]>> = {
  contacto:   [['email', 'Email'], ['telefono', 'Teléfono'], ['empresa', 'Empresa']],
  etapa:      [['#etapa', 'Etapa'], ['estado_lead', 'Estado'], ['calificado', 'Calificado']],
  montos:     [['monto_cierre_usd', 'Vendido USD'], ['#cobrado', 'Cobrado USD'], ['#falta', 'Falta cobrar USD'], ['venta_tipo', 'Tipo de venta'], ['suscripcion_monto_usd', 'Suscripción USD/mes'], ['suscripcion_meses', 'Meses de suscripción']],
  reuniones:  [['fecha_junta_1', 'Fecha R1'], ['asistio_j1', 'Asistió R1'], ['fecha_junta_2', 'Fecha R2'], ['asistio_j2', 'Asistió R2']],
  equipo:     [['closer', 'Closer'], ['setter', 'Setter']],
  origen:     [['#origen', 'Origen'], ['meta_campaign_name', 'Campaña'], ['meta_ad_name', 'Anuncio'], ['utm_campaign', 'UTM campaña'], ['utm_content', 'UTM contenido']],
  fechas:     [['created_at', 'Creado'], ['fecha_agenda', 'Fecha agenda'], ['fecha_cierre', 'Fecha cierre'], ['fecha_primer_pago', 'Primer pago']],
  respuestas: PREGUNTAS_FORM.map(([col, q]) => [col, q] as [string, string]),
  perdida:    [['motivo_perdida', 'Por qué se perdió']],
  tracking:   [['visitor_id', 'Visitor ID']],
};

/** Una columna derivada se calcula en memoria: NUNCA va en el select de Supabase. */
export const esColumnaDerivada = (col: string): boolean => col.startsWith('#');

// ── El filtro completo ───────────────────────────────────────────────────────

/** Recetas: el 90% de los exports es una de estas cinco cosas. */
export type RecetaLeads = 'todo' | 'ganados' | 'vivos' | 'nutricion' | 'perdidos' | 'custom';
/** En qué banda del funnel mirar. 'elegir' = el usuario tilda etapa por etapa. */
export type BandaLeads = 'todo' | 'pipeline' | 'nutricion' | 'salidas' | 'elegir';
/** Qué dimensiones extra quiso acotar: define qué pasos muestra el wizard. */
export type AcotarLeads = 'fecha' | 'origen' | 'persona' | 'dinero';
export type PeriodoLeads = 'todo' | 'este-mes' | 'mes-pasado' | 'ult-30' | 'ult-90' | 'este-anio';
export type CampoFechaLeads = 'creado' | 'r1' | 'cierre' | 'primer-pago';
export type DineroLeads = 'no-importa' | 'con-monto' | 'con-cobro' | 'debe' | 'suscripcion' | 'ganado-sin-monto';
export type OrdenLeads = 'etapa' | 'monto' | 'fecha' | 'closer';

/** Token para "Sin asignar" en el filtro por persona (no es un nombre real). */
export const SIN_ASIGNAR = '\u0000sin-asignar';

export type FiltrosLeads = {
  receta: RecetaLeads;
  banda: BandaLeads;
  etapas: string[];          // solo se mira si banda === 'elegir'
  acotar: AcotarLeads[];
  periodo: PeriodoLeads;
  campoFecha: CampoFechaLeads;
  origenes: string[];
  personas: string[];        // nombres de closer/setter, o SIN_ASIGNAR
  dinero: DineroLeads;
  campos: CampoLead[];
  orden: OrdenLeads;
  formato: FormatoLeads;
};

export const FILTROS_INICIALES: FiltrosLeads = {
  receta: 'todo',
  banda: 'todo',
  etapas: [],
  acotar: [],
  periodo: 'todo',
  campoFecha: 'creado',
  origenes: [],
  personas: [],
  dinero: 'no-importa',
  campos: [...CAMPOS_LEAD_HABITUALES],
  orden: 'etapa',
  formato: 'csv',
};

// ── Catálogos de opciones (los pinta el wizard, los lee el server) ───────────

export const RECETAS: Array<{ id: RecetaLeads; label: string; sub: string }> = [
  { id: 'todo',      label: 'Todo lo que hay',              sub: 'la base completa, sin filtrar' },
  { id: 'ganados',   label: 'Mis clientes ganados',         sub: 'los que cerraron y ya compraron' },
  { id: 'vivos',     label: 'Lo que está vivo en el pipeline', sub: 'en juego hoy: sin cerrar ni descartar' },
  { id: 'nutricion', label: 'Lo que quedó en nutrición',    sub: 'los que hay que recontactar' },
  { id: 'perdidos',  label: 'Lo que se perdió',             sub: 'perdidos, descalificados y sin respuesta' },
  { id: 'custom',    label: 'Lo armo yo',                   sub: 'elegir etapas, fechas, origen, personas y montos' },
];

export const BANDAS: Array<{ id: BandaLeads; label: string; sub: string }> = [
  { id: 'todo',      label: 'Todo el funnel',      sub: 'activos, nutrición y descartados' },
  { id: 'pipeline',  label: 'Solo Activo',         sub: 'los que están avanzando' },
  { id: 'nutricion', label: 'Solo Nutrición',      sub: 'los que quedaron esperando' },
  { id: 'salidas',   label: 'Solo Descartado',     sub: 'perdidos, descalificados y sin respuesta' },
  { id: 'elegir',    label: 'Elijo etapa por etapa', sub: 'tildo exactamente las que quiero' },
];

export const ACOTARES: Array<{ id: AcotarLeads; label: string; sub: string }> = [
  { id: 'fecha',   label: 'Por fecha',   sub: 'un período concreto en vez de todo el histórico' },
  { id: 'origen',  label: 'Por origen',  sub: 'de qué campaña o canal vinieron' },
  { id: 'persona', label: 'Por persona', sub: 'los de un closer o un setter' },
  { id: 'dinero',  label: 'Por dinero',  sub: 'con monto, cobrados, deudores o suscripciones' },
];

export const PERIODOS: Array<{ id: PeriodoLeads; label: string; sub?: string }> = [
  { id: 'todo',       label: 'Todo el histórico' },
  { id: 'este-mes',   label: 'Este mes' },
  { id: 'mes-pasado', label: 'Mes pasado' },
  { id: 'ult-30',     label: 'Últimos 30 días' },
  { id: 'ult-90',     label: 'Últimos 90 días' },
  { id: 'este-anio',  label: 'Este año' },
];

export const CAMPOS_FECHA: Array<{ id: CampoFechaLeads; label: string; sub: string }> = [
  { id: 'creado',      label: 'Cuándo entró',      sub: 'la fecha en que el lead se creó' },
  { id: 'r1',          label: 'Cuándo tuvo la R1', sub: 'la fecha de la primera reunión' },
  { id: 'cierre',      label: 'Cuándo cerró',      sub: 'la fecha de cierre de la venta' },
  { id: 'primer-pago', label: 'Cuándo pagó por primera vez', sub: 'la fecha del primer cobro' },
];

export const DINEROS: Array<{ id: DineroLeads; label: string; sub: string }> = [
  { id: 'no-importa',        label: 'No importa',                 sub: 'con o sin plata cargada' },
  { id: 'con-monto',         label: 'Solo con monto cargado',     sub: 'tienen un valor de venta' },
  { id: 'con-cobro',         label: 'Solo con dinero cobrado',    sub: 'ya entró al menos un pago' },
  { id: 'debe',              label: 'Solo los que deben plata',   sub: 'vendido mayor a lo cobrado' },
  { id: 'suscripcion',       label: 'Solo suscripciones',         sub: 'venta recurrente, no pago único' },
  { id: 'ganado-sin-monto',  label: 'Ganados sin monto cargado',  sub: 'cerraron pero nadie puso el número' },
];

export const ORDENES: Array<{ id: OrdenLeads; label: string; sub: string }> = [
  { id: 'etapa',  label: 'Por etapa',  sub: 'en el orden del funnel (lo habitual)' },
  { id: 'monto',  label: 'Por monto',  sub: 'primero los de venta más grande' },
  { id: 'fecha',  label: 'Por fecha',  sub: 'primero los más nuevos' },
  { id: 'closer', label: 'Por closer', sub: 'agrupados por quién los cerró' },
];

// ── Recetas → filtros ────────────────────────────────────────────────────────

/** Etapa mínima que necesitan las recetas para resolverse contra el funnel real. */
export type EtapaRef = { key: string; label: string; band: 'pipeline' | 'nutricion' | 'salidas' };

/**
 * Traduce una receta a filtros concretos CONTRA EL FUNNEL DEL WORKSPACE. No se puede
 * hardcodear: "lo que está vivo" son las etapas de Activo menos el cierre, y cada
 * cliente tiene su propio pipeline (ver lib/pipeline → generateFunnel).
 */
export function filtrosDeReceta(id: RecetaLeads, etapas: EtapaRef[]): Partial<FiltrosLeads> {
  const neutro: Partial<FiltrosLeads> = { acotar: [], periodo: 'todo', origenes: [], personas: [], dinero: 'no-importa' };
  switch (id) {
    case 'ganados':
      return { ...neutro, banda: 'elegir', etapas: ['ganado'] };
    case 'vivos': {
      // Activo sin el cierre: "vivo" es lo que todavía se puede ganar o perder.
      const vivos = etapas.filter((e) => e.band === 'pipeline' && e.key !== 'ganado').map((e) => e.key);
      return { ...neutro, banda: 'elegir', etapas: vivos };
    }
    case 'nutricion': return { ...neutro, banda: 'nutricion', etapas: [] };
    case 'perdidos':  return { ...neutro, banda: 'salidas', etapas: [] };
    case 'custom':    return {};
    default:          return { ...neutro, banda: 'todo', etapas: [] };
  }
}

// ── Períodos → rango de fechas ───────────────────────────────────────────────

/** Rango [desde, hasta] en YYYY-MM-DD, o null si el período es "todo el histórico". */
export function rangoDePeriodo(p: PeriodoLeads, hoyISO: string): { desde: string; hasta: string } | null {
  switch (p) {
    case 'este-mes':   return { desde: primerDiaDelMesDeFecha(hoyISO), hasta: hoyISO };
    case 'mes-pasado': {
      const finAnterior = diasAntes(primerDiaDelMesDeFecha(hoyISO), 1);
      return { desde: primerDiaDelMesDeFecha(finAnterior), hasta: finDeMesDeFecha(finAnterior) };
    }
    case 'ult-30':    return { desde: diasAntes(hoyISO, 29), hasta: hoyISO };
    case 'ult-90':    return { desde: diasAntes(hoyISO, 89), hasta: hoyISO };
    case 'este-anio': return { desde: `${hoyISO.slice(0, 4)}-01-01`, hasta: hoyISO };
    default:          return null;
  }
}

// ── Descripciones en criollo (van en la cabecera del documento y en el nombre) ─

const labelDe = <T extends string>(cat: Array<{ id: T; label: string }>, id: T): string =>
  cat.find((x) => x.id === id)?.label ?? String(id);

const listar = (xs: string[], tope = 4): string =>
  xs.length <= tope ? xs.join(' · ') : `${xs.slice(0, tope).join(' · ')} y ${xs.length - tope} más`;

/** "Todos los leads" / "Ganado · Facturando" — qué subconjunto se bajó. */
export function alcanceLegible(f: FiltrosLeads, etapas: EtapaRef[]): string {
  if (f.receta !== 'custom') return labelDe(RECETAS, f.receta);
  if (f.banda === 'elegir') {
    if (!f.etapas.length) return 'ninguna etapa elegida';
    const nombres = f.etapas.map((k) => etapas.find((e) => e.key === k)?.label ?? k);
    return listar(nombres);
  }
  return labelDe(BANDAS, f.banda);
}

/** Los filtros extra, en una línea. "Sin filtros extra" si no acotó nada. */
export function filtrosLegibles(f: FiltrosLeads): string {
  const on = new Set(f.acotar);
  const partes: string[] = [];
  if (on.has('fecha') && f.periodo !== 'todo') {
    partes.push(`${labelDe(PERIODOS, f.periodo)} (por ${labelDe(CAMPOS_FECHA, f.campoFecha).toLowerCase()})`);
  }
  if (on.has('origen') && f.origenes.length) partes.push(`Origen: ${listar(f.origenes, 3)}`);
  if (on.has('persona') && f.personas.length) {
    partes.push(`Closer o setter: ${listar(f.personas.map((p) => (p === SIN_ASIGNAR ? 'sin asignar' : p)), 3)}`);
  }
  if (on.has('dinero') && f.dinero !== 'no-importa') partes.push(labelDe(DINEROS, f.dinero));
  return partes.length ? partes.join(' · ') : 'sin filtros extra';
}

/** Qué grupos de campos lleva cada lead. */
export function incluyeLegible(f: FiltrosLeads): string {
  const nombres = CAMPOS_LEAD.filter((c) => f.campos.includes(c.id)).map((c) => c.label);
  return nombres.length ? nombres.join(' · ') : 'solo el nombre';
}

/** Trozo corto para el nombre del archivo (no se repite "leads-todos" tres veces). */
export function slugAlcance(f: FiltrosLeads): string {
  if (f.receta !== 'custom') return f.receta;
  if (f.banda === 'elegir') return f.etapas.length === 1 ? f.etapas[0] : `${f.etapas.length}-etapas`;
  return f.banda;
}

/**
 * El CSV de los leads: una fila por lead y las columnas elegidas, con BOM y `\r\n`.
 *
 * ⚠️ INYECCIÓN DE FÓRMULAS (21/10/2026): los nombres y los campos de un lead vienen de formularios PÚBLICOS. Un lead llamado «=HYPERLINK(…)» o «=cmd|…» se
 * abría como fórmula en el Excel o en el Sheets de quien exporta. El escape vive en lib/csv-celda.ts, la única vía (tests/csv-una-sola-via.test.ts): lo que
 * arranca como fórmula lleva un apóstrofo adelante. Un número sigue siendo número (una columna de cifras no se vuelve texto) y un booleano sale «Sí» / «No».
 * BOM: sin él Excel abre el CSV en Windows-1252 y los acentos salen rotos («Diseño» → «DiseÃ±o»). Un export ilegible no es un export.
 */
export function csvDeLeads(columnas: ReadonlyArray<readonly [clave: string, rotulo: string]>, filas: ReadonlyArray<Record<string, unknown>>): string {
  const dato = (v: unknown): string | number => (v == null ? '' : typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v));
  return armarCsv([columnas.map(([, rotulo]) => rotulo), ...filas.map((fila) => columnas.map(([clave]) => dato(fila[clave])))], { numero: String });
}
