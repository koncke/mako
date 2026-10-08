// =============================================================================
// api-mako/areas/ads.def — las operaciones del área `ads` (definiciones)
// =============================================================================
// Dos tabs en un área: Ads Manager (el árbol de Meta en vivo, rendimiento por
// anuncio, escrituras a Meta) y Ads Analyst (guiones analizados, vocabulario de
// ángulos y avatares). SIN server-only y sin importar valores de módulos que lo
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
//  · editar_publico_conjunto: updateAdsetTargeting SÍ existe, pero REEMPLAZA el
//    targeting completo, y la ruta adset-targeting NO mergea: reenvía lo que le llega.
//    El merge vive en el NAVEGADOR (EditarPublicoModal superpone sobre el crudo, y los
//    lugares pasan por aplicarLugares de lib/meta-geo.ts). Un parámetro parcial por la
//    API borraría la segmentación. Falta una función en la lib que lea el crudo y
//    superponga en el server; si se expone, va con confirmacion 'pantalla' y rolMinimo
//    'admin' (cambiar lugares reinicia el aprendizaje del conjunto). Hasta el 07/10 este
//    comentario decía «la ruta mergea antes», que era falso.
// =============================================================================

import type { Gating, OperacionDef, Parametro } from '../tipos';

const TODOS = ['whatsapp', 'app', 'http'] as const;
const SIN_HTTP = ['whatsapp', 'app'] as const;

/** Lecturas del Ads Manager (la page exige admin del workspace y la capa con la tab). */
const G_MANAGER: Gating = { tab: 'ads-manager', integracion: 'meta', rolMinimo: 'admin' };
/** Lecturas y escrituras de Ads Analyst (nav key `script`). */
const G_ANALYST: Gating = { tab: 'script', rolMinimo: 'admin' };
/** Lo que mueve plata o crea en la cuenta de Meta. */
const G_META_ADMIN: Gating = { tab: 'ads-manager', integracion: 'meta', rolMinimo: 'admin' };

const P_CAMPAIGN: Parametro = { nombre: 'campaignId', tipo: 'string', obligatorio: true, max: 30, descripcion: 'id numérico de la campaña en Meta (de listar_campanas_meta o ver_estado_meta).' };
const P_ADSET: Parametro = { nombre: 'adsetId', tipo: 'string', obligatorio: true, max: 30, descripcion: 'id numérico del conjunto de anuncios en Meta (de listar_conjuntos_meta).' };
const P_AD: Parametro = { nombre: 'adId', tipo: 'string', obligatorio: true, max: 30, descripcion: 'id numérico del anuncio en Meta (de listar_anuncios_meta o ver_rendimiento_anuncios).' };
const P_ESTADO: Parametro = { nombre: 'estado', tipo: 'string', obligatorio: true, enum: ['ACTIVE', 'PAUSED'], descripcion: 'ACTIVE para activar, PAUSED para pausar.' };
const P_AD_ID_GUION: Parametro = { nombre: 'ad_id', tipo: 'string', obligatorio: true, max: 30, descripcion: 'id numérico del anuncio en Meta (de listar_guiones_analizados).' };

export const DEFS: readonly OperacionDef[] = [
  // ═══════════════════════════ LECTURAS — Ads Manager ═══════════════════════════
  {
    id: 'listar_campanas_meta', area: 'ads', tipo: 'lectura',
    titulo: 'Campañas con gasto en 30 días',
    descripcion: 'Lista las campañas de Meta Ads con datos sincronizados en los ÚLTIMOS 30 DÍAS: id, nombre y gasto de ese período en la moneda de la cuenta (`gasto_mxn`) y su equivalente en USD a un tipo de cambio fijo del código. Trae la ventana de fechas exacta: no es el gasto histórico ni el estado en vivo (una campaña pausada o creada hoy no aparece; para eso usa ver_estado_meta). Úsala para conseguir el id de una campaña antes de proponer renombrarla, cambiar su presupuesto o pausarla/activarla.',
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
    descripcion: 'El rendimiento de cada anuncio CON GASTO en un rango de fechas, de la base de MaKo (Meta sincronizado + CRM): gasto en USD derivado, leads de Meta y del CRM, agendas, cierres y cash del CRM, días corriendo, veredicto Recon (explorando, validada, falso_positivo, apagar, pausada), hook rate, hold rate, CTR, CPL, CPM, frecuencia e impresiones. Ordenado por gasto. Úsala para «¿qué anuncio rinde mejor?», «¿cuál apago?». Los anuncios sin gasto en el rango no aparecen.',
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
    descripcion: 'El historial de guiones nuevos valorados en Ads Analyst («Analiza un guion nuevo»), más recientes primero: id, etiqueta, ángulo, tipo de gancho, veredicto, rangos estimados de hook y retención y un extracto del guion. Úsala para «¿qué dijo MaKo del guion que probé ayer?» o para conseguir el id antes de proponer_borrar_guion_valorado.',
    parametros: [
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'cuántos traer (default 20).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ANALYST,
  },
  {
    id: 'ver_transcript_anuncio', area: 'ads', tipo: 'lectura',
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
    id: 'proponer_estado_campana', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
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
    id: 'proponer_estado_conjunto', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Pausar o activar un conjunto',
    descripcion: 'PROPONE pausar o activar UN conjunto de anuncios de Meta; queda pendiente de confirmación. Activar enciende su gasto (o su parte del presupuesto de campaña). Activar un conjunto dentro de una campaña pausada no lo pone a entregar. Consigue el adsetId con listar_conjuntos_meta.',
    escribe: 'cambia el status del conjunto en Meta (POST /{id} status); nada en la base',
    parametros: [P_ADSET, P_ESTADO],
    canales: TODOS, costo: 'externo', gating: G_META_ADMIN,
  },
  {
    id: 'proponer_estado_anuncio', area: 'ads', tipo: 'accion', confirmacion: 'chat', reversible: true,
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
      { nombre: 'nivel', tipo: 'string', obligatorio: true, enum: ['campaign', 'adset', 'ad'], descripcion: 'campaign = campaña, adset = conjunto, ad = anuncio.' },
      { nombre: 'id', tipo: 'string', obligatorio: true, max: 30, descripcion: 'id numérico de la entidad; tiene que estar pausada.' },
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
];
