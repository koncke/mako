// =============================================================================
// graficos-catalogo — qué se puede dibujar en el Dashboard y con qué datos
// =============================================================================
// Pedido de Martín (10-11/10/2026): «quiero poder personalizar los gráficos para todos los
// usuarios… importante que sean funcionales, reales», «Puedes copiar la app de Google Data
// Studio para esto», «No, no se ve igual al editor de Looker, te pido que lo hagas igual» y,
// con la galería de Looker al lado: «faltan un montón de gráficos que puedes agregar… revisa
// todos los datos de MaKo que se podrían poner allí... Absolutamente todos».
//
// El molde es Looker Studio: un INFORME tiene HOJAS; cada hoja tiene COMPONENTES (gráficos y
// controles); cada gráfico es un TIPO atado a un CONJUNTO DE DATOS de MaKo, con su «dimensión
// del período» (la fecha que decide qué filas entran), una DIMENSIÓN (verde), una dimensión de
// DESGLOSE opcional y una o más MÉTRICAS (azul), y su ESTILO.
//
// ⚠️ SIN `server-only` A PROPÓSITO: lo importan la pantalla (para dibujar los selectores), el
// server (para validar lo que llega) y los tests. Sólo datos y funciones puras.
//
// ⚠️ NADA DE SQL LIBRE. La persona elige entre los campos que esta lista declara, y el server
// valida cada gráfico contra ella (`sanearGrafico`) antes de leer. Agregar un campo es
// agregarlo acá Y enseñarle al lector (`lib/graficos-datos.ts`) a llenarlo; el test cruza las
// dos listas, porque un campo sin lector sale en cero y se lee como un dato.

import { diasAntes, esFechaValida } from './date-utils';

export type Formato = 'numero' | 'usd' | 'pct' | 'veces' | 'segundos';
export type ClaseDim = 'tiempo' | 'categoria';

export type Dimension = { id: string; nombre: string; clase: ClaseDim };
/**
 * Una métrica es una SUMA de lo que aporta cada fila, una cuenta de valores DISTINTOS (las
 * personas, no las visitas), o una RAZÓN entre dos sumas. Una razón NUNCA se promedia fila por
 * fila: se divide lo sumado del grupo (el CTR de una campaña es sus clics ÷ sus impresiones).
 */
export type Metrica = {
  id: string; nombre: string; formato: Formato;
  distinto?: true;
  razon?: { num: string; den: string; factor: number };
};
export type Area = 'Negocio' | 'Marketing' | 'CRM y ventas' | 'Comunicación' | 'Automations' | 'Plan' | 'Customer Success' | 'Second Brain' | 'Onboarding' | 'IA y contenido';
export const AREAS: readonly Area[] = ['Negocio', 'Marketing', 'CRM y ventas', 'Comunicación', 'Automations', 'Plan', 'Customer Success', 'Second Brain', 'Onboarding', 'IA y contenido'];

export type Fuente = {
  id: string;
  nombre: string;
  area: Area;
  descripcion: string;
  /** Las fechas que pueden decidir qué filas entran. `sinRango` = la foto de hoy, sin período. */
  fechas: Array<{ id: string; nombre: string; sinRango?: true }>;
  dimensiones: Dimension[];
  metricas: Metrica[];
};

const TIEMPO: Dimension[] = [
  { id: 'dia', nombre: 'Día', clase: 'tiempo' },
  { id: 'semana', nombre: 'Semana', clase: 'tiempo' },
  { id: 'mes', nombre: 'Mes', clase: 'tiempo' },
];
const cat = (id: string, nombre: string): Dimension => ({ id, nombre, clase: 'categoria' });
const m = (id: string, nombre: string, formato: Formato = 'numero'): Metrica => ({ id, nombre, formato });
const dist = (id: string, nombre: string): Metrica => ({ id, nombre, formato: 'numero', distinto: true });
const r = (id: string, nombre: string, formato: Formato, num: string, den: string, factor = 1): Metrica => ({ id, nombre, formato, razon: { num, den, factor } });

export const FUENTES: readonly Fuente[] = [
  // ── Negocio ───────────────────────────────────────────────────────────────────────────
  {
    id: 'negocio', nombre: 'Resumen del negocio', area: 'Negocio',
    descripcion: 'La pauta, el CRM y los cobros, día por día. Para el CAC y el ROAS.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO],
    metricas: [
      m('gasto', 'Gasto en anuncios', 'usd'), m('leads', 'Leads'), m('agendas', 'Agendas'), m('asistencias', 'Asistencias'),
      m('cierres', 'Cierres'), m('vendido', 'Vendido', 'usd'), m('cobrado', 'Cobrado', 'usd'),
      r('cac', 'CAC', 'usd', 'gasto', 'cierres'), r('roas_cobrado', 'ROAS cobrado', 'veces', 'cobrado', 'gasto'),
      r('roas_vendido', 'ROAS vendido', 'veces', 'vendido', 'gasto'), r('cpl', 'Costo por lead', 'usd', 'gasto', 'leads'),
      r('cpa', 'Costo por agenda', 'usd', 'gasto', 'agendas'), r('tasa_cierre', 'Tasa de cierre', 'pct', 'cierres', 'asistencias', 100),
    ],
  },
  // ── Marketing ─────────────────────────────────────────────────────────────────────────
  {
    id: 'meta', nombre: 'Anuncios de Meta', area: 'Marketing',
    descripcion: 'Gasto, impresiones, clics, leads y agendas de cada anuncio, por día.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('campana', 'Campaña'), cat('conjunto', 'Conjunto'), cat('anuncio', 'Anuncio')],
    metricas: [
      m('gasto', 'Gasto', 'usd'), m('impresiones', 'Impresiones'), m('clics', 'Clics'), m('leads', 'Leads'), m('agendas', 'Agendas'),
      dist('anuncios', 'Anuncios'),
      r('ctr', 'CTR', 'pct', 'clics', 'impresiones', 100), r('cpc', 'Costo por clic', 'usd', 'gasto', 'clics'),
      r('cpm', 'CPM', 'usd', 'gasto', 'impresiones', 1000), r('cpl', 'Costo por lead', 'usd', 'gasto', 'leads'),
      r('cpa', 'Costo por agenda', 'usd', 'gasto', 'agendas'),
    ],
  },
  {
    id: 'presupuesto', nombre: 'Presupuestos de Meta', area: 'Marketing',
    descripcion: 'El presupuesto diario de cada conjunto de anuncios y su estado.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('conjunto', 'Conjunto'), cat('estado', 'Estado')],
    metricas: [m('presupuesto', 'Presupuesto diario', 'usd'), dist('conjuntos', 'Conjuntos')],
  },
  {
    id: 'visitas', nombre: 'Visitas a la landing', area: 'Marketing',
    descripcion: 'Cada visita a tus páginas con el Pixel de MaKo: de dónde vino y a qué página.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('pagina', 'Página'), cat('origen', 'De dónde vino'), cat('prueba', 'Variante')],
    metricas: [m('visitas', 'Visitas'), dist('visitantes', 'Visitantes')],
  },
  {
    id: 'vsl', nombre: 'Video de ventas (VSL)', area: 'Marketing',
    descripcion: 'Reproducciones, pausas y hasta dónde vio cada persona tu video de ventas.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('evento', 'Evento'), cat('video', 'Video'), cat('pagina', 'Página')],
    metricas: [m('eventos', 'Eventos'), m('reproducciones', 'Reproducciones'), dist('personas', 'Personas')],
  },
  {
    id: 'replays', nombre: 'Grabaciones de visitas', area: 'Marketing',
    descripcion: 'Las sesiones grabadas en tu landing: cuántas y cuánto duraron.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('pagina', 'Página'), cat('corte', 'Cómo terminó')],
    metricas: [m('grabaciones', 'Grabaciones'), m('segundos', 'Segundos grabados', 'segundos'), r('duracion', 'Duración promedio', 'segundos', 'segundos', 'grabaciones'), dist('visitantes', 'Visitantes')],
  },
  {
    id: 'creativos', nombre: 'Creativos analizados', area: 'Marketing',
    descripcion: 'Los anuncios que analizó el Ads Analyst: ángulo, gancho, formato y avatar.',
    fechas: [{ id: 'fecha', nombre: 'Análisis' }],
    dimensiones: [...TIEMPO, cat('angulo', 'Ángulo'), cat('gancho', 'Gancho'), cat('formato', 'Formato'), cat('avatar', 'Avatar')],
    metricas: [m('creativos', 'Creativos'), m('segundos', 'Segundos de video', 'segundos'), r('duracion', 'Duración promedio', 'segundos', 'segundos', 'creativos')],
  },
  // ── CRM y ventas ──────────────────────────────────────────────────────────────────────
  {
    id: 'leads', nombre: 'Leads del CRM', area: 'CRM y ventas',
    descripcion: 'Los leads del CRM: cuándo entraron, si agendaron, asistieron y cerraron.',
    fechas: [{ id: 'alta', nombre: 'Entró' }, { id: 'agenda', nombre: 'Reunión' }, { id: 'cierre', nombre: 'Cierre' }],
    dimensiones: [
      ...TIEMPO, cat('etapa', 'Etapa'), cat('producto', 'Producto'), cat('origen', 'Origen'), cat('campana', 'Campaña'),
      cat('anuncio', 'Anuncio'), cat('closer', 'Closer'), cat('setter', 'Setter'), cat('motivo', 'Motivo de pérdida'),
    ],
    metricas: [
      m('leads', 'Leads'), m('agendas', 'Agendaron'), m('asistencias', 'Asistieron'), m('calificados', 'Calificados'),
      m('cierres', 'Cerraron'), m('vendido', 'Vendido', 'usd'), m('cobrado', 'Cobrado', 'usd'),
      r('tasa_asistencia', 'Tasa de asistencia', 'pct', 'asistencias', 'agendas', 100),
      r('tasa_cierre', 'Tasa de cierre', 'pct', 'cierres', 'asistencias', 100),
      r('ticket', 'Ticket promedio', 'usd', 'vendido', 'cierres'),
    ],
  },
  {
    id: 'crm_cambios', nombre: 'Cambios en el CRM', area: 'CRM y ventas',
    descripcion: 'Cada cambio que se hizo en una ficha: qué campo, a qué valor y quién.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('campo', 'Campo'), cat('valor', 'Valor nuevo'), cat('autor', 'Quién')],
    metricas: [m('cambios', 'Cambios'), dist('leads', 'Leads tocados')],
  },
  {
    id: 'formularios', nombre: 'Respuestas de formularios', area: 'CRM y ventas',
    descripcion: 'Las respuestas que dejan los leads al agendar.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('formulario', 'Formulario')],
    metricas: [m('respuestas', 'Respuestas'), dist('leads', 'Leads')],
  },
  {
    id: 'pagos', nombre: 'Pagos', area: 'CRM y ventas',
    descripcion: 'Las cuotas de tus clientes: cobradas, pendientes y vencidas.',
    fechas: [{ id: 'vencimiento', nombre: 'Vencimiento' }, { id: 'pago', nombre: 'Pagado' }],
    dimensiones: [...TIEMPO, cat('estado', 'Estado'), cat('cliente', 'Cliente'), cat('cuota', 'Cuota')],
    metricas: [m('monto', 'Monto', 'usd'), m('cobrado', 'Cobrado', 'usd'), m('pendiente', 'Pendiente', 'usd'), m('pagos', 'Cuotas'), dist('clientes', 'Clientes')],
  },
  {
    id: 'llamadas', nombre: 'Llamadas analizadas', area: 'CRM y ventas',
    descripcion: 'Las llamadas que analizó el Closing Analyst: closer, resultado y puntaje.',
    fechas: [{ id: 'fecha', nombre: 'Llamada' }],
    dimensiones: [...TIEMPO, cat('closer', 'Closer'), cat('categoria', 'Categoría'), cat('reunion', 'Reunión'), cat('resultado', 'Resultado')],
    metricas: [
      m('llamadas', 'Llamadas'), m('minutos', 'Minutos'), r('duracion', 'Duración promedio (min)', 'numero', 'minutos', 'llamadas'),
      r('puntaje', 'Puntaje promedio', 'numero', 'puntos', 'con_puntaje'), m('puntos', 'Puntos'), m('con_puntaje', 'Llamadas con puntaje'),
    ],
  },
  // ── Comunicación ──────────────────────────────────────────────────────────────────────
  {
    id: 'whatsapp', nombre: 'Mensajes de WhatsApp', area: 'Comunicación',
    descripcion: 'Los mensajes de tus líneas de WhatsApp: enviados, recibidos y de qué tipo.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('direccion', 'Dirección'), cat('tipo', 'Tipo'), cat('linea', 'Línea'), cat('estado', 'Estado')],
    metricas: [m('mensajes', 'Mensajes'), m('enviados', 'Enviados'), m('recibidos', 'Recibidos'), dist('chats', 'Chats')],
  },
  {
    id: 'mako_chat', nombre: 'Conversaciones con MaKo', area: 'Comunicación',
    descripcion: 'Lo que tu equipo le pide a MaKo por WhatsApp, y lo que MaKo contesta.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('quien', 'Quién escribe')],
    metricas: [m('mensajes', 'Mensajes'), dist('grupos', 'Chats')],
  },
  // ── Automations ───────────────────────────────────────────────────────────────────────
  {
    id: 'inscripciones', nombre: 'Personas en automatizaciones', area: 'Automations',
    descripcion: 'Quién entró a cada automatización y cómo terminó.',
    fechas: [{ id: 'alta', nombre: 'Entró' }, { id: 'desenlace', nombre: 'Terminó' }],
    dimensiones: [...TIEMPO, cat('automatizacion', 'Automatización'), cat('estado', 'Estado'), cat('desenlace', 'Desenlace')],
    metricas: [m('personas', 'Personas'), dist('leads', 'Leads')],
  },
  {
    id: 'envios', nombre: 'Mensajes de automatizaciones', area: 'Automations',
    descripcion: 'Lo que mandó cada automatización: por qué canal, si se abrió y si respondieron.',
    fechas: [{ id: 'fecha', nombre: 'Envío' }],
    dimensiones: [...TIEMPO, cat('automatizacion', 'Automatización'), cat('canal', 'Canal'), cat('estado', 'Estado')],
    metricas: [
      m('envios', 'Envíos'), m('abiertos', 'Abiertos'), m('clics', 'Clics'), m('respuestas', 'Respuestas'),
      r('tasa_apertura', 'Tasa de apertura', 'pct', 'abiertos', 'envios', 100), r('tasa_respuesta', 'Tasa de respuesta', 'pct', 'respuestas', 'envios', 100),
    ],
  },
  // ── Plan ──────────────────────────────────────────────────────────────────────────────
  {
    id: 'tareas', nombre: 'Tareas del Plan', area: 'Plan',
    descripcion: 'Las tareas de tu tablero: por proyecto, prioridad y estado.',
    fechas: [{ id: 'actual', nombre: 'Todas (hoy)', sinRango: true }, { id: 'alta', nombre: 'Creada' }, { id: 'deadline', nombre: 'Deadline' }],
    dimensiones: [...TIEMPO, cat('proyecto', 'Proyecto'), cat('prioridad', 'Prioridad'), cat('estado', 'Estado'), cat('origen', 'De dónde salió'), cat('responsable', 'Responsable')],
    metricas: [m('tareas', 'Tareas'), m('hechas', 'Hechas'), m('abiertas', 'Abiertas'), r('avance', 'Avance promedio', 'pct', 'progreso', 'tareas'), m('progreso', 'Puntos de avance')],
  },
  // ── Customer Success ──────────────────────────────────────────────────────────────────
  {
    id: 'entrega', nombre: 'Clientes en entrega', area: 'Customer Success',
    descripcion: 'En qué etapa de la entrega está cada cliente, por producto.',
    fechas: [{ id: 'actual', nombre: 'Hoy', sinRango: true }, { id: 'desde', nombre: 'Llegó a la etapa' }],
    dimensiones: [...TIEMPO, cat('producto', 'Producto'), cat('etapa', 'Etapa')],
    metricas: [m('clientes', 'Clientes')],
  },
  {
    id: 'avance_cursos', nombre: 'Avance en los cursos', area: 'Customer Success',
    descripcion: 'Las clases que vio cada alumno y cuánto avanzó.',
    fechas: [{ id: 'fecha', nombre: 'La vio' }],
    dimensiones: [...TIEMPO, cat('estado', 'Estado'), cat('area', 'Área')],
    metricas: [m('clases', 'Clases vistas'), r('avance', 'Avance promedio', 'pct', 'pct', 'clases'), m('pct', 'Puntos de avance'), dist('alumnos', 'Alumnos')],
  },
  // ── Second Brain ──────────────────────────────────────────────────────────────────────
  {
    id: 'conocimiento', nombre: 'Conocimiento de MaKo', area: 'Second Brain',
    descripcion: 'Los documentos que MaKo aprendió de tu negocio.',
    fechas: [{ id: 'actual', nombre: 'Todo (hoy)', sinRango: true }, { id: 'fecha', nombre: 'Cargado' }],
    dimensiones: [...TIEMPO, cat('categoria', 'Categoría'), cat('area', 'Área'), cat('fuente', 'Fuente'), cat('estado', 'Estado')],
    metricas: [m('documentos', 'Documentos')],
  },
  {
    id: 'archivero', nombre: 'Archivos del Archivero', area: 'Second Brain',
    descripcion: 'Los archivos que subiste a MaKo, por tipo y tamaño.',
    fechas: [{ id: 'actual', nombre: 'Todo (hoy)', sinRango: true }, { id: 'fecha', nombre: 'Subido' }],
    dimensiones: [...TIEMPO, cat('tipo', 'Tipo')],
    metricas: [m('archivos', 'Archivos'), m('mb', 'Megabytes')],
  },
  // ── Onboarding ────────────────────────────────────────────────────────────────────────
  {
    id: 'onboarding', nombre: 'Pasos del onboarding', area: 'Onboarding',
    descripcion: 'Qué pasos del onboarding de cada tab están hechos y cuáles faltan.',
    fechas: [{ id: 'actual', nombre: 'Hoy', sinRango: true }, { id: 'hecho', nombre: 'Cuándo se hizo' }],
    dimensiones: [...TIEMPO, cat('tab', 'Tab'), cat('paso', 'Paso'), cat('estado', 'Estado')],
    metricas: [m('pasos', 'Pasos'), m('hechos', 'Hechos'), r('avance', 'Avance', 'pct', 'hechos', 'pasos', 100)],
  },
  // ── IA y contenido ────────────────────────────────────────────────────────────────────
  {
    id: 'ia', nombre: 'Uso de IA', area: 'IA y contenido',
    descripcion: 'Cada llamada a la IA: para qué, con qué modelo y cuánto costó.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('funcion', 'Función'), cat('modelo', 'Modelo'), cat('proveedor', 'Proveedor')],
    metricas: [
      m('llamadas', 'Llamadas'), m('costo', 'Costo', 'usd'), m('tokens_entrada', 'Tokens de entrada'), m('tokens_salida', 'Tokens de salida'),
      r('costo_prom', 'Costo por llamada', 'usd', 'costo', 'llamadas'),
    ],
  },
  {
    id: 'flow', nombre: 'Videos e imágenes (Flow)', area: 'IA y contenido',
    descripcion: 'Lo que MaKo le pidió a Google Flow: videos, imágenes y si salieron.',
    fechas: [{ id: 'fecha', nombre: 'Pedido' }],
    dimensiones: [...TIEMPO, cat('tipo', 'Tipo'), cat('estado', 'Estado')],
    metricas: [m('trabajos', 'Pedidos'), m('listos', 'Listos'), m('fallidos', 'Fallidos'), r('tasa_exito', 'Tasa de éxito', 'pct', 'listos', 'trabajos', 100)],
  },
];

export type FuenteId = string;

// ── Los tipos de gráfico: la galería de Looker Studio ─────────────────────────────────────

export type Grupo = 'Tabla' | 'Cuadro de resultados' | 'Serie temporal' | 'Barras' | 'Histograma' | 'Circular' | 'Líneas' | 'Áreas' | 'Dispersión' | 'Tabla dinámica' | 'Bala' | 'Gráfico de rectángulos' | 'Sankey' | 'Indicador' | 'Cascada' | 'Cronología' | 'Embudo de conversión';

export type InfoTipo = {
  id: string;
  nombre: string;
  grupo: Grupo;
  /** Qué dimensión pide: ninguna, sólo tiempo, sólo categoría o cualquiera. */
  dimension: 'ninguna' | 'tiempo' | 'categoria' | 'cualquiera';
  /** La dimensión de desglose (la segunda): no se usa, es opcional o hace falta. */
  desglose: 'no' | 'opcional' | 'requerido';
  minMetricas: number;
  maxMetricas: number;
  /** Sólo métricas que se suman (una torta o un embudo de razones no suma nada). */
  soloSumas?: true;
  w: number;
  h: number;
};

const t = (id: string, nombre: string, grupo: Grupo, dimension: InfoTipo['dimension'], desglose: InfoTipo['desglose'], minMetricas: number, maxMetricas: number, w: number, h: number, soloSumas?: true): InfoTipo =>
  ({ id, nombre, grupo, dimension, desglose, minMetricas, maxMetricas, w, h, ...(soloSumas ? { soloSumas } : {}) });

// Los nombres y los grupos son los de la galería de Looker (pedido de Martín, 11/10/2026).
export const TIPOS: readonly InfoTipo[] = [
  t('tabla', 'Tabla', 'Tabla', 'cualquiera', 'no', 1, 6, 6, 8),
  t('tabla_barras', 'Tabla con barras', 'Tabla', 'cualquiera', 'no', 1, 6, 6, 8),
  t('tabla_calor', 'Tabla con mapa de calor', 'Tabla', 'cualquiera', 'no', 1, 6, 6, 8),
  t('numero', 'Cuadro de resultados', 'Cuadro de resultados', 'ninguna', 'no', 1, 1, 3, 3),
  t('numero_compacto', 'Cuadro de resultados compacto', 'Cuadro de resultados', 'ninguna', 'no', 1, 1, 3, 3),
  t('numero_tendencia', 'Cuadro de resultados con tendencia', 'Cuadro de resultados', 'ninguna', 'no', 1, 1, 3, 4),
  t('serie', 'Serie temporal', 'Serie temporal', 'tiempo', 'opcional', 1, 4, 8, 8),
  t('serie_sparkline', 'Minigráfico', 'Serie temporal', 'tiempo', 'no', 1, 1, 4, 3),
  t('serie_suave', 'Serie temporal suavizada', 'Serie temporal', 'tiempo', 'opcional', 1, 4, 8, 8),
  t('columnas', 'Gráfico de columnas', 'Barras', 'cualquiera', 'opcional', 1, 4, 6, 8),
  t('columnas_apiladas', 'Columnas apiladas', 'Barras', 'cualquiera', 'opcional', 1, 4, 6, 8),
  t('columnas_100', 'Columnas apiladas al 100%', 'Barras', 'cualquiera', 'opcional', 1, 4, 6, 8, true),
  t('barras', 'Gráfico de barras', 'Barras', 'cualquiera', 'opcional', 1, 4, 6, 8),
  t('barras_apiladas', 'Barras apiladas', 'Barras', 'cualquiera', 'opcional', 1, 4, 6, 8),
  t('barras_100', 'Barras apiladas al 100%', 'Barras', 'cualquiera', 'opcional', 1, 4, 6, 8, true),
  t('histograma', 'Histograma', 'Histograma', 'categoria', 'no', 1, 1, 6, 8),
  t('circular', 'Gráfico circular', 'Circular', 'categoria', 'no', 1, 1, 4, 8, true),
  t('anillo', 'Gráfico de anillo', 'Circular', 'categoria', 'no', 1, 1, 4, 8, true),
  t('combinado', 'Gráfico combinado', 'Líneas', 'cualquiera', 'no', 2, 4, 8, 8),
  t('combinado_apilado', 'Combinado apilado', 'Líneas', 'cualquiera', 'no', 2, 4, 8, 8),
  t('lineas', 'Gráfico de líneas', 'Líneas', 'cualquiera', 'opcional', 1, 4, 8, 8),
  t('lineas_suaves', 'Líneas suavizadas', 'Líneas', 'cualquiera', 'opcional', 1, 4, 8, 8),
  t('area', 'Gráfico de áreas', 'Áreas', 'cualquiera', 'opcional', 1, 4, 8, 8),
  t('area_apilada', 'Áreas apiladas', 'Áreas', 'cualquiera', 'opcional', 1, 4, 8, 8),
  t('area_100', 'Áreas apiladas al 100%', 'Áreas', 'cualquiera', 'opcional', 1, 4, 8, 8, true),
  t('dispersion', 'Gráfico de dispersión', 'Dispersión', 'categoria', 'no', 2, 2, 6, 8),
  t('burbujas', 'Gráfico de burbujas', 'Dispersión', 'categoria', 'no', 3, 3, 6, 8),
  t('dinamica', 'Tabla dinámica', 'Tabla dinámica', 'cualquiera', 'requerido', 1, 1, 8, 8),
  t('dinamica_barras', 'Tabla dinámica con barras', 'Tabla dinámica', 'cualquiera', 'requerido', 1, 1, 8, 8),
  t('dinamica_calor', 'Tabla dinámica con mapa de calor', 'Tabla dinámica', 'cualquiera', 'requerido', 1, 1, 8, 8),
  t('bala', 'Gráfico de bala', 'Bala', 'ninguna', 'no', 1, 1, 6, 3),
  t('rectangulos', 'Gráfico de rectángulos', 'Gráfico de rectángulos', 'categoria', 'no', 1, 1, 6, 8, true),
  t('sankey', 'Sankey', 'Sankey', 'categoria', 'requerido', 1, 1, 8, 9, true),
  t('indicador', 'Indicador', 'Indicador', 'ninguna', 'no', 1, 1, 4, 6),
  t('indicador_rangos', 'Indicador con rangos', 'Indicador', 'ninguna', 'no', 1, 1, 4, 6),
  t('cascada', 'Gráfico de cascada', 'Cascada', 'cualquiera', 'no', 1, 1, 8, 8),
  t('cronologia', 'Cronología', 'Cronología', 'categoria', 'no', 1, 1, 8, 8),
  t('embudo', 'Embudo de conversión', 'Embudo de conversión', 'ninguna', 'no', 2, 8, 6, 8, true),
  t('embudo_barras', 'Embudo de barras', 'Embudo de conversión', 'ninguna', 'no', 2, 8, 6, 8, true),
  t('embudo_columnas', 'Embudo de columnas', 'Embudo de conversión', 'ninguna', 'no', 2, 8, 8, 8, true),
];
export const GRUPOS: readonly Grupo[] = [...new Set(TIPOS.map((x) => x.grupo))];

// ── El período ────────────────────────────────────────────────────────────────────────────

export type Preset = 'hoy' | 'ayer' | 'ult7' | 'ult14' | 'ult28' | 'ult30' | 'ult90' | 'este_mes' | 'mes_pasado' | 'este_anio' | 'anio_pasado' | 'todo' | 'personalizado';
export const PRESETS: ReadonlyArray<{ id: Preset; nombre: string }> = [
  { id: 'hoy', nombre: 'Hoy' }, { id: 'ayer', nombre: 'Ayer' }, { id: 'ult7', nombre: 'Últimos 7 días' },
  { id: 'ult14', nombre: 'Últimos 14 días' }, { id: 'ult28', nombre: 'Últimos 28 días' }, { id: 'ult30', nombre: 'Últimos 30 días' },
  { id: 'ult90', nombre: 'Últimos 90 días' }, { id: 'este_mes', nombre: 'Este mes' }, { id: 'mes_pasado', nombre: 'El mes pasado' },
  { id: 'este_anio', nombre: 'Este año' }, { id: 'anio_pasado', nombre: 'El año pasado' }, { id: 'todo', nombre: 'Todo' },
  { id: 'personalizado', nombre: 'Personalizado' },
];
/** Lo que mira un gráfico en «Automático» cuando la hoja no tiene control de período. */
export const PRESET_AUTOMATICO: Preset = 'ult30';
const DESDE_TODO = '2020-01-01';

export function rangoDe(preset: Preset, hoy: string, desde?: string | null, hasta?: string | null): { desde: string; hasta: string } {
  const [y, mo] = hoy.split('-').map(Number);
  const mes = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-01`;
  switch (preset) {
    case 'hoy': return { desde: hoy, hasta: hoy };
    case 'ayer': { const a = diasAntes(hoy, 1); return { desde: a, hasta: a }; }
    case 'ult7': return { desde: diasAntes(hoy, 6), hasta: hoy };
    case 'ult14': return { desde: diasAntes(hoy, 13), hasta: hoy };
    case 'ult28': return { desde: diasAntes(hoy, 27), hasta: hoy };
    case 'ult90': return { desde: diasAntes(hoy, 89), hasta: hoy };
    case 'este_mes': return { desde: mes(y, mo), hasta: hoy };
    case 'mes_pasado': {
      const [py, pm] = mo === 1 ? [y - 1, 12] : [y, mo - 1];
      return { desde: mes(py, pm), hasta: diasAntes(mes(y, mo), 1) };
    }
    case 'este_anio': return { desde: `${y}-01-01`, hasta: hoy };
    case 'anio_pasado': return { desde: `${y - 1}-01-01`, hasta: `${y - 1}-12-31` };
    case 'todo': return { desde: DESDE_TODO, hasta: hoy };
    case 'personalizado':
      if (desde && hasta && esFechaValida(desde) && esFechaValida(hasta) && desde <= hasta) return { desde, hasta };
      return { desde: diasAntes(hoy, 29), hasta: hoy };
    default: return { desde: diasAntes(hoy, 29), hasta: hoy };
  }
}

export const nombrePreset = (p: Preset) => PRESETS.find((x) => x.id === p)?.nombre ?? p;

// ── El estilo de un gráfico (la pestaña ESTILO) ───────────────────────────────────────────

/** La paleta por defecto de Looker Studio. */
export const PALETA = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D01', '#46BDC6', '#7B61FF', '#F06292'];
export type Estilo = {
  mostrarTitulo: boolean;
  tamTitulo: 's' | 'm' | 'l';
  colores: string[];
  etiquetas: boolean;
  leyenda: 'arriba' | 'abajo' | 'derecha' | 'no';
  cuadricula: boolean;
  ejes: boolean;
  fondo: string;
  borde: boolean;
  radio: number;
  compacto: boolean;
  alinear: 'izquierda' | 'centro';
  objetivo: number | null;
  maximo: number | null;
  total: boolean;
};
export const ESTILO_BASE: Estilo = {
  mostrarTitulo: true, tamTitulo: 'm', colores: PALETA.slice(), etiquetas: false, leyenda: 'arriba', cuadricula: true,
  ejes: true, fondo: '#ffffff', borde: false, radio: 0, compacto: false, alinear: 'izquierda', objetivo: null, maximo: null, total: true,
};
const color = (v: unknown, def: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : def);
const numONull = (v: unknown) => (v === null || v === '' || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export function sanearEstilo(raw: unknown): Estilo {
  const e = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const B = ESTILO_BASE;
  return {
    mostrarTitulo: typeof e.mostrarTitulo === 'boolean' ? e.mostrarTitulo : B.mostrarTitulo,
    tamTitulo: e.tamTitulo === 's' || e.tamTitulo === 'l' ? e.tamTitulo : 'm',
    colores: PALETA.map((c, i) => color(Array.isArray(e.colores) ? e.colores[i] : undefined, c)),
    etiquetas: e.etiquetas === true,
    leyenda: e.leyenda === 'abajo' || e.leyenda === 'derecha' || e.leyenda === 'no' ? e.leyenda : 'arriba',
    cuadricula: e.cuadricula !== false,
    ejes: e.ejes !== false,
    fondo: color(e.fondo, B.fondo),
    borde: e.borde === true,
    radio: Math.min(24, Math.max(0, Math.round(Number(e.radio) || 0))),
    compacto: e.compacto === true,
    alinear: e.alinear === 'centro' ? 'centro' : 'izquierda',
    objetivo: numONull(e.objetivo),
    maximo: numONull(e.maximo),
    total: e.total !== false,
  };
}

// ── Componentes, hojas e informe ──────────────────────────────────────────────────────────

export type Grafico = {
  id: string;
  clase: 'grafico';
  tipo: string;
  /** Vacío = el título se arma solo con la métrica y la dimensión (`tituloDe`). */
  titulo: string;
  fuente: FuenteId;
  fecha: string;
  dimension: string | null;
  desglose: string | null;
  metricas: string[];
  /** Cuántos grupos se muestran; el resto va a «Otros» o se recorta. */
  limite: number;
  /** El «Ordenar» de Looker: por qué métrica (null = la primera) y hacia dónde. El tiempo va siempre en orden. */
  ordenMetrica: string | null;
  ordenAsc: boolean;
  /** «Automático» toma el control de período de la hoja; sin control, los últimos 30 días. */
  periodo: Preset | 'auto';
  desde: string | null;
  hasta: string | null;
  estilo: Estilo;
  x: number; y: number; w: number; h: number;
};
/** El control de período que se pone en una hoja: manda sobre los gráficos en «Automático». */
export type Control = {
  id: string;
  clase: 'control';
  tipo: 'periodo';
  preset: Preset;
  desde: string | null;
  hasta: string | null;
  x: number; y: number; w: number; h: number;
};
export type Componente = Grafico | Control;
export type Hoja = { id: string; nombre: string; componentes: Componente[] };
export type Tablero = { v: 2; nombre: string; hojas: Hoja[] };

export const NOMBRE_INICIAL = 'Dashboard';
export const COLS = 12;
export const MAX_COMPONENTES = 40;
export const MAX_HOJAS = 20;
export const LIMITES = [3, 5, 10, 20, 50] as const;

export const fuenteDe = (id: string): Fuente | undefined => FUENTES.find((f) => f.id === id);
export const tipoDe = (id: string): InfoTipo | undefined => TIPOS.find((x) => x.id === id);
export const metricaDe = (f: Fuente, id: string): Metrica | undefined => f.metricas.find((x) => x.id === id);
export const dimensionDe = (f: Fuente, id: string | null): Dimension | undefined => (id ? f.dimensiones.find((d) => d.id === id) : undefined);
export const esGrafico = (c: Componente): c is Grafico => c.clase === 'grafico';
export const esControl = (c: Componente): c is Control => c.clase === 'control';

/** Las dimensiones que un tipo acepta, en el orden de la fuente. */
export function dimensionesPara(f: Fuente, tipo: string): Dimension[] {
  const x = tipoDe(tipo);
  if (!x || x.dimension === 'ninguna') return [];
  if (x.dimension === 'cualquiera') return f.dimensiones;
  return f.dimensiones.filter((d) => d.clase === x.dimension);
}
/** Un desglose siempre es una categoría: partir por día una serie que ya va por día no dice nada. */
export function desglosesPara(f: Fuente, tipo: string, dimension: string | null): Dimension[] {
  const x = tipoDe(tipo);
  if (!x || x.desglose === 'no') return [];
  return f.dimensiones.filter((d) => d.clase === 'categoria' && d.id !== dimension);
}
/** Las métricas que un tipo acepta: una torta o un embudo sólo aceptan lo que se suma. */
export function metricasPara(f: Fuente, tipo: string): Metrica[] {
  return tipoDe(tipo)?.soloSumas ? f.metricas.filter((x) => !x.razon) : f.metricas;
}

const entero = (v: unknown, min: number, max: number, def: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
};
const presetValido = (v: unknown): v is Preset => PRESETS.some((p) => p.id === v);
const fechaONull = (v: unknown) => (typeof v === 'string' && esFechaValida(v) ? v : null);
const idValido = (v: unknown) => (typeof v === 'string' && /^[a-z0-9-]{1,40}$/i.test(v) ? v : null);

let contador = 0;
export function nuevoId(): string {
  contador = (contador + 1) % 1000;
  return `g${Date.now().toString(36)}${contador.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/**
 * Lo que llega del navegador (o de la base) pasa por acá antes de valer nada. Corrige en vez de
 * rechazar —un gráfico al que se le cambió el tipo conserva lo que todavía sirve— y devuelve
 * null sólo si no hay de dónde sacar una fuente.
 */
export function sanearGrafico(raw: unknown): Grafico | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const fuente = fuenteDe(String(o.fuente ?? ''));
  if (!fuente) return null;
  // Los nombres del v1 (10/10) siguen valiendo: `linea` y `torta` son la serie y la circular.
  const pedido = o.tipo === 'linea' ? 'serie' : o.tipo === 'torta' ? 'circular' : String(o.tipo ?? '');
  const info = tipoDe(pedido) ?? tipoDe('barras')!;
  const tipo = info.id;
  const fecha = fuente.fechas.some((x) => x.id === o.fecha) ? String(o.fecha) : fuente.fechas[0].id;

  const dims = dimensionesPara(fuente, tipo);
  let dimension: string | null = null;
  if (dims.length) {
    const p = typeof o.dimension === 'string' ? o.dimension : '';
    dimension = dims.some((d) => d.id === p) ? p : (dims.find((d) => d.clase === 'categoria') ?? dims[0]).id;
  }
  const desg = desglosesPara(fuente, tipo, dimension);
  let desglose: string | null = null;
  if (desg.length) {
    const p = typeof o.desglose === 'string' ? o.desglose : '';
    if (desg.some((d) => d.id === p)) desglose = p;
    else if (info.desglose === 'requerido') desglose = desg[0].id;
  }

  const validas = metricasPara(fuente, tipo).map((x) => x.id);
  const pedidas = Array.isArray(o.metricas) ? o.metricas.map(String) : [];
  const metricas = [...new Set(pedidas.filter((x) => validas.includes(x)))].slice(0, info.maxMetricas);
  for (const v of validas) { if (metricas.length >= info.minMetricas) break; if (!metricas.includes(v)) metricas.push(v); }
  if (!metricas.length) metricas.push(validas[0]);
  const ordenMetrica = typeof o.ordenMetrica === 'string' && metricas.includes(o.ordenMetrica) ? o.ordenMetrica : null;

  return {
    id: idValido(o.id) ?? nuevoId(),
    clase: 'grafico', tipo,
    titulo: typeof o.titulo === 'string' ? o.titulo.slice(0, 80) : '',
    fuente: fuente.id, fecha, dimension, desglose, metricas,
    limite: entero(o.limite, 3, 50, 10),
    ordenMetrica, ordenAsc: o.ordenAsc === true,
    periodo: o.periodo === 'auto' || o.periodo === undefined ? 'auto' : presetValido(o.periodo) ? o.periodo : 'auto',
    desde: fechaONull(o.desde), hasta: fechaONull(o.hasta),
    estilo: sanearEstilo(o.estilo),
    x: entero(o.x, 0, COLS - 1, 0), y: entero(o.y, 0, 999, 0),
    w: entero(o.w, 2, COLS, info.w), h: entero(o.h, 2, 24, info.h),
  };
}

export function sanearControl(raw: unknown): Control | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.tipo !== 'periodo') return null;
  return {
    id: idValido(o.id) ?? nuevoId(), clase: 'control', tipo: 'periodo',
    preset: presetValido(o.preset) ? o.preset : 'ult30',
    desde: fechaONull(o.desde), hasta: fechaONull(o.hasta),
    x: entero(o.x, 0, COLS - 1, 0), y: entero(o.y, 0, 999, 0), w: entero(o.w, 2, COLS, 4), h: entero(o.h, 1, 4, 2),
  };
}

export const sanearComponente = (raw: unknown): Componente | null =>
  raw && typeof raw === 'object' && (raw as { tipo?: unknown }).tipo === 'periodo' ? sanearControl(raw) : sanearGrafico(raw);

function sanearHoja(raw: unknown, i: number): Hoja | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { id?: unknown; nombre?: unknown; componentes?: unknown };
  const lista = Array.isArray(o.componentes) ? o.componentes : [];
  const vistos = new Set<string>();
  const componentes: Componente[] = [];
  for (const c of lista.slice(0, MAX_COMPONENTES)) {
    const s = sanearComponente(c);
    if (!s) continue;
    // Dos componentes con el mismo id son una sola key en la grilla: el segundo se pisaría.
    if (vistos.has(s.id)) s.id = nuevoId();
    vistos.add(s.id);
    componentes.push(s);
  }
  const nombre = typeof o.nombre === 'string' && o.nombre.trim() ? o.nombre.trim().slice(0, 40) : `Página ${i + 1}`;
  return { id: idValido(o.id) ?? nuevoId(), nombre, componentes };
}

/** `null` = no es un informe (lo que vino no se entiende). Un informe del v1 se pasa a una hoja. */
export function sanearTablero(raw: unknown): Tablero | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { hojas?: unknown; graficos?: unknown; nombre?: unknown };
  let hojasRaw: unknown[];
  if (Array.isArray(o.hojas)) hojasRaw = o.hojas;
  else if (Array.isArray(o.graficos)) hojasRaw = [{ id: 'hoja1', nombre: 'Página 1', componentes: o.graficos }];
  else return null;
  const vistas = new Set<string>();
  const hojas: Hoja[] = [];
  for (const [i, h] of hojasRaw.slice(0, MAX_HOJAS).entries()) {
    const s = sanearHoja(h, i);
    if (!s) continue;
    if (vistas.has(s.id)) s.id = nuevoId();
    vistas.add(s.id);
    hojas.push(s);
  }
  if (!hojas.length) hojas.push({ id: nuevoId(), nombre: 'Página 1', componentes: [] });
  const nombre = typeof o.nombre === 'string' && o.nombre.trim() ? o.nombre.trim().slice(0, 80) : NOMBRE_INICIAL;
  return { v: 2, nombre, hojas };
}

/** El primer hueco libre: abajo de todo. La grilla compacta hacia arriba sola. */
export function abajoDeTodo(componentes: Componente[]): number {
  return componentes.reduce((mx, c) => Math.max(mx, c.y + c.h), 0);
}

/** Un gráfico nuevo del tipo pedido, con datos atados que ya muestran algo. */
export function nuevoGrafico(tipo: string, componentes: Componente[], fuenteId: FuenteId = 'negocio'): Grafico {
  const info = tipoDe(tipo) ?? tipoDe('tabla')!;
  let f = fuenteDe(fuenteId) ?? fuenteDe('negocio')!;
  // Un tipo que pide categorías (circular, sankey, histograma…) no puede nacer sobre una fuente
  // que sólo tiene tiempo: nacería vacío. Se arranca con los leads, que tienen de todo.
  const pideCategoria = info.dimension === 'categoria' || info.desglose === 'requerido';
  if (pideCategoria && !f.dimensiones.some((d) => d.clase === 'categoria')) f = fuenteDe('leads')!;
  const base: Record<string, unknown> = { id: nuevoId(), tipo: info.id, fuente: f.id, w: info.w, h: info.h, x: 0, y: abajoDeTodo(componentes) };
  if (info.dimension === 'tiempo') base.dimension = 'dia';
  if (info.grupo === 'Embudo de conversión') base.metricas = f.metricas.filter((x) => !x.razon).slice(0, 4).map((x) => x.id);
  return sanearGrafico(base)!;
}

export function nuevoControl(componentes: Componente[]): Control {
  return sanearControl({ tipo: 'periodo', preset: 'ult30', x: 0, y: abajoDeTodo(componentes), w: 4, h: 2 })!;
}

/** El título que se ve cuando la persona no escribió uno: «Gasto por campaña». */
export function tituloDe(g: Grafico): string {
  if (g.titulo.trim()) return g.titulo;
  const f = fuenteDe(g.fuente);
  if (!f) return 'Gráfico';
  const mets = g.metricas.map((x) => metricaDe(f, x)?.nombre ?? x);
  const dim = dimensionDe(f, g.dimension);
  const desg = dimensionDe(f, g.desglose);
  const que = mets.length > 2 ? `${mets.slice(0, 2).join(', ')} y más` : mets.join(' y ');
  const por = [dim?.nombre.toLowerCase(), desg?.nombre.toLowerCase()].filter(Boolean).join(' y ');
  return por ? `${que} por ${por}` : que;
}

/** El período que mira un gráfico: el suyo, o el del control de la hoja si está en «Automático». */
export function rangoDeGrafico(g: Grafico, hoja: Hoja, hoy: string): { desde: string; hasta: string } {
  if (g.periodo !== 'auto') return rangoDe(g.periodo, hoy, g.desde, g.hasta);
  const control = hoja.componentes.find(esControl);
  if (control) return rangoDe(control.preset, hoy, control.desde, control.hasta);
  return rangoDe(PRESET_AUTOMATICO, hoy);
}

/**
 * El informe con el que arranca quien nunca armó el suyo: las dos hojas que antes eran las
 * tabs Marketing y Comercial, con sus números de siempre armados como gráficos.
 */
export function tableroInicial(): Tablero {
  const g = (o: Record<string, unknown>) => sanearGrafico({ id: nuevoId(), ...o })!;
  return {
    v: 2,
    nombre: NOMBRE_INICIAL,
    hojas: [
      {
        id: 'marketing', nombre: 'Marketing',
        componentes: [
          g({ tipo: 'numero', fuente: 'negocio', metricas: ['gasto'], x: 0, y: 0, w: 3, h: 3 }),
          g({ tipo: 'numero', fuente: 'negocio', metricas: ['cac'], x: 3, y: 0, w: 3, h: 3 }),
          g({ tipo: 'numero', fuente: 'negocio', metricas: ['roas_cobrado'], x: 6, y: 0, w: 3, h: 3 }),
          g({ tipo: 'numero', fuente: 'negocio', metricas: ['cpl'], x: 9, y: 0, w: 3, h: 3 }),
          g({ tipo: 'serie', fuente: 'negocio', dimension: 'dia', metricas: ['gasto', 'leads'], x: 0, y: 3, w: 8, h: 8 }),
          g({ tipo: 'anillo', fuente: 'meta', dimension: 'campana', metricas: ['gasto'], limite: 5, x: 8, y: 3, w: 4, h: 8 }),
          g({ tipo: 'tabla', fuente: 'meta', dimension: 'campana', metricas: ['gasto', 'leads', 'agendas', 'cpl', 'cpa'], x: 0, y: 11, w: 7, h: 8 }),
          g({ tipo: 'embudo', fuente: 'leads', fecha: 'alta', metricas: ['leads', 'agendas', 'asistencias', 'cierres'], x: 7, y: 11, w: 5, h: 8 }),
          g({ tipo: 'columnas', fuente: 'visitas', dimension: 'dia', metricas: ['visitas'], x: 0, y: 19, w: 6, h: 7 }),
          g({ tipo: 'barras', fuente: 'leads', fecha: 'alta', dimension: 'origen', metricas: ['leads'], x: 6, y: 19, w: 6, h: 7 }),
        ],
      },
      {
        id: 'comercial', nombre: 'Comercial',
        componentes: [
          g({ tipo: 'numero', fuente: 'negocio', metricas: ['vendido'], x: 0, y: 0, w: 3, h: 3 }),
          g({ tipo: 'numero', fuente: 'negocio', metricas: ['cobrado'], x: 3, y: 0, w: 3, h: 3 }),
          g({ tipo: 'numero', fuente: 'negocio', metricas: ['cierres'], x: 6, y: 0, w: 3, h: 3 }),
          g({ tipo: 'numero', fuente: 'negocio', metricas: ['tasa_cierre'], x: 9, y: 0, w: 3, h: 3 }),
          g({ tipo: 'columnas', fuente: 'negocio', dimension: 'mes', metricas: ['vendido', 'cobrado'], periodo: 'este_anio', x: 0, y: 3, w: 8, h: 8 }),
          g({ tipo: 'circular', fuente: 'pagos', fecha: 'vencimiento', dimension: 'estado', metricas: ['monto'], x: 8, y: 3, w: 4, h: 8 }),
          g({ tipo: 'barras', fuente: 'leads', fecha: 'cierre', dimension: 'closer', metricas: ['cierres'], x: 0, y: 11, w: 6, h: 8 }),
          g({ tipo: 'tabla', fuente: 'llamadas', dimension: 'closer', metricas: ['llamadas', 'minutos', 'puntaje'], x: 6, y: 11, w: 6, h: 8 }),
          g({ tipo: 'tabla_barras', fuente: 'pagos', fecha: 'vencimiento', dimension: 'cliente', metricas: ['monto', 'cobrado', 'pendiente'], x: 0, y: 19, w: 6, h: 8 }),
          g({ tipo: 'serie', fuente: 'leads', fecha: 'agenda', dimension: 'semana', metricas: ['agendas', 'asistencias'], periodo: 'ult90', x: 6, y: 19, w: 6, h: 8 }),
        ],
      },
    ],
  };
}
