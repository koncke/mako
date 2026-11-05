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
  // 4/11/2026 — ANUNCIO GANADOR (docs/templates-dashboard-propuesta.md §7.3, VITREA · PRISM): «¿cuál creativo gana, y con cuánta
  // confianza?». Ads Analyst se partió en dos: ésta (qué anuncio gana) y «Hooks y retención» (en qué segundo se van). El id sigue
  // siendo `ads-analyst`: /ads-analyst, los links de MaKo y las hojas guardadas llegan acá. ⚠️ La «confianza» es la de la muestra
  // (impresiones: alta desde 25.000, media desde 8.000, lib/ads-analyst-patrones.ts), no una prueba estadística entre dos creativos:
  // ésa no se mide todavía (§7.4).
  id: 'ads-analyst', nombre: 'Anuncio ganador', emoji: '🏆', buscar: 'Ads Analyst guiones creativos',
  linea: 'Qué anuncio gana, con cuánta muestra, y cuántas agendas trae cada uno por cada mil dólares.',
  armar: (id: Id) => ({
    id: id('ads-analyst'), nombre: 'Anuncio ganador', emoji: '🏆', subtitulo: 'Los guiones de tus anuncios: cuál gana y con cuánta muestra.',
    controles: [
      { id: id('ad-periodo'), tipo: 'periodo', preset: 'todo' },
      lista(id('ad-angulo'), 'guiones.angulo'),
      lista(id('ad-tipo'), 'guiones.tipo'),
    ],
    componentes: [
      {
        id: id('ad-apertura'), clase: 'grafico', tipo: 'frase', fuente: 'guiones', metricas: ['agendas', 'cierres', 'cpa', 'gasto'],
        titulo: 'Tus anuncios', frase: 'Tus anuncios trajeron {agendas} agendas y {cierres} cierres · cada agenda costó {cpa}',
        ir: 'ads-writer', x: 0, y: 0, w: 12, h: 3,
      },
      // 5/11/2026 — Cuántos guiones están para escalar ya no es un número aparte: lo dice la fila «Escalar» del veredicto (abajo), y
      // el diseño lo calcula de ahí (lib/anuncio-diseno.ts, `escalarDe`). Una hoja lleva hasta 14 paneles (tests/graficos-corbel.test.ts).
      kpi(id('ad-cpa'), 'guiones', 'cpa', 'Costo por agenda', '', 0, 3, { tipo: 'numero_tendencia', comparar: true, w: 4 }),
      kpi(id('ad-costo-cierre'), 'guiones', 'costo_cierre', 'Costo por cierre', '', 4, 3, { tipo: 'numero_tendencia', comparar: true, w: 4 }),
      kpi(id('ad-sin-retorno'), 'guiones', 'gasto', 'Gasto sin retorno', '', 8, 3, {
        tipo: 'numero_tendencia', comparar: true, w: 4, controles: [fijo(id('ad-sin-retorno-c'), 'guiones.resultado', ['Sin agendas'])],
      }),
      // Cuál gana: el cuadrante dice CUÁLES, el veredicto cuántos hay de cada uno y la confianza con cuánta muestra.
      {
        id: id('ad-cuadrante-dispersion'), clase: 'grafico', tipo: 'dispersion', fuente: 'guiones', dimension: 'guion', metricas: ['hook_rate', 'ret_cta'],
        titulo: 'Cuadrante de retención', colorPor: 'angulo', limite: 50, x: 0, y: 7, w: 6, h: 12,
        ejes: { xMin: 0, xMax: 55, yMin: 0, yMax: 30 },
        // [arriba-izq, arriba-der, abajo-izq, abajo-der] con x = hook rate, y = retención al CTA (los de la tab).
        referencias: { x: 28, y: 10, rotulos: ['Mejorar gancho', 'Escalar', 'Repensar', 'Reescribir cuerpo'] },
        alClic: 'popup', popup: popupDe(POPUP_ANUNCIO, id, 'ad-cuadrante-dispersion'),
      },
      { id: id('ad-veredicto'), clase: 'grafico', tipo: 'anillo', fuente: 'guiones', dimension: 'veredicto', metricas: ['guiones'], titulo: 'Qué hacer con cada uno', x: 6, y: 7, w: 3, h: 12 },
      { id: id('ad-confianza'), clase: 'grafico', tipo: 'barras', fuente: 'guiones', dimension: 'confianza', metricas: ['guiones'], titulo: 'Con cuánta muestra', x: 9, y: 7, w: 3, h: 12 },
      // 5/11/2026 — Las agendas por US$1.000 por ángulo y por formato salieron de esta hoja (tope de 14 paneles): el ángulo sigue en el
      // color del cuadrante y en su filtro, el formato vive en «Hooks y retención», y por guion lo dice «Qué guion rinde más» (abajo).
      // Los patrones de la tab (Sigue / Corta / Proceso) son una caja de MaKo (contrato v5, «patrones_guiones»).
      caja(id('ad-patrones-ia'), 'Patrones de tus guiones', 'Qué patrones separan a los guiones que agendan de los que no', 0, 19, 12, 8),
      // Todos los guiones, como TARJETAS (la GuionCard de la tab): 4 números, la barra en el hook y los chips. La confianza va en
      // un chip: era la tabla «Muestra chica», que repetía guiones con un filtro.
      {
        id: id('ad-tabla'), clase: 'grafico', tipo: 'tarjetas', fuente: 'guiones', dimension: 'guion',
        metricas: ['agendas', 'hook_rate', 'retencion_final', 'cpa'], ordenMetrica: 'agendas', barra: 'hook_rate', limite: 50,
        tabla: { columnas: ['angulo', 'veredicto', 'confianza'] },
        titulo: 'Guiones', x: 0, y: 27, w: 12, h: 16,
        alClic: 'popup', popup: popupDe(POPUP_ANUNCIO, id, 'ad-tabla'),
      },
      // 5/11/2026 — LO QUE LEE EL DISEÑO DE PRISM (abajo) y no estaba arriba: las agendas y los cierres por día (el diseño suma de ahí
      // las semanas), qué guion rinde más entre los que tienen muestra, los seis meses cerrados (no obedecen al período, como el «Long
      // view» de Prism) y el gancho día por día.
      { id: id('ad-dia'), clase: 'grafico', tipo: 'serie', fuente: 'guiones', dimension: 'dia', metricas: ['agendas', 'cierres'], comparar: true, titulo: 'Agendas y cierres por día', x: 0, y: 43, w: 12, h: 8 },
      {
        id: id('ad-ganadores'), clase: 'grafico', tipo: 'barras', fuente: 'guiones', dimension: 'guion', metricas: ['agendas_1k', 'agendas', 'gasto'],
        ordenMetrica: 'agendas_1k', limite: 6, titulo: 'Qué guion rinde más', subtitulo: 'Agendas por US$1.000, de los que tienen muestra',
        x: 0, y: 51, w: 6, h: 9, controles: [fijo(id('ad-ganadores-c'), 'guiones.confianza', ['Alta', 'Media'])],
        alClic: 'popup', popup: popupDe(POPUP_ANUNCIO, id, 'ad-ganadores'),
      },
      {
        id: id('ad-meses'), clase: 'grafico', tipo: 'barras', fuente: 'guiones', dimension: 'mes', metricas: ['agendas', 'gasto'],
        titulo: 'Agendas y lo invertido por mes', subtitulo: 'Los últimos 12 meses, sin importar el período', x: 6, y: 51, w: 6, h: 9,
        controles: [periodoFijo(id('ad-meses-fecha'), 'ult12m')],
      },
      { id: id('ad-gancho'), clase: 'grafico', tipo: 'serie', fuente: 'guiones', dimension: 'dia', metricas: ['hook_rate', 'ret_cta', 'thruplay_rate'], titulo: 'El gancho día por día', x: 0, y: 60, w: 6, h: 9 },
      // Lo invertido en cada veredicto (un anillo lleva una sola métrica): el diseño dice qué parte va a los que conviene escalar.
      { id: id('ad-invertido'), clase: 'grafico', tipo: 'barras', fuente: 'guiones', dimension: 'veredicto', metricas: ['gasto'], titulo: 'Lo invertido en cada veredicto', x: 6, y: 60, w: 6, h: 9 },
    ],
    // El DISEÑO DE PRISM (5/11/2026; docs/diseno/mockups-dashboard/anuncio-prism/): mirando, la hoja la dibuja
    // app/dashboard/disenos/HojaAnuncio.tsx con estas piezas (lib/anuncio-diseno.ts arma cada parte, con test). Los listos para
    // escalar salen del veredicto y las semanas de los días. El cuadrante y los patrones de MaKo quedan en la grilla («Ver la grilla»).
    diseno: {
      id: 'anuncio',
      piezas: {
        apertura: id('ad-apertura'), dia: id('ad-dia'), veredicto: id('ad-veredicto'), confianza: id('ad-confianza'), ganadores: id('ad-ganadores'),
        cpa: id('ad-cpa'), cierre: id('ad-costo-cierre'), sinretorno: id('ad-sin-retorno'), meses: id('ad-meses'),
        gancho: id('ad-gancho'), guiones: id('ad-tabla'), invertido: id('ad-invertido'),
      },
    },
  }),
};

// ── Hooks y retención (4/11/2026) ────────────────────────────────────────────────────────────────
// VITREA · MURMURA (docs/templates-dashboard-propuesta.md §7.3): «¿en qué segundo se van, y qué hook los retuvo?». La otra mitad de
// lo que hacía Ads Analyst. Vitrea pone la caída del video como la forma del dato y la retención contra su referencia; Murmura, qué
// gancho y qué formato retienen. ⚠️ La curva es por CUARTILES del video (los p25…p100 que manda Meta), no por segundo: la retención
// segundo a segundo no se mide todavía (§7.4).
const HOOKS: PlantillaHoja = {
  id: 'hooks-retencion', nombre: 'Hooks y retención', emoji: '🪝', buscar: 'Ads Analyst hook rate gancho retención video',
  linea: 'En qué parte del video se va la gente, qué gancho la retiene y qué guion llega al llamado a la acción.',
  armar: (id: Id) => ({
    id: id('hooks-retencion'), nombre: 'Hooks y retención', emoji: '🪝', subtitulo: 'Cuánto ven tus anuncios y qué los retiene.',
    controles: [
      { id: id('hk-periodo'), tipo: 'periodo', preset: 'todo' },
      lista(id('hk-angulo'), 'guiones.angulo'),
      lista(id('hk-formato'), 'guiones.formato'),
    ],
    componentes: [
      {
        id: id('hk-apertura'), clase: 'grafico', tipo: 'frase', fuente: 'guiones', metricas: ['plays_3s', 'p50', 'p100'],
        titulo: 'Tus videos', frase: '{plays_3s} vieron los primeros 3 segundos · {p50} llegaron a la mitad · {p100} lo vieron entero',
        ir: 'ads-writer', x: 0, y: 0, w: 12, h: 3,
      },
      // 5/11/2026 — Los cuatro se comparan con el período anterior: el diseño de Ondra pone el cambio y el «vs» debajo de cada número.
      kpi(id('hk-hook'), 'guiones', 'hook_rate', 'Hook rate', '', 0, 3, { tipo: 'numero_tendencia', invertida: true, comparar: true }),
      kpi(id('hk-cta'), 'guiones', 'ret_cta', 'Llegan al llamado', '', 3, 3, { tipo: 'numero_tendencia', comparar: true }),
      kpi(id('hk-thruplay'), 'guiones', 'thruplay_rate', 'ThruPlay', '', 6, 3, { tipo: 'numero_tendencia', comparar: true }),
      kpi(id('hk-guiones'), 'guiones', 'guiones', 'Guiones analizados', '', 9, 3, { tipo: 'numero_tendencia', ir: 'ads-writer', comparar: true }),
      { id: id('hk-video'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'guiones', metricas: ['plays_3s', 'p25', 'p50', 'p75', 'p100'], titulo: 'En qué parte se van', x: 0, y: 7, w: 8, h: 10 },
      // El diseño cambia entre el hook rate, los que llegan al llamado y el ThruPlay de cada gancho, y cuenta sus guiones.
      { id: id('hk-gancho'), clase: 'grafico', tipo: 'barras', fuente: 'guiones', dimension: 'gancho', metricas: ['hook_rate', 'ret_cta', 'thruplay_rate', 'guiones'], ordenMetrica: 'hook_rate', titulo: 'Qué gancho retiene', x: 8, y: 7, w: 4, h: 10 },
      { id: id('hk-formato-cta'), clase: 'grafico', tipo: 'barras', fuente: 'guiones', dimension: 'formato', metricas: ['ret_cta'], titulo: 'Llegan al llamado, por formato', x: 0, y: 17, w: 6, h: 8 },
      { id: id('hk-avatar'), clase: 'grafico', tipo: 'barras', fuente: 'guiones', dimension: 'avatar', metricas: ['hook_rate', 'ret_cta', 'guiones'], ordenMetrica: 'hook_rate', titulo: 'Hook rate por avatar', x: 6, y: 17, w: 6, h: 8 },
      { id: id('hk-semana'), clase: 'grafico', tipo: 'serie', fuente: 'guiones', dimension: 'semana', metricas: ['hook_rate', 'ret_cta'], titulo: 'El gancho en el tiempo', x: 0, y: 25, w: 6, h: 8 },
      caja(id('hk-ia'), 'Qué gancho funciona', 'Qué ganchos retienen y en qué parte del video se va la gente', 6, 25, 6, 8),
      {
        id: id('hk-tabla'), clase: 'grafico', tipo: 'tabla', fuente: 'guiones', dimension: 'guion', metricas: ['hook_rate', 'ret_cta', 'thruplay_rate', 'retencion_final'],
        ordenMetrica: 'hook_rate', limite: 30, tabla: { columnas: ['gancho', 'formato'] }, titulo: 'Cada guion', x: 0, y: 33, w: 12, h: 12,
        alClic: 'popup', popup: popupDe(POPUP_ANUNCIO, id, 'hk-tabla'),
      },
    ],
    // El DISEÑO DE ONDRA (5/11/2026; docs/diseno/mockups-dashboard/hooks-ondra/): mirando, la hoja la dibuja
    // app/dashboard/disenos/HojaHooks.tsx con estas piezas (lib/hooks-diseno.ts arma cada parte, con test). La curva de cada número
    // sale de su propia serie diaria. Lo que llega al llamado por formato y el gancho por semana quedan en la grilla («Ver la grilla»).
    diseno: {
      id: 'hooks',
      piezas: {
        apertura: id('hk-apertura'), hook: id('hk-hook'), cta: id('hk-cta'), thruplay: id('hk-thruplay'), guiones: id('hk-guiones'),
        gancho: id('hk-gancho'), tabla: id('hk-tabla'), video: id('hk-video'), avatar: id('hk-avatar'), ia: id('hk-ia'),
      },
    },
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
      // 4/11/2026 — CORBEL · KESTREL (docs/templates-dashboard-propuesta.md §7.3): «¿hasta dónde bajan y dónde hacen clic?». Abre con la
      // frase de cuánta gente entró y si son más o menos que antes (Kestrel); el ancla es «Llegan a la mitad», que es lo que la hoja
      // pregunta, y cada número lleva a donde se arregla la página (Corbel).
      // 4/11/2026 (tarde) — EL DISEÑO DE CORBEL (`diseno`, abajo; docs/diseno/mockups-dashboard/landing-corbel/): mirando, la hoja la
      // dibuja app/dashboard/disenos/HojaLanding.tsx con estas piezas. Los tres números llevan su cambio (`comparar`) y se suma
      // «Cuándo entran» (el «Visits by time» de Corbel: la franja horaria por día de la semana, en la zona del negocio).
      {
        id: id('la-apertura'), clase: 'grafico', tipo: 'frase', fuente: 'visitas', metricas: ['visitas', 'visitantes'], comparar: true,
        titulo: 'Tu página', frase: 'Entraron {visitas} visitas de {visitantes} personas · {visitas:cambio} que el período anterior',
        ir: 'web-generator', x: 0, y: 0, w: 12, h: 3,
      },
      // Las visitas y las personas ya las dice la frase: los números son lo que pasa ADENTRO de la página.
      kpi(id('la-mitad-pagina'), 'scroll', 'pct_50', 'Llegan a la mitad', '', 0, 3, { tipo: 'numero_tendencia', invertida: true, comparar: true, ir: 'web-generator' }),
      kpi(id('la-final'), 'scroll', 'pct_100', 'Llegan al final', '', 3, 3, { tipo: 'numero_tendencia', comparar: true }),
      kpi(id('la-tocan'), 'clics', 'personas', 'Tocan un botón', '', 6, 3, { tipo: 'numero_tendencia', comparar: true }),
      kpi(id('la-puntaje'), 'landing_analisis', 'puntaje', 'Puntaje de la página', '', 9, 3, { fecha: 'actual', ir: 'web-generator' }),
      { id: id('la-mapa-mapa'), clase: 'grafico', tipo: 'mapa_calor', fuente: 'toques', metricas: ['toques'], titulo: 'Mapa de calor', x: 0, y: 7, w: 12, h: 24 },
      {
        id: id('la-visitas-dia'), clase: 'grafico', tipo: 'serie', fuente: 'visitas', dimension: 'dia', metricas: ['visitas', 'visitantes'],
        titulo: 'Visitas por día', x: 0, y: 31, w: 8, h: 9, controles: [{ id: id('la-visitas-agrupar'), tipo: 'agrupar', agrupar: 'auto' }],
      },
      { id: id('la-origen'), clase: 'grafico', tipo: 'barras', fuente: 'visitas', dimension: 'origen', metricas: ['visitas'], limite: 10, titulo: 'De dónde llegan', x: 8, y: 31, w: 4, h: 9 },
      { id: id('la-scroll'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'scroll', metricas: ['medidos', 'llegaron_25', 'llegaron_50', 'llegaron_75', 'llegaron_100'], titulo: 'Hasta dónde bajan', x: 0, y: 40, w: 5, h: 10 },
      { id: id('la-clics'), clase: 'grafico', tipo: 'barras', fuente: 'clics', dimension: 'destino', metricas: ['clics'], ordenMetrica: 'clics', limite: 10, titulo: 'Qué botón tocan', x: 5, y: 40, w: 7, h: 10 },
      { id: id('la-grab-pagina'), clase: 'grafico', tipo: 'tabla_barras', fuente: 'replays', dimension: 'pagina', metricas: ['grabaciones', 'duracion', 'visitantes'], barra: 'grabaciones', titulo: 'Grabaciones por página', x: 0, y: 51, w: 12, h: 8 },
      // El diagnóstico que MaKo guardó de cada página (analizar es una tarea: vive en Landing Generator).
      { id: id('la-diagnostico'), clase: 'grafico', tipo: 'barras', fuente: 'landing_analisis', fecha: 'actual', dimension: 'pagina', metricas: ['puntaje'], ordenMetrica: 'puntaje', titulo: 'Diagnóstico de cada página', ir: 'web-generator', x: 0, y: 59, w: 12, h: 8 },
      // «Cuándo entran» (el «Visits by time» de Corbel): las visitas por franja horaria y día de la semana, con su orden fijo.
      {
        id: id('la-cuando'), clase: 'grafico', tipo: 'dinamica_calor', fuente: 'visitas', dimension: 'franja', desglose: 'dia_semana', metricas: ['visitas'],
        titulo: 'Cuándo entran', subtitulo: 'Las visitas por franja horaria y día de la semana', x: 0, y: 67, w: 12, h: 8,
      },
    ],
    diseno: {
      id: 'landing',
      piezas: {
        apertura: id('la-apertura'), mitad: id('la-mitad-pagina'), final: id('la-final'), tocan: id('la-tocan'), puntaje: id('la-puntaje'),
        diagnostico: id('la-diagnostico'), visitas: id('la-visitas-dia'), cuando: id('la-cuando'), origen: id('la-origen'), scroll: id('la-scroll'),
      },
    },
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
      // 4/11/2026 — HALDEN · MOORLY · TANDEM (docs/templates-dashboard-propuesta.md §7.3): «¿por qué se cerró o no, y quién cierra
      // mejor?». Halden abre con la frase de lo ganado y cómo terminaron las llamadas; Moorly, la lista; Tandem, el equipo lado a lado
      // y el score en el tiempo. ⚠️ El closer ve ESTA hoja (HOJA_DE_ROL): sólo llamadas, nunca la plata ni los leads.
      {
        id: id('cl-apertura'), clase: 'grafico', tipo: 'frase', fuente: 'llamadas_venta', metricas: ['llamadas', 'ganadas', 'tasa_cierre'], comparar: true,
        titulo: 'Tus llamadas', frase: 'Analizaste {llamadas} llamadas de venta · ganaste {ganadas} · cerraste el {tasa_cierre}, {tasa_cierre:cambio} que el período anterior',
        ir: 'crm', x: 0, y: 0, w: 12, h: 3,
      },
      // COMPOSICIÓN DEL 31/10/2026 (13 piezas → 10): cuatro números iguales, con la tasa de cierre primero porque es lo que la
      // hoja pregunta. R1 y R2 eran el mismo puntaje con un filtro, y el cruce closer × dimensión vuelve con un clic en la tabla.
      kpi(id('cl-tasa'), 'llamadas_venta', 'tasa_cierre', 'Tasa de cierre', '', 0, 3, { tipo: 'numero_tendencia', invertida: true }),
      kpi(id('cl-puntaje'), 'llamadas_venta', 'puntaje', 'Score promedio', '', 3, 3, { tipo: 'numero_tendencia' }),
      kpi(id('cl-analizadas'), 'llamadas_venta', 'llamadas', 'Analizadas', '', 6, 3, { tipo: 'numero_tendencia' }),
      kpi(id('cl-duracion'), 'llamadas_venta', 'duracion', 'Duración', '', 9, 3, { tipo: 'numero_tendencia' }),
      // El embudo (sube a portada: lib/graficos-portadas.ts) y lo que separa las ganadas de las perdidas.
      {
        id: id('cl-embudo-embudo'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'llamadas_venta', metricas: ['r1', 'r2', 'ganadas_r2'],
        titulo: 'Embudo de llamadas', subtitulo: 'Cuenta llamadas, no personas', x: 0, y: 7, w: 6, h: 10,
      },
      {
        id: id('cl-factores-barras'), clase: 'grafico', tipo: 'barras', fuente: 'llamadas_dimensiones', dimension: 'dimension', desglose: 'tono',
        metricas: ['puntaje'], titulo: 'Factores del cierre', x: 6, y: 7, w: 6, h: 10,
      },
      caja(id('cl-factores-ia'), 'Qué decide tus cierres', 'Qué decide los cierres: qué hacen distinto las llamadas ganadas', 0, 17, 12, 7,
        { fuentes: [id('cl-factores-barras')], largo: 'corto', formato: 'vinetas' }),
      // El equipo
      {
        id: id('cl-closers-tabla'), clase: 'grafico', tipo: 'tabla', fuente: 'llamadas_venta', dimension: 'closer', metricas: ['llamadas', 'puntaje', 'ganadas', 'tasa_cierre', 'ganadas_r2', 'perdidas'],
        titulo: 'El equipo de closers', x: 0, y: 24, w: 12, h: 10,
      },
      { id: id('cl-puntaje-semana'), clase: 'grafico', tipo: 'serie', fuente: 'llamadas_venta', dimension: 'semana', metricas: ['puntaje'], titulo: 'El score por semana', x: 6, y: 34, w: 6, h: 8 },
      // 5 · Las llamadas: traer las nuevas (el cron de siempre y este botón) y la lista, con su búsqueda y el
      //     pop-up «Llamada» (la ficha de cada una, con sus tareas).
      accion(id('cl-llamadas-sync'), 'sincronizar_llamadas', 'Sincronizar llamadas', 0, 42, 3, 2),
      {
        id: id('cl-llamadas-tabla'), clase: 'grafico', tipo: 'tabla', fuente: 'llamadas_venta', dimension: 'llamada', metricas: ['puntaje', 'duracion'],
        titulo: 'Las llamadas', limite: 50, x: 0, y: 44, w: 12, h: 16,
        tabla: { buscar: true, columnas: ['closer', 'reunion', 'dia'] },
        alClic: 'popup', popup: popupDe(POPUP_LLAMADA, id, 'cl-llamadas-tabla'),
      },
      // 6 · Lo que lee el DISEÑO de la hoja (app/dashboard/disenos/HojaClosing.tsx, la copia de Halden) y no estaba arriba:
      //     las llamadas de los últimos 7 días por día y las de los últimos 14 (las «Últimas llamadas», que el diseño ordena
      //     por día: la tabla de arriba va por puntaje). «Cómo terminaron» sale de los totales del equipo (ganadas en la R2 y
      //     perdidas, columnas suyas): el anillo de antes contaba lo mismo y la hoja no puede pasar de 14 paneles.
      {
        id: id('cl-semana'), clase: 'grafico', tipo: 'barras', fuente: 'llamadas_venta', dimension: 'dia', metricas: ['llamadas'],
        titulo: 'Llamadas de los últimos 7 días', x: 0, y: 63, w: 6, h: 8, controles: [periodoFijo(id('cl-semana-fecha'), 'ult7')],
      },
      {
        id: id('cl-ultimas'), clase: 'grafico', tipo: 'tabla', fuente: 'llamadas_venta', dimension: 'llamada', metricas: ['puntaje', 'duracion'],
        titulo: 'Últimas llamadas', subtitulo: 'Los últimos 14 días', limite: 50, x: 6, y: 63, w: 6, h: 8, controles: [periodoFijo(id('cl-ultimas-fecha'), 'ult14')],
        tabla: { columnas: ['closer', 'reunion', 'dia'] },
        alClic: 'popup', popup: popupDe(POPUP_LLAMADA, id, 'cl-ultimas'),
      },
    ],
    // El DISEÑO PROPIO (4/11/2026, Martín: «primero la copia… y después la adaptación»): mirando, la hoja se dibuja como la
    // copia de Halden (docs/diseno/mockups-dashboard/closing/), leyendo los datos de estas piezas. Editando, la grilla.
    diseno: {
      id: 'closing',
      piezas: {
        apertura: id('cl-apertura'), tasa: id('cl-tasa'), puntaje: id('cl-puntaje'), analizadas: id('cl-analizadas'), duracion: id('cl-duracion'),
        embudo: id('cl-embudo-embudo'), desenlace: id('cl-closers-tabla'), semana: id('cl-semana'), ultimas: id('cl-ultimas'),
        closers: id('cl-closers-tabla'), ia: id('cl-factores-ia'), sync: id('cl-llamadas-sync'), llamadas: id('cl-llamadas-tabla'),
      },
    },
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
    // 4/11/2026 — FERNLY · SUNROW (docs/templates-dashboard-propuesta.md §7.3): «¿qué avanza y qué se estancó?». Fernly abre con la
    // frase de cuánto hay en marcha y el avance de cada proyecto; Sunrow, lo que vence por semana y lo que queda en cada proyecto.
    componentes: [
      {
        id: id('pr-apertura'), clase: 'grafico', tipo: 'frase', fuente: 'ejecucion', fecha: 'actual', metricas: ['activas', 'en_curso', 'hechas'],
        titulo: 'Tu tablero', frase: 'Tienes {activas} tareas activas · {en_curso} en curso · {hechas} ya hechas', ir: 'plan', x: 0, y: 0, w: 12, h: 3,
      },
      kpi(id('pr-avance'), 'proyectos', 'avance_proyectos', 'Avance global', '', 0, 3, { invertida: true, ir: 'plan' }),
      kpi(id('pr-estancadas'), 'ejecucion', 'estancadas', 'Estancadas', '', 3, 3),
      kpi(id('pr-alta-sin'), 'ejecucion', 'alta_sin_deadline', 'Alta sin deadline', '', 6, 3),
      kpi(id('pr-cumplimiento'), 'ejecucion', 'cumplimiento', 'A tiempo', '', 9, 3),
      // Una barra de avance por proyecto (la barra de progreso de la tab), los activos. Sube a portada: lib/graficos-portadas.ts.
      {
        id: id('pr-avance-proyecto'), clase: 'grafico', tipo: 'barras', fuente: 'proyectos', dimension: 'proyecto',
        metricas: ['avance_proyectos'], ordenMetrica: 'avance_proyectos', limite: 50,
        titulo: 'Avance por proyecto', ir: 'plan', x: 0, y: 7, w: 12, h: 10,
        controles: [fijo(id('pr-avance-estado'), 'proyectos.estado', ['Activo'])],
      },
      // ¿Qué hago primero? La matriz (burbujas con los cuadrantes de la tab) y la pirámide, del mismo alto.
      {
        id: id('pr-matriz-burbujas'), clase: 'grafico', tipo: 'burbujas', fuente: 'proyectos', dimension: 'proyecto', metricas: ['esfuerzo', 'impacto', 'tareas'],
        titulo: 'Impacto × Esfuerzo', colorPor: 'cuadrante', limite: 50, x: 0, y: 17, w: 6, h: 10,
        ejes: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
        // [arriba-izq, arriba-der, abajo-izq, abajo-der] con x = esfuerzo, y = impacto (los de la tab vieja).
        referencias: { x: 50, y: 50, rotulos: ['Quick wins', 'Apuestas', 'Relleno', 'Trampas'] },
      },
      {
        id: id('pr-piramide-barras'), clase: 'grafico', tipo: 'barras', fuente: 'ejecucion', dimension: 'prioridad', metricas: ['activas'],
        titulo: 'Pirámide de prioridad', x: 6, y: 17, w: 6, h: 10,
      },
      // Lo que viene: lo que vence en las próximas semanas (mira hacia ADELANTE, con su período a la vista) y lo que queda abierto
      // en cada proyecto.
      {
        id: id('pr-vence'), clase: 'grafico', tipo: 'columnas', fuente: 'tareas', fecha: 'deadline', dimension: 'semana', metricas: ['abiertas'],
        titulo: 'Lo que vence, por semana', x: 0, y: 27, w: 6, h: 8, controles: [periodoVisible(id('pr-vence-p'), 'prox30')],
      },
      {
        id: id('pr-queda'), clase: 'grafico', tipo: 'barras', fuente: 'tareas', fecha: 'actual', dimension: 'proyecto', metricas: ['abiertas'],
        ordenMetrica: 'abiertas', limite: 10, titulo: 'Lo que queda en cada proyecto', x: 6, y: 27, w: 6, h: 8,
      },
      // ¿Qué huele mal? La misma lista con las tres columnas juntas: lo quieto arriba.
      {
        id: id('pr-huele-mal'), clase: 'grafico', tipo: 'tabla', fuente: 'ejecucion', dimension: 'tarea', metricas: ['dias_quieta', 'movidas_deadline', 'activas'],
        ordenMetrica: 'dias_quieta', limite: 20, titulo: 'Lo que huele mal', x: 0, y: 35, w: 12, h: 10,
        controles: [fijo(id('pr-huele-mal-f1'), 'ejecucion.estado', ['Activa'])],
      },
    ],
    // El DISEÑO PROPIO (4/11/2026): la copia de Fernly con los datos de MaKo (app/dashboard/disenos/HojaProductividad.tsx; qué
    // dibuja cada parte, lib/productividad-diseno.ts). La matriz de impacto × esfuerzo y lo que queda en cada proyecto quedan en la
    // grilla: Fernly no tiene dónde dibujarlas.
    diseno: {
      id: 'productividad',
      piezas: {
        apertura: id('pr-apertura'), avance: id('pr-avance'), estancadas: id('pr-estancadas'), alta: id('pr-alta-sin'),
        cumplimiento: id('pr-cumplimiento'), vence: id('pr-vence'), huele: id('pr-huele-mal'), proyectos: id('pr-avance-proyecto'),
        piramide: id('pr-piramide-barras'),
      },
    },
  }),
};

// ── VSL y YouTube (v5, punto 22; se llama así desde el 4/11/2026) ─────────────────────────────
// Lo del video sale del PIXEL (vsl_events, su resumen y los leads con visitor_id). Las vistas y su costo salen de
// `negocio` (YouTube del video marcado VSL más los plays de Panda), que hoy sólo tiene un cliente: para los demás
// esos dos números quedan sin dato. Sin `comparar` en los números del video: cada uno
// sería una lectura más de los eventos, que es lo más pesado del Dashboard (hallazgos-graficos.md, «La hoja
// Landing tardaba 51 s»).

const VSL: PlantillaHoja = {
  // 4/11/2026 — se llama «VSL y YouTube» (docs/templates-dashboard-propuesta.md §7.3): la MISMA forma que Hooks y retención, con otra
  // fuente. Pregunta «¿quién llega al final y ésos compran más?». Las vistas del VSL ya suman las de YouTube (el video marcado VSL) y los
  // plays de Panda (`negocio.vistas_vsl`), con su costo. El id sigue siendo `vsl-analyst`: las hojas guardadas y /vsl-analyst lo usan.
  id: 'vsl-analyst', nombre: 'VSL y YouTube', emoji: '🎥', buscar: 'VSL Analyst video de ventas',
  linea: 'Quién le da play a tu video, dónde se va, y si los que lo ven más agendan y compran más.',
  armar: (id: Id) => ({
    id: id('vsl-analyst'), nombre: 'VSL y YouTube', emoji: '🎥', subtitulo: 'Tu video de ventas: quién lo ve, hasta dónde, y qué pasa después.',
    controles: [
      { id: id('vs-periodo'), tipo: 'periodo', preset: 'ult30' },
      lista(id('vs-pagina'), 'pagina'),
      lista(id('vs-video'), 'video'),
    ],
    componentes: [
      {
        // Sin `comparar`: cada comparación es una lectura más de los eventos del video, lo más pesado del Dashboard.
        id: id('vs-apertura'), clase: 'grafico', tipo: 'frase', fuente: 'retencion_vsl', metricas: ['arrancaron', 'llegaron_final'],
        titulo: 'Tu video', frase: '{arrancaron} personas le dieron play · {llegaron_final} lo vieron entero',
        ir: 'web-generator', x: 0, y: 0, w: 12, h: 3,
      },
      // COMPOSICIÓN DEL 31/10/2026: play, llegan al final, agendan. La curva es LA forma del dato (sube a portada); el embudo de los
      // mismos cortes se fue, y las tasas por video viven como columnas. La caja de MaKo va al pie: arriba tapaba la pregunta.
      kpi(id('vs-final'), 'retencion_vsl', 'tasa_final', 'Llegan al final', '', 0, 3, { tipo: 'numero_tendencia', invertida: true }),
      kpi(id('vs-vistas'), 'negocio', 'vistas_vsl', 'Vistas del VSL', '', 3, 3, { tipo: 'numero_tendencia' }),
      kpi(id('vs-costo-vista'), 'negocio', 'costo_vsl', 'Costo por vista', '', 6, 3, { tipo: 'numero_tendencia', ir: 'ads-manager' }),
      kpi(id('vs-agendaron'), 'vsl', 'agendaron', 'Agendaron', '', 9, 3, { tipo: 'numero_tendencia', ir: 'crm' }),
      // La curva de la tab vieja (el bloque curva_vsl): cuántos siguen en cada corte del video.
      { id: id('vs-curva'), clase: 'grafico', tipo: 'area', fuente: 'retencion_vsl', dimension: 'corte', metricas: ['siguen'], titulo: 'Dónde se van', x: 0, y: 7, w: 12, h: 10 },
      {
        id: id('vs-tramos'), clase: 'grafico', tipo: 'columnas', fuente: 'vsl_leads', fecha: 'alta', dimension: 'tramo_visto', metricas: ['leads', 'agendas', 'cierres'],
        titulo: '¿Los que más ven, más compran?', x: 0, y: 17, w: 7, h: 10,
      },
      {
        id: id('vs-videos'), clase: 'grafico', tipo: 'tabla_barras', fuente: 'retencion_vsl', dimension: 'video', metricas: ['arrancaron', 'tasa_25', 'tasa_50', 'tasa_final'],
        ordenMetrica: 'arrancaron', barra: 'arrancaron', titulo: 'Por video', x: 7, y: 17, w: 5, h: 10,
      },
      {
        id: id('vs-vistas-semana'), clase: 'grafico', tipo: 'columnas', fuente: 'negocio', dimension: 'semana', metricas: ['vistas_vsl'],
        titulo: 'Vistas por semana', x: 0, y: 27, w: 12, h: 8,
      },
      caja(id('vs-ia'), 'Qué dice tu video', 'En qué parte del video se va la gente, y si los que lo ven más agendan más', 0, 35, 12, 6),
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
      // 4/11/2026 — MENDER · VITREA (docs/templates-dashboard-propuesta.md §7.3): «¿quién necesita atención y por qué se van?». Mender
      // abre con la frase de cuántos piden atención y lo que deben; Vitrea, por qué piden atención y la señal de cada uno. El ancla es
      // cuántos se dieron de baja. ⚠️ El `motivo` de la cartera es el de la SEÑAL (la regla que la prendió), no el de una baja: el motivo
      // de baja no se guarda todavía (docs/templates-dashboard-propuesta.md §7.4), así que la hoja no dice «por qué se van».
      {
        id: id('cs-apertura'), clase: 'grafico', tipo: 'frase', fuente: 'cartera', fecha: 'actual', metricas: ['atencion', 'clientes', 'deuda_vencida_usd'],
        titulo: 'Tu cartera', frase: '{atencion} de tus {clientes} clientes piden atención · deben {deuda_vencida_usd} vencidos', ir: 'clients', x: 0, y: 0, w: 12, h: 3,
      },
      kpi(id('cs-bajas'), 'cartera', 'clientes', 'Se dieron de baja', '', 0, 3, { invertida: true, controles: [fijo(id('cs-bajas-c'), 'cartera.estado', ['Baja'])] }),
      kpi(id('cs-pausados'), 'cartera', 'clientes', 'En pausa', '', 3, 3, { controles: [fijo(id('cs-pausados-c'), 'cartera.estado', ['Pausado'])] }),
      kpi(id('cs-cuotas'), 'cartera', 'cuotas_vencidas', 'Cuotas vencidas', '', 6, 3, { ir: 'cobranza' }),
      kpi(id('cs-sesiones'), 'llamadas', 'llamadas', 'Sesiones', '', 9, 3, {
        tipo: 'numero_tendencia', comparar: true, controles: [fijo(id('cs-sesiones-c'), 'llamadas.categoria', [ENTREGA])],
      }),
      {
        id: id('cs-tabla'), clase: 'grafico', tipo: 'tabla', fuente: 'cartera', dimension: 'cliente', metricas: ['atencion', 'deuda_vencida_usd', 'sesiones'],
        ordenMetrica: 'atencion', limite: 50, tabla: { columnas: ['senal', 'estado', 'tramo_contacto', 'producto'] }, titulo: 'Cada cliente', ir: 'clients', x: 0, y: 7, w: 12, h: 10,
      },
      { id: id('cs-etapas'), clase: 'grafico', tipo: 'barras', fuente: 'entrega', fecha: 'actual', dimension: 'etapa', metricas: ['clientes'], titulo: 'Dónde está cada cliente', x: 0, y: 17, w: 6, h: 8 },
      { id: id('cs-contacto'), clase: 'grafico', tipo: 'barras', fuente: 'cartera', dimension: 'tramo_contacto', metricas: ['clientes'], titulo: 'Hace cuánto no hablan', x: 6, y: 17, w: 6, h: 8 },
      {
        id: id('cs-motivos'), clase: 'grafico', tipo: 'barras', fuente: 'cartera', dimension: 'motivo', metricas: ['clientes'], titulo: 'Por qué piden atención',
        x: 0, y: 25, w: 6, h: 8, controles: [fijo(id('cs-motivos-c'), 'cartera.senal', ['Atención'])],
      },
      { id: id('cs-senal'), clase: 'grafico', tipo: 'anillo', fuente: 'cartera', dimension: 'senal', metricas: ['clientes'], titulo: 'Cómo están', x: 6, y: 25, w: 6, h: 8 },
      {
        id: id('cs-semanas'), clase: 'grafico', tipo: 'serie', fuente: 'llamadas', dimension: 'semana', metricas: ['llamadas'], titulo: 'Sesiones por semana',
        x: 0, y: 33, w: 12, h: 8, controles: [fijo(id('cs-semanas-c'), 'llamadas.categoria', [ENTREGA])],
      },
      // 4/11/2026 (el diseño de Mender, su «Case pipeline»): cada cliente con su etapa de la entrega en el CRUCE, para dibujar un carril
      // por etapa. El cruce (y no una columna de la tabla) porque un cliente de dos servicios está en dos etapas: la columna las junta en un
      // texto («Arranque, Entrega») que no se puede partir.
      {
        id: id('cs-carriles'), clase: 'grafico', tipo: 'barras_apiladas', fuente: 'entrega', fecha: 'actual', dimension: 'cliente', desglose: 'etapa',
        metricas: ['clientes'], limite: 50, titulo: 'Cada cliente, por etapa', ir: 'clients', x: 0, y: 41, w: 12, h: 10,
      },
      caja(id('cs-ia'), 'Quién necesita atención', 'Qué señales de la cartera piden atención y qué conviene hacer esta semana', 0, 51, 12, 7),
    ],
    // 4/11/2026 — EL DISEÑO DE MENDER (docs/diseno/mockups-dashboard/cs-mender/): mirando, la hoja la dibuja app/dashboard/disenos/HojaCs.tsx
    // con estas piezas (lib/cs-diseno.ts arma cada parte, con test). Las pausas, las cuotas vencidas, las sesiones por semana y la caja de
    // MaKo quedan en la grilla: Mender no tiene dónde dibujarlas.
    diseno: {
      id: 'cs',
      piezas: {
        apertura: id('cs-apertura'), sesiones: id('cs-sesiones'), carriles: id('cs-carriles'), etapas: id('cs-etapas'), tabla: id('cs-tabla'),
        motivos: id('cs-motivos'), senal: id('cs-senal'), contacto: id('cs-contacto'), bajas: id('cs-bajas'),
      },
    },
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
      // 4/11/2026 — PARLEY · TEND (docs/templates-dashboard-propuesta.md §7.3): «¿cuánto tardamos en contestar y eso cierra?». Parley
      // abre con la frase de cuántas veces te escribieron y cuántas respondiste; el ancla es el tiempo de respuesta. Tend pone ese
      // tiempo por día y lo que rinden las automatizaciones. ⚠️ El setter ve ESTA hoja (HOJA_DE_ROL): todo sale de los chats, los
      // envíos y las personas en automatizaciones, nunca de los leads ni la plata.
      {
        id: id('ch-apertura'), clase: 'grafico', tipo: 'frase', fuente: 'conversaciones', metricas: ['turnos', 'pct_respondidos'], comparar: true,
        titulo: 'Tus chats', frase: 'Te escribieron {turnos} veces · respondiste el {pct_respondidos} · {pct_respondidos:cambio} que el período anterior',
        ir: 'chats', x: 0, y: 0, w: 12, h: 3,
      },
      kpi(id('ch-mediana'), 'conversaciones', 'mediana_respuesta', 'Tiempo de respuesta', '', 0, 3, { tipo: 'numero_tendencia', invertida: true }),
      kpi(id('ch-recibidos'), 'whatsapp', 'recibidos', 'Recibidos', '', 3, 3, { tipo: 'numero_tendencia', comparar: true }),
      kpi(id('ch-chats'), 'whatsapp', 'chats', 'Chats', '', 6, 3, { tipo: 'numero_tendencia' }),
      kpi(id('ch-esperando'), 'conversaciones', 'sin_responder', 'Esperando', '', 9, 3, { fecha: 'actual', ir: 'chats' }),
      kpi(id('ch-rapidos'), 'conversaciones', 'pct_rapidos', 'Respondidos en 15 min', '', 0, 7, { comparar: true }),
      // 4/11/2026 (el diseño de Parley): la otra punta del tiempo de respuesta. La mediana dice cómo te va casi siempre; el p90, cuánto
      // esperan los que más esperan (ws1: mediana 3 min y p90 71 h).
      kpi(id('ch-lento'), 'conversaciones', 'p90_respuesta', 'Respuesta más lenta (p90)', '', 3, 7),
      {
        id: id('ch-por-dia'), clase: 'grafico', tipo: 'serie', fuente: 'whatsapp', dimension: 'dia', metricas: ['recibidos', 'enviados'], titulo: 'Mensajes por día',
        x: 0, y: 11, w: 12, h: 8, controles: [{ id: id('ch-por-dia-agrupar'), tipo: 'agrupar', agrupar: 'auto' }],
      },
      { id: id('ch-setters'), clase: 'grafico', tipo: 'barras', fuente: 'conversaciones', dimension: 'setter', metricas: ['turnos', 'pct_rapidos'], titulo: 'Por setter', x: 0, y: 19, w: 6, h: 8 },
      { id: id('ch-lineas'), clase: 'grafico', tipo: 'columnas_apiladas', fuente: 'whatsapp', dimension: 'linea', desglose: 'direccion', metricas: ['mensajes'], titulo: 'Por línea', x: 6, y: 19, w: 6, h: 8 },
      // 4/11/2026 (el diseño de Parley, su «Messages by month»): cada día, cuántas veces te escribieron y cuántas respondiste. Reemplaza
      // al porcentaje de rápidos por día, que ya dicen la tarjeta de «Respondidos en 15 min» y el tiempo de respuesta.
      {
        id: id('ch-respondidos-dia'), clase: 'grafico', tipo: 'serie', fuente: 'conversaciones', dimension: 'dia', metricas: ['turnos', 'respondidos'],
        titulo: 'Te escribieron y respondiste, por día', x: 0, y: 27, w: 12, h: 8, controles: [{ id: id('ch-respondidos-agrupar'), tipo: 'agrupar', agrupar: 'auto' }],
      },
      {
        id: id('ch-automatizaciones'), clase: 'grafico', tipo: 'barras', fuente: 'inscripciones', fecha: 'alta', dimension: 'automatizacion', metricas: ['tasa_respuesta'],
        ordenMetrica: 'tasa_respuesta', limite: 8, titulo: 'Te contestan, por automatización', ir: 'automations', x: 0, y: 35, w: 6, h: 8,
      },
      // 4/11/2026 (el diseño de Parley, su «Channel mix»): qué te mandan y qué mandas (texto, audio, imagen…). Nunca se lee un mensaje.
      { id: id('ch-tipos'), clase: 'grafico', tipo: 'columnas_apiladas', fuente: 'whatsapp', dimension: 'tipo', desglose: 'direccion', metricas: ['mensajes'], titulo: 'Qué tipo de mensaje', x: 6, y: 35, w: 6, h: 8 },
      caja(id('ch-ia'), 'Dónde se enfría el chat', 'En qué momento se enfrían las conversaciones y qué responder mejor', 0, 43, 12, 7),
    ],
    // 4/11/2026 — EL DISEÑO DE PARLEY (docs/diseno/mockups-dashboard/chat-parley/): mirando, la hoja la dibuja
    // app/dashboard/disenos/HojaChat.tsx con estas piezas (lib/chat-diseno.ts arma cada parte, con test). Las líneas, las
    // automatizaciones y la caja de MaKo quedan en la grilla: Parley no tiene dónde dibujarlas.
    diseno: {
      id: 'chat',
      piezas: {
        apertura: id('ch-apertura'), recibidos: id('ch-recibidos'), chats: id('ch-chats'), esperando: id('ch-esperando'), rapidos: id('ch-rapidos'),
        mediana: id('ch-mediana'), lento: id('ch-lento'), dias: id('ch-por-dia'), respondidos: id('ch-respondidos-dia'), tipos: id('ch-tipos'),
        setters: id('ch-setters'),
      },
    },
  }),
};

/**
 * Ads Analyst, Landing Analyst, Closing Analyst, Productivity Analyst y, desde v5, VSL, CS y Chat Analyst: lo que
 * es ANÁLISIS. El orden es el CAMINO del negocio que tenía el desplegable de la sidebar: lo que trae a la gente
 * (el anuncio, la landing, el video), lo que pasa con la persona (el chat, la llamada, el cliente) y el tablero.
 */
export const PLANTILLAS_ANALYSTS: readonly PlantillaHoja[] = [ADS, HOOKS, LANDING, VSL, CHAT, CLOSING, CS, PRODUCTIVIDAD];
