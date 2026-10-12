// =============================================================================
// api-mako/areas/metricas.def — las operaciones del área `metricas` (definiciones)
// =============================================================================
// Una entrada por operación: id, qué es, parámetros, por qué canales sale, cómo se
// confirma. SIN server-only y sin importar valores de módulos que lo tengan: esto
// lo importan los tests y el generador de la referencia. Los cuerpos van en
// metricas.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// El área son los NÚMEROS del negocio (/dashboard → /marketing y /comercial, y
// la tab Análisis de Experiments, /experimentos?tab=analisis — hasta el 11/10/2026
// era su propia tab, /analisis, que hoy redirige ahí). Son todas lecturas: las escrituras que vivían cerca (marcar una
// cuota, el plan de pagos, despachar un reporte, los chats por gráfico) las
// declaran las áreas dueñas (crm, equipo, mako) para no tener dos puertas a lo
// mismo.
//
// ⚠️ Fechas: todas las operaciones con ventana usan `desde`/`hasta` aunque la lib
// de abajo se llame `start`/`end`. Es a propósito: las dos heredadas del área
// (metricas_negocio, analisis_negocio) ya enseñaron `desde`/`hasta` al modelo, y
// un parámetro que cambia de nombre entre dos operaciones hermanas es un parámetro
// que el modelo manda mal y el validador descarta sin error. El runner traduce.
//
// ⚠️ Hay TRES definiciones de «cierre» y tres de «CAC» en las libs de abajo. Cada
// descripción dice cuál usa: si dos operaciones discuten, es por eso.
//
// ⚠️ Rol: TODAS llevan `rolMinimo: 'admin'`. /marketing, /comercial y /experimentos
// (donde vive Análisis) hacen requireRolWs([], {nav}) y con [] solo pasa el admin (lib/tab-access.ts):
// un closer o setter no ve sold, cash, CAC ni cohortes en su pantalla, así que
// tampoco se los cuenta MaKo en la app (ctx.rol='miembro' en app/api/mako-doer).
// Por HTTP y WhatsApp el rol es siempre admin: ahí no cambia nada.
//
// Las LECTURAS de cobranza del workspace entero (a_quien_cobrar, cuotas_pendientes)
// viven aquí porque salen de lib/pagos.ts igual que el outstanding de
// ver_revenue_periodo; la de UN lead (cobranza_lead) y las escrituras, en crm.
// =============================================================================

import type { Gating, OperacionDef, Parametro } from '../tipos';

const TODOS = ['whatsapp', 'app', 'http'] as const;
/** Nombres de personas y montos por lead: no salen a un token que vive en la máquina de un tercero. */
const SIN_HTTP = ['whatsapp', 'app'] as const;
const GATING_GRAPHICS: Gating = { tab: 'graphics', rolMinimo: 'admin' };
// La tab 'analisis' ya no es un ítem de la barra (se mudó adentro de Experiments el
// 11/10/2026), y la key se queda igual A PROPÓSITO: `gating.tab` pregunta por la CAPA
// (tabEnCapa en lib/capas.ts), que sólo mira las listas de keys de cada capa y no exige que
// el ítem exista — y en las cuatro capas 'analisis' da lo mismo que 'experimentos'.
// Cambiarla movería docs/api-mako.md por nada.
const GATING_ANALISIS: Gating = { tab: 'analisis', rolMinimo: 'admin' };

const desde = (extra = ''): Parametro => ({
  nombre: 'desde', tipo: 'string', max: 10, ejemplo: '2026-06-01',
  descripcion: `Primer día de la ventana, YYYY-MM-DD.${extra}`,
});
const hasta = (extra = ''): Parametro => ({
  nombre: 'hasta', tipo: 'string', max: 10, ejemplo: '2026-08-31',
  descripcion: `Último día de la ventana, YYYY-MM-DD, inclusive.${extra}`,
});
const RANGO_DEFAULT = ' Si falta, se usan los últimos 90 días hasta hoy en la zona del negocio. Tope: 1830 días.';

export const DEFS: readonly OperacionDef[] = [
  // ── Heredadas (MAKO_TOOLS), con cuerpo nativo ──────────────────────────────
  {
    id: 'metricas_negocio', area: 'metricas', tipo: 'lectura',
    titulo: 'Números del negocio por período',
    descripcion: 'Los NÚMEROS del negocio por período: inversión, impresiones, clics y formularios de Meta; visitas y visitantes del landing; plays del VSL; leads nuevos; agendas creadas; reuniones 1 y 2 (programadas, realizadas, no-show y SIN MARCAR, por separado); cierres e ingreso, agregados por día, semana o mes, con totales, cobertura por fuente (null = no hay de dónde leer, 0 = de verdad no hubo) y advertencias. Úsala SIEMPRE que pregunten cómo va el negocio, cuánto se invirtió, si algo mejoró o empeoró, o para comparar dos períodos. Nunca contestes de memoria una pregunta sobre resultados. Cierre = cerro con fecha de cierre en el período. Por HTTP acepta ?formato=md|csv|json.',
    parametros: [
      desde(RANGO_DEFAULT),
      hasta(' Si falta, hoy en la zona del negocio.'),
      { nombre: 'grano', tipo: 'string', enum: ['dia', 'semana', 'mes'], descripcion: 'Cómo agrupar las filas. Default: mes. Por WhatsApp y en la app, «dia» admite hasta 92 días y «semana» hasta 728 (104 semanas): para un tramo más largo pide «semana» o «mes». Por HTTP con csv o json no hay ese tope.' },
    ],
    salida: 'markdown', formatos: ['md', 'csv', 'json'],
    canales: TODOS, costo: 'gratis', lenta: true,
    gating: GATING_GRAPHICS,
  },
  {
    id: 'analisis_negocio', area: 'metricas', tipo: 'lectura',
    titulo: 'Análisis completo del período',
    descripcion: 'EL ANÁLISIS COMPLETO de un período, no solo los números: la cascada de costos (cuánto cuesta una agenda, una asistencia, un calificado y un cliente, en la moneda de la cuenta y en USD), las tasas de cada escalón, el chequeo de cuadratura contra la base, cuántos de los que asistieron no calificaban y qué contestaron, el ranking de creativos por volumen y por costo (y cuáles esconde el ranking por cantidad), la serie mes a mes y, si se pasa una meta de cierres, cuántas asistencias, agendas e inversión hacen falta, marcando si el presupuesto propuesto se contradice. Úsala cuando pidan un diagnóstico, «cómo venimos», una revisión del período o antes de recomendar dónde poner el presupuesto. Trae advertencias arriba: léelas y repítelas, dicen qué números NO son confiables todavía.',
    parametros: [
      desde(' Default: últimos 90 días.'),
      hasta(' Default: hoy.'),
      { nombre: 'cierres_objetivo', tipo: 'number', entero: true, minimo: 1, maximo: 10000, descripcion: 'Cuántos cierres al mes quiere el dueño. Solo si lo dijo: es una DECISIÓN suya, no se deduce. Sin esto no hay plan inverso.' },
      { nombre: 'presupuesto_propuesto', tipo: 'number', minimo: 1, descripcion: 'Presupuesto que se está proponiendo, en la moneda de la cuenta publicitaria. Sirve para detectar si el plan se contradice (no alcanza para las agendas necesarias).' },
    ],
    salida: 'markdown',
    canales: TODOS, costo: 'gratis', lenta: true,
    gating: GATING_ANALISIS,
  },

  // ── Marketing: la parte de arriba del embudo ───────────────────────────────
  {
    id: 'resumir_marketing_periodo', area: 'metricas', tipo: 'lectura',
    titulo: 'KPIs de marketing del período',
    descripcion: 'Un solo agregado de la ventana, como lo muestra /marketing: gasto en USD, impresiones, clics y clics de link, landing page views del píxel, formularios instantáneos, plays del VSL, reuniones 1 con fecha en la ventana, cierres en la ventana y el CAC, más CTR (de clics totales y de clics de link, por separado), CPC, CPM y costo por landing view. Úsala para contestar rápido «¿cuánto gasté y qué CTR o CPM tengo este mes?». Para una serie por mes o semana usa metricas_negocio. Reuniones = fecha de la reunión 1 en la ventana (no la fecha en que se reservó). Cierre = cerro con fecha de cierre en la ventana. Sin filas de Meta en la ventana, los números de Meta salen null con una nota (no cero).',
    parametros: [desde(RANGO_DEFAULT), hasta(' Default: hoy.')],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: { ...GATING_GRAPHICS, integracion: 'meta' },
  },
  {
    id: 'diagnosticar_funnel', area: 'metricas', tipo: 'lectura',
    titulo: 'Salud del embudo por etapa',
    descripcion: 'El embudo del período con el porcentaje de paso de cada etapa y su salud (verde, ámbar, rojo, sin_datos): Impresión→Click de link, Click→Formulario, Formulario→Agenda, Agenda→Asistió a la R1, Asistió→Calificado, Calificado→Cierre, más dos etapas de contexto (Click→Landing, Landing→VSL) que no compiten por ser el cuello. Devuelve el cuello de botella. Úsala para «¿dónde pierdo más gente?» o «¿qué etapa optimizo primero?». Una etapa con su fuente desconectada dice fuente_pendiente, no 0%. Los umbrales son una referencia fija de la plataforma, no del negocio del cliente: dilo si repites un «rojo». Cierre = etapa ganado.',
    parametros: [desde(RANGO_DEFAULT), hasta(' Default: hoy.')],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
  {
    id: 'ver_serie_funnel_semanal', area: 'metricas', tipo: 'lectura',
    titulo: 'Serie semanal del embudo',
    // ⚠️ LAS CLAVES NO SE ENUMERAN ACÁ. Las del tramo de Meta son fijas; las del CRM
    // dependen del funnel del cliente (lib/funnel-comercial.ts), así que una lista a
    // mano le prometía al modelo etapas que un negocio sin reuniones no tiene.
    descripcion: 'El porcentaje de paso de cada etapa del embudo semana a semana, con el lunes de cada semana. Las etapas de Meta son siempre imp_click, click_form, click_landing y landing_vsl; las del CRM salen del embudo que tenga ese cliente, así que lee las claves que vengan en vez de darlas por sabidas. Una semana sin denominador sale null, no 0. Úsala para ver si una etapa viene cayendo o mejorando; para el número del período usa diagnosticar_funnel.',
    parametros: [
      hasta(' La última semana es la que contiene este día. Default: hoy en la zona del negocio.'),
      { nombre: 'semanas', tipo: 'number', entero: true, minimo: 1, maximo: 26, descripcion: 'Cuántas semanas hacia atrás. Default 12.' },
    ],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
  {
    id: 'ver_tendencias', area: 'metricas', tipo: 'lectura',
    titulo: 'Tendencias de marketing y comercial',
    descripcion: 'Series por período de marketing (impresiones, visitas a la landing, CTR de link, gasto en USD, formularios, CPL, plays del VSL) y comerciales (agendas, asistencias a la R1, cierres, cash cobrado, CAC), con cuadros de contexto por métrica (total, promedio, mejor período). La granularidad sale del largo de la ventana: hasta 31 días diaria, hasta 180 semanal, más larga mensual. Úsala para «¿qué tendencia ves?» o «¿qué cambió?». La ventana se recorta a ayer y nunca empieza antes del 2025-11-01, y después se estira a períodos completos (del lunes al domingo, o del día 1 al fin de mes): el primer período puede sumar días antes de `desde` y el último, fechas futuras. La respuesta dice la ventana que de verdad se leyó. Agendas = reuniones 1 con fecha en el período; cierre = etapa ganado.',
    parametros: [desde(RANGO_DEFAULT), hasta(' Default: hoy (se recorta a ayer).')],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
  {
    id: 'detectar_fatiga_adsets', area: 'metricas', tipo: 'lectura',
    titulo: 'Conjuntos con fatiga de creativo',
    descripcion: 'Los conjuntos de anuncios que muestran fatiga: en la ventana corta (de `hasta` menos 7 días a `hasta`, inclusive: 8 días) gastaron más de USD 50, con frecuencia media mayor a 3.5 y un costo por formulario 1.5 veces mayor que el de la ventana larga (de `hasta` menos 28 días a `hasta`: 29 días). Es una de las alertas del reporte horario. Úsala para «¿hay anuncios quemados?» o «¿tengo que rotar creativos?». Los umbrales son fijos de la plataforma. Lista vacía = ninguno cumple las tres condiciones (o no hay datos de Meta en la ventana).',
    parametros: [hasta(' Default: hoy en la zona del negocio.')],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: { ...GATING_GRAPHICS, integracion: 'meta' },
  },
  {
    id: 'comparar_agendas_meta_crm', area: 'metricas', tipo: 'lectura',
    titulo: 'Agendas según Meta y según CRM',
    descripcion: 'Los dos conteos de agendas de una ventana, lado a lado: las que Meta se atribuye (suma de la conversión del píxel por anuncio) y las del CRM (leads con fecha de reunión 1 en la ventana). Úsala para explicar por qué un costo por agenda «según Meta» es optimista o por qué dos pantallas no cuadran. No son dos mitades de un total: no se suman.',
    parametros: [desde(RANGO_DEFAULT), hasta(' Default: hoy.')],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: { ...GATING_GRAPHICS, integracion: 'meta' },
  },
  {
    id: 'ver_serie_vsl', area: 'metricas', tipo: 'lectura',
    titulo: 'Plays diarios del VSL',
    descripcion: 'Plays del VSL por día en los últimos N días (histórico de YouTube más Panda), con el total, la suma diaria de espectadores de Panda, el promedio diario de la retención mediana (p50) de Panda y el tiempo de visionado promedio, y si Panda tiene datos en la ventana. Úsala para «¿cuánta gente ve el VSL por día?». La ventana termina hoy en UTC. La retención es un promedio de promedios diarios (no ponderado por plays).',
    parametros: [{ nombre: 'dias', tipo: 'number', entero: true, minimo: 1, maximo: 365, descripcion: 'Cuántos días hacia atrás, terminando hoy. Default 56.' }],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },

  // ── Cobranza del workspace (lib/pagos.ts) ──────────────────────────────────
  {
    id: 'a_quien_cobrar', area: 'metricas', tipo: 'lectura',
    titulo: 'A quién le falta pagar',
    descripcion: 'Los clientes con cuotas sin pagar, del que más debe al que menos: nombre, vendido, cobrado y pendiente en USD, días desde el cierre y la próxima cuota (con su pago_id, monto y vencimiento). Con desde y hasta, solo cuenta las cuotas que VENCEN en esa ventana; sin fechas, todo lo pendiente a hoy. Úsala para «¿a quién le cobro esta semana?» o «¿quién me debe más?». El pago_id es el que pide marcar_pago_cobrado. Hasta 50 clientes; la respuesta dice cuántos quedaron afuera.',
    parametros: [
      desde(' Filtra por vencimiento de la cuota. Va junto con hasta: si falta alguno de los dos, no se filtra.'),
      hasta(' Filtra por vencimiento de la cuota. Va junto con desde.'),
    ],
    salida: 'json',
    canales: SIN_HTTP, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
  {
    id: 'cuotas_pendientes', area: 'metricas', tipo: 'lectura',
    titulo: 'Cuotas vencidas y por vencer',
    descripcion: 'Las cuotas sin pagar con fecha de vencimiento, partidas en vencidas (antes de hoy, con cuántos días de atraso) y por vencer (en los próximos N días), cada una con pago_id, cliente, número de cuota, monto en USD y fecha. Úsala para «¿tengo cuotas vencidas?» o «¿qué vence esta semana?». Las cuotas sin fecha de vencimiento no aparecen: para esas usa a_quien_cobrar. Hoy = la fecha del negocio. Hasta 50 por grupo; la respuesta dice cuántas quedaron afuera.',
    parametros: [
      { nombre: 'dias_aviso', tipo: 'number', entero: true, minimo: 0, maximo: 60, descripcion: 'Cuántos días hacia adelante cuentan como «por vencer». Default 3.' },
    ],
    salida: 'json',
    canales: SIN_HTTP, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },

  // ── Comercial: revenue, CAC, cohortes, ciclo ───────────────────────────────
  {
    id: 'ver_revenue_periodo', area: 'metricas', tipo: 'lectura',
    titulo: 'Revenue, CAC y ROAS del período',
    descripcion: 'Los tres números de revenue que NO son lo mismo: sold (monto firmado de los cierres con fecha de cierre en la ventana), cash cobrado (cuotas pagadas con fecha de pago en la ventana, incluye cuotas de clientes de meses anteriores) y outstanding (cuotas sin pagar que vencen desde el primer día de la ventana, SIN tope hacia adelante), más el gasto de Meta en USD, el CAC por cliente con primer pago en la ventana y el ROAS sobre cash y sobre sold. Úsala para «¿cuánto vendí, cuánto cobré y cuánto me falta cobrar?». El detalle de a quién se le debe está en a_quien_cobrar, y las cuotas vencidas o por vencer en cuotas_pendientes. Las suscripciones no entran aquí: para eso está ver_mrr_activo.',
    parametros: [desde(RANGO_DEFAULT), hasta(' Default: hoy.')],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
  {
    id: 'ver_revenue_mensual', area: 'metricas', tipo: 'lectura',
    titulo: 'Ingresos contra gasto, mes a mes',
    descripcion: 'Una fila por mes (continua, con los meses en cero, sin los meses iniciales sin actividad): sold en USD, cash cobrado en USD, gasto de Meta en USD, cantidad de cierres y de reuniones 1 con fecha en el mes. Úsala para ver la forma del negocio a lo largo de hasta 36 meses o comparar inversión contra resultados. Montos redondeados al dólar.',
    parametros: [
      hasta(' El mes de este día es el último de la serie. Default: hoy en la zona del negocio.'),
      { nombre: 'meses', tipo: 'number', entero: true, minimo: 1, maximo: 36, descripcion: 'Cuántos meses hacia atrás mirar. Default 18.' },
    ],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
  {
    id: 'ver_mrr_activo', area: 'metricas', tipo: 'lectura',
    titulo: 'MRR de suscripciones activas',
    descripcion: 'El ingreso recurrente mensual en USD de los leads ganados con venta de tipo suscripción que siguen activos hoy (indefinidos, o de plazo fijo cuyo fin todavía no llegó), y cuántas suscripciones son. Va APARTE del high-ticket: las suscripciones no entran en sold ni en cash. Úsala para «¿cuánto tengo en recurrente?». No requiere parámetros.',
    parametros: [],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
  {
    id: 'ver_cac_acumulado', area: 'metricas', tipo: 'lectura',
    titulo: 'CAC acumulado histórico',
    descripcion: 'El costo de adquisición de TODO el histórico: gasto total de Meta convertido a USD dividido por los cierres totales (cerro), opcionalmente hasta un día. Es la referencia contra la que se compara el CAC de una ventana. Úsala para «¿cuánto me cuesta un cliente en promedio desde que arranqué?». No tiene fecha de inicio: es desde el primer dato.',
    parametros: [hasta(' Si falta, todo el histórico hasta hoy.')],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
  {
    id: 'ver_cac_mensual', area: 'metricas', tipo: 'lectura',
    titulo: 'CAC mes a mes',
    descripcion: 'Serie del CAC por mes: gasto de Meta del mes en USD dividido por los clientes con primer pago en ese mes. Solo aparecen los meses con al menos un primer pago, en orden cronológico, los últimos N. Úsala para «¿el CAC viene subiendo?». Un mes que falta no es un CAC de cero: es un mes sin primeros pagos.',
    parametros: [{ nombre: 'meses', tipo: 'number', entero: true, minimo: 1, maximo: 36, descripcion: 'Cuántos meses con primer pago devolver. Default 12.' }],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
  {
    id: 'listar_cohortes_semanales', area: 'metricas', tipo: 'lectura',
    titulo: 'Cohortes semanales por reunión 1',
    descripcion: 'Las últimas N semanas agrupadas por la fecha de la reunión 1 de cada lead (la más reciente primero): total de R1, asistencias, limpias (asistió y calificó), cierres, ingreso en USD, días promedio de la R1 al cierre y la madurez (madura: la última R1 fue hace 14 días o más; madurando: 5 o más; reciente). La tasa de cierre solo es confiable en cohortes maduras. Úsala para «¿cómo cerró la semana del 4 de mayo?».',
    parametros: [{ nombre: 'semanas', tipo: 'number', entero: true, minimo: 1, maximo: 52, descripcion: 'Cuántas semanas devolver. Default 8.' }],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
  {
    id: 'listar_cohortes_mensuales', area: 'metricas', tipo: 'lectura',
    titulo: 'Cohortes mensuales por reunión 1',
    descripcion: 'Lo mismo que listar_cohortes_semanales pero por mes de la reunión 1, los últimos N meses. Cuidado: la madurez de un mes se mide por su ÚLTIMA R1, así que una sola R1 tardía vuelve «reciente» a todo el mes. Para la tasa de cierre confiable usa ver_embudo_comercial_maduro, que agrega semanas.',
    parametros: [{ nombre: 'meses', tipo: 'number', entero: true, minimo: 1, maximo: 24, descripcion: 'Cuántos meses devolver. Default 6.' }],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
  {
    id: 'ver_embudo_comercial_maduro', area: 'metricas', tipo: 'lectura',
    titulo: 'Embudo comercial de cohortes maduras',
    descripcion: 'El agregado de las semanas MADURAS (la última R1 de la semana fue hace 14 días o más): R1 totales, asistencias, R1 sin asistencia marcada como sí (incluye las que nadie marcó), limpias, cierres, ingreso en USD, cuántas semanas entran, la tasa de cierre madura (cierres sobre limpias) y el ciclo promedio de la R1 al cierre. Es la fuente del KPI de no-show y de tasa de cierre de /comercial. Úsala para «¿cuál es mi tasa de cierre real?». Sin fechas, todo el histórico.',
    parametros: [
      desde(' Filtra por el lunes de la semana (semana_inicio mayor o igual). Si falta, desde el primer dato.'),
      hasta(' Filtra por el lunes de la semana (semana_inicio menor o igual). Si falta, hasta hoy.'),
    ],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
  {
    id: 'listar_leads_embudo_maduro', area: 'metricas', tipo: 'lectura',
    titulo: 'Leads detrás del embudo comercial',
    descripcion: 'Los leads concretos de cada etapa del embudo de cohortes maduras (agenda, asistió, no_show, calificado, cierre) con id, nombre, empresa, fecha de la R1, asistencia, calificación y monto: es el detalle que cuadra con ver_embudo_comercial_maduro. Úsala para «¿quiénes no vinieron?» o «¿quiénes cerraron de esa cohorte?». no_show incluye a los que nadie marcó (asistio_r1 null). Hasta 100 leads por etapa; la respuesta dice cuántos quedaron afuera.',
    parametros: [
      { nombre: 'etapa', tipo: 'string', enum: ['agenda', 'asistio', 'no_show', 'calificado', 'cierre'], descripcion: 'Solo esta etapa. Si falta, todas.' },
      desde(' Filtra por el lunes de la semana de la R1. Si falta, desde el primer dato.'),
      hasta(' Filtra por el lunes de la semana de la R1. Si falta, hasta hoy.'),
    ],
    salida: 'json',
    // Nombres y empresas de personas: no sale a un token que vive en la máquina de un tercero.
    canales: ['whatsapp', 'app'], costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
  {
    id: 'ver_ciclo_venta', area: 'metricas', tipo: 'lectura',
    titulo: 'Ciclo de venta promedio y P90',
    descripcion: 'Cuántos días pasan entre que un lead reserva (fecha de agenda) y hace su primer pago: promedio y percentil 90, sobre los leads con las dos fechas, de todo el histórico. Con menos de 3 leads los dos salen null (no es honesto promediar dos). Úsala para «¿cuánto tarda un cliente en pagar desde que agenda?». Para ver dónde se traba, ver_tramos_ciclo_venta.',
    parametros: [],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
  {
    id: 'ver_tramos_ciclo_venta', area: 'metricas', tipo: 'lectura',
    titulo: 'Tramos del ciclo de venta',
    descripcion: 'La línea de tiempo promedio del ciclo partida en tramos (formulario de Meta→agenda, solo para leads que entraron por un formulario instantáneo; agenda→R1, R1→R2, R2→confirmación, confirmación→pago), cada uno con el promedio de días y cuántos leads tienen las dos fechas, el tramo más lento y el total. Todo el histórico. Úsala para «¿dónde se traba la venta?». Si el negocio tiene más de 1000 leads, la respuesta avisa que el cálculo está hecho sobre una parte.',
    parametros: [],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
  {
    id: 'ver_distribucion_pipeline', area: 'metricas', tipo: 'lectura',
    titulo: 'Pipeline abierto por madurez',
    descripcion: 'Cuántos leads asistieron a la R1 y todavía no cerraron, partidos por los días desde la R1 (reciente: menos de 5; madurando: 5 a 13; madura: 14 o más), con porcentajes. Úsala para «¿cuántos deals tengo abiertos y qué tan viejos son?». No distingue perdidos de abiertos: cuenta todo lo que asistió y no tiene cerro.',
    parametros: [],
    salida: 'json',
    canales: TODOS, costo: 'gratis',
    gating: GATING_GRAPHICS,
  },
];
