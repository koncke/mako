// =============================================================================
// api-mako/areas/video.def — las operaciones del área `video` (definiciones)
// =============================================================================
// Una entrada por operación: id, qué es, parámetros, por qué canales sale, cómo se
// confirma. SIN server-only y sin importar valores de módulos que lo tengan: esto
// lo importan los tests y el generador de la referencia. Los cuerpos van en
// video.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// El área es /video-generator: un guion ya escrito se reparte en tomas, cada
// escenario tiene su imagen en Google Flow, se filma toma por toma con los créditos
// de la suscripción del CLIENTE y un worker propio monta el anuncio.
// Una sola operación es del Video EDITOR (/video-editor): listar_plantillas_video, el
// catálogo de sus plantillas de anuncio. Del editor no hay más: sus proyectos viven en el
// navegador (docs/hallazgos-video-editor.md → «La API de MaKo y el chat al costado»).
//
// ⚠️ EN v1 ENTRAN SOLO LECTURAS. Todo lo que encola, genera, regenera, monta o
// reintenta queda afuera (veredicto §8 de docs/api-mako-diseno.md): gasta créditos
// de Flow o de ElevenLabs, y lo que deja una propuesta todavía no está verificado
// contra la cola de la extensión. Tampoco entran las escrituras sin gasto (editar
// tomas, escenarios, acento): hoy viven en server actions con un ctxAdmin() de
// SESIÓN, así que por HTTP o WhatsApp contestarían «solo el administrador…».
//
// ⚠️ Las lecturas se arman SOLO con lo guardado. estadoTomaAction y
// estadoImagenAction no son lecturas: cada llamada encola consultas a Google, baja
// clips y mide el costo.
//
// ⚠️ Saldo y costo de créditos de Flow: sin 'http' (saldos de un tercero).
// =============================================================================

import type { OperacionDef, Parametro } from '../tipos';

const TODOS: ['whatsapp', 'app', 'http'] = ['whatsapp', 'app', 'http'];
const SIN_HTTP: ['whatsapp', 'app'] = ['whatsapp', 'app'];

/** La tab entera es del admin del workspace (las actions exigen admin). */
const GATING = { tab: 'video-generator', rolMinimo: 'admin' } as const;
/**
 * Catálogos CONSTANTES del código: no dicen nada del negocio. Hoy solo los lugares.
 * Los formatos no entran: formatosOfrecidos trae también los que creó el cliente.
 */
const GATING_CATALOGO = { tab: 'video-generator' } as const;
/**
 * Las plantillas de anuncio del VIDEO EDITOR (/video-editor, lib/editor-video/plantillas.ts):
 * otro catálogo constante, de otra tab. Sin `rolMinimo`: la tab dejó de ser `adminOnly` el
 * 12/10/2026 (lib/capas.ts).
 */
const GATING_EDITOR = { tab: 'video-editor' } as const;

const PLAN_ID: Parametro = {
  nombre: 'planId', tipo: 'string', obligatorio: true, max: 80,
  descripcion: 'id del anuncio (planId de listar_anuncios_video).',
};

export const DEFS: readonly OperacionDef[] = [
  // ═══════════════════════════ LECTURAS — el puente con Google Flow ══════════
  {
    id: 'ver_puente_flow', area: 'video', tipo: 'lectura',
    titulo: 'Conexión con Google Flow',
    descripcion: 'Dice si el navegador del cliente está conectado a MaKo para generar en Google Flow: si está vivo ahora (latió en los últimos 2 minutos), si puede trabajar, si Google pausó la sesión, la versión de la extensión contra la vigente y qué operaciones ya sabe hacer según el último reporte del navegador. Úsala para contestar «¿por qué no se filma?» antes de mirar los trabajos. Nunca devuelve el token.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'listar_trabajos_flow', area: 'video', tipo: 'lectura',
    titulo: 'Trabajos de la cola de Flow',
    descripcion: 'Los últimos trabajos que MaKo le pidió al navegador del cliente para Google Flow (subir foto, generar imagen, generar clip, consultar un clip, leer créditos, conseguir el enlace de un clip), del más nuevo al más viejo, con su estado (pendiente, tomado, listo, fallido), intentos y, si falló, la causa clasificada y la frase que explica de quién fue. Úsala para diagnosticar por qué una imagen o una toma no sale. No devuelve el pedido ni la respuesta cruda de Google.',
    parametros: [
      { nombre: 'estado', tipo: 'string', enum: ['pendiente', 'tomado', 'listo', 'fallido'], descripcion: 'Filtra por estado. Sin esto, todos.' },
      { nombre: 'tipo', tipo: 'string', enum: ['subir_imagen', 'generar_imagen', 'generar_clip', 'estado_clips', 'creditos', 'enlace_clip'], descripcion: 'Filtra por tipo de trabajo. Sin esto, todos.' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 50, descripcion: 'Cuántos trabajos devolver (por defecto 10, máximo 50).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },

  // ═══════════════════════════ LECTURAS — los anuncios ═══════════════════════
  {
    id: 'listar_anuncios_video', area: 'video', tipo: 'lectura',
    titulo: 'Anuncios de video en curso',
    descripcion: 'Los anuncios de la tab Video Generator (el historial guarda hasta 10, del más nuevo al más viejo) con su avance: formato, cuántas tomas hay, cuántas están filmadas, generándose o con error, y cuántos escenarios tienen la imagen confirmada. Las tomas que figuran generando se cruzan con la cola real: las que tienen el trabajo caído salen aparte. Úsala para contestar «¿cómo van mis videos?» y para conseguir el planId antes de ver_anuncio_video o ver_montaje_anuncio.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'ver_anuncio_video', area: 'video', tipo: 'lectura',
    titulo: 'Detalle de un anuncio',
    descripcion: 'El detalle de UN anuncio: el texto de cada toma con sus segundos y las palabras contra el tope que entra, el estado de cada toma (filmada con su url y si esa url vence, generando con el estado real de su trabajo en la cola, sin poder leer su estado, con error y de quién fue, sin texto, sin filmar) y el plan de escenas con el estado de la imagen de cada escenario (sin generar, generando, generada sin confirmar, confirmada, con error). Necesita el planId de listar_anuncios_video. No devuelve prompts.',
    parametros: [PLAN_ID],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'ver_montaje_anuncio', area: 'video', tipo: 'lectura',
    titulo: 'Montaje final del anuncio',
    descripcion: 'Cómo va el montaje final de un anuncio (pegar las tomas filmadas en un solo video): sin empezar, en cola (y hace cuántos minutos espera), en cola de nuevo tras un fallo, montando, listo con la url del video y los segundos estimados antes del corte y medidos después, o con error y su motivo. Es la única lectura de un anuncio terminado con archivo real, y responde aunque el anuncio ya se haya caído del historial. Necesita el planId de listar_anuncios_video.',
    parametros: [PLAN_ID],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'contar_escenarios_reusables', area: 'video', tipo: 'lectura',
    titulo: 'Escenarios que se pueden reusar',
    descripcion: 'Cuántos escenarios de un anuncio se pueden llenar con una imagen ya generada en otro anuncio del cliente (mismo formato y mismo lugar) en vez de volver a generarla, y de cuáles anuncios saldrían. No reusa nada: solo cuenta. Necesita el planId de listar_anuncios_video.',
    parametros: [PLAN_ID],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'listar_guiones_para_video', area: 'video', tipo: 'lectura',
    titulo: 'Guiones que se pueden filmar',
    descripcion: 'Los guiones que MaKo escribió o que el cliente cargó y que se pueden filmar en esta tab, del más nuevo al más viejo: primera línea, ángulo, estado, palabras habladas, si ya tienen un anuncio armado (con su planId) y en qué formatos ya se grabaron. Úsala para saber qué guion falta filmar. Cada guion trae su celdaId: el texto completo se lee con leer_guion_anuncio (celdaId + guionId).',
    parametros: [
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'Cuántos guiones devolver (por defecto 30, máximo 100).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },

  // ═══════════════════════════ LECTURAS — catálogos y requisitos ═════════════
  {
    id: 'listar_formatos_video', area: 'video', tipo: 'lectura',
    titulo: 'Formatos de video disponibles',
    descripcion: 'Los formatos (puestas en escena) con los que se puede filmar un anuncio: los de fábrica y los que creó el cliente, con su cámara, si la persona habla en cámara, cuántos clips y de cuántos segundos, palabras por segundo, cuántos escenarios lleva y cuándo conviene. Úsala para explicar qué formato elegir o qué significa el formato de un anuncio.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'listar_lugares_grabacion', area: 'video', tipo: 'lectura',
    titulo: 'Lugares de grabación',
    descripcion: 'El catálogo de lugares donde se puede ambientar un anuncio (auto, oficina, cocina…), con qué es cada uno, cuándo conviene y cuántos fondos distintos tiene. Con `camara` filtra los lugares compatibles con la cámara de un formato (la `camara` sale de listar_formatos_video).',
    parametros: [
      { nombre: 'camara', tipo: 'string', enum: ['estatica', 'mano', 'selfie', 'seguimiento'], descripcion: 'La cámara del formato, para ver solo los lugares compatibles.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING_CATALOGO,
  },
  {
    id: 'listar_plantillas_video', area: 'video', tipo: 'lectura',
    titulo: 'Plantillas de anuncio del editor',
    descripcion: 'El catálogo de plantillas de anuncio vertical (9:16) del Video Editor (/video-editor): id, nombre, qué es, cuánto dura y sus huecos, primero las sugeridas para este negocio (con su porqué en "sugerida"). Un hueco de clip se llena con un video o una foto (con los segundos que pide: un video más corto no entra; una foto sirve siempre; uno opcional puede quedar con su muestra); uno de texto, con hasta su máximo de caracteres (trae el texto de ejemplo). Usar una plantilla NO se puede por la API: el proyecto vive en el navegador de quien edita. Se usa en el editor, en la pestaña Plantillas o pidiéndoselo al chat «Editar con IA».',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING_EDITOR,
  },
  {
    id: 'ver_contexto_video', area: 'video', tipo: 'lectura',
    titulo: 'Requisitos para filmar',
    descripcion: 'Si el cliente tiene lo que hace falta para filmar: cuántas fotos de su cara hay cargadas, si MaKo ya describió a la persona, qué acento se va a usar y de dónde salió (declarado por el cliente, deducido de la zona horaria o por defecto), sus muletillas, y si el perfil del negocio está empezado y qué grupos le faltan. No devuelve las fotos ni la descripción. Úsala antes de decir que el cliente ya puede filmar, o cuando un clip sale con otra persona u otro acento.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'ver_voz_cliente', area: 'video', tipo: 'lectura',
    titulo: 'Voz y acento del cliente',
    descripcion: 'Lo que el cliente declaró sobre su forma de hablar: el acento guardado y si lo eligió él o fue una sugerencia por zona horaria, sus muletillas, cuántos audios de muestra subió y si tiene una voz clonada (con fecha). No consulta ElevenLabs: que el clon siga existiendo allá no está verificado. Úsala antes de hablar de cómo va a sonar un anuncio.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },
  {
    id: 'estado_onboarding_video', area: 'video', tipo: 'lectura',
    titulo: 'Onboarding del Video Generator',
    descripcion: 'Los pasos de la configuración del Video Generator (extensión, fotos, acento, muletillas, voz y primer escenario) con cuáles están hechos y cuándo, cuáles faltan, y si la tab Ads Writer (que es requisito) sigue pendiente. Úsala para saber si el cliente ya puede filmar o hay que mandarlo a /video-generator a terminar de configurarlo.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: GATING,
  },

  // ═══════════════════════════ LECTURAS — créditos de Flow (sin http) ════════
  {
    id: 'ver_saldo_flow', area: 'video', tipo: 'lectura',
    titulo: 'Créditos de Google Flow',
    descripcion: 'Los créditos de Google Flow del cliente según la ÚLTIMA lectura guardada (con su fecha: puede estar vieja), el plan de su cuenta de Google, cuánto cuesta un clip (medido o estimado) y la tabla de créditos por duración de clip. No consulta a Google. creditos null significa que nunca se leyó, no que tenga cero. Úsala cuando pregunten por los créditos de Flow o antes de calcular_alcance_anuncio.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'calcular_alcance_anuncio', area: 'video', tipo: 'lectura',
    titulo: 'Si alcanzan los créditos',
    descripcion: 'Cuántos créditos de Google Flow cuesta filmar un anuncio y si alcanza con el saldo guardado. Pasa `clips` (cuántos clips se van a filmar) o `planId` (cuenta las tomas con texto de ese anuncio que faltan filmar, suma el costo según la duración de cada una y lista los escenarios sin imagen confirmada, cuyo costo NO se suma). Si llegan los dos, se usa planId. alcanza null significa que el saldo nunca se leyó, no que no alcance. No filma ni reserva nada.',
    parametros: [
      { nombre: 'clips', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'Cantidad de clips a filmar.' },
      { nombre: 'planId', tipo: 'string', max: 80, descripcion: 'Alternativa a clips: el anuncio del que se cuentan las tomas sin filmar (de listar_anuncios_video).' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: GATING,
  },
];
