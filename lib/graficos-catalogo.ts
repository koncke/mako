// =============================================================================
// graficos-catalogo — qué se puede dibujar en el Dashboard y con qué datos
// =============================================================================
// Pedido de Martín (10-11/10/2026): «quiero poder personalizar los gráficos para todos los
// usuarios… importante que sean funcionales, reales», «Puedes copiar la app de Google Data
// Studio para esto», «No, no se ve igual al editor de Looker, te pido que lo hagas igual» y,
// con la galería de Looker al lado: «faltan un montón de gráficos que puedes agregar… revisa
// todos los datos de MaKo que se podrían poner allí... Absolutamente todos».
//
// El molde es Looker Studio: un INFORME tiene HOJAS; cada hoja tiene su estilo (un TEMA, de
// lib/graficos-temas.ts), sus CONTROLES (los filtros de la vista, en la barra de arriba) y sus
// COMPONENTES: gráficos, bloques (lo de las tabs viejas que necesita su propia lectura) y elementos
// (texto, imagen, formas). Cada gráfico es un TIPO atado a un CONJUNTO DE DATOS de MaKo, con su
// «dimensión del período» (la fecha que decide qué filas entran), una DIMENSIÓN (verde), una
// dimensión de DESGLOSE opcional y una o más MÉTRICAS (azul).
//
// ⚠️ SIN `server-only` A PROPÓSITO: lo importan la pantalla (para dibujar los selectores), el
// server (para validar lo que llega) y los tests. Sólo datos y funciones puras.
//
// ⚠️ NADA DE SQL LIBRE. La persona elige entre los campos que esta lista declara, y el server
// valida cada gráfico contra ella (`sanearGrafico`) antes de leer. Agregar un campo es
// agregarlo acá Y enseñarle al lector (`lib/graficos-datos.ts`) a llenarlo; el test cruza las
// dos listas, porque un campo sin lector sale en cero y se lee como un dato.

import { diasAntes, esFechaValida } from './date-utils';
import { PALETA_MAKO, sanearTema, type TemaHoja } from './graficos-temas';
import { TOPE_DIRECCION, conDominio, esHostPropio } from './embeds';
import { DOMINIOS_MAKO } from './email-remitente';

import {
  AREAS, TIEMPO, cat, dist, m, r,
  type Area, type ClaseDim, type Dimension, type Formato, type Fuente, type Metrica,
} from './graficos-constructores';
import { FUENTES_EXTRA } from './graficos-fuentes-extra';
import { BLOQUES_EXTRA } from './graficos-bloques-extra-catalogo';

export { AREAS };
export type { Area, ClaseDim, Dimension, Formato, Fuente, Metrica };

const FUENTES_BASE: readonly Fuente[] = [
  // ── Negocio ───────────────────────────────────────────────────────────────────────────
  {
    id: 'negocio', nombre: 'Resumen del negocio', area: 'Negocio',
    descripcion: 'La pauta, el CRM y los cobros, día por día. Para el CAC y el ROAS.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO],
    metricas: [
      m('gasto', 'Gasto en anuncios', 'usd'), m('leads', 'Leads'), m('agendas', 'Agendas'), m('asistencias', 'Asistencias'),
      m('cierres', 'Cierres'), m('vendido', 'Vendido', 'usd'), m('cobrado', 'Cobrado', 'usd'),
      m('impresiones', 'Impresiones'), m('clics', 'Clics'), m('vistas_landing', 'Vistas de la landing'), m('vistas_vsl', 'Vistas del VSL'),
      r('cac', 'CAC', 'usd', 'gasto', 'cierres'), r('roas_cobrado', 'ROAS cobrado', 'veces', 'cobrado', 'gasto'),
      r('roas_vendido', 'ROAS vendido', 'veces', 'vendido', 'gasto'), r('cpl', 'Costo por lead', 'usd', 'gasto', 'leads'),
      r('cpa', 'Costo por agenda', 'usd', 'gasto', 'agendas'), r('tasa_cierre', 'Tasa de cierre', 'pct', 'cierres', 'asistencias', 100),
      r('cpm', 'CPM', 'usd', 'gasto', 'impresiones', 1000), r('cpc', 'CPC', 'usd', 'gasto', 'clics'),
      r('costo_landing', 'Costo por vista de landing', 'usd', 'gasto', 'vistas_landing'), r('costo_vsl', 'Costo por vista del VSL', 'usd', 'gasto', 'vistas_vsl'),
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
      m('vistas_landing', 'Vistas de la landing'), dist('anuncios', 'Anuncios'),
      r('costo_landing', 'Costo por vista de landing', 'usd', 'gasto', 'vistas_landing'),
      r('ctr', 'CTR', 'pct', 'clics', 'impresiones', 100), r('cpc', 'Costo por clic', 'usd', 'gasto', 'clics'),
      r('cpm', 'CPM', 'usd', 'gasto', 'impresiones', 1000), r('cpl', 'Costo por lead', 'usd', 'gasto', 'leads'),
      r('cpa', 'Costo por agenda', 'usd', 'gasto', 'agendas'),
    ],
  },
  {
    // La vieja «Audiencia y alcance» de Marketing: EN VIVO de la API de Meta, no está en la base
    // (lib/graficos-audiencia.ts). Sin Meta conectada no hay filas, y lo dice la tarjeta.
    id: 'audiencia', nombre: 'Audiencia de Meta', area: 'Marketing',
    descripcion: 'A quién le llegan tus anuncios: edad, género, plataforma y región. En vivo de Meta.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [cat('region', 'Región'), cat('plataforma', 'Plataforma'), { ...cat('edad', 'Edad'), ordenEtiqueta: true }, cat('genero', 'Género')],
    metricas: [
      m('impresiones', 'Impresiones'), { ...m('alcance', 'Alcance'), sinTotal: true }, m('clics', 'Clics'),
      m('agendas', 'Agendas'), m('gasto', 'Gasto', 'usd'),
      r('cpm', 'CPM', 'usd', 'gasto', 'impresiones', 1000), r('ctr', 'CTR', 'pct', 'clics', 'impresiones', 100),
    ],
    porDimension: true,
    cruces: { edad: ['genero'], genero: ['edad'] },
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
      // El lead mismo (su nombre, con su id en `r.lead`): es lo que lista el detalle de un número del CRM.
      // ⚠️ Es un NOMBRE DE PERSONA: no viaja a ningún modelo (queda FUERA de `DIMENSIONES_PUBLICAS`,
      // lib/graficos-analisis.ts; tests/graficos-interactividad.test.ts lo fija).
      cat('lead', 'Lead'),
    ],
    metricas: [
      m('leads', 'Leads'), m('agendas', 'Agendaron'), m('asistencias', 'Asistieron'), m('calificados', 'Calificados'),
      m('cierres', 'Cerraron'), m('vendido', 'Vendido', 'usd'), m('cobrado', 'Cobrado', 'usd'),
      m('no_show', 'No asistieron'), m('dias_ciclo', 'Días de ciclo'), m('con_ciclo', 'Cierres con ciclo'),
      r('tasa_no_show', 'No-show rate', 'pct', 'no_show', 'agendas', 100),
      // El ciclo se promedia sobre los cierres que tienen las DOS fechas: dividir por todos los
      // cierres lo achicaría con los que nunca tuvieron reunión cargada.
      r('ciclo', 'Ciclo de venta (días)', 'numero', 'dias_ciclo', 'con_ciclo'),
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
    // `llamada` es el título de cada llamada (con su recording_id en `r.llamada`): la fila del detalle.
    // `estado` (11/10/2026, para la hoja Closing): analizada, «Sin transcript», «Con error» o descartada;
    // la llena lib/graficos-datos.ts (P2a del relevo).
    dimensiones: [...TIEMPO, cat('closer', 'Closer'), cat('categoria', 'Categoría'), cat('reunion', 'Reunión'), cat('resultado', 'Resultado'), cat('estado', 'Estado'), cat('llamada', 'Llamada')],
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
    dimensiones: [...TIEMPO, cat('proyecto', 'Proyecto'), cat('prioridad', 'Prioridad'), cat('estado', 'Estado'), cat('origen', 'De dónde salió'), cat('responsable', 'Responsable'), cat('tarea', 'Tarea')],
    metricas: [m('tareas', 'Tareas'), m('hechas', 'Hechas'), m('abiertas', 'Abiertas'), r('avance', 'Avance promedio', 'pct', 'progreso', 'tareas'), m('progreso', 'Puntos de avance')],
  },
  // ── Customer Success ──────────────────────────────────────────────────────────────────
  {
    id: 'entrega', nombre: 'Clientes en entrega', area: 'Customer Success',
    descripcion: 'En qué etapa de la entrega está cada cliente, por producto.',
    fechas: [{ id: 'actual', nombre: 'Hoy', sinRango: true }, { id: 'desde', nombre: 'Llegó a la etapa' }],
    dimensiones: [...TIEMPO, cat('producto', 'Producto'), cat('etapa', 'Etapa'), cat('cliente', 'Cliente')],
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

// ── El DETALLE: qué hay atrás de un número (punto 5 del feedback) ─────────────────────────────
// Martín, 11/10/2026: «Los gráficos interactivos... Sería bueno que identifiques botones de acción
// dentro de MaKo que podríamos usar». Hacer clic en un número abre la lista de las COSAS que lo forman
// (los anuncios de un gasto, los leads de unas agendas, las cuotas de un cobro), cada una con sus
// acciones (lib/graficos-acciones.ts). El mapa es puro y vive al lado de los conjuntos porque nombra sus
// dimensiones y sus métricas: si una se renombra, el test lo ve acá.

/** Los ids que piden las acciones de una fila del detalle (la ficha de un lead, marcar una cuota…). */
export type IdEntidad = 'lead' | 'pago' | 'anuncio' | 'conjunto' | 'llamada' | 'tarea';
export type EntidadDetalle = 'anuncio' | 'conjunto' | 'lead' | 'cuota' | 'llamada' | 'tarea';
export type InfoEntidad = {
  entidad: EntidadDetalle;
  /** Cómo se nombra la lista: «Anuncios», «Cuotas». */
  plural: string;
  /** La clave de `Fila.r` que IDENTIFICA a la entidad. Se agrupa por el id, no por el nombre: dos anuncios que se llaman igual son dos filas. */
  ref: string;
  /** Las dimensiones que la nombran, juntas con « · » («Ana Pérez · Cuota 2»). */
  nombre: string[];
  /** Las que van chicas abajo del nombre. */
  linea: string[];
  /** De qué referencia sale cada id que piden las acciones. La cuota lleva LOS DOS de la misma fila (AGENTS: marcarPagoAction no valida el par). */
  ids: Partial<Record<IdEntidad, string>>;
  /** Las métricas que valen 1 por entidad (contarla a ELLA): en la lista son una columna de unos, no se muestran. */
  unidad: string[];
};
/** Los conjuntos cuyas filas son una COSA con id. Los demás (visitas, mensajes) no tienen detalle por fila: sólo «Filtrar». */
export const ENTIDADES: Readonly<Record<string, InfoEntidad>> = {
  meta: { entidad: 'anuncio', plural: 'Anuncios', ref: 'anuncio', nombre: ['anuncio'], linea: ['campana', 'conjunto'], ids: { anuncio: 'anuncio' }, unidad: ['anuncios'] },
  presupuesto: { entidad: 'conjunto', plural: 'Conjuntos', ref: 'conjunto', nombre: ['conjunto'], linea: ['estado'], ids: { conjunto: 'conjunto' }, unidad: ['conjuntos'] },
  leads: {
    entidad: 'lead', plural: 'Leads', ref: 'lead', nombre: ['lead'], linea: ['etapa', 'producto'], ids: { lead: 'lead' },
    unidad: ['leads', 'agendas', 'asistencias', 'calificados', 'cierres', 'no_show', 'con_ciclo'],
  },
  pagos: { entidad: 'cuota', plural: 'Cuotas', ref: 'cuota', nombre: ['cliente', 'cuota'], linea: ['estado'], ids: { pago: 'cuota', lead: 'cliente' }, unidad: ['pagos', 'clientes'] },
  llamadas: { entidad: 'llamada', plural: 'Llamadas', ref: 'llamada', nombre: ['llamada'], linea: ['closer', 'reunion'], ids: { llamada: 'llamada', lead: 'lead' }, unidad: ['llamadas', 'con_puntaje'] },
  // Las de VENTA (lib/graficos-fuentes-extra.ts): las que mira la hoja Closing. La misma forma que
  // `llamadas`; su dimensión `llamada` (el título, con el recording_id en `r.llamada`) la pone el conjunto.
  llamadas_venta: { entidad: 'llamada', plural: 'Llamadas', ref: 'llamada', nombre: ['llamada'], linea: ['closer', 'reunion'], ids: { llamada: 'llamada', lead: 'lead' }, unidad: ['llamadas', 'con_puntaje'] },
  tareas: { entidad: 'tarea', plural: 'Tareas', ref: 'tarea', nombre: ['tarea'], linea: ['proyecto', 'estado'], ids: { tarea: 'tarea' }, unidad: ['tareas', 'hechas', 'abiertas'] },
  entrega: { entidad: 'lead', plural: 'Clientes', ref: 'cliente', nombre: ['cliente'], linea: ['producto', 'etapa'], ids: { lead: 'cliente' }, unidad: ['clientes'] },
};

/** A qué lista abre un número: qué conjunto se lee, con qué fecha, qué métrica decide quién entra y qué columnas se muestran. */
export type DestinoDetalle = { fuente: string; fecha: string; incluye: string; columnas: string[] };

/**
 * El resumen del negocio no tiene filas propias (junta la pauta, el CRM y los cobros por día), así que cada
 * métrica abre las de su conjunto. Una RAZÓN abre lo que la persona quiere mirar cuando la ve: el CAC y el
 * ROAS vendido abren los cierres, el ROAS cobrado los cobros, el CPM y el CPC los anuncios.
 */
const DETALLE_NEGOCIO: Readonly<Record<string, DestinoDetalle>> = {
  gasto: { fuente: 'meta', fecha: 'fecha', incluye: 'gasto', columnas: ['gasto', 'leads', 'cpl'] },
  impresiones: { fuente: 'meta', fecha: 'fecha', incluye: 'impresiones', columnas: ['impresiones', 'gasto', 'cpm'] },
  clics: { fuente: 'meta', fecha: 'fecha', incluye: 'clics', columnas: ['clics', 'ctr', 'cpc'] },
  vistas_landing: { fuente: 'meta', fecha: 'fecha', incluye: 'vistas_landing', columnas: ['vistas_landing', 'costo_landing'] },
  cpm: { fuente: 'meta', fecha: 'fecha', incluye: 'cpm', columnas: ['cpm', 'gasto', 'impresiones'] },
  cpc: { fuente: 'meta', fecha: 'fecha', incluye: 'cpc', columnas: ['cpc', 'gasto', 'clics'] },
  cpl: { fuente: 'meta', fecha: 'fecha', incluye: 'cpl', columnas: ['cpl', 'gasto', 'leads'] },
  cpa: { fuente: 'meta', fecha: 'fecha', incluye: 'cpa', columnas: ['cpa', 'gasto', 'agendas'] },
  costo_landing: { fuente: 'meta', fecha: 'fecha', incluye: 'costo_landing', columnas: ['costo_landing', 'gasto', 'vistas_landing'] },
  // Las vistas del VSL no son de un anuncio (YouTube y Panda, por día): su costo abre el gasto.
  costo_vsl: { fuente: 'meta', fecha: 'fecha', incluye: 'gasto', columnas: ['gasto'] },
  leads: { fuente: 'leads', fecha: 'alta', incluye: 'leads', columnas: [] },
  agendas: { fuente: 'leads', fecha: 'agenda', incluye: 'agendas', columnas: [] },
  asistencias: { fuente: 'leads', fecha: 'agenda', incluye: 'asistencias', columnas: [] },
  cierres: { fuente: 'leads', fecha: 'cierre', incluye: 'cierres', columnas: ['vendido'] },
  vendido: { fuente: 'leads', fecha: 'cierre', incluye: 'vendido', columnas: ['vendido'] },
  tasa_cierre: { fuente: 'leads', fecha: 'cierre', incluye: 'cierres', columnas: ['vendido'] },
  cac: { fuente: 'leads', fecha: 'cierre', incluye: 'cierres', columnas: ['vendido'] },
  roas_vendido: { fuente: 'leads', fecha: 'cierre', incluye: 'vendido', columnas: ['vendido'] },
  cobrado: { fuente: 'pagos', fecha: 'pago', incluye: 'cobrado', columnas: ['cobrado'] },
  roas_cobrado: { fuente: 'pagos', fecha: 'pago', incluye: 'cobrado', columnas: ['cobrado'] },
};

/**
 * A qué detalle abre la métrica `metrica` de un gráfico de `fuenteId` leído por `fecha`. `null` = ese número
 * no tiene filas atrás que se puedan listar (las vistas del VSL, los mensajes): no se dibuja clickeable.
 * En un conjunto con entidad, el detalle es el MISMO conjunto con la misma fecha; las columnas son la
 * métrica y, si es una razón, sus dos bases — salvo las que valen 1 por fila (`unidad`), que no informan.
 */
export function destinoDetalle(fuenteId: string, fecha: string, metrica: string | null | undefined): DestinoDetalle | null {
  if (!metrica) return null;
  if (fuenteId === 'negocio') {
    const x = DETALLE_NEGOCIO[metrica];
    return x ? { ...x, columnas: [...x.columnas] } : null;
  }
  const ent = ENTIDADES[fuenteId];
  // TODOS los conjuntos, también los de las tabs de Analysts: hasta el 11/10/2026 se buscaba sólo en
  // FUENTES_BASE, así que una entidad de un conjunto extra (`llamadas_venta`) quedaba declarada y su
  // número no se podía abrir nunca, sin un error.
  const fuente = fuenteDe(fuenteId);
  const mm = fuente?.metricas.find((x) => x.id === metrica);
  if (!ent || !fuente || !mm || !fuente.fechas.some((x) => x.id === fecha)) return null;
  const esUnidad = (id: string): boolean => {
    if (ent.unidad.includes(id)) return true;
    const b = fuente.metricas.find((x) => x.id === id);
    // Una razón entre dos «unidades» (la tasa de cierre de UN lead) es 0% o 100%: tampoco informa.
    return !!b?.razon && ent.unidad.includes(b.razon.num) && ent.unidad.includes(b.razon.den);
  };
  const candidatas = mm.razon ? [mm.id, mm.razon.num, mm.razon.den] : [mm.id];
  return { fuente: fuenteId, fecha, incluye: mm.id, columnas: [...new Set(candidatas)].filter((id) => !esUnidad(id)).slice(0, 3) };
}

/** Los conjuntos del Dashboard: los de siempre y los de las tabs de Analysts (lib/graficos-fuentes-extra.ts). */
export const FUENTES: readonly Fuente[] = [...FUENTES_BASE, ...FUENTES_EXTRA];

export type FuenteId = string;

// ── Los tipos de gráfico: la galería de Looker Studio ─────────────────────────────────────

export type Grupo = 'Mapa' | 'Tabla' | 'Cuadro de resultados' | 'Serie temporal' | 'Barras' | 'Histograma' | 'Circular' | 'Líneas' | 'Áreas' | 'Dispersión' | 'Tabla dinámica' | 'Bala' | 'Gráfico de rectángulos' | 'Sankey' | 'Indicador' | 'Cascada' | 'Cronología' | 'Embudo de conversión';

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
  /** Sólo estas dimensiones (el mapa: la región). */
  soloDims?: readonly string[];
  w: number;
  h: number;
};

const t = (id: string, nombre: string, grupo: Grupo, dimension: InfoTipo['dimension'], desglose: InfoTipo['desglose'], minMetricas: number, maxMetricas: number, w: number, h: number, soloSumas?: true): InfoTipo =>
  ({ id, nombre, grupo, dimension, desglose, minMetricas, maxMetricas, w, h, ...(soloSumas ? { soloSumas } : {}) });

// Los nombres y los grupos son los de la galería de Looker (pedido de Martín, 11/10/2026).
export const TIPOS: readonly InfoTipo[] = [
  t('tabla', 'Tabla', 'Tabla', 'cualquiera', 'no', 1, 8, 6, 8),
  t('tabla_barras', 'Tabla con barras', 'Tabla', 'cualquiera', 'no', 1, 8, 6, 8),
  t('tabla_calor', 'Tabla con mapa de calor', 'Tabla', 'cualquiera', 'no', 1, 8, 6, 8),
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
  // El de las tabs viejas de Marketing y Comercial: trapecios de arriba a abajo, con la caída
  // entre etapas en un chip (pedido de Martín, 11/10/2026: «con el mismo diseño»).
  t('embudo_vertical', 'Embudo vertical', 'Embudo de conversión', 'ninguna', 'no', 2, 8, 6, 12, true),
  // El mapa de México de la vieja «Audiencia y alcance» (app/dashboard/MapaMexico.tsx).
  { ...t('mapa', 'Mapa de México', 'Mapa', 'categoria', 'no', 1, 1, 6, 10, true), soloDims: ['region'] },
];
export const GRUPOS: readonly Grupo[] = [...new Set(TIPOS.map((x) => x.grupo))];

// ── El período ────────────────────────────────────────────────────────────────────────────

export type Preset = 'hoy' | 'ayer' | 'ult7' | 'ult14' | 'ult28' | 'ult30' | 'ult90' | 'este_mes' | 'mes_pasado' | 'este_anio' | 'ult12m' | 'anio_pasado' | 'todo' | 'personalizado';
export const PRESETS: ReadonlyArray<{ id: Preset; nombre: string }> = [
  { id: 'hoy', nombre: 'Hoy' }, { id: 'ayer', nombre: 'Ayer' }, { id: 'ult7', nombre: 'Últimos 7 días' },
  { id: 'ult14', nombre: 'Últimos 14 días' }, { id: 'ult28', nombre: 'Últimos 28 días' }, { id: 'ult30', nombre: 'Últimos 30 días' },
  { id: 'ult90', nombre: 'Últimos 90 días' }, { id: 'este_mes', nombre: 'Este mes' }, { id: 'mes_pasado', nombre: 'El mes pasado' },
  { id: 'este_anio', nombre: 'Este año' }, { id: 'ult12m', nombre: 'Últimos 12 meses' }, { id: 'anio_pasado', nombre: 'El año pasado' }, { id: 'todo', nombre: 'Todo' },
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
    // Doce meses enteros contando éste: la vieja Tendencia mensual de Comercial.
    case 'ult12m': { const [ay, am] = mo === 12 ? [y, 1] : [y - 1, mo + 1]; return { desde: mes(ay, am), hasta: hoy }; }
    case 'anio_pasado': return { desde: `${y - 1}-01-01`, hasta: `${y - 1}-12-31` };
    case 'todo': return { desde: DESDE_TODO, hasta: hoy };
    case 'personalizado':
      if (desde && hasta && esFechaValida(desde) && esFechaValida(hasta) && desde <= hasta) return { desde, hasta };
      return { desde: diasAntes(hoy, 29), hasta: hoy };
    default: return { desde: diasAntes(hoy, 29), hasta: hoy };
  }
}

export const nombrePreset = (p: Preset) => PRESETS.find((x) => x.id === p)?.nombre ?? p;

// ── El estilo: es de la PÁGINA (lib/graficos-temas.ts) ───────────────────────────────────
// Martín, 11/10/2026 (punto 8): «no permitas editar el estilo de cada componente... en la topbar
// de edición poder editar el estilo de toda la página». Un gráfico conserva sólo lo que es
// CONTENIDO —título, subtítulo, si se compara con el período anterior, el objetivo, la fila de
// total— y el color de una KPI sale de lo que SIGNIFICA su métrica (`tonoDe`), no de un color
// elegido a mano. Lo que un informe viejo guardó en `estilo` se lee una vez (compatibilidad) y se
// descarta al guardar.

/** La paleta de MaKo, para quien todavía la importe de acá. La que se dibuja sale del tema. */
export const PALETA: readonly string[] = PALETA_MAKO;

export type Tono = 'bueno' | 'malo' | 'acento';
const TONOS: Record<string, Record<string, Tono>> = {
  negocio: { cobrado: 'bueno', vendido: 'acento', roas_cobrado: 'bueno' },
  pagos: { cobrado: 'bueno', pendiente: 'malo' },
  leads: { cierres: 'bueno', vendido: 'acento', cobrado: 'bueno' },
};
/** El color de una KPI según su métrica: lo cobrado es bueno, lo pendiente es malo (las tarjetas viejas). */
export const tonoDe = (fuente: string, metrica: string | undefined): Tono | null => (metrica ? TONOS[fuente]?.[metrica] ?? null : null);

const numONull = (v: unknown) => (v === null || v === '' || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

// ── Los CONTROLES: los filtros de la VISTA ─────────────────────────────────────────────────
// Martín, 11/10/2026 (puntos 12-14): «El botón de "Añadir control", no debería ser algo que
// aparezca en la tab de edición, sino que justamente es una forma de añadir filtros en la vista...
// siempre configurado en el mismo lugar, como en una topbar del lienzo que se desplaza con el
// scroll» y «es importante poder agregar un control a cada grafico... revisa que eso no produzca
// bugs. Como por ejemplo, que se pisen los filtros sin sentido».
//
// Los controles NO son componentes de la grilla: los de la HOJA van en la barra de arriba del
// lienzo y los de un GRÁFICO en su cabecera. Lo que alguien elige MIRANDO no se guarda (es estado
// de la vista, como en Looker); lo que se guarda es lo que el control muestra de entrada.
//
// Cómo no se pisan (una sola función decide, `efectivoDe`):
//   · Período: el control del gráfico > el período propio del gráfico > el control de la hoja >
//     los últimos 30 días.
//   · Filtros: sobre un MISMO campo gana el del gráfico y REEMPLAZA al de la hoja (no se
//     intersectan: dos listas distintas darían cero filas sin decir por qué); campos distintos se
//     suman con Y.
//   · Un filtro sólo llega a un gráfico si el campo SIGNIFICA LO MISMO en su conjunto (CAMPOS). Si no
//     puede aplicarlo, la tarjeta lo dice («no filtra por Campaña»): un número sin filtrar que se lee
//     como filtrado es peor que ningún filtro.
//   · Uno por cosa en cada lugar: un período, un «agrupar por» y un control por campo. Con dos, el
//     segundo sería decorativo (el bug del v2: mandaba el primero del array).

export type TipoControl = 'periodo' | 'lista' | 'texto' | 'agrupar';
export const TIPOS_CONTROL: ReadonlyArray<{ id: TipoControl; nombre: string; linea: string }> = [
  { id: 'periodo', nombre: 'Período', linea: 'Qué fechas mirar' },
  { id: 'lista', nombre: 'Lista desplegable', linea: 'Uno o varios valores de un campo' },
  { id: 'texto', nombre: 'Búsqueda', linea: 'Lo que contenga un texto' },
  { id: 'agrupar', nombre: 'Agrupar por', linea: 'Día, semana o mes' },
];
export type Agrupar = 'auto' | 'dia' | 'semana' | 'mes';
export const AGRUPAR: ReadonlyArray<{ id: Agrupar; nombre: string }> = [
  { id: 'auto', nombre: 'Automático' }, { id: 'dia', nombre: 'Día' }, { id: 'semana', nombre: 'Semana' }, { id: 'mes', nombre: 'Mes' },
];

export type ControlVista = {
  id: string;
  tipo: TipoControl;
  /** El campo que filtra (lista y búsqueda): un id de CAMPOS. */
  campo: string | null;
  /** Lo que el control muestra de entrada. */
  preset: Preset;
  desde: string | null;
  hasta: string | null;
  /** `null` = todos. NUNCA `[]` para «todos»: el vacío significaría dos cosas. */
  valores: string[] | null;
  texto: string;
  agrupar: Agrupar;
};
/** Lo que alguien eligió MIRANDO, por id de control. No se guarda en el informe. */
export type ValorControl = Partial<Pick<ControlVista, 'preset' | 'desde' | 'hasta' | 'valores' | 'texto' | 'agrupar'>>;
export type VistaValores = Record<string, ValorControl>;

export const MAX_CONTROLES = 8;
export const MAX_VALORES = 50;

// ── Los CAMPOS: lo que un filtro puede mirar, y en qué conjuntos significa lo mismo ─────────

export type Campo = { id: string; nombre: string; en: Record<string, string> };
/**
 * Las dimensiones que significan LO MISMO en más de un conjunto. EN POSITIVO: sólo las que están acá
 * cruzan de conjunto. Un id de dimensión repetido no alcanza: «estado» está en diez conjuntos y
 * significa diez cosas («Estado = Pagada» de los pagos dejaría en cero las tareas).
 * ⚠️ La campaña de un lead es `meta_campaign_name ?? utm_campaign`: un lead que sólo trae UTM puede
 *    venir con otro texto que la de Meta.
 */
const COMPARTIDOS: readonly Campo[] = [
  { id: 'campana', nombre: 'Campaña', en: { meta: 'campana', leads: 'campana', guiones: 'campana' } },
  { id: 'conjunto', nombre: 'Conjunto', en: { meta: 'conjunto', presupuesto: 'conjunto', guiones: 'conjunto' } },
  { id: 'anuncio', nombre: 'Anuncio', en: { meta: 'anuncio', leads: 'anuncio' } },
  { id: 'pagina', nombre: 'Página', en: { visitas: 'pagina', vsl: 'pagina', replays: 'pagina', clics: 'pagina', scroll: 'pagina', toques: 'pagina', retencion_vsl: 'pagina', landing_analisis: 'pagina' } },
  { id: 'producto', nombre: 'Producto', en: { leads: 'producto', entrega: 'producto' } },
  { id: 'closer', nombre: 'Closer', en: { leads: 'closer', llamadas: 'closer', llamadas_venta: 'closer', llamadas_dimensiones: 'closer' } },
  { id: 'automatizacion', nombre: 'Automatización', en: { inscripciones: 'automatizacion', envios: 'automatizacion' } },
];
/** Todos los campos: los compartidos y, para el resto de las categorías, uno por conjunto («Estado · Pagos»). */
export const CAMPOS: readonly Campo[] = (() => {
  const out: Campo[] = [...COMPARTIDOS];
  for (const f of FUENTES) {
    for (const d of f.dimensiones) {
      if (d.clase !== 'categoria') continue;
      if (COMPARTIDOS.some((c) => c.en[f.id] === d.id)) continue;
      out.push({ id: `${f.id}.${d.id}`, nombre: `${d.nombre} · ${f.nombre}`, en: { [f.id]: d.id } });
    }
  }
  return out;
})();
export const campoDe = (id: string | null | undefined): Campo | undefined => (id ? CAMPOS.find((c) => c.id === id) : undefined);
/** Los campos que un conjunto puede filtrar. */
export const camposDeFuente = (fuenteId: string): Campo[] => CAMPOS.filter((c) => c.en[fuenteId]);

export function sanearControlVista(raw: unknown): ControlVista | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const tipo = TIPOS_CONTROL.some((t) => t.id === o.tipo) ? (o.tipo as TipoControl) : null;
  if (!tipo) return null;
  const campo = (tipo === 'lista' || tipo === 'texto') ? (campoDe(String(o.campo ?? ''))?.id ?? null) : null;
  // Una lista o una búsqueda sin un campo que exista no filtra nada: se descarta en vez de dibujar
  // un control muerto.
  if ((tipo === 'lista' || tipo === 'texto') && !campo) return null;
  const valores = Array.isArray(o.valores)
    ? [...new Set(o.valores.map((v) => String(v).trim().slice(0, 120)).filter(Boolean))].slice(0, MAX_VALORES)
    : null;
  return {
    id: idValido(o.id) ?? nuevoId(), tipo, campo,
    preset: presetValido(o.preset) ? o.preset : PRESET_AUTOMATICO,
    desde: fechaONull(o.desde), hasta: fechaONull(o.hasta),
    valores: valores && valores.length ? valores : null,
    texto: texto(o.texto, 80),
    agrupar: AGRUPAR.some((a) => a.id === o.agrupar) ? (o.agrupar as Agrupar) : 'auto',
  };
}

/** Uno por cosa: un período, un «agrupar por» y uno por campo. Con dos, el segundo no haría nada. */
export function sanearControles(raw: unknown): ControlVista[] {
  const lista = Array.isArray(raw) ? raw : [];
  const out: ControlVista[] = [];
  const claves = new Set<string>();
  const ids = new Set<string>();
  for (const x of lista) {
    if (out.length >= MAX_CONTROLES) break;
    const c = sanearControlVista(x);
    if (!c) continue;
    const clave = c.tipo === 'periodo' || c.tipo === 'agrupar' ? c.tipo : `campo:${c.campo}`;
    if (claves.has(clave)) continue;
    claves.add(clave);
    if (ids.has(c.id)) c.id = nuevoId();
    ids.add(c.id);
    out.push(c);
  }
  return out;
}

/** ¿Este control está filtrando algo? Un período y un «agrupar por» siempre deciden. */
export function controlActivo(c: ControlVista): boolean {
  if (c.tipo === 'lista') return !!c.valores && c.valores.length > 0;
  if (c.tipo === 'texto') return c.texto.trim().length > 0;
  return true;
}

/** El control con lo que se eligió mirando encima (lo elegido gana; lo que no se tocó, lo de entrada). */
export function conVista(c: ControlVista, vista: VistaValores): ControlVista {
  const v = vista[c.id];
  if (!v) return c;
  return {
    ...c,
    ...(v.preset !== undefined && presetValido(v.preset) ? { preset: v.preset, desde: fechaONull(v.desde), hasta: fechaONull(v.hasta) } : {}),
    ...(v.valores !== undefined ? { valores: Array.isArray(v.valores) && v.valores.length ? v.valores.slice(0, MAX_VALORES) : null } : {}),
    ...(v.texto !== undefined ? { texto: texto(v.texto, 80) } : {}),
    ...(v.agrupar !== undefined && AGRUPAR.some((a) => a.id === v.agrupar) ? { agrupar: v.agrupar } : {}),
  };
}

export type FiltroDim = { dimension: string; valores?: string[]; texto?: string };
/** Lo que un componente mira de verdad, resuelto de una vez. La usan el pedido de datos, la firma y los chips. */
export type Efectivo = {
  desde: string;
  hasta: string;
  filtros: FiltroDim[];
  /** Para los gráficos con dimensión de tiempo: por día, semana o mes (null = la del gráfico). */
  agrupar: 'dia' | 'semana' | 'mes' | null;
  /** Los campos con un filtro activo que este componente NO puede aplicar (sus nombres). */
  noAplica: string[];
  /** Qué decide el componente por su cuenta: para marcarlo en la tarjeta. */
  propio: { periodo: boolean; campos: string[] };
};

const esTiempo = (d: string | null) => d === 'dia' || d === 'semana' || d === 'mes';
/** «Automático»: por día hasta un mes, por semana hasta medio año, si no por mes. */
export function agruparAuto(desde: string, hasta: string): 'dia' | 'semana' | 'mes' {
  const dias = Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;
  return dias <= 31 ? 'dia' : dias <= 180 ? 'semana' : 'mes';
}

export function efectivoDe(comp: Grafico | Bloque, hoja: Hoja, vista: VistaValores, hoy: string): Efectivo {
  const propios = comp.controles.map((c) => conVista(c, vista));
  const dePagina = hoja.controles.map((c) => conVista(c, vista));

  const pPropio = propios.find((c) => c.tipo === 'periodo');
  const pPagina = dePagina.find((c) => c.tipo === 'periodo');
  let rango: { desde: string; hasta: string };
  let periodoPropio = false;
  if (pPropio) { rango = rangoDe(pPropio.preset, hoy, pPropio.desde, pPropio.hasta); periodoPropio = true; }
  else if (comp.periodo !== 'auto') { rango = rangoDe(comp.periodo, hoy, comp.desde, comp.hasta); periodoPropio = true; }
  else if (pPagina) rango = rangoDe(pPagina.preset, hoy, pPagina.desde, pPagina.hasta);
  else rango = rangoDe(PRESET_AUTOMATICO, hoy);

  const porCampo = new Map<string, ControlVista>();
  for (const c of dePagina) if ((c.tipo === 'lista' || c.tipo === 'texto') && c.campo && controlActivo(c)) porCampo.set(c.campo, c);
  const camposPropios: string[] = [];
  for (const c of propios) {
    if ((c.tipo !== 'lista' && c.tipo !== 'texto') || !c.campo) continue;
    camposPropios.push(c.campo);
    // El del gráfico REEMPLAZA al de la hoja en ese campo, aunque esté en «todos»: elegir «todos» en
    // la tarjeta es decidir que ese gráfico no se filtra por eso.
    if (controlActivo(c)) porCampo.set(c.campo, c); else porCampo.delete(c.campo);
  }

  const filtros: FiltroDim[] = [];
  const noAplica: string[] = [];
  const fuente = comp.clase === 'grafico' ? fuenteDe(comp.fuente) : undefined;
  for (const [campo, c] of porCampo) {
    const dim = fuente ? campoDe(campo)?.en[fuente.id] : undefined;
    if (!dim) { noAplica.push(campoDe(campo)?.nombre ?? campo); continue; }
    filtros.push(c.tipo === 'lista' ? { dimension: dim, valores: c.valores ?? [] } : { dimension: dim, texto: c.texto.trim() });
  }

  const aPropio = propios.find((c) => c.tipo === 'agrupar');
  const aPagina = dePagina.find((c) => c.tipo === 'agrupar');
  const ag = (aPropio ?? aPagina)?.agrupar ?? null;
  const agrupar = ag && comp.clase === 'grafico' && esTiempo(comp.dimension) ? (ag === 'auto' ? agruparAuto(rango.desde, rango.hasta) : ag) : null;

  return { ...rango, filtros, agrupar, noAplica, propio: { periodo: periodoPropio, campos: camposPropios } };
}

/** El período que mira un componente (lo que la vista no tocó). Atajo de `efectivoDe`. */
export function rangoDeGrafico(g: Grafico | Bloque, hoja: Hoja, hoy: string): { desde: string; hasta: string } {
  const e = efectivoDe(g, hoja, {}, hoy);
  return { desde: e.desde, hasta: e.hasta };
}

// ── Componentes, hojas e informe ──────────────────────────────────────────────────────────

export type Grafico = {
  id: string;
  clase: 'grafico';
  tipo: string;
  /** Vacío = el título se arma solo con la métrica y la dimensión (`tituloDe`). */
  titulo: string;
  /** La línea chica de abajo del número, o de abajo del título («Spend ÷ cierres del período»). */
  subtitulo: string;
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
  /** El chip «↑ 1,3×» contra el período anterior del mismo largo (una lectura más). */
  comparar: boolean;
  /** La bala y el indicador. */
  objetivo: number | null;
  maximo: number | null;
  /** La fila de total de las tablas. */
  total: boolean;
  /** Los controles de ESTE gráfico, en su cabecera. */
  controles: ControlVista[];
  x: number; y: number; w: number; h: number;
};

/**
 * Lo que necesita su propia lectura y su propia acción y no entra en el agregador genérico: «A
 * quién cobrarle» elige UNA cuota por cliente (la próxima) y la marca cobrada; las cohortes maduras
 * son una propiedad de la semana, no de la fila. Leen las MISMAS funciones que la tab vieja y que los
 * runners de MaKo (lib/queries.ts, lib/pagos.ts), así la pantalla, WhatsApp y la API no cuentan
 * distinto (lib/graficos-bloques.ts).
 */
/** El id de un bloque: los de Comercial (abajo) y los de las tabs de Analysts (lib/graficos-bloques-extra-catalogo.ts). */
export type BloqueId = string;
export type InfoBloque = { id: BloqueId; nombre: string; linea: string; w: number; h: number };
const BLOQUES_BASE: readonly InfoBloque[] = [
  { id: 'revenue', nombre: 'Revenue', linea: 'Vendido, cobrado y lo que falta cobrar, con la barra', w: 12, h: 9 },
  { id: 'cobranza', nombre: 'A quién cobrarle', linea: 'Cada cliente con su próxima cuota y «Marcar cobrada»', w: 12, h: 8 },
  { id: 'funnel_maduro', nombre: 'Salud del funnel comercial', linea: 'Las cohortes maduras: agenda, asistió, calificado, cierre', w: 12, h: 12 },
  { id: 'scl', nombre: 'Ciclo de venta (SCL)', linea: 'Los días de cada tramo, de la agenda al primer pago', w: 12, h: 8 },
  { id: 'cohortes_mes', nombre: 'Cohortes mensuales', linea: 'Cada mes de reuniones y cuánto cerró', w: 12, h: 10 },
  { id: 'cohortes_semana', nombre: 'Cohortes semanales', linea: 'Cada semana de reuniones y si ya maduró', w: 12, h: 10 },
];
export const BLOQUES: readonly InfoBloque[] = [...BLOQUES_BASE, ...BLOQUES_EXTRA];
export const bloqueDe = (id: string) => BLOQUES.find((b) => b.id === id);

export type Bloque = {
  id: string;
  clase: 'bloque';
  bloque: BloqueId;
  titulo: string;
  subtitulo: string;
  periodo: Preset | 'auto';
  desde: string | null;
  hasta: string | null;
  /** Sólo el período tiene sentido para un bloque. */
  controles: ControlVista[];
  x: number; y: number; w: number; h: number;
};

/**
 * Lo que se inserta como en Looker (punto 18): texto, imagen, formas y flechas; y desde el 11/10/2026
 * (decisión 6 de Martín, «Closing Analyst va COMPLETO al Dashboard, sumando los elementos Enlace, Video e
 * Insertar») un ENLACE (a una pantalla de MaKo o afuera), un VIDEO (YouTube, Vimeo, Loom, Drive, Fathom…
 * o un archivo) y un INSERTADO (cualquier página https en un iframe con sandbox, como el «Insertar URL» de
 * Looker). Los dibuja app/dashboard/Elemento.tsx (el Enlace) y app/dashboard/ElementoInsertado.tsx.
 *
 * `minW`/`minH`: lo más chico que se puede achicar en la grilla. Un video o una página de 1×1 no se ven:
 * la pantalla los lee de acá (`minimoDeElemento`) y el saneo no deja guardar menos.
 * `grupo`: las secciones del menú «Insertar».
 * ⚠️ MaKo (el AI Analyst) NO crea elementos que no sean un título (lib/graficos-ia.ts, `pieza`): un link o
 *    una página elegidos por un modelo serían un dato exacto en manos de un LLM.
 */
export type TipoElemento = 'texto' | 'enlace' | 'imagen' | 'video' | 'insertado' | 'rectangulo' | 'circulo' | 'linea' | 'flecha';
export type GrupoElemento = 'texto' | 'medios' | 'formas';
export type InfoElemento = { id: TipoElemento; nombre: string; w: number; h: number; minW: number; minH: number; grupo: GrupoElemento };
export const TIPOS_ELEMENTO: ReadonlyArray<InfoElemento> = [
  { id: 'texto', nombre: 'Texto', w: 12, h: 2, minW: 1, minH: 1, grupo: 'texto' },
  { id: 'enlace', nombre: 'Enlace', w: 4, h: 2, minW: 1, minH: 1, grupo: 'texto' },
  { id: 'imagen', nombre: 'Imagen', w: 4, h: 6, minW: 1, minH: 1, grupo: 'medios' },
  { id: 'video', nombre: 'Video', w: 6, h: 7, minW: 3, minH: 4, grupo: 'medios' },
  { id: 'insertado', nombre: 'Insertar', w: 12, h: 12, minW: 3, minH: 4, grupo: 'medios' },
  { id: 'rectangulo', nombre: 'Rectángulo', w: 4, h: 4, minW: 1, minH: 1, grupo: 'formas' },
  { id: 'circulo', nombre: 'Círculo', w: 3, h: 4, minW: 1, minH: 1, grupo: 'formas' },
  { id: 'linea', nombre: 'Línea', w: 6, h: 1, minW: 1, minH: 1, grupo: 'formas' },
  { id: 'flecha', nombre: 'Flecha', w: 3, h: 2, minW: 1, minH: 1, grupo: 'formas' },
];
/** Lo más chico de un elemento en la grilla (el `minW`/`minH` del layout). Un tipo que no existe: 1×1. */
export function minimoDeElemento(tipo: string): { w: number; h: number } {
  const i = TIPOS_ELEMENTO.find((x) => x.id === tipo);
  return { w: i?.minW ?? 1, h: i?.minH ?? 1 };
}
/** Lo más largo del texto de cada tipo: el párrafo de un Texto, el de un Enlace, el título de un Video. */
const TOPE_TEXTO_ELEMENTO: Partial<Record<TipoElemento, number>> = { enlace: 300, video: 120, insertado: 120 };
/** El tope del texto de un tipo: el MISMO para el saneo y para los campos de la pantalla (su `maxLength`). */
export const topeDeTextoElemento = (tipo: TipoElemento): number => TOPE_TEXTO_ELEMENTO[tipo] ?? 2000;
export type Elemento = {
  id: string;
  clase: 'elemento';
  tipo: TipoElemento;
  /**
   * Texto: hasta 2000 caracteres; un salto de línea es un párrafo. Enlace: lo que se lee (300). Imagen:
   * su descripción. Video e Insertar: su título (120).
   */
  texto: string;
  tamano: 's' | 'm' | 'l' | 'xl';
  alinear: 'izquierda' | 'centro' | 'derecha';
  /** Un índice de la paleta del tema, o null = la tinta de la app (que se da vuelta en oscuro). */
  color: number | null;
  /** Formas: rellena o sólo el contorno. */
  relleno: boolean;
  /**
   * La dirección, saneada POR TIPO (`urlDeElemento`): imagen y video, https; enlace, un camino de MaKo
   * (`/crm`) o http/https afuera; insertado, https que no sea de MaKo. ⚠️ Lo que se guarda es SIEMPRE una
   * dirección: un código `<iframe>` pegado no se guarda nunca, sólo su `src`. Vacío = sin dirección.
   */
  url: string;
  ajuste: 'cubrir' | 'contener';
  direccion: 'derecha' | 'izquierda' | 'arriba' | 'abajo';
  grosor: 1 | 2 | 3 | 4;
  x: number; y: number; w: number; h: number;
};

export type Componente = Grafico | Bloque | Elemento;
export type Hoja = {
  id: string;
  nombre: string;
  /** Uno, o vacío. Va al lado del título (punto 15). */
  emoji: string;
  subtitulo: string;
  tema: TemaHoja;
  /** La barra de arriba del lienzo. */
  controles: ControlVista[];
  componentes: Componente[];
};
export type Tablero = { v: 3; nombre: string; hojas: Hoja[] };

export const NOMBRE_INICIAL = 'Dashboard';
export const COLS = 12;
// Que entre uno de cada tipo de la galería y lo que se inserta.
export const MAX_COMPONENTES = 60;
export const MAX_HOJAS = 20;
export const LIMITES = [3, 5, 10, 20, 50] as const;

export const fuenteDe = (id: string): Fuente | undefined => FUENTES.find((f) => f.id === id);
export const tipoDe = (id: string): InfoTipo | undefined => TIPOS.find((x) => x.id === id);
export const metricaDe = (f: Fuente, id: string): Metrica | undefined => f.metricas.find((x) => x.id === id);
export const dimensionDe = (f: Fuente, id: string | null): Dimension | undefined => (id ? f.dimensiones.find((d) => d.id === id) : undefined);
export const esGrafico = (c: Componente): c is Grafico => c.clase === 'grafico';
export const esBloque = (c: Componente): c is Bloque => c.clase === 'bloque';
export const esElemento = (c: Componente): c is Elemento => c.clase === 'elemento';

/** Las dimensiones que un tipo acepta, en el orden de la fuente. */
export function dimensionesPara(f: Fuente, tipo: string): Dimension[] {
  const x = tipoDe(tipo);
  if (!x || x.dimension === 'ninguna') return [];
  if (x.soloDims) return f.dimensiones.filter((d) => x.soloDims!.includes(d.id));
  if (x.dimension === 'cualquiera') return f.dimensiones;
  return f.dimensiones.filter((d) => d.clase === x.dimension);
}
/** Un desglose siempre es una categoría: partir por día una serie que ya va por día no dice nada. */
export function desglosesPara(f: Fuente, tipo: string, dimension: string | null): Dimension[] {
  const x = tipoDe(tipo);
  if (!x || x.desglose === 'no') return [];
  // Un conjunto que se lee por dimensión (la audiencia) sólo cruza lo que es UNA lectura.
  if (f.porDimension) return f.dimensiones.filter((d) => !!dimension && (f.cruces?.[dimension] ?? []).includes(d.id));
  return f.dimensiones.filter((d) => d.clase === 'categoria' && d.id !== dimension);
}
/** Las métricas que un tipo acepta: una torta o un embudo sólo aceptan lo que se suma. */
export function metricasPara(f: Fuente, tipo: string): Metrica[] {
  return tipoDe(tipo)?.soloSumas ? f.metricas.filter((x) => !x.razon && !x.sinTotal) : f.metricas;
}

const entero = (v: unknown, min: number, max: number, def: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
};
const presetValido = (v: unknown): v is Preset => PRESETS.some((p) => p.id === v);
const fechaONull = (v: unknown) => (typeof v === 'string' && esFechaValida(v) ? v : null);
const idValido = (v: unknown) => (typeof v === 'string' && /^[a-z0-9-]{1,40}$/i.test(v) ? v : null);
const periodoValido = (v: unknown): Preset | 'auto' => (v === 'auto' || v === undefined ? 'auto' : presetValido(v) ? v : 'auto');

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

  // Compatibilidad con el v2: lo que era CONTENIDO vivía adentro de `estilo`.
  const viejo = (o.estilo && typeof o.estilo === 'object' ? o.estilo : {}) as Record<string, unknown>;
  const de = (k: string) => (o[k] !== undefined ? o[k] : viejo[k]);

  return {
    id: idValido(o.id) ?? nuevoId(),
    clase: 'grafico', tipo,
    titulo: texto(o.titulo, 80),
    subtitulo: texto(de('subtitulo'), 80),
    fuente: fuente.id, fecha, dimension, desglose, metricas,
    limite: entero(o.limite, 3, 50, 10),
    ordenMetrica, ordenAsc: o.ordenAsc === true,
    periodo: periodoValido(o.periodo),
    desde: fechaONull(o.desde), hasta: fechaONull(o.hasta),
    comparar: de('comparar') === true,
    objetivo: numONull(de('objetivo')),
    maximo: numONull(de('maximo')),
    total: de('total') !== false,
    controles: sanearControles(o.controles),
    x: entero(o.x, 0, COLS - 1, 0), y: entero(o.y, 0, 999, 0),
    w: entero(o.w, 2, COLS, info.w), h: entero(o.h, 2, 24, info.h),
  };
}

export function sanearBloque(raw: unknown): Bloque | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const info = bloqueDe(String(o.bloque ?? ''));
  if (!info) return null;
  return {
    id: idValido(o.id) ?? nuevoId(), clase: 'bloque', bloque: info.id,
    titulo: texto(o.titulo, 80), subtitulo: texto(o.subtitulo, 80),
    periodo: periodoValido(o.periodo), desde: fechaONull(o.desde), hasta: fechaONull(o.hasta),
    controles: sanearControles(o.controles).filter((c) => c.tipo === 'periodo'),
    x: entero(o.x, 0, COLS - 1, 0), y: entero(o.y, 0, 999, 0),
    w: entero(o.w, 3, COLS, info.w), h: entero(o.h, 3, 30, info.h),
  };
}

/** Sólo https: el valor termina en un `src` (un `javascript:` o un `data:` gigante no entran). */
export const urlDeImagen = (v: unknown): string => (typeof v === 'string' && /^https:\/\/[^\s"'<>]{4,2000}$/i.test(v.trim()) ? v.trim() : '');

/** Un tab, un salto o un control ADENTRO de una URL lo borra el navegador: `/` + tab + `/evil.tld` es `//evil.tld`. */
const RE_INVISIBLES = /[\s\u0000-\u001f\u007f\\]/;

/**
 * Una dirección https que se puede guardar (video, insertado): sin usuario, clave ni puerto, con dominio
 * (ni `localhost` ni una IP) y hasta 2000, normalizada por `new URL`. '' = no. Un código `<iframe>` pegado
 * no pasa nunca (trae espacios): lo que se guarda es la dirección que la pantalla le sacó.
 * ⚠️ Es la vara de lo que se GUARDA, a propósito más floja que la de lo que se VE (`videoDe`,
 *    `insertableDe`, lib/embeds.ts): si mañana la lista de proveedores cambia, un link guardado no se
 *    borra en el próximo guardado; la pantalla dice por qué no se ve.
 */
export function urlHttps(v: unknown): string {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  if (!t || t.length > TOPE_DIRECCION || RE_INVISIBLES.test(t)) return '';
  let u: URL;
  try { u = new URL(t); } catch { return ''; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !conDominio(u.hostname)) return '';
  return u.href.length <= TOPE_DIRECCION ? u.href : '';
}
/** El link de un video: https (lo que se ve lo decide `videoDe`). */
export const urlDeVideo = urlHttps;
/** Lo que se inserta: https y NUNCA de MaKo (un iframe de nuestro origen con allow-same-origin se sacaría el sandbox). */
export const urlDeInsertado = (v: unknown): string => {
  const u = urlHttps(v);
  return u && !esHostPropio(new URL(u).hostname) ? u : '';
};

/** Lo más largo del camino de una pantalla de MaKo. */
const TOPE_CAMINO = 500;
/**
 * El camino de una pantalla de MaKo: `/` y después algo que NO sea otra `/` ni una `\` (`//x` y `/\x`
 * son OTRO host para el navegador), y que no sea una API ni un archivo de Next (un link no dispara un GET
 * a `/api/…` con la sesión de quien lo toca).
 */
const RE_CAMINO = /^\/(?![/\\])(?!(?:api|_next)(?:[/?#]|$))/i;

/**
 * El enlace de un elemento Enlace. Dos formas, y nada más:
 *   · un CAMINO de MaKo (`/crm?x=1`, hasta 500): se abre adentro con app/_ui/Link, que conserva el `?ws=`;
 *   · un link http/https con dominio (hasta 2000), que se abre en otra pestaña. Sin esquema y con forma
 *     de dominio (`ejemplo.com/x`), se le pone https, como a un link pegado (`direccionDeTexto`).
 * Un link a MaKo misma (`https://hola-mako.com/crm`) se guarda como su CAMINO: abierto afuera perdería
 * el cliente que se está mirando. Lo que nunca entra: `javascript:`, `data:`, `//otro.host`, usuario y
 * clave (`https://banco.com@otro.sitio`), `localhost` o una IP, y cualquier espacio o control adentro.
 */
export function urlDeEnlace(v: unknown): string {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  if (!t || t.length > TOPE_DIRECCION || RE_INVISIBLES.test(t)) return '';
  if (t.startsWith('/')) return t.length <= TOPE_CAMINO && RE_CAMINO.test(t) ? t : '';
  const conEsquema = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#]|$)/i.test(t) ? `https://${t}` : '';
  if (!conEsquema) return '';
  let u: URL;
  try { u = new URL(conEsquema); } catch { return ''; }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password || !conDominio(u.hostname)) return '';
  if (DOMINIOS_MAKO.includes(u.hostname.replace(/^www\./, ''))) {
    const camino = `${u.pathname}${u.search}${u.hash}`;
    return camino.length <= TOPE_CAMINO && RE_CAMINO.test(camino) ? camino : '';
  }
  return u.href.length <= TOPE_DIRECCION ? u.href : '';
}

/** La dirección de un elemento, saneada según su tipo. Los que no llevan dirección (texto, formas) guardan ''. */
export function urlDeElemento(tipo: TipoElemento, v: unknown): string {
  switch (tipo) {
    case 'imagen': return urlDeImagen(v);
    case 'enlace': return urlDeEnlace(v);
    case 'video': return urlDeVideo(v);
    case 'insertado': return urlDeInsertado(v);
    default: return '';
  }
}

export function sanearElemento(raw: unknown): Elemento | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const info = TIPOS_ELEMENTO.find((x) => x.id === o.tipo);
  if (!info) return null;
  const uno = <T extends string>(v: unknown, ops: readonly T[], def: T): T => (ops.includes(v as T) ? (v as T) : def);
  const color = typeof o.color === 'number' && Number.isInteger(o.color) && o.color >= 0 && o.color < 8 ? o.color : null;
  const grosor = [1, 2, 3, 4].includes(Number(o.grosor)) ? (Number(o.grosor) as 1 | 2 | 3 | 4) : 2;
  return {
    id: idValido(o.id) ?? nuevoId(), clase: 'elemento', tipo: info.id,
    texto: texto(o.texto, topeDeTextoElemento(info.id)),
    tamano: uno(o.tamano, ['s', 'm', 'l', 'xl'] as const, info.id === 'texto' ? 'l' : 'm'),
    alinear: uno(o.alinear, ['izquierda', 'centro', 'derecha'] as const, 'izquierda'),
    color, relleno: o.relleno !== false,
    url: urlDeElemento(info.id, o.url),
    ajuste: uno(o.ajuste, ['cubrir', 'contener'] as const, 'cubrir'),
    direccion: uno(o.direccion, ['derecha', 'izquierda', 'arriba', 'abajo'] as const, 'derecha'),
    grosor,
    x: entero(o.x, 0, COLS - 1, 0), y: entero(o.y, 0, 999, 0),
    w: entero(o.w, info.minW, COLS, info.w), h: entero(o.h, info.minH, 30, info.h),
  };
}

/** Despacha por CLASE. Un control del v2 (`tipo: 'periodo'` en la grilla) no es un componente: lo muda `sanearHoja`. */
export function sanearComponente(raw: unknown): Componente | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { clase?: unknown; tipo?: unknown };
  if (o.clase === 'control' || (o.clase === undefined && o.tipo === 'periodo')) return null;
  if (o.clase === 'bloque') return sanearBloque(raw);
  if (o.clase === 'elemento') return sanearElemento(raw);
  return sanearGrafico(raw);
}

/** Un emoji (o nada). Se recorta por caracteres, no por bytes: un emoji compuesto no se parte. */
export const emojiValido = (v: unknown): string => (typeof v === 'string' ? [...v.trim()].slice(0, 4).join('').slice(0, 16) : '');

export function sanearHoja(raw: unknown, i: number): Hoja | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const lista = Array.isArray(o.componentes) ? o.componentes : [];
  const vistos = new Set<string>();
  const componentes: Componente[] = [];
  for (const c of lista.slice(0, MAX_COMPONENTES + MAX_CONTROLES)) {
    if (componentes.length >= MAX_COMPONENTES) break;
    const s = sanearComponente(c);
    if (!s) continue;
    // Dos componentes con el mismo id son una sola key en la grilla: el segundo se pisaría.
    if (vistos.has(s.id)) s.id = nuevoId();
    vistos.add(s.id);
    componentes.push(s);
  }
  // Un informe del v2 tenía el control de período ADENTRO de la grilla: se muda a la barra.
  const viejos = lista.filter((c) => c && typeof c === 'object' && ((c as { clase?: unknown }).clase === 'control' || (c as { tipo?: unknown }).tipo === 'periodo') && (c as { fuente?: unknown }).fuente === undefined)
    .map((c) => ({ ...(c as object), tipo: 'periodo' }));
  const controles = sanearControles([...(Array.isArray(o.controles) ? o.controles : []), ...viejos]);
  const nombre = typeof o.nombre === 'string' && o.nombre.trim() ? o.nombre.trim().slice(0, 40) : `Página ${i + 1}`;
  return {
    id: idValido(o.id) ?? nuevoId(), nombre,
    emoji: emojiValido(o.emoji), subtitulo: texto(o.subtitulo, 140),
    tema: sanearTema(o.tema), controles, componentes,
  };
}

/** Una hoja vacía, con todo lo que una hoja tiene (nada armado a mano: así no se pierde un campo). */
export function hojaVacia(nombre: string, extra: Partial<Hoja> = {}): Hoja {
  return sanearHoja({ id: nuevoId(), nombre, ...extra }, 0)!;
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
  if (!hojas.length) hojas.push(hojaVacia('Página 1'));
  const nombre = typeof o.nombre === 'string' && o.nombre.trim() ? o.nombre.trim().slice(0, 80) : NOMBRE_INICIAL;
  return { v: 3, nombre, hojas };
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
  // El mapa sólo existe sobre una región.
  if (info.soloDims && !f.dimensiones.some((d) => info.soloDims!.includes(d.id))) f = FUENTES.find((x) => x.dimensiones.some((d) => info.soloDims!.includes(d.id)))!;
  const base: Record<string, unknown> = { id: nuevoId(), tipo: info.id, fuente: f.id, w: info.w, h: info.h, x: 0, y: abajoDeTodo(componentes) };
  if (info.dimension === 'tiempo') base.dimension = 'dia';
  if (info.grupo === 'Embudo de conversión') base.metricas = f.metricas.filter((x) => !x.razon && !x.sinTotal).slice(0, 4).map((x) => x.id);
  return sanearGrafico(base)!;
}

export function nuevoBloque(bloque: BloqueId, componentes: Componente[]): Bloque {
  const info = bloqueDe(bloque)!;
  return sanearBloque({ id: nuevoId(), bloque, x: 0, y: abajoDeTodo(componentes), w: info.w, h: info.h })!;
}

/** Lo que trae escrito un elemento recién insertado (se reemplaza con un doble clic). */
const TEXTO_INICIAL: Partial<Record<TipoElemento, string>> = { texto: 'Escribe un título', enlace: 'Texto del enlace' };

export function nuevoElemento(tipo: TipoElemento, componentes: Componente[]): Elemento {
  const info = TIPOS_ELEMENTO.find((x) => x.id === tipo) ?? TIPOS_ELEMENTO[0];
  return sanearElemento({
    id: nuevoId(), tipo: info.id, texto: TEXTO_INICIAL[info.id] ?? '',
    // Un enlace nace con el ACENTO del tema (el primer color de su paleta): un link en la tinta del texto
    // no se distingue de un texto.
    color: info.id === 'enlace' ? 0 : null,
    x: 0, y: abajoDeTodo(componentes), w: info.w, h: info.h,
  })!;
}

/** Un control nuevo. Una lista o una búsqueda nacen con un campo: sin campo no filtran nada. */
export function nuevoControlVista(tipo: TipoControl, campo: string | null = null): ControlVista | null {
  return sanearControlVista({ id: nuevoId(), tipo, campo, preset: PRESET_AUTOMATICO });
}

/** El título que se ve cuando la persona no escribió uno: «Gasto por campaña». */
export function tituloDe(c: Grafico | Bloque): string {
  if (c.titulo.trim()) return c.titulo;
  if (c.clase === 'bloque') return bloqueDe(c.bloque)?.nombre ?? 'Bloque';
  const f = fuenteDe(c.fuente);
  if (!f) return 'Gráfico';
  const mets = c.metricas.map((x) => metricaDe(f, x)?.nombre ?? x);
  const dim = dimensionDe(f, c.dimension);
  const desg = dimensionDe(f, c.desglose);
  const que = mets.length > 2 ? `${mets.slice(0, 2).join(', ')} y más` : mets.join(' y ');
  const por = [dim?.nombre.toLowerCase(), desg?.nombre.toLowerCase()].filter(Boolean).join(' y ');
  return por ? `${que} por ${por}` : que;
}
