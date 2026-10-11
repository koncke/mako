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

import {
  NOMBRE_INICIAL, nuevoId, sanearHoja,
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
      // 4 · Salud del funnel comercial: las cohortes maduras
      { id: id('co-funnel'), clase: 'bloque', bloque: 'funnel_maduro', x: 0, y: 27, w: 12, h: 12 },
      // 5 · SCL — el ciclo de venta
      { id: id('co-scl'), clase: 'bloque', bloque: 'scl', x: 0, y: 39, w: 12, h: 8 },
      // 6 · Las cohortes
      { id: id('co-cohortes-mes'), clase: 'bloque', bloque: 'cohortes_mes', x: 0, y: 47, w: 12, h: 10 },
      { id: id('co-cohortes-semana'), clase: 'bloque', bloque: 'cohortes_semana', x: 0, y: 57, w: 12, h: 10 },
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
