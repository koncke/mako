// =============================================================================
// api-mako/areas/contenido.def — las operaciones del área `contenido` (definiciones)
// =============================================================================
// Una entrada por operación: id, qué es, parámetros, por qué canales sale, cómo se
// confirma. SIN server-only y sin importar valores de módulos que lo tengan: esto
// lo importan los tests y el generador de la referencia. Los cuerpos van en
// contenido.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// Qué hay en esta área (Content Machine: Ads Writer, Reels, Carousels, Stories):
//   · Los ANUNCIOS PLANTEADOS: cada cruce avatar × motivación de compra es un anuncio
//     en potencia, con su copy, sus formatos de imagen/video y sus GUIONES de video.
//     Todo vive en UNA clave JSON por workspace (app_settings 'mako.razones'): no hay
//     filas, ni índices, ni paginación. Un guion se identifica por el PAR
//     (celdaId, guionId), nunca solo por guionId.
//   · Los catálogos con los que MaKo escribe (ángulos, estructuras, formatos, los
//     siguientes pasos del funnel) y el estado del onboarding de cada tab.
//   · ⚠️ Ya NO el borrador de publicación de Instagram (`crear_borrador_instagram`):
//     salió el 06/10/2026 con la tab Instagram (decisión de Martín). Las tres tabs de
//     orgánico escriben la pieza y la persona la publica a mano.
//
// Decisiones:
//   · Los nombres internos («la matriz») NO aparecen en lo que lee el cliente: se
//     habla de «anuncios planteados» y de «avatar × motivación de compra».
//   · Escribir un guion con IA entra porque la función de lib existe Y persiste (lo
//     agrega en borrador sin pisar nada). El «en un clic» es `chat` (sin campos
//     libres, resultado borrable); el guiado (ángulo, estructura, respuestas, nota)
//     es `pantalla`. Elegir formato y recomendar formatos son `chat`: un campo de
//     UNA celda o las recomendaciones del negocio, regenerables.
//   · Editar el texto y BORRAR un guion son `pantalla` + admin: texto libre largo que
//     pisa la versión anterior (no hay historial), y borrar no tiene papelera.
//   · NO entran (ver omitidas en la cosecha): regenerar o guardar la matriz entera
//     (reemplazo total que borra guiones), generar reels/carruseles/stories (el motor
//     es lib pero la persistencia y el envío viven en app/reels y app/stories, y las
//     piezas de carrusel/story no se guardan), cargar guiones propios (orquestador en
//     app/video-generator), el copywriting del dueño (plataforma, owner-only), marcar
//     pasos de onboarding a mano, YouTube y el anuncio de Meta (otras áreas).
//   · Sin `http`: lo que invoca un modelo AL LEER (sugerir_guion_anuncio); lo que al
//     confirmar encadena tres modelos (escribir_guion_anuncio_auto: /api/v1 corta a 60 s);
//     y las lecturas que reciben un guion entero (por HTTP van por GET y el texto no
//     entra en la URL).
//   · ⚠️ escribir_guion_anuncio se confirma en /mako/revisar/[id], que HOY no exporta
//     maxDuration: una escritura con IA de ~50 s puede cortarse ahí (deuda fuera del área).
//   · `gating.tab`: 'ads-writer' para todo lo de anuncios; 'reels' para los límites
//     de formato de Instagram (era 'instagram', una tab que ya no existe: una
//     `gating.tab` sin tab no la ve ninguna capa con lista de tabs). `rolMinimo:
//     'admin'` en todo lo de anuncios: las rutas y server actions de estas tabs ya
//     exigen admin del workspace.
// =============================================================================

import type { OperacionDef, Parametro } from '../tipos';
import { ESTADOS_GUION } from '@/lib/guion-estado';

const TODOS = ['whatsapp', 'app', 'http'] as const;
const SIN_HTTP = ['whatsapp', 'app'] as const;
const G_ADS = { tab: 'ads-writer', rolMinimo: 'admin' } as const;

/** Los estados del pipeline de un guion. lib/guion-estado.ts NO lleva server-only (vive
 *  aparte de razones.ts justamente para esto), así que se importa: una copia a mano se
 *  queda vieja. El runner vuelve a validar con esEstadoGuion. */
const ESTADOS = ESTADOS_GUION;

const CELDA: Parametro = { nombre: 'celdaId', tipo: 'string', obligatorio: true, max: 80, descripcion: 'id del anuncio planteado (celdaId, un uuid). Sale de listar_anuncios_planteados.', ejemplo: '3f1c2a9e-7b1d-4c55-9a0e-2d6f7e8a9b10' };
/** Editar y borrar: la huella del texto que se leyó. La pantalla genérica deja editar
 *  celdaId y guionId y vuelve a preparar con lo editado; sin esto se podía borrar un
 *  guion que la persona nunca vio, o pisar una edición hecha desde la tab. */
const HUELLA: Parametro = { nombre: 'huella', tipo: 'string', obligatorio: true, max: 40, descripcion: 'Huella del texto del guion tal como se leyó: el campo huella de leer_guion_anuncio (o de listar_guiones_anuncio / ver_anuncio_planteado), copiado tal cual. Si el guion cambió o celdaId/guionId apuntan a otro, no se aplica.', ejemplo: '9f86d081884c7d65' };
const GUION: Parametro = { nombre: 'guionId', tipo: 'string', obligatorio: true, max: 80, descripcion: 'id del guion DENTRO de ese anuncio (sale de ver_anuncio_planteado o listar_guiones_anuncio). Siempre va junto con celdaId.', ejemplo: 'b2c4d6e8-1a3b-4c5d-8e9f-0a1b2c3d4e5f' };

export const DEFS: readonly OperacionDef[] = [
  // ── Lecturas: anuncios planteados y guiones ────────────────────────────────
  {
    id: 'listar_anuncios_planteados', area: 'contenido', tipo: 'lectura',
    titulo: 'Anuncios planteados del negocio',
    descripcion: 'Lista los anuncios planteados del negocio: cada cruce avatar × motivación de compra, con su celdaId, el avatar, la motivación, el copy/hook, los formatos de imagen y de video elegidos, cuántos guiones tiene y el estado más avanzado de esos guiones. Úsalo para «¿qué anuncios tengo planteados y cuáles ya tienen guion?» y SIEMPRE antes de escribir, mover o borrar un guion: de aquí salen los celdaId. No trae el texto de los guiones (para eso, ver_anuncio_planteado y leer_guion_anuncio).',
    parametros: [
      { nombre: 'avatarId', tipo: 'string', max: 80, descripcion: 'Filtra a los anuncios de un solo avatar (id del avatar, aparece en cada anuncio de esta misma lista).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADS,
  },
  {
    id: 'ver_anuncio_planteado', area: 'contenido', tipo: 'lectura',
    titulo: 'Ficha de un anuncio planteado',
    descripcion: 'La ficha completa de UN anuncio planteado: avatar (segmento, situación, dolor), motivación de compra a fondo, copy/hook, formato de imagen y de video elegidos con su descripción, y la lista de sus guiones (guionId, ángulo, estructura, estado, fecha, cantidad de palabras y el comienzo del texto). Úsalo cuando ya tienes el celdaId y la persona pregunta por ese anuncio en particular.',
    parametros: [CELDA],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADS,
  },
  {
    id: 'listar_guiones_anuncio', area: 'contenido', tipo: 'lectura',
    titulo: 'Guiones de anuncio del negocio',
    descripcion: 'Todos los guiones de video de todos los anuncios planteados, en una sola lista con el avatar y la motivación de la que salió cada uno, filtrable por estado del pipeline (borrador, aprobado, grabado, publicado), rango de fechas, avatar, ángulo o anuncio. Úsalo para «¿qué guiones quedaron en borrador?», «¿qué guiones escribimos esta semana?» o «¿cuántos publicados tengo?». Trae el comienzo del texto y la huella, no el guion entero (para eso, leer_guion_anuncio). Las fechas son las de CREACIÓN del guion, por día en la zona horaria del negocio: no se registra cuándo cambió de estado, así que «qué grabamos esta semana» NO se contesta con este filtro. Los guiones viejos sin fecha quedan fuera de cualquier filtro de fechas.',
    parametros: [
      { nombre: 'estado', tipo: 'string', enum: ESTADOS, descripcion: 'Filtra por estado del pipeline.' },
      { nombre: 'desde', tipo: 'string', max: 10, descripcion: 'Día inicial de CREACIÓN del guion, YYYY-MM-DD, inclusive (día de la zona horaria del negocio). No es el día en que cambió de estado.', ejemplo: '2026-09-01' },
      { nombre: 'hasta', tipo: 'string', max: 10, descripcion: 'Día final de CREACIÓN del guion, YYYY-MM-DD, inclusive.', ejemplo: '2026-09-15' },
      { nombre: 'avatarId', tipo: 'string', max: 80, descripcion: 'Filtra por avatar (id del avatar, de listar_anuncios_planteados).' },
      { nombre: 'anguloId', tipo: 'string', max: 80, descripcion: 'Filtra por ángulo de guion (id, de catalogo_angulos_guion).' },
      { nombre: 'celdaId', tipo: 'string', max: 80, descripcion: 'Filtra a los guiones de un solo anuncio planteado.' },
      { nombre: 'limite', tipo: 'number', entero: true, minimo: 1, maximo: 200, descripcion: 'Cuántos devolver como máximo (default 50, los más nuevos primero). La respuesta dice cuántos quedaron afuera.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADS,
  },
  {
    id: 'leer_guion_anuncio', area: 'contenido', tipo: 'lectura',
    titulo: 'Leer un guion de anuncio',
    descripcion: 'El texto completo de UN guion, partido en sus bloques (GANCHO, HISTORIA, CTA… según la estructura con la que se escribió), con su ángulo, estructura, estado, fecha, el siguiente estado posible del pipeline y el cierre (lo que dice el llamado a la acción). Úsalo cuando la persona pide «léeme el guion de…» o antes de proponer editarlo o moverlo de estado.',
    parametros: [CELDA, GUION],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADS,
  },
  {
    id: 'cobertura_guiones_anuncio', area: 'contenido', tipo: 'lectura',
    titulo: 'Cobertura de guiones de anuncio',
    descripcion: 'El resumen de cómo viene el negocio con sus anuncios: cuántos anuncios planteados hay, cuántos tienen al menos un guion, cuáles no tienen ninguno (con su celdaId, listos para escribir) y cuántos guiones hay en cada estado del pipeline. Úsalo para «¿cómo vengo con los anuncios?» sin volcar la lista entera. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADS,
  },
  {
    id: 'catalogo_angulos_guion', area: 'contenido', tipo: 'lectura',
    titulo: 'Ángulos para escribir un guion',
    descripcion: 'La biblioteca de ÁNGULOS con los que MaKo escribe un guion de anuncio (dolor, lead magnet, testimonio, retargeting…): id, nombre, cuándo usarlo, qué tiene que existir en el negocio para usarlo con honestidad y qué estructuras le calzan. Úsalo para explicar por qué se eligió un ángulo o para que la persona fije uno antes de escribir_guion_anuncio. Son ángulos de tráfico frío de Meta, no de contenido orgánico. Distinto de listar_angulos_guion (el vocabulario del análisis de anuncios).',
    parametros: [
      { nombre: 'soloActivos', tipo: 'boolean', descripcion: 'Default true: solo los que se ofrecen al escribir. false incluye los apagados.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: 'ads-writer' },
  },
  {
    id: 'catalogo_estructuras_guion', area: 'contenido', tipo: 'lectura',
    titulo: 'Estructuras para escribir un guion',
    descripcion: 'La biblioteca de ESTRUCTURAS de guion (Gancho → Historia → CTA, PAS, AIDA, BAB…): id, nombre, cuándo conviene y los rótulos de bloque en orden. Los rótulos son los que parten un guion en bloques: un texto editado que los pierde deja de mostrarse por bloques. Úsalo para decir con qué esqueleto se escribió un guion o para elegir uno antes de escribir_guion_anuncio.',
    parametros: [
      { nombre: 'soloActivas', tipo: 'boolean', descripcion: 'Default true: solo las que se ofrecen al escribir.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: 'ads-writer' },
  },
  {
    id: 'listar_formatos_creativo', area: 'contenido', tipo: 'lectura',
    titulo: 'Formatos de creativo y recomendados',
    descripcion: 'La biblioteca fija de FORMATOS de creativo, que dicen cómo se VE el anuncio: de imagen (comparación, antes y después, checklist…) y de video (hook de problema, testimonio hablado, demo, mini-VSL…), con descripción y ejemplo; más los que MaKo ya recomendó para este negocio (formato, para qué caso y por qué). Úsalo para «¿en qué formato conviene hacer este anuncio?». Si no hay recomendaciones, se generan con recomendar_formatos_creativo.',
    parametros: [
      { nombre: 'medio', tipo: 'string', enum: ['imagen', 'video'], descripcion: 'Filtra la biblioteca por medio. Sin esto, trae los dos.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADS,
  },
  {
    id: 'opciones_siguiente_paso_guion', area: 'contenido', tipo: 'lectura',
    titulo: 'Siguientes pasos para el CTA',
    descripcion: 'La lista CERRADA de lo que la persona recibe al hacer clic en el anuncio (agenda una llamada, ve un video de ventas, recibe un recurso por WhatsApp…), con el default del funnel del negocio primero. Es de donde se elige SIEMPRE el siguientePaso de escribir_guion_anuncio, copiando el texto exacto: nunca un texto libre. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_ADS,
  },
  {
    id: 'sugerir_guion_anuncio', area: 'contenido', tipo: 'lectura',
    titulo: 'MaKo prepara un guion',
    descripcion: 'Para UN anuncio planteado, MaKo elige el mejor ángulo (respetando sus requisitos contra lo que el negocio de verdad tiene, y distinto de los que ese anuncio ya usó), la estructura compatible, el siguiente paso del funnel, y arma hasta 3 preguntas CERRADAS con 2 a 4 opciones ya redactadas. NO escribe el guion ni guarda nada: es el paso previo a escribir_guion_anuncio cuando la persona quiere decidir algo. Con anguloId fijo, solo arma las preguntas de ese ángulo. Invoca un modelo y puede tardar hasta un minuto.',
    parametros: [
      CELDA,
      { nombre: 'anguloId', tipo: 'string', max: 80, descripcion: 'Fija el ángulo (la persona ya lo eligió, de catalogo_angulos_guion); MaKo solo arma sus preguntas.' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'ia', gating: G_ADS, lenta: true,
  },
  {
    id: 'separar_guiones_pegados', area: 'contenido', tipo: 'lectura',
    titulo: 'Separar guiones de un texto',
    descripcion: 'Parte un texto pegado (un documento con «Guion 1: …», encabezados o separadores ---) en guiones sueltos, limpia el formato de archivo sin cambiar palabras y marca cuáles están repetidos dentro del texto y cuáles ya estaban guardados en el negocio. Determinista, sin IA, no guarda nada. Úsalo para decirle a la persona «encontré 5, dos repetidos» antes de cargarlos desde la tab. Un texto sin marcas es UN guion; menos de 25 palabras no cuenta como guion.',
    parametros: [
      { nombre: 'texto', tipo: 'string', obligatorio: true, max: 60000, descripcion: 'El texto crudo pegado, tal cual.' },
    ],
    // Sin http: por HTTP una lectura va por GET con el texto en la query string, y un
    // guion pegado real pasa el tope de URL de la plataforma (~14 KB) antes del runner.
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: G_ADS,
  },
  {
    id: 'extraer_cierre_guion', area: 'contenido', tipo: 'lectura',
    titulo: 'Cierre (CTA) de un guion',
    descripcion: 'Devuelve el cierre de un guion, la parte que dice a dónde manda a la gente y que no se toca al adaptar: por rótulo (CTA, ACCIÓN, LLAMADO, CIERRE) si lo tiene, o las últimas frases si no. Con «adaptada», además compara: qué palabras de llamado a la acción metió la versión nueva que el original no tenía (un formulario, un WhatsApp, una descarga que el negocio no ofrece) y qué tanto conserva del contenido (0 a 1). Úsalo antes de proponer una reescritura con editar_texto_guion_anuncio.',
    parametros: [
      { nombre: 'texto', tipo: 'string', obligatorio: true, max: 20000, descripcion: 'El guion completo (el original).' },
      { nombre: 'adaptada', tipo: 'string', max: 20000, descripcion: 'La versión reescrita, para compararla contra el original.' },
    ],
    // Sin http: mismo tope de URL que separar_guiones_pegados.
    salida: 'json', canales: SIN_HTTP, costo: 'gratis',
  },

  // ── Lecturas: estado de las tabs y límites de Instagram ────────────────────
  {
    id: 'estado_contexto_contenido', area: 'contenido', tipo: 'lectura',
    titulo: 'Contexto del negocio para contenido',
    descripcion: 'Dice si el perfil del negocio tiene al menos un grupo con datos (listo) y qué grupos siguen vacíos, que es lo que usa MaKo para escribir reels, carruseles y stories aterrizados. Úsalo antes de escribir contenido para decir QUÉ falta completar, no un genérico «completa tu perfil». Con el perfil vacío las piezas salen genéricas. No requiere parámetros.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis',
  },
  {
    id: 'estado_onboarding_contenido', area: 'contenido', tipo: 'lectura',
    titulo: 'Onboarding de una tab de contenido',
    descripcion: 'El estado del onboarding de una tab de la Content Machine: qué pasos están hechos, cuáles faltan (los opcionales van marcados) y si la tab ya está lista. Ads Writer tiene 5 pasos (lead magnet, avatares, cara de marca, personalidad y anuncios planteados); Reels, Carousels y Stories piden contexto y un primer ensayo. Úsalo para saber si el cliente ya puede escribir anuncios o hay que mandarlo a configurar. Con Ads Writer pendiente, el Video Generator tampoco abre.',
    parametros: [
      { nombre: 'tab', tipo: 'string', obligatorio: true, enum: ['ads-writer', 'reels', 'carousels', 'stories'], descripcion: 'La tab a consultar.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis',
  },
  {
    id: 'limites_formato_instagram', area: 'contenido', tipo: 'lectura',
    titulo: 'Límites técnicos de Instagram',
    descripcion: 'Los límites técnicos de cada formato de Instagram: reel (duración máxima en segundos, peso en MB, códec), carrusel (2 a 10 elementos, mezcla de imagen y video) o story (9:16, duración y peso, y que stickers, encuestas y links se agregan a mano en la app). Incluye el tope de caption y que las imágenes van solo en JPEG. Úsalo para «¿puedo poner una encuesta en la story?» o «¿cuánto puede durar el reel?». MaKo no publica en Instagram: la persona sube la pieza a mano.',
    parametros: [
      { nombre: 'formato', tipo: 'string', obligatorio: true, enum: ['reel', 'carrusel', 'story'], descripcion: 'El formato a consultar.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: 'reels' },
  },

  // ── Acciones chat: una entidad identificada, reversible o regenerable ──────
  {
    id: 'mover_estado_guion_anuncio', area: 'contenido', tipo: 'accion',
    titulo: 'Mover un guion de estado',
    descripcion: 'Cambia el estado de producción de UN guion (borrador → aprobado → grabado → publicado), identificado por celdaId y guionId. Úsalo cuando la persona dice «ese guion ya lo grabé», «ya está publicado» o «apruébalo». Se puede retroceder. El estado es declarativo: «publicado» no crea ni verifica nada en Meta. Antes: celdaId y guionId de listar_guiones_anuncio. Queda pendiente hasta que la persona confirme.',
    parametros: [CELDA, GUION, { nombre: 'estado', tipo: 'string', obligatorio: true, enum: ESTADOS, descripcion: 'El estado nuevo del guion.' }],
    confirmacion: 'chat', reversible: true,
    escribe: 'cambia el estado de un guion dentro de app_settings mako.razones (relee antes de escribir)',
    canales: TODOS, costo: 'gratis', gating: G_ADS,
  },
  {
    id: 'escribir_guion_anuncio_auto', area: 'contenido', tipo: 'accion',
    titulo: 'MaKo escribe un guion solo',
    descripcion: 'Para UN anuncio planteado, MaKo elige ángulo, estructura y siguiente paso del funnel, elige el formato de video si el anuncio no tenía, y escribe un guion hablado de 30 a 90 segundos con la voz de la personalidad del negocio, marcado por bloques. Lo agrega en borrador sin pisar nada. Úsalo cuando la persona dice «escríbeme el guion de…» sin querer decidir nada; si quiere elegir el ángulo o contestar preguntas, usa sugerir_guion_anuncio y escribir_guion_anuncio. Al confirmar invoca hasta tres modelos en serie y puede tardar cerca de un minuto. Antes: celdaId de listar_anuncios_planteados.',
    parametros: [CELDA],
    // reversible false: además del guion, fija el formato de video del anuncio, y borrar
    // el guion es una acción de pantalla solo para admin. Sin http: al confirmar encadena
    // tres modelos y /api/v1 corta a los 60 s (ver helpers, presupuesto total).
    confirmacion: 'chat', reversible: false,
    escribe: 'agrega un guion en borrador al anuncio en app_settings mako.razones y, si faltaba, fija su formato de video',
    canales: SIN_HTTP, costo: 'ia', gating: G_ADS, lenta: true,
  },
  {
    id: 'elegir_formato_creativo_anuncio', area: 'contenido', tipo: 'accion',
    titulo: 'MaKo elige formato de un anuncio',
    descripcion: 'Para UN anuncio planteado, MaKo elige UN formato de la biblioteca (de imagen o de video) según el avatar, la motivación y el lead magnet, y lo guarda en el anuncio reemplazando el que tuviera. Es el formato que sigue el guion de video. Solo ELIGE el formato: no genera la imagen ni el video. Úsalo cuando la persona pide «elige cómo hacer la imagen de este anuncio». Antes: celdaId de listar_anuncios_planteados. El formato anterior no se guarda en otro lado: se puede volver a elegir, no recuperar.',
    parametros: [CELDA, { nombre: 'medio', tipo: 'string', obligatorio: true, enum: ['imagen', 'video'], descripcion: 'Qué formato elegir.' }],
    confirmacion: 'chat', reversible: false,
    escribe: 'cambia anguloImagen o anguloVideo del anuncio en app_settings mako.razones',
    canales: TODOS, costo: 'ia', gating: G_ADS,
  },
  {
    id: 'recomendar_formatos_creativo', area: 'contenido', tipo: 'accion',
    titulo: 'MaKo recomienda formatos de creativo',
    descripcion: 'A nivel negocio (no por anuncio), MaKo elige de la biblioteca los formatos de creativo que mejor le sirven según sus motivaciones de compra y su lead magnet, con para qué y por qué cada uno, y REEMPLAZA las recomendaciones guardadas. No cambia ningún anuncio. Requiere tener anuncios planteados. Úsalo cuando la persona pide ideas de formatos o las recomendaciones están vacías. Las anteriores no se guardan en otro lado.',
    parametros: [],
    confirmacion: 'chat', reversible: false,
    escribe: 'reemplaza las recomendaciones de formatos en app_settings mako.formatos_recom',
    canales: TODOS, costo: 'ia', gating: G_ADS,
  },

  // ── Acciones pantalla: texto libre, varias decisiones, borrar ──────────────
  {
    id: 'escribir_guion_anuncio', area: 'contenido', tipo: 'accion',
    titulo: 'Escribir un guion con decisiones',
    descripcion: 'Escribe un guion para UN anuncio planteado con lo que la persona decidió: ángulo, estructura, siguiente paso del funnel (texto exacto de opciones_siguiente_paso_guion), respuestas a las preguntas cerradas de sugerir_guion_anuncio y una nota libre de qué quiere comunicar. Lo que no venga lo completa MaKo con el default. Lo agrega en borrador sin pisar nada. Flujo: sugerir_guion_anuncio → la persona contesta → esta. Deja un link para revisar y confirmar; al confirmar invoca un modelo.',
    parametros: [
      CELDA,
      { nombre: 'anguloId', tipo: 'string', max: 80, descripcion: 'id del ángulo (de catalogo_angulos_guion). Sin esto, el primero activo.' },
      { nombre: 'estructuraId', tipo: 'string', max: 80, descripcion: 'id de la estructura (de catalogo_estructuras_guion). Sin esto, la primera compatible con el ángulo.' },
      { nombre: 'siguientePaso', tipo: 'string', max: 300, descripcion: 'Texto EXACTO de una opción de opciones_siguiente_paso_guion. Sin esto, el default del funnel.' },
      {
        nombre: 'respuestasAngulo', tipo: 'object[]', max: 6,
        descripcion: 'Respuestas de la persona a las preguntas cerradas de sugerir_guion_anuncio.',
        campos: [
          { nombre: 'pregunta', tipo: 'string', obligatorio: true, max: 300, descripcion: 'La pregunta, tal como la devolvió sugerir_guion_anuncio.' },
          { nombre: 'respuesta', tipo: 'string', obligatorio: true, max: 500, descripcion: 'La opción elegida (o lo que respondió la persona).' },
        ],
      },
      { nombre: 'nota', tipo: 'string', max: 1500, descripcion: 'Qué quiere comunicar la persona con este anuncio. Manda sobre cualquier default.' },
    ],
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    escribe: 'agrega un guion en borrador al anuncio en app_settings mako.razones y, si faltaba, fija su formato de video',
    canales: TODOS, costo: 'ia', gating: G_ADS, lenta: true,
  },
  {
    id: 'editar_texto_guion_anuncio', area: 'contenido', tipo: 'accion',
    titulo: 'Reescribir el texto de un guion',
    descripcion: 'Reemplaza el texto COMPLETO de UN guion sin tocar el resto. Úsalo cuando la persona corrige frases o pega su propia versión. Para que siga mostrándose por bloques, el texto tiene que conservar los rótulos de su estructura en MAYÚSCULA, cada uno en su propia línea. La versión anterior se pierde (no hay historial): antes de proponer una reescritura, revisa con extraer_cierre_guion que no cambie a dónde manda a la gente. Antes: leer_guion_anuncio, de donde sale la huella; si alguien edita el guion antes de confirmar, no se aplica. Deja un link para revisar y confirmar.',
    parametros: [CELDA, GUION, HUELLA, { nombre: 'texto', tipo: 'string', obligatorio: true, max: 12000, descripcion: 'El guion completo nuevo, con sus rótulos de bloque en su propia línea.' }],
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    escribe: 'reemplaza el texto de un guion dentro de app_settings mako.razones',
    canales: TODOS, costo: 'gratis', gating: G_ADS,
  },
  {
    id: 'borrar_guion_anuncio', area: 'contenido', tipo: 'accion',
    titulo: 'Borrar un guion de anuncio',
    descripcion: 'Elimina UN guion de su anuncio, identificado por celdaId y guionId, sin tocar los demás. No hay papelera: no se puede deshacer. Úsalo solo cuando la persona lo pide explícitamente; el resumen nombra el ángulo, el estado y el comienzo del texto para que confirme el correcto. Antes: leer_guion_anuncio o listar_guiones_anuncio, de donde sale la huella. Deja un link para revisar y confirmar.',
    parametros: [CELDA, GUION, HUELLA],
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    escribe: 'quita un guion del anuncio en app_settings mako.razones (relee antes de escribir)',
    canales: TODOS, costo: 'gratis', gating: G_ADS,
  },
];
