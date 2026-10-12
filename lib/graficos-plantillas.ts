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
// Desde el 11/10/2026 también vive acá A DÓNDE LLEVA un link a una hoja (`hojaDestino`, abajo) y la hoja
// ÚNICA de un rol (`HOJA_DE_ROL`): Closing, Ads y Landing Analyst se retiraron de la sidebar y sus rutas
// traen al Dashboard con `?hoja=` (decisión 6 de Martín: «Closing Analyst va COMPLETO al Dashboard… Los
// closers ven SÓLO la hoja Closing»).
//
// TANDA v5 (12/10/2026, contrato docs/relevo/dashboard-v5.md):
//   · SIN BLOQUES: Marketing y Comercial se arman con gráficos y elementos del catálogo (la tabla «Los bloques
//     se van»), con los MISMOS ids que la migración del saneo le pone a un informe guardado de antes
//     (lib/graficos-migrar-v5.ts). No dependen de la migración: ella es para lo GUARDADO.
//   · Cada hoja dice de qué plantilla nació (`Hoja.plantilla`): `hojaDestino` pregunta eso primero, y la
//     FIRMA de antes queda sólo de respaldo (los ids fijos de Marketing y Comercial).
//   · El SETTER ve SÓLO la hoja Chat Analyst, como el closer con Closing (`HOJA_DE_ROL`).
//   · Las plantillas de POP-UP («Llamada», «Anuncio») viven en lib/graficos-plantillas-analysts.ts y se
//     reexportan acá.

import {
  MAX_HOJAS, NOMBRE_INICIAL, campoDe, esElemento, esGrafico, hojaVacia, nuevoId, sanearComponente, sanearGrafico, sanearHoja,
  type Componente, type Hoja, type Tablero,
} from './graficos-catalogo';
import { ARMADO, PLANTILLAS_ANALYSTS, PLANTILLAS_POPUP, POPUP_ANUNCIO } from './graficos-plantillas-analysts';
import { PLANTILLAS_GENERALES } from './graficos-plantillas-generales';
import type { RolWorkspace } from './auth-session';

export { PLANTILLAS_POPUP, POPUP_ANUNCIO, POPUP_LLAMADA, type PlantillaPopup } from './graficos-plantillas-analysts';

/** Una plantilla de la galería de «Nueva hoja». */
export type PlantillaHoja = {
  id: string;
  nombre: string;
  emoji: string;
  /** Una frase, ~110 caracteres: es texto de pantalla. */
  linea: string;
  /**
   * Otras palabras con las que se la busca en el modal, que no se dibujan: «Landing Analyst» para la hoja
   * Landing (la tab se llamaba así y la gente la busca por ese nombre). Ausente = sólo el nombre y la línea.
   */
  buscar?: string;
  /** Arma la hoja con los ids que le pasan (fijos para el inicial, nuevos para el modal). */
  armar: (id: (local: string) => string) => Record<string, unknown>;
};

const { kpi, fijo, periodoFijo, periodoVisible, popupDe } = ARMADO;

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
      // 3 · Tendencias: agrupa sola por día, semana o mes según el período (como la vieja). Con 4 métricas de
      //     dos formatos se dibuja en PANELES (lib/graficos-gordo.ts): h 12 para que cada panel respire
      //     (relevo C: h 10 son ~130 px de área por panel; h 12, ~170).
      {
        id: id('mk-tendencias'), clase: 'grafico', tipo: 'serie', fuente: 'negocio', dimension: 'dia', metricas: ['gasto', 'leads', 'agendas', 'cierres'],
        titulo: 'Tendencias', x: 0, y: 16, w: 12, h: 12,
        controles: [{ id: id('mk-tendencias-agrupar'), tipo: 'agrupar', agrupar: 'auto' }],
      },
      // 4 · Audiencia y alcance (en vivo de Meta)
      { id: id('mk-audiencia-titulo'), clase: 'elemento', tipo: 'texto', texto: 'Audiencia y alcance', tamano: 'xl', x: 0, y: 28, w: 12, h: 2 },
      { id: id('mk-edad'), clase: 'grafico', tipo: 'columnas', fuente: 'audiencia', dimension: 'edad', desglose: 'genero', metricas: ['impresiones'], titulo: 'Edad y género', x: 0, y: 30, w: 4, h: 10 },
      { id: id('mk-plataforma'), clase: 'grafico', tipo: 'barras', fuente: 'audiencia', dimension: 'plataforma', metricas: ['impresiones'], titulo: 'Plataforma', x: 4, y: 30, w: 3, h: 10 },
      { id: id('mk-mapa'), clase: 'grafico', tipo: 'mapa', fuente: 'audiencia', dimension: 'region', metricas: ['impresiones'], titulo: 'Dónde están', x: 7, y: 30, w: 5, h: 10 },
      // 5 · Los anuncios del período, como TARJETAS (con su miniatura): eran 7 columnas con una barra en cada
      //     una; ahora la que ordena + 3, y el clic abre el anuncio (relevo C y A2, puntos 20 y 21).
      {
        id: id('mk-anuncios'), clase: 'grafico', tipo: 'tarjetas', fuente: 'meta', dimension: 'anuncio', metricas: ['gasto', 'leads', 'agendas', 'cpa'],
        ordenMetrica: 'gasto', barra: 'gasto', limite: 10, tabla: { columnas: ['campana'] },
        titulo: 'Anuncios del período', x: 0, y: 40, w: 12, h: 12,
        alClic: 'popup', popup: popupDe(POPUP_ANUNCIO, id, 'mk-anuncios'),
      },
    ],
  }),
};

/** Las cohortes: la tabla de la tab vieja, del más nuevo al más viejo y sin los períodos vacíos. */
const cohortes = (id: (l: string) => string, local: string, dimension: 'mes' | 'semana', madurez: string, limite: number, titulo: string, y: number) => ({
  id: id(local), clase: 'grafico', tipo: 'tabla', fuente: 'leads', fecha: 'agenda', dimension, titulo, limite,
  metricas: ['agendas', 'asistencias', 'tasa_no_show', 'limpias', 'cierres', 'tasa_cierre_calificadas', 'ciclo_cierre', 'vendido'],
  tabla: { columnas: [madurez], sinVacios: true, descendente: true },
  controles: [periodoFijo(id(`${local}-fecha`), 'todo')],
  x: 0, y, w: 12, h: 10,
});

const COMERCIAL: PlantillaHoja = {
  id: 'comercial', nombre: 'Comercial', emoji: '💼',
  linea: 'Lo vendido y lo cobrado, a quién cobrarle, el funnel de las reuniones y las cohortes.',
  armar: (id) => {
    // Lo que DEFINE las cuatro tarjetas del funnel: las cohortes maduras, en todo el histórico (Martín, 11/10/2026:
    // «Que muestre todas y para eso tenemos filtros dentro de un elemento»). Con los 30 días de la hoja quedaban
    // 1-2 cohortes maduras.
    const maduras = (local: string) => [periodoFijo(id(`${local}-fecha`), 'todo'), fijo(id(`${local}-f1`), 'leads.madurez_semana', ['Madura'])];
    const todo = (local: string) => [periodoFijo(id(`${local}-fecha`), 'todo')];
    return {
      id: id('comercial'), nombre: 'Comercial', emoji: '💼', subtitulo: 'Revenue, cobranza, funnel y cohortes.',
      controles: [{ id: id('co-periodo'), tipo: 'periodo', preset: 'ult30' }],
      componentes: [
        // 1 · Revenue: la barra cobrado/pendiente, Sold, Cash y Outstanding, y el MRR (una lectura: `revenue`).
        //     El Outstanding mira hacia ADELANTE con su período a la vista (este mes completo, como el bloque de
        //     antes, que llegaba al fin de mes).
        { id: id('co-revenue-barra'), clase: 'grafico', tipo: 'barra_proporcion', fuente: 'revenue', metricas: ['cobrado', 'pendiente'], titulo: 'Revenue', x: 0, y: 0, w: 12, h: 3 },
        kpi(id('co-revenue-vendido'), 'revenue', 'vendido', 'Sold Revenue', '', 0, 3, { h: 5, secundaria: 'cierres' }),
        kpi(id('co-revenue-cobrado'), 'revenue', 'cobrado', 'Cash Collected', '', 3, 3, { h: 5 }),
        kpi(id('co-revenue-pendiente'), 'revenue', 'pendiente', 'Outstanding', '', 6, 3, {
          h: 5, controles: [periodoVisible(id('co-revenue-pendiente-fecha'), 'este_mes_completo')],
        }),
        kpi(id('co-revenue-mrr'), 'suscripciones', 'mrr', 'MRR', 'Ingreso mensual recurrente', 9, 3, { h: 5, ocultarSiCero: true }),
        // 2 · A quién cobrarle: el desplegable (una sección plegada) con «Marcar cobrada» en cada fila. La
        //     sección sin título de abajo CIERRA el grupo: sin ella, plegarla escondería el resto de la hoja.
        { id: id('co-cobranza-seccion'), clase: 'elemento', tipo: 'seccion', texto: 'A quién cobrarle', seccion: { fondo: null, plegable: true, abierto: false }, x: 0, y: 8, w: 12, h: 1 },
        {
          id: id('co-cobranza-tabla'), clase: 'grafico', tipo: 'tabla', fuente: 'cobranza', dimension: 'cliente', titulo: 'Clientes por cobrar', limite: 50,
          metricas: ['vendido', 'cobrado_total', 'pendiente', 'proxima_monto', 'dias'], ordenMetrica: 'dias', ordenAsc: true,
          tabla: { acciones: true, columnas: ['urgencia'] },
          controles: [periodoVisible(id('co-cobranza-tabla-fecha'), 'este_mes_completo')],
          x: 0, y: 9, w: 12, h: 6,
        },
        { id: id('co-cobranza-cierre'), clase: 'elemento', tipo: 'seccion', texto: '', seccion: { fondo: null, plegable: false, abierto: true }, x: 0, y: 15, w: 12, h: 1 },
        // 3 · La tendencia de los últimos 12 meses (en paneles: dos formatos)
        {
          id: id('co-tendencia'), clase: 'grafico', tipo: 'serie', fuente: 'negocio', dimension: 'mes', metricas: ['vendido', 'cobrado', 'gasto', 'cierres'],
          titulo: 'Tendencia', x: 0, y: 16, w: 12, h: 12, controles: [periodoFijo(id('co-tendencia-fecha'), 'ult12m')],
        },
        // 4 · Salud del funnel comercial: las cohortes maduras
        {
          id: id('co-funnel-embudo'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'leads', fecha: 'agenda', metricas: ['agendas', 'asistencias', 'limpias', 'cierres'],
          titulo: 'Salud del funnel comercial', subtitulo: 'Cohortes maduras', x: 0, y: 28, w: 7, h: 12, controles: maduras('co-funnel-embudo'),
        },
        kpi(id('co-funnel-tasa'), 'leads', 'tasa_cierre_calificadas', 'Ratio de cierre', 'cierres ÷ calificadas', 7, 28, { w: 5, fecha: 'agenda', controles: maduras('co-funnel-tasa') }),
        kpi(id('co-funnel-noshow'), 'leads', 'tasa_no_show', 'No-show rate', '', 7, 32, { w: 5, fecha: 'agenda', controles: maduras('co-funnel-noshow') }),
        kpi(id('co-funnel-cierres'), 'leads', 'cierres', 'Cierres maduros', '', 7, 36, { w: 5, fecha: 'agenda', controles: maduras('co-funnel-cierres') }),
        // 5 · SCL — el ciclo de venta, en todo el histórico (lo que el bloque leía sin pedirlo)
        kpi(id('co-scl-ciclo'), 'leads', 'ciclo', 'SCL promedio', 'días de la agenda al pago', 0, 40, { fecha: 'agenda', controles: todo('co-scl-ciclo') }),
        kpi(id('co-scl-p90'), 'leads', 'p90_ciclo', 'SCL P90', '', 0, 44, { fecha: 'agenda', controles: todo('co-scl-p90') }),
        {
          id: id('co-scl-tramos'), clase: 'grafico', tipo: 'tramos', fuente: 'leads', fecha: 'agenda', metricas: ['tramo_1', 'tramo_2', 'tramo_3', 'tramo_4', 'tramo_5'],
          titulo: 'Ciclo de venta (SCL)', x: 3, y: 40, w: 9, h: 8, controles: todo('co-scl-tramos'),
        },
        // 6 · Las cohortes
        cohortes(id, 'co-cohortes-mes-tabla', 'mes', 'madurez_mes', 6, 'Cohortes mensuales', 48),
        cohortes(id, 'co-cohortes-semana-tabla', 'semana', 'madurez_semana', 8, 'Cohortes semanales', 58),
      ],
    };
  },
};

/**
 * La galería de «Nueva hoja», en orden. Marketing y Comercial son las del informe inicial; el resto
 * se arma con los conjuntos del catálogo.
 */
export const PLANTILLAS_HOJA: readonly PlantillaHoja[] = [MARKETING, COMERCIAL, ...PLANTILLAS_ANALYSTS, ...PLANTILLAS_GENERALES];

/**
 * Las plantillas que se fueron, y la que las reemplaza (v5): la general «WhatsApp y MaKo» es Chat Analyst y
 * «Customer Success» es CS Analyst. AGENTS.md, «Sacar algo de un catálogo no es borrarlo»: un link, un agente de
 * la API o un marcador que nombre la vieja llega a la nueva, y el salto se resuelve ACÁ, por donde pasan todos.
 */
const PLANTILLAS_REEMPLAZADAS: ReadonlyMap<string, string> = new Map([['whatsapp', 'chat-analyst'], ['customer-success', 'cs-analyst']]);

export const plantillaHojaDe = (id: string) => {
  const vigente = PLANTILLAS_REEMPLAZADAS.get(id) ?? id;
  return PLANTILLAS_HOJA.find((p) => p.id === vigente);
};

/** Una hoja de la galería con ids NUEVOS (la hoja y cada componente y control): se puede agregar dos veces. */
export function instanciarPlantilla(p: PlantillaHoja): Hoja {
  const ids = new Map<string, string>();
  const id = (local: string) => { if (!ids.has(local)) ids.set(local, nuevoId()); return ids.get(local)!; };
  return sanearHoja({ ...p.armar(id), plantilla: p.id }, 0)!;
}

/** La hoja de una plantilla con sus ids FIJOS (los del informe inicial). */
function fija(p: PlantillaHoja): Hoja {
  return sanearHoja({ ...p.armar((local) => local), plantilla: p.id }, 0)!;
}

/**
 * El informe con el que arranca quien nunca armó el suyo: las dos tabs viejas, Marketing y Comercial,
 * rearmadas como hojas en el mismo orden y lugar, y con el filtro de fecha arriba.
 */
export function tableroInicial(): Tablero {
  return { v: 3, nombre: NOMBRE_INICIAL, hojas: [fija(MARKETING), fija(COMERCIAL)] };
}

/** Los componentes de una plantilla (para los tests y el modal). */
export const componentesDe = (p: PlantillaHoja): Componente[] => fija(p).componentes;

/**
 * Un pop-up NUEVO de la plantilla de esa entidad («Llamada», «Anuncio»), con ids nuevos y saneado como lo que va
 * adentro de un gráfico: lo que trae «Abrir un pop-up» en el panel. `null` = esa entidad no tiene plantilla (un
 * lead): quien lo pide arma el suyo (la ficha entera).
 */
export function popupDeEntidad(tipo: string | null | undefined): { titulo: string; componentes: Componente[] } | null {
  const p = tipo === 'llamada' || tipo === 'anuncio' ? PLANTILLAS_POPUP[tipo] : null;
  if (!p) return null;
  const ids = new Map<string, string>();
  const crudo = p.armar((local) => { if (!ids.has(local)) ids.set(local, nuevoId()); return ids.get(local)!; });
  const componentes = crudo.componentes.map((c) => sanearComponente(c, { enPopup: true })).filter((c): c is Componente => c != null);
  return { titulo: crudo.titulo, componentes };
}

// ── A dónde lleva `?hoja=` (C2) ─────────────────────────────────────────────────────────────────
// Los links a una hoja nombran la PLANTILLA: /closing → `?hoja=closing`, /ads-analyst →
// `?hoja=ads-analyst`, /productivity-analyst → `?hoja=productividad`, /vsl-analyst → `?hoja=vsl-analyst`
// (v5), y lo mismo /marketing y /comercial. Hasta el 11/10/2026 page.tsx buscaba `h.id === hoja` y, si no
// estaba, caía en la primera hoja SIN AVISAR: una hoja agregada desde «Nueva hoja» nace con ids nuevos, así
// que a quien la había armado así el link de su tab vieja lo dejaba en Marketing.

/**
 * El RESPALDO para reconocer una hoja que no dice de qué plantilla nació: los ids fijos del informe inicial
 * (una hoja guardada antes de v5 no tiene `plantilla`; renombrada, todavía tiene sus componentes). Alcanza con
 * UNO. Hasta v5 la firma de las de Analysts era un BLOQUE exclusivo; los bloques se fueron y la migración del
 * saneo le pone `plantilla` a la hoja que los traía (lib/graficos-migrar-v5.ts), así que ya no hace falta.
 */
export type FirmaHoja = { ids: readonly string[] };
const FIRMAS: Readonly<Record<string, FirmaHoja>> = {
  marketing: { ids: ['marketing', 'mk-spend', 'mk-funnel', 'mk-tendencias', 'mk-anuncios'] },
  comercial: { ids: ['comercial', 'co-revenue-barra', 'co-cobranza-tabla', 'co-funnel-embudo', 'co-tendencia'] },
};
/** La firma de una plantilla, para los tests. */
export const firmaDe = (plantillaId: string): FirmaHoja | undefined => FIRMAS[plantillaId];

const calzaFirma = (h: Hoja, f: FirmaHoja): boolean => f.ids.includes(h.id) || h.componentes.some((c) => f.ids.includes(c.id));

/** Los componentes de una hoja y los de sus pop-ups. */
function todosLosComponentes(h: Hoja): Componente[] {
  return h.componentes.flatMap((c) => (esGrafico(c) && c.popup ? [c, ...c.popup.componentes] : [c]));
}

/** Los ids de todo lo que tiene id en el informe (componentes, los de los pop-ups, controles de la hoja y de cada uno). */
function idsDe(t: Tablero): Set<string> {
  const ids = new Set<string>();
  for (const h of t.hojas) {
    for (const k of h.controles) ids.add(k.id);
    for (const c of todosLosComponentes(h)) {
      ids.add(c.id);
      if (!esElemento(c)) for (const k of c.controles) ids.add(k.id);
    }
  }
  return ids;
}

/**
 * La hoja con cada id pasado por `libre`, y lo que NOMBRA un id (lo que lee una caja de IA, las puntas de un
 * conector) pasado por la MISMA función: un id renombrado y la referencia a él tienen que seguir juntos.
 */
function conIdsLibres(h: Hoja, libre: (id: string) => string): Hoja {
  const componente = (c: Componente): Componente => {
    if (esElemento(c)) return c.ia?.fuentes ? { ...c, id: libre(c.id), ia: { ...c.ia, fuentes: c.ia.fuentes.map(libre) } } : { ...c, id: libre(c.id) };
    const base = { ...c, id: libre(c.id), controles: c.controles.map((k) => ({ ...k, id: libre(k.id) })) };
    return (esGrafico(c) && c.popup ? { ...base, popup: { ...c.popup, componentes: c.popup.componentes.map(componente) } } : base) as Componente;
  };
  return {
    ...h,
    controles: h.controles.map((k) => ({ ...k, id: libre(k.id) })),
    componentes: h.componentes.map(componente),
    ...(h.conectores ? { conectores: h.conectores.map((k) => ({ ...k, desde: libre(k.desde), hasta: libre(k.hasta) })) } : {}),
  };
}

/**
 * La plantilla armada con sus ids FIJOS para agregarla a ESTE informe. La hoja conserva su id (es
 * lo que nombra el link, y así el próximo `?hoja=` la encuentra por el paso 1). Un componente o un
 * control cuyo id ya usa otra hoja se acuña de nuevo: las plantillas generales repiten nombres
 * locales (`por-dia` está en tres) y con el mismo id lo elegido mirando en una hoja se vería en la
 * otra, y los datos de una se pintarían un instante en la otra (los dos se guardan por id).
 */
function paraAgregar(t: Tablero, p: PlantillaHoja): Hoja {
  const h = fija(p);
  const usados = idsDe(t);
  const nuevos = new Map<string, string>();
  const libre = (id: string) => {
    if (!usados.has(id)) return id;
    if (!nuevos.has(id)) nuevos.set(id, nuevoId());
    return nuevos.get(id)!;
  };
  return conIdsLibres(h, libre);
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
 *   1. la que tiene ese id exacto (o el id de la plantilla que reemplazó a la pedida);
 *   2. si el pedido es una plantilla, la primera hoja que NACIÓ de ella (`Hoja.plantilla`: la que se agregó
 *      desde «Nueva hoja», con ids nuevos, y la de un informe migrado);
 *   3. de respaldo, la primera con su FIRMA (Marketing y Comercial guardadas antes de v5);
 *   4. si es una plantilla y no está, la plantilla armada (`agregar`): la pantalla la AGREGA al
 *      informe y se guarda, porque la persona fue a buscarla (EditorInforme.tsx, con un toast).
 * Un pedido que no es ni una hoja ni una plantilla abre la primera hoja.
 */
export function hojaDestino(t: Tablero, pedido: string | null | undefined): DestinoHoja {
  const p = typeof pedido === 'string' ? pedido.trim() : '';
  if (!p) return { hojaId: null, agregar: null };
  if (t.hojas.some((h) => h.id === p)) return { hojaId: p, agregar: null };
  const plantilla = plantillaHojaDe(p);
  if (!plantilla) return { hojaId: null, agregar: null };
  if (plantilla.id !== p && t.hojas.some((h) => h.id === plantilla.id)) return { hojaId: plantilla.id, agregar: null };
  const nacida = t.hojas.find((h) => h.plantilla === plantilla.id);
  if (nacida) return { hojaId: nacida.id, agregar: null };
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

// ── La hoja ÚNICA de un rol: el closer ve Closing, el setter ve Chat Analyst (C3 y v5) ───────────
// Decisión 6 de Martín (11/10/2026): «Los closers ven SÓLO la hoja Closing del Dashboard (no editan el
// informe, no ven otras hojas)», y la de la tanda v5: «El setter ve SÓLO la hoja Chat Analyst (como el
// closer con Closing), con los números del equipo». La pantalla le arma este informe EN MEMORIA (nunca se
// guarda) y /api/graficos le contesta sólo lo que su hoja pide. ⚠️ Esconder el resto en la pantalla no
// protege nada (AGENTS.md, «Un flag de visibilidad protege la PANTALLA»): las listas de abajo son las que usa
// el SERVER, y el test cruza que cada hoja no pida nada fuera de ellas.

/** Los conjuntos que un closer puede leer: las llamadas. Ni la plata, ni los leads, ni la pauta. */
export const CLOSER_CONJUNTOS: readonly string[] = ['llamadas', 'llamadas_venta', 'llamadas_dimensiones'];
/** Los del setter: los mensajes, las conversaciones y las automatizaciones. Ni la plata, ni las llamadas, ni MaKo. */
export const SETTER_CONJUNTOS: readonly string[] = ['whatsapp', 'conversaciones', 'envios', 'inscripciones'];

export type HojaDeRol = {
  /** La plantilla que ve (con sus ids fijos). */
  plantilla: string;
  /** La key de la capa que su negocio tiene que haber comprado (`tabEnCapa`): si no, la hoja no es para él. */
  capa: string;
  /** Los ÚNICOS conjuntos que el server le lee. EN POSITIVO: uno nuevo nace cerrado. */
  conjuntos: readonly string[];
  /** El 403 de lo que no es de su hoja. */
  error: string;
  nombre: string;
};

/** EN POSITIVO: un rol que no está acá (el admin) no tiene hoja única; uno nuevo nace sin Dashboard. */
export const HOJA_DE_ROL: Readonly<Partial<Record<RolWorkspace, HojaDeRol>>> = {
  closer: { plantilla: 'closing', capa: 'closing', conjuntos: CLOSER_CONJUNTOS, error: 'Sólo la hoja Closing', nombre: 'Closing' },
  setter: { plantilla: 'chat-analyst', capa: 'whatsapp', conjuntos: SETTER_CONJUNTOS, error: 'Sólo la hoja Chat Analyst', nombre: 'Chat Analyst' },
};

/** La hoja única de un rol, o null (el admin, o un rol sin Dashboard). */
export const hojaDeRol = (rol: unknown): HojaDeRol | null =>
  (typeof rol === 'string' && Object.prototype.hasOwnProperty.call(HOJA_DE_ROL, rol) ? HOJA_DE_ROL[rol as RolWorkspace] ?? null : null);

/** El informe de un rol con hoja única: su plantilla con los ids fijos (sin guardar, lo elegido mirando no se pierde al recargar). */
export function informeDeRol(rol: unknown): Tablero | null {
  const u = hojaDeRol(rol);
  if (!u) return null;
  const p = plantillaHojaDe(u.plantilla);
  // Un informe sin hojas rompe la pantalla (todo lee `hojas[0]`): sin la plantilla, una hoja vacía.
  return { v: 3, nombre: NOMBRE_INICIAL, hojas: [p ? fija(p) : hojaVacia(u.nombre)] };
}

/**
 * Los conjuntos de la hoja de un rol donde puede pedir los valores de un campo (el desplegable de un filtro),
 * recortados a los que pidió la pantalla. Vacío = ese campo no es de su hoja: 403. «Closer» también está en los
 * leads, y por ahí no pasa.
 */
export function fuentesDeCampoDeRol(rol: unknown, campoId: unknown, pedidas?: unknown): string[] {
  const u = hojaDeRol(rol);
  const c = campoDe(typeof campoId === 'string' ? campoId : '');
  if (!u || !c) return [];
  const propias = Object.keys(c.en).filter((f) => u.conjuntos.includes(f));
  if (!Array.isArray(pedidas)) return propias;
  const p = pedidas.map(String);
  return propias.filter((f) => p.includes(f));
}

/**
 * ¿Este rol puede hacer este pedido a /api/graficos? El admin, todo. Un rol con hoja única: `datos` de sus
 * conjuntos y `valores` de un campo de su hoja. Guardar, el detalle de un número, los bloques (ya no existen) y
 * todo lo demás, no. EN POSITIVO: una acción nueva de la ruta nace cerrada para él.
 * Un pedido de la lista que no se entiende cierra la lista entera: su pantalla no los arma.
 */
export function puedePedir(rol: unknown, body: unknown): boolean {
  if (rol === 'admin') return true;
  const u = hojaDeRol(rol);
  if (!u || !body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  const lista = (v: unknown): Array<Record<string, unknown> | null> => (Array.isArray(v) ? v : []);
  if (b.accion === 'datos') {
    return lista(b.pedidos).every((p) => {
      const g = sanearGrafico(p?.grafico);
      return !!g && u.conjuntos.includes(g.fuente);
    });
  }
  if (b.accion === 'valores') return fuentesDeCampoDeRol(rol, b.campo, b.fuentes).length > 0;
  return false;
}

// Los nombres de antes (C3), del closer: los usan la ruta de las cajas de IA y los tests.
/** @deprecated v5: `informeDeRol('closer')`. */
export const informeCloser = (): Tablero => informeDeRol('closer')!;
/** @deprecated v5: `fuentesDeCampoDeRol('closer', …)`. */
export const fuentesDeCampoCloser = (campoId: unknown, pedidas?: unknown): string[] => fuentesDeCampoDeRol('closer', campoId, pedidas);
/** @deprecated v5: `puedePedir('closer', …)`. */
export const closerPuedePedir = (body: unknown): boolean => puedePedir('closer', body);
