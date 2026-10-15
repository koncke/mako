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
// COMPONENTES: gráficos y elementos (texto, imagen, secciones, cajas de IA…). Hasta v4 había también
// BLOQUES (lo de las tabs viejas, armado a mano); desde v5 (12/10/2026) se convierten en gráficos en el
// saneo (lib/graficos-migrar-v5.ts). Cada gráfico es un TIPO atado a un CONJUNTO DE DATOS de MaKo, con su
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

import { diasAntes, esFechaValida, finDeMesDeFecha } from './date-utils';
import { PALETA_MAKO, sanearTema, type TemaHoja } from './graficos-temas';
import { TOPE_DIRECCION, conDominio, esHostPropio } from './embeds';
import { DOMINIOS_MAKO } from './email-remitente';

import {
  AREAS, TIEMPO, cat, dist, m, r,
  type Area, type ClaseDim, type Dimension, type Formato, type Fuente, type Metrica,
} from './graficos-constructores';
import { FUENTES_EXTRA } from './graficos-fuentes-extra';
import { esPiezaGeneral, piezaPorFunnel, sanearOpciones, type OpcionesElegidas, type PiezaGeneral } from './general-piezas';
import { idDeParte, idLibre, migrarBloquesV5 } from './graficos-migrar-v5';
import { identidadDe } from './graficos-identidad';

export { AREAS };
export type { Area, ClaseDim, Dimension, Formato, Fuente, Metrica };

// ── v5 (12/10/2026): las piezas nuevas del MODELO ─────────────────────────────────────────────────
// Contrato: docs/relevo/dashboard-v5.md, «El MODELO». Lo que una métrica, una dimensión o una fecha
// declaran de más (lib/graficos-constructores.ts), y quién lo lee:
//   · `Fuente.fechas[i].futuro` — la fecha mira hacia adelante: el período NO se corta en hoy (`hastaDe`).
//   · `Metrica.mejor: 'menos'` — un costo, el no-show, un ciclo: la barra y el color lo respetan.
//   · `Metrica.razon.minimo` — con un denominador menor, «X de Y» o «—» en vez de un porcentaje.
//   · `Metrica.percentil` — el P90 del ciclo: el agregador junta los valores por fila.
//   · `Dimension.valores` / `colores` — orden fijo (las bandas de prioridad) y un color por valor.
// Las LEE el agregador y el dibujo (lib/graficos-agregar.ts, app/dashboard/Grafico.tsx); acá se declaran.

/** Una métrica en la que MENOS es mejor (un costo, el no-show, un ciclo en días). */
const menos = (x: Metrica): Metrica => ({ ...x, mejor: 'menos' });
/** Una razón que no se da con menos de `n` casos en el denominador («X de Y»). */
const conMinimo = (x: Metrica, n: number): Metrica => (x.razon ? { ...x, razon: { ...x.razon, minimo: n } } : x);
/** Un percentil de los valores por fila de `de` (el P90 del ciclo de venta). */
const percentil = (id: string, nombre: string, formato: Formato, de: string, p: number): Metrica => ({ id, nombre, formato, percentil: { de, p } });
/** Una dimensión con su orden fijo y, si van, sus colores (tokens de la casa). */
const fija = (id: string, nombre: string, valores: readonly string[], colores?: Readonly<Record<string, string>>): Dimension =>
  ({ ...cat(id, nombre), valores, ...(colores ? { colores } : {}) });

/** La madurez de una cohorte (la vista v_cohortes_*): una semana es «Madura» 14 días después de su última reunión. */
const MADUREZ = ['Madura', 'Madurando', 'Reciente'] as const;
const COLOR_MADUREZ = { Madura: 'var(--good)', Madurando: 'var(--warn)', Reciente: 'var(--faint)' } as const;

/**
 * Los 5 tramos del ciclo de venta (la línea de tiempo del SCL de la tab vieja, `_getTramosSCL`): cada uno es el
 * promedio de días de los leads que tienen las DOS fechas (días ≥ 0; el primero, sólo los que entraron por un
 * formulario de Meta). `dias_tN` y `con_tN` son sus bases.
 */
const TRAMOS: ReadonlyArray<readonly [string, string]> = [
  ['1', 'Formulario → agenda'], ['2', 'Agenda → R1'], ['3', 'R1 → R2'], ['4', 'R2 → confirmó'], ['5', 'Confirmó → primer pago'],
];

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
      menos(r('cac', 'CAC', 'usd', 'gasto', 'cierres')), r('roas_cobrado', 'ROAS cobrado', 'veces', 'cobrado', 'gasto'),
      r('roas_vendido', 'ROAS vendido', 'veces', 'vendido', 'gasto'), menos(r('cpl', 'Costo por lead', 'usd', 'gasto', 'leads')),
      menos(r('cpa', 'Costo por agenda', 'usd', 'gasto', 'agendas')), r('tasa_cierre', 'Tasa de cierre', 'pct', 'cierres', 'asistencias', 100),
      menos(r('cpm', 'CPM', 'usd', 'gasto', 'impresiones', 1000)), menos(r('cpc', 'CPC', 'usd', 'gasto', 'clics')),
      menos(r('costo_landing', 'Costo por vista de landing', 'usd', 'gasto', 'vistas_landing')), menos(r('costo_vsl', 'Costo por vista del VSL', 'usd', 'gasto', 'vistas_vsl')),
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
      menos(r('costo_landing', 'Costo por vista de landing', 'usd', 'gasto', 'vistas_landing')),
      r('ctr', 'CTR', 'pct', 'clics', 'impresiones', 100), menos(r('cpc', 'Costo por clic', 'usd', 'gasto', 'clics')),
      menos(r('cpm', 'CPM', 'usd', 'gasto', 'impresiones', 1000)), menos(r('cpl', 'Costo por lead', 'usd', 'gasto', 'leads')),
      menos(r('cpa', 'Costo por agenda', 'usd', 'gasto', 'agendas')),
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
    metricas: [m('eventos', 'Eventos'), m('reproducciones', 'Reproducciones'), dist('personas', 'Personas'),
      // v5: quién le dio play de verdad (no quien sólo tocó la página), su proporción y los que agendaron.
      dist('espectadores', 'Espectadores'), r('play_rate', 'Play rate', 'pct', 'espectadores', 'personas', 100), m('agendaron', 'Agendaron')],
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
      // v5: la madurez de la cohorte del lead (la semana o el mes de su primera reunión, en v_cohortes_*;
      // sin reunión, null). Es lo que la vieja «Salud del funnel» y las cohortes miraban: una propiedad de la
      // SEMANA, no de la fila. Va de filtro FIJO (madurez=Madura) en el funnel migrado.
      fija('madurez_semana', 'Madurez de la semana', MADUREZ, COLOR_MADUREZ),
      fija('madurez_mes', 'Madurez del mes', MADUREZ, COLOR_MADUREZ),
    ],
    metricas: [
      m('leads', 'Leads'), m('agendas', 'Agendaron'), m('asistencias', 'Asistieron'), m('calificados', 'Calificados'),
      m('cierres', 'Cerraron'), m('vendido', 'Vendido', 'usd'), m('cobrado', 'Cobrado', 'usd'),
      menos(m('no_show', 'No asistieron')), m('dias_ciclo', 'Días de ciclo'), m('con_ciclo', 'Cierres con ciclo'),
      menos(r('tasa_no_show', 'No-show rate', 'pct', 'no_show', 'agendas', 100)),
      // El ciclo se promedia sobre los cierres que tienen las DOS fechas: dividir por todos los
      // cierres lo achicaría con los que nunca tuvieron reunión cargada. Con menos de 3, «—» (la tab vieja).
      menos(conMinimo(r('ciclo', 'Ciclo de venta (días)', 'numero', 'dias_ciclo', 'con_ciclo'), 3)),
      r('tasa_asistencia', 'Tasa de asistencia', 'pct', 'asistencias', 'agendas', 100),
      r('tasa_cierre', 'Tasa de cierre', 'pct', 'cierres', 'asistencias', 100),
      r('ticket', 'Ticket promedio', 'usd', 'vendido', 'cierres'),
      // v5 (la «Salud del funnel» y las cohortes): las LIMPIAS asistieron Y están calificadas; la tasa de
      // cierre de la tab vieja es cierres ÷ limpias, y con menos de 3 limpias decía «X de Y».
      m('limpias', 'Calificadas que asistieron'),
      conMinimo(r('tasa_cierre_calificadas', 'Tasa de cierre (calificadas)', 'pct', 'cierres', 'limpias', 100), 3),
      // El ciclo de la cohorte: de la primera reunión al cierre, de las cerradas con las dos fechas.
      m('dias_ciclo_cierre', 'Días de reunión a cierre'), m('con_ciclo_cierre', 'Cierres con reunión'),
      menos(r('ciclo_cierre', 'Ciclo reunión → cierre (días)', 'numero', 'dias_ciclo_cierre', 'con_ciclo_cierre')),
      // El SCL por tramos (la línea de tiempo de la tab vieja).
      ...TRAMOS.flatMap(([n, nombre]) => [
        m(`dias_t${n}`, `Días ${nombre}`), m(`con_t${n}`, `Leads con ${nombre}`),
        menos(r(`tramo_${n}`, nombre, 'numero', `dias_t${n}`, `con_t${n}`)),
      ]),
      // El P90 del ciclo: el 90% de los ciclos dura esto o menos.
      menos(percentil('p90_ciclo', 'Ciclo de venta P90 (días)', 'numero', 'ciclo', 90)),
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
    // v5: el vencimiento MIRA HACIA ADELANTE (`futuro`): «lo que vence este mes» no se corta en hoy. Con el
    // corte, la plantilla «Cobranza» no contaba lo que vencía después de hoy (bug vivo del relevo v5).
    fechas: [{ id: 'vencimiento', nombre: 'Vencimiento', futuro: true }, { id: 'pago', nombre: 'Pagado' }],
    dimensiones: [...TIEMPO, cat('estado', 'Estado'), cat('cliente', 'Cliente'), cat('cuota', 'Cuota')],
    metricas: [m('monto', 'Monto', 'usd'), m('cobrado', 'Cobrado', 'usd'), menos(m('pendiente', 'Pendiente', 'usd')), m('pagos', 'Cuotas'), dist('clientes', 'Clientes')],
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
    metricas: [m('personas', 'Personas'), dist('leads', 'Leads'),
      // v5: las que terminaron en «respondió» o «pasó a una persona» (envios.respondio_at no lo escribe nadie).
      m('respondieron', 'Respondieron'), r('tasa_respuesta', 'Tasa de respuesta', 'pct', 'respondieron', 'personas', 100)],
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
      menos(r('costo_prom', 'Costo por llamada', 'usd', 'costo', 'llamadas')),
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
  // ── v5 (12/10/2026): los conjuntos que reemplazan a los bloques, y los de Analysts que no abrían nada ──
  // «A quién cobrarle»: una fila por cliente con su PRÓXIMA cuota. Los dos ids salen de la MISMA fila del
  // server (`r.cuota` es la próxima de ESE cliente): marcarPagoAction no valida el par (AGENTS.md).
  cobranza: {
    entidad: 'cuota', plural: 'Clientes', ref: 'cuota', nombre: ['cliente'], linea: ['proxima', 'urgencia'],
    ids: { pago: 'cuota', lead: 'cliente' }, unidad: ['clientes'],
  },
  // La cartera de Customer Success: cada cliente abre su ficha.
  cartera: { entidad: 'lead', plural: 'Clientes', ref: 'cliente', nombre: ['cliente'], linea: ['producto', 'estado'], ids: { lead: 'cliente' }, unidad: ['clientes'] },
  // Los guiones de Ads Analyst: cada uno es un ANUNCIO (`r.anuncio` = ad_id), y abre el pop-up del anuncio.
  // ⚠️ Se nombra con lo que escribió quien armó la campaña, como `meta.anuncio`: no es una persona.
  guiones: { entidad: 'anuncio', plural: 'Anuncios', ref: 'anuncio', nombre: ['guion'], linea: ['angulo', 'veredicto'], ids: { anuncio: 'anuncio' }, unidad: ['guiones'] },
  // Las tareas de «Lo que huele mal»: cada fila abre su tarea. El título puede nombrar personas.
  ejecucion: {
    entidad: 'tarea', plural: 'Tareas', ref: 'tarea', nombre: ['tarea'], linea: ['prioridad', 'estado'], ids: { tarea: 'tarea' },
    unidad: ['tareas', 'activas', 'hechas', 'en_curso', 'sin_deadline', 'alta_sin_deadline', 'estancadas', 'cerradas_con_deadline', 'a_tiempo', 'tarde', 'con_ciclo'],
  },
  // Los factores del cierre: una fila por llamada y dimensión; la entidad es la LLAMADA (`r.llamada`). Abierta
  // desde una barra (una dimensión), cada llamada tiene UNA fila: `con_puntaje` vale 1, no es una columna.
  llamadas_dimensiones: { entidad: 'llamada', plural: 'Llamadas', ref: 'llamada', nombre: ['llamada'], linea: ['closer', 'tono'], ids: { llamada: 'llamada' }, unidad: ['con_puntaje'] },
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
 * v5: el conjunto `revenue` (la barra y las KPI de la vieja «Revenue», de UNA lectura) tampoco tiene filas
 * propias: lo vendido y los cierres abren los leads que cerraron, lo cobrado las cuotas cobradas y lo
 * pendiente las cuotas por vencimiento (que mira hacia ADELANTE: `futuro`), como los desgloses del bloque.
 */
const DETALLE_REVENUE: Readonly<Record<string, DestinoDetalle>> = {
  vendido: { fuente: 'leads', fecha: 'cierre', incluye: 'vendido', columnas: ['vendido'] },
  cierres: { fuente: 'leads', fecha: 'cierre', incluye: 'cierres', columnas: ['vendido'] },
  cobrado: { fuente: 'pagos', fecha: 'pago', incluye: 'cobrado', columnas: ['cobrado'] },
  pendiente: { fuente: 'pagos', fecha: 'vencimiento', incluye: 'pendiente', columnas: ['pendiente'] },
};
/** Los conjuntos compuestos (sin filas propias): cada métrica abre el detalle de su conjunto. */
const DETALLE_COMPUESTO: Readonly<Record<string, Readonly<Record<string, DestinoDetalle>>>> = { negocio: DETALLE_NEGOCIO, revenue: DETALLE_REVENUE };

/**
 * A qué detalle abre la métrica `metrica` de un gráfico de `fuenteId` leído por `fecha`. `null` = ese número
 * no tiene filas atrás que se puedan listar (las vistas del VSL, los mensajes): no se dibuja clickeable.
 * En un conjunto con entidad, el detalle es el MISMO conjunto con la misma fecha; las columnas son la
 * métrica y, si es una razón, sus dos bases — salvo las que valen 1 por fila (`unidad`), que no informan.
 */
export function destinoDetalle(fuenteId: string, fecha: string, metrica: string | null | undefined): DestinoDetalle | null {
  if (!metrica) return null;
  const compuesto = DETALLE_COMPUESTO[fuenteId];
  if (compuesto) {
    const x = compuesto[metrica];
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
  /** Sólo estas dimensiones (el mapa: la región, el país o la ciudad). */
  soloDims?: readonly string[];
  /** Sólo estos conjuntos (el mapa de calor de una página: los toques). */
  soloFuentes?: readonly string[];
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
  // El mapa de la vieja «Audiencia y alcance». Desde v5 dibuja cualquier país por región (Meta) y las
  // ciudades como burbujas (decisión 4 de Martín): `Grafico.mapa` dice qué país y a qué nivel.
  { ...t('mapa', 'Mapa', 'Mapa', 'categoria', 'no', 1, 1, 6, 10, true), soloDims: ['region', 'pais', 'ciudad'] },
  // ── v5 (12/10/2026): los tipos que reemplazan a los bloques ──
  // La barra cobrado/pendiente de la vieja «Revenue»: UNA barra partida en 2-4 sumas, sin dimensión.
  t('barra_proporcion', 'Barra de proporción', 'Cuadro de resultados', 'ninguna', 'no', 2, 4, 12, 3, true),
  // Los tramos del ciclo de venta (el SCL de la tab vieja): segmentos consecutivos con su valor y su base,
  // el mayor resaltado. Acepta razones (cada tramo es un promedio).
  t('tramos', 'Línea de tiempo', 'Cuadro de resultados', 'ninguna', 'no', 2, 8, 12, 6),
  // Guiones y Anuncios como tarjetas (la GuionCard de la tab vieja): una por fila, con miniatura si el
  // conjunto la trae (`FilaResultado.imagen`).
  t('tarjetas', 'Tarjetas', 'Tabla', 'categoria', 'no', 1, 4, 12, 10),
  // El mapa de calor de la landing: sólo sobre los toques (decisión 1 de Martín: la página en vivo).
  { ...t('mapa_calor', 'Mapa de calor de página', 'Mapa', 'ninguna', 'no', 1, 1, 12, 24, true), soloFuentes: ['toques'] },
];
export const GRUPOS: readonly Grupo[] = [...new Set(TIPOS.map((x) => x.grupo))];

// ── El período ────────────────────────────────────────────────────────────────────────────

export type Preset = 'hoy' | 'ayer' | 'ult7' | 'ult14' | 'ult28' | 'ult30' | 'ult90' | 'este_mes' | 'este_mes_completo' | 'prox30' | 'mes_pasado' | 'este_anio' | 'ult12m' | 'anio_pasado' | 'todo' | 'personalizado';
// v5 (12/10/2026): «Este mes completo» y «Próximos 30 días» MIRAN HACIA ADELANTE (terminan después de hoy).
// Sólo una fecha `futuro` los ve enteros: en cualquier otra, el período se corta en hoy (`hastaDe`).
export const PRESETS: ReadonlyArray<{ id: Preset; nombre: string }> = [
  { id: 'hoy', nombre: 'Hoy' }, { id: 'ayer', nombre: 'Ayer' }, { id: 'ult7', nombre: 'Últimos 7 días' },
  { id: 'ult14', nombre: 'Últimos 14 días' }, { id: 'ult28', nombre: 'Últimos 28 días' }, { id: 'ult30', nombre: 'Últimos 30 días' },
  { id: 'ult90', nombre: 'Últimos 90 días' }, { id: 'este_mes', nombre: 'Este mes' },
  { id: 'este_mes_completo', nombre: 'Este mes completo' }, { id: 'prox30', nombre: 'Próximos 30 días' },
  { id: 'mes_pasado', nombre: 'El mes pasado' },
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
    // Hasta el último día del mes, aunque todavía no llegó (lo que vence este mes).
    case 'este_mes_completo': return { desde: mes(y, mo), hasta: finDeMesDeFecha(hoy) };
    // Hoy y los 29 días que siguen: treinta días, como «Últimos 30 días» para atrás.
    case 'prox30': return { desde: hoy, hasta: diasAntes(hoy, -29) };
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

/** ¿Esta fecha de este conjunto mira hacia adelante? (`futuro`: el vencimiento de una cuota.) */
export const fechaFutura = (fuenteId: string, fechaId: string): boolean =>
  !!fuenteDe(fuenteId)?.fechas.find((f) => f.id === fechaId)?.futuro;

/**
 * Hasta dónde se lee un período: se CORTA EN HOY, salvo que la fecha sea `futuro` (v5). Es la regla del
 * corte en UN lugar (contrato v5: hasta v4 la repetían seis puertas a mano —la ruta, la página, el link,
 * la API y el AI Analyst—). La llaman `datosDeGraficos` y `detalleDeGrafico` (lib/graficos-datos.ts),
 * junto a `hastaDeFuente` (la pauta termina AYER). Un período que empieza después de hoy no se invierte:
 * queda en su primer día.
 */
export function hastaDe(fuenteId: string, fechaId: string, desde: string, hasta: string, hoy: string): string {
  if (hasta <= hoy || fechaFutura(fuenteId, fechaId)) return hasta;
  return hoy < desde ? desde : hoy;
}

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
  // v5: las KPI de la vieja «Revenue» (Sold en acento, Cash en verde, Outstanding en rojo) y la cobranza.
  revenue: { vendido: 'acento', cobrado: 'bueno', pendiente: 'malo' },
  cobranza: { cobrado_total: 'bueno', pendiente: 'malo' },
};
/** El color de una KPI según su métrica: lo cobrado es bueno, lo pendiente es malo (las tarjetas viejas). */
export const tonoDe = (fuente: string, metrica: string | undefined): Tono | null => (metrica ? TONOS[fuente]?.[metrica] ?? null : null);

const numONull = (v: unknown) => (v === null || v === '' || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
/** Sin los espacios de las puntas y DESPUÉS recortado: recortar primero dejaba el tope con un espacio de menos. */
const recortado = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

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
//     segundo sería decorativo (el bug del v2: mandaba el primero del array). Un filtro de DEFINICIÓN
//     (`fijo`, v5) cuenta igual: sobre el campo que define la tarjeta no hay otro para mirar.
//   · Un filtro `fijo` decide como cualquier control propio; lo único distinto es que la vista no lo
//     mueve (`conVista`). Así el período propio de antes (`Grafico.periodo`), migrado a un control fijo
//     en el saneo, da el MISMO número.

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
  /**
   * v5 (12/10/2026): un filtro de DEFINICIÓN, no uno para mirar. Lo que DEFINE una tarjeta (la KPI de R1 es
   * R1, «Gasto sin retorno» es sin agendas, el funnel mira las cohortes maduras) se aplica IGUAL que hoy
   * (`efectivoDe`), pero NO se dibuja (ni chip ni «Filtro»), no lo cambia la vista (`conVista`), no cuenta
   * para «Restablecer» (`distintoDeEntrada`, `hayVistaElegida`) y no lo mueve un link compartido. Se edita
   * en la sección «Filtros» del panel. Ausente = un control para mirar, como siempre.
   * Martín (punto 1 del pedido v5): esos chips en la tarjeta «no tienen mucho sentido».
   */
  fijo?: true;
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
export const COMPARTIDOS_DECLARADOS: readonly Campo[] = [
  { id: 'campana', nombre: 'Campaña', en: { meta: 'campana', leads: 'campana', guiones: 'campana' } },
  { id: 'conjunto', nombre: 'Conjunto', en: { meta: 'conjunto', presupuesto: 'conjunto', guiones: 'conjunto' } },
  { id: 'anuncio', nombre: 'Anuncio', en: { meta: 'anuncio', leads: 'anuncio' } },
  { id: 'pagina', nombre: 'Página', en: { visitas: 'pagina', vsl: 'pagina', replays: 'pagina', clics: 'pagina', scroll: 'pagina', toques: 'pagina', retencion_vsl: 'pagina', landing_analisis: 'pagina', ubicacion: 'pagina' } },
  { id: 'producto', nombre: 'Producto', en: { leads: 'producto', entrega: 'producto', cartera: 'producto' } },
  { id: 'closer', nombre: 'Closer', en: { leads: 'closer', llamadas: 'closer', llamadas_venta: 'closer', llamadas_dimensiones: 'closer' } },
  { id: 'automatizacion', nombre: 'Automatización', en: { inscripciones: 'automatizacion', envios: 'automatizacion' } },
  // v5 (contrato, «Campos COMPARTIDOS nuevos»): el video del VSL y su curva, la línea de WhatsApp, el setter y
  // el cliente (un lead ganado) significan LO MISMO en estos conjuntos.
  { id: 'video', nombre: 'Video', en: { vsl: 'video', retencion_vsl: 'video' } },
  { id: 'linea', nombre: 'Línea', en: { whatsapp: 'linea', conversaciones: 'linea' } },
  { id: 'setter', nombre: 'Setter', en: { leads: 'setter', whatsapp: 'setter', conversaciones: 'setter' } },
  { id: 'cliente', nombre: 'Cliente', en: { entrega: 'cliente', pagos: 'cliente', cartera: 'cliente', cobranza: 'cliente' } },
];
/**
 * Los compartidos que EXISTEN: cada entrada de `en` cuyo conjunto tiene de verdad esa dimensión. Una entrada
 * sobre un conjunto que todavía no la declara (los conjuntos nuevos de v5 nacen en lib/graficos-fuentes-extra.ts;
 * `whatsapp` no tiene setter) NO se materializa: un filtro mandado a un lector que no conoce el campo dejaría
 * el gráfico en CERO sin decir nada, y sin la entrada la tarjeta dice «No filtra por Setter». El día que el
 * conjunto declare la dimensión (y su lector la llene), el campo la alcanza solo.
 * ⚠️ Un error de tipeo acá también desaparece en silencio: lo frena tests/graficos-modelo-v5.test.ts, que
 *    exige que lo que no se materializa esté en su lista de pendientes.
 */
const COMPARTIDOS: readonly Campo[] = COMPARTIDOS_DECLARADOS
  .map((c) => ({ ...c, en: Object.fromEntries(Object.entries(c.en).filter(([f, d]) => FUENTES.find((x) => x.id === f)?.dimensiones.some((x) => x.id === d && x.clase === 'categoria'))) }))
  .filter((c) => Object.keys(c.en).length > 0);
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
/**
 * El campo que vale HOY para un id guardado. Un campo propio de un conjunto («Setter · Leads del CRM»,
 * `leads.setter`) que pasó a ser COMPARTIDO (`setter`, v5) cambió de id: sin esta traducción, el saneo tiraría
 * el control guardado sobre el id viejo y el próximo autoguardado lo borraría.
 */
function campoVigente(id: string): Campo | undefined {
  const directo = campoDe(id);
  if (directo) return directo;
  const [f, d, ...resto] = id.split('.');
  if (!f || !d || resto.length) return undefined;
  return CAMPOS.find((c) => c.en[f] === d);
}

export function sanearControlVista(raw: unknown): ControlVista | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const tipo = TIPOS_CONTROL.some((t) => t.id === o.tipo) ? (o.tipo as TipoControl) : null;
  if (!tipo) return null;
  const campo = (tipo === 'lista' || tipo === 'texto') ? (campoVigente(String(o.campo ?? ''))?.id ?? null) : null;
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
    // Sólo cuando lo es: un control para mirar guarda lo mismo que antes de v5.
    ...(o.fijo === true ? { fijo: true as const } : {}),
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

/**
 * El control con lo que se eligió mirando encima (lo elegido gana; lo que no se tocó, lo de entrada).
 * Un filtro de DEFINICIÓN (`fijo`) no lo cambia la vista: aunque llegue algo con su id, vale lo guardado.
 */
export function conVista(c: ControlVista, vista: VistaValores): ControlVista {
  if (c.fijo) return c;
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
  /**
   * «Automático» toma el control de período de la hoja; sin control, los últimos 30 días.
   * ⚠️ v5: QUEDA EN EL TIPO POR COMPATIBILIDAD, pero el saneo lo MIGRA: un período propio pasa a ser un
   *    control `periodo` con `fijo: true` e id `<id recortado a 34>-fecha`, y esto queda en 'auto'. Da el
   *    mismo `efectivoDe` (el control propio ya ganaba sobre este campo). `efectivoDe` lo sigue leyendo
   *    por si llega un objeto armado a mano.
   */
  periodo: Preset | 'auto';
  desde: string | null;
  hasta: string | null;
  /** El chip «↑ 1,3×» contra el período anterior del mismo largo (una lectura más). */
  comparar: boolean;
  /** La bala y el indicador; desde v5 también el umbral de color de un número (con `Metrica.mejor`). */
  objetivo: number | null;
  maximo: number | null;
  /** La fila de total de las tablas. */
  total: boolean;
  /** Los controles de ESTE gráfico, en su cabecera (los `fijo` no se dibujan: definen la tarjeta). */
  controles: ControlVista[];
  // ── v5 (12/10/2026): todos OPCIONALES; ausente = lo de siempre. El saneo copia cada uno (con su tope):
  //    un campo que el saneo no copie se pierde en el primer guardado.
  /**
   * El botón de MaKo de la tarjeta. Ausente = lo que diga el TIPO (`makoPorDefecto`: sólo donde explicar suma); `true` y
   * `false` son la elección de quien armó la hoja y ganan. Se lee SIEMPRE con `conMako`.
   * 13/10/2026 (Martín: «borra ese botón de la mayoría de gráficos, es muy molesto que esté en todos. Se selectivo»): hasta
   * ese día, ausente = prendido en TODOS.
   */
  mako?: boolean;
  /**
   * Lo que el botón de MaKo de ESTE gráfico tiene que responder al abrirse (`pedido`, hasta 600) y las preguntas sugeridas
   * del chat (`sugerencias`, hasta 4). Se edita en el lugar, editando la hoja (app/dashboard/EditorMako.tsx). Ausente = el
   * análisis de siempre (`chart_insights.prompt_analisis`) con las sugerencias de siempre.
   */
  makoIA?: { pedido: string; sugerencias: string[] };
  /** Qué abre un clic: el detalle de hoy, nada, o el pop-up de abajo. Ausente = 'detalle'. Sin `popup`, no hay 'popup'. */
  alClic?: 'detalle' | 'nada' | 'popup';
  /** El pop-up: una mini-hoja guardada adentro del gráfico. Sin pop-ups anidados; hasta MAX_POPUP componentes. */
  popup?: { titulo: string; componentes: Componente[] };
  /** tabla_barras y tarjetas: la métrica que lleva la barra (una de `metricas`). Ausente = la que ordena. */
  barra?: string;
  /** Cuadro de resultados: una métrica chica abajo del número («14 cierres»). Una métrica del conjunto. */
  secundaria?: string;
  /** No se dibuja si su número da cero (el MRR de quien no vende suscripciones). Sólo se guarda `true`. */
  ocultarSiCero?: boolean;
  /** Dispersión y burbujas: el dominio FIJO de cada eje (los dos o ninguno, y min < max). */
  ejes?: { xMin?: number; xMax?: number; yMin?: number; yMax?: number };
  /**
   * Dispersión y burbujas: las líneas de referencia en X y en Y, y el rótulo de cada cuadrante en este
   * orden: [arriba-izquierda, arriba-derecha, abajo-izquierda, abajo-derecha] (x crece a la derecha, y hacia
   * arriba). Los cuatro o ninguno.
   */
  referencias?: { x?: number; y?: number; rotulos?: [string, string, string, string] };
  /** Dispersión y burbujas: la dimensión de categoría que pinta cada punto (el ángulo, el cuadrante). */
  colorPor?: string;
  /**
   * Las opciones de una tabla: sin los períodos vacíos, del más nuevo al más viejo, `columnas` = dimensiones
   * extra como columnas (la urgencia, el closer, la fecha), las acciones de la fila en la fila, y la barra
   * de búsqueda en la tarjeta. Sólo se guardan las prendidas.
   */
  tabla?: { sinVacios?: boolean; descendente?: boolean; columnas?: string[]; acciones?: boolean; buscar?: boolean };
  /** El mapa: el país (ISO-2, o 'auto' = el de la cuenta) y a qué nivel se dibuja. */
  mapa?: { pais: 'auto' | string; nivel: 'pais' | 'region' | 'ciudad' };
  /**
   * La PORTADA de la hoja (15/10/2026): el id de una identidad de lib/graficos-identidad.ts. La tarjeta se pinta con ese
   * color y su título va gigante; lo de adentro se dibuja sobre el color. Ausente = una tarjeta como las demás.
   */
  portada?: string;
  x: number; y: number; w: number; h: number;
};

/**
 * Lo que necesita su propia lectura y su propia acción y no entra en el agregador genérico: «A
 * quién cobrarle» elige UNA cuota por cliente (la próxima) y la marca cobrada; las cohortes maduras
 * son una propiedad de la semana, no de la fila. Leen las MISMAS funciones que la tab vieja y que los
 * runners de MaKo (lib/queries.ts, lib/pagos.ts), así la pantalla, WhatsApp y la API no cuentan
 * distinto. (Su lectura era lib/graficos-bloques.ts; desde el 13/10/2026 queda sólo la del teléfono,
 * lib/datos-comercial-server.ts.)
 */
/** El id de un bloque. ⚠️ v5: ya no hay ninguno (ver `BLOQUES`). */
export type BloqueId = string;
export type InfoBloque = { id: BloqueId; nombre: string; linea: string; w: number; h: number };
/**
 * ⚠️ v5 (12/10/2026): LOS BLOQUES SE VAN. Martín: no se podían editar. Cada bloque de antes se convierte en
 * el saneo en gráficos y elementos del catálogo (lib/graficos-migrar-v5.ts, `migrarBloquesV5`, que `sanearHoja`
 * llama ANTES de sanear), así que ningún informe guardado trae un bloque después de leerse.
 * Esta lista queda VACÍA —nadie ofrece un bloque: ni la galería, ni la IA de «Nueva hoja», ni la API— y
 * `sanearComponente` tira la clase 'bloque'. El tipo `Bloque`, `bloqueDe`, `sanearBloque`, `nuevoBloque` y
 * `esBloque` quedan SÓLO para que compilen los que todavía los nombran (la pantalla, la API, el link);
 * se borran cuando el último deje de hacerlo.
 */
export const BLOQUES: readonly InfoBloque[] = [];
/** @deprecated v5: no hay bloques. Contesta `undefined` siempre. */
export const bloqueDe = (id: string) => BLOQUES.find((b) => b.id === id);

/** @deprecated v5: los bloques se migran en el saneo (lib/graficos-migrar-v5.ts); ninguno sobrevive a una lectura. */
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
/**
 * v5 (12/10/2026): SE VAN el rectángulo y el círculo (0 guardados, medido en la base el 11/10). La línea y la
 * flecha sueltas quedan como divisores. Y entran cuatro:
 *   · `seccion`  — la «Sección» a lo ancho (decisión 2 de Martín): agrupa las filas que tiene DEBAJO hasta la
 *                  siguiente sección, con título (`texto`), fondo y plegable. Es también el «Desplegable».
 *                  Va SIEMPRE en x=0 y w=12 (el saneo lo fuerza). Una sección sin título y no plegable es un
 *                  divisor que CIERRA el grupo de la de arriba (la migración de «A quién cobrarle» la usa).
 *   · `ia`       — «Conclusiones de MaKo»: una caja que escribe la IA gratis (`ia`). Su texto NO vive en el
 *                  informe (lo reescribe el autoguardado entero): vive en su tabla (P6, `dashboard_ia_elementos`).
 *   · `entidad`  — una pieza de la ficha de lo que se abrió (una llamada, un anuncio, un lead). SÓLO adentro
 *                  de un pop-up: en una hoja no hay qué abrir.
 *   · `accion`   — un botón que corre una acción de ACCIONES_ELEMENTO (lib/graficos-acciones.ts): «Sincronizar
 *                  llamadas» en la hoja Closing.
 */
export type TipoElemento = 'texto' | 'enlace' | 'imagen' | 'video' | 'insertado' | 'linea' | 'flecha' | 'seccion' | 'ia' | 'entidad' | 'accion' | 'general';
export type GrupoElemento = 'texto' | 'medios' | 'formas' | 'estructura' | 'mako' | 'entidad' | 'general';
export type InfoElemento = { id: TipoElemento; nombre: string; w: number; h: number; minW: number; minH: number; grupo: GrupoElemento };
export const TIPOS_ELEMENTO: ReadonlyArray<InfoElemento> = [
  { id: 'texto', nombre: 'Texto', w: 12, h: 2, minW: 1, minH: 1, grupo: 'texto' },
  { id: 'enlace', nombre: 'Enlace', w: 4, h: 2, minW: 1, minH: 1, grupo: 'texto' },
  { id: 'imagen', nombre: 'Imagen', w: 4, h: 6, minW: 1, minH: 1, grupo: 'medios' },
  { id: 'video', nombre: 'Video', w: 6, h: 7, minW: 3, minH: 4, grupo: 'medios' },
  { id: 'insertado', nombre: 'Insertar', w: 12, h: 12, minW: 3, minH: 4, grupo: 'medios' },
  { id: 'linea', nombre: 'Línea', w: 6, h: 1, minW: 1, minH: 1, grupo: 'formas' },
  { id: 'flecha', nombre: 'Flecha', w: 3, h: 2, minW: 1, minH: 1, grupo: 'formas' },
  { id: 'seccion', nombre: 'Sección', w: 12, h: 2, minW: 12, minH: 1, grupo: 'estructura' },
  { id: 'ia', nombre: 'Conclusiones de MaKo', w: 6, h: 8, minW: 3, minH: 3, grupo: 'mako' },
  { id: 'accion', nombre: 'Acción', w: 3, h: 2, minW: 2, minH: 1, grupo: 'mako' },
  { id: 'entidad', nombre: 'Ficha', w: 12, h: 10, minW: 3, minH: 2, grupo: 'entidad' },
  // 14/10/2026: un bloque de la tab General (lib/general-piezas.ts). Sólo se ofrece en General; fuera de ahí dice que no.
  { id: 'general', nombre: 'Bloque de General', w: 12, h: 10, minW: 3, minH: 3, grupo: 'general' },
];
/** Cuántas cajas de «Conclusiones de MaKo» entran en una hoja: cada una gasta cuota de IA gratis al correr. */
export const MAX_IA_POR_HOJA = 4;
/** Lo más largo del pedido de una caja de IA (lo escribe quien arma la hoja). */
export const TOPE_PEDIDO_IA = 600;
/** Lo más largo del rótulo de un botón de acción y de cada rótulo de un cuadrante. */
const TOPE_ROTULO = 40;
/** Lo más chico de un elemento en la grilla (el `minW`/`minH` del layout). Un tipo que no existe: 1×1. */
export function minimoDeElemento(tipo: string): { w: number; h: number } {
  const i = TIPOS_ELEMENTO.find((x) => x.id === tipo);
  return { w: i?.minW ?? 1, h: i?.minH ?? 1 };
}
/** Lo más largo del texto de cada tipo: el párrafo de un Texto, el de un Enlace, el título de un Video. */
const TOPE_TEXTO_ELEMENTO: Partial<Record<TipoElemento, number>> = { enlace: 300, video: 120, insertado: 120, seccion: 80, ia: 80, entidad: 80, accion: 80, general: 80 };
/** El tope del texto de un tipo: el MISMO para el saneo y para los campos de la pantalla (su `maxLength`). */
export const topeDeTextoElemento = (tipo: TipoElemento): number => TOPE_TEXTO_ELEMENTO[tipo] ?? 2000;
export type Elemento = {
  id: string;
  clase: 'elemento';
  tipo: TipoElemento;
  /**
   * Texto: hasta 2000 caracteres; un salto de línea es un párrafo. Enlace: lo que se lee (300). Imagen:
   * su descripción. Video e Insertar: su título (120). Sección, Conclusiones de MaKo y Ficha: su título (80).
   */
  texto: string;
  tamano: 's' | 'm' | 'l' | 'xl';
  alinear: 'izquierda' | 'centro' | 'derecha';
  /** Un índice de la paleta del tema, o null = la tinta de la app (que se da vuelta en oscuro). */
  color: number | null;
  /** Formas: rellena o sólo el contorno. ⚠️ v5: sin rectángulo ni círculo no lo usa ningún tipo; queda por compatibilidad. */
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
  // ── v5: el objeto de cada tipo nuevo. El saneo lo pone SIEMPRE en su tipo (con sus defaults) y nunca en otro.
  /** Sección: el fondo del grupo (índice de la paleta o null = sin fondo), si se pliega, y si arranca abierta. */
  seccion?: { fondo: number | null; plegable: boolean; abierto: boolean };
  /** Conclusiones de MaKo: qué pide, qué lee, cómo se ve y cuándo corre (nunca al abrir la hoja). */
  ia?: ConfigIA;
  /** Ficha: qué pieza de la ficha de lo que se abrió. Sólo adentro de un pop-up. */
  entidad?: { tipo: 'llamada' | 'anuncio' | 'lead'; pieza: string };
  /** Acción: el id de ACCIONES_ELEMENTO (lib/graficos-acciones.ts) y el rótulo del botón. */
  accion?: { id: string; rotulo: string };
  /**
   * Bloque de General (14/10/2026): cuál (lib/general-piezas.ts). `texto` es su título; vacío = el de siempre.
   * `funnel`: el funnel al que se ata, sólo en los bloques que saben (`piezaPorFunnel`); sin él, el de siempre.
   * `opciones`: lo elegido en el panel (cuántas, cómo se ve…), sólo lo que el bloque declara (`opcionesDePieza`) y
   * distinto de su default.
   */
  general?: { pieza: PiezaGeneral; funnel?: number; opciones?: OpcionesElegidas };
  /** La portada (15/10/2026), como la de un gráfico: un bloque de General o un texto pintados con su color. */
  portada?: string;
  x: number; y: number; w: number; h: number;
};

/** La configuración de una caja de «Conclusiones de MaKo» (decisión de la tanda v5). */
export type ConfigIA = {
  /** Lo que pide quien arma la hoja (hasta 600). Va al modelo como DATO, abajo del system fijo. */
  pedido: string;
  /** Los ids de los gráficos de la hoja (o del pop-up) que lee; null = todos. `[]` = ninguno (se borraron). */
  fuentes: string[] | null;
  vista: 'resumen' | 'hallazgos' | 'recomendaciones' | 'texto';
  largo: 'corto' | 'medio' | 'largo';
  formato: 'parrafo' | 'vinetas' | 'tarjetas';
  /** 'entidad' = lee lo que se abrió (la llamada, el anuncio): sólo adentro de un pop-up. */
  lee: 'hoja' | 'entidad';
  /** Cuándo corre además de a mano: null = sólo al configurarla y con ↻. La hora, 0-23 en la zona del negocio. */
  cron: null | { unidad: 'dia' | 'semana' | 'mes'; hora: number };
};

export type Componente = Grafico | Bloque | Elemento;

/** v5: una flecha que UNE dos componentes de la hoja y los sigue cuando se mueven (no ocupa una celda). */
export type Conector = {
  id: string;
  /** Los ids de los dos componentes (de la hoja, no de un pop-up). Uno que no está, y el conector se descarta. */
  desde: string;
  hasta: string;
  punta: 'fin' | 'ambas' | 'ninguna';
  trazo: 'curva' | 'recta' | 'codo';
  /** Un índice de la paleta del tema, o null = la tinta. */
  color: number | null;
};
export const MAX_CONECTORES = 40;
/** Lo más que entra en un pop-up (una mini-hoja: una ficha y lo que se le pone alrededor). */
export const MAX_POPUP = 24;

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
  /**
   * v5: de qué plantilla nació (`hojaDestino` pregunta esto primero). La ponen las plantillas, y la migración
   * de los bloques la deduce de los que la hoja traía (la FIRMA de antes).
   */
  plantilla?: string;
  /** v5: las flechas que unen componentes (hasta MAX_CONECTORES). Ausente = ninguna. */
  conectores?: Conector[];
};
/**
 * `archivadas` (14/10/2026, Martín: «Me debería dejar eliminar todas las hojas, también para dashboard. Y en el
 * desplegable de las hojas, un texto que diga "Archivados" y ahí la opción de eliminar permanentemente»): eliminar una
 * hoja la ARCHIVA; de Archivados se restaura o se borra para siempre. `enBlanco`: se eliminaron TODAS, y la pantalla
 * vuelve a «¿Qué vas a crear hoy?». Por dentro sigue viajando una hoja vacía (la pantalla lee `hojas[0]`), que no se
 * muestra ni la cuentan quienes listan hojas (la API de MaKo, el análisis programado).
 */
export type Tablero = { v: 3; nombre: string; hojas: Hoja[]; archivadas?: Hoja[]; enBlanco?: true };
/** Cuántas hojas archivadas se guardan: la más vieja se va cuando entra una más. */
export const MAX_ARCHIVADAS = 20;
/** Las hojas que se MUESTRAN de un informe: ninguna si se eliminaron todas. */
export const hojasVisibles = (t: Pick<Tablero, 'hojas' | 'enBlanco'>): Hoja[] => (t.enBlanco ? [] : t.hojas);

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
/** @deprecated v5: ningún componente saneado es un bloque (se migran en `sanearHoja`). */
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
/** Las métricas que un tipo acepta: una torta o un embudo sólo aceptan lo que se suma (ni razones, ni percentiles). */
export function metricasPara(f: Fuente, tipo: string): Metrica[] {
  return tipoDe(tipo)?.soloSumas ? f.metricas.filter((x) => !x.razon && !x.sinTotal && !x.percentil) : f.metricas;
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

/** ¿Este tipo se puede dibujar sobre este conjunto? (El mapa de calor, sólo sobre los toques.) */
export const tipoAdmite = (x: InfoTipo, fuenteId: string): boolean => !x.soloFuentes || x.soloFuentes.includes(fuenteId);

/**
 * Dónde se sanea un componente: en la hoja o ADENTRO de un pop-up (v5). Adentro de un pop-up no hay otro
 * pop-up (sin anidar) y sí hay fichas (`entidad`) y cajas de IA que leen lo que se abrió; en la hoja, no.
 */
export type ContextoSaneo = { enPopup?: boolean };

/** Un número finito, o nada. */
const numOpt = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};
const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const unoDe = <T extends string>(v: unknown, ops: readonly T[], def: T): T => (ops.includes(v as T) ? (v as T) : def);
/** Lo más de columnas extra de una tabla: más no entra en una fila. */
const MAX_COLUMNAS = 4;

/** Los ejes fijos: cada borde es opcional, pero si están los dos de un eje, el mínimo va abajo del máximo. */
function sanearEjes(raw: unknown): Grafico['ejes'] {
  if (!esObj(raw)) return undefined;
  const out: NonNullable<Grafico['ejes']> = {};
  for (const [lo, hi] of [['xMin', 'xMax'], ['yMin', 'yMax']] as const) {
    const a = numOpt(raw[lo]), b = numOpt(raw[hi]);
    if (a !== undefined && b !== undefined && a >= b) continue;
    if (a !== undefined) out[lo] = a;
    if (b !== undefined) out[hi] = b;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Las líneas de referencia y los cuatro rótulos (los cuatro o ninguno; uno vacío se deja vacío). */
function sanearReferencias(raw: unknown): Grafico['referencias'] {
  if (!esObj(raw)) return undefined;
  const out: NonNullable<Grafico['referencias']> = {};
  const x = numOpt(raw.x), y = numOpt(raw.y);
  if (x !== undefined) out.x = x;
  if (y !== undefined) out.y = y;
  if (Array.isArray(raw.rotulos) && raw.rotulos.length === 4) {
    const r4 = raw.rotulos.map((t) => recortado(t, TOPE_ROTULO)) as [string, string, string, string];
    if (r4.some(Boolean)) out.rotulos = r4;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Las opciones de una tabla: sólo las prendidas, y columnas que sean dimensiones del conjunto (no la principal). */
function sanearTabla(raw: unknown, f: Fuente, dimension: string | null): Grafico['tabla'] {
  if (!esObj(raw)) return undefined;
  const out: NonNullable<Grafico['tabla']> = {};
  for (const k of ['sinVacios', 'descendente', 'acciones', 'buscar'] as const) if (raw[k] === true) out[k] = true;
  const columnas = Array.isArray(raw.columnas)
    ? [...new Set(raw.columnas.map(String))].filter((d) => d !== dimension && f.dimensiones.some((x) => x.id === d)).slice(0, MAX_COLUMNAS)
    : [];
  if (columnas.length) out.columnas = columnas;
  return Object.keys(out).length ? out : undefined;
}

/** El mapa: un país ISO-2 (o 'auto') y el nivel. */
function sanearMapa(raw: unknown): Grafico['mapa'] {
  if (!esObj(raw)) return undefined;
  const pais = typeof raw.pais === 'string' && /^[a-z]{2}$/i.test(raw.pais.trim()) ? raw.pais.trim().toUpperCase() : 'auto';
  return { pais, nivel: unoDe(raw.nivel, ['pais', 'region', 'ciudad'] as const, 'region') };
}

/** Lo más que se le pide al botón de MaKo de un gráfico, y cuántas preguntas sugeridas (y de qué largo). */
export const TOPE_PEDIDO_MAKO = 600;
export const MAX_SUGERENCIAS_MAKO = 4;
const TOPE_SUGERENCIA_MAKO = 80;
/** Lo que el botón de MaKo de un gráfico tiene que responder, y sus sugerencias. Vacío del todo = nada (lo de siempre). */
function sanearMakoIA(raw: unknown): Grafico['makoIA'] {
  if (!esObj(raw)) return undefined;
  const pedido = typeof raw.pedido === 'string' ? raw.pedido.trim().slice(0, TOPE_PEDIDO_MAKO) : '';
  const sugerencias = Array.isArray(raw.sugerencias)
    ? [...new Set(raw.sugerencias.map((s) => (typeof s === 'string' ? s.trim().slice(0, TOPE_SUGERENCIA_MAKO) : '')).filter(Boolean))].slice(0, MAX_SUGERENCIAS_MAKO)
    : [];
  return pedido || sugerencias.length ? { pedido, sugerencias } : undefined;
}

/**
 * ¿El TIPO lleva el botón de MaKo si nadie eligió? (13/10/2026, Martín: «borra ese botón de la mayoría de gráficos, es muy
 * molesto que esté en todos. Se selectivo».) Sólo donde explicar suma algo que el gráfico no dice solo: una TENDENCIA
 * (una serie, unas líneas, unas áreas o unas columnas por día, semana o mes: «¿por qué subió?»), un EMBUDO («¿dónde se
 * cae?») y una DISPERSIÓN («¿qué separa a los de arriba?»). Un número suelto, una tabla, una torta o un mapa ya dicen lo
 * que tienen: van sin botón. En positivo: lo que no está acá, no lo lleva.
 */
export function makoPorDefecto(g: Pick<Grafico, 'tipo' | 'dimension'>): boolean {
  const grupo = tipoDe(g.tipo)?.grupo;
  if (grupo === 'Embudo de conversión' || grupo === 'Dispersión') return true;
  const enElTiempo = g.dimension === 'dia' || g.dimension === 'semana' || g.dimension === 'mes';
  return enElTiempo && (grupo === 'Serie temporal' || grupo === 'Líneas' || grupo === 'Áreas' || grupo === 'Barras');
}

/** ¿Este gráfico lleva el botón de MaKo? Lo elegido gana; sin elección, el tipo. La ÚNICA lectura de `mako`. */
export const conMako = (g: Pick<Grafico, 'mako' | 'tipo' | 'dimension'>): boolean => g.mako ?? makoPorDefecto(g);

/**
 * La caja de IA lee sólo gráficos que ESTÁN en su hoja (o su pop-up): un id de un gráfico borrado se cae.
 * Si se cayeron todos queda `[]` (no lee ninguno), nunca `null` (que sería «todos»: otra cosa).
 */
function podarFuentesIA(componentes: readonly Componente[]): void {
  const graficos = new Set(componentes.filter((c) => c.clase === 'grafico').map((c) => c.id));
  for (const c of componentes) {
    if (c.clase === 'elemento' && c.ia?.fuentes) c.ia = { ...c.ia, fuentes: c.ia.fuentes.filter((id) => graficos.has(id)) };
  }
}

/** El pop-up de un gráfico: una mini-hoja (sin pop-ups adentro), hasta MAX_POPUP componentes con ids únicos. */
function sanearPopup(raw: unknown): Grafico['popup'] {
  if (!esObj(raw)) return undefined;
  const lista = Array.isArray(raw.componentes) ? raw.componentes : [];
  const componentes: Componente[] = [];
  const ids = new Set<string>();
  for (const c of lista.slice(0, MAX_POPUP * 2)) {
    if (componentes.length >= MAX_POPUP) break;
    const s = sanearComponente(c, { enPopup: true });
    if (!s) continue;
    if (ids.has(s.id)) s.id = idLibre(s.id, ids);
    ids.add(s.id);
    componentes.push(s);
  }
  podarFuentesIA(componentes);
  return { titulo: texto(raw.titulo, 80), componentes };
}

/**
 * Lo que llega del navegador (o de la base) pasa por acá antes de valer nada. Corrige en vez de
 * rechazar —un gráfico al que se le cambió el tipo conserva lo que todavía sirve— y devuelve
 * null sólo si no hay de dónde sacar una fuente.
 *
 * v5: copia uno por uno los campos opcionales nuevos (con sus topes; los que valen lo de siempre no se
 * escriben) y MIGRA el período propio a un control fijo (ver `Grafico.periodo`).
 */
export function sanearGrafico(raw: unknown, ctx: ContextoSaneo = {}): Grafico | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const fuente = fuenteDe(String(o.fuente ?? ''));
  if (!fuente) return null;
  // Los nombres del v1 (10/10) siguen valiendo: `linea` y `torta` son la serie y la circular.
  const pedido = o.tipo === 'linea' ? 'serie' : o.tipo === 'torta' ? 'circular' : String(o.tipo ?? '');
  let info = tipoDe(pedido) ?? tipoDe('barras')!;
  // Un tipo atado a otros conjuntos (el mapa de calor, a los toques) no se dibuja sobre éste: barras.
  if (!tipoAdmite(info, fuente.id)) info = tipoDe('barras')!;
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

  const id = idValido(o.id) ?? nuevoId();
  // ── El período propio pasa a ser un control FIJO (v5). El control propio ya le ganaba a este campo en
  // `efectivoDe`, así que el número no cambia: lo que cambia es que hay UN lugar para el período (la sección
  // «Filtros» del panel) en vez de dos. Id determinístico (el saneo corre en cada lectura). Si el gráfico ya
  // tiene un control de período, el campo era decorativo y se va. Sin lugar para un control más (8), queda
  // el campo: `efectivoDe` lo sigue leyendo.
  let controles = sanearControles(o.controles);
  let periodo = periodoValido(o.periodo);
  let desde = fechaONull(o.desde), hasta = fechaONull(o.hasta);
  if (periodo !== 'auto') {
    if (controles.some((c) => c.tipo === 'periodo')) { periodo = 'auto'; desde = null; hasta = null; }
    else if (controles.length < MAX_CONTROLES) {
      const c = sanearControlVista({ id: idLibre(idDeParte(id, 'fecha'), new Set(controles.map((k) => k.id))), tipo: 'periodo', fijo: true, preset: periodo, desde, hasta });
      if (c) { controles = [c, ...controles]; periodo = 'auto'; desde = null; hasta = null; }
    }
  }

  // ── Lo opcional de v5: sólo lo que no vale lo de siempre (un gráfico de antes guarda lo mismo que antes).
  const extra: Pick<Grafico, 'mako' | 'makoIA' | 'alClic' | 'popup' | 'barra' | 'secundaria' | 'ocultarSiCero' | 'ejes' | 'referencias' | 'colorPor' | 'tabla' | 'mapa' | 'portada'> = {};
  // 13/10/2026: se guardan los DOS valores (ausente = lo que dice `makoPorDefecto` según el tipo, ver `conMako`).
  if (typeof o.mako === 'boolean') extra.mako = o.mako;
  const makoIA = sanearMakoIA(o.makoIA);
  if (makoIA) extra.makoIA = makoIA;
  const popup = ctx.enPopup ? undefined : sanearPopup(o.popup);
  if (popup) extra.popup = popup;
  if (o.alClic === 'nada') extra.alClic = 'nada';
  // Un clic que abre un pop-up que no existe no abre nada: sin pop-up, el detalle de siempre.
  else if (o.alClic === 'popup' && popup) extra.alClic = 'popup';
  if (typeof o.barra === 'string' && metricas.includes(o.barra)) extra.barra = o.barra;
  if (typeof o.secundaria === 'string' && fuente.metricas.some((x) => x.id === o.secundaria)) extra.secundaria = o.secundaria;
  if (o.ocultarSiCero === true) extra.ocultarSiCero = true;
  const ejes = sanearEjes(o.ejes);
  if (ejes) extra.ejes = ejes;
  const referencias = sanearReferencias(o.referencias);
  if (referencias) extra.referencias = referencias;
  if (typeof o.colorPor === 'string' && o.colorPor !== dimension && fuente.dimensiones.some((d) => d.id === o.colorPor && d.clase === 'categoria')) extra.colorPor = o.colorPor;
  const tabla = sanearTabla(o.tabla, fuente, dimension);
  if (tabla) extra.tabla = tabla;
  const mapa = sanearMapa(o.mapa);
  if (mapa) extra.mapa = mapa;
  // La portada, sólo con una identidad que existe y nunca adentro de un pop-up (no es la hoja).
  if (!ctx.enPopup && identidadDe(o.portada)) extra.portada = o.portada as string;

  return {
    id,
    clase: 'grafico', tipo,
    titulo: texto(o.titulo, 80),
    subtitulo: texto(de('subtitulo'), 80),
    fuente: fuente.id, fecha, dimension, desglose, metricas,
    limite: entero(o.limite, 3, 50, 10),
    ordenMetrica, ordenAsc: o.ordenAsc === true,
    periodo, desde, hasta,
    comparar: de('comparar') === true,
    objetivo: numONull(de('objetivo')),
    maximo: numONull(de('maximo')),
    total: de('total') !== false,
    controles,
    ...extra,
    x: entero(o.x, 0, COLS - 1, 0), y: entero(o.y, 0, 999, 0),
    w: entero(o.w, 2, COLS, info.w), h: entero(o.h, 2, 24, info.h),
  };
}

/** @deprecated v5: no hay bloques (`BLOQUES` está vacío): contesta null siempre. Lo de antes lo migra `sanearHoja`. */
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

/** Un índice de la paleta del tema (0-7), o null. */
const colorDe = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 8 ? v : null);

/** La configuración de una caja de IA, con sus topes. `lee: 'entidad'` sólo adentro de un pop-up. */
function sanearConfigIA(raw: unknown, ctx: ContextoSaneo): ConfigIA {
  const o = esObj(raw) ? raw : {};
  const fuentes = Array.isArray(o.fuentes)
    ? [...new Set(o.fuentes.map((x) => idValido(x)).filter((x): x is string => !!x))].slice(0, MAX_COMPONENTES)
    : null;
  const c = esObj(o.cron) ? o.cron : null;
  const unidad = c ? unoDe(c.unidad, ['dia', 'semana', 'mes', ''] as const, '') : '';
  return {
    pedido: recortado(o.pedido, TOPE_PEDIDO_IA),
    fuentes,
    vista: unoDe(o.vista, ['resumen', 'hallazgos', 'recomendaciones', 'texto'] as const, 'resumen'),
    largo: unoDe(o.largo, ['corto', 'medio', 'largo'] as const, 'medio'),
    formato: unoDe(o.formato, ['parrafo', 'vinetas', 'tarjetas'] as const, 'parrafo'),
    lee: ctx.enPopup ? unoDe(o.lee, ['hoja', 'entidad'] as const, 'hoja') : 'hoja',
    cron: unidad && c ? { unidad, hora: entero(c.hora, 0, 23, 9) } : null,
  };
}

export function sanearElemento(raw: unknown, ctx: ContextoSaneo = {}): Elemento | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const info = TIPOS_ELEMENTO.find((x) => x.id === o.tipo);
  if (!info) return null;
  // ── El objeto de cada tipo nuevo (v5). Una ficha sólo vive en un pop-up (en la hoja no hay qué abrir), y
  //    una ficha o un botón sin lo que dicen ser no dibujan nada: se descartan.
  const tipoEspecial: Pick<Elemento, 'seccion' | 'ia' | 'entidad' | 'accion' | 'general'> = {};
  if (info.id === 'seccion') {
    const s = esObj(o.seccion) ? o.seccion : {};
    tipoEspecial.seccion = { fondo: colorDe(s.fondo), plegable: s.plegable === true, abierto: s.abierto !== false };
  } else if (info.id === 'ia') {
    tipoEspecial.ia = sanearConfigIA(o.ia, ctx);
  } else if (info.id === 'entidad') {
    if (!ctx.enPopup || !esObj(o.entidad)) return null;
    const tipo = unoDe(o.entidad.tipo, ['llamada', 'anuncio', 'lead', ''] as const, '');
    const pieza = typeof o.entidad.pieza === 'string' && /^[a-z0-9_-]{1,40}$/i.test(o.entidad.pieza) ? o.entidad.pieza : '';
    if (!tipo || !pieza) return null;
    tipoEspecial.entidad = { tipo, pieza };
  } else if (info.id === 'accion') {
    if (!esObj(o.accion)) return null;
    const id = typeof o.accion.id === 'string' && /^[a-z0-9_]{1,40}$/.test(o.accion.id) ? o.accion.id : '';
    if (!id) return null;
    tipoEspecial.accion = { id, rotulo: recortado(o.accion.rotulo, TOPE_ROTULO) };
  } else if (info.id === 'general') {
    // Un bloque de General vive en una hoja (en un pop-up no hay General que dibujar), y uno que no dice cuál, no dibuja nada.
    const pieza = esObj(o.general) ? o.general.pieza : null;
    if (ctx.enPopup || !esPiezaGeneral(pieza)) return null;
    const funnel = esObj(o.general) ? Number(o.general.funnel) : NaN;
    const opciones = sanearOpciones(pieza, esObj(o.general) ? o.general.opciones : null);
    tipoEspecial.general = {
      pieza,
      ...(piezaPorFunnel(pieza) && Number.isInteger(funnel) && funnel > 0 ? { funnel } : {}),
      ...(opciones ? { opciones } : {}),
    };
  }
  const grosor = [1, 2, 3, 4].includes(Number(o.grosor)) ? (Number(o.grosor) as 1 | 2 | 3 | 4) : 2;
  // Una sección va SIEMPRE a lo ancho: agrupa FILAS enteras (decisión 2 de Martín), no hay grilla anidada.
  const ancho = info.id === 'seccion';
  return {
    id: idValido(o.id) ?? nuevoId(), clase: 'elemento', tipo: info.id,
    texto: texto(o.texto, topeDeTextoElemento(info.id)),
    tamano: unoDe(o.tamano, ['s', 'm', 'l', 'xl'] as const, info.id === 'texto' || ancho ? 'l' : 'm'),
    alinear: unoDe(o.alinear, ['izquierda', 'centro', 'derecha'] as const, 'izquierda'),
    color: colorDe(o.color), relleno: o.relleno !== false,
    url: urlDeElemento(info.id, o.url),
    ajuste: unoDe(o.ajuste, ['cubrir', 'contener'] as const, 'cubrir'),
    direccion: unoDe(o.direccion, ['derecha', 'izquierda', 'arriba', 'abajo'] as const, 'derecha'),
    grosor,
    ...tipoEspecial,
    // La portada: un bloque de General o un texto (lo que abre una hoja de General), nunca en un pop-up.
    ...(!ctx.enPopup && (info.id === 'general' || info.id === 'texto') && identidadDe(o.portada) ? { portada: o.portada as string } : {}),
    x: ancho ? 0 : entero(o.x, 0, COLS - 1, 0), y: entero(o.y, 0, 999, 0),
    w: ancho ? COLS : entero(o.w, info.minW, COLS, info.w), h: entero(o.h, info.minH, 30, info.h),
  };
}

/**
 * Despacha por CLASE. Un control del v2 (`tipo: 'periodo'` en la grilla) no es un componente: lo muda `sanearHoja`.
 * ⚠️ v5: un BLOQUE ya no es un componente: los de antes los convierte `sanearHoja` (lib/graficos-migrar-v5.ts)
 *    ANTES de llegar acá, y uno que llegue igual (de afuera, o con un id que no existió nunca) se descarta.
 */
export function sanearComponente(raw: unknown, ctx: ContextoSaneo = {}): Componente | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { clase?: unknown; tipo?: unknown };
  if (o.clase === 'control' || (o.clase === undefined && o.tipo === 'periodo')) return null;
  if (o.clase === 'bloque') return null;
  if (o.clase === 'elemento') return sanearElemento(raw, ctx);
  return sanearGrafico(raw, ctx);
}

/** Un emoji (o nada). Se recorta por caracteres, no por bytes: un emoji compuesto no se parte. */
export const emojiValido = (v: unknown): string => (typeof v === 'string' ? [...v.trim()].slice(0, 4).join('').slice(0, 16) : '');

/** Las flechas que unen componentes: sólo entre dos que ESTÁN en la hoja (y distintos), hasta MAX_CONECTORES. */
function sanearConectores(raw: unknown, ids: ReadonlySet<string>): Conector[] {
  if (!Array.isArray(raw)) return [];
  const out: Conector[] = [];
  const vistos = new Set<string>();
  for (const x of raw) {
    if (out.length >= MAX_CONECTORES) break;
    if (!esObj(x)) continue;
    const desde = idValido(x.desde), hasta = idValido(x.hasta);
    if (!desde || !hasta || desde === hasta || !ids.has(desde) || !ids.has(hasta)) continue;
    let id = idValido(x.id) ?? nuevoId();
    if (vistos.has(id)) id = nuevoId();
    vistos.add(id);
    out.push({
      id, desde, hasta,
      punta: unoDe(x.punta, ['fin', 'ambas', 'ninguna'] as const, 'fin'),
      trazo: unoDe(x.trazo, ['curva', 'recta', 'codo'] as const, 'curva'),
      color: colorDe(x.color),
    });
  }
  return out;
}

/**
 * Los ids de los pop-ups no pueden repetir uno de la hoja (ni de otro pop-up): los datos y lo elegido
 * mirando se guardan por id. Se renombran SIN AZAR (`idLibre`) para que dos lecturas den el mismo informe,
 * y la caja de IA del pop-up sigue al gráfico renombrado.
 */
function idsUnicosEnPopups(componentes: readonly Componente[]): void {
  const usados = new Set(componentes.map((c) => c.id));
  for (const g of componentes) {
    if (g.clase !== 'grafico' || !g.popup) continue;
    const renombre = new Map<string, string>();
    for (const c of g.popup.componentes) {
      if (!usados.has(c.id)) { usados.add(c.id); continue; }
      const nuevo = idLibre(c.id, usados);
      renombre.set(c.id, nuevo);
      c.id = nuevo;
      usados.add(nuevo);
    }
    if (!renombre.size) continue;
    for (const c of g.popup.componentes) {
      if (c.clase === 'elemento' && c.ia?.fuentes) c.ia = { ...c.ia, fuentes: c.ia.fuentes.map((id) => renombre.get(id) ?? id) };
    }
  }
}

export function sanearHoja(raw: unknown, i: number): Hoja | null {
  if (!raw || typeof raw !== 'object') return null;
  // v5: los BLOQUES de antes se convierten en sus piezas ANTES de sanear (lib/graficos-migrar-v5.ts). Una hoja
  // llena no puede perder componentes por migrarse: el tope se corre en lo que la conversión agregó.
  const { hoja: o, extra } = migrarBloquesV5(raw as Record<string, unknown>);
  const tope = MAX_COMPONENTES + extra;
  const lista = Array.isArray(o.componentes) ? o.componentes : [];
  const vistos = new Set<string>();
  const componentes: Componente[] = [];
  let cajasIA = 0;
  for (const c of lista.slice(0, tope + MAX_CONTROLES)) {
    if (componentes.length >= tope) break;
    const s = sanearComponente(c);
    if (!s) continue;
    // Cada caja de IA gasta cuota al correr: hasta MAX_IA_POR_HOJA por hoja (la pantalla apaga el botón antes).
    if (s.clase === 'elemento' && s.tipo === 'ia' && ++cajasIA > MAX_IA_POR_HOJA) continue;
    // Dos componentes con el mismo id son una sola key en la grilla: el segundo se pisaría.
    if (vistos.has(s.id)) s.id = nuevoId();
    vistos.add(s.id);
    componentes.push(s);
  }
  idsUnicosEnPopups(componentes);
  podarFuentesIA(componentes);
  // Un informe del v2 tenía el control de período ADENTRO de la grilla: se muda a la barra.
  const viejos = lista.filter((c) => c && typeof c === 'object' && ((c as { clase?: unknown }).clase === 'control' || (c as { tipo?: unknown }).tipo === 'periodo') && (c as { fuente?: unknown }).fuente === undefined)
    .map((c) => ({ ...(c as object), tipo: 'periodo' }));
  const controles = sanearControles([...(Array.isArray(o.controles) ? o.controles : []), ...viejos]);
  const nombre = typeof o.nombre === 'string' && o.nombre.trim() ? o.nombre.trim().slice(0, 40) : `Página ${i + 1}`;
  const plantilla = idValido(o.plantilla);
  const conectores = sanearConectores(o.conectores, new Set(componentes.map((c) => c.id)));
  return {
    id: idValido(o.id) ?? nuevoId(), nombre,
    emoji: emojiValido(o.emoji), subtitulo: texto(o.subtitulo, 140),
    tema: sanearTema(o.tema), controles, componentes,
    ...(plantilla ? { plantilla } : {}),
    ...(conectores.length ? { conectores } : {}),
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
  const sinHojas = !hojas.length;
  if (sinHojas) hojas.push(hojaVacia('Página 1'));
  const nombre = typeof o.nombre === 'string' && o.nombre.trim() ? o.nombre.trim().slice(0, 80) : NOMBRE_INICIAL;
  // Las archivadas, saneadas como cualquier hoja y con su id único entre TODAS (restaurar una no puede chocar).
  const archivadas: Hoja[] = [];
  const crudasArch = (raw as { archivadas?: unknown }).archivadas;
  if (Array.isArray(crudasArch)) {
    for (const [i, h] of crudasArch.slice(0, MAX_ARCHIVADAS).entries()) {
      const s = sanearHoja(h, i);
      if (!s) continue;
      if (vistas.has(s.id)) s.id = nuevoId();
      vistas.add(s.id);
      archivadas.push(s);
    }
  }
  const enBlanco = (raw as { enBlanco?: unknown }).enBlanco === true;
  return { v: 3, nombre, hojas, ...(archivadas.length ? { archivadas } : {}), ...(enBlanco ? { enBlanco: true as const } : {}) };
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
  // El mapa sólo existe sobre una región (o un país, o una ciudad).
  if (info.soloDims && !f.dimensiones.some((d) => info.soloDims!.includes(d.id))) f = FUENTES.find((x) => x.dimensiones.some((d) => info.soloDims!.includes(d.id)))!;
  // El mapa de calor de una página, sólo sobre los toques.
  if (!tipoAdmite(info, f.id)) f = fuenteDe(info.soloFuentes![0]) ?? f;
  const base: Record<string, unknown> = { id: nuevoId(), tipo: info.id, fuente: f.id, w: info.w, h: info.h, x: 0, y: abajoDeTodo(componentes) };
  if (info.dimension === 'tiempo') base.dimension = 'dia';
  if (info.grupo === 'Embudo de conversión') base.metricas = f.metricas.filter((x) => !x.razon && !x.sinTotal).slice(0, 4).map((x) => x.id);
  return sanearGrafico(base)!;
}

/**
 * @deprecated v5: no hay bloques (`BLOQUES` está vacío), así que nadie la llama: ni la galería ni la API
 * ofrecen uno. Tira con un mensaje claro en vez de devolver un bloque roto.
 */
export function nuevoBloque(bloque: BloqueId, componentes: Componente[]): Bloque {
  const info = bloqueDe(bloque);
  const b = info ? sanearBloque({ id: nuevoId(), bloque, x: 0, y: abajoDeTodo(componentes), w: info.w, h: info.h }) : null;
  if (!b) throw new Error(`Los bloques ya no existen (v5): «${bloque}» se arma con gráficos del catálogo.`);
  return b;
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
