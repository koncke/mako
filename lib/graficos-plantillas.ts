// =============================================================================
// graficos-plantillas — las hojas armadas: el informe inicial y lo que ofrece «Nueva hoja»
// =============================================================================
// Martín, 11/10/2026: «personalices las 2 tabs de Mauricio como estaban en este editor» y, en el
// feedback de veinte puntos, «Faltan muchas cosas que sacaste que teníamos con Mauricio. Vuelvelo a
// agregar... Como el filtro de fecha... Los gráficos interactivos, el gráfico de México... En
// Comercial está diferente la parte de "A quién cobrarle", antes era un desplegable...» (punto 5) y
// «Al momento de crear un nuevo lienzo, replica el modal que tenemos en "Automations"... TEMPLATES»
// (punto 19).
//
// Una plantilla es una FUNCIÓN que arma la hoja: así las del modal salen con ids nuevos cada vez
// (`instanciarPlantilla`) y el informe inicial con ids FIJOS. ⚠️ Los ids del inicial no pueden ser al
// azar: quien sólo MIRA nunca guarda (alMoverGrilla, EditorInforme.tsx), así que recibe el inicial en
// cada carga, y con ids nuevos cada vez lo que se ata a un gráfico por id (lo elegido en sus
// controles, el chat de MaKo) se perdería en cada recarga.
//
// ⚠️ SIN `server-only`: lo leen el server (el inicial), la pantalla (el modal) y los tests. Y SIN
//    datos de ningún cliente (AGENTS.md: un ejemplo de pantalla es ficticio por regla).
//
// Desde el 11/10/2026 también vive acá A DÓNDE LLEVA un link a una hoja (`hojaDestino`, abajo) y el
// informe del CLOSER (`informeCloser`): Closing Analyst, Ads Analyst y Landing Analyst se retiraron
// de la sidebar y sus rutas traen al Dashboard con `?hoja=` (decisión 6 de Martín: «Closing Analyst
// va COMPLETO al Dashboard… Los closers ven SÓLO la hoja Closing»).

import {
  MAX_HOJAS, NOMBRE_INICIAL, campoDe, esBloque, esElemento, hojaVacia, nuevoId, sanearGrafico, sanearHoja,
  type Componente, type Hoja, type Tablero,
} from './graficos-catalogo';
import { PLANTILLAS_ANALYSTS } from './graficos-plantillas-analysts';
import { PLANTILLAS_GENERALES } from './graficos-plantillas-generales';

/** Una plantilla de la galería de «Nueva hoja». */
export type PlantillaHoja = {
  id: string;
  nombre: string;
  emoji: string;
  /** Una frase, ~110 caracteres: es texto de pantalla. */
  linea: string;
  /** Arma la hoja con los ids que le pasan (fijos para el inicial, nuevos para el modal). */
  armar: (id: (local: string) => string) => Record<string, unknown>;
};

const kpi = (id: string, fuente: string, metrica: string, titulo: string, subtitulo: string, x: number, y: number, extra: Record<string, unknown> = {}) =>
  ({ id, clase: 'grafico', tipo: 'numero', fuente, metricas: [metrica], titulo, subtitulo, x, y, w: 3, h: 4, ...extra });

const MARKETING: PlantillaHoja = {
  id: 'marketing', nombre: 'Marketing', emoji: '📣',
  linea: 'Lo que gastas en Meta, cuánto te cuesta cada cliente y quién ve tus anuncios.',
  armar: (id) => ({
    id: id('marketing'), nombre: 'Marketing', emoji: '📣', subtitulo: 'La pauta, el funnel y la audiencia.',
    controles: [{ id: id('mk-periodo'), tipo: 'periodo', preset: 'ult30' }],
    componentes: [
      // 1 · Los KPIs estrella
      kpi(id('mk-spend'), 'negocio', 'gasto', 'Ad Spend', 'contra el período anterior', 0, 0, { comparar: true }),
      kpi(id('mk-cac'), 'negocio', 'cac', 'CAC real', 'Spend ÷ cierres del período', 3, 0),
      kpi(id('mk-roas-cash'), 'negocio', 'roas_cobrado', 'ROAS cash', 'Cash ÷ Spend · lo que entró', 6, 0),
      kpi(id('mk-roas-sold'), 'negocio', 'roas_vendido', 'ROAS sold', 'Sold ÷ Spend · comprometido', 9, 0),
      // 2 · Salud del Funnel — Marketing: el embudo y las cuatro de eficiencia
      { id: id('mk-funnel'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'negocio', metricas: ['impresiones', 'clics', 'vistas_landing', 'vistas_vsl'], titulo: 'Salud del Funnel — Marketing', x: 0, y: 4, w: 6, h: 12 },
      kpi(id('mk-cpm'), 'negocio', 'cpm', 'CPM', 'por 1,000 impresiones', 6, 4, { h: 6 }),
      kpi(id('mk-cpc'), 'negocio', 'cpc', 'CPC', 'por click', 9, 4, { h: 6 }),
      kpi(id('mk-costo-landing'), 'negocio', 'costo_landing', 'Costo / Landing View', 'por vista de landing', 6, 10, { h: 6 }),
      kpi(id('mk-costo-vsl'), 'negocio', 'costo_vsl', 'Costo / VSL View', 'por play del VSL', 9, 10, { h: 6 }),
      // 3 · Tendencias: agrupa sola por día, semana o mes según el período (como la vieja)
      {
        id: id('mk-tendencias'), clase: 'grafico', tipo: 'serie', fuente: 'negocio', dimension: 'dia', metricas: ['gasto', 'leads', 'agendas', 'cierres'],
        titulo: 'Tendencias', x: 0, y: 16, w: 12, h: 10,
        controles: [{ id: id('mk-tendencias-agrupar'), tipo: 'agrupar', agrupar: 'auto' }],
      },
      // 4 · Audiencia y alcance (en vivo de Meta)
      { id: id('mk-audiencia-titulo'), clase: 'elemento', tipo: 'texto', texto: 'Audiencia y alcance', tamano: 'xl', x: 0, y: 26, w: 12, h: 2 },
      { id: id('mk-edad'), clase: 'grafico', tipo: 'columnas', fuente: 'audiencia', dimension: 'edad', desglose: 'genero', metricas: ['impresiones'], titulo: 'Edad y género', x: 0, y: 28, w: 4, h: 10 },
      { id: id('mk-plataforma'), clase: 'grafico', tipo: 'barras', fuente: 'audiencia', dimension: 'plataforma', metricas: ['impresiones'], titulo: 'Plataforma', x: 4, y: 28, w: 3, h: 10 },
      { id: id('mk-mapa'), clase: 'grafico', tipo: 'mapa', fuente: 'audiencia', dimension: 'region', metricas: ['impresiones'], titulo: 'Dónde están', x: 7, y: 28, w: 5, h: 10 },
      // 5 · Los anuncios del período
      { id: id('mk-anuncios'), clase: 'grafico', tipo: 'tabla_barras', fuente: 'meta', dimension: 'anuncio', metricas: ['gasto', 'impresiones', 'clics', 'leads', 'agendas', 'cpl', 'cpa'], titulo: 'Anuncios del período', limite: 10, x: 0, y: 38, w: 12, h: 10 },
    ],
  }),
};

const COMERCIAL: PlantillaHoja = {
  id: 'comercial', nombre: 'Comercial', emoji: '💼',
  linea: 'Lo vendido y lo cobrado, a quién cobrarle, el funnel de las reuniones y las cohortes.',
  armar: (id) => ({
    id: id('comercial'), nombre: 'Comercial', emoji: '💼', subtitulo: 'Revenue, cobranza, funnel y cohortes.',
    controles: [{ id: id('co-periodo'), tipo: 'periodo', preset: 'ult30' }],
    componentes: [
      // 1 · Revenue: la barra cobrado/pendiente, Sold, Cash y Outstanding, y el MRR
      { id: id('co-revenue'), clase: 'bloque', bloque: 'revenue', x: 0, y: 0, w: 12, h: 9 },
      // 2 · A quién cobrarle: el desplegable con «Marcar cobrada»
      { id: id('co-cobranza'), clase: 'bloque', bloque: 'cobranza', x: 0, y: 9, w: 12, h: 8 },
      // 3 · La tendencia de los últimos 12 meses
      { id: id('co-tendencia'), clase: 'grafico', tipo: 'serie', fuente: 'negocio', dimension: 'mes', metricas: ['vendido', 'cobrado', 'gasto', 'cierres'], titulo: 'Tendencia', periodo: 'ult12m', x: 0, y: 17, w: 12, h: 10 },
      // 4 · Salud del funnel comercial: las cohortes maduras.
      // ⚠️ El funnel y las cohortes van con período «Todo» (Martín, 11/10/2026: «Que muestre todas y para eso
      // tenemos filtros dentro de un elemento»): con el filtro de fecha de la hoja en 30 días quedaban 1-2
      // cohortes maduras. Su período propio le gana al control de la hoja (`efectivoDe`), y se acota con el
      // control de período del propio bloque.
      { id: id('co-funnel'), clase: 'bloque', bloque: 'funnel_maduro', periodo: 'todo', x: 0, y: 27, w: 12, h: 12 },
      // 5 · SCL — el ciclo de venta
      { id: id('co-scl'), clase: 'bloque', bloque: 'scl', x: 0, y: 39, w: 12, h: 8 },
      // 6 · Las cohortes
      { id: id('co-cohortes-mes'), clase: 'bloque', bloque: 'cohortes_mes', periodo: 'todo', x: 0, y: 47, w: 12, h: 10 },
      { id: id('co-cohortes-semana'), clase: 'bloque', bloque: 'cohortes_semana', periodo: 'todo', x: 0, y: 57, w: 12, h: 10 },
    ],
  }),
};

/**
 * La galería de «Nueva hoja», en orden. Marketing y Comercial son las del informe inicial; el resto
 * se arma con los conjuntos del catálogo.
 */
export const PLANTILLAS_HOJA: readonly PlantillaHoja[] = [MARKETING, COMERCIAL, ...PLANTILLAS_ANALYSTS, ...PLANTILLAS_GENERALES];

export const plantillaHojaDe = (id: string) => PLANTILLAS_HOJA.find((p) => p.id === id);

/** Una hoja de la galería con ids NUEVOS (la hoja y cada componente y control): se puede agregar dos veces. */
export function instanciarPlantilla(p: PlantillaHoja): Hoja {
  const ids = new Map<string, string>();
  const id = (local: string) => { if (!ids.has(local)) ids.set(local, nuevoId()); return ids.get(local)!; };
  return sanearHoja(p.armar(id), 0)!;
}

/** La hoja de una plantilla con sus ids FIJOS (los del informe inicial). */
function fija(p: PlantillaHoja): Hoja {
  return sanearHoja(p.armar((local) => local), 0)!;
}

/**
 * El informe con el que arranca quien nunca armó el suyo: las dos tabs viejas, Marketing y Comercial,
 * rearmadas como hojas con sus bloques en el mismo orden y lugar, y con el filtro de fecha arriba.
 */
export function tableroInicial(): Tablero {
  return { v: 3, nombre: NOMBRE_INICIAL, hojas: [fija(MARKETING), fija(COMERCIAL)] };
}

/** Los componentes de una plantilla (para los tests y el modal). */
export const componentesDe = (p: PlantillaHoja): Componente[] => fija(p).componentes;

// ── A dónde lleva `?hoja=` (C2) ─────────────────────────────────────────────────────────────────
// Los links a una hoja nombran la PLANTILLA: /closing → `?hoja=closing`, /ads-analyst →
// `?hoja=ads-analyst`, /productivity-analyst → `?hoja=productividad`, y lo mismo /marketing y
// /comercial. Hasta el 11/10/2026 page.tsx buscaba `h.id === hoja` y, si no estaba, caía en la
// primera hoja SIN AVISAR: una hoja agregada desde «Nueva hoja» nace con ids nuevos, así que a quien
// la había armado así el link de su tab vieja lo dejaba en Marketing. Era el bug vivo de
// /productivity-analyst, y con las tres tabs retiradas hubiera sido el de tres más.

/**
 * Lo que reconoce una hoja armada con una plantilla aunque tenga ids NUEVOS (la de «Nueva hoja»):
 * un bloque que sólo esa plantilla trae, o un id fijo del informe inicial. Alcanza con UNO.
 * ⚠️ Un bloque de una firma no puede estar en otra plantilla: la hoja de una se tomaría por la otra
 *    (lo cuida tests/graficos-analysts.test.ts). Por eso Comercial no se reconoce por `cobranza`, que
 *    también trae la plantilla «Cobranza».
 * Las plantillas generales no tienen firma: se reconocen por su id (y si no están, se agregan con él).
 */
export type FirmaHoja = { bloques?: readonly string[]; ids?: readonly string[] };
const FIRMAS: Readonly<Record<string, FirmaHoja>> = {
  marketing: { ids: ['marketing', 'mk-spend', 'mk-funnel', 'mk-tendencias', 'mk-anuncios'] },
  comercial: { ids: ['comercial', 'co-revenue', 'co-cobranza', 'co-funnel', 'co-tendencia'] },
  closing: { bloques: ['embudo_cierre', 'factores_cierre', 'llamadas_cierre'] },
  'ads-analyst': { bloques: ['patrones_guiones', 'cuadrante_retencion'] },
  landing: { bloques: ['mapa_calor', 'curva_vsl'] },
  productividad: { bloques: ['matriz_proyectos', 'piramide_prioridad'] },
};
/** La firma de una plantilla, para los tests. */
export const firmaDe = (plantillaId: string): FirmaHoja | undefined => FIRMAS[plantillaId];

function calzaFirma(h: Hoja, f: FirmaHoja): boolean {
  if (f.ids?.includes(h.id)) return true;
  return h.componentes.some((c) => !!f.ids?.includes(c.id) || (esBloque(c) && !!f.bloques?.includes(c.bloque)));
}

/** Los ids de todo lo que tiene id en el informe (componentes, controles de la hoja y de cada componente). */
function idsDe(t: Tablero): Set<string> {
  const ids = new Set<string>();
  for (const h of t.hojas) {
    for (const k of h.controles) ids.add(k.id);
    for (const c of h.componentes) {
      ids.add(c.id);
      if (!esElemento(c)) for (const k of c.controles) ids.add(k.id);
    }
  }
  return ids;
}

/**
 * La plantilla armada con sus ids FIJOS para agregarla a ESTE informe. La hoja conserva su id (es
 * lo que nombra el link, y así el próximo `?hoja=` la encuentra por el paso 1). Un componente o un
 * control cuyo id ya usa otra hoja se acuña de nuevo: las plantillas generales repiten nombres
 * locales (`por-dia` está en cuatro) y con el mismo id lo elegido mirando en una hoja se vería en la
 * otra, y los datos de una se pintarían un instante en la otra (los dos se guardan por id).
 */
function paraAgregar(t: Tablero, p: PlantillaHoja): Hoja {
  const h = fija(p);
  const usados = idsDe(t);
  const libre = (id: string) => (usados.has(id) ? nuevoId() : id);
  return {
    ...h,
    controles: h.controles.map((k) => ({ ...k, id: libre(k.id) })),
    componentes: h.componentes.map((c) => (esElemento(c)
      ? { ...c, id: libre(c.id) }
      : { ...c, id: libre(c.id), controles: c.controles.map((k) => ({ ...k, id: libre(k.id) })) })),
  };
}

/** Lo que contesta `hojaDestino`. `hojaId: null` = la primera hoja. */
export type DestinoHoja = {
  hojaId: string | null;
  /** La plantilla pedida, armada para agregarla: no estaba en el informe. */
  agregar: Hoja | null;
  /** Era una plantilla, no estaba, y el informe ya tiene el máximo de hojas: se avisa. */
  lleno?: true;
};

/**
 * Qué hoja abre `?hoja=<pedido>` en ESTE informe:
 *   1. la que tiene ese id exacto;
 *   2. si el pedido es una plantilla, la primera hoja con su FIRMA (la que se agregó desde «Nueva
 *      hoja», con ids nuevos);
 *   3. si es una plantilla y no está, la plantilla armada (`agregar`): la pantalla la AGREGA al
 *      informe y se guarda, porque la persona fue a buscarla (EditorInforme.tsx, con un toast).
 * Un pedido que no es ni una hoja ni una plantilla abre la primera hoja.
 */
export function hojaDestino(t: Tablero, pedido: string | null | undefined): DestinoHoja {
  const p = typeof pedido === 'string' ? pedido.trim() : '';
  if (!p) return { hojaId: null, agregar: null };
  if (t.hojas.some((h) => h.id === p)) return { hojaId: p, agregar: null };
  const plantilla = plantillaHojaDe(p);
  if (!plantilla) return { hojaId: null, agregar: null };
  const firma = FIRMAS[plantilla.id];
  const conFirma = firma ? t.hojas.find((h) => calzaFirma(h, firma)) : undefined;
  if (conFirma) return { hojaId: conFirma.id, agregar: null };
  if (t.hojas.length >= MAX_HOJAS) return { hojaId: null, agregar: null, lleno: true };
  const agregar = paraAgregar(t, plantilla);
  return { hojaId: agregar.id, agregar };
}

/** Un informe con una hoja más al final, si no estaba (la que agrega `hojaDestino`). */
export function conHojaAgregada(t: Tablero, h: Hoja | null | undefined): Tablero {
  if (!h || t.hojas.some((x) => x.id === h.id) || t.hojas.length >= MAX_HOJAS) return t;
  return { ...t, hojas: [...t.hojas, h] };
}

/**
 * El `recording_id` de una llamada que viene en la URL (`?llamada=` del Dashboard, `?call=` de la
 * ruta vieja): un entero positivo, o nada. Lo que no se entiende no abre una ficha vacía.
 */
export function llamadaDeUrl(v: unknown): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== 'string' || !/^\d{1,15}$/.test(s.trim())) return null;
  const n = Number(s.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * /closing → la hoja Closing del Dashboard. `?call=<id>` (la ruta vieja abría ESA llamada) pasa a
 * `&llamada=<id>`, y el resto de la query viaja tal cual (el `?ws=` incluido): los links a /closing
 * salieron en avisos y mensajes de MaKo que nadie puede editar.
 */
export function destinoDeClosing(sp: Record<string, string | string[] | undefined>): string {
  const qs = new URLSearchParams();
  qs.set('hoja', 'closing');
  const id = llamadaDeUrl(sp.call);
  if (id != null) qs.set('llamada', String(id));
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'call' || k === 'hoja' || k === 'llamada') continue;
    if (typeof v === 'string') qs.append(k, v);
    else if (Array.isArray(v)) for (const x of v) qs.append(k, x);
  }
  return `/dashboard?${qs.toString()}`;
}

// ── El closer: la hoja Closing y nada más (C3) ──────────────────────────────────────────────────
// Decisión 6 de Martín (11/10/2026): «Los closers ven SÓLO la hoja Closing del Dashboard (no editan el
// informe, no ven otras hojas)». La pantalla le arma este informe EN MEMORIA (nunca se guarda) y
// /api/graficos le contesta sólo lo que esta hoja pide. ⚠️ Esconder el resto en la pantalla no
// protege nada (AGENTS.md, «Un flag de visibilidad protege la PANTALLA»): la lista de abajo es la que
// usa el SERVER, y el test cruza que la hoja no pida nada fuera de ella.

/** Los conjuntos que un closer puede leer: las llamadas. Ni la plata, ni los leads, ni la pauta. */
export const CLOSER_CONJUNTOS: readonly string[] = ['llamadas', 'llamadas_venta', 'llamadas_dimensiones'];
/** Los bloques de Closing. */
export const CLOSER_BLOQUES: readonly string[] = ['embudo_cierre', 'factores_cierre', 'closers_cierre', 'llamadas_cierre'];

/** El informe del closer: la plantilla Closing con sus ids fijos (sin guardar, la elegida mirando no se pierde al recargar). */
export function informeCloser(): Tablero {
  const p = plantillaHojaDe('closing');
  // Un informe sin hojas rompe la pantalla (todo lee `hojas[0]`): sin la plantilla, una hoja vacía.
  return { v: 3, nombre: NOMBRE_INICIAL, hojas: [p ? fija(p) : hojaVacia('Closing')] };
}

/**
 * Los conjuntos de Closing donde un closer puede pedir los valores de un campo (el desplegable de un
 * filtro), recortados a los que pidió la pantalla. Vacío = ese campo no es de Closing: 403. «Closer»
 * también está en los leads, y por ahí no pasa.
 */
export function fuentesDeCampoCloser(campoId: unknown, pedidas?: unknown): string[] {
  const c = campoDe(typeof campoId === 'string' ? campoId : '');
  if (!c) return [];
  const propias = Object.keys(c.en).filter((f) => CLOSER_CONJUNTOS.includes(f));
  if (!Array.isArray(pedidas)) return propias;
  const p = pedidas.map(String);
  return propias.filter((f) => p.includes(f));
}

/**
 * ¿Un closer puede hacer este pedido a /api/graficos? `datos` de los conjuntos de Closing, `bloques`
 * de Closing y `valores` de un campo de Closing. Guardar, el detalle de un número y todo lo demás,
 * no. EN POSITIVO: una acción nueva de la ruta nace cerrada para el closer.
 * Un pedido de la lista que no se entiende cierra la lista entera: la pantalla del closer no los arma.
 */
export function closerPuedePedir(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  const lista = (v: unknown): Array<Record<string, unknown> | null> => (Array.isArray(v) ? v : []);
  if (b.accion === 'datos') {
    return lista(b.pedidos).every((p) => {
      const g = sanearGrafico(p?.grafico);
      return !!g && CLOSER_CONJUNTOS.includes(g.fuente);
    });
  }
  if (b.accion === 'bloques') return lista(b.pedidos).every((p) => CLOSER_BLOQUES.includes(String(p?.bloque ?? '')));
  if (b.accion === 'valores') return fuentesDeCampoCloser(b.campo, b.fuentes).length > 0;
  return false;
}
