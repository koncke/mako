// =============================================================================
// api-mako/areas/negocio.def — las operaciones del área `negocio` (definiciones)
// =============================================================================
// Lo que el cliente le cargó a MaKo sobre su negocio: el perfil (brief) del
// Archivero, el diagnóstico de fase, los avatares, los lead magnets, la cara de
// marca, la personalidad de voz, el estado del onboarding, el Second Brain y el
// conocimiento (RAG, tutoriales, glosario).
//
// SIN server-only y sin importar valores de módulos que lo tengan: esto lo importan
// los tests y el generador de la referencia. Los cuerpos van en negocio.run.ts,
// cruzados por id. Español neutro (lo lee el cliente).
//
// ⚠️ gating.tab: el perfil, la fase y el estado del onboarding van SIN tab. La
// página /onboarding es un item del menú del usuario, no del sidebar, y la vista del
// registro mira capa.navKeys: con tab 'onboarding' la capa pm (navKeys todo+mako)
// perdería operaciones que SÍ usa (sus pasos son negocio y fase). La fábrica de
// creativos (avatares, lead magnets, persona, personalidad) va con 'ads-writer',
// que es donde vive su onboarding; el cerebro con 'second-brain'.
//
// QUEDARON AFUERA del inventario (docs/api-mako-inventario.md) y no están en NINGUNA
// área (grep de todos los *.def.ts, 16/09/2026). Qué falta y a quién le toca:
//   · agregar_web_archivero y buscar_en_segundo_cerebro_por_significado: la lógica
//     vive INLINE en la ruta (procesarLink en app/api/onboarding/archivero; el prompt
//     de app/api/second-brain/buscar), más grande que lo que un helper de área admite.
//     Primero hay que extraerla a lib/ (el prompt, editable). Área: negocio.
//   · describir_cara_de_marca (generarDescripcionPersona, lib/persona.ts): sin motivo
//     escrito por quien la dejó afuera; candidata a sumarse aquí (pantalla, costo ia).
//   · ver_voz_clonada, olvidar_voz_clonada, borrar_audio_voz: viven en
//     app/video-generator/voz-cliente.ts + ElevenLabs → área `video`.
//   · crear_plan_arranque (crearBorradorPlanArranque, lib/todo-seed-ia.ts, por
//     /plan/revisar) → área `plan`.
// =============================================================================

import type { OperacionDef } from '../tipos';
// Datos puros (sin server-only y sin imports): la def puede importar sus VALORES.
import { CANALES } from '@/lib/fase-diagnostico';
import { AREAS as AREAS_MODELO_CEREBRO } from '@/lib/cerebro-modelo';
import { PERSONALIDAD_PREGUNTAS } from '@/lib/personalidad';
// Dónde se corrige cada sección hoy (el hub de /onboarding se retiró el 15/10/2026): datos puros.
import { lugarSeccion } from '@/lib/secciones-negocio';

const TODOS = ['whatsapp', 'app', 'http'] as const;
/** Sin http: links firmados a documentos, fotos de una persona, y los generadores de
 *  preguntas que gastan la cuota de IA gratis del cliente y solo sirven en una charla. */
const SIN_HTTP = ['whatsapp', 'app'] as const;

/** Las secciones de lib/agente-contexto.ts → SECCIONES. Escritas a mano porque ese
 *  módulo lleva server-only; si se agrega una allí, se agrega aquí. */
const SECCIONES_CONTEXTO = ['razones', 'panorama', 'productos'] as const;

const AREAS_CEREBRO: readonly string[] = AREAS_MODELO_CEREBRO.map((a) => a.id);
const CANALES_VENTA: readonly string[] = CANALES.map((c) => c.id);
const KEYS_PERSONALIDAD: readonly string[] = PERSONALIDAD_PREGUNTAS.map((q) => q.key);

const RESPUESTAS_CAMPOS = [
  { nombre: 'pregunta', tipo: 'string', descripcion: 'La pregunta que hizo MaKo, tal cual.', obligatorio: true, max: 500 },
  { nombre: 'respuesta', tipo: 'string', descripcion: 'Lo que contestó la persona, en sus palabras.', obligatorio: true, max: 1000 },
] as const;

export const DEFS: readonly OperacionDef[] = [
  // ── Lecturas ────────────────────────────────────────────────────────────────
  {
    id: 'contexto_negocio', area: 'negocio', tipo: 'lectura',
    titulo: 'Contexto del negocio',
    descripcion: 'El núcleo de lo que MaKo sabe del negocio, en markdown (tope de 16 kB): qué es el negocio, en qué fase está, a quién le vende (avatares), el lead magnet, el catálogo activo y cómo suena la marca. Con `seccion` devuelve una sección grande aparte: razones (la matriz avatar × motivación, sin guiones), panorama o productos (catálogo completo). Si algo se recortó por tamaño, lo dice al final. No trae métricas. Úsala al empezar cualquier trabajo sobre el negocio en vez de preguntarle al dueño lo que ya cargó.',
    parametros: [
      { nombre: 'seccion', tipo: 'string', enum: SECCIONES_CONTEXTO, descripcion: 'Sección grande a pedir aparte. Sin esto, el núcleo.' },
    ],
    // rolMinimo admin como el resto del perfil (ver_perfil_negocio trae el mismo brief).
    salida: 'markdown', canales: TODOS, costo: 'gratis', alias: [], gating: { rolMinimo: 'admin' },
  },
  {
    id: 'ver_perfil_negocio', area: 'negocio', tipo: 'lectura',
    titulo: 'Perfil del negocio por campo',
    descripcion: 'Los campos del perfil del negocio que corresponden a su plan (a qué se dedica, objetivo a 90 días, freno, oferta, cliente ideal, personaje de marca), cada uno con su clave, su grupo, la pregunta con la que se pide y su valor. `valor: null` es un hueco (nunca se cargó), no un cero. Úsala antes de proponer guardar_campo_perfil: de aquí salen las claves exactas.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { rolMinimo: 'admin' },
  },
  {
    id: 'ver_archivero', area: 'negocio', tipo: 'lectura',
    titulo: 'Documentos del Archivero',
    descripcion: 'Los documentos que el negocio subió al Archivero (id, nombre, tipo, tamaño en bytes, fecha, qué entendió MaKo y cuántos campos aportó), de qué documento o edición manual salió cada campo del perfil, y qué campos del perfil de oferta y cliente siguen vacíos (huecos). Úsala para «¿de dónde sacó MaKo esto?» o «¿qué me falta completar?». No trae el texto de los documentos: no se guarda.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { rolMinimo: 'admin' },
  },
  {
    id: 'obtener_link_documento_archivero', area: 'negocio', tipo: 'lectura',
    titulo: 'Link a un documento',
    descripcion: 'Devuelve un link temporal para descargar UN documento del Archivero (vence en 120 segundos) o para verlo en línea con preview=true (300 segundos). Si el documento es una página web que se pegó, devuelve la URL original, que no vence. Úsala cuando la persona pide «mándame el documento que subí»; el id sale de ver_archivero.',
    parametros: [
      { nombre: 'id', tipo: 'string', obligatorio: true, max: 80, descripcion: 'id del documento (de ver_archivero).' },
      { nombre: 'preview', tipo: 'boolean', descripcion: 'true = link para ver en línea en vez de descargar.' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: { rolMinimo: 'admin' },
  },
  {
    id: 'generar_preguntas_huecos_perfil', area: 'negocio', tipo: 'lectura',
    titulo: 'Preguntas para los huecos',
    descripcion: 'Para los campos del perfil de oferta y cliente que ningún documento resolvió, MaKo arma UNA pregunta cerrada por campo, a medida del negocio, con 3 a 5 opciones concretas (si la IA falla, una pregunta abierta sin opciones). No guarda nada. Úsala para completar el perfil por chat de a una pregunta, y guarda cada respuesta con guardar_campo_perfil. Lista vacía = no hay huecos.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'ia', lenta: true, gating: { rolMinimo: 'admin' },
  },
  {
    id: 'ver_diagnostico_fase', area: 'negocio', tipo: 'lectura',
    titulo: 'Diagnóstico de fase del negocio',
    descripcion: 'En qué fase está el negocio (del 1 al 5, el número que se le muestra al cliente), su cuello de botella, el canal de venta, qué tan parejas fueron las respuestas (consistencia en % y si es mixto) y, de la definición de la fase, el objetivo, las prioridades críticas, el hito para avanzar y lo que no conviene hacer todavía. `diagnostico: null` si nunca hizo el diagnóstico. Úsala antes de recomendar prioridades.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { rolMinimo: 'admin' },
  },
  // La tab Offer (chat → diagnóstico → oferta → PDF). Sin http: es lo que el dueño le contó a MaKo de su
  // negocio y de sus números, y el PDF necesita la sesión de la app. Con la tab y el rol de la página
  // (requireRolWs([]) en app/offer/page.tsx). La conversación en sí NO se maneja desde acá: un turno de
  // Offer es la pantalla, con sus adjuntos y sus botones.
  {
    id: 'listar_analisis_oferta', area: 'negocio', tipo: 'lectura',
    titulo: 'Análisis de ofertas (Offer)',
    descripcion: 'Las conversaciones de la tab Offer, la más reciente primero: id, título, estado (conversando o concluida), la nota total del último diagnóstico (0-100, null si todavía no hay oferta armada) y la fecha. Úsala para «¿qué ofertas analizamos?» y para sacar el id que pide ver_analisis_oferta. Trae el link a la tab.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: { tab: 'offer', rolMinimo: 'admin' },
  },
  {
    id: 'ver_analisis_oferta', area: 'negocio', tipo: 'lectura',
    titulo: 'La conclusión de un análisis de oferta',
    descripcion: 'La última versión de la oferta que armó MaKo en la tab Offer: el diagnóstico (nota total 0-100, si está lista para vender, la dimensión más baja, la tesis, lo más fuerte y los 3 cambios), los avisos que calculó el código, el control final, y la oferta propuesta (nombre, frase, para quién, la ruta por fases, qué incluye, garantía, bonos, precio, lo que propuso MaKo y el negocio no dijo, lo que falta completar y lo que quedó provisional). Sin id, la conversación más reciente que ya tiene una oferta. El PDF se baja desde la tab (el link va en la respuesta).',
    parametros: [
      { nombre: 'id', tipo: 'number', entero: true, minimo: 1, descripcion: 'id de la conversación (de listar_analisis_oferta). Sin id, la más reciente con una oferta armada.' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: { tab: 'offer', rolMinimo: 'admin' },
  },
  {
    id: 'listar_preguntas_diagnostico_fase', area: 'negocio', tipo: 'lectura',
    titulo: 'Preguntas del diagnóstico de fase',
    descripcion: 'Las 6 preguntas del diagnóstico de fase con sus 5 opciones en orden (el índice 0-4 de la opción es la respuesta) y los canales de venta posibles. Úsala antes de proponer guardar_diagnostico_fase: las respuestas se mandan como índices, en el orden de las preguntas.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis',
  },
  {
    id: 'ver_estado_onboarding', area: 'negocio', tipo: 'lectura',
    titulo: 'Estado del onboarding',
    descripcion: 'Cómo va el arranque del negocio: estado (pending, in_progress, skipped, done), qué pasos le tocan según su plan, cuáles están hechos y cuáles postergados, y cuándo empezó y terminó. Úsala para saber si el cliente sigue en el asistente de arranque o ya entra a la app. Para lo postergado que sigue faltando, usa listar_pendientes_arranque.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { rolMinimo: 'admin' },
  },
  {
    id: 'ver_mi_plan', area: 'negocio', tipo: 'lectura',
    titulo: 'Plan de MaKo del negocio',
    descripcion: 'El plan de MaKo de este negocio y cómo se lo cobra MaKo: por Stripe o por Mercado Pago (con el monto por mes y si está activo, con la baja pedida o dado de baja), o acordado a mano. Para darlo de baja: dar_de_baja_mi_plan (se confirma en una pantalla), o el botón «Darme de baja» de Configuración del negocio → Tu plan (la respuesta trae el link).',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { rolMinimo: 'admin' },
  },
  {
    id: 'dar_de_baja_mi_plan', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Dar de baja el plan de MaKo',
    descripcion: 'PROPONE dar de baja el plan de MaKo de este negocio (lo que le cobra MaKo por Stripe o Mercado Pago), y devuelve el código de baja. En Stripe deja de cobrarse al final del mes pagado y se sigue usando hasta entonces; en Mercado Pago deja de cobrarse en el acto. Se confirma en una pantalla, nunca por el chat. Si el plan se acordó a mano, se rechaza: hay que escribirle a MaKo. Revisa antes ver_mi_plan.',
    escribe: 'programa la baja en Stripe (o cancela la suscripción en Mercado Pago), deja el código en el cobro de MaKo y el historial del lead en el CRM de MaKo',
    parametros: [],
    canales: TODOS, costo: 'externo', gating: { rolMinimo: 'admin' },
  },
  {
    id: 'listar_tabs_por_configurar', area: 'negocio', tipo: 'lectura',
    titulo: 'Tabs que faltan configurar',
    descripcion: 'Las tabs que el plan del negocio incluye y que todavía no terminó de configurar (Ads Writer, Video Generator, WhatsApp, Automations, Email…), en el orden en que conviene hacerlas y con el link a cada una. Lista vacía = no le falta configurar ninguna. Úsala para «¿qué me falta configurar?» después del onboarding.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { rolMinimo: 'admin' },
  },
  {
    id: 'listar_avatares_negocio', area: 'negocio', tipo: 'lectura',
    titulo: 'Avatares del negocio',
    descripcion: 'Los avatares del negocio (normalmente 3): id, nombre, segmento (industria, tamaño, rol, geografía), cómo se lo encuentra en Meta, su situación y su dolor principal, más lo que el dueño ya precisó sobre a quién le vende. Úsala para hablar de a quién le vende el negocio o antes de proponer editar_avatar_negocio. Es distinta de listar_avatares_guion (el vocabulario con el que se clasifican los guiones analizados).',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
  },
  {
    id: 'siguiente_pregunta_avatares', area: 'negocio', tipo: 'lectura',
    titulo: 'Siguiente pregunta sobre avatares',
    descripcion: 'Con lo que el dueño ya contestó, MaKo arma la SIGUIENTE pregunta cerrada y comparativa para precisar a quién le vende (con opciones), o dice que ya alcanza (`terminado: true`, como mucho 4 preguntas). No guarda nada. Úsala para afinar los avatares por chat de a una pregunta; al terminar, propone afinar_avatares con todas las respuestas. Si devuelve tipo «archivo», pide que lo suba en ' + lugarSeccion('avatares') + '.',
    parametros: [
      { nombre: 'historial', tipo: 'object[]', max: 10, campos: RESPUESTAS_CAMPOS, descripcion: 'Las preguntas ya contestadas, en orden. Vacío = primera pregunta.' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'ia', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
  },
  {
    id: 'listar_lead_magnets', area: 'negocio', tipo: 'lectura',
    titulo: 'Lead magnets del negocio',
    descripcion: 'Los lead magnets (entregables tangibles de la oferta): id, nombre, tipo (dashboard, planilla, documento, metodología…), qué es, la línea de FOMO para anuncios y el enlace donde está el material (`enlace: null` = no tiene dónde mandarlo). Úsala antes de escribir un anuncio o una secuencia que ofrezca algo, o antes de proponer editar_lead_magnet.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
  },
  {
    id: 'siguiente_pregunta_lead_magnet', area: 'negocio', tipo: 'lectura',
    titulo: 'Siguiente pregunta sobre lead magnet',
    descripcion: 'MaKo arma la siguiente pregunta (de a una, adaptada a lo ya contestado) para encontrar el elemento tangible de la oferta, o dice que ya alcanza (`terminado: true`, como mucho 4). No guarda nada. Al terminar, propone generar_lead_magnets con las respuestas.',
    parametros: [
      { nombre: 'historial', tipo: 'object[]', max: 10, campos: RESPUESTAS_CAMPOS, descripcion: 'Las preguntas ya contestadas, en orden. Vacío = primera pregunta.' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'ia', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
  },
  {
    id: 'ver_cara_de_marca', area: 'negocio', tipo: 'lectura',
    titulo: 'Cara de marca',
    descripcion: 'La cara de los creativos del negocio: las fotos cargadas (id y nombre) y la descripción física detallada (identidad, rostro, ojos, cabello, complexión, marcas, vestimenta, actitud). Con conLinks=true, un link firmado por foto que vence en 6 horas. Úsala para «¿cómo soy físicamente según MaKo?» o antes de pedir una imagen con esa persona. No afirmes que es el dueño: casi siempre lo es, pero no está confirmado.',
    parametros: [
      { nombre: 'conLinks', tipo: 'boolean', descripcion: 'true = incluye un link firmado (6 horas) por foto.' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
  },
  {
    id: 'ver_personalidad_voz', area: 'negocio', tipo: 'lectura',
    titulo: 'Personalidad de voz de marca',
    descripcion: 'Cómo suena la marca según el quiz de personalidad: por cada pregunta contestada, la dimensión, el rasgo elegido y la frase de ejemplo; las muletillas; cuántas preguntas están contestadas de cuántas y si el quiz está completo. Úsala antes de escribir copy con la voz del negocio. Es distinta de guia_voz_negocio (la voz del Chatbot destilada de conversaciones).',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
  },
  {
    id: 'ver_pregunta_personalidad', area: 'negocio', tipo: 'lectura',
    titulo: 'Pregunta del quiz de voz',
    descripcion: 'La pregunta número `idx` del quiz de personalidad de voz (la primera es 0) con sus opciones: frases de anuncio, cada una con su rasgo. Con personalizar=true MaKo reescribe las frases con el negocio real manteniendo el rasgo (si falla, vuelve la genérica). Úsala para hacer el quiz por chat: muestra las frases, la persona elige, y propone responder_pregunta_personalidad copiando el rasgo EXACTO de la opción elegida.',
    parametros: [
      { nombre: 'idx', tipo: 'number', obligatorio: true, entero: true, minimo: 0, maximo: PERSONALIDAD_PREGUNTAS.length - 1, descripcion: 'Índice de la pregunta, desde 0.' },
      { nombre: 'personalizar', tipo: 'boolean', descripcion: 'true = frases adaptadas al negocio (invoca un modelo).' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'ia', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
  },
  {
    id: 'buscar_en_segundo_cerebro', area: 'negocio', tipo: 'lectura',
    titulo: 'Buscar en el segundo cerebro',
    descripcion: 'Busca texto en el mapa del negocio (Second Brain): cada cosa que MaKo entendió —documentos, campos del perfil, planos del resumen, productos, avatares, razones, voz, funnel— con su id, área, etiqueta, detalle, datos y de dónde salió. Por defecto busca en el nombre; `campos` amplía a detalle, fuente o área, y `area` acota. Sin `texto`, devuelve el resumen por área (cuántos datos hay y cuántos faltan). Úsala para «¿qué sabe MaKo de mi oferta?». Devuelve como mucho 30 resultados y dice cuántos quedaron afuera.',
    parametros: [
      { nombre: 'texto', tipo: 'string', max: 200, descripcion: 'Texto a buscar (palabras en cualquier orden, sin importar tildes). Vacío = resumen por área.' },
      { nombre: 'campos', tipo: 'string[]', enum: ['nombre', 'detalle', 'fuente', 'area'], max: 4, descripcion: 'Dónde buscar. Default: solo el nombre.' },
      { nombre: 'area', tipo: 'string', enum: AREAS_CEREBRO, descripcion: 'Acota a un área del mapa.' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', lenta: true, gating: { tab: 'second-brain', rolMinimo: 'admin' },
  },
  {
    id: 'leer_segundo_cerebro_como_archivos', area: 'negocio', tipo: 'lectura',
    titulo: 'Segundo cerebro en markdown',
    descripcion: 'El segundo cerebro de las áreas pedidas como archivos markdown (la misma estructura del ZIP que se abre en Obsidian): la ruta de cada archivo con su frontmatter, sus datos y enlaces [[wiki]] a sus vecinos. Tope de 60 000 caracteres: si se pasa, lista las rutas que quedaron afuera. Úsala cuando necesitas el detalle completo de un área, no para una pregunta puntual (para eso, buscar_en_segundo_cerebro).',
    parametros: [
      { nombre: 'areas', tipo: 'string[]', enum: AREAS_CEREBRO, max: 11, descripcion: 'Áreas a incluir. Vacío = todas (puede pesar decenas de kB).' },
    ],
    salida: 'markdown', canales: TODOS, costo: 'gratis', lenta: true, gating: { tab: 'second-brain', rolMinimo: 'admin' },
  },
  {
    id: 'ver_glosario_negocio', area: 'negocio', tipo: 'lectura',
    titulo: 'Glosario del negocio',
    descripcion: 'Los términos, siglas y apodos propios del negocio con su significado (por ejemplo «Artemisa = el grabador de reuniones»). Solo los de este negocio. Úsala antes de interpretar una reunión o un mensaje con jerga, y antes de proponer guardar_termino_glosario para no duplicar. Tope de 500 términos, avisado si se pasa.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis',
  },
  // Heredadas de MAKO_TOOLS (lib/mako-tools.ts): id y salida EXACTOS.
  {
    id: 'buscar_conocimiento', area: 'negocio', tipo: 'lectura',
    titulo: 'Buscar en la metodología',
    descripcion: 'Busca en la metodología y el conocimiento cargado de MaKo (RAG): devuelve las 5 entradas más parecidas a la consulta, del negocio y del método curado. Úsala antes de dar una recomendación para apoyarte en el método real, no en generalidades. «No encontré nada relevante» también puede significar que la búsqueda no pudo correr.',
    parametros: [
      { nombre: 'query', tipo: 'string', obligatorio: true, max: 500, descripcion: 'Qué buscar en el conocimiento (el parámetro se llama `query`).' },
      { nombre: 'area', tipo: 'string', enum: ['mensajes', 'ads', 'general'], descripcion: 'Opcional, para acotar el área.' },
    ],
    salida: 'markdown', canales: TODOS, costo: 'ia',
  },
  {
    id: 'buscar_tutorial', area: 'negocio', tipo: 'lectura',
    titulo: 'Buscar un tutorial en video',
    descripcion: 'Busca un tutorial EN VIDEO (YouTube, en español) sobre algo que está FUERA de MaKo: instalar el píxel de Meta en su propia web, configurar Vercel o WordPress, crear un Business Manager. Úsala SIEMPRE que pidan un «cómo se hace» de una herramienta de terceros, en vez de escribir el paso a paso. Devuelve título, canal, año y link de hasta 3 videos: pásalos tal cual, sin reescribir el link.',
    parametros: [
      { nombre: 'tema', tipo: 'string', obligatorio: true, max: 200, descripcion: 'Qué tutorial buscar, en español y concreto (el parámetro se llama `tema`). Ej.: «instalar pixel de meta en landing page».' },
    ],
    salida: 'texto', canales: TODOS, costo: 'externo',
  },

  // ── Acciones por chat ─────────────────────────────────────────────────────
  {
    id: 'responder_pregunta_personalidad', area: 'negocio', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Responder una pregunta del quiz',
    descripcion: 'PROPONE guardar la opción que eligió la persona en UNA pregunta del quiz de personalidad de voz (de ver_pregunta_personalidad): la key de la pregunta y el rasgo EXACTO de la opción, más la frase elegida. Contestar de nuevo la misma pregunta reemplaza la respuesta. Si el rasgo no es uno de los de esa pregunta, se rechaza y devuelve los válidos. Queda pendiente hasta que la persona confirme.',
    parametros: [
      { nombre: 'key', tipo: 'string', obligatorio: true, enum: KEYS_PERSONALIDAD, descripcion: 'key de la pregunta (de ver_pregunta_personalidad).' },
      { nombre: 'rasgo', tipo: 'string', obligatorio: true, max: 300, descripcion: 'El rasgo de la opción elegida, copiado tal cual.' },
      { nombre: 'texto', tipo: 'string', max: 300, descripcion: 'La frase que eligió la persona.' },
    ],
    canales: TODOS, costo: 'gratis', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
    escribe: 'una respuesta del quiz en la personalidad de voz del negocio (mako.personalidad)',
  },

  // ── Acciones por pantalla ────────────────────────────────────────────────
  {
    id: 'guardar_campo_perfil', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Completar un campo del perfil',
    descripcion: 'PROPONE completar UN campo VACÍO del perfil del negocio (clave de ver_perfil_negocio) con lo que dijo la persona. Solo huecos: si el campo ya tiene valor se rechaza, y corregirlo se hace en ' + lugarSeccion('archivero') + '. Lo guardado a mano gana sobre lo que MaKo saque después de los documentos. Deja un link para revisar el texto exacto y confirmar.',
    parametros: [
      { nombre: 'key', tipo: 'string', obligatorio: true, max: 80, descripcion: 'Clave del campo (de ver_perfil_negocio), por ejemplo «oferta_garantia».' },
      { nombre: 'valor', tipo: 'string', obligatorio: true, max: 2000, descripcion: 'El valor, en palabras de la persona.' },
    ],
    canales: TODOS, costo: 'gratis', gating: { rolMinimo: 'admin' },
    escribe: 'una edición manual del perfil (mako.archivero.manual) y recalcula el brief sin pisar lo que no vino del Archivero',
  },
  {
    id: 'borrar_documento_archivero', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Borrar un documento del Archivero',
    descripcion: 'PROPONE borrar UN documento del Archivero (el archivo y su registro). El perfil se recalcula: se va lo que ese documento aportó, salvo lo editado a mano. El resumen del negocio (panorama) NO se rehace sin ese documento; solo se vacía si era el último. No se puede deshacer. Deja un link para revisar y confirmar.',
    parametros: [
      { nombre: 'id', tipo: 'string', obligatorio: true, max: 80, descripcion: 'id del documento (de ver_archivero).' },
    ],
    canales: TODOS, costo: 'gratis', gating: { rolMinimo: 'admin' },
    escribe: 'borra la fila de archivero_files y su binario, recalcula el brief y puede vaciar el panorama',
  },
  {
    id: 'guardar_diagnostico_fase', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Guardar el diagnóstico de fase',
    descripcion: 'PROPONE guardar (o rehacer) el diagnóstico de fase del negocio con las 6 respuestas como índices de opción (de listar_preguntas_diagnostico_fase) y el canal de venta. MaKo recalcula la fase y el cuello de botella: no se acepta una fase dicha a mano. Cambia el Norte con el que MaKo y el Perro Guardián priorizan. Sin canal, conserva el guardado. No toca el funnel. Deja un link para revisar y confirmar.',
    parametros: [
      { nombre: 'respuestas', tipo: 'string[]', obligatorio: true, max: 6, enum: ['0', '1', '2', '3', '4'], descripcion: 'Exactamente 6 índices de opción (0 a 4), uno por pregunta y en orden. Ej.: ["1","0","2","1","1","3"].' },
      { nombre: 'canal', tipo: 'string', enum: CANALES_VENTA, descripcion: 'Canal de venta principal.' },
    ],
    canales: TODOS, costo: 'gratis', gating: { rolMinimo: 'admin' },
    escribe: 'el diagnóstico de fase del negocio (negocio.fase.diagnostico)',
  },
  {
    id: 'generar_avatares', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Regenerar los avatares con MaKo',
    descripcion: 'PROPONE que MaKo arme de nuevo los avatares del negocio (3 segmentos distintos, segmentables en Meta) con el perfil, el panorama, la fase y lo que el dueño ya precisó. REEMPLAZA los avatares actuales: lo editado a mano se pierde, y los ids se conservan por POSICIÓN, así que las razones de compra existentes quedan colgadas del avatar que ocupe su lugar aunque sea otro segmento. Deja un link para confirmar; al confirmar invoca IA.',
    parametros: [],
    canales: TODOS, costo: 'ia', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
    escribe: 'reescribe la lista completa de avatares (mako.avatares)',
  },
  {
    id: 'afinar_avatares', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Afinar los avatares con respuestas',
    descripcion: 'PROPONE sumar las respuestas del dueño sobre a quién le vende (de siguiente_pregunta_avatares) al contexto de avatares y regenerarlos con eso. Lo precisado se ACUMULA (sin repetir líneas) y no se puede borrar desde ninguna pantalla; si la IA falla, no se guarda nada. Los avatares SÍ se reemplazan (ids conservados por posición). Deja un link para revisar las respuestas y confirmar; al confirmar invoca IA.',
    parametros: [
      { nombre: 'respuestas', tipo: 'object[]', obligatorio: true, max: 10, campos: RESPUESTAS_CAMPOS, descripcion: 'Las preguntas contestadas por la persona, en orden.' },
    ],
    canales: TODOS, costo: 'ia', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
    escribe: 'agrega al contexto de avatares (mako.avatares.contexto) y reescribe la lista de avatares',
  },
  {
    id: 'editar_avatar_negocio', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Editar un avatar del negocio',
    descripcion: 'PROPONE cambiar los datos de UN avatar del negocio identificado por id (nombre, segmento, cómo se encuentra en Meta, situación, dolor); lo que no venga conserva su valor. Sin id, agrega un avatar nuevo (entonces el nombre es obligatorio). Deja un link para revisar y confirmar. Para el vocabulario de guiones, usa proponer_editar_avatar.',
    parametros: [
      { nombre: 'id', tipo: 'string', max: 80, descripcion: 'id del avatar (de listar_avatares_negocio). Sin id, se agrega uno.' },
      { nombre: 'nombre', tipo: 'string', max: 120, descripcion: 'Nombre corto del avatar.' },
      { nombre: 'segmento', tipo: 'string', max: 600, descripcion: 'Industria, tamaño, rol y geografía.' },
      { nombre: 'senalesMeta', tipo: 'string', max: 600, descripcion: 'Cómo se lo encuentra o distingue en Meta.' },
      { nombre: 'situacion', tipo: 'string', max: 600, descripcion: 'Su situación de negocio concreta.' },
      { nombre: 'dolor', tipo: 'string', max: 600, descripcion: 'Su dolor principal.' },
    ],
    canales: TODOS, costo: 'gratis', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
    escribe: 'relee la lista de avatares (mako.avatares) y cambia o agrega uno solo',
  },
  {
    id: 'borrar_avatar_negocio', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Borrar un avatar del negocio',
    descripcion: 'PROPONE borrar UN avatar del negocio por id. Las razones de compra de ese avatar quedan sin avatar (no se borran): el resumen dice cuántas. No se puede deshacer. Deja un link para revisar y confirmar. Para el vocabulario de guiones, usa proponer_borrar_avatar.',
    parametros: [
      { nombre: 'id', tipo: 'string', obligatorio: true, max: 80, descripcion: 'id del avatar (de listar_avatares_negocio).' },
    ],
    canales: TODOS, costo: 'gratis', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
    escribe: 'relee la lista de avatares (mako.avatares) y quita uno',
  },
  {
    id: 'generar_lead_magnets', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Generar lead magnets con MaKo',
    descripcion: 'PROPONE que MaKo proponga de 1 a 3 lead magnets (el elemento tangible de la oferta, con su línea de FOMO) desde el perfil y el panorama, opcionalmente con las respuestas del dueño. REEMPLAZA los lead magnets guardados, salvo los que tienen enlace al material, que se conservan (los usan las secuencias). Deja un link para confirmar; al confirmar invoca IA.',
    parametros: [
      { nombre: 'respuestas', tipo: 'object[]', max: 10, campos: RESPUESTAS_CAMPOS, descripcion: 'Respuestas de siguiente_pregunta_lead_magnet, en orden.' },
    ],
    canales: TODOS, costo: 'ia', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
    escribe: 'reescribe la lista de lead magnets (mako.entregable) conservando los que tienen enlace',
  },
  {
    id: 'editar_lead_magnet', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Editar un lead magnet',
    descripcion: 'PROPONE cambiar UN lead magnet por id (nombre, tipo, qué es, línea de FOMO, enlace). Lo que no venga conserva su valor, incluido el enlace. El enlace tiene que empezar con http:// o https://. Para sumar uno nuevo con enlace, usa crear_lead_magnet. Deja un link para revisar y confirmar.',
    parametros: [
      { nombre: 'id', tipo: 'string', obligatorio: true, max: 80, descripcion: 'id del lead magnet (de listar_lead_magnets).' },
      { nombre: 'nombre', tipo: 'string', max: 160, descripcion: 'Nombre del lead magnet.' },
      { nombre: 'tipo', tipo: 'string', max: 80, descripcion: 'Dashboard, planilla, documento, metodología…' },
      { nombre: 'queEs', tipo: 'string', max: 800, descripcion: 'Qué es y qué resuelve.' },
      { nombre: 'fomo', tipo: 'string', max: 400, descripcion: 'Línea estilo anuncio que genera FOMO.' },
      { nombre: 'enlace', tipo: 'string', max: 600, descripcion: 'URL http(s) donde está el material.' },
    ],
    canales: TODOS, costo: 'gratis', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
    escribe: 'relee la lista de lead magnets (mako.entregable) y cambia uno solo',
  },
  {
    id: 'sugerir_productos', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Armar el catálogo con MaKo',
    descripcion: 'PROPONE que MaKo arme el catálogo de productos leyendo el perfil y el Archivero. Los productos nuevos se crean; los que ya existen con el mismo nombre (sin importar tildes ni mayúsculas) solo se COMPLETAN en los campos vacíos: nunca se pisa lo escrito, el nombre ni el tipo. Los productos NUEVOS quedan inactivos: su precio lo propone MaKo y hay que revisarlo en /crm antes de activarlos. Necesita el perfil o un documento cargado. Deja un link para confirmar; al confirmar invoca IA.',
    parametros: [],
    canales: TODOS, costo: 'ia', gating: { tab: 'crm', rolMinimo: 'admin' },
    escribe: 'crea productos nuevos inactivos y completa campos vacíos de los existentes (tabla productos)',
  },
  {
    id: 'borrar_producto', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Borrar un producto',
    descripcion: 'PROPONE borrar UN producto del catálogo por id. Para sacarlo de la venta sin perderlo, conviene guardar_producto con activo=false. No se puede deshacer. Deja un link para revisar y confirmar.',
    parametros: [
      { nombre: 'id', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id del producto (de listar_productos).' },
    ],
    canales: TODOS, costo: 'gratis', gating: { tab: 'crm', rolMinimo: 'admin' },
    escribe: 'borra una fila de la tabla productos',
  },
  {
    id: 'guardar_descripcion_cara_de_marca', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Escribir la descripción física',
    descripcion: 'PROPONE reemplazar la descripción física de la cara de marca por el texto que dicta la persona (la que usa la IA de imágenes para recrearla). La descripción anterior se pierde; las fotos no se tocan. Deja un link para revisar el texto y confirmar.',
    parametros: [
      { nombre: 'descripcion', tipo: 'string', obligatorio: true, max: 4000, descripcion: 'La descripción física completa.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
    escribe: 'la descripción de la cara de marca (mako.persona)',
  },
  {
    id: 'borrar_foto_cara_de_marca', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Borrar una foto de la cara',
    descripcion: 'PROPONE borrar UNA foto de la cara de marca por id (de ver_cara_de_marca). La descripción física no se recalcula sola. No se puede deshacer. Deja un link para revisar y confirmar.',
    parametros: [
      { nombre: 'id', tipo: 'string', obligatorio: true, max: 80, descripcion: 'id de la foto (de ver_cara_de_marca).' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
    escribe: 'quita la foto de mako.persona y borra el archivo del almacenamiento',
  },
  {
    id: 'guardar_muletillas_marca', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Guardar las muletillas de marca',
    descripcion: 'PROPONE guardar las muletillas o frases que la marca dice siempre (texto libre, hasta 500 caracteres), reemplazando las anteriores. Los guiones usan 1 o 2, sin forzar. Son las del quiz de personalidad de voz, no las del Video Generator. Deja un link para revisar el texto y confirmar.',
    parametros: [
      { nombre: 'muletillas', tipo: 'string', obligatorio: true, max: 500, descripcion: 'Las frases, separadas por coma o salto de línea.' },
    ],
    canales: TODOS, costo: 'gratis', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
    escribe: 'las muletillas de la personalidad de voz (mako.personalidad)',
  },
  {
    id: 'reiniciar_personalidad', area: 'negocio', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Reiniciar el quiz de voz',
    descripcion: 'PROPONE borrar todas las respuestas del quiz de personalidad de voz y las muletillas para rehacerlo. Hasta que se vuelva a contestar, los guiones salen sin la voz de la marca. No se puede deshacer. Deja un link para revisar y confirmar.',
    parametros: [],
    canales: TODOS, costo: 'gratis', gating: { tab: 'ads-writer', rolMinimo: 'admin' },
    escribe: 'vacía la personalidad de voz (mako.personalidad)',
  },
];
