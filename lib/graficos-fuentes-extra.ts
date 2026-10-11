// =============================================================================
// graficos-fuentes-extra — los conjuntos de datos de las tabs de Analysts, como plantillas del Dashboard
// =============================================================================
// Martín, 11/10/2026: «Implementa como TEMPLATE... todas las tabs de la sidebar en la sección de
// "analysts". Excepto las partes donde se ejecuta tareas». Cada conjunto declarado acá necesita su
// lector en lib/graficos-datos-extra.ts (`LECTORES_EXTRA`): el test de tests/graficos.test.ts cruza
// las dos listas.
// Puro y sin `server-only`.
//
// Lo que NO entra en el agregador (el cuadrante de retención, los patrones, el mapa de calor, el
// embudo y los factores del cierre, la matriz impacto × esfuerzo…) va como BLOQUE
// (lib/graficos-bloques-extra-catalogo.ts). Acá sólo lo que se puede sumar fila por fila.
//
// ⚠️ LAS RAZONES DE LA RETENCIÓN Y DEL SCROLL SE DIVIDEN POR LOS MEDIDOS, NUNCA POR LOS QUE
// ENTRARON (lib/vsl-retencion.ts y lib/landing-pulso.ts). Con el Pixel viejo «medidos» es chico y
// «el 0,2% llega a la oferta» sería mentira: lo que pasa es que no se mide. Con 0 medidos la razón
// da vacío, nunca 0%.
//
// ⚠️ IMPACTO Y ESFUERZO SON ATRIBUTOS, NO SUMAS (`sinTotal`): se leen por proyecto. Agrupados por
// otra cosa (estado, cuadrante) el agregador los sumaría y el número no significaría nada.

import { TIEMPO, cat, dist, m, r, type Fuente, type Metrica } from './graficos-constructores';

const atributo = (id: string, nombre: string): Metrica => ({ ...m(id, nombre), sinTotal: true });

export const FUENTES_EXTRA: readonly Fuente[] = [
  // ── Ads Analyst ───────────────────────────────────────────────────────────────────────
  {
    // La pauta de Meta de cada anuncio ANALIZADO, día por día, con lo que dijo el análisis del
    // guion (ángulo, gancho, avatar) y el veredicto de la tab calculado sobre la ventana elegida.
    id: 'guiones', nombre: 'Guiones de anuncios', area: 'Marketing',
    descripcion: 'Cada anuncio analizado con su pauta: hook rate, retención, agendas y veredicto.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [
      ...TIEMPO, cat('guion', 'Guion'), cat('angulo', 'Ángulo'), cat('gancho', 'Tipo de gancho'), cat('formato', 'Formato'),
      cat('avatar', 'Avatar'), cat('tipo', 'Video o imagen'), cat('campana', 'Campaña'), cat('conjunto', 'Conjunto'),
      cat('veredicto', 'Veredicto'), cat('confianza', 'Confianza'), cat('resultado', 'Resultado'),
    ],
    metricas: [
      m('gasto', 'Gasto', 'usd'), m('impresiones', 'Impresiones'), m('plays_3s', 'Reproducciones de 3 s'), m('thruplays', 'ThruPlays'),
      m('p25', 'Vieron el 25%'), m('p50', 'Vieron el 50%'), m('p75', 'Vieron el 75%'), m('p100', 'Vieron todo'),
      m('clics', 'Clics'), m('leads', 'Leads'), m('agendas', 'Agendas'), m('cierres', 'Cierres'), dist('guiones', 'Guiones'),
      r('hook_rate', 'Hook rate', 'pct', 'plays_3s', 'impresiones', 100),
      r('retencion_final', 'Retención al final', 'pct', 'p100', 'plays_3s', 100),
      r('thruplay_rate', 'ThruPlay rate', 'pct', 'thruplays', 'plays_3s', 100),
      r('ctr', 'CTR', 'pct', 'clics', 'impresiones', 100),
      r('cpa', 'Costo por agenda', 'usd', 'gasto', 'agendas'),
      r('agendas_1k', 'Agendas por US$1.000', 'numero', 'agendas', 'gasto', 1000),
      r('costo_cierre', 'Costo por cierre', 'usd', 'gasto', 'cierres'),
    ],
  },
  // ── Landing Analyst ───────────────────────────────────────────────────────────────────
  {
    id: 'clics', nombre: 'Clics en la landing', area: 'Marketing',
    descripcion: 'Qué botón tocan en tus páginas: el destino, el texto y cuánta gente distinta.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('pagina', 'Página'), cat('destino', 'Destino'), cat('texto', 'Texto del botón'), cat('dispositivo', 'Dispositivo')],
    metricas: [m('clics', 'Clics'), dist('personas', 'Personas')],
  },
  {
    // Una fila por persona y página: hasta dónde bajó (el máximo), contado una sola vez.
    id: 'scroll', nombre: 'Hasta dónde bajan', area: 'Marketing',
    descripcion: 'Cuánta gente llega al 25, 50, 75 y 100% de cada página.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('pagina', 'Página')],
    metricas: [
      m('medidos', 'Personas medidas'), m('llegaron_25', 'Llegaron al 25%'), m('llegaron_50', 'Llegaron al 50%'),
      m('llegaron_75', 'Llegaron al 75%'), m('llegaron_100', 'Llegaron al final'),
      r('pct_25', 'Llegan al 25%', 'pct', 'llegaron_25', 'medidos', 100), r('pct_50', 'Llegan a la mitad', 'pct', 'llegaron_50', 'medidos', 100),
      r('pct_75', 'Llegan al 75%', 'pct', 'llegaron_75', 'medidos', 100), r('pct_100', 'Llegan al final', 'pct', 'llegaron_100', 'medidos', 100),
    ],
  },
  {
    // Los toques con su punto (Pixel v20+): botones y lo que no es un botón. Lo mismo que el mapa de calor.
    id: 'toques', nombre: 'Toques en la página', area: 'Marketing',
    descripcion: 'Lo más tocado de cada página: botones, imágenes y textos, en celular o computadora.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('pagina', 'Página'), cat('lugar', 'Qué tocaron'), cat('tipo', 'Botón o no'), cat('dispositivo', 'Dispositivo')],
    metricas: [m('toques', 'Toques'), dist('personas', 'Personas')],
  },
  {
    // Una fila por persona y video: su avance máximo (con la duración de Panda cuando el
    // evento sólo trae segundos). Sólo eventos DEL VIDEO: un clic o un scroll no es mirarlo.
    id: 'retencion_vsl', nombre: 'Cuánto ven el video', area: 'Marketing',
    descripcion: 'De los que le dieron play a tu video, cuántos llegan al 25, 50, 75% y al final.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('video', 'Video'), cat('pagina', 'Página')],
    metricas: [
      m('arrancaron', 'Le dieron play'), m('medidos', 'Con avance medido'), m('pasaron_25', 'Pasaron el 25%'),
      m('pasaron_50', 'Pasaron la mitad'), m('pasaron_75', 'Pasaron el 75%'), m('llegaron_final', 'Llegaron al final'),
      r('tasa_25', 'Pasan el 25%', 'pct', 'pasaron_25', 'medidos', 100), r('tasa_50', 'Pasan la mitad', 'pct', 'pasaron_50', 'medidos', 100),
      r('tasa_75', 'Pasan el 75%', 'pct', 'pasaron_75', 'medidos', 100), r('tasa_final', 'Llegan al final', 'pct', 'llegaron_final', 'medidos', 100),
    ],
  },
  {
    // El diagnóstico que MaKo guardó de cada página (landing_analyses). Es una FOTO: se
    // recalcula al volver a analizar, no sola. Analizar es una tarea y no vive acá.
    id: 'landing_analisis', nombre: 'Diagnósticos de landing', area: 'Marketing',
    descripcion: 'El puntaje y los hallazgos que MaKo le encontró a cada página.',
    fechas: [{ id: 'actual', nombre: 'Todas (hoy)', sinRango: true }, { id: 'analizada', nombre: 'Analizada' }],
    dimensiones: [...TIEMPO, cat('pagina', 'Página'), cat('veredicto', 'Veredicto'), cat('tono', 'Cómo salió'), cat('estado', 'Estado')],
    metricas: [
      m('paginas', 'Páginas'), m('puntos', 'Puntos'), m('con_puntaje', 'Con puntaje'),
      r('puntaje', 'Puntaje promedio', 'numero', 'puntos', 'con_puntaje'),
      m('hallazgos', 'Hallazgos'), m('hallazgos_altos', 'Hallazgos graves'),
    ],
  },
  // ── Closing Analyst ───────────────────────────────────────────────────────────────────
  {
    // Las MISMAS llamadas que mira la tab: de venta y ya analizadas (el conjunto `llamadas`
    // cuenta todas, internas y de prueba incluidas). El puntaje, como la tab: sólo las que
    // tienen transcript y puntaje (no se promedian ceros falsos). `llamada` es cada una, con
    // su id: lo que lista el detalle de un número (y abre su ficha). Trae nombres de personas.
    id: 'llamadas_venta', nombre: 'Llamadas de venta', area: 'CRM y ventas',
    descripcion: 'Las llamadas de venta analizadas: puntaje, R1 y R2, ganadas y perdidas.',
    fechas: [{ id: 'fecha', nombre: 'Llamada' }],
    dimensiones: [...TIEMPO, cat('closer', 'Closer'), cat('reunion', 'Reunión'), cat('tono', 'Resultado'), cat('llamada', 'Llamada')],
    metricas: [
      m('llamadas', 'Llamadas'), m('minutos', 'Minutos'), r('duracion', 'Duración promedio (min)', 'numero', 'minutos', 'llamadas'),
      m('puntos', 'Puntos'), m('con_puntaje', 'Con puntaje'), r('puntaje', 'Puntaje promedio', 'numero', 'puntos', 'con_puntaje'),
      m('ganadas', 'Ganadas'), m('perdidas', 'Perdidas'), m('r1', 'R1 (diagnóstico)'), m('r2', 'R2 (cierre)'), m('ganadas_r2', 'R2 ganadas'),
      r('tasa_cierre', 'Tasa de cierre', 'pct', 'ganadas_r2', 'r2', 100),
    ],
  },
  {
    // Una fila por llamada y dimensión del análisis (Situación, Problema… CTA).
    id: 'llamadas_dimensiones', nombre: 'Llamadas por dimensión', area: 'CRM y ventas',
    descripcion: 'El puntaje de cada dimensión de venta (SPIN y ejecución), por closer y resultado.',
    fechas: [{ id: 'fecha', nombre: 'Llamada' }],
    dimensiones: [...TIEMPO, cat('dimension', 'Dimensión'), cat('grupo', 'Grupo'), cat('tono', 'Resultado'), cat('closer', 'Closer'), cat('reunion', 'Reunión')],
    metricas: [m('puntos', 'Puntos'), m('con_puntaje', 'Con puntaje'), r('puntaje', 'Puntaje promedio', 'numero', 'puntos', 'con_puntaje')],
  },
  // ── Productivity Analyst ──────────────────────────────────────────────────────────────
  {
    // Una fila por proyecto del tablero que le toca a quien mira (el del dueño o el del
    // cliente, lib/tablero-actual.ts). Las tareas se cuentan como la tab: sin las que se
    // repiten, y en TODOS sus proyectos.
    id: 'proyectos', nombre: 'Proyectos del Plan', area: 'Plan',
    descripcion: 'Cada proyecto del tablero: su avance, si está completo, impacto y esfuerzo.',
    fechas: [{ id: 'actual', nombre: 'Todos (hoy)', sinRango: true }],
    dimensiones: [cat('proyecto', 'Proyecto'), cat('estado', 'Estado'), cat('con_deadline', 'Con deadline'), cat('cuadrante', 'Cuadrante')],
    metricas: [
      m('proyectos', 'Proyectos'), m('completos', 'Completados'), m('tareas', 'Tareas'), m('hechas', 'Hechas'),
      m('pct_suma', 'Puntos de avance'), r('avance_proyectos', 'Avance promedio', 'pct', 'pct_suma', 'proyectos'),
      atributo('impacto', 'Impacto'), atributo('esfuerzo', 'Esfuerzo'),
    ],
  },
  {
    // Las tareas que EMPIEZAN Y TERMINAN (sin las recurrentes), con lo que la tab deduce del
    // historial: el ciclo, si se cerró a tiempo y si está estancada.
    id: 'ejecucion', nombre: 'Ejecución del Plan', area: 'Plan',
    descripcion: 'Las tareas que empiezan y terminan: en curso, a tiempo, ciclo y estancadas.',
    fechas: [{ id: 'actual', nombre: 'Todas (hoy)', sinRango: true }],
    dimensiones: [cat('prioridad', 'Prioridad'), cat('estado', 'Estado'), cat('con_deadline', 'Con deadline')],
    metricas: [
      m('tareas', 'Tareas'), m('activas', 'Activas'), m('hechas', 'Hechas'), m('en_curso', 'En curso'),
      m('sin_deadline', 'Activas sin deadline'), m('alta_sin_deadline', 'Alta sin deadline'), m('estancadas', 'Estancadas'),
      m('progreso', 'Puntos de avance'), r('avance', 'Avance promedio', 'pct', 'progreso', 'tareas'),
      m('cerradas_con_deadline', 'Cerradas con deadline'), m('a_tiempo', 'A tiempo'), m('tarde', 'Tarde'), m('dias_tarde', 'Días de atraso'),
      r('cumplimiento', 'Cumplimiento', 'pct', 'a_tiempo', 'cerradas_con_deadline', 100), r('atraso_prom', 'Atraso promedio (días)', 'numero', 'dias_tarde', 'tarde'),
      m('dias_ciclo', 'Días de ciclo'), m('con_ciclo', 'Con ciclo'), r('ciclo', 'Cycle time (días)', 'numero', 'dias_ciclo', 'con_ciclo'),
    ],
  },
];
