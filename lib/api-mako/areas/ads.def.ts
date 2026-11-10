// =============================================================================
// api-mako/areas/ads.def — las operaciones del área `ads` (definiciones)
// =============================================================================
// Dos partes en un área: Ads Manager (el árbol de Meta en vivo, rendimiento por
// anuncio, escrituras a Meta) y los guiones (guiones analizados, vocabulario de
// ángulos y avatares), que eran la tab Ads Analyst: desde el 11/10/2026 su análisis
// es la hoja «Ads Analyst» del Dashboard y sus tareas viven en Ads Writer →
// «Analizar guion». La key de gating sigue siendo `script` (está escrita en la base
// y en las capas: no se renombra con la pantalla).
// SIN server-only y sin importar valores de módulos que lo
// tengan: esto lo importan los tests y el generador de la referencia. Los cuerpos
// van en ads.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// ⚠️ LA MONEDA. Todo lo que en lib/ se llama *Mxn (dailyBudgetMxn, balanceMxn,
// montoMxn) viene y se escribe en la MONEDA DE LA CUENTA de Meta, que no siempre es
// MXN (el ws 13 cobra en USD). Por eso las salidas dicen `moneda` y los campos se
// llaman `*_moneda_cuenta`; y los `*_usd` de las señales son MXN ÷ un tipo de cambio
// FIJO del código, un derivado. `montoMxn` conserva su nombre por contrato con las
// pendientes que ya están en la base.
//
// Las escrituras a Meta —por metaWrite (estado, nombre, presupuesto, borrar) y por
// lib/meta-ads-create.ts (anuncio, textos, público, formulario)— salen con las
// credenciales del workspace de la pendiente (ctx.ws). Hasta el 07/10/2026 las de
// metaWrite usaban envCred, o sea la cuenta del ws 1 para todos, y por eso iban con
// `soloWs1`; desde entonces van con G_META_ADMIN como el resto.
//
// ⚠️ proponer_presupuesto_campana es `pantalla`, pero la tool VIEJA del mismo nombre
// sigue en MAKO_ACCION_TOOLS (lib/mako-doer-acciones.ts) y deja pendientes de chat
// tipo 'meta_presupuesto', que resuelven a esta def por tipoPendiente. El runner las
// cierra sin tocar Meta (marca `desdePantalla`); sacar la tool vieja del doer es
// trabajo del núcleo, no de esta área.
//
// OMITIDAS (no están acá, con el motivo):
//  · crear campaña (campaign-create), subir creativos (creative-upload,
//    creative-signurl), analizar creativos, sugerir campaña o nombres, preview:
//    la orquestación vive solo en app/api/ads-manager/* o gasta IA al proponer.
//  · agregar_conjunto: addAdsetToCampaign (lib/meta-ads-create.ts) SÍ es reutilizable,
//    pero pide un AdSetSpec entero (segmentación, optimización, anuncios adentro) como
//    parámetro objeto. Hay que decidir su forma; no se calla.
//  (editar_publico_conjunto YA NO está omitida: desde el 17/10/2026 es
//   proponer_editar_publico_conjunto. La superposición sobre el crudo vive en el SERVER
//   —editarPublicoConjunto, lib/meta-ads-create.ts, con aplicarCambiosDePublico de
//   lib/publico-cambios.ts— y no sólo en el navegador: un parámetro parcial ya no borra
//   la segmentación. Va con confirmación en pantalla y rol admin: cambiar el público
//   reinicia el aprendizaje del conjunto.)
// =============================================================================

import { FUNNELS } from '@/lib/funnel-plan';
import type { Gating, OperacionDef, Parametro } from '../tipos';
import { CTAS as CTAS_SUBIDA } from '@/lib/media-buyer/creativos';

const TODOS = ['whatsapp', 'app', 'http'] as const;
const SIN_HTTP = ['whatsapp', 'app'] as const;
/** Lo del Funnel Coach (1/11/2026): vive en el Ops Center, que está en todas las capas. Con la tab del Ads Manager, un negocio sin ella tenía un coach sin calculadora ni plan. */
const G_COACH: Gating = { tab: 'mako', rolMinimo: 'admin' };

/** Lecturas del Ads Manager (la page exige admin del workspace y la capa con la tab). */
const G_MANAGER: Gating = { tab: 'ads-manager', integracion: 'meta', rolMinimo: 'admin' };
/** Lecturas y escrituras de los guiones (nav key `script`, la de la ex tab Ads Analyst). */
const G_ANALYST: Gating = { tab: 'script', rolMinimo: 'admin' };
/** Lo que mueve plata o crea en la cuenta de Meta. */
const G_META_ADMIN: Gating = { tab: 'ads-manager', integracion: 'meta', rolMinimo: 'admin' };

// `fijoAlRevisar` (15/10/2026): en /mako/revisar el título es el resumen de la campaña, el conjunto o el anuncio de CUANDO SE
// PROPUSO; cambiar el id ahí movía la plata (o borraba) en otro bajo el título del primero (docs/hallazgos-api-mako.md).
/** El Media Buyer (25/10/2026): el admin del negocio, con la tab. Sin `integracion: 'meta'`: se opera también sólo con Zernio. */
const G_MEDIA_BUYER: Gating = { tab: 'ads-manager', rolMinimo: 'admin' };
const P_DECISION: Parametro = { nombre: 'decisionId', tipo: 'string', obligatorio: true, max: 40, fijoAlRevisar: true, descripcion: 'id de la decisión del Media Buyer (de ver_media_buyer).' };

const P_CAMPAIGN: Parametro = { nombre: 'campaignId', tipo: 'string', obligatorio: true, max: 30, fijoAlRevisar: true, descripcion: 'id numérico de la campaña en Meta (de listar_campanas_meta o ver_estado_meta).' };
const P_ADSET: Parametro = { nombre: 'adsetId', tipo: 'string', obligatorio: true, max: 30, fijoAlRevisar: true, descripcion: 'id numérico del conjunto de anuncios en Meta (de listar_conjuntos_meta).' };
const P_AD: Parametro = { nombre: 'adId', tipo: 'string', obligatorio: true, max: 30, fijoAlRevisar: true, descripcion: 'id numérico del anuncio en Meta (de listar_anuncios_meta o ver_rendimiento_anuncios).' };
const P_ESTADO: Parametro = { nombre: 'estado', tipo: 'string', obligatorio: true, enum: ['ACTIVE', 'PAUSED'], descripcion: 'ACTIVE para activar, PAUSED para pausar.' };
const P_AD_ID_GUION: Parametro = { nombre: 'ad_id', tipo: 'string', obligatorio: true, max: 30, descripcion: 'id numérico del anuncio en Meta (de listar_guiones_analizados).' };

export const DEFS: readonly OperacionDef[] = [
  // ═══════════════════════════ LECTURAS — Ads Manager ═══════════════════════════
  {
    id: 'listar_campanas_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Campañas con gasto en 30 días',
    descripcion: 'Lista las campañas de Meta Ads con datos sincronizados en los ÚLTIMOS 30 DÍAS: id, nombre y gasto de ese período en la moneda de la cuenta (el campo lleva su nombre: `gasto_usd`, `gasto_mxn`…) y, si la cuenta no cobra en dólares y hay tasa, su equivalente en USD a un tipo de cambio fijo del código. Trae la ventana de fechas exacta: no es el gasto histórico ni el estado en vivo (una campaña pausada o creada hoy no aparece; para eso usa ver_estado_meta). Úsala para conseguir el id de una campaña antes de proponer renombrarla, cambiar su presupuesto o pausarla/activarla.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis',
    gating: { tab: 'ads-manager', rolMinimo: 'admin' },
  },
  {
    id: 'ver_estado_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Estado en vivo de Meta Ads',
    descripcion: 'El estado OPERATIVO en vivo de la cuenta de Meta Ads, leído en el momento: la cuenta (activa, saldo impago, deshabilitada; moneda; si la entrega está frenada), un resumen (anuncios activos, en aprendizaje, en revisión, pausados, rechazados) y cada campaña con su estado efectivo, semáforo, objetivo, presupuesto diario y cuántos conjuntos y anuncios tiene. Úsala para «¿qué campañas tengo activas?», «¿cuánto presupuesto diario tengo puesto?». No trae rendimiento (gasto, leads): para eso ver_rendimiento_anuncios.',
    parametros: [
      { nombre: 'soloActivas', tipo: 'boolean', descripcion: 'true = solo campañas con estado efectivo ACTIVE. Default: todas.' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'ver_salud_cuenta_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Salud de la cuenta publicitaria',
    descripcion: 'Solo la cuenta publicitaria de Meta, en una llamada: estado (Activa, Saldo impago, Deshabilitada, En revisión…), motivo de deshabilitación, saldo adeudado, gastado histórico y tope de gasto (en la moneda de la cuenta), moneda, zona horaria, país, semáforo y si la entrega está frenada. Úsala para «¿Meta está entregando?», «¿debo dinero en Meta?», y antes de recomendar activar algo.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    // La misma cuenta que el modal «Calcular presupuesto» del Ads Manager (lib/calculadora-presupuesto-ads.ts, pura): no lee
    // Meta ni la base. Sin HTTP: es un consejo para una persona, no un dato para un sistema.
    id: 'calcular_presupuesto_anuncios', area: 'ads', tipo: 'lectura',
    titulo: 'Cuánto testear con un presupuesto',
    descripcion: 'Con un presupuesto de anuncios, cuántos avatares y funcionalidades (ángulos) se pueden testear con datos suficientes y cómo: matriz en una semana, dos rondas (avatares y después funcionalidades) o una sola dimensión. Devuelve cuánto por anuncio por día y por cuántos días, lo que queda para escalar al ganador, si la escala sale de la fase de aprendizaje de Meta (50 resultados en 7 días) y las ventas esperadas. El mínimo para decidir es el del panel Recon (10 resultados por ángulo). Y cuántas LANDINGS paga el presupuesto, con el piso de US$500 por landing: con menos contesta que NO alcanza, con lo que falta, en vez de repartirlo más fino (criterio de Martín del 30/10/2026). Úsala cuando pregunten «¿cuánto invierto?», «¿cuántos anuncios pruebo con X dólares?» o «¿testeo avatares o funcionalidades?». No lee Meta: si no te dan el costo por resultado, pídelo o tómalo de ver_rendimiento_anuncios.',
    parametros: [
      { nombre: 'presupuesto', tipo: 'number', obligatorio: true, minimo: 1, descripcion: 'Lo que hay para pautar en toda la ventana, en dólares.' },
      { nombre: 'dias', tipo: 'number', entero: true, obligatorio: true, minimo: 1, maximo: 365, descripcion: 'Días de pauta.' },
      { nombre: 'costoPorResultado', tipo: 'number', obligatorio: true, minimo: 0.01, descripcion: 'Lo que cuesta un resultado del evento al que optimiza la campaña (CPL o CPA), en dólares.' },
      { nombre: 'evento', tipo: 'string', enum: ['lead', 'venta'], descripcion: 'lead = lead, registro o conversación iniciada (default); venta = compra.' },
      { nombre: 'ticket', tipo: 'number', obligatorio: true, minimo: 0.01, descripcion: 'Lo que deja una venta, en dólares.' },
      { nombre: 'cierre', tipo: 'number', minimo: 0.001, maximo: 100, descripcion: 'Sólo con evento lead: de cada 100 resultados, cuántos compran (admite decimales).' },
      { nombre: 'avatares', tipo: 'number', entero: true, minimo: 1, maximo: 50, descripcion: 'Cuántos avatares tiene armados. Default 3.' },
      { nombre: 'funcionalidades', tipo: 'number', entero: true, minimo: 1, maximo: 50, descripcion: 'Cuántas funcionalidades, razones u ofertas tiene para mostrar. Default 3.' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: G_COACH,
  },
  {
    id: 'listar_conjuntos_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Conjuntos de anuncios en vivo',
    descripcion: 'Los conjuntos de anuncios de una campaña (o de toda la cuenta) leídos en vivo de Meta: id, nombre, estado efectivo, semáforo, presupuesto diario y restante (moneda de la cuenta) y fase de aprendizaje (en aprendizaje, limitado, completado). Úsala para saber qué conjunto pausar, cuál está en aprendizaje limitado o para conseguir el adsetId antes de otra operación.',
    parametros: [
      { nombre: 'campaignId', tipo: 'string', max: 30, descripcion: 'id numérico de la campaña. Sin él, los conjuntos de toda la cuenta.' },
      { nombre: 'semaforo', tipo: 'string', enum: ['verde', 'ambar', 'rojo', 'gris'], descripcion: 'filtra por semáforo (rojo = con problemas, gris = pausado).' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'listar_anuncios_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Anuncios de Meta en vivo',
    descripcion: 'Los anuncios leídos en vivo de Meta, de un conjunto, de una campaña o de toda la cuenta: id, nombre, conjunto, estado efectivo (activo, pausado por campaña o conjunto, en revisión, rechazado) y sus problemas explicados en español. Úsala para conseguir el adId antes de leer sus textos o proponer un cambio, o para saber cuáles están en revisión.',
    parametros: [
      { nombre: 'adsetId', tipo: 'string', max: 30, descripcion: 'id numérico del conjunto.' },
      { nombre: 'campaignId', tipo: 'string', max: 30, descripcion: 'id numérico de la campaña (todos sus conjuntos).' },
      { nombre: 'semaforo', tipo: 'string', enum: ['verde', 'ambar', 'rojo', 'gris'], descripcion: 'filtra por semáforo.' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'listar_anuncios_con_problemas_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Anuncios rechazados o retenidos',
    descripcion: 'Los anuncios con semáforo rojo (rechazados, con problemas, falta información de pago) con el motivo de Meta traducido al español y, si es la aprobación manual de Meta (peer approval, error 2446984), el link exacto al Administrador de anuncios para aprobarlo a mano: no se puede aprobar por API. Úsala cuando pregunten por qué un anuncio no entrega o qué está rechazado.',
    parametros: [
      { nombre: 'campaignId', tipo: 'string', max: 30, descripcion: 'acota a una campaña (id numérico).' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'listar_recomendaciones_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Recomendaciones de Meta y MaKo',
    descripcion: 'Las recomendaciones sobre la cuenta de Meta Ads: las nativas de Meta (de la cuenta y de cada campaña, conjunto o anuncio) y las sugerencias que MaKo deriva del estado en vivo, cada una con título, detalle, prioridad y de dónde viene. Úsala para «¿qué me recomienda Meta?» o «¿qué debería arreglar en mis anuncios?». Meta suele no devolver nada en cuentas nuevas o con poco gasto: eso no es un error.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'ver_rendimiento_anuncios', area: 'ads', tipo: 'lectura',
    titulo: 'Rendimiento por anuncio en un rango',
    descripcion: 'El rendimiento de cada anuncio CON GASTO en un rango de fechas, de la base de MaKo (Meta sincronizado + CRM): gasto en USD derivado, leads que reporta Meta (`leads_meta`), leads que entraron al CRM desde ese anuncio en el rango (`leads_crm`; la diferencia es la fuga de captura), la meta de leads con la que se valida un anuncio (`meta_leads_para_validar`, una vara fija, no un dato del anuncio), agendas que reporta Meta (`agendas_meta`), cierres y cash del CRM de ese anuncio (de cualquier fecha), días corriendo, veredicto Recon (explorando, validada, falso_positivo, apagar, pausada), hook rate, hold rate, CTR, CPL, CPM, frecuencia e impresiones. Ordenado por gasto. Úsala para «¿qué anuncio rinde mejor?», «¿cuál apago?». Los anuncios sin gasto en el rango no aparecen.',
    parametros: [
      { nombre: 'desde', tipo: 'string', max: 10, descripcion: 'YYYY-MM-DD. Default: 29 días antes de hoy (zona del negocio).' },
      { nombre: 'hasta', tipo: 'string', max: 10, descripcion: 'YYYY-MM-DD. Default: hoy (zona del negocio).' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'cuántos anuncios devolver, de mayor a menor gasto (default 25).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: 'ads-manager', rolMinimo: 'admin' }, lenta: true,
  },
  {
    id: 'ver_cuenta_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Moneda, país y zona de la cuenta',
    descripcion: 'Los datos de la cuenta publicitaria que hacen falta para NO adivinar: en qué moneda cobra Meta, el país por defecto de la segmentación (derivado de la zona horaria, no del país fiscal) y la zona horaria. Úsala antes de hablar de montos o de proponer un presupuesto o un público.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'listar_publicos_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Públicos personalizados de la cuenta',
    descripcion: 'Los públicos personalizados (Custom Audiences) de la cuenta de Meta: id, nombre, subtipo y tamaño aproximado (null = Meta no lo dio). Úsala para saber si ya existe un público de retargeting antes de proponer crear otro, o para describir a quién se puede incluir o excluir.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'buscar_intereses_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Buscar intereses de segmentación',
    descripcion: 'Busca intereses de Meta por texto y devuelve los ids REALES que Meta acepta, con tamaño de audiencia y tema (hasta 20). Úsala para convertir el nombre de un interés («bienes raíces») en un id válido antes de hablar de una segmentación.',
    parametros: [
      { nombre: 'q', tipo: 'string', obligatorio: true, max: 100, descripcion: 'texto a buscar, por ejemplo «bienes raíces».' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'buscar_lugares_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Buscar lugares para segmentar',
    descripcion: 'El buscador de lugares de Meta: país, estado o provincia, ciudad, código postal, barrio o municipio, con la clave que Meta acepta. Busca primero dentro del país de la cuenta y después en el mundo (hasta 20). Úsala para convertir «Córdoba capital» o «CP 1425» en un lugar válido.',
    parametros: [
      { nombre: 'q', tipo: 'string', obligatorio: true, max: 100, descripcion: 'texto a buscar, mínimo 2 caracteres.' },
      { nombre: 'pais', tipo: 'string', max: 2, descripcion: 'código ISO-2 del país cuyos lugares van primero (de ver_cuenta_meta).' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'listar_formularios_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Formularios instantáneos de la página',
    descripcion: 'Los formularios de leads (formularios instantáneos) no archivados de la página de Facebook del negocio: id, nombre y estado. Hacen falta para un anuncio en un conjunto que optimiza por formulario. Un error de permisos de Meta NO significa que no haya formularios: la respuesta lo distingue.',
    parametros: [
      { nombre: 'page', tipo: 'string', max: 30, descripcion: 'id numérico de la página (de listar_identidades_meta). Sin él, la página de la conexión.' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'listar_pixeles_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Pixels de la cuenta',
    descripcion: 'Los pixels de Meta de la cuenta publicitaria (id y nombre, hasta 50). Úsala para saber por cuál pixel se mide una conversión web y antes de leer sus eventos activos con listar_eventos_pixel_meta.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'listar_eventos_pixel_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Eventos activos de un pixel',
    descripcion: 'Los nombres de evento que un pixel RECIBIÓ en los últimos 30 días (PageView, Lead, Schedule…). Optimizar por un evento inactivo arruina la entrega. OJO: la lectura devuelve la lista vacía también cuando Meta no contesta, así que una lista vacía no autoriza a afirmar que falta un evento.',
    parametros: [
      { nombre: 'pixel', tipo: 'string', obligatorio: true, max: 30, descripcion: 'id numérico del pixel (de listar_pixeles_meta).' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'listar_conversiones_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Conversiones personalizadas y su regla',
    descripcion: 'Las conversiones personalizadas de la cuenta con lo que Meta dice de cada una: qué cuenta (la regla traducida, por ejemplo «PageView con URL que contiene /gracias»), a qué pixel pertenece, cuándo se disparó por última vez y su estado (activa, inactiva, nunca; null = Meta no dio el dato). Úsala antes de afirmar que algo «ya se mide» o que las «agendas» de Meta son agendas reales.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'listar_identidades_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Páginas e Instagram para publicar',
    descripcion: 'Con qué páginas de Facebook (solo las que pueden anunciar) y qué cuentas de Instagram puede salir un anuncio de esta conexión, cuál es la de la credencial (por defecto) y si hay más de una opción que elegir. Úsala antes de proponer un anuncio o un formulario cuando la conexión maneja varias páginas.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'verificar_ganadores_reusables', area: 'ads', tipo: 'lectura',
    titulo: 'Qué anuncios ganadores se pueden reusar',
    descripcion: 'Para una lista de anuncios, de qué página es el post de cada uno y si la conexión puede publicar reusándolo. Reusar un post de OTRA página es un rechazo seguro de Meta. Si Meta no contesta, no se bloquea nada (puede: true): no poder preguntar no autoriza a descartar. Úsala antes de proponer un anuncio que reusa un ganador.',
    parametros: [
      { nombre: 'ids', tipo: 'string[]', obligatorio: true, max: 50, descripcion: 'ids numéricos de anuncios (de ver_rendimiento_anuncios), hasta 50.' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'listar_motivos_venta_llamada', area: 'ads', tipo: 'lectura',
    datosDeClientes: false,
    titulo: 'Evidencia de venta por llamada',
    descripcion: 'Los hechos verificables por los que este negocio vende por llamada: el canal declarado en el diagnóstico, las entradas del funnel que agendan solas y la pieza de agenda medida en sus landings. Se citan, no se afirman; lista vacía = no hay evidencia. Úsala junto con listar_eventos_pixel_meta para avisar que el pixel no mide la agenda.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: 'ads-manager', rolMinimo: 'admin' },
  },
  {
    id: 'ver_publico_conjunto_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Público actual de un conjunto',
    descripcion: 'La segmentación COMPLETA de un conjunto tal como está en Meta (lugares, edades, géneros, intereses, públicos incluidos y excluidos, plataformas, idiomas, Advantage+), más su nombre y su meta de optimización. Úsala para describir a quién le llega un conjunto.',
    parametros: [P_ADSET],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'ver_textos_anuncio_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Textos y media de un anuncio',
    descripcion: 'El texto principal, título, descripción, botón (CTA), URL de destino o formulario y el media (imagen o video) de un anuncio publicado, más su estado, sus problemas y si se pueden editar sus textos (no se puede si reusa un post existente o es un creativo dinámico). Úsala para leer qué dice un anuncio y antes de proponer_editar_textos_anuncio.',
    parametros: [P_AD],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'ver_datos_campana_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Objetivo y optimización de una campaña',
    descripcion: 'Lo que hay que saber de una campaña existente: objetivo, si el presupuesto es de campaña (CBO) o por conjunto (ABO), la optimización REAL leída de un conjunto hermano, si necesita formulario o conversión, y la conversión heredada. Úsala antes de proponer un presupuesto (CBO o ABO decide dónde se cambia) o de hablar de cómo optimiza.',
    parametros: [P_CAMPAIGN],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'ver_datos_conjunto_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Qué pide un conjunto para anunciar',
    descripcion: 'Nombre y meta de optimización de un conjunto, y si un anuncio nuevo ahí necesita formulario instantáneo (LEAD_GENERATION) o una URL de destino. Úsala antes de proponer_agregar_anuncio.',
    parametros: [P_ADSET],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'verificar_aprobacion_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Anuncios retenidos para aprobación manual',
    descripcion: 'Para una lista de anuncios recién publicados, cuáles están retenidos por la aprobación manual de Meta (peer approval, issue 2446984): no entregan hasta que un admin los apruebe A MANO en el Administrador de anuncios. Devuelve los pendientes con el link exacto. OJO: si Meta no contesta, la lista sale vacía; `leidos` dice cuántos se pudieron leer. Úsala después de publicar, para no decir «listo» en falso. No envía avisos.',
    parametros: [
      { nombre: 'ids', tipo: 'string[]', obligatorio: true, max: 50, descripcion: 'ids numéricos de anuncios, hasta 50.' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'listar_incidentes_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Historial de problemas de Meta',
    descripcion: 'Los incidentes registrados de la cuenta de Meta (y otros servicios): cuándo empezó y terminó cada uno (resuelto null = en curso), severidad, estado, si la entrega estaba frenada y si el problema fue CONFIRMADO por Meta o fue que no se pudo leer. Primero los en curso. Úsala para «¿cuántas veces se cayó la cuenta este mes?» o para explicar una caída de leads.',
    parametros: [
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'máximo de incidentes (default 30).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: 'ads-manager', rolMinimo: 'admin' },
  },
  {
    id: 'ver_base_formulario_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Datos para un formulario nuevo',
    descripcion: 'La web de la página de Facebook (sin parámetros de tracking) y las landings que el negocio ya cargó en MaKo, para prellenar la URL del botón final y la política de privacidad de un formulario instantáneo. Úsala antes de proponer_crear_formulario_meta.',
    parametros: [
      { nombre: 'page', tipo: 'string', max: 30, descripcion: 'id numérico de la página elegida (de listar_identidades_meta).' },
    ],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MANAGER,
  },
  {
    id: 'listar_publicaciones_mako_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Qué publicó MaKo en Meta',
    descripcion: 'El registro de cada publicación hecha desde el asistente de Ads Manager de MaKo (campañas nuevas y lotes de anuncios): nombre, objetivo, estado (creando, publicada, error), el error explicado y los ids de Meta creados. Úsala para «¿qué campañas creé desde MaKo?» o para ver qué quedó creado cuando una publicación falló a medias (lo creado queda en pausa).',
    parametros: [
      { nombre: 'status', tipo: 'string', enum: ['borrador', 'creando', 'publicada', 'error'], descripcion: 'filtra por estado.' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'máximo de filas, más recientes primero (default 20).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: 'ads-manager', rolMinimo: 'admin' },
  },

  // ═══════════════════════════ LECTURAS — Ads Analyst ═══════════════════════════
  {
    id: 'listar_guiones_analizados', area: 'ads', tipo: 'lectura',
    titulo: 'Guiones analizados con sus métricas',
    descripcion: 'Los anuncios que ya tienen análisis de guion Y señal (gasto, leads o agendas), con sus métricas de TODO el histórico: ángulo, avatar, tipo de gancho, formato, duración, hook rate y retención al final (%), CTR, agendas (de Meta), cierres (del CRM), gasto en USD derivado, impresiones, frecuencia, días activos, diagnóstico y gancho sugerido. Ordenados por agendas y gasto. Úsala para «¿qué guion rinde mejor?», «¿qué guion escalar o pausar?». Vacía puede ser «todavía no hay análisis»: mira ver_estado_analisis_guiones.',
    parametros: [
      { nombre: 'angulo', tipo: 'string', max: 60, descripcion: 'filtra por clave de ángulo (de listar_angulos_guion).' },
      { nombre: 'avatar', tipo: 'string', max: 60, descripcion: 'filtra por clave de avatar (de listar_avatares_guion).' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'cuántos guiones devolver (default 30).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ANALYST, lenta: true,
  },
  {
    id: 'ver_ficha_guion', area: 'ads', tipo: 'lectura',
    titulo: 'Detalle de un guion',
    descripcion: 'Un guion por ad_id: los bloques (gancho, contexto, problema, mecanismo, prueba, objeción, oferta, CTA) con su segundo de inicio y la retención estimada que llegó a cada uno, el veredicto de MaKo, el gancho a probar y las métricas del anuncio. La retención por bloque es una ESTIMACIÓN (interpola los cuartiles de Meta; los segundos los estimó la IA): dilo así. Úsala para «¿dónde se me cae la gente en este anuncio?».',
    parametros: [P_AD_ID_GUION],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ANALYST, lenta: true,
  },
  {
    id: 'ver_estado_analisis_guiones', area: 'ads', tipo: 'lectura',
    titulo: 'Cobertura del análisis de guiones',
    descripcion: 'Cuántos guiones están analizados, pendientes, descartados (sin transcript), sin fila de análisis todavía y con error, cuántos se ven en la lista y la fecha del último análisis. Úsala antes de proponer_sincronizar_guiones y para explicar por qué un anuncio no aparece en listar_guiones_analizados.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ANALYST, lenta: true,
  },
  {
    id: 'ver_cuadrante_retencion', area: 'ads', tipo: 'lectura',
    titulo: 'Cuadrante gancho contra retención',
    descripcion: 'Un punto por guion de VIDEO analizado con señal en la ventana: hook rate (% de impresiones que pasan 3 s), retención estimada al último bloque, gasto en USD derivado, impresiones, agendas y su cuadrante: con menos de 8000 impresiones, validar (la muestra no alcanza para recomendar nada); si no, con los umbrales fijos hook 28 % y retención 10 %, escalar, mejorar_gancho, reescribir_cuerpo o repensar. Sin fechas, todo el histórico. Úsala para «¿qué guiones frenan el scroll pero no retienen?».',
    parametros: [
      { nombre: 'desde', tipo: 'string', max: 10, descripcion: 'YYYY-MM-DD, inicio de la ventana. Sin fechas = todo el histórico.' },
      { nombre: 'hasta', tipo: 'string', max: 10, descripcion: 'YYYY-MM-DD, fin de la ventana.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ANALYST, lenta: true,
  },
  {
    id: 'ver_perfil_guiones', area: 'ads', tipo: 'lectura',
    titulo: 'Qué ángulos y ganchos rinden',
    descripcion: 'El perfil estadístico de los guiones analizados, sin gastar IA: distribución de ángulos y el saturado (60 % o más), agendas por cada 1000 USD por ángulo, tags que agendan, hook rate por tipo de gancho, medianas, retención de guiones largos contra cortos, porcentaje sub-testeado, los 3 guiones ejemplares y el anti-ejemplo. Con pocos guiones confiables (`n_confiables`) las tasas son ruido: dilo. Úsala para «¿qué me funciona?».',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ANALYST, lenta: true,
  },
  {
    id: 'listar_angulos_guion', area: 'ads', tipo: 'lectura',
    titulo: 'Vocabulario de ángulos vigente',
    descripcion: 'Los ángulos con los que se clasifican los guiones de este negocio: clave, nombre, color y la descripción que guía a la IA. Si el negocio no definió los suyos, los 5 de fábrica. Úsala antes de corregir el ángulo de un guion o de proponer agregar, editar o quitar un ángulo.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ANALYST,
  },
  {
    id: 'listar_avatares_guion', area: 'ads', tipo: 'lectura',
    titulo: 'Vocabulario de avatares vigente',
    descripcion: 'Los avatares (públicos objetivo) con los que se clasifican los guiones de este negocio: clave, nombre, color y descripción. Vacía si el negocio todavía no definió ninguno: en ese caso la IA no clasifica avatar. Úsala antes de corregir el avatar de un guion.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ANALYST,
  },
  {
    id: 'listar_guiones_valorados', area: 'ads', tipo: 'lectura',
    titulo: 'Guiones nuevos ya valorados',
    descripcion: 'El historial de guiones nuevos valorados en Ads Writer («Analizar guion»), más recientes primero: id, etiqueta, ángulo, tipo de gancho, veredicto, rangos estimados de hook y retención y un extracto del guion. Úsala para «¿qué dijo MaKo del guion que probé ayer?» o para conseguir el id antes de proponer_borrar_guion_valorado.',
    parametros: [
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'cuántos traer (default 20).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ANALYST,
  },
  {
    id: 'ver_transcript_anuncio', area: 'ads', tipo: 'lectura',
    datosDeClientes: false,
    titulo: 'Transcripción de un anuncio',
    descripcion: 'El texto literal de un anuncio tal como lo transcribió MaKo desde Meta (o el texto leído de la imagen), con sus secciones, idioma, duración, tipo (video o imagen), estado y el error si falló (sin_video, muy_grande, error). «sin_video» puede ser que Meta no devolvió el video, no que no lo tenga. Úsala para «¿qué dice exactamente este anuncio?» o para explicar por qué no tiene análisis.',
    parametros: [P_AD_ID_GUION],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ANALYST,
  },
  {
    id: 'valorar_guion_nuevo', area: 'ads', tipo: 'lectura',
    titulo: 'Valorar un guion que no corrió',
    descripcion: 'La IA compara un guion NUEVO (que todavía no corrió en Meta) contra el perfil real de la cuenta: clasificación, bloques, punto de fuga, patrones que cumple y que pierde, veredicto (escalar-candidato, mejorar-gancho, reescribir-cuerpo, repensar-angulo, promesa-pero-validar) con rangos ESTIMADOS de hook y retención, reescrituras y plan de validación. No lo guarda en el historial de la pantalla. Úsala cuando el dueño pega un guion y pregunta «¿lo publico?». Tarda y gasta IA: no la repitas con el mismo texto.',
    parametros: [
      { nombre: 'guion', tipo: 'string', obligatorio: true, max: 6000, descripcion: 'el guion completo, mínimo 80 caracteres.' },
      { nombre: 'dur', tipo: 'number', entero: true, minimo: 5, maximo: 600, descripcion: 'duración estimada del video en segundos; sin ella los tiempos de los bloques no tienen techo.' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'ia', gating: G_ANALYST, lenta: true,
  },

  // ═══════════════════════════ ACCIONES — Ads Manager (chat) ═════════════════════
  {
    id: 'proponer_estado_campana', plata: true, area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Pausar o activar una campaña',
    descripcion: 'PROPONE pausar o activar una campaña de Meta Ads; queda pendiente de confirmación y NO se ejecuta hasta el «sí». Activar enciende el gasto del presupuesto configurado, pero NO enciende los conjuntos ni los anuncios pausados por su cuenta: revísalos con listar_conjuntos_meta y listar_anuncios_meta. Consigue el campaignId con listar_campanas_meta o ver_estado_meta.',
    escribe: 'cambia el status de la campaña en Meta (POST /{id} status); nada en la base',
    parametros: [P_CAMPAIGN, P_ESTADO],
    canales: TODOS, costo: 'externo', gating: G_META_ADMIN, tipoPendiente: 'meta_estado',
  },
  {
    id: 'proponer_renombrar_campana', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Renombrar una campaña',
    descripcion: 'PROPONE renombrar una campaña de Meta Ads; queda pendiente de confirmación y NO se ejecuta hasta el «sí». Si la campaña usa la nomenclatura con código (NNN.SS.x), conserva el código como primera parte del nombre: el Ads Manager lo lee de ahí. Consigue el campaignId con listar_campanas_meta.',
    escribe: 'cambia el nombre de la campaña en Meta y lo propaga a las métricas guardadas de esa campaña',
    parametros: [P_CAMPAIGN, { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 400, descripcion: 'nombre nuevo, no vacío.' }],
    canales: TODOS, costo: 'externo', gating: G_META_ADMIN, tipoPendiente: 'meta_nombre',
  },
  {
    id: 'proponer_estado_conjunto', plata: true, area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Pausar o activar un conjunto',
    descripcion: 'PROPONE pausar o activar UN conjunto de anuncios de Meta; queda pendiente de confirmación. Activar enciende su gasto (o su parte del presupuesto de campaña). Activar un conjunto dentro de una campaña pausada no lo pone a entregar. Consigue el adsetId con listar_conjuntos_meta.',
    escribe: 'cambia el status del conjunto en Meta (POST /{id} status); nada en la base',
    parametros: [P_ADSET, P_ESTADO],
    canales: TODOS, costo: 'externo', gating: G_META_ADMIN,
  },
  {
    id: 'proponer_estado_anuncio', plata: true, area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Pausar o activar un anuncio',
    descripcion: 'PROPONE pausar o activar UN anuncio de Meta; queda pendiente de confirmación. Activarlo lo pone a competir por el presupuesto de su conjunto; si el conjunto o la campaña están pausados, no entrega. Consigue el adId con listar_anuncios_meta.',
    escribe: 'cambia el status del anuncio en Meta (POST /{id} status); nada en la base',
    parametros: [P_AD, P_ESTADO],
    canales: TODOS, costo: 'externo', gating: G_META_ADMIN,
  },
  {
    id: 'proponer_renombrar_entidad_meta', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Renombrar un conjunto o anuncio',
    descripcion: 'PROPONE renombrar un conjunto o un anuncio de Meta; queda pendiente de confirmación. Para campañas usa proponer_renombrar_campana. Conserva el código de la nomenclatura (NNN.SS.x) si el nombre actual lo tiene.',
    escribe: 'cambia el nombre en Meta y lo propaga a las métricas guardadas de esa entidad',
    parametros: [
      { nombre: 'nivel', tipo: 'string', obligatorio: true, enum: ['adset', 'ad'], descripcion: 'adset = conjunto, ad = anuncio.' },
      { nombre: 'id', tipo: 'string', obligatorio: true, max: 30, descripcion: 'id numérico del conjunto o del anuncio.' },
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 400, descripcion: 'nombre nuevo, no vacío.' },
    ],
    canales: TODOS, costo: 'externo', gating: G_META_ADMIN,
  },

  // ═══════════════════════════ ACCIONES — Ads Manager (pantalla) ════════════════
  {
    id: 'proponer_presupuesto_campana', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Cambiar el presupuesto de una campaña',
    descripcion: 'PROPONE cambiar el presupuesto DIARIO de una campaña de Meta Ads con presupuesto de campaña (CBO). Mueve dinero real: se confirma en una pantalla, nunca por el chat. El monto va en la MONEDA DE LA CUENTA de Meta (mírala con ver_cuenta_meta; no siempre es MXN). Se rechaza más de 10 veces el presupuesto actual, o si el actual es 0: eso se cambia desde el Ads Manager. Si la campaña reparte el presupuesto por conjunto (ABO), usa proponer_presupuesto_conjunto.',
    escribe: 'cambia daily_budget de la campaña en Meta (monto × 100, en centavos de la moneda de la cuenta)',
    parametros: [
      P_CAMPAIGN,
      { nombre: 'montoMxn', tipo: 'number', obligatorio: true, minimo: 1, descripcion: 'presupuesto diario nuevo en la moneda de la cuenta de Meta (el nombre dice MXN por compatibilidad; si la cuenta cobra en USD, el número es USD).' },
    ],
    canales: TODOS, costo: 'dinero',
    gating: G_META_ADMIN, tipoPendiente: 'meta_presupuesto',
  },
  {
    id: 'proponer_presupuesto_conjunto', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Cambiar el presupuesto de un conjunto',
    descripcion: 'PROPONE cambiar el presupuesto DIARIO de un conjunto de anuncios con presupuesto propio (ABO). Mueve dinero real: se confirma en una pantalla. El monto va en la MONEDA DE LA CUENTA de Meta (ver_cuenta_meta). Se rechaza más de 10 veces el presupuesto actual, o si el actual es 0. Si el presupuesto es de campaña (CBO), usa proponer_presupuesto_campana.',
    escribe: 'cambia daily_budget del conjunto en Meta (monto × 100, en centavos de la moneda de la cuenta)',
    parametros: [
      P_ADSET,
      { nombre: 'montoMonedaCuenta', tipo: 'number', obligatorio: true, minimo: 1, descripcion: 'presupuesto diario nuevo en la moneda de la cuenta de Meta.' },
    ],
    canales: TODOS, costo: 'dinero', gating: G_META_ADMIN,
  },
  {
    id: 'proponer_eliminar_entidad_meta', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Eliminar una entidad pausada de Meta',
    descripcion: 'PROPONE eliminar en Meta una campaña, un conjunto o un anuncio que esté PAUSADO (si no lo está, se rechaza). Borrar una campaña borra sus conjuntos y anuncios, y se pierden el historial y el aprendizaje de Meta de esa entidad; las métricas guardadas en MaKo quedan. No se puede deshacer: se confirma en una pantalla.',
    escribe: 'DELETE /{id} en Meta (en cascada); nada en la base',
    parametros: [
      { nombre: 'nivel', tipo: 'string', obligatorio: true, enum: ['campaign', 'adset', 'ad'], fijoAlRevisar: true, descripcion: 'campaign = campaña, adset = conjunto, ad = anuncio.' },
      { nombre: 'id', tipo: 'string', obligatorio: true, max: 30, fijoAlRevisar: true, descripcion: 'id numérico de la entidad; tiene que estar pausada.' },
    ],
    canales: TODOS, costo: 'externo', gating: G_META_ADMIN,
  },
  {
    id: 'proponer_agregar_anuncio', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Agregar un anuncio a un conjunto',
    descripcion: 'PROPONE crear un anuncio EN PAUSA dentro de un conjunto existente: reusando el post de un anuncio ganador (fuente existing) o con una imagen o video YA subidos a la cuenta (fuente upload, con su image_hash o video_id) y textos nuevos. Reusar un post conserva sus textos: con existing no se mandan textos, botón ni URL. Se revisa y confirma en una pantalla. Antes: ver_datos_conjunto_meta (si pide formulario, lead_form_id es obligatorio; si no, destination_url) y, para reusar, verificar_ganadores_reusables. Reintentar crea un duplicado.',
    escribe: 'crea un creativo y un anuncio en PAUSA en la cuenta de Meta del negocio',
    parametros: [
      P_ADSET,
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 200, descripcion: 'nombre del anuncio.' },
      { nombre: 'fuente', tipo: 'string', obligatorio: true, enum: ['existing', 'upload'], descripcion: 'existing = reusar el post de un anuncio existente; upload = imagen o video ya subido a la cuenta.' },
      { nombre: 'source_ad_id', tipo: 'string', max: 30, descripcion: 'solo existing: id numérico del anuncio cuyo post se reusa.' },
      { nombre: 'media_type', tipo: 'string', enum: ['image', 'video'], descripcion: 'solo upload: tipo de media.' },
      { nombre: 'image_hash', tipo: 'string', max: 100, descripcion: 'solo upload con imagen: el hash de la imagen en la cuenta.' },
      { nombre: 'video_id', tipo: 'string', max: 30, descripcion: 'solo upload con video: id del video en la cuenta.' },
      { nombre: 'primary_text', tipo: 'string', max: 2000, descripcion: 'solo upload: texto principal (reusar un post conserva los suyos).' },
      { nombre: 'headline', tipo: 'string', max: 255, descripcion: 'solo upload: título.' },
      { nombre: 'description', tipo: 'string', max: 255, descripcion: 'solo upload: descripción.' },
      { nombre: 'cta_type', tipo: 'string', enum: ['LEARN_MORE', 'SIGN_UP', 'SUBSCRIBE', 'GET_OFFER', 'BOOK_TRAVEL', 'CONTACT_US', 'APPLY_NOW', 'DOWNLOAD', 'GET_QUOTE', 'SEE_MORE', 'WATCH_MORE', 'SHOP_NOW', 'MESSAGE_PAGE', 'WHATSAPP_MESSAGE', 'NO_BUTTON'], descripcion: 'solo upload: botón del anuncio.' },
      { nombre: 'destination_url', tipo: 'string', max: 1000, descripcion: 'solo upload: URL de destino (landing), exacta con https.' },
      { nombre: 'lead_form_id', tipo: 'string', max: 30, descripcion: 'solo upload: id del formulario instantáneo (de listar_formularios_meta) si el conjunto optimiza por formulario.' },
    ],
    canales: TODOS, costo: 'dinero', gating: G_META_ADMIN,
  },
  {
    // «Súbeme este anuncio» desde el grupo (29/10/2026, la llamada con Thiago; lib/anuncio-desde-archivo.ts). Detrás de
    // ZERNIO_ANUNCIOS_PROBADO: con la bandera apagada, contesta que falta la prueba y no baja nada.
    id: 'proponer_anuncio_desde_archivo', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Subir un anuncio desde un archivo',
    descripcion: 'PROPONE crear un anuncio EN PAUSA dentro de un conjunto existente con un archivo NUEVO: la imagen o el video que mandaron en el mensaje (origen mensaje) o el que está en un link de Google Drive o un link https directo (origen link). MaKo baja el archivo y lo guarda; al aprobarlo en la pantalla de revisión, el anuncio se crea por Zernio, en pausa. Sólo con los anuncios por Zernio probados y conectados; si no, lo dice.',
    escribe: 'guarda el archivo y, al aprobarlo, crea un anuncio EN PAUSA por Zernio en la cuenta de Meta del negocio',
    parametros: [
      P_ADSET,
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 200, descripcion: 'nombre del anuncio.' },
      { nombre: 'origen', tipo: 'string', obligatorio: true, enum: ['mensaje', 'link'], descripcion: 'mensaje = la imagen o el video que mandaron en este mensaje; link = el archivo de un link (Google Drive o https directo).' },
      { nombre: 'link', tipo: 'string', max: 2000, descripcion: 'solo origen link: el link del archivo (compartido con «cualquiera con el enlace» si es de Drive).' },
      { nombre: 'primary_text', tipo: 'string', obligatorio: true, max: 2000, descripcion: 'texto principal del anuncio.' },
      { nombre: 'headline', tipo: 'string', max: 255, descripcion: 'título.' },
      { nombre: 'cta_type', tipo: 'string', enum: ['LEARN_MORE', 'SIGN_UP', 'SUBSCRIBE', 'GET_OFFER', 'CONTACT_US', 'APPLY_NOW', 'SHOP_NOW', 'MESSAGE_PAGE', 'WHATSAPP_MESSAGE', 'NO_BUTTON'], descripcion: 'el botón.' },
      { nombre: 'destination_url', tipo: 'string', max: 1000, descripcion: 'URL de destino (landing), exacta con https.' },
    ],
    // Sin HTTP: el archivo es el del MENSAJE (o un link pegado en el grupo); por la API, proponer_agregar_anuncio con el creativo ya subido.
    canales: SIN_HTTP, costo: 'dinero', gating: G_META_ADMIN,
  },
  {
    id: 'proponer_editar_textos_anuncio', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Editar los textos de un anuncio',
    descripcion: 'PROPONE cambiar textos de un anuncio publicado (texto principal, título, descripción, botón o URL de destino); los campos que no se mandan se conservan. Meta crea un creativo nuevo y vuelve a revisar el anuncio: deja de entregar mientras tanto y pierde las interacciones del post anterior. Se confirma en una pantalla. Antes: ver_textos_anuncio_meta (dice si es editable).',
    escribe: 'crea un creativo nuevo en Meta y apunta el anuncio a él (vuelve a revisión)',
    parametros: [
      P_AD,
      { nombre: 'primary_text', tipo: 'string', max: 2000, descripcion: 'texto principal nuevo.' },
      { nombre: 'headline', tipo: 'string', max: 255, descripcion: 'título nuevo.' },
      { nombre: 'description', tipo: 'string', max: 255, descripcion: 'descripción nueva.' },
      { nombre: 'cta_type', tipo: 'string', enum: ['LEARN_MORE', 'SIGN_UP', 'SUBSCRIBE', 'GET_OFFER', 'BOOK_TRAVEL', 'CONTACT_US', 'APPLY_NOW', 'DOWNLOAD', 'GET_QUOTE', 'SEE_MORE', 'WATCH_MORE', 'SHOP_NOW', 'MESSAGE_PAGE', 'WHATSAPP_MESSAGE', 'NO_BUTTON'], descripcion: 'botón nuevo.' },
      { nombre: 'destination_url', tipo: 'string', max: 1000, descripcion: 'URL de destino nueva, exacta con https.' },
    ],
    canales: TODOS, costo: 'dinero', gating: G_META_ADMIN,
  },
  {
    id: 'proponer_editar_publico_conjunto', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Editar el público de un conjunto',
    descripcion: 'PROPONE cambiar a quién le llega un conjunto que ya corre: género, edades, públicos personalizados, ubicaciones (Facebook, Instagram…), Advantage+ y agregar un punto del mapa con un radio (un pin). Lo que no se manda NO se toca: intereses, idiomas, exclusiones y los lugares que ya tenía se conservan (MaKo lee el público de Meta y cambia sólo lo pedido). Cambiar el público manda el conjunto a revisión y reinicia su aprendizaje. Se confirma en una pantalla. Antes: ver_publico_conjunto_meta.',
    escribe: 'reescribe la segmentación del conjunto en Meta (vuelve a revisión y reinicia el aprendizaje)',
    parametros: [
      P_ADSET,
      { nombre: 'genero', tipo: 'string', enum: ['all', 'h', 'm'], descripcion: 'all = todos, h = hombres, m = mujeres.' },
      { nombre: 'edadMin', tipo: 'number', entero: true, minimo: 18, maximo: 65, descripcion: 'edad mínima (18 a 65).' },
      { nombre: 'edadMax', tipo: 'number', entero: true, minimo: 18, maximo: 65, descripcion: 'edad máxima (18 a 65; 65 es «65 o más»).' },
      { nombre: 'publicos', tipo: 'string[]', max: 50, vaciaEsValor: true, descripcion: 'ids de los públicos personalizados (de listar_publicos_meta): la lista ENTERA nueva; [] los saca.' },
      { nombre: 'ubicaciones', tipo: 'string[]', max: 4, enum: ['facebook', 'instagram', 'audience_network', 'messenger'], descripcion: 'dónde se muestra: la lista entera. Para dejarlas automáticas, usa ubicacionesAutomaticas.' },
      { nombre: 'ubicacionesAutomaticas', tipo: 'boolean', descripcion: 'true = Meta elige las ubicaciones (saca la lista).' },
      { nombre: 'advantage', tipo: 'boolean', descripcion: 'Advantage+ audience: true deja que Meta amplíe el público.' },
      { nombre: 'pinLat', tipo: 'number', minimo: -90, maximo: 90, descripcion: 'para AGREGAR un punto del mapa: latitud (con pinLng).' },
      { nombre: 'pinLng', tipo: 'number', minimo: -180, maximo: 180, descripcion: 'longitud del punto (con pinLat).' },
      { nombre: 'pinRadioKm', tipo: 'number', minimo: 1, maximo: 80, descripcion: 'radio alrededor del punto, en km (default 5).' },
    ],
    canales: TODOS, costo: 'dinero', gating: G_META_ADMIN,
  },
  {
    id: 'proponer_crear_publico_meta', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Crear un público de retargeting',
    descripcion: 'PROPONE crear un público personalizado de retargeting en la cuenta de Meta: personas que interactuaron con la página de Facebook (page), con Instagram (ig), que vieron videos (video) o que dispararon un evento del pixel en la web (pixel), en los últimos N días. Desde MaKo no se borra: queda en la cuenta. Antes: listar_publicos_meta, para no duplicar. Se confirma en una pantalla.',
    escribe: 'crea un Custom Audience en la cuenta de Meta del negocio',
    parametros: [
      { nombre: 'tipo', tipo: 'string', obligatorio: true, enum: ['page', 'ig', 'video', 'pixel'], descripcion: 'fuente del público.' },
      { nombre: 'dias', tipo: 'number', entero: true, minimo: 1, maximo: 365, descripcion: 'ventana de retención en días (default 90). Con tipo pixel, Meta acepta hasta 180.' },
      { nombre: 'evento', tipo: 'string', max: 48, descripcion: 'solo pixel: nombre del evento (default PageView; de listar_eventos_pixel_meta).' },
      { nombre: 'name', tipo: 'string', max: 48, descripcion: 'nombre del público; si no se manda, se genera.' },
    ],
    canales: TODOS, costo: 'externo', gating: G_META_ADMIN,
  },
  {
    id: 'proponer_crear_formulario_meta', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Crear un formulario instantáneo',
    descripcion: 'PROPONE crear un formulario instantáneo de leads en la página de Facebook del negocio: preguntas estándar (nombre, email, teléfono), hasta 5 preguntas propias, si es de mayor intención, la URL de la política de privacidad y la del botón final. Queda publicado en la página y no se borra desde MaKo. Antes: ver_base_formulario_meta para las URLs. Se confirma en una pantalla.',
    escribe: 'crea un formulario (leadgen_forms) en la página de Facebook del negocio',
    parametros: [
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 100, descripcion: 'nombre interno del formulario.' },
      { nombre: 'estandar', tipo: 'string[]', obligatorio: true, enum: ['FULL_NAME', 'EMAIL', 'PHONE'], max: 3, descripcion: 'preguntas que Meta completa con el perfil.' },
      { nombre: 'propias', tipo: 'string[]', max: 5, descripcion: 'preguntas abiertas propias, hasta 5.' },
      { nombre: 'mayorIntencion', tipo: 'boolean', descripcion: 'true = agrega una pantalla para revisar los datos antes de enviar (default false).' },
      { nombre: 'privacidadUrl', tipo: 'string', obligatorio: true, max: 1000, descripcion: 'URL exacta de la política de privacidad (https).' },
      { nombre: 'sitioUrl', tipo: 'string', obligatorio: true, max: 1000, descripcion: 'URL exacta a la que lleva el botón final (https).' },
      { nombre: 'page', tipo: 'string', max: 30, descripcion: 'id numérico de la página (de listar_identidades_meta); sin él, la de la conexión.' },
    ],
    canales: TODOS, costo: 'externo', gating: G_META_ADMIN,
  },

  // ═══════════════════════════ ACCIONES — Ads Analyst ═══════════════════════════
  {
    id: 'proponer_sincronizar_guiones', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Analizar los guiones pendientes',
    descripcion: 'PROPONE correr el análisis de IA sobre los anuncios que ya tienen transcript y todavía no tienen análisis (y reintentar los que quedaron en error), UNO por confirmación y en segundo plano: el resultado no vuelve en la respuesta y por la API la plataforma puede cortarlo al minuto (entonces no escribe nada y lo retoma el proceso diario). No vuelve a analizar lo ya hecho. Úsala cuando ver_estado_analisis_guiones muestre pendientes y el dueño los quiera ver ya.',
    escribe: 'crea o actualiza filas de script_analyses (una por guion analizado)',
    parametros: [],
    canales: TODOS, costo: 'ia', gating: G_ANALYST, lenta: true,
  },
  {
    id: 'proponer_reanalizar_guion', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Volver a analizar un guion',
    descripcion: 'PROPONE volver a correr la IA sobre el transcript de UN anuncio y reemplazar su análisis (ángulo, avatar, bloques, diagnóstico); las correcciones manuales de ángulo y avatar se conservan, el análisis anterior no. Corre en segundo plano: el resultado se ve después con ver_ficha_guion, y por la API la plataforma puede cortarlo al minuto (entonces queda el análisis anterior). Úsala cuando el dueño dice que la clasificación o los bloques están mal. Si el anuncio no tiene transcript, falla con un error claro.',
    escribe: 'reemplaza la fila de script_analyses de ese anuncio',
    parametros: [P_AD_ID_GUION],
    canales: TODOS, costo: 'ia', gating: G_ANALYST, lenta: true,
  },
  {
    id: 'proponer_corregir_angulo_guion', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Corregir el ángulo de un guion',
    descripcion: 'PROPONE fijar a mano el ángulo de un anuncio analizado (sobrevive a los re-análisis) o devolverlo a la clasificación de la IA con «ia». La clave tiene que existir en listar_angulos_guion. Úsala cuando el dueño dice «ese anuncio no es de dolor, es testimonio».',
    escribe: 'cambia script_analyses.angle_override de ese anuncio',
    parametros: [
      P_AD_ID_GUION,
      { nombre: 'angle', tipo: 'string', obligatorio: true, max: 60, descripcion: 'clave del ángulo (de listar_angulos_guion), o «ia» para volver a la clasificación automática.' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_ANALYST,
  },
  {
    id: 'proponer_corregir_avatar_guion', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Corregir el avatar de un guion',
    descripcion: 'PROPONE fijar a mano el avatar (público objetivo) de un anuncio analizado (sobrevive a los re-análisis) o devolverlo a la IA con «ia». La clave tiene que existir en listar_avatares_guion; si el negocio no definió avatares, no aplica.',
    escribe: 'cambia script_analyses.avatar_override de ese anuncio',
    parametros: [
      P_AD_ID_GUION,
      { nombre: 'avatar', tipo: 'string', obligatorio: true, max: 60, descripcion: 'clave del avatar (de listar_avatares_guion), o «ia» para volver a la clasificación automática.' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_ANALYST,
  },
  {
    id: 'proponer_borrar_guion_valorado', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Borrar un guion valorado',
    descripcion: 'PROPONE borrar un guion del historial de guiones nuevos valorados, con toda su valoración de IA (solo ese registro; no toca anuncios ni análisis). No se puede deshacer: se confirma en una pantalla. Consigue el id con listar_guiones_valorados.',
    escribe: 'borra la fila de script_drafts',
    parametros: [{ nombre: 'id', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id del guion valorado (de listar_guiones_valorados).' }],
    canales: TODOS, costo: 'gratis', gating: G_ANALYST,
  },
  {
    id: 'proponer_agregar_angulo', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Agregar un ángulo al vocabulario',
    descripcion: 'PROPONE sumar un ángulo al vocabulario de guiones del negocio (nombre, descripción que guía a la IA, color). Aplica a los próximos análisis; no reclasifica lo ya analizado. Se confirma en una pantalla. Antes: listar_angulos_guion, para no duplicar.',
    escribe: 'reescribe app_settings.script_angles con la lista actual más el nuevo',
    parametros: [
      { nombre: 'label', tipo: 'string', obligatorio: true, max: 60, descripcion: 'nombre visible; la clave se deriva de él.' },
      { nombre: 'desc', tipo: 'string', max: 300, descripcion: 'cuándo aplica este ángulo: es lo que lee la IA para clasificar.' },
      { nombre: 'color', tipo: 'string', max: 7, descripcion: 'color #RRGGBB del chip; si no es válido, gris.' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_ANALYST,
  },
  {
    id: 'proponer_editar_angulo', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Editar un ángulo del vocabulario',
    descripcion: 'PROPONE cambiar el nombre, la descripción o el color de un ángulo existente CONSERVANDO su clave (los guiones ya clasificados lo siguen mostrando). Cambiar la descripción cambia cómo clasifica la IA en los próximos análisis. Se confirma en una pantalla.',
    escribe: 'reescribe app_settings.script_angles con ese ángulo cambiado',
    parametros: [
      { nombre: 'key', tipo: 'string', obligatorio: true, max: 60, descripcion: 'clave del ángulo (de listar_angulos_guion).' },
      { nombre: 'label', tipo: 'string', max: 60, descripcion: 'nombre nuevo.' },
      { nombre: 'desc', tipo: 'string', max: 300, descripcion: 'descripción nueva.' },
      { nombre: 'color', tipo: 'string', max: 7, descripcion: 'color nuevo #RRGGBB.' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_ANALYST,
  },
  {
    id: 'proponer_borrar_angulo', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Quitar un ángulo del vocabulario',
    descripcion: 'PROPONE quitar un ángulo del vocabulario de guiones. Los anuncios ya clasificados con él conservan la clave hasta re-analizarse. La lista no puede quedar vacía. Volver a agregarlo con el mismo nombre recupera la clave pero no su descripción ni su color (quedan escritos en el resumen). Se confirma en una pantalla.',
    escribe: 'reescribe app_settings.script_angles sin ese ángulo',
    parametros: [{ nombre: 'key', tipo: 'string', obligatorio: true, max: 60, descripcion: 'clave del ángulo a quitar (de listar_angulos_guion).' }],
    canales: TODOS, costo: 'gratis', gating: G_ANALYST,
  },
  {
    id: 'proponer_agregar_avatar', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Agregar un avatar al vocabulario',
    descripcion: 'PROPONE sumar un avatar (público objetivo) al vocabulario de guiones: habilita que la IA clasifique avatar en los próximos análisis. Conviene que sea segmentable en Meta (rubro, tamaño de empresa, ubicación). Se confirma en una pantalla. Antes: listar_avatares_guion.',
    escribe: 'reescribe app_settings.script_avatares con la lista actual más el nuevo',
    parametros: [
      { nombre: 'label', tipo: 'string', obligatorio: true, max: 60, descripcion: 'nombre visible, por ejemplo «Dueño de clínica».' },
      { nombre: 'desc', tipo: 'string', max: 300, descripcion: 'a quién le habla: lo lee la IA.' },
      { nombre: 'color', tipo: 'string', max: 7, descripcion: 'color #RRGGBB del chip.' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_ANALYST,
  },
  {
    id: 'proponer_editar_avatar', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Editar un avatar del vocabulario',
    descripcion: 'PROPONE cambiar el nombre, la descripción o el color de un avatar existente conservando su clave. Cambiar la descripción cambia cómo clasifica la IA en los próximos análisis. Se confirma en una pantalla.',
    escribe: 'reescribe app_settings.script_avatares con ese avatar cambiado',
    parametros: [
      { nombre: 'key', tipo: 'string', obligatorio: true, max: 60, descripcion: 'clave del avatar (de listar_avatares_guion).' },
      { nombre: 'label', tipo: 'string', max: 60, descripcion: 'nombre nuevo.' },
      { nombre: 'desc', tipo: 'string', max: 300, descripcion: 'descripción nueva.' },
      { nombre: 'color', tipo: 'string', max: 7, descripcion: 'color nuevo #RRGGBB.' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_ANALYST,
  },
  {
    id: 'proponer_borrar_avatar', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Quitar un avatar del vocabulario',
    descripcion: 'PROPONE quitar un avatar del vocabulario de guiones. Si la lista queda vacía, la IA deja de clasificar avatar en todos los análisis futuros. Los guiones ya clasificados conservan la clave hasta re-analizarse. Volver a agregarlo no recupera su descripción. Se confirma en una pantalla.',
    escribe: 'reescribe app_settings.script_avatares sin ese avatar',
    parametros: [{ nombre: 'key', tipo: 'string', obligatorio: true, max: 60, descripcion: 'clave del avatar a quitar (de listar_avatares_guion).' }],
    canales: TODOS, costo: 'gratis', gating: G_ANALYST,
  },

  // ═══════════════════════════ El Media Buyer (25/10/2026) ═══════════════════════
  // La tab /ads-manager es el Media Buyer (lib/media-buyer/*): MaKo mira la cuenta una vez por día y deja DECISIONES (subir o
  // bajar presupuesto, pausar, prender, variaciones del ganador), cada una con su porqué y su deshacer. Por acá MaKo, el chat,
  // las lee, las lanza, las descarta y las deshace. Lo que mueve plata (lanzar, deshacer, el piloto, los topes) es `pantalla` +
  // `dinero` + admin y NO corre en un flujo (NO_EN_FLUJOS, lib/api-mako/flujo.ts): lo confirma una persona o el piloto
  // automático que el propio negocio prendió. Sin `integracion: 'meta'`: un negocio puede operar sólo con su Zernio.
  {
    id: 'ver_media_buyer', area: 'ads', tipo: 'lectura',
    titulo: 'Ver el Media Buyer',
    descripcion: 'El Media Buyer de la cuenta: si está prendido, su modo (propone o piloto automático), el resultado que busca y su objetivo, los topes, la zona y las fechas de fin, las metas del mes, la cuenta publicitaria, la última vez que miró la cuenta, sus agentes (los cuatro de MaKo con su estado, y los propios del negocio), las alertas de Protect de la última vez que miró, y sus decisiones de 30 días como en la pantalla: abiertas (id, qué propone, quién la firma, por qué y los números), hechas (aplicadas o deshechas, con sus estrellas) y descartadas (con el motivo). Úsala antes de lanzar, descartar, reabrir, calificar o deshacer una decisión.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_MEDIA_BUYER,
  },
  {
    id: 'lanzar_decision_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true, plata: true,
    titulo: 'Lanzar una decisión del Media Buyer',
    descripcion: 'PROPONE lanzar una decisión ABIERTA del Media Buyer (de ver_media_buyer): subir o bajar un presupuesto, pausar, prender, o crear las variaciones del ganador. Se confirma en una pantalla. Al lanzar se relee la cuenta en vivo y se miran los topes del negocio (subida máxima por día, presupuesto máximo de la cuenta, el interruptor): si no pasa, queda frenada con el motivo. Se deshace con deshacer_decision_media_buyer.',
    escribe: 'escribe en Meta (por la Zernio del negocio o su token) y marca la decisión como aplicada en media_buyer_decisiones',
    parametros: [
      P_DECISION,
      { nombre: 'presupuesto', tipo: 'number', minimo: 0.01, descripcion: 'sólo en un cambio de presupuesto: el monto diario a poner en vez del que propuso (moneda de la cuenta). Los topes lo pueden recortar. Cinco veces el de hoy o más no sale; bajarlo 80% o más sí, y la confirmación lo avisa.' },
      { nombre: 'variaciones', tipo: 'string[]', max: 20, descripcion: 'sólo en una decisión de variaciones: los ids de las que se publican (de ver_media_buyer). Sin esto, las que estaban elegidas.' },
    ],
    canales: TODOS, costo: 'dinero', gating: G_MEDIA_BUYER,
  },
  {
    id: 'deshacer_decision_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false, plata: true,
    titulo: 'Deshacer una decisión del Media Buyer',
    descripcion: 'PROPONE deshacer una decisión APLICADA del Media Buyer: devuelve el presupuesto o el estado de antes, o borra los anuncios que creó una variación. Se niega si alguien cambió eso a mano después. Se confirma en una pantalla.',
    escribe: 'escribe el estado anterior en Meta y marca la decisión como deshecha',
    parametros: [P_DECISION],
    canales: TODOS, costo: 'dinero', gating: G_MEDIA_BUYER,
  },
  {
    id: 'descartar_decision_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Descartar una decisión del Media Buyer',
    descripcion: 'PROPONE descartar una decisión abierta del Media Buyer (no se lanza; queda en Descartadas y se puede volver a abrir desde la pantalla). No toca la cuenta de Meta.',
    escribe: 'marca la decisión como descartada en media_buyer_decisiones',
    parametros: [
      { nombre: 'decisionId', tipo: 'string', obligatorio: true, max: 40, descripcion: 'id de la decisión del Media Buyer (de ver_media_buyer).' },
      { nombre: 'motivo', tipo: 'string', max: 300, descripcion: 'por qué no se lanza, en las palabras de la persona.' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_MEDIA_BUYER,
  },
  {
    id: 'reabrir_decision_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Reabrir una decisión del Media Buyer',
    descripcion: 'PROPONE volver a abrir una decisión DESCARTADA o vencida del Media Buyer (de ver_media_buyer): vuelve a Abiertas para lanzarla o descartarla de nuevo. No toca la cuenta de Meta.',
    escribe: 'vuelve a abrir la decisión en media_buyer_decisiones',
    parametros: [P_DECISION],
    canales: TODOS, costo: 'gratis', gating: G_MEDIA_BUYER,
  },
  {
    id: 'calificar_decision_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Calificar una decisión del Media Buyer',
    descripcion: 'PROPONE ponerle de 1 a 5 estrellas a una decisión HECHA del Media Buyer (de ver_media_buyer, en hechas): cuánto sirvió. Es la calificación de la pestaña Hechas. No toca la cuenta de Meta.',
    escribe: 'guarda las estrellas de la decisión en media_buyer_decisiones',
    parametros: [
      P_DECISION,
      { nombre: 'estrellas', tipo: 'number', obligatorio: true, minimo: 1, maximo: 5, descripcion: 'de 1 a 5.' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_MEDIA_BUYER,
  },
  {
    id: 'hooks_al_video_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Hooks del Media Buyer al video',
    descripcion: 'PROPONE llevar los hooks nuevos de una decisión de variaciones de hook del Media Buyer (de un video ganador) al Video Generator, como guiones para filmar sólo el gancho: cada hook con el cuerpo del ganador, en la celda «Hooks del Media Buyer». AI Avatar los ofrece también («Hooks ganadores»), para filmarlos con el avatar del negocio. No publica nada en Meta.',
    escribe: 'agrega guiones en la celda «Hooks del Media Buyer» del Video Generator',
    parametros: [
      P_DECISION,
      { nombre: 'variaciones', tipo: 'string[]', max: 20, descripcion: 'los ids de los hooks a llevar (de ver_media_buyer). Sin esto, los que estaban elegidos.' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_MEDIA_BUYER,
  },
  {
    id: 'analizar_cuenta_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Analizar la cuenta con el Media Buyer',
    descripcion: 'PROPONE que el Media Buyer mire la cuenta ahora (lo hace solo una vez por día) y deje sus decisiones del día. Pedido por esta vía NUNCA lanza nada, aunque el negocio tenga el piloto automático: sólo propone. Las variaciones del ganador las escribe la IA del negocio.',
    escribe: 'agrega decisiones abiertas en media_buyer_decisiones (no escribe en Meta)',
    parametros: [],
    canales: TODOS, costo: 'ia', gating: G_MEDIA_BUYER,
  },
  {
    id: 'modo_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true, plata: true,
    titulo: 'Modo del Media Buyer',
    descripcion: 'PROPONE el modo del Media Buyer: `piloto` (lanza solo sus decisiones, dentro de los topes del negocio), `propone` (cada decisión espera a una persona) o `apagado` (no analiza ni lanza nada). Se confirma en una pantalla: el piloto mueve dinero.',
    escribe: 'cambia modo y encendido en media_buyer_config',
    parametros: [{ nombre: 'modo', tipo: 'string', obligatorio: true, enum: ['piloto', 'propone', 'apagado'], descripcion: 'piloto, propone o apagado.' }],
    canales: TODOS, costo: 'dinero', gating: G_MEDIA_BUYER,
  },
  {
    id: 'topes_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true, plata: true,
    titulo: 'Topes y objetivo del Media Buyer',
    descripcion: 'PROPONE los topes y el objetivo del Media Buyer: cuánto puede subir un presupuesto en un día (%), el presupuesto diario máximo de toda la cuenta (US$), el resultado que optimiza y el costo objetivo por resultado (US$; vacío = lo recomienda MaKo). Sólo cambia lo que se pasa. Se confirma en una pantalla.',
    escribe: 'cambia los topes y el objetivo en media_buyer_config',
    parametros: [
      { nombre: 'subidaMaxPctDia', tipo: 'number', minimo: 0, maximo: 100, descripcion: 'cuánto puede subir un presupuesto en un día, en %.' },
      { nombre: 'presupuestoMaxDia', tipo: 'number', minimo: 1, descripcion: 'presupuesto diario máximo de la cuenta, en US$.' },
      { nombre: 'kpi', tipo: 'string', enum: ['lead', 'agenda', 'venta'], descripcion: 'el resultado que busca.' },
      { nombre: 'objetivo', tipo: 'number', minimo: 0.01, descripcion: 'costo objetivo por resultado, en US$.' },
    ],
    canales: TODOS, costo: 'dinero', gating: G_MEDIA_BUYER,
  },
  {
    id: 'metas_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Metas del mes del Media Buyer',
    descripcion: 'PROPONE las metas del mes del Media Buyer (las «Monthly goals» de sus Ajustes): la caja que se busca en el mes (lo cobrado en el CRM) y el gasto en anuncios previsto del mes, en US$. 0 borra esa meta. Sólo cambia lo que se pasa. No toca la cuenta de Meta.',
    escribe: 'cambia las metas del mes en media_buyer_config',
    parametros: [
      { nombre: 'metaVentasMes', tipo: 'number', minimo: 0, descripcion: 'la caja del mes que se busca, en US$ (0 = sin meta).' },
      { nombre: 'metaGastoMes', tipo: 'number', minimo: 0, descripcion: 'el gasto en anuncios previsto del mes, en US$ (0 = sin meta).' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_MEDIA_BUYER,
  },
  {
    id: 'cuenta_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true, plata: true,
    titulo: 'Cuenta publicitaria del Media Buyer',
    descripcion: 'PROPONE la cuenta publicitaria (act_ y los números) en la que trabaja el Media Buyer, para un negocio que no la tiene en Integraciones (la de Integraciones manda). Vacío = usar la de Integraciones. Se confirma en una pantalla: es la cuenta donde el Media Buyer mueve presupuestos.',
    escribe: 'cambia la cuenta publicitaria en media_buyer_config',
    parametros: [{ nombre: 'cuentaPublicitaria', tipo: 'string', obligatorio: true, max: 40, vaciaEsValor: true, descripcion: 'act_ y los números; vacío = la de Integraciones.' }],
    canales: TODOS, costo: 'dinero', gating: G_MEDIA_BUYER,
  },
  // Las tácticas como automatizaciones (25/10/2026, las «Automation Tactics» de Madgicx; lib/media-buyer/tacticas.ts): lo que
  // muestra /ads-manager/automatizaciones, por la API.
  {
    id: 'ver_automatizaciones_media_buyer', area: 'ads', tipo: 'lectura',
    titulo: 'Ver las automatizaciones del Media Buyer',
    descripcion: 'Las tácticas del Media Buyer como automatizaciones (Stop Loss, Calidad de leads, Sunsetting, Surf, Revive, Ganador): de cada una, su estado (apagada, propone o automática), sus umbrales con el valor recomendado, las campañas que cubre, cuántas recomendaciones hizo en 30 días y la última vez. Úsala antes de automatizacion_media_buyer.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_MEDIA_BUYER,
  },
  {
    id: 'ver_campanas_media_buyer', area: 'ads', tipo: 'lectura',
    titulo: 'Campañas que ve el Media Buyer',
    descripcion: 'Lo que el Media Buyer ve de la cuenta, leído en vivo: si está conectada y por dónde (Zernio o la conexión anterior), la moneda, sus campañas y conjuntos (id, nombre, prendido, presupuesto diario), y las campañas por producto como la pestaña Campañas (cada producto del CRM con su gasto, sus resultados y su costo del mes, y las campañas sin producto). Úsala para elegir qué campañas cubre una táctica en automatizacion_media_buyer.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'externo', gating: G_MEDIA_BUYER,
  },
  {
    id: 'automatizacion_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true, plata: true,
    titulo: 'Ajustar una táctica del Media Buyer',
    descripcion: 'PROPONE cambiar UNA táctica del Media Buyer (de ver_automatizaciones_media_buyer): su estado (`apagada`, `propone` o `automatica`), sus umbrales (los ids que lista ver_automatizaciones_media_buyer) o las campañas que cubre ([] = toda la cuenta). Sólo cambia lo que se pasa. Automática lanza sin esperar a una persona: se confirma en una pantalla.',
    escribe: 'cambia la táctica en media_buyer_config.tacticas',
    parametros: [
      { nombre: 'tactica', tipo: 'string', obligatorio: true, enum: ['stop_loss', 'calidad', 'sunsetting', 'surf', 'revive', 'ganador'], descripcion: 'la táctica.' },
      { nombre: 'estado', tipo: 'string', enum: ['apagada', 'propone', 'automatica'], descripcion: 'apagada, propone o automatica.' },
      {
        nombre: 'umbrales', tipo: 'object', descripcion: 'umbrales a cambiar (sólo los de esa táctica; sus mínimos y máximos, de ver_automatizaciones_media_buyer).',
        campos: [
          { nombre: 'gastoVeces', tipo: 'number', descripcion: 'Stop Loss: gastó sin resultados, en veces el objetivo.' },
          { nombre: 'dias', tipo: 'number', descripcion: 'Stop Loss: días corriendo como mínimo.' },
          { nombre: 'leads', tipo: 'number', descripcion: 'Calidad de leads: leads en el CRM como mínimo.' },
          { nombre: 'tasaCuentaPct', tipo: 'number', descripcion: 'Calidad de leads: agenda de toda la cuenta como mínimo, en %.' },
          { nombre: 'bajarVeces', tipo: 'number', descripcion: 'Sunsetting: bajar si cuesta, en veces el objetivo.' },
          { nombre: 'bajarPct', tipo: 'number', descripcion: 'Sunsetting: cuánto bajar, en %.' },
          { nombre: 'apagarVeces', tipo: 'number', descripcion: 'Sunsetting: pausar si cuesta, en veces el objetivo.' },
          { nombre: 'costoPct', tipo: 'number', descripcion: 'Surf: subir si cuesta menos de este % del objetivo.' },
          { nombre: 'resultados', tipo: 'number', descripcion: 'Surf (3 días) o Ganador (7 días): resultados como mínimo.' },
          { nombre: 'subidaPct', tipo: 'number', descripcion: 'Surf: cuánto subir, en %.' },
          { nombre: 'costoVeces', tipo: 'number', descripcion: 'Revive: prender si cuesta, en veces el objetivo, hasta.' },
        ],
      },
      { nombre: 'campanas', tipo: 'string[]', max: 300, vaciaEsValor: true, descripcion: 'ids de las campañas que cubre (de ver_campanas_media_buyer); [] = toda la cuenta.' },
    ],
    canales: TODOS, costo: 'dinero', gating: G_MEDIA_BUYER,
  },
  // Los agentes y la Biblioteca (25/10/2026, la estructura de AdAmigo; lib/media-buyer/agentes.ts y agentes-propios.ts): cada
  // acción la firma un agente de MaKo que maneja sus tácticas, y el negocio suma los suyos (una regla en palabras que su IA
  // mira cada día). Lo de un agente propio SIEMPRE propone (táctica `manual`): el piloto automático no lo lanza nunca.
  {
    id: 'modo_agente_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true, plata: true,
    titulo: 'Modo de un agente de MaKo',
    descripcion: 'PROPONE pausar, dejar proponiendo o poner en automático a UNO de los agentes de MaKo del Media Buyer (de ver_media_buyer, en agentes): el Estratega (calidad de leads), el Media Buyer (sube, baja y prende presupuestos), el Diseñador de creativos (variaciones del ganador) o Protect (pausa lo que gasta sin resultados). Cambia el estado de todas sus tácticas a la vez, sin tocar sus umbrales ni sus campañas. Automático lanza sin esperar a una persona: se confirma en una pantalla.',
    escribe: 'cambia el estado de las tácticas del agente en media_buyer_config.tacticas',
    parametros: [
      { nombre: 'agente', tipo: 'string', obligatorio: true, enum: ['estratega', 'media_buyer', 'disenador', 'protect'], descripcion: 'estratega, media_buyer, disenador o protect.' },
      { nombre: 'estado', tipo: 'string', obligatorio: true, enum: ['pausado', 'propone', 'automatico'], descripcion: 'pausado, propone o automatico.' },
    ],
    canales: TODOS, costo: 'dinero', gating: G_MEDIA_BUYER,
  },
  {
    id: 'agente_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Crear o cambiar un agente propio',
    descripcion: 'PROPONE crear un agente propio del Media Buyer, o cambiar uno (con su agenteId, de ver_media_buyer en agentesPropios): una regla escrita en palabras («pausa todo conjunto que pase de US$ 15 por lead en 3 días») que la IA del negocio mira contra la cuenta cada día o cada lunes, y deja acciones para aprobar. Nunca lanza solo: lo suyo espera a una persona y al lanzar pasa por los topes. Hasta 10 por negocio. Sin agenteId crea uno; con agenteId sólo cambia lo que se pasa.',
    escribe: 'guarda el agente en media-buyer.agentes (app_settings)',
    parametros: [
      { nombre: 'agenteId', tipo: 'string', max: 40, descripcion: 'para cambiar uno que ya existe (de ver_media_buyer, en agentesPropios). Sin esto, crea uno nuevo.' },
      { nombre: 'nombre', tipo: 'string', max: 60, descripcion: 'cómo se llama (obligatorio al crear).' },
      { nombre: 'regla', tipo: 'string', max: 600, descripcion: 'qué mira y qué hace, en palabras (obligatoria al crear).' },
      { nombre: 'cada', tipo: 'string', enum: ['dia', 'semana'], descripcion: 'dia (cada día) o semana (los lunes). Por defecto, cada día.' },
      { nombre: 'estado', tipo: 'string', enum: ['activo', 'pausado'], descripcion: 'activo o pausado. Por defecto, activo.' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_MEDIA_BUYER,
  },
  {
    id: 'borrar_agente_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Borrar un agente propio',
    descripcion: 'PROPONE borrar un agente propio del Media Buyer (de ver_media_buyer, en agentesPropios). Las acciones que ya dejó siguen en su lugar. No toca la cuenta de Meta.',
    escribe: 'saca el agente de media-buyer.agentes (app_settings)',
    parametros: [{ nombre: 'agenteId', tipo: 'string', obligatorio: true, max: 40, descripcion: 'el id del agente (de ver_media_buyer, en agentesPropios).' }],
    canales: TODOS, costo: 'gratis', gating: G_MEDIA_BUYER,
  },
  // ── Marketing CoPilot (6/11/2026): la primera entrada de la tab y el funnel que el negocio eligió. Lo mismo que la charla de
  //    la pantalla (lib/media-buyer/copiloto.ts, puro): qué funnel conviene según ticket, presupuesto y quién llama.
  {
    id: 'ver_copiloto_media_buyer', area: 'ads', tipo: 'lectura',
    titulo: 'Ver el plan del Marketing CoPilot',
    descripcion: 'Lo que el negocio respondió en la primera entrada del Marketing CoPilot (el funnel o el referente que eligió, el ticket, el presupuesto mensual, quién toma las llamadas, el ritmo de publicación) y lo que MaKo propone con eso: el funnel que conviene y por qué, si el elegido no le sirve, y los primeros pasos con la pantalla de MaKo donde se hace cada uno. Un funnel orgánico, de YouTube, de lead magnets o de webinar no tiene Campañas; sólo los de anuncios.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_MEDIA_BUYER,
  },
  {
    id: 'copiloto_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Elegir o cambiar el funnel del Marketing CoPilot',
    descripcion: 'PROPONE guardar lo que el negocio decidió o contó en el Marketing CoPilot: el funnel (vsl-llamada, mensajes, formulario, carrito, webinar, lead-magnet, email, youtube u organico) o un referente, el ticket, el presupuesto mensual en dólares (0 si no hay), quién toma las llamadas, si es orgánico o YouTube el objetivo, el ritmo y el formato, y los datos del negocio que se descubren charlando (qué vende, la meta y las ventas de hoy por mes, el margen de una tienda, si tiene casos, el país, la lista de email, las horas para contenido). Sólo se cambia lo que se pasa; un dato se guarda aunque todavía no haya funnel. Es lo que muestra su panel. No toca la cuenta de Meta ni gasta nada.',
    escribe: 'guarda el perfil en marketing-copilot.perfil (app_settings)',
    parametros: [
      { nombre: 'funnel', tipo: 'string', enum: ['vsl-llamada', 'mensajes', 'formulario', 'carrito', 'webinar', 'lead-magnet', 'email', 'youtube', 'organico'], descripcion: 'el funnel que se arma.' },
      { nombre: 'referente', tipo: 'string', descripcion: 'el id de un referente de MaKo que inspira la estrategia (ver_plan_funnel lo nombra), si sigue el de uno.' },
      { nombre: 'ticket', tipo: 'number', minimo: 0.01, descripcion: 'lo que deja una venta, en dólares.' },
      { nombre: 'presupuestoMes', tipo: 'number', minimo: 0, descripcion: 'lo que puede poner en anuncios por mes, en dólares (0 = nada por ahora).' },
      { nombre: 'llamadas', tipo: 'string', enum: ['yo', 'equipo', 'nadie'], descripcion: 'quién toma las llamadas o contesta los mensajes.' },
      { nombre: 'objetivo', tipo: 'string', enum: ['viralidad', 'ventas', 'mixto'], descripcion: 'sólo en orgánico: qué busca con el contenido.' },
      { nombre: 'ritmo', tipo: 'number', minimo: 1, maximo: 21, descripcion: 'piezas (o videos en YouTube) por semana.' },
      { nombre: 'formato', tipo: 'string', enum: ['reels', 'stories', 'carruseles', 'mezcla', 'largos', 'shorts'], descripcion: 'el formato con el que empieza.' },
      { nombre: 'vende', tipo: 'string', enum: ['servicio', 'curso', 'tienda', 'local'], descripcion: 'qué vende: un servicio, un curso o programa, productos en una tienda online, o un negocio local.' },
      { nombre: 'meta', tipo: 'number', minimo: 1, descripcion: 'su OBJETIVO: cuántos clientes o pedidos QUIERE por mes («quiero 2 o 3 por mes» va aquí, no en ventasMes).' },
      { nombre: 'ventasMes', tipo: 'number', minimo: 0, descripcion: 'cuántos consigue HOY por mes, sin la meta (sólo si lo dijo).' },
      { nombre: 'margen', tipo: 'number', minimo: 1, maximo: 95, descripcion: 'en una tienda: el % de cada venta que le queda.' },
      { nombre: 'casos', tipo: 'string', enum: ['si', 'no'], descripcion: 'si tiene casos reales de clientes para mostrar.' },
      { nombre: 'pais', tipo: 'string', max: 40, descripcion: 'el país (o países) donde vende.' },
      { nombre: 'lista', tipo: 'number', minimo: 0, descripcion: 'contactos en su lista de email (0 si no tiene).' },
      { nombre: 'horas', tipo: 'number', minimo: 0, maximo: 80, descripcion: 'horas por semana para hacer contenido.' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_MEDIA_BUYER,
  },
  {
    id: 'ver_biblioteca_media_buyer', area: 'ads', tipo: 'lectura',
    titulo: 'Ver la Biblioteca del Media Buyer',
    descripcion: 'La Biblioteca del Media Buyer, como su pestaña: lo nuevo para revisar (las variaciones de texto y de gancho que propuso el Diseñador de creativos, con su id de decisión), los anuncios que más resultados trajeron al CRM este mes (gasto, resultados y costo por resultado), y lo que ya se lanzó en 30 días. Úsala antes de lanzar_decision_media_buyer o hooks_al_video_media_buyer sobre una variación.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_MEDIA_BUYER,
  },
  // DÓNDE, HASTA y «lánzame una campaña» (29/10/2026, lo prometido a la agencia de Thiago: docs/promesas/2910-llamada-thiago.md).
  // La zona y la fecha frenan lo que SUBE el gasto (lib/media-buyer/zona.ts); la campaña nueva sale entera por la Zernio del
  // negocio (lib/media-buyer/campana.ts). Las tres mueven plata: `pantalla`, `dinero`, admin y fuera de los flujos.
  {
    id: 'zona_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true, plata: true,
    titulo: 'Zona del Media Buyer',
    descripcion: 'PROPONE la ZONA donde trabaja el Media Buyer: los países, provincias o ciudades (de buscar_lugares_meta, tal cual vienen) donde puede prender y subir presupuestos. Lo que muestra anuncios fuera de la zona, o lo que no se puede confirmar adentro, no se prende ni se sube (bajar y pausar siempre se puede). La lista reemplaza la anterior; [] = toda la cuenta. Se confirma en una pantalla.',
    escribe: 'cambia la zona en media_buyer_config',
    parametros: [{
      nombre: 'zona', tipo: 'object[]', obligatorio: true, max: 25, vaciaEsValor: true,
      descripcion: 'los lugares, como los devuelve buscar_lugares_meta (sólo país, provincia o ciudad); [] = toda la cuenta.',
      campos: [
        { nombre: 'tipo', tipo: 'string', obligatorio: true, enum: ['country', 'region', 'city'], descripcion: 'country, region o city.' },
        { nombre: 'key', tipo: 'string', obligatorio: true, max: 40, descripcion: 'el id de Meta del lugar.' },
        { nombre: 'nombre', tipo: 'string', max: 120, descripcion: 'el nombre, para mostrarlo.' },
        { nombre: 'pais', tipo: 'string', max: 2, descripcion: 'el código del país (ES, MX…): obligatorio en provincias y ciudades.' },
        { nombre: 'region', tipo: 'string', max: 120, descripcion: 'la provincia de una ciudad, para mostrarla.' },
        { nombre: 'regionId', tipo: 'string', max: 40, descripcion: 'el id de Meta de la provincia de una ciudad.' },
      ],
    }],
    canales: TODOS, costo: 'dinero', gating: G_MEDIA_BUYER,
  },
  {
    id: 'hasta_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true, plata: true,
    titulo: 'Fecha de fin del Media Buyer',
    descripcion: 'PROPONE la FECHA DE FIN: la de toda la cuenta, o con campanaId la de una campaña (gana a la de la cuenta). Pasada la fecha (el día del negocio), MaKo pausa la campaña sola; desde 3 días antes no sube presupuestos. Vacía = sin fecha (la campaña vuelve a la de la cuenta). Se confirma en una pantalla.',
    escribe: 'cambia hasta o hasta_campanas en media_buyer_config',
    parametros: [
      { nombre: 'hasta', tipo: 'string', obligatorio: true, max: 10, vaciaEsValor: true, descripcion: 'AAAA-MM-DD, el último día; vacío = sin fecha.' },
      { nombre: 'campanaId', tipo: 'string', max: 30, fijoAlRevisar: true, descripcion: 'sólo para UNA campaña: su id numérico de Meta (de ver_campanas_media_buyer). Sin esto, es la de toda la cuenta.' },
    ],
    canales: TODOS, costo: 'dinero', gating: G_MEDIA_BUYER,
  },
  {
    id: 'proponer_crear_campana', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true, plata: true,
    titulo: 'Lanzar una campaña nueva',
    descripcion: 'PROPONE lanzar una campaña ENTERA (campaña, conjunto y anuncio) por la conexión de Facebook del negocio: el objetivo, el presupuesto por día, dónde (vacío = la zona del Media Buyer, y nunca fuera de ella), hasta cuándo (vacío = la fecha de fin del Media Buyer), el formulario o el píxel, la página de destino y el creativo (una imagen o un video con su https, un video ya subido a la cuenta, o reusar un anuncio de la cuenta). Hoy NACE EN PAUSA (la persona la revisa en Meta y la prende) y MaKo relee lo que Meta guardó contra lo pedido. Se confirma en una pantalla, que muestra todo lo que sale; se deshace con deshacer_decision_media_buyer (la borra). Antes: listar_formularios_meta o listar_pixeles_meta, y buscar_lugares_meta.',
    escribe: 'crea una campaña, un conjunto y un anuncio en Meta por Zernio, y la registra en media_buyer_decisiones',
    parametros: [
      { nombre: 'nombre', tipo: 'string', obligatorio: true, max: 200, descripcion: 'cómo se llama la campaña.' },
      { nombre: 'objetivo', tipo: 'string', obligatorio: true, enum: ['formulario', 'web', 'trafico', 'compras'], descripcion: 'formulario (de Meta, con formularioId) · web (registros en la página, con pixelId y evento) · trafico (visitas) · compras (con pixelId).' },
      { nombre: 'presupuestoDia', tipo: 'number', obligatorio: true, minimo: 0.01, descripcion: 'por día, en la moneda de la cuenta publicitaria.' },
      {
        nombre: 'lugares', tipo: 'object[]', max: 25, descripcion: 'dónde se muestra, como los devuelve buscar_lugares_meta (país, provincia o ciudad). Vacío = la zona del Media Buyer.',
        campos: [
          { nombre: 'tipo', tipo: 'string', obligatorio: true, enum: ['country', 'region', 'city'], descripcion: 'country, region o city.' },
          { nombre: 'key', tipo: 'string', obligatorio: true, max: 40, descripcion: 'el id de Meta del lugar.' },
          { nombre: 'nombre', tipo: 'string', max: 120, descripcion: 'el nombre.' },
          { nombre: 'pais', tipo: 'string', max: 2, descripcion: 'el código del país: obligatorio en provincias y ciudades.' },
          { nombre: 'regionId', tipo: 'string', max: 40, descripcion: 'el id de la provincia de una ciudad.' },
        ],
      },
      { nombre: 'hasta', tipo: 'string', max: 10, descripcion: 'AAAA-MM-DD, el último día. Vacío = la fecha de fin del Media Buyer (o sin fecha).' },
      { nombre: 'edadMin', tipo: 'number', entero: true, minimo: 18, maximo: 65, descripcion: 'edad mínima (18 a 65).' },
      { nombre: 'edadMax', tipo: 'number', entero: true, minimo: 18, maximo: 65, descripcion: 'edad máxima (65 es «65 o más»).' },
      { nombre: 'formularioId', tipo: 'string', max: 30, fijoAlRevisar: true, descripcion: 'objetivo formulario: el id del formulario instantáneo (de listar_formularios_meta).' },
      { nombre: 'pixelId', tipo: 'string', max: 30, fijoAlRevisar: true, descripcion: 'objetivo web o compras: el id del píxel (de listar_pixeles_meta).' },
      { nombre: 'evento', tipo: 'string', enum: ['LEAD', 'SCHEDULE', 'SUBMIT_APPLICATION', 'CONTACT', 'COMPLETE_REGISTRATION'], descripcion: 'objetivo web: el evento del píxel que optimiza (por defecto LEAD).' },
      { nombre: 'url', tipo: 'string', max: 1000, descripcion: 'la página a la que lleva el anuncio, exacta con https (obligatoria salvo en formulario).' },
      { nombre: 'creativoTipo', tipo: 'string', obligatorio: true, enum: ['imagen', 'video', 'video_cuenta', 'anuncio', 'archivo', 'generado'], descripcion: 'imagen o video (con imagenUrl o videoUrl), video_cuenta (con videoId), anuncio (reusar el de anuncioId), archivo (uno subido con preparar_subida_media_buyer, con archivoPath) o generado (un video que MaKo ya hizo, con creativoRef).' },
      { nombre: 'imagenUrl', tipo: 'string', max: 1000, descripcion: 'creativoTipo imagen: la dirección https de la imagen.' },
      { nombre: 'videoUrl', tipo: 'string', max: 1000, descripcion: 'creativoTipo video: la dirección https del video (MP4).' },
      { nombre: 'videoId', tipo: 'string', max: 30, fijoAlRevisar: true, descripcion: 'creativoTipo video_cuenta: el id de un video ya subido a la cuenta.' },
      { nombre: 'anuncioId', tipo: 'string', max: 30, fijoAlRevisar: true, descripcion: 'creativoTipo anuncio: el id del anuncio de la cuenta cuyo creativo se reusa (de listar_anuncios_meta).' },
      { nombre: 'archivoPath', tipo: 'string', max: 300, fijoAlRevisar: true, descripcion: 'creativoTipo archivo: el path del staging (nueva/…) de preparar_subida_media_buyer. Se borra a las 6 horas si no se publica.' },
      { nombre: 'archivoMedia', tipo: 'string', enum: ['imagen', 'video'], descripcion: 'creativoTipo archivo: imagen o video.' },
      { nombre: 'creativoRef', tipo: 'string', max: 256, fijoAlRevisar: true, descripcion: 'creativoTipo generado: la ref de un video de MaKo (de `generados` en preparar_subida_media_buyer: AI Avatar, Video Generator).' },
      { nombre: 'texto', tipo: 'string', max: 2000, descripcion: 'el texto principal del anuncio (obligatorio salvo al reusar un anuncio).' },
      { nombre: 'titulo', tipo: 'string', max: 255, descripcion: 'el título del anuncio.' },
      { nombre: 'boton', tipo: 'string', enum: ['LEARN_MORE', 'SIGN_UP', 'APPLY_NOW', 'BOOK_NOW', 'CONTACT_US', 'GET_QUOTE', 'SUBSCRIBE', 'SHOP_NOW', 'WHATSAPP_MESSAGE'], descripcion: 'el botón del anuncio.' },
      { nombre: 'enPausa', tipo: 'boolean', descripcion: 'hoy toda campaña nueva nace en pausa (hasta medir la creación por Zernio): la persona la revisa y la prende.' },
    ],
    canales: TODOS, costo: 'dinero', gating: G_MEDIA_BUYER,
  },
  // Subir creativos nuevos (27/10/2026): lo de «Subir creativos» de la pantalla, en los mismos dos pasos (el archivo va al
  // staging por una URL firmada, lib/ads-staging-firma.ts, y después se publica por lib/media-buyer/subir.ts). Sólo por HTTP:
  // un archivo no viaja por un chat. Publicar lo confirma una persona en /mako/revisar, como lanzar una decisión.
  {
    id: 'preparar_subida_media_buyer', area: 'ads', tipo: 'lectura',
    titulo: 'Preparar la subida de creativos nuevos',
    descripcion: 'El primer paso para subir imágenes o videos nuevos a un conjunto, como «Subir creativos» de la pantalla: devuelve los conjuntos de la cuenta (los prendidos primero), si la Zernio del negocio está conectada (sin ella no se puede publicar), una URL firmada por cada archivo nombrado (se sube con un PUT; vence en 2 horas, y el archivo se borra a las 6 si no se publica) y, con adsetId, los textos de partida: los del anuncio que más resultados trajo en ese conjunto. También los videos que MaKo ya generó (`generados`: AI Avatar y Video Generator), que se suben por su `ref`, sin PUT. Después: subir_creativos_media_buyer con los path (o las ref) que devuelve.',
    parametros: [
      { nombre: 'nombres', tipo: 'string[]', max: 10, descripcion: 'los nombres de los archivos, con su extensión (video.mp4, foto.jpg) y sin comas: una URL firmada por cada uno, hasta 10.' },
      { nombre: 'adsetId', tipo: 'string', max: 30, descripcion: 'id del conjunto (de esta misma lectura o de ver_campanas_media_buyer): trae sus textos de partida.' },
    ],
    salida: 'json', canales: ['http'], costo: 'externo', gating: G_MEDIA_BUYER,
  },
  {
    id: 'subir_creativos_media_buyer', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true, plata: true,
    titulo: 'Subir creativos nuevos a un conjunto',
    descripcion: 'PROPONE publicar imágenes o videos ya subidos con preparar_subida_media_buyer, o videos que MaKo ya generó (su `ref`, de `generados`), como anuncios nuevos de UN conjunto (uno por archivo, con los mismos textos), por la Zernio del negocio: heredan el presupuesto y el público del conjunto. Con `original` (un anuncio del conjunto), se prueban contra él: si uno le gana, el Media Buyer propone pausar el original. Se confirma en una pantalla antes de 6 horas si hay archivos del disco (después se borran). Cada video puede tardar minutos: de a pocos. Queda como una decisión del Media Buyer y se deshace con deshacer_decision_media_buyer, que borra los anuncios creados.',
    escribe: 'crea anuncios en la cuenta de Meta del negocio (por Zernio) y deja la decisión aplicada en media_buyer_decisiones',
    parametros: [
      { nombre: 'adsetId', tipo: 'string', obligatorio: true, max: 30, fijoAlRevisar: true, descripcion: 'id del conjunto (de preparar_subida_media_buyer o ver_campanas_media_buyer).' },
      {
        nombre: 'archivos', tipo: 'object[]', obligatorio: true, max: 10, fijoAlRevisar: true, descripcion: 'los archivos, hasta 10: cada uno con su path (subido) o su ref (un video de MaKo).',
        campos: [
          { nombre: 'path', tipo: 'string', max: 300, descripcion: 'el path que devolvió preparar_subida_media_buyer (nueva/…), para un archivo del disco.' },
          { nombre: 'ref', tipo: 'string', max: 256, descripcion: 'la ref de un video que MaKo ya generó (de `generados` en preparar_subida_media_buyer), en vez del path.' },
          { nombre: 'tipo', tipo: 'string', obligatorio: true, enum: ['image', 'video'], descripcion: 'image o video (un video de MaKo es video).' },
          { nombre: 'nombre', tipo: 'string', max: 120, descripcion: 'cómo se llama: sale en el nombre del anuncio.' },
        ],
      },
      { nombre: 'original', tipo: 'string', max: 30, fijoAlRevisar: true, descripcion: 'el id de un anuncio del mismo conjunto contra el que se prueban (un hook nuevo contra el video ganador): si uno le gana, el Media Buyer propone pausarlo.' },
      { nombre: 'textoPrincipal', tipo: 'string', obligatorio: true, max: 2200, descripcion: 'el texto principal del anuncio.' },
      { nombre: 'titulo', tipo: 'string', obligatorio: true, max: 255, descripcion: 'el título.' },
      { nombre: 'cta', tipo: 'string', enum: CTAS_SUBIDA, descripcion: 'el botón. Por defecto, LEARN_MORE.' },
      { nombre: 'link', tipo: 'string', max: 1000, descripcion: 'el destino, con https. Va esto o formularioId.' },
      { nombre: 'formularioId', tipo: 'string', max: 30, descripcion: 'el formulario instantáneo, si el conjunto lo usa (va en vez del link).' },
      { nombre: 'activo', tipo: 'boolean', obligatorio: true, descripcion: 'true: salen activos y gastan del presupuesto del conjunto; false: en pausa.' },
    ],
    canales: ['http'], costo: 'dinero', gating: G_MEDIA_BUYER,
  },
  // El plan del funnel (1/11/2026, docs/funnel-coach.md §3): el Funnel Coach lo guarda y su botón «Ver el plan» lo muestra.
  {
    id: 'ver_plan_funnel', area: 'ads', tipo: 'lectura',
    datosDeClientes: false,
    titulo: 'Ver el plan del funnel',
    descripcion: 'El plan del funnel guardado de este negocio: qué funnel, por qué, inversión, creativos, ángulos, landings y pasos. Sin parámetros.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: G_COACH,
  },
  {
    id: 'guardar_plan_funnel', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: false,
    datosDeClientes: false,
    escribe: 'reemplaza el plan del funnel del negocio en app_settings',
    titulo: 'Guardar el plan del funnel',
    descripcion: 'PROPONE guardar el plan del funnel decidido con la persona. Reemplaza el anterior. Sin esto el plan sólo existe en el chat.',
    parametros: [
      { nombre: 'funnel', tipo: 'string', obligatorio: true, enum: FUNNELS, descripcion: 'El funnel elegido.' },
      { nombre: 'porque', tipo: 'string', max: 600, descripcion: 'Por qué ese, con lo que dijo la persona.' },
      { nombre: 'presupuestoMensual', tipo: 'number', minimo: 0, descripcion: 'Inversión por mes, en dólares.' },
      { nombre: 'creativos', tipo: 'number', entero: true, minimo: 0, descripcion: 'Cuántos creativos.' },
      { nombre: 'angulos', tipo: 'number', entero: true, minimo: 0, descripcion: 'Cuántos ángulos.' },
      { nombre: 'landings', tipo: 'number', entero: true, minimo: 0, descripcion: 'Cuántas landings (2 = prueba A/B).' },
      { nombre: 'pasos', tipo: 'string[]', max: 12, descripcion: 'Los pasos a ejecutar, en orden.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: G_COACH,
  },
];
