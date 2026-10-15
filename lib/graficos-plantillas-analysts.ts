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
      // 1 · Los cuatro números de la tab
      kpi(id('ad-guiones'), 'guiones', 'guiones', 'Guiones analizados', 'con pauta en el período', 0, 0),
      kpi(id('ad-hook'), 'guiones', 'hook_rate', 'Hook rate', 'reproducciones de 3 s ÷ impresiones', 3, 0),
      kpi(id('ad-cpa'), 'guiones', 'cpa', 'Costo por agenda', 'gasto ÷ agendas de Meta', 6, 0),
      kpi(id('ad-sin-retorno'), 'guiones', 'gasto', 'Gasto sin retorno', 'en guiones sin agendas', 9, 0, {
        controles: [fijo(id('ad-sin-retorno-c'), 'guiones.resultado', ['Sin agendas'])],
      }),
      // 2 · Los patrones de la tab (Sigue / Corta / Proceso) son ahora una caja de MaKo (contrato v5,
      //     «patrones_guiones»): la instrucción es la que respondían las reglas fijas de antes.
      caja(id('ad-patrones-ia'), 'Patrones de tus guiones', 'Qué patrones separan a los guiones que agendan de los que no', 0, 4, 12, 8),
      // 3 · El cuadrante de retención: un punto por guion, el ángulo pinta, y el clic abre el anuncio.
      {
        id: id('ad-cuadrante-dispersion'), clase: 'grafico', tipo: 'dispersion', fuente: 'guiones', dimension: 'guion', metricas: ['hook_rate', 'ret_cta'],
        titulo: 'Cuadrante de retención', colorPor: 'angulo', limite: 50, x: 0, y: 12, w: 12, h: 13,
        ejes: { xMin: 0, xMax: 55, yMin: 0, yMax: 30 },
        // [arriba-izq, arriba-der, abajo-izq, abajo-der] con x = hook rate, y = retención al CTA (los de la tab).
        referencias: { x: 28, y: 10, rotulos: ['Mejorar gancho', 'Escalar', 'Repensar', 'Reescribir cuerpo'] },
        alClic: 'popup', popup: popupDe(POPUP_ANUNCIO, id, 'ad-cuadrante-dispersion'),
      },
      // 4 · Todos los guiones, como TARJETAS (la GuionCard de la tab): 4 números, la barra en el hook y el
      //     ángulo y el veredicto como chips. Eran 6 columnas: la que ordena + 3 (relevo C, punto 20).
      {
        id: id('ad-tabla'), clase: 'grafico', tipo: 'tarjetas', fuente: 'guiones', dimension: 'guion',
        metricas: ['agendas', 'hook_rate', 'retencion_final', 'cpa'], ordenMetrica: 'agendas', barra: 'hook_rate', limite: 50,
        tabla: { columnas: ['angulo', 'veredicto'] },
        titulo: 'Guiones', x: 0, y: 25, w: 12, h: 16,
        alClic: 'popup', popup: popupDe(POPUP_ANUNCIO, id, 'ad-tabla'),
      },
      // 5 · Los patrones que sí son un gráfico
      { id: id('ad-eficiencia'), clase: 'grafico', tipo: 'barras', fuente: 'guiones', dimension: 'angulo', metricas: ['agendas_1k'], titulo: 'Agendas por US$1.000, por ángulo', x: 0, y: 41, w: 6, h: 9 },
      { id: id('ad-gancho'), clase: 'grafico', tipo: 'barras', fuente: 'guiones', dimension: 'gancho', metricas: ['hook_rate'], titulo: 'Hook rate por tipo de gancho', x: 6, y: 41, w: 6, h: 9 },
      { id: id('ad-veredicto'), clase: 'grafico', tipo: 'barras', fuente: 'guiones', dimension: 'veredicto', metricas: ['gasto'], titulo: 'Gasto por veredicto', x: 0, y: 50, w: 6, h: 9 },
      {
        id: id('ad-muestra'), clase: 'grafico', tipo: 'tabla', fuente: 'guiones', dimension: 'guion', metricas: ['gasto', 'hook_rate', 'agendas'],
        titulo: 'Muestra chica', subtitulo: 'menos de 8 mil impresiones', x: 6, y: 50, w: 6, h: 9,
        controles: [fijo(id('ad-muestra-c'), 'guiones.confianza', ['Baja'])],
      },
      // 6 · El embudo del video (todos los cuartiles de Meta) y el reparto por ángulo
      { id: id('ad-video'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'guiones', metricas: ['plays_3s', 'p25', 'p50', 'p75', 'p100'], titulo: 'Cuánto ven el video', x: 0, y: 59, w: 6, h: 12 },
      { id: id('ad-angulos'), clase: 'grafico', tipo: 'circular', fuente: 'guiones', dimension: 'angulo', metricas: ['guiones'], titulo: 'Guiones por ángulo', x: 6, y: 59, w: 6, h: 12 },
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
      // 1 · Cuánta gente y hasta dónde llega. (Lo del VIDEO —«Ven la mitad del video», su curva y su embudo—
      //     se mudó a la hoja VSL Analyst en v5: dos hojas con el mismo número terminan contando distinto.)
      kpi(id('la-visitas'), 'visitas', 'visitas', 'Visitas', 'contra el período anterior', 0, 0, { comparar: true }),
      kpi(id('la-personas'), 'visitas', 'visitantes', 'Personas distintas', 'que entraron a tus páginas', 3, 0),
      kpi(id('la-mitad-pagina'), 'scroll', 'pct_50', 'Llegan a la mitad', 'de las personas con scroll medido', 6, 0),
      kpi(id('la-tocan'), 'clics', 'personas', 'Tocan un botón', 'personas que hicieron clic', 9, 0),
      // 2 · Las visitas y de dónde vienen
      {
        id: id('la-visitas-dia'), clase: 'grafico', tipo: 'serie', fuente: 'visitas', dimension: 'dia', metricas: ['visitas', 'visitantes'],
        titulo: 'Visitas por día', x: 0, y: 4, w: 8, h: 9, controles: [{ id: id('la-visitas-agrupar'), tipo: 'agrupar', agrupar: 'auto' }],
      },
      { id: id('la-origen'), clase: 'grafico', tipo: 'barras', fuente: 'visitas', dimension: 'origen', metricas: ['visitas'], limite: 10, titulo: 'De dónde llegan', x: 8, y: 4, w: 4, h: 9 },
      // 3 · Hasta dónde bajan y qué tocan («Qué botón tocan» pasa a barras: una métrica, el valor al final)
      { id: id('la-scroll'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'scroll', metricas: ['medidos', 'llegaron_25', 'llegaron_50', 'llegaron_75', 'llegaron_100'], titulo: 'Hasta dónde bajan', subtitulo: 'personas con scroll medido', x: 0, y: 13, w: 6, h: 12 },
      { id: id('la-clics'), clase: 'grafico', tipo: 'barras', fuente: 'clics', dimension: 'destino', metricas: ['clics'], ordenMetrica: 'clics', limite: 10, titulo: 'Qué botón tocan', x: 6, y: 13, w: 6, h: 12 },
      // 4 · El mapa de calor: la página EN VIVO con el calor encima (decisión 1 de Martín), o la foto.
      { id: id('la-mapa-mapa'), clase: 'grafico', tipo: 'mapa_calor', fuente: 'toques', metricas: ['toques'], titulo: 'Mapa de calor', x: 0, y: 25, w: 12, h: 24 },
      // 5 · Las grabaciones
      kpi(id('la-grabaciones'), 'replays', 'grabaciones', 'Grabaciones', 'sesiones grabadas en tus páginas', 0, 49),
      kpi(id('la-duracion'), 'replays', 'duracion', 'Duración promedio', 'de cada grabación', 3, 49),
      { id: id('la-corte'), clase: 'grafico', tipo: 'circular', fuente: 'replays', dimension: 'corte', metricas: ['grabaciones'], titulo: 'Cómo terminaron', x: 6, y: 49, w: 6, h: 10 },
      { id: id('la-grab-pagina'), clase: 'grafico', tipo: 'tabla', fuente: 'replays', dimension: 'pagina', metricas: ['grabaciones', 'duracion', 'visitantes'], titulo: 'Grabaciones por página', x: 0, y: 53, w: 6, h: 6 },
      // 6 · El diagnóstico que MaKo guardó de cada página (analizar es una tarea: vive en Landing Generator).
      //     Barras sobre el puntaje: era una tabla con barra en cada columna (relevo C, punto 20).
      { id: id('la-diagnostico'), clase: 'grafico', tipo: 'barras', fuente: 'landing_analisis', fecha: 'actual', dimension: 'pagina', metricas: ['puntaje'], ordenMetrica: 'puntaje', titulo: 'Diagnóstico de cada página', x: 0, y: 59, w: 12, h: 8 },
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
      // 1 · Los KPI de la tab. «Analizadas» cuenta las ventas con análisis completo del período.
      kpi(id('cl-puntaje'), 'llamadas_venta', 'puntaje', 'Score promedio', 'de 10, llamadas con puntaje', 0, 0),
      kpi(id('cl-r1'), 'llamadas_venta', 'puntaje', 'R1', 'diagnóstico', 3, 0, { w: 2, controles: [fijo(id('cl-r1-c'), 'llamadas_venta.reunion', ['R1'])] }),
      kpi(id('cl-r2'), 'llamadas_venta', 'puntaje', 'R2', 'cierre', 5, 0, { w: 2, controles: [fijo(id('cl-r2-c'), 'llamadas_venta.reunion', ['R2'])] }),
      kpi(id('cl-tasa'), 'llamadas_venta', 'tasa_cierre', 'Tasa de cierre', 'R2 ganadas ÷ R2', 7, 0, { w: 2 }),
      kpi(id('cl-analizadas'), 'llamadas_venta', 'llamadas', 'Analizadas', 'llamadas de venta con análisis', 9, 0),
      // 2 · El embudo y la tendencia mensual del score (doce meses: una línea de años no se lee)
      {
        id: id('cl-embudo-embudo'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'llamadas_venta', metricas: ['r1', 'r2', 'ganadas_r2'],
        titulo: 'Embudo de llamadas', subtitulo: 'Cuenta llamadas, no personas', x: 0, y: 4, w: 6, h: 10,
      },
      {
        id: id('cl-tendencia'), clase: 'grafico', tipo: 'serie', fuente: 'llamadas_venta', dimension: 'mes', metricas: ['puntaje'],
        titulo: 'Tendencia del score', x: 6, y: 4, w: 6, h: 10, controles: [periodoFijo(id('cl-tendencia-fecha'), 'ult12m')],
      },
      // 3 · Qué separa las ganadas de las perdidas: las barras y la caja de MaKo que las lee
      {
        id: id('cl-factores-barras'), clase: 'grafico', tipo: 'barras', fuente: 'llamadas_dimensiones', dimension: 'dimension', desglose: 'tono',
        metricas: ['puntaje'], titulo: 'Factores del cierre', x: 0, y: 14, w: 8, h: 14,
      },
      caja(id('cl-factores-ia'), 'Qué decide tus cierres', 'Qué decide los cierres: qué hacen distinto las llamadas ganadas', 8, 14, 4, 14,
        { fuentes: [id('cl-factores-barras')], largo: 'corto', formato: 'vinetas' }),
      // 4 · El equipo
      {
        id: id('cl-closers-tabla'), clase: 'grafico', tipo: 'tabla', fuente: 'llamadas_venta', dimension: 'closer', metricas: ['llamadas', 'puntaje', 'ganadas', 'tasa_cierre'],
        titulo: 'El equipo de closers', x: 0, y: 28, w: 12, h: 10,
      },
      {
        id: id('cl-punto-debil'), clase: 'grafico', tipo: 'dinamica_calor', fuente: 'llamadas_dimensiones', dimension: 'closer', desglose: 'dimension',
        metricas: ['puntaje'], titulo: 'Puntaje por closer y dimensión', x: 0, y: 38, w: 12, h: 10,
      },
      // 5 · Las llamadas: traer las nuevas (el cron de siempre y este botón) y la lista, con su búsqueda y el
      //     pop-up «Llamada» (la ficha de cada una, con sus tareas).
      accion(id('cl-llamadas-sync'), 'sincronizar_llamadas', 'Sincronizar llamadas', 0, 48, 3, 2),
      {
        id: id('cl-llamadas-tabla'), clase: 'grafico', tipo: 'tabla', fuente: 'llamadas_venta', dimension: 'llamada', metricas: ['puntaje', 'duracion'],
        titulo: 'Las llamadas', limite: 50, x: 0, y: 50, w: 12, h: 16,
        tabla: { buscar: true, columnas: ['closer', 'reunion', 'dia'] },
        alClic: 'popup', popup: popupDe(POPUP_LLAMADA, id, 'cl-llamadas-tabla'),
      },
    ],
  }),
};

// ── Productividad ────────────────────────────────────────────────────────────────────────────

/** Una lista de «Lo que huele mal»: una fila por tarea, ordenada por su métrica (la de la receta de la migración). */
const tareas = (id: string, metrica: string, titulo: string, limite: number, x: number, controles: Crudo[]): Crudo => ({
  id, clase: 'grafico', tipo: 'tabla', fuente: 'ejecucion', dimension: 'tarea', metricas: [metrica],
  ordenMetrica: metrica, ordenAsc: false, limite, titulo, total: false, x, y: 36, w: 4, h: 12, controles,
});

const PRODUCTIVIDAD: PlantillaHoja = {
  id: 'productividad', nombre: 'Productividad', emoji: '✅', buscar: 'Productivity Analyst',
  linea: 'Tus proyectos: avance, impacto × esfuerzo, pirámide de prioridad y lo que se estancó.',
  armar: (id: Id) => ({
    id: id('productividad'), nombre: 'Productividad', emoji: '✅', subtitulo: 'Lo que produjo tu tablero: qué hacer primero y qué huele mal.',
    // Sin período: todo es la foto de hoy del tablero.
    controles: [],
    componentes: [
      // 1 · Cuatro números, en UNA fila (15/10/2026, copiado de las plantillas de Looker Studio: debajo de la portada va
      //     una sola fila de números, y ninguno repite lo que la portada ya dice). Salieron «Proyectos» y «Completados»: la
      //     portada es el avance de cada proyecto.
      kpi(id('pr-avance'), 'proyectos', 'avance_proyectos', 'Avance global', 'promedio por proyecto', 0, 0),
      kpi(id('pr-activas'), 'ejecucion', 'activas', 'Tareas activas', 'sin las que se repiten', 3, 0),
      kpi(id('pr-wip'), 'ejecucion', 'en_curso', 'En curso (WIP)', 'activas con avance', 6, 0),
      kpi(id('pr-alta-sin'), 'ejecucion', 'alta_sin_deadline', 'Alta sin deadline', 'riesgo de no cerrarse', 9, 0),
      // 2 · ¿Qué hago primero? La matriz (burbujas con los cuadrantes de la tab) y la pirámide.
      {
        id: id('pr-matriz-burbujas'), clase: 'grafico', tipo: 'burbujas', fuente: 'proyectos', dimension: 'proyecto', metricas: ['esfuerzo', 'impacto', 'tareas'],
        titulo: 'Impacto × Esfuerzo', colorPor: 'cuadrante', limite: 50, x: 0, y: 4, w: 7, h: 14,
        ejes: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
        // [arriba-izq, arriba-der, abajo-izq, abajo-der] con x = esfuerzo, y = impacto (los de la tab vieja).
        referencias: { x: 50, y: 50, rotulos: ['Quick wins', 'Apuestas', 'Relleno', 'Trampas'] },
      },
      {
        id: id('pr-piramide-barras'), clase: 'grafico', tipo: 'barras', fuente: 'ejecucion', dimension: 'prioridad', metricas: ['activas'],
        titulo: 'Pirámide de prioridad', subtitulo: 'Tareas activas, sin las que se repiten', x: 7, y: 4, w: 5, h: 10,
      },
      kpi(id('pr-piramide-alta'), 'ejecucion', 'pct_alta', 'En Alta', 'de las tareas activas', 7, 14, { w: 5, objetivo: 18 }),
      // 3 · ¿Cómo venimos? Una barra de avance por proyecto (la barra de progreso de la tab), los activos.
      {
        id: id('pr-avance-proyecto'), clase: 'grafico', tipo: 'barras', fuente: 'proyectos', dimension: 'proyecto',
        metricas: ['avance_proyectos'], ordenMetrica: 'avance_proyectos', limite: 50,
        titulo: 'Avance por proyecto', x: 0, y: 18, w: 12, h: 10,
        controles: [fijo(id('pr-avance-estado'), 'proyectos.estado', ['Activo'])],
      },
      // 4 · ¿Eres disciplinado con los tiempos?
      // «Terminadas con deadline» salió: es el denominador de «A tiempo», que ya lo dice en su línea.
      kpi(id('pr-cumplimiento'), 'ejecucion', 'cumplimiento', 'A tiempo', 'de lo terminado con deadline', 0, 28),
      kpi(id('pr-atraso'), 'ejecucion', 'atraso_prom', 'Atraso promedio', 'días, de las que llegaron tarde', 3, 28),
      kpi(id('pr-estancadas'), 'ejecucion', 'estancadas', 'Estancadas', '7 días o más sin movimiento', 0, 32, { w: 6 }),
      { id: id('pr-ciclo'), clase: 'grafico', tipo: 'barras', fuente: 'ejecucion', dimension: 'prioridad', metricas: ['ciclo'], titulo: 'Cycle time por prioridad', subtitulo: 'días de crear a completar', x: 6, y: 28, w: 6, h: 8 },
      // 5 · ¿Qué huele mal? Las tres listas de la tab, cada una con lo que la define como filtro fijo.
      tareas(id('pr-atencion-estancadas'), 'dias_quieta', 'Estancadas', 12, 0, [fijo(id('pr-atencion-estancadas-f1'), 'ejecucion.estancada', ['Sí'])]),
      tareas(id('pr-atencion-alta'), 'activas', 'Alta sin deadline', 12, 4, [
        fijo(id('pr-atencion-alta-f1'), 'ejecucion.prioridad', ['Alta']),
        fijo(id('pr-atencion-alta-f2'), 'ejecucion.con_deadline', ['No']),
        fijo(id('pr-atencion-alta-f3'), 'ejecucion.estado', ['Activa']),
      ]),
      tareas(id('pr-atencion-corridos'), 'movidas_deadline', 'Deadlines corridos', 6, 8, [fijo(id('pr-atencion-corridos-f1'), 'ejecucion.deadline_corrido', ['Sí'])]),
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
      kpi(id('vs-play'), 'retencion_vsl', 'arrancaron', 'Le dieron play', 'personas con el video en marcha', 0, 0),
      kpi(id('vs-play-rate'), 'vsl', 'play_rate', 'Le dan play', 'de los que entran a la página', 3, 0),
      kpi(id('vs-mitad'), 'retencion_vsl', 'tasa_50', 'Ven la mitad', 'de los que tienen avance medido', 6, 0),
      kpi(id('vs-final'), 'retencion_vsl', 'tasa_final', 'Llegan al final', 'de los que tienen avance medido', 9, 0),
      caja(id('vs-ia'), 'Qué dice tu video', 'En qué parte del video se va la gente, y si los que lo ven más agendan más', 0, 4, 12, 7),
      // La curva de la tab vieja (el bloque curva_vsl): cuántos siguen en cada corte del video.
      { id: id('vs-curva'), clase: 'grafico', tipo: 'area', fuente: 'retencion_vsl', dimension: 'corte', metricas: ['siguen'], titulo: 'Dónde se van', x: 0, y: 11, w: 12, h: 10 },
      { id: id('vs-embudo'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'retencion_vsl', metricas: ['arrancaron', 'pasaron_25', 'pasaron_50', 'pasaron_75', 'llegaron_final'], titulo: 'Cuánto ven el video', x: 0, y: 21, w: 6, h: 12 },
      {
        id: id('vs-plays'), clase: 'grafico', tipo: 'serie', fuente: 'vsl', dimension: 'dia', metricas: ['reproducciones'], titulo: 'Reproducciones por día',
        x: 6, y: 21, w: 6, h: 12, controles: [{ id: id('vs-plays-agrupar'), tipo: 'agrupar', agrupar: 'auto' }],
      },
      {
        id: id('vs-videos'), clase: 'grafico', tipo: 'tabla_barras', fuente: 'retencion_vsl', dimension: 'video', metricas: ['arrancaron', 'tasa_25', 'tasa_50', 'tasa_final'],
        ordenMetrica: 'arrancaron', titulo: 'Por video', x: 0, y: 33, w: 6, h: 10,
      },
      { id: id('vs-paginas'), clase: 'grafico', tipo: 'barras', fuente: 'retencion_vsl', dimension: 'pagina', metricas: ['tasa_50'], limite: 10, titulo: 'Ven la mitad, por página', x: 6, y: 33, w: 6, h: 10 },
      {
        id: id('vs-tramos'), clase: 'grafico', tipo: 'columnas', fuente: 'vsl_leads', fecha: 'alta', dimension: 'tramo_visto', metricas: ['leads', 'agendas', 'cierres'],
        titulo: '¿Los que más ven, más compran?', x: 0, y: 43, w: 8, h: 10,
      },
      kpi(id('vs-agendaron'), 'vsl', 'agendaron', 'Agendaron desde la página', 'agendas que registró tu Pixel', 8, 43, { w: 4 }),
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
      kpi(id('cs-clientes'), 'cartera', 'clientes', 'Clientes', 'en tu cartera hoy', 0, 0),
      kpi(id('cs-atencion'), 'cartera', 'atencion', 'Necesitan atención', 'según sus señales de hoy', 3, 0),
      kpi(id('cs-deuda'), 'cartera', 'deuda_vencida_usd', 'Deuda vencida', 'cuotas vencidas sin pagar', 6, 0),
      kpi(id('cs-sesiones'), 'llamadas', 'llamadas', 'Sesiones con clientes', 'llamadas de entrega', 9, 0, {
        comparar: true, controles: [fijo(id('cs-sesiones-c'), 'llamadas.categoria', [ENTREGA])],
      }),
      caja(id('cs-ia'), 'Quién necesita atención', 'Qué señales de la cartera piden atención y qué conviene hacer esta semana', 0, 4, 12, 7),
      { id: id('cs-etapas'), clase: 'grafico', tipo: 'barras', fuente: 'entrega', fecha: 'actual', dimension: 'etapa', metricas: ['clientes'], titulo: 'Dónde está cada cliente', x: 0, y: 11, w: 6, h: 9 },
      { id: id('cs-senal'), clase: 'grafico', tipo: 'circular', fuente: 'cartera', dimension: 'senal', metricas: ['clientes'], titulo: 'Cómo están', x: 6, y: 11, w: 6, h: 9 },
      { id: id('cs-contacto'), clase: 'grafico', tipo: 'barras', fuente: 'cartera', dimension: 'tramo_contacto', metricas: ['clientes'], titulo: 'Hace cuánto no hablan', x: 0, y: 20, w: 6, h: 9 },
      { id: id('cs-productos'), clase: 'grafico', tipo: 'barras_apiladas', fuente: 'entrega', fecha: 'actual', dimension: 'producto', desglose: 'etapa', metricas: ['clientes'], titulo: 'Por producto y etapa', x: 6, y: 20, w: 6, h: 9 },
      {
        id: id('cs-tabla'), clase: 'grafico', tipo: 'tabla', fuente: 'cartera', dimension: 'cliente', metricas: ['atencion', 'deuda_vencida_usd', 'sesiones'],
        ordenMetrica: 'atencion', limite: 50, titulo: 'Cada cliente', x: 0, y: 29, w: 12, h: 10,
      },
      {
        id: id('cs-semanas'), clase: 'grafico', tipo: 'serie', fuente: 'llamadas', dimension: 'semana', metricas: ['llamadas'], titulo: 'Sesiones por semana',
        x: 0, y: 39, w: 8, h: 9, controles: [fijo(id('cs-semanas-c'), 'llamadas.categoria', [ENTREGA])],
      },
      {
        id: id('cs-quien'), clase: 'grafico', tipo: 'barras', fuente: 'llamadas', dimension: 'closer', metricas: ['llamadas'], titulo: 'Quién atiende',
        x: 8, y: 39, w: 4, h: 9, controles: [fijo(id('cs-quien-c'), 'llamadas.categoria', [ENTREGA])],
      },
      // Los cursos del servicio (vacíos hasta que los alumnos avanzan: el estado vacío de la tarjeta lo dice).
      kpi(id('cs-alumnos'), 'avance_cursos', 'alumnos', 'Alumnos activos', 'en los cursos de tu servicio', 0, 48),
      kpi(id('cs-avance'), 'avance_cursos', 'avance', 'Avance en los cursos', 'promedio de los alumnos', 3, 48),
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
      kpi(id('ch-recibidos'), 'whatsapp', 'recibidos', 'Mensajes recibidos', 'contra el período anterior', 0, 0, { comparar: true }),
      kpi(id('ch-chats'), 'whatsapp', 'chats', 'Chats', 'con mensajes en el período', 3, 0),
      kpi(id('ch-rapidos'), 'conversaciones', 'pct_rapidos', 'Respondidos en 15 min', 'de los mensajes de tus leads', 6, 0),
      kpi(id('ch-esperando'), 'conversaciones', 'sin_responder', 'Esperando respuesta', 'chats con más de 24 h sin respuesta', 9, 0, { fecha: 'actual' }),
      caja(id('ch-ia'), 'Dónde se enfría el chat', 'En qué momento se enfrían las conversaciones y qué responder mejor', 0, 4, 12, 7),
      {
        id: id('ch-por-dia'), clase: 'grafico', tipo: 'serie', fuente: 'whatsapp', dimension: 'dia', metricas: ['recibidos', 'enviados'], titulo: 'Mensajes por día',
        x: 0, y: 11, w: 8, h: 9, controles: [{ id: id('ch-por-dia-agrupar'), tipo: 'agrupar', agrupar: 'auto' }],
      },
      { id: id('ch-tipos'), clase: 'grafico', tipo: 'circular', fuente: 'whatsapp', dimension: 'tipo', metricas: ['mensajes'], titulo: 'Por tipo', x: 8, y: 11, w: 4, h: 9 },
      { id: id('ch-setters'), clase: 'grafico', tipo: 'barras', fuente: 'conversaciones', dimension: 'setter', metricas: ['turnos', 'pct_rapidos'], titulo: 'Por setter', x: 0, y: 20, w: 6, h: 9 },
      { id: id('ch-lineas'), clase: 'grafico', tipo: 'columnas_apiladas', fuente: 'whatsapp', dimension: 'linea', desglose: 'direccion', metricas: ['mensajes'], titulo: 'Por línea', x: 6, y: 20, w: 6, h: 9 },
      { id: id('ch-automatizaciones'), clase: 'grafico', tipo: 'tabla_barras', fuente: 'envios', dimension: 'automatizacion', metricas: ['envios', 'abiertos'], titulo: 'Por automatización', x: 0, y: 29, w: 8, h: 9 },
      kpi(id('ch-respondieron'), 'inscripciones', 'respondieron', 'Respondieron', 'personas en una automatización', 8, 29, { w: 4 }),
      kpi(id('ch-mediana'), 'conversaciones', 'mediana_respuesta', 'Tiempo de respuesta', 'la mediana, en minutos', 8, 33, { w: 4 }),
      { id: id('ch-envios'), clase: 'grafico', tipo: 'columnas_apiladas', fuente: 'envios', dimension: 'dia', desglose: 'estado', metricas: ['envios'], titulo: 'Enviados y fallidos', x: 0, y: 38, w: 6, h: 9 },
      { id: id('ch-desenlace'), clase: 'grafico', tipo: 'barras', fuente: 'inscripciones', fecha: 'desenlace', dimension: 'desenlace', metricas: ['personas'], titulo: 'Cómo terminaron', x: 6, y: 38, w: 6, h: 9 },
    ],
  }),
};

/**
 * Ads Analyst, Landing Analyst, Closing Analyst, Productivity Analyst y, desde v5, VSL, CS y Chat Analyst: lo que
 * es ANÁLISIS. El orden es el CAMINO del negocio que tenía el desplegable de la sidebar: lo que trae a la gente
 * (el anuncio, la landing, el video), lo que pasa con la persona (el chat, la llamada, el cliente) y el tablero.
 */
export const PLANTILLAS_ANALYSTS: readonly PlantillaHoja[] = [ADS, LANDING, VSL, CHAT, CLOSING, CS, PRODUCTIVIDAD];
