// =============================================================================
// graficos-plantillas-analysts — las tabs de Analysts como plantillas del Dashboard (punto 22)
// =============================================================================
// Martín, 11/10/2026: «Implementa como TEMPLATE, y en el caso de Mauricio, como tabs, todas las tabs
// de la sidebar en la sección de "analysts". Excepto las partes donde se ejecuta tareas, no análisis...
// Pero si puedes poner un template de landing con la cantidad de datos que tenemos, de clicks,
// retención, mapa de calor, grabaciones, etc...».
//
// Una hoja por tab: «Ads Analyst», «Landing», «Closing» y «Productividad», cada una con SU período arriba.
// Las TAREAS se mudaron el 11/10/2026 (decisiones de Martín), y no todas al mismo lugar:
//   · Ads Analyst → a Ads Writer (analizar un guion nuevo, sincronizar, ángulos y avatares). Su hoja mira.
//   · Landing Analyst → a Landing Generator (analizar o pegar una página). Su hoja mira.
//   · Closing va COMPLETO a su hoja, y la tab se elimina: la hoja EJECUTA. El bloque «Las llamadas»
//     sincroniza, y la ficha de cada llamada revisa a mano, re-evalúa con MaKo y re-analiza (admin y
//     closer, como la tab; las rutas lo vuelven a mirar: app/api/closing/puerta.ts).
//   «Una hoja del Dashboard mira, no ejecuta» ya no vale para Closing.
//
// Los conjuntos nuevos están en lib/graficos-fuentes-extra.ts y los bloques en
// lib/graficos-bloques-extra-catalogo.ts. Los ids locales van con guiones y sin guion bajo: armados con
// ids FIJOS (`armar((l) => l)`) tienen que pasar `idValido` (lib/graficos-catalogo.ts).
//
// ⚠️ Ads Analyst y Closing van con el período «Todo» porque sus tabs son el HISTÓRICO COMPLETO: con los
// 30 días de siempre la hoja mostraría otros números que la tab sin decirlo.
// ⚠️ Puro y sin server-only. Y SIN datos de ningún cliente (un ejemplo de pantalla es ficticio por regla).

import type { PlantillaHoja } from './graficos-plantillas';

type Id = (local: string) => string;
const kpi = (id: string, fuente: string, metrica: string, titulo: string, subtitulo: string, x: number, y: number, extra: Record<string, unknown> = {}) =>
  ({ id, clase: 'grafico', tipo: 'numero', fuente, metricas: [metrica], titulo, subtitulo, x, y, w: 3, h: 4, ...extra });
const lista = (id: string, campo: string, valores: string[] | null = null) => ({ id, tipo: 'lista', campo, valores });
const bloque = (id: string, b: string, x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}) =>
  ({ id, clase: 'bloque', bloque: b, x, y, w, h, ...extra });

const ADS: PlantillaHoja = {
  id: 'ads-analyst', nombre: 'Ads Analyst', emoji: '🎬',
  linea: 'Hook rate, retención y veredicto de cada guion, los patrones y el cuadrante de retención.',
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
        controles: [lista(id('ad-sin-retorno-c'), 'guiones.resultado', ['Sin agendas'])],
      }),
      // 2 · Patrones (Sigue / Corta / Proceso) y muestra chica: el histórico completo, como la tab
      bloque(id('ad-patrones'), 'patrones_guiones', 0, 4, 12, 14),
      // 3 · El cuadrante de retención, con la ventana de la hoja
      bloque(id('ad-cuadrante'), 'cuadrante_retencion', 0, 18, 12, 13),
      // 4 · Todos los guiones
      {
        id: id('ad-tabla'), clase: 'grafico', tipo: 'tabla_barras', fuente: 'guiones', dimension: 'guion',
        metricas: ['hook_rate', 'retencion_final', 'gasto', 'agendas', 'cpa', 'cierres'], ordenMetrica: 'cierres', limite: 50,
        titulo: 'Guiones', x: 0, y: 31, w: 12, h: 12,
      },
      // 5 · Los patrones que sí son un gráfico
      { id: id('ad-eficiencia'), clase: 'grafico', tipo: 'barras', fuente: 'guiones', dimension: 'angulo', metricas: ['agendas_1k'], titulo: 'Agendas por US$1.000, por ángulo', x: 0, y: 43, w: 6, h: 9 },
      { id: id('ad-gancho'), clase: 'grafico', tipo: 'barras', fuente: 'guiones', dimension: 'gancho', metricas: ['hook_rate'], titulo: 'Hook rate por tipo de gancho', x: 6, y: 43, w: 6, h: 9 },
      { id: id('ad-veredicto'), clase: 'grafico', tipo: 'barras', fuente: 'guiones', dimension: 'veredicto', metricas: ['gasto'], titulo: 'Gasto por veredicto', x: 0, y: 52, w: 6, h: 9 },
      {
        id: id('ad-muestra'), clase: 'grafico', tipo: 'tabla', fuente: 'guiones', dimension: 'guion', metricas: ['gasto', 'hook_rate', 'agendas'],
        titulo: 'Muestra chica', subtitulo: 'menos de 8 mil impresiones', x: 6, y: 52, w: 6, h: 9,
        controles: [lista(id('ad-muestra-c'), 'guiones.confianza', ['Baja'])],
      },
      // 6 · El embudo del video (todos los cuartiles de Meta) y el reparto por ángulo
      { id: id('ad-video'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'guiones', metricas: ['plays_3s', 'p25', 'p50', 'p75', 'p100'], titulo: 'Cuánto ven el video', x: 0, y: 61, w: 6, h: 12 },
      { id: id('ad-angulos'), clase: 'grafico', tipo: 'circular', fuente: 'guiones', dimension: 'angulo', metricas: ['guiones'], titulo: 'Guiones por ángulo', x: 6, y: 61, w: 6, h: 12 },
    ],
  }),
};

const LANDING: PlantillaHoja = {
  id: 'landing', nombre: 'Landing', emoji: '🧭',
  linea: 'Visitas, de dónde llegan, scroll, clics, mapa de calor, retención del video y grabaciones.',
  armar: (id: Id) => ({
    id: id('landing'), nombre: 'Landing', emoji: '🧭', subtitulo: 'Lo que mide tu Pixel: cuánta gente entra, hasta dónde baja y qué toca.',
    controles: [
      { id: id('la-periodo'), tipo: 'periodo', preset: 'ult30' },
      lista(id('la-pagina'), 'pagina'),
    ],
    componentes: [
      // 1 · Cuánta gente y hasta dónde llega
      kpi(id('la-visitas'), 'visitas', 'visitas', 'Visitas', 'contra el período anterior', 0, 0, { comparar: true }),
      kpi(id('la-personas'), 'visitas', 'visitantes', 'Personas distintas', 'que entraron a tus páginas', 3, 0),
      kpi(id('la-mitad-pagina'), 'scroll', 'pct_50', 'Llegan a la mitad', 'de las personas con scroll medido', 6, 0),
      kpi(id('la-mitad-video'), 'retencion_vsl', 'tasa_50', 'Ven la mitad del video', 'de los que tienen avance medido', 9, 0),
      // 2 · Las visitas y de dónde vienen
      {
        id: id('la-visitas-dia'), clase: 'grafico', tipo: 'serie', fuente: 'visitas', dimension: 'dia', metricas: ['visitas', 'visitantes'],
        titulo: 'Visitas por día', x: 0, y: 4, w: 8, h: 9, controles: [{ id: id('la-visitas-agrupar'), tipo: 'agrupar', agrupar: 'auto' }],
      },
      { id: id('la-origen'), clase: 'grafico', tipo: 'barras', fuente: 'visitas', dimension: 'origen', metricas: ['visitas'], limite: 10, titulo: 'De dónde llegan', x: 8, y: 4, w: 4, h: 9 },
      // 3 · Hasta dónde bajan y qué tocan
      { id: id('la-scroll'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'scroll', metricas: ['medidos', 'llegaron_25', 'llegaron_50', 'llegaron_75', 'llegaron_100'], titulo: 'Hasta dónde bajan', subtitulo: 'personas con scroll medido', x: 0, y: 13, w: 6, h: 12 },
      { id: id('la-clics'), clase: 'grafico', tipo: 'tabla_barras', fuente: 'clics', dimension: 'destino', metricas: ['clics', 'personas'], ordenMetrica: 'clics', limite: 10, titulo: 'Qué botón tocan', x: 6, y: 13, w: 6, h: 12 },
      // 4 · El mapa de calor de la tab, con «Lo más tocado»
      bloque(id('la-mapa'), 'mapa_calor', 0, 25, 12, 24),
      // 5 · La retención del video: la curva y el embudo por cuartos
      bloque(id('la-curva'), 'curva_vsl', 0, 49, 8, 12),
      { id: id('la-video'), clase: 'grafico', tipo: 'embudo_vertical', fuente: 'retencion_vsl', metricas: ['arrancaron', 'medidos', 'pasaron_25', 'pasaron_50', 'pasaron_75', 'llegaron_final'], titulo: 'Cuánto ven el video', x: 8, y: 49, w: 4, h: 12 },
      // 6 · Las grabaciones
      kpi(id('la-grabaciones'), 'replays', 'grabaciones', 'Grabaciones', 'sesiones grabadas en tus páginas', 0, 61),
      kpi(id('la-duracion'), 'replays', 'duracion', 'Duración promedio', 'de cada grabación', 3, 61),
      { id: id('la-grab-pagina'), clase: 'grafico', tipo: 'tabla', fuente: 'replays', dimension: 'pagina', metricas: ['grabaciones', 'duracion', 'visitantes'], titulo: 'Grabaciones por página', x: 0, y: 65, w: 6, h: 6 },
      { id: id('la-corte'), clase: 'grafico', tipo: 'circular', fuente: 'replays', dimension: 'corte', metricas: ['grabaciones'], titulo: 'Cómo terminaron', x: 6, y: 61, w: 6, h: 10 },
      // 7 · El diagnóstico que MaKo guardó de cada página (analizar es una tarea: vive en su tab)
      { id: id('la-diagnostico'), clase: 'grafico', tipo: 'tabla_barras', fuente: 'landing_analisis', fecha: 'actual', dimension: 'pagina', metricas: ['puntaje', 'hallazgos_altos'], titulo: 'Diagnóstico de cada página', x: 0, y: 71, w: 12, h: 8 },
    ],
  }),
};

const CLOSING: PlantillaHoja = {
  id: 'closing', nombre: 'Closing', emoji: '📞',
  linea: 'El puntaje de tus llamadas, el embudo R1 → R2 → cierre, los factores, los closers y cada llamada.',
  armar: (id: Id) => ({
    id: id('closing'), nombre: 'Closing', emoji: '📞', subtitulo: 'Las llamadas de venta analizadas: qué decide tus cierres.',
    controles: [
      { id: id('cl-periodo'), tipo: 'periodo', preset: 'todo' },
      lista(id('cl-closer'), 'closer'),
    ],
    componentes: [
      // 1 · Los KPI de la tab. «Analizadas» cuenta las ventas con análisis completo del período; las de
      //     servicio excluidas y las sin analizar las dice la línea de «Las llamadas» (son de todo el historial).
      kpi(id('cl-puntaje'), 'llamadas_venta', 'puntaje', 'Score promedio', 'de 10, llamadas con puntaje', 0, 0),
      kpi(id('cl-r1'), 'llamadas_venta', 'puntaje', 'R1', 'diagnóstico', 3, 0, { w: 2, controles: [lista(id('cl-r1-c'), 'llamadas_venta.reunion', ['R1'])] }),
      kpi(id('cl-r2'), 'llamadas_venta', 'puntaje', 'R2', 'cierre', 5, 0, { w: 2, controles: [lista(id('cl-r2-c'), 'llamadas_venta.reunion', ['R2'])] }),
      kpi(id('cl-tasa'), 'llamadas_venta', 'tasa_cierre', 'Tasa de cierre', 'R2 ganadas ÷ R2', 7, 0, { w: 2 }),
      kpi(id('cl-analizadas'), 'llamadas_venta', 'llamadas', 'Analizadas', 'llamadas de venta con análisis', 9, 0),
      // 2 · El embudo y la tendencia mensual del score (doce meses: una línea de años no se lee)
      bloque(id('cl-embudo'), 'embudo_cierre', 0, 4, 6, 10),
      { id: id('cl-tendencia'), clase: 'grafico', tipo: 'serie', fuente: 'llamadas_venta', dimension: 'mes', metricas: ['puntaje'], periodo: 'ult12m', titulo: 'Tendencia del score', x: 6, y: 4, w: 6, h: 10 },
      // 3 · Qué separa las ganadas de las perdidas, y el equipo
      bloque(id('cl-factores'), 'factores_cierre', 0, 14, 12, 14),
      bloque(id('cl-closers'), 'closers_cierre', 0, 28, 12, 10),
      {
        id: id('cl-punto-debil'), clase: 'grafico', tipo: 'dinamica_calor', fuente: 'llamadas_dimensiones', dimension: 'closer', desglose: 'dimension',
        metricas: ['puntaje'], titulo: 'Puntaje por closer y dimensión', x: 0, y: 38, w: 12, h: 10,
      },
      // 4 · Las llamadas: la lista de la tab y la entrada a cada ficha (con sus tareas)
      bloque(id('cl-llamadas'), 'llamadas_cierre', 0, 48, 12, 18),
    ],
  }),
};

const PRODUCTIVIDAD: PlantillaHoja = {
  id: 'productividad', nombre: 'Productividad', emoji: '✅',
  linea: 'Tus proyectos: avance, impacto × esfuerzo, pirámide de prioridad y lo que se estancó.',
  armar: (id: Id) => ({
    id: id('productividad'), nombre: 'Productividad', emoji: '✅', subtitulo: 'Lo que produjo tu tablero: qué hacer primero y qué huele mal.',
    // Sin período: todo es la foto de hoy del tablero.
    controles: [],
    componentes: [
      // 1 · Los seis números de la tab
      kpi(id('pr-proyectos'), 'proyectos', 'proyectos', 'Proyectos', 'en el tablero', 0, 0, { w: 2 }),
      kpi(id('pr-avance'), 'proyectos', 'avance_proyectos', 'Avance global', 'promedio por proyecto', 2, 0, { w: 2 }),
      kpi(id('pr-completos'), 'proyectos', 'completos', 'Completados', 'todas sus tareas hechas', 4, 0, { w: 2 }),
      kpi(id('pr-activas'), 'ejecucion', 'activas', 'Tareas activas', 'sin las que se repiten', 6, 0, { w: 2 }),
      kpi(id('pr-wip'), 'ejecucion', 'en_curso', 'En curso (WIP)', 'activas con avance', 8, 0, { w: 2 }),
      kpi(id('pr-alta-sin'), 'ejecucion', 'alta_sin_deadline', 'Alta sin deadline', 'riesgo de no cerrarse', 10, 0, { w: 2 }),
      // 2 · ¿Qué hago primero?
      bloque(id('pr-matriz'), 'matriz_proyectos', 0, 4, 7, 14),
      bloque(id('pr-piramide'), 'piramide_prioridad', 7, 4, 5, 14),
      // 3 · ¿Cómo venimos? (como la tab: arranca mostrando los activos)
      {
        id: id('pr-avance-proyecto'), clase: 'grafico', tipo: 'tabla_barras', fuente: 'proyectos', dimension: 'proyecto',
        metricas: ['avance_proyectos', 'hechas', 'tareas'], ordenMetrica: 'avance_proyectos', limite: 50,
        titulo: 'Avance por proyecto', x: 0, y: 18, w: 12, h: 10,
        controles: [lista(id('pr-avance-estado'), 'proyectos.estado', ['Activo'])],
      },
      // 4 · ¿Eres disciplinado con los tiempos?
      kpi(id('pr-cumplimiento'), 'ejecucion', 'cumplimiento', 'A tiempo', 'de lo terminado con deadline', 0, 28),
      kpi(id('pr-atraso'), 'ejecucion', 'atraso_prom', 'Atraso promedio', 'días, de las que llegaron tarde', 3, 28),
      kpi(id('pr-cerradas'), 'ejecucion', 'cerradas_con_deadline', 'Terminadas con deadline', 'las que cuentan para el cumplimiento', 0, 32),
      kpi(id('pr-estancadas'), 'ejecucion', 'estancadas', 'Estancadas', '7 días o más sin movimiento', 3, 32),
      { id: id('pr-ciclo'), clase: 'grafico', tipo: 'barras', fuente: 'ejecucion', dimension: 'prioridad', metricas: ['ciclo'], titulo: 'Cycle time por prioridad', subtitulo: 'días de crear a completar', x: 6, y: 28, w: 6, h: 8 },
      // 5 · ¿Qué huele mal?
      bloque(id('pr-atencion'), 'tareas_atencion', 0, 36, 12, 12),
    ],
  }),
};

/** Ads Analyst, Landing Analyst, Closing Analyst, Productivity Analyst: lo que es ANÁLISIS. */
export const PLANTILLAS_ANALYSTS: readonly PlantillaHoja[] = [ADS, LANDING, CLOSING, PRODUCTIVIDAD];
