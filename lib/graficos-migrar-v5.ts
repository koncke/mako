// =============================================================================
// graficos-migrar-v5 — los BLOQUES de antes, convertidos en gráficos y elementos del catálogo
// =============================================================================
// Martín, 12/10/2026 (tanda v5, contrato docs/relevo/dashboard-v5.md, «Los bloques se van»): los 17
// bloques armados a mano (Revenue, A quién cobrarle, las cohortes, los de Analysts…) no se podían
// editar. Desde v5 cada uno se REEMPLAZA por piezas del catálogo que hacen lo mismo y se editan como
// cualquier gráfico.
//
// ⚠️ EN EL SANEO, NO EN UN SCRIPT. `sanearHoja` (lib/graficos-catalogo.ts) llama a `migrarBloquesV5`
//    ANTES de sanear cada componente, para cualquiera y en cada lectura. El informe guardado de un
//    cliente (el de Mauricio, ws1) NO se reescribe a mano: quien sólo MIRA nunca guarda
//    (`alMoverGrilla`), así que la forma nueva se escribe sola la próxima vez que alguien edite.
//    ⚠️ Va en el MISMO deploy que saca los ids de BLOQUES: sin esta función, `sanearComponente` tira un
//    bloque que no conoce y el próximo autoguardado lo BORRA.
//
// ⚠️ IDS DETERMINÍSTICOS: `<idDelBloque>-<parte>` (`idDeParte`). El saneo corre en cada F5: con un
//    `nuevoId()` lo que se ata a un componente por id (lo elegido mirando en sus filtros, sus datos, el
//    chat de MaKo) se perdería en cada recarga, y dos lecturas del mismo informe darían dos informes.
//
// ⚠️ ADENTRO DEL RECTÁNGULO del bloque (x, y, w, h): las piezas se reparten en el lugar que el bloque
//    ocupaba. Cada receta se escribe sobre el tamaño de fábrica del bloque y se ESCALA al que tiene
//    guardado (alguien pudo agrandarlo o achicarlo).
//
// ⚠️ PURO Y SIN IMPORTAR VALORES DEL CATÁLOGO: el catálogo importa este archivo (sanearHoja), así que un
//    import de valor de vuelta armaría un ciclo. Devuelve objetos CRUDOS: el que los valida es el saneo
//    de siempre (`sanearGrafico`, `sanearElemento`), que corre justo después. Por eso el período de un
//    bloque viaja como `periodo`/`desde`/`hasta` de cada gráfico: `sanearGrafico` lo convierte en un
//    control de período FIJO (`<id recortado>-fecha`), por el MISMO camino que el período propio de un
//    gráfico de antes.
//
// Los nombres de conjuntos, métricas y dimensiones son los de la tabla de DATOS del contrato v5 (los
// declaran lib/graficos-catalogo.ts y lib/graficos-fuentes-extra.ts). Un conjunto que todavía no exista
// hace que `sanearGrafico` descarte esa pieza: por eso este archivo va en el MISMO deploy que los datos.

/** El tope de un id del informe (`idValido` del catálogo: hasta 40, letras, números y guiones). */
const LARGO_ID = 40;

/**
 * El id de una PARTE de un componente: `<base>-<parte>`, con la base recortada para que entre en 40. Lo usan
 * las piezas que reemplazan a un bloque y el control de período fijo de un gráfico (`<id>-fecha`: la base
 * se recorta a 34). Determinístico: la misma base da siempre el mismo id.
 */
export function idDeParte(base: string, parte: string): string {
  const cola = `-${parte}`;
  return `${base.slice(0, Math.max(1, LARGO_ID - cola.length))}${cola}`;
}

/**
 * El primer id libre a partir de `id`, sin azar: `id`, `id-2`, `id-3`… (recortados a 40). Lo usa la
 * migración si un componente que ya estaba en la hoja se llama como una pieza nueva (raro, y no puede
 * resolverse con `nuevoId()`: cambiaría en cada lectura).
 */
export function idLibre(id: string, usados: ReadonlySet<string>): string {
  if (!usados.has(id)) return id;
  for (let n = 2; n < 1000; n++) {
    const c = idDeParte(id, String(n));
    if (!usados.has(c)) return c;
  }
  return id;
}

/**
 * La pieza «entera» de una ficha (una llamada, un anuncio) adentro de un pop-up migrado: la FichaLlamada o
 * el AdDetailTabs completos. ⚠️ CONTRATO CON P6/P8: la pieza de entidad que dibuja app/dashboard/entidades/**
 * tiene que reconocer este nombre (la ficha entera); las plantillas de pop-up pueden partirla en piezas.
 */
export const PIEZA_COMPLETA = 'completo';
/** La acción del elemento «Acción» de la hoja Closing. ⚠️ CONTRATO CON P6: es un id de ACCIONES_ELEMENTO (lib/graficos-acciones.ts). */
export const ACCION_SINCRONIZAR_LLAMADAS = 'sincronizar_llamadas';

type Crudo = Record<string, unknown>;
type Rect = { x: number; y: number; w: number; h: number };
/** Una pieza de la receta: dónde va DENTRO del bloque (en su tamaño de fábrica) y qué es. */
type Parte = {
  parte: string;
  rel: readonly [number, number, number, number];
  /** El componente crudo, sin id ni lugar (los pone la migración). */
  comp: Crudo;
  /** Filtros de DEFINICIÓN: `[campo, valor]` → un control de lista `fijo` (no se dibuja, no lo mueve la vista). */
  fijos?: ReadonlyArray<readonly [string, string]>;
  /** No hereda el período del bloque (mira «hoy»: el MRR, el tablero de tareas). */
  sinPeriodo?: true;
};
type Receta = {
  /** El tamaño de fábrica del bloque (el de BLOQUES hasta v4): las `rel` se escriben sobre él. */
  w: number; h: number;
  /** Qué parte se lleva el título y el subtítulo propios del bloque, si los tenía. */
  principal: string;
  /** El período que el bloque miraba SIN pedirlo (el SCL y las cohortes leían todo el histórico). */
  periodoNatural?: string;
  /** La plantilla que el bloque delataba (FIRMAS de lib/graficos-plantillas.ts hasta v4). */
  plantilla?: string;
  partes: (id: (parte: string) => string) => readonly Parte[];
};

const numero = (fuente: string, metrica: string, titulo: string, extra: Crudo = {}): Crudo =>
  ({ clase: 'grafico', tipo: 'numero', fuente, metricas: [metrica], titulo, ...extra });

/** El pop-up de una ficha (una llamada, un anuncio): la ficha entera, como era. */
const popupDeFicha = (tipo: 'llamada' | 'anuncio', titulo: string, idParte: string): Crudo => ({
  titulo,
  componentes: [{
    id: idDeParte(idParte, 'ficha'), clase: 'elemento', tipo: 'entidad', texto: '',
    entidad: { tipo, pieza: PIEZA_COMPLETA }, x: 0, y: 0, w: 12, h: 16,
  }],
});

/** Las cohortes: la tabla de la tab vieja, del más nuevo al más viejo y sin las semanas vacías. */
const cohortes = (dimension: 'mes' | 'semana', madurez: string, limite: number, titulo: string): Crudo => ({
  clase: 'grafico', tipo: 'tabla', fuente: 'leads', fecha: 'agenda', dimension, titulo, limite,
  metricas: ['agendas', 'asistencias', 'tasa_no_show', 'limpias', 'cierres', 'tasa_cierre_calificadas', 'ciclo_cierre', 'vendido'],
  tabla: { columnas: [madurez], sinVacios: true, descendente: true },
});

/** Una lista de tareas de «Lo que huele mal»: una fila por tarea, ordenada por su métrica. */
const tareas = (metrica: string, titulo: string, limite: number): Crudo => ({
  clase: 'grafico', tipo: 'tabla', fuente: 'ejecucion', dimension: 'tarea', metricas: [metrica],
  ordenMetrica: metrica, ordenAsc: false, limite, titulo, total: false,
});

/**
 * Las recetas, una por bloque. La tabla «Los bloques se van» del contrato v5, con sus decisiones:
 *   · cobranza: la sección «A quién cobrarle» va plegada y se CIERRA con una sección sin título al pie del
 *     bloque. Una sección agrupa todo lo de abajo hasta la siguiente (decisión 2 de Martín): sin el cierre,
 *     plegarla escondía la Tendencia, el funnel, el SCL y las cohortes de Comercial.
 *   · funnel_maduro: las 3 KPI también van sobre las cohortes MADURAS (la tab decía «Cierres maduros»).
 *   · tareas_atencion: «Alta sin deadline» suma estado=Activa (una hecha no es una alarma).
 *   · llamadas_cierre: la columna de la fecha es la dimensión `dia` (los conjuntos no tienen `fecha` como
 *     dimensión).
 *   · cuadrante_retencion: «por anuncio» es la dimensión `guion` (el anuncio analizado, con su id en
 *     `r.anuncio`), y el hook es `hook_rate`.
 */
const RECETAS: Readonly<Record<string, Receta>> = {
  // ── Comercial ────────────────────────────────────────────────────────────────────────────
  revenue: {
    w: 12, h: 9, principal: 'barra',
    partes: () => [
      { parte: 'barra', rel: [0, 0, 12, 3], comp: { clase: 'grafico', tipo: 'barra_proporcion', fuente: 'revenue', metricas: ['cobrado', 'pendiente'], titulo: 'Revenue' } },
      { parte: 'vendido', rel: [0, 3, 3, 5], comp: numero('revenue', 'vendido', 'Sold Revenue', { secundaria: 'cierres' }) },
      { parte: 'cobrado', rel: [3, 3, 3, 5], comp: numero('revenue', 'cobrado', 'Cash Collected') },
      { parte: 'pendiente', rel: [6, 3, 3, 5], comp: numero('revenue', 'pendiente', 'Outstanding') },
      { parte: 'mrr', rel: [9, 3, 3, 5], sinPeriodo: true, comp: numero('suscripciones', 'mrr', 'MRR', { subtitulo: 'Ingreso mensual recurrente', ocultarSiCero: true }) },
    ],
  },
  cobranza: {
    w: 12, h: 8, principal: 'seccion',
    partes: () => [
      { parte: 'seccion', rel: [0, 0, 12, 1], comp: { clase: 'elemento', tipo: 'seccion', texto: 'A quién cobrarle', seccion: { fondo: null, plegable: true, abierto: false } } },
      {
        parte: 'tabla', rel: [0, 1, 12, 6],
        comp: {
          clase: 'grafico', tipo: 'tabla', fuente: 'cobranza', dimension: 'cliente', titulo: 'Clientes por cobrar', limite: 50,
          metricas: ['vendido', 'cobrado_total', 'pendiente', 'proxima_monto', 'dias'], ordenMetrica: 'dias', ordenAsc: true,
          tabla: { acciones: true, columnas: ['urgencia'] },
        },
      },
      { parte: 'cierre', rel: [0, 7, 12, 1], comp: { clase: 'elemento', tipo: 'seccion', texto: '', seccion: { fondo: null, plegable: false, abierto: true } } },
    ],
  },
  funnel_maduro: {
    w: 12, h: 12, principal: 'embudo',
    partes: () => {
      const maduras = [['leads.madurez_semana', 'Madura']] as const;
      return [
        {
          parte: 'embudo', rel: [0, 0, 7, 12], fijos: maduras,
          comp: { clase: 'grafico', tipo: 'embudo_vertical', fuente: 'leads', fecha: 'agenda', metricas: ['agendas', 'asistencias', 'limpias', 'cierres'], titulo: 'Salud del funnel comercial', subtitulo: 'Cohortes maduras' },
        },
        { parte: 'tasa', rel: [7, 0, 5, 4], fijos: maduras, comp: numero('leads', 'tasa_cierre_calificadas', 'Ratio de cierre', { fecha: 'agenda', subtitulo: 'cierres ÷ calificadas' }) },
        { parte: 'noshow', rel: [7, 4, 5, 4], fijos: maduras, comp: numero('leads', 'tasa_no_show', 'No-show rate', { fecha: 'agenda' }) },
        { parte: 'cierres', rel: [7, 8, 5, 4], fijos: maduras, comp: numero('leads', 'cierres', 'Cierres maduros', { fecha: 'agenda' }) },
      ];
    },
  },
  scl: {
    w: 12, h: 8, principal: 'tramos', periodoNatural: 'todo',
    partes: () => [
      { parte: 'ciclo', rel: [0, 0, 3, 4], comp: numero('leads', 'ciclo', 'SCL promedio', { fecha: 'agenda', subtitulo: 'días de la agenda al pago' }) },
      { parte: 'p90', rel: [0, 4, 3, 4], comp: numero('leads', 'p90_ciclo', 'SCL P90', { fecha: 'agenda' }) },
      {
        parte: 'tramos', rel: [3, 0, 9, 8],
        comp: { clase: 'grafico', tipo: 'tramos', fuente: 'leads', fecha: 'agenda', metricas: ['tramo_1', 'tramo_2', 'tramo_3', 'tramo_4', 'tramo_5'], titulo: 'Ciclo de venta (SCL)' },
      },
    ],
  },
  cohortes_mes: {
    w: 12, h: 10, principal: 'tabla', periodoNatural: 'todo',
    partes: () => [{ parte: 'tabla', rel: [0, 0, 12, 10], comp: cohortes('mes', 'madurez_mes', 6, 'Cohortes mensuales') }],
  },
  cohortes_semana: {
    w: 12, h: 10, principal: 'tabla', periodoNatural: 'todo',
    partes: () => [{ parte: 'tabla', rel: [0, 0, 12, 10], comp: cohortes('semana', 'madurez_semana', 8, 'Cohortes semanales') }],
  },
  // ── Productividad (el tablero de HOY: no hay período) ────────────────────────────────────────
  matriz_proyectos: {
    w: 7, h: 14, principal: 'burbujas', plantilla: 'productividad',
    partes: () => [{
      parte: 'burbujas', rel: [0, 0, 7, 14], sinPeriodo: true,
      comp: {
        clase: 'grafico', tipo: 'burbujas', fuente: 'proyectos', dimension: 'proyecto', metricas: ['esfuerzo', 'impacto', 'tareas'],
        titulo: 'Impacto × Esfuerzo', colorPor: 'cuadrante', limite: 50,
        ejes: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
        // [arriba-izq, arriba-der, abajo-izq, abajo-der] con x = esfuerzo, y = impacto (los de la tab vieja).
        referencias: { x: 50, y: 50, rotulos: ['Quick wins', 'Apuestas', 'Relleno', 'Trampas'] },
      },
    }],
  },
  piramide_prioridad: {
    w: 5, h: 14, principal: 'barras', plantilla: 'productividad',
    partes: () => [
      {
        parte: 'barras', rel: [0, 0, 5, 10], sinPeriodo: true,
        comp: { clase: 'grafico', tipo: 'barras', fuente: 'ejecucion', dimension: 'prioridad', metricas: ['activas'], titulo: 'Pirámide de prioridad', subtitulo: 'Tareas activas, sin las que se repiten' },
      },
      { parte: 'alta', rel: [0, 10, 5, 4], sinPeriodo: true, comp: numero('ejecucion', 'pct_alta', 'En Alta', { objetivo: 18, subtitulo: 'de las tareas activas' }) },
    ],
  },
  tareas_atencion: {
    w: 12, h: 12, principal: 'estancadas',
    partes: () => [
      { parte: 'estancadas', rel: [0, 0, 4, 12], sinPeriodo: true, fijos: [['ejecucion.estancada', 'Sí']], comp: tareas('dias_quieta', 'Estancadas', 12) },
      {
        parte: 'alta', rel: [4, 0, 4, 12], sinPeriodo: true,
        fijos: [['ejecucion.prioridad', 'Alta'], ['ejecucion.con_deadline', 'No'], ['ejecucion.estado', 'Activa']],
        comp: tareas('activas', 'Alta sin deadline', 12),
      },
      { parte: 'corridos', rel: [8, 0, 4, 12], sinPeriodo: true, fijos: [['ejecucion.deadline_corrido', 'Sí']], comp: tareas('movidas_deadline', 'Deadlines corridos', 6) },
    ],
  },
  // ── Ads Analyst ──────────────────────────────────────────────────────────────────────────
  patrones_guiones: {
    w: 12, h: 14, principal: 'ia', plantilla: 'ads-analyst',
    partes: () => [{
      parte: 'ia', rel: [0, 0, 12, 14],
      comp: {
        clase: 'elemento', tipo: 'ia', texto: 'Patrones de los guiones',
        ia: { pedido: 'Qué patrones separan a los guiones que agendan de los que no', fuentes: null, vista: 'hallazgos', largo: 'medio', formato: 'tarjetas', lee: 'hoja', cron: null },
      },
    }],
  },
  cuadrante_retencion: {
    w: 12, h: 13, principal: 'dispersion', plantilla: 'ads-analyst',
    partes: (id) => [{
      parte: 'dispersion', rel: [0, 0, 12, 13],
      comp: {
        clase: 'grafico', tipo: 'dispersion', fuente: 'guiones', dimension: 'guion', metricas: ['hook_rate', 'ret_cta'],
        titulo: 'Cuadrante de retención', colorPor: 'angulo', limite: 50,
        ejes: { xMin: 0, xMax: 55, yMin: 0, yMax: 30 },
        // [arriba-izq, arriba-der, abajo-izq, abajo-der] con x = hook rate, y = retención al CTA.
        referencias: { x: 28, y: 10, rotulos: ['Mejorar gancho', 'Escalar', 'Repensar', 'Reescribir cuerpo'] },
        alClic: 'popup', popup: popupDeFicha('anuncio', 'Anuncio', id('dispersion')),
      },
    }],
  },
  // ── Landing ──────────────────────────────────────────────────────────────────────────────
  mapa_calor: {
    w: 12, h: 24, principal: 'mapa', plantilla: 'landing',
    partes: () => [{ parte: 'mapa', rel: [0, 0, 12, 24], comp: { clase: 'grafico', tipo: 'mapa_calor', fuente: 'toques', metricas: ['toques'], titulo: 'Mapa de calor' } }],
  },
  curva_vsl: {
    w: 8, h: 12, principal: 'curva', plantilla: 'landing',
    partes: () => [{ parte: 'curva', rel: [0, 0, 8, 12], comp: { clase: 'grafico', tipo: 'area', fuente: 'retencion_vsl', dimension: 'corte', metricas: ['siguen'], titulo: 'Curva del video' } }],
  },
  // ── Closing ──────────────────────────────────────────────────────────────────────────────
  embudo_cierre: {
    w: 6, h: 10, principal: 'embudo', plantilla: 'closing',
    partes: () => [{
      parte: 'embudo', rel: [0, 0, 6, 10],
      comp: { clase: 'grafico', tipo: 'embudo_vertical', fuente: 'llamadas_venta', metricas: ['r1', 'r2', 'ganadas_r2'], titulo: 'Embudo de llamadas', subtitulo: 'Cuenta llamadas, no personas' },
    }],
  },
  factores_cierre: {
    w: 12, h: 14, principal: 'barras', plantilla: 'closing',
    partes: (id) => [
      {
        parte: 'barras', rel: [0, 0, 8, 14],
        comp: { clase: 'grafico', tipo: 'barras', fuente: 'llamadas_dimensiones', dimension: 'dimension', desglose: 'tono', metricas: ['puntaje'], titulo: 'Factores del cierre' },
      },
      {
        parte: 'ia', rel: [8, 0, 4, 14],
        comp: {
          clase: 'elemento', tipo: 'ia', texto: 'Qué decide los cierres',
          ia: { pedido: 'Qué decide los cierres', fuentes: [id('barras')], vista: 'hallazgos', largo: 'corto', formato: 'vinetas', lee: 'hoja', cron: null },
        },
      },
    ],
  },
  closers_cierre: {
    w: 12, h: 10, principal: 'tabla',
    partes: () => [{
      parte: 'tabla', rel: [0, 0, 12, 10],
      comp: { clase: 'grafico', tipo: 'tabla', fuente: 'llamadas_venta', dimension: 'closer', metricas: ['llamadas', 'puntaje', 'ganadas', 'tasa_cierre'], titulo: 'El equipo de closers' },
    }],
  },
  llamadas_cierre: {
    w: 12, h: 18, principal: 'tabla', plantilla: 'closing',
    partes: (id) => [
      { parte: 'sync', rel: [0, 0, 3, 2], comp: { clase: 'elemento', tipo: 'accion', texto: '', accion: { id: ACCION_SINCRONIZAR_LLAMADAS, rotulo: 'Sincronizar llamadas' } } },
      {
        parte: 'tabla', rel: [0, 2, 12, 16],
        comp: {
          clase: 'grafico', tipo: 'tabla', fuente: 'llamadas_venta', dimension: 'llamada', metricas: ['puntaje', 'duracion'], titulo: 'Las llamadas', limite: 50,
          tabla: { buscar: true, columnas: ['closer', 'reunion', 'dia'] },
          alClic: 'popup', popup: popupDeFicha('llamada', 'Llamada', id('tabla')),
        },
      },
    ],
  },
};

/** Los bloques que esta migración sabe convertir (todos los que existieron hasta v4). */
export const BLOQUES_MIGRADOS: readonly string[] = Object.keys(RECETAS);

/**
 * El orden en que una hoja se reconoce por sus bloques (FIRMAS de lib/graficos-plantillas.ts hasta v4,
 * que buscaba un bloque «firma» en la hoja). Al migrar, la hoja guarda la plantilla en `plantilla` y
 * `hojaDestino` la encuentra por ahí: sin esto, una hoja de «Nueva hoja» (ids al azar) dejaba de
 * reconocerse en cuanto sus bloques se convertían.
 */
const ORDEN_FIRMAS: readonly string[] = ['closing', 'ads-analyst', 'landing', 'productividad'];

const entero = (v: unknown, min: number, max: number, def: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
};
const textoDe = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const esObjeto = (v: unknown): v is Crudo => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Dónde cae una pieza: su lugar en el bloque de fábrica, ESCALADO al rectángulo guardado. Con el tamaño de
 * fábrica (el caso de todos los informes medidos) la cuenta es exacta; con otro, se redondea y la grilla
 * acomoda lo que se roce.
 */
function colocar(rel: Parte['rel'], b: Rect, r: Receta): Rect {
  const sx = b.w / r.w, sy = b.h / r.h;
  const x0 = Math.round(rel[0] * sx), x1 = Math.round((rel[0] + rel[2]) * sx);
  const y0 = Math.round(rel[1] * sy), y1 = Math.round((rel[1] + rel[3]) * sy);
  return { x: b.x + x0, y: b.y + y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

/** Las piezas que reemplazan a UN bloque, ya con id, lugar, título y período. */
function piezasDe(b: Crudo, r: Receta, usados: Set<string>): Crudo[] {
  const base = textoDe(b.id) || 'bloque';
  const rect: Rect = {
    x: entero(b.x, 0, 11, 0), y: entero(b.y, 0, 999, 0),
    w: entero(b.w, 1, 12, r.w), h: entero(b.h, 1, 60, r.h),
  };
  // Los ids se reservan ANTES de armar las piezas: una receta nombra a su hermana (la caja de IA de los
  // factores lee las barras) por el id que va a tener.
  const ids = new Map<string, string>();
  const idDe = (parte: string): string => {
    const ya = ids.get(parte);
    if (ya) return ya;
    const id = idLibre(idDeParte(base, parte), usados);
    usados.add(id);
    ids.set(parte, id);
    return id;
  };
  const partes = r.partes(idDe);
  for (const p of partes) idDe(p.parte);

  const titulo = textoDe(b.titulo);
  const subtitulo = textoDe(b.subtitulo);
  // El período del bloque: su control de período (si alguien le puso uno), si no su período propio, si no
  // el que miraba sin pedirlo. Un control gana sobre el campo, como en `efectivoDe`.
  const controlPeriodo = (Array.isArray(b.controles) ? b.controles : []).find((c) => esObjeto(c) && c.tipo === 'periodo') as Crudo | undefined;
  const periodoCampo = typeof b.periodo === 'string' && b.periodo !== 'auto' && b.periodo !== '' ? b.periodo : null;
  const principal = partes.find((p) => p.parte === r.principal) ?? partes[0];
  const primerGrafico = partes.find((p) => p.comp.clase === 'grafico');

  return partes.map((p) => {
    const id = idDe(p.parte);
    const lugar = colocar(p.rel, rect, r);
    const c: Crudo = { ...p.comp, id, ...lugar };
    if (p === principal && titulo) {
      if (c.clase === 'elemento') c.texto = titulo; else c.titulo = titulo;
    }
    // El subtítulo, en la principal; si la principal es un elemento (la sección, la caja de IA), en el
    // primer gráfico: un elemento no tiene subtítulo.
    const destinoSub = principal.comp.clase === 'grafico' ? principal : primerGrafico;
    if (p === destinoSub && subtitulo) c.subtitulo = subtitulo;
    if (c.clase !== 'grafico') return c;

    const controles: Crudo[] = [];
    if (!p.sinPeriodo) {
      if (controlPeriodo) controles.push({ ...controlPeriodo, id: idDeParte(id, 'fecha') });
      else if (periodoCampo) { c.periodo = periodoCampo; c.desde = b.desde ?? null; c.hasta = b.hasta ?? null; }
      else if (r.periodoNatural) c.periodo = r.periodoNatural;
    }
    (p.fijos ?? []).forEach(([campo, valor], i) => {
      controles.push({ id: idDeParte(id, `f${i + 1}`), tipo: 'lista', campo, valores: [valor], fijo: true });
    });
    if (controles.length) c.controles = controles;
    return c;
  });
}

/**
 * La hoja con cada bloque de antes convertido en sus piezas. CRUDA (la sanea `sanearHoja` justo después) y
 * NUEVA (no toca lo que recibió). `extra` = cuántos componentes de más trajo la conversión: el tope de la
 * hoja se corre en eso, porque una hoja llena de antes no puede PERDER componentes por migrarse.
 *   · Lo que no es un bloque pasa tal cual.
 *   · Un bloque que no está en las recetas pasa tal cual, y el saneo lo descarta (como antes).
 *   · Correrla sobre una hoja ya migrada no hace nada: es idempotente.
 */
export function migrarBloquesV5(hoja: Crudo): { hoja: Crudo; extra: number } {
  const lista = Array.isArray(hoja.componentes) ? hoja.componentes : [];
  if (!lista.some((c) => esObjeto(c) && c.clase === 'bloque' && typeof c.bloque === 'string' && RECETAS[c.bloque])) return { hoja, extra: 0 };
  const usados = new Set<string>();
  for (const c of lista) if (esObjeto(c) && typeof c.id === 'string' && !(c.clase === 'bloque' && RECETAS[String(c.bloque)])) usados.add(c.id);
  const componentes: unknown[] = [];
  const plantillas = new Set<string>();
  let extra = 0;
  for (const c of lista) {
    const r = esObjeto(c) && c.clase === 'bloque' ? RECETAS[String(c.bloque)] : undefined;
    if (!r) { componentes.push(c); continue; }
    const piezas = piezasDe(c as Crudo, r, usados);
    componentes.push(...piezas);
    extra += piezas.length - 1;
    if (r.plantilla) plantillas.add(r.plantilla);
  }
  const plantilla = typeof hoja.plantilla === 'string' && hoja.plantilla ? null : ORDEN_FIRMAS.find((p) => plantillas.has(p)) ?? null;
  return { hoja: { ...hoja, componentes, ...(plantilla ? { plantilla } : {}) }, extra: Math.max(0, extra) };
}
