// =============================================================================
// graficos-plantillas-analysts — las tabs de Analysts como plantillas del Dashboard (puntos 21 y 22)
// =============================================================================
// Martín, 11/10/2026: «Implementa como TEMPLATE, y en el caso de Mauricio, como tabs, todas las tabs
// de la sidebar en la sección de "analysts". Excepto las partes donde se ejecuta tareas, no análisis...
// Pero si puedes poner un template de landing con la cantidad de datos que tenemos, de clicks,
// retención, mapa de calor, grabaciones, etc...».
//
// Una hoja por analista: «Ads Analyst», «Landing», «Closing», «Productividad» y, desde la tanda v5
// (12/10/2026, punto 22: «elimina por completo el desplegable de la sidebar principal de "analysts"»),
// «VSL Analyst», «CS Analyst» y «Chat Analyst». Las tres nuevas reemplazan a las rutas que eran ComingSoon
// (/vsl-analyst, /cs-analyst) o una pantalla suelta (/chat-analyst): esas rutas redirigen a `/dashboard?hoja=<id>`.
//
// Las TAREAS se mudaron el 11/10/2026 (decisiones de Martín), y no todas al mismo lugar:
//   · Ads Analyst → a Ads Writer (analizar un guion nuevo, sincronizar, ángulos y avatares). Su hoja mira.
//   · Landing Analyst → a Landing Generator (analizar o pegar una página). Su hoja mira.
//   · Closing va COMPLETO a su hoja: el elemento «Acción» sincroniza las llamadas, y el pop-up «Llamada» de
//     cada fila revisa a mano y re-analiza (admin y closer, como la tab; las rutas lo vuelven a mirar:
//     app/api/closing/puerta.ts).
//
// ⚠️ TANDA v5: SIN BLOQUES. Cada bloque de antes es un gráfico o un elemento del catálogo, con la receta de
//    «Los bloques se van» del contrato (docs/relevo/dashboard-v5.md). Los IDS son los MISMOS que le pone la
//    migración del saneo (lib/graficos-migrar-v5.ts, `idDeParte(<bloque>, <parte>)`) a un informe guardado de
//    antes: así la hoja de una plantilla nueva y la de un informe migrado (el de Mauricio, ws1) tienen las
//    mismas piezas con el mismo id. Importa por la caja de IA de Closing: el closer lee la hoja EN MEMORIA
//    (`informeDeRol`, lib/graficos-plantillas.ts) y la caja de la CUENTA por (hoja, elemento) —la que generó el
//    admin en su informe— (lib/graficos-ia-elemento-server.ts). Con otro id, el closer no vería nunca las
//    conclusiones que su admin ya generó.
// ⚠️ LO QUE DEFINE UNA TARJETA va como filtro `fijo` (R1/R2, «Sin agendas», «Muestra chica», «Activo»,
//    «Entrega del servicio»): no se dibuja ni lo mueve la vista. El período propio (Tendencia del score, la
//    deuda) también va como control `periodo` fijo, que es lo que el saneo haría con un `periodo` suelto: escrito
//    así, la plantilla ES lo que se guarda.
// ⚠️ Ads Analyst y Closing van con el período «Todo» porque sus tabs eran el HISTÓRICO COMPLETO: con los 30
//    días de siempre la hoja mostraría otros números que la tab sin decirlo.
// ⚠️ Los ids locales van con guiones y sin guion bajo: armados con ids FIJOS (`armar((l) => l)`) tienen que
//    pasar `idValido` (lib/graficos-catalogo.ts, hasta 40).
// ⚠️ Puro y sin server-only. Y SIN datos de ningún cliente (un ejemplo de pantalla es ficticio por regla).
//
// LAS PLANTILLAS DE POP-UP («Llamada» y «Anuncio», punto 7 del contrato) viven acá y no en
// lib/graficos-plantillas.ts porque las usan estas hojas: aquel archivo importa éste (un import de valor de
// vuelta armaría un ciclo). Las reexporta lib/graficos-plantillas.ts.

import type { PlantillaHoja } from './graficos-plantillas';

type Id = (local: string) => string;
type Crudo = Record<string, unknown>;

const kpi = (id: string, fuente: string, metrica: string, titulo: string, subtitulo: string, x: number, y: number, extra: Crudo = {}): Crudo =>
  ({ id, clase: 'grafico', tipo: 'numero', fuente, metricas: [metrica], titulo, subtitulo, x, y, w: 3, h: 4, ...extra });
const lista = (id: string, campo: string): Crudo => ({ id, tipo: 'lista', campo, valores: null });
/** Un filtro de DEFINICIÓN (v5): la tarjeta ES eso. No se dibuja ni lo mueve la vista (`ControlVista.fijo`). */
const fijo = (id: string, campo: string, valores: string[]): Crudo => ({ id, tipo: 'lista', campo, valores, fijo: true });
/** El período propio de un gráfico, como control fijo (lo mismo que el saneo hace con un `periodo` suelto). */
const periodoFijo = (id: string, preset: string): Crudo => ({ id, tipo: 'periodo', preset, fijo: true });
/**
 * El período propio de un gráfico, A LA VISTA: la tarjeta lo muestra en su «Filtro» y quien mira lo mueve. Lo
 * usan el Outstanding y «A quién cobrarle», que miran hacia ADELANTE (decisión de la tanda v5: «con un período
 * explícito… las plantillas los usan a la vista»).
 */
const periodoVisible = (id: string, preset: string): Crudo => ({ id, tipo: 'periodo', preset });

/** Una caja de «Conclusiones de MaKo». Corre a mano o con horario, NUNCA al abrir la hoja. */
const caja = (id: string, titulo: string, pedido: string, x: number, y: number, w: number, h: number, extra: Crudo = {}): Crudo => ({
  id, clase: 'elemento', tipo: 'ia', texto: titulo, x, y, w, h,
  ia: { pedido, fuentes: null, vista: 'hallazgos', largo: 'medio', formato: 'tarjetas', lee: 'hoja', cron: null, ...extra },
});
/** Un botón de ACCIONES_ELEMENTO (lib/graficos-acciones.ts). */
const accion = (id: string, accionId: string, rotulo: string, x: number, y: number, w: number, h: number): Crudo =>
  ({ id, clase: 'elemento', tipo: 'accion', texto: '', accion: { id: accionId, rotulo }, x, y, w, h });
/** Una pieza de la ficha de lo que se abrió (PIEZAS_ENTIDAD, lib/graficos-acciones.ts). Sólo adentro de un pop-up. */
const pieza = (id: string, tipo: 'llamada' | 'anuncio', p: string, x: number, y: number, w: number, h: number): Crudo =>
  ({ id, clase: 'elemento', tipo: 'entidad', texto: '', entidad: { tipo, pieza: p }, x, y, w, h });

// ── Las plantillas de POP-UP ─────────────────────────────────────────────────────────────────
// Lo que abre un clic en una llamada o en un anuncio: la ficha de hoy partida en piezas, para que se pueda
// sacar, mover o sumar una (contrato v5, «Pop-up = mini-hoja»). La de la llamada es la FichaLlamada (cabecera,
// grabación y resumen, el análisis, los momentos, el transcript y las tareas de su pie); la del anuncio, el
// AdDetailTabs (creativo, números, rendimiento diario, guion, diagnóstico, audiencia, transcript). Cada una
// suma UNA caja de IA que lee lo abierto (decisión 3 de Martín: la del pop-up de una llamada lee el
// transcript, gratis), que corre sólo a mano.

/** Una plantilla de pop-up: el título y la mini-hoja, con los ids que le pasan (fijos o nuevos). */
export type PlantillaPopup = {
  id: 'llamada' | 'anuncio';
  nombre: string;
  armar: (id: Id) => { titulo: string; componentes: Crudo[] };
};

export const POPUP_LLAMADA: PlantillaPopup = {
  id: 'llamada', nombre: 'Llamada',
  armar: (id) => ({
    titulo: 'Llamada',
    componentes: [
      pieza(id('cabecera'), 'llamada', 'cabecera', 0, 0, 8, 3),
      accion(id('revisar'), 'revisar_llamada', 'Revisar', 8, 0, 2, 3),
      accion(id('reanalizar'), 'reanalizar_llamada', 'Re-analizar', 10, 0, 2, 3),
      pieza(id('grabacion'), 'llamada', 'reproductor', 0, 3, 7, 9),
      pieza(id('resumen'), 'llamada', 'resumen', 7, 3, 5, 9),
      pieza(id('proximo'), 'llamada', 'proximo_paso', 0, 12, 6, 5),
      caja(id('mejorar'), 'Qué mejorar', 'Qué hizo bien el closer, qué le faltó y qué decir en la próxima llamada', 6, 12, 6, 5,
        { lee: 'entidad', vista: 'recomendaciones', largo: 'corto', formato: 'vinetas' }),
      pieza(id('dimensiones'), 'llamada', 'dimensiones', 0, 17, 6, 10),
      pieza(id('fortalezas'), 'llamada', 'fortalezas', 6, 17, 6, 10),
      pieza(id('objeciones'), 'llamada', 'objeciones', 0, 27, 6, 8),
      pieza(id('coaching'), 'llamada', 'coaching', 6, 27, 6, 8),
      pieza(id('momentos'), 'llamada', 'momentos', 0, 35, 12, 8),
      pieza(id('transcript'), 'llamada', 'transcript', 0, 43, 12, 12),
    ],
  }),
};

export const POPUP_ANUNCIO: PlantillaPopup = {
  id: 'anuncio', nombre: 'Anuncio',
  armar: (id) => ({
    titulo: 'Anuncio',
    componentes: [
      pieza(id('creativo'), 'anuncio', 'creativo', 0, 0, 4, 12),
      pieza(id('numeros'), 'anuncio', 'numeros', 4, 0, 8, 4),
      pieza(id('diario'), 'anuncio', 'diario', 4, 4, 8, 8),
      pieza(id('guion'), 'anuncio', 'guion', 0, 12, 6, 10),
      pieza(id('diagnostico'), 'anuncio', 'diagnostico', 6, 12, 6, 10),
      caja(id('cambiar'), 'Qué cambiar', 'Qué frena a este anuncio y qué probar en el próximo', 0, 22, 12, 5,
        { lee: 'entidad', vista: 'recomendaciones', largo: 'corto', formato: 'vinetas' }),
      pieza(id('audiencia'), 'anuncio', 'audiencia', 0, 27, 12, 10),
      pieza(id('transcript'), 'anuncio', 'transcript', 0, 37, 12, 10),
    ],
  }),
};

/** Las plantillas de pop-up, por la entidad que abren. */
export const PLANTILLAS_POPUP: Readonly<Record<'llamada' | 'anuncio', PlantillaPopup>> = { llamada: POPUP_LLAMADA, anuncio: POPUP_ANUNCIO };

/** El pop-up de una plantilla con los ids `<base>-<local>` (el gráfico dueño + la pieza). */
const popupDe = (p: PlantillaPopup, id: Id, base: string) => p.armar((l) => id(`${base}-${l}`));

/**
 * Las piezas con las que se arma una plantilla, para lib/graficos-plantillas.ts (Marketing y Comercial): UNA
 * forma de escribir un número, un filtro fijo o un período, no dos copias que se separan.
 */
export const ARMADO = { kpi, lista, fijo, periodoFijo, periodoVisible, caja, accion, popupDe } as const;

// ── Ads Analyst ──────────────────────────────────────────────────────────────────────────────

const ADS: PlantillaHoja = {
  id: 'ads-analyst', nombre: 'Ads Analyst', emoji: '🎬',
  linea: 'Hook rate, retención y veredicto de cada guion, sus patrones y el cuadrante de retención.',
  armar: (id: Id) => ({
    id: id('ads-analyst'), nombre: 'Ads Analyst', emoji: '🎬', subtitulo: 'Los guiones de tus anuncios: qué frena, qué retiene y qué agenda.',
    controles: [
      { id: id('ad-periodo'), tipo: 'periodo', preset: 'todo' },
      lista(id('ad-angulo'), 'guiones.angulo'),
      lista(id('ad-tipo'), 'guiones.tipo'),
    ],
    componentes: [
      // COMPOSICIÓN DEL 31/10/2026: el hook rate primero porque la hoja pregunta «¿mi creativo retiene?». La caja de MaKo va después de
      // lo que resume: nace sin correr, y arriba tapaba la pregunta.
      kpi(id('ad-hook'), 'guiones', 'hook_rate', 'Hook rate', '', 0, 0, { tipo: 'numero_tendencia', invertida: true }),
      kpi(id('ad-guiones'), 'guiones', 'guiones', 'Guiones analizados', '', 3, 0, { tipo: 'numero_tendencia' }),
      kpi(id('ad-cpa'), 'guiones', 'cpa', 'Costo por agenda', '', 6, 0, { tipo: 'numero_tendencia' }),
      kpi(id('ad-sin-retorno'), 'guiones', 'gasto', 'Gasto sin retorno', '', 9, 0, {
        tipo: 'numero_tendencia', controles: [fijo(id('ad-sin-retorno-c'), 'guiones.resultado', ['Sin agendas'])],
      }),
      // Qué retiene: el cuadrante dice CUÁLES, los cuartiles dicen DÓNDE se cae todo el mundo.
      {
        id: id('ad-cuadrante-dispersion'), clase: 'grafico', tipo: 'dispersion', fuente: 'guiones', dimension: 'guion', metricas: ['hook_rate', 'ret_cta'],
        titulo: 'Cuadrante de retención', colorPor: 'angulo', limite: 50, x: 0, y: 4, w: 6, h: 12,
        ejes: { xMin: 0, xMax: 55, yMin: 0, yMax: 30 },
        // [arriba-izq, arriba-der, abajo-izq, abajo-der] con x = hook rate, y = retención al CTA (los de la tab).
        referencias: { x: 28, y: 10, rotulos: ['Mejorar gancho', 'Escalar', 'Repensar', 'Reescribir cuerpo'] },
        alClic: 'popup', popup: popupDe(POPUP_ANUNCIO, id, 'ad-cuadrante-dispersion'),
      },
      { id: id('ad-video'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'guiones', metricas: ['plays_3s', 'p25', 'p50', 'p75', 'p100'], titulo: 'Cuánto ven el video', x: 6, y: 4, w: 6, h: 12 },
      // Qué patrón gana
      { id: id('ad-eficiencia'), clase: 'grafico', tipo: 'barras', fuente: 'guiones', dimension: 'angulo', metricas: ['agendas_1k'], titulo: 'Agendas por US$1.000', x: 0, y: 16, w: 6, h: 9 },
      { id: id('ad-gancho'), clase: 'grafico', tipo: 'barras', fuente: 'guiones', dimension: 'gancho', metricas: ['hook_rate'], titulo: 'Hook rate por gancho', x: 6, y: 16, w: 6, h: 9 },
      // Los patrones de la tab (Sigue / Corta / Proceso) son una caja de MaKo (contrato v5, «patrones_guiones»).
      caja(id('ad-patrones-ia'), 'Patrones de tus guiones', 'Qué patrones separan a los guiones que agendan de los que no', 0, 25, 12, 8),
      // Todos los guiones, como TARJETAS (la GuionCard de la tab): 4 números, la barra en el hook y los chips. La confianza va en
      // un chip: era la tabla «Muestra chica», que repetía guiones con un filtro.
      {
        id: id('ad-tabla'), clase: 'grafico', tipo: 'tarjetas', fuente: 'guiones', dimension: 'guion',
        metricas: ['agendas', 'hook_rate', 'retencion_final', 'cpa'], ordenMetrica: 'agendas', barra: 'hook_rate', limite: 50,
        tabla: { columnas: ['angulo', 'veredicto', 'confianza'] },
        titulo: 'Guiones', x: 0, y: 33, w: 12, h: 16,
        alClic: 'popup', popup: popupDe(POPUP_ANUNCIO, id, 'ad-tabla'),
      },
    ],
  }),
};

// ── Landing ──────────────────────────────────────────────────────────────────────────────────

const LANDING: PlantillaHoja = {
  id: 'landing', nombre: 'Landing', emoji: '🧭', buscar: 'Landing Analyst',
  linea: 'Visitas, de dónde llegan, scroll, clics, mapa de calor, grabaciones y el diagnóstico.',
  armar: (id: Id) => ({
    id: id('landing'), nombre: 'Landing', emoji: '🧭', subtitulo: 'Lo que mide tu Pixel: cuánta gente entra, hasta dónde baja y qué toca.',
    controles: [
      { id: id('la-periodo'), tipo: 'periodo', preset: 'ult30' },
      lista(id('la-pagina'), 'pagina'),
    ],
    componentes: [
      // COMPOSICIÓN DEL 31/10/2026: entran, bajan, tocan. El mapa de calor sube a portada (lib/graficos-portadas.ts). Lo de fondo va en
      // una sección plegada: 400 px de grabaciones no compiten con la pregunta de la hoja, y «lo plegado sale de la grilla».
      kpi(id('la-visitas'), 'visitas', 'visitas', 'Visitas', '', 0, 0, { tipo: 'numero_tendencia', comparar: true, invertida: true }),
      kpi(id('la-personas'), 'visitas', 'visitantes', 'Personas distintas', '', 3, 0, { tipo: 'numero_tendencia' }),
      kpi(id('la-mitad-pagina'), 'scroll', 'pct_50', 'Llegan a la mitad', '', 6, 0, { tipo: 'numero_tendencia' }),
      kpi(id('la-tocan'), 'clics', 'personas', 'Tocan un botón', '', 9, 0, { tipo: 'numero_tendencia' }),
      { id: id('la-mapa-mapa'), clase: 'grafico', tipo: 'mapa_calor', fuente: 'toques', metricas: ['toques'], titulo: 'Mapa de calor', x: 0, y: 4, w: 12, h: 24 },
      {
        id: id('la-visitas-dia'), clase: 'grafico', tipo: 'serie', fuente: 'visitas', dimension: 'dia', metricas: ['visitas', 'visitantes'],
        titulo: 'Visitas por día', x: 0, y: 28, w: 8, h: 9, controles: [{ id: id('la-visitas-agrupar'), tipo: 'agrupar', agrupar: 'auto' }],
      },
      { id: id('la-origen'), clase: 'grafico', tipo: 'barras', fuente: 'visitas', dimension: 'origen', metricas: ['visitas'], limite: 10, titulo: 'De dónde llegan', x: 8, y: 28, w: 4, h: 9 },
      { id: id('la-scroll'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'scroll', metricas: ['medidos', 'llegaron_25', 'llegaron_50', 'llegaron_75', 'llegaron_100'], titulo: 'Hasta dónde bajan', x: 0, y: 37, w: 5, h: 10 },
      { id: id('la-clics'), clase: 'grafico', tipo: 'barras', fuente: 'clics', dimension: 'destino', metricas: ['clics'], ordenMetrica: 'clics', limite: 10, titulo: 'Qué botón tocan', x: 5, y: 37, w: 7, h: 10 },
      { id: id('la-grab-pagina'), clase: 'grafico', tipo: 'tabla_barras', fuente: 'replays', dimension: 'pagina', metricas: ['grabaciones', 'duracion', 'visitantes'], barra: 'grabaciones', titulo: 'Grabaciones por página', x: 0, y: 48, w: 12, h: 8 },
      // El diagnóstico que MaKo guardó de cada página (analizar es una tarea: vive en Landing Generator).
      { id: id('la-diagnostico'), clase: 'grafico', tipo: 'barras', fuente: 'landing_analisis', fecha: 'actual', dimension: 'pagina', metricas: ['puntaje'], ordenMetrica: 'puntaje', titulo: 'Diagnóstico de cada página', x: 0, y: 56, w: 12, h: 8 },
    ],
  }),
};

// ── Closing ──────────────────────────────────────────────────────────────────────────────────

const CLOSING: PlantillaHoja = {
  id: 'closing', nombre: 'Closing', emoji: '📞', buscar: 'Closing Analyst',
  linea: 'El puntaje de tus llamadas, el embudo R1 → R2 → cierre, los factores, los closers y cada llamada.',
  armar: (id: Id) => ({
    id: id('closing'), nombre: 'Closing', emoji: '📞', subtitulo: 'Las llamadas de venta analizadas: qué decide tus cierres.',
    controles: [
      { id: id('cl-periodo'), tipo: 'periodo', preset: 'todo' },
      lista(id('cl-closer'), 'closer'),
    ],
    componentes: [
      // COMPOSICIÓN DEL 31/10/2026 (13 piezas → 10): cuatro números iguales, con la tasa de cierre primero porque es lo que la
      // hoja pregunta. R1 y R2 eran el mismo puntaje con un filtro, y el cruce closer × dimensión vuelve con un clic en la tabla.
      kpi(id('cl-tasa'), 'llamadas_venta', 'tasa_cierre', 'Tasa de cierre', '', 0, 0, { tipo: 'numero_tendencia', invertida: true }),
      kpi(id('cl-puntaje'), 'llamadas_venta', 'puntaje', 'Score promedio', '', 3, 0, { tipo: 'numero_tendencia' }),
      kpi(id('cl-analizadas'), 'llamadas_venta', 'llamadas', 'Analizadas', '', 6, 0, { tipo: 'numero_tendencia' }),
      kpi(id('cl-duracion'), 'llamadas_venta', 'duracion', 'Duración', '', 9, 0, { tipo: 'numero_tendencia' }),
      // El embudo (sube a portada: lib/graficos-portadas.ts) y lo que separa las ganadas de las perdidas.
      {
        id: id('cl-embudo-embudo'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'llamadas_venta', metricas: ['r1', 'r2', 'ganadas_r2'],
        titulo: 'Embudo de llamadas', subtitulo: 'Cuenta llamadas, no personas', x: 0, y: 4, w: 6, h: 10,
      },
      {
        id: id('cl-factores-barras'), clase: 'grafico', tipo: 'barras', fuente: 'llamadas_dimensiones', dimension: 'dimension', desglose: 'tono',
        metricas: ['puntaje'], titulo: 'Factores del cierre', x: 6, y: 4, w: 6, h: 10,
      },
      caja(id('cl-factores-ia'), 'Qué decide tus cierres', 'Qué decide los cierres: qué hacen distinto las llamadas ganadas', 0, 14, 12, 7,
        { fuentes: [id('cl-factores-barras')], largo: 'corto', formato: 'vinetas' }),
      // El equipo
      {
        id: id('cl-closers-tabla'), clase: 'grafico', tipo: 'tabla', fuente: 'llamadas_venta', dimension: 'closer', metricas: ['llamadas', 'puntaje', 'ganadas', 'tasa_cierre'],
        titulo: 'El equipo de closers', x: 0, y: 21, w: 12, h: 10,
      },
      // 5 · Las llamadas: traer las nuevas (el cron de siempre y este botón) y la lista, con su búsqueda y el
      //     pop-up «Llamada» (la ficha de cada una, con sus tareas).
      accion(id('cl-llamadas-sync'), 'sincronizar_llamadas', 'Sincronizar llamadas', 0, 31, 3, 2),
      {
        id: id('cl-llamadas-tabla'), clase: 'grafico', tipo: 'tabla', fuente: 'llamadas_venta', dimension: 'llamada', metricas: ['puntaje', 'duracion'],
        titulo: 'Las llamadas', limite: 50, x: 0, y: 33, w: 12, h: 16,
        tabla: { buscar: true, columnas: ['closer', 'reunion', 'dia'] },
        alClic: 'popup', popup: popupDe(POPUP_LLAMADA, id, 'cl-llamadas-tabla'),
      },
    ],
  }),
};

// ── Productividad ────────────────────────────────────────────────────────────────────────────

const PRODUCTIVIDAD: PlantillaHoja = {
  id: 'productividad', nombre: 'Productividad', emoji: '✅', buscar: 'Productivity Analyst',
  linea: 'Tus proyectos: avance, impacto × esfuerzo, pirámide de prioridad y lo que se estancó.',
  armar: (id: Id) => ({
    id: id('productividad'), nombre: 'Productividad', emoji: '✅', subtitulo: 'Lo que produjo tu tablero: qué hacer primero y qué huele mal.',
    // Sin período: todo es la foto de hoy del tablero. Por eso los números van como `numero`: `numero_tendencia` arma su línea
    // con el rango del período, y acá saldría plana en cero.
    controles: [],
    // COMPOSICIÓN DEL 31/10/2026 (15 piezas → 8): siete números en cuatro anchos pasan a una fila de cuatro, el avance por
    // proyecto es lo primero, y las tres tablas de 4 columnas (donde se cortaba el nombre de la tarea) son una sola a lo ancho.
    componentes: [
      kpi(id('pr-avance'), 'proyectos', 'avance_proyectos', 'Avance global', '', 0, 0, { invertida: true }),
      kpi(id('pr-estancadas'), 'ejecucion', 'estancadas', 'Estancadas', '', 3, 0),
      kpi(id('pr-alta-sin'), 'ejecucion', 'alta_sin_deadline', 'Alta sin deadline', '', 6, 0),
      kpi(id('pr-cumplimiento'), 'ejecucion', 'cumplimiento', 'A tiempo', '', 9, 0),
      // Una barra de avance por proyecto (la barra de progreso de la tab), los activos. Sube a portada: lib/graficos-portadas.ts.
      {
        id: id('pr-avance-proyecto'), clase: 'grafico', tipo: 'barras', fuente: 'proyectos', dimension: 'proyecto',
        metricas: ['avance_proyectos'], ordenMetrica: 'avance_proyectos', limite: 50,
        titulo: 'Avance por proyecto', x: 0, y: 4, w: 12, h: 10,
        controles: [fijo(id('pr-avance-estado'), 'proyectos.estado', ['Activo'])],
      },
      // ¿Qué hago primero? La matriz (burbujas con los cuadrantes de la tab) y la pirámide, del mismo alto.
      {
        id: id('pr-matriz-burbujas'), clase: 'grafico', tipo: 'burbujas', fuente: 'proyectos', dimension: 'proyecto', metricas: ['esfuerzo', 'impacto', 'tareas'],
        titulo: 'Impacto × Esfuerzo', colorPor: 'cuadrante', limite: 50, x: 0, y: 14, w: 6, h: 10,
        ejes: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
        // [arriba-izq, arriba-der, abajo-izq, abajo-der] con x = esfuerzo, y = impacto (los de la tab vieja).
        referencias: { x: 50, y: 50, rotulos: ['Quick wins', 'Apuestas', 'Relleno', 'Trampas'] },
      },
      {
        id: id('pr-piramide-barras'), clase: 'grafico', tipo: 'barras', fuente: 'ejecucion', dimension: 'prioridad', metricas: ['activas'],
        titulo: 'Pirámide de prioridad', x: 6, y: 14, w: 6, h: 10,
      },
      // ¿Qué huele mal? La misma lista con las tres columnas juntas: lo quieto arriba.
      {
        id: id('pr-huele-mal'), clase: 'grafico', tipo: 'tabla', fuente: 'ejecucion', dimension: 'tarea', metricas: ['dias_quieta', 'movidas_deadline', 'activas'],
        ordenMetrica: 'dias_quieta', limite: 20, titulo: 'Lo que huele mal', x: 0, y: 24, w: 12, h: 10,
        controles: [fijo(id('pr-huele-mal-f1'), 'ejecucion.estado', ['Activa'])],
      },
    ],
  }),
};

// ── VSL Analyst (v5, punto 22) ───────────────────────────────────────────────────────────────
// Todo sale del PIXEL (vsl_events, su resumen y los leads con visitor_id), nada de Panda ni YouTube: las vistas
// de `negocio` salen de una tabla que sólo tiene un cliente. Sin `comparar` en los números del video: cada uno
// sería una lectura más de los eventos, que es lo más pesado del Dashboard (hallazgos-graficos.md, «La hoja
// Landing tardaba 51 s»).

const VSL: PlantillaHoja = {
  id: 'vsl-analyst', nombre: 'VSL Analyst', emoji: '🎥',
  linea: 'Quién le da play a tu video, dónde se va, y si los que lo ven más agendan y compran más.',
  armar: (id: Id) => ({
    id: id('vsl-analyst'), nombre: 'VSL Analyst', emoji: '🎥', subtitulo: 'Tu video de ventas: quién lo ve, hasta dónde, y qué pasa después.',
    controles: [
      { id: id('vs-periodo'), tipo: 'periodo', preset: 'ult30' },
      lista(id('vs-pagina'), 'pagina'),
      lista(id('vs-video'), 'video'),
    ],
    componentes: [
      // COMPOSICIÓN DEL 31/10/2026: play, llegan al final, agendan. La curva es LA forma del dato (sube a portada); el embudo de los
      // mismos cortes se fue, y las tasas por video viven como columnas. La caja de MaKo va al pie: arriba tapaba la pregunta.
      kpi(id('vs-final'), 'retencion_vsl', 'tasa_final', 'Llegan al final', '', 0, 0, { tipo: 'numero_tendencia', invertida: true }),
      kpi(id('vs-play'), 'retencion_vsl', 'arrancaron', 'Le dieron play', '', 3, 0, { tipo: 'numero_tendencia' }),
      kpi(id('vs-play-rate'), 'vsl', 'play_rate', 'Le dan play', '', 6, 0, { tipo: 'numero_tendencia' }),
      kpi(id('vs-agendaron'), 'vsl', 'agendaron', 'Agendaron', '', 9, 0, { tipo: 'numero_tendencia' }),
      // La curva de la tab vieja (el bloque curva_vsl): cuántos siguen en cada corte del video.
      { id: id('vs-curva'), clase: 'grafico', tipo: 'area', fuente: 'retencion_vsl', dimension: 'corte', metricas: ['siguen'], titulo: 'Dónde se van', x: 0, y: 4, w: 12, h: 10 },
      {
        id: id('vs-tramos'), clase: 'grafico', tipo: 'columnas', fuente: 'vsl_leads', fecha: 'alta', dimension: 'tramo_visto', metricas: ['leads', 'agendas', 'cierres'],
        titulo: '¿Los que más ven, más compran?', x: 0, y: 14, w: 7, h: 10,
      },
      {
        id: id('vs-videos'), clase: 'grafico', tipo: 'tabla_barras', fuente: 'retencion_vsl', dimension: 'video', metricas: ['arrancaron', 'tasa_25', 'tasa_50', 'tasa_final'],
        ordenMetrica: 'arrancaron', barra: 'arrancaron', titulo: 'Por video', x: 7, y: 14, w: 5, h: 10,
      },
      caja(id('vs-ia'), 'Qué dice tu video', 'En qué parte del video se va la gente, y si los que lo ven más agendan más', 0, 24, 12, 6),
    ],
  }),
};

// ── CS Analyst (v5, punto 22) ────────────────────────────────────────────────────────────────
// Reemplaza a la plantilla general «Customer Success». La cartera es la MISMA de /customer-success (cs-cartera,
// cs-senal), y la entrega sale del universo de la cartera (`carteraEnEntrega`), no de las filas de
// cliente_entrega: un cliente sin fila está en la primera etapa (lib/graficos-datos.ts, P2).

/** Las llamadas de ENTREGA (las sesiones con clientes): lo que define a esas tarjetas. */
const ENTREGA = 'Entrega del servicio';

const CS: PlantillaHoja = {
  id: 'cs-analyst', nombre: 'CS Analyst', emoji: '🩺', buscar: 'Customer Success',
  linea: 'Tu cartera de clientes: quién necesita atención, en qué etapa está y cuánto hablan con ustedes.',
  armar: (id: Id) => ({
    id: id('cs-analyst'), nombre: 'CS Analyst', emoji: '🩺', subtitulo: 'Lo que pasa después del pago: la entrega y la cartera.',
    controles: [
      { id: id('cs-periodo'), tipo: 'periodo', preset: 'ult30' },
      lista(id('cs-producto'), 'producto'),
      lista(id('cs-estado'), 'cartera.estado'),
    ],
    componentes: [
      // COMPOSICIÓN DEL 31/10/2026 (15 piezas → 9): la cartera ES la hoja. Los de `cartera` van como `numero`: su fecha es
      // `actual`, sin rango, y una línea saldría plana en cero. La caja de MaKo va al pie: nace sin correr, y arriba tapaba la pregunta.
      kpi(id('cs-atencion'), 'cartera', 'atencion', 'Necesitan atención', '', 0, 0, { invertida: true }),
      kpi(id('cs-clientes'), 'cartera', 'clientes', 'Clientes', '', 3, 0),
      kpi(id('cs-deuda'), 'cartera', 'deuda_vencida_usd', 'Deuda vencida', '', 6, 0),
      kpi(id('cs-sesiones'), 'llamadas', 'llamadas', 'Sesiones', '', 9, 0, {
        tipo: 'numero_tendencia', comparar: true, controles: [fijo(id('cs-sesiones-c'), 'llamadas.categoria', [ENTREGA])],
      }),
      {
        id: id('cs-tabla'), clase: 'grafico', tipo: 'tabla', fuente: 'cartera', dimension: 'cliente', metricas: ['atencion', 'deuda_vencida_usd', 'sesiones'],
        ordenMetrica: 'atencion', limite: 50, titulo: 'Cada cliente', x: 0, y: 4, w: 12, h: 10,
      },
      { id: id('cs-etapas'), clase: 'grafico', tipo: 'barras', fuente: 'entrega', fecha: 'actual', dimension: 'etapa', metricas: ['clientes'], titulo: 'Dónde está cada cliente', x: 0, y: 14, w: 6, h: 8 },
      { id: id('cs-contacto'), clase: 'grafico', tipo: 'barras', fuente: 'cartera', dimension: 'tramo_contacto', metricas: ['clientes'], titulo: 'Hace cuánto no hablan', x: 6, y: 14, w: 6, h: 8 },
      {
        id: id('cs-semanas'), clase: 'grafico', tipo: 'serie', fuente: 'llamadas', dimension: 'semana', metricas: ['llamadas'], titulo: 'Sesiones por semana',
        x: 0, y: 22, w: 12, h: 8, controles: [fijo(id('cs-semanas-c'), 'llamadas.categoria', [ENTREGA])],
      },
      caja(id('cs-ia'), 'Quién necesita atención', 'Qué señales de la cartera piden atención y qué conviene hacer esta semana', 0, 30, 12, 7),
    ],
  }),
};

// ── Chat Analyst (v5, punto 22) ──────────────────────────────────────────────────────────────
// Reemplaza a la plantilla general «WhatsApp y MaKo» y a la pantalla /chat-analyst (el dashboard de las
// secuencias). Es la hoja del SETTER (`HOJA_DE_ROL`, lib/graficos-plantillas.ts): todo lo que pide tiene que estar
// en sus conjuntos, por eso no lleva los chats con MaKo (`mako_chat`), que no le corresponden.

const CHAT: PlantillaHoja = {
  id: 'chat-analyst', nombre: 'Chat Analyst', emoji: '💬', buscar: 'WhatsApp setter',
  linea: 'Tus chats de WhatsApp: cuánto entra, qué tan rápido responden y cómo rinden tus automatizaciones.',
  armar: (id: Id) => ({
    id: id('chat-analyst'), nombre: 'Chat Analyst', emoji: '💬', subtitulo: 'Las conversaciones con tus leads y las automatizaciones.',
    controles: [
      { id: id('ch-periodo'), tipo: 'periodo', preset: 'ult30' },
      lista(id('ch-linea'), 'linea'),
      lista(id('ch-setter'), 'setter'),
    ],
    componentes: [
      // COMPOSICIÓN DEL 31/10/2026 (14 piezas → 8): cuánto entra, qué tan rápido, cuánto espera. «Esperando» queda `numero`: su
      // fecha es `actual`, sin rango. La caja de MaKo va al pie: nace sin correr, y arriba tapaba la pregunta.
      kpi(id('ch-recibidos'), 'whatsapp', 'recibidos', 'Recibidos', '', 0, 0, { tipo: 'numero_tendencia', comparar: true, invertida: true }),
      kpi(id('ch-chats'), 'whatsapp', 'chats', 'Chats', '', 3, 0, { tipo: 'numero_tendencia' }),
      kpi(id('ch-rapidos'), 'conversaciones', 'pct_rapidos', 'Respondidos en 15 min', '', 6, 4),
      kpi(id('ch-mediana'), 'conversaciones', 'mediana_respuesta', 'Tiempo de respuesta', '', 6, 0, { tipo: 'numero_tendencia' }),
      kpi(id('ch-esperando'), 'conversaciones', 'sin_responder', 'Esperando', '', 9, 0, { fecha: 'actual' }),
      {
        id: id('ch-por-dia'), clase: 'grafico', tipo: 'serie', fuente: 'whatsapp', dimension: 'dia', metricas: ['recibidos', 'enviados'], titulo: 'Mensajes por día',
        x: 0, y: 8, w: 12, h: 8, controles: [{ id: id('ch-por-dia-agrupar'), tipo: 'agrupar', agrupar: 'auto' }],
      },
      { id: id('ch-setters'), clase: 'grafico', tipo: 'barras', fuente: 'conversaciones', dimension: 'setter', metricas: ['turnos', 'pct_rapidos'], titulo: 'Por setter', x: 0, y: 16, w: 6, h: 8 },
      { id: id('ch-lineas'), clase: 'grafico', tipo: 'columnas_apiladas', fuente: 'whatsapp', dimension: 'linea', desglose: 'direccion', metricas: ['mensajes'], titulo: 'Por línea', x: 6, y: 16, w: 6, h: 8 },
      caja(id('ch-ia'), 'Dónde se enfría el chat', 'En qué momento se enfrían las conversaciones y qué responder mejor', 0, 24, 12, 7),
    ],
  }),
};

/**
 * Ads Analyst, Landing Analyst, Closing Analyst, Productivity Analyst y, desde v5, VSL, CS y Chat Analyst: lo que
 * es ANÁLISIS. El orden es el CAMINO del negocio que tenía el desplegable de la sidebar: lo que trae a la gente
 * (el anuncio, la landing, el video), lo que pasa con la persona (el chat, la llamada, el cliente) y el tablero.
 */
export const PLANTILLAS_ANALYSTS: readonly PlantillaHoja[] = [ADS, LANDING, VSL, CHAT, CLOSING, CS, PRODUCTIVIDAD];
