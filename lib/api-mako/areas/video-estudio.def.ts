// =============================================================================
// api-mako/areas/video-estudio.def — lo que se hace con los BOTONES del estudio de Video Generator, por prompt (definiciones)
// =============================================================================
// Martín, 27/10/2026: «implementar Video Generator… el chat de MaKo al costado… todo lo que se hace a mano se puede hacer por
// prompt». Una operación por botón del estudio (app/video-generator/estudio/, WizardAnuncio.tsx), en el área `video`. El
// inventario botón ↔ operación vive en app/video-generator/estudio/inventario.ts y lo fija tests/video-estudio-api.test.ts:
// un botón nuevo sin su operación (o sin su motivo escrito) no pasa.
//
// ⚠️ SÓLO POR EL CHAT DE LA APP (`canales: ['app']`), y es a propósito: cada runner llama a LA MISMA server action que el botón
//    (video-estudio.run.ts), así que el chat hace exactamente lo que haría la persona —con sus guardas, sus topes de la prueba
//    y sus mensajes— y no una segunda copia. Esas acciones leen la sesión de la cookie (su `ctxAdmin`): por WhatsApp o por HTTP
//    no hay navegador, y contestarían «solo el administrador». Por la misma razón no corren en un flujo (lib/api-mako/flujo.ts →
//    NO_EN_FLUJOS): un paso de una automatización no tiene sesión.
// ⚠️ FILMAR GASTA CRÉDITOS de la cuenta de Google Flow del cliente: `costo: 'dinero'`, se confirma en su pantalla y de a UNA
//    toma por confirmación (docs/relevo/video-generator.md, 2.26). Lo demás se confirma con la tarjeta del chat.
// Sin server-only y sin importar valores de módulos que lo tengan (la referencia la genera el pre-push con tsx).
// =============================================================================

import type { OperacionDef, Parametro } from '../tipos';

const APP: ['app'] = ['app'];
/** La tab es del admin del negocio (las acciones lo exigen). */
const GATING = { tab: 'video-generator', rolMinimo: 'admin' } as const;

const ANUNCIO: Parametro = {
  nombre: 'planId', tipo: 'string', obligatorio: true, max: 80, fijoAlRevisar: true,
  descripcion: 'id del anuncio (planId de listar_anuncios_video). En el estudio, el abierto.',
};
const TOMA: Parametro = { nombre: 'toma', tipo: 'number', obligatorio: true, entero: true, minimo: 1, maximo: 40, fijoAlRevisar: true, descripcion: 'Número de la toma (de ver_anuncio_video).' };
const ESCENARIO: Parametro = { nombre: 'escenario', tipo: 'number', obligatorio: true, entero: true, minimo: 1, maximo: 12, descripcion: 'Número del escenario (de ver_anuncio_video).' };

export const DEFS: readonly OperacionDef[] = [
  // ── Lectura: abrir un anuncio en el estudio ──
  {
    id: 'abrir_anuncio_en_estudio', area: 'video', tipo: 'lectura',
    titulo: 'Abrir un anuncio en el estudio',
    descripcion: 'Devuelve el link que abre UN anuncio en el estudio de Video Generator (la misma pantalla, con ese proyecto en el centro). Para «ábreme el anuncio de…».',
    parametros: [ANUNCIO],
    salida: 'json', canales: APP, costo: 'gratis', gating: GATING,
  },
  // ── El anuncio nuevo (el botón «Generar anuncio» del estudio) ──
  {
    id: 'crear_anuncio_con_guion', area: 'video', tipo: 'accion',
    titulo: 'Crear un anuncio con un guion',
    descripcion: 'Escribe un anuncio nuevo con uno de los guiones del negocio y un formato: lo reparte en tomas (no toca Google Flow ni gasta créditos). Opcional: dónde se graba. Si ese guion ya tiene un anuncio con ese formato, no se rehace: se abre. Antes: listar_guiones_para_video y listar_formatos_video.',
    parametros: [
      { nombre: 'guionId', tipo: 'string', obligatorio: true, max: 80, descripcion: 'id del guion (de listar_guiones_para_video).' },
      { nombre: 'formatoId', tipo: 'string', obligatorio: true, max: 80, descripcion: 'id del formato (de listar_formatos_video).' },
      { nombre: 'lugar', tipo: 'string', max: 80, descripcion: 'id del lugar (de listar_lugares_grabacion), o «mako» para que lo elija MaKo. Sin esto, lo pregunta el estudio después del guion.' },
    ],
    confirmacion: 'chat', reversible: false,
    escribe: 'agrega un anuncio (sus tomas) al historial de Video Generator en app_settings',
    canales: APP, costo: 'ia', gating: GATING,
  },
  {
    id: 'cargar_guion_propio', area: 'video', tipo: 'accion',
    titulo: 'Cargar un guion propio',
    descripcion: 'Guarda en los guiones del negocio el texto que la persona pegó o dictó (uno o varios, separados solos), o el que hay detrás de un link (un Google Docs), para grabarlo después. Se confirma en su pantalla, donde se corrige el texto antes de guardarlo.',
    parametros: [
      { nombre: 'texto', tipo: 'string', max: 20000, descripcion: 'El guion tal como lo escribió la persona (puede traer varios). Esto o el link.' },
      { nombre: 'link', tipo: 'string', max: 600, descripcion: 'Un link público al guion (Google Docs, una página). Esto o el texto.' },
    ],
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    escribe: 'agrega guiones a app_settings mako.razones (los mismos de Ads Writer); MaKo les marca gancho, historia y cierre',
    canales: APP, costo: 'ia', gating: GATING,
  },
  // ── El guion repartido en tomas ──
  {
    id: 'editar_texto_toma', area: 'video', tipo: 'accion',
    titulo: 'Cambiar lo que dice una toma',
    descripcion: 'Reemplaza el texto de UNA toma del anuncio por el que dicta la persona, tal cual.',
    parametros: [ANUNCIO, TOMA, { nombre: 'texto', tipo: 'string', obligatorio: true, max: 1200, descripcion: 'Lo que tiene que decir la toma, palabra por palabra.' }],
    confirmacion: 'chat', reversible: true,
    escribe: 'cambia el texto de una toma del anuncio en el historial',
    canales: APP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'reescribir_toma_con_ia', area: 'video', tipo: 'accion',
    titulo: 'Reescribir una toma con una instrucción',
    descripcion: 'MaKo reescribe UNA toma con lo que pide la persona («más corta», «sin el precio»), sin tocar las otras.',
    parametros: [ANUNCIO, TOMA, { nombre: 'instruccion', tipo: 'string', obligatorio: true, max: 600, descripcion: 'Qué cambiarle, en palabras de la persona.' }],
    confirmacion: 'chat', reversible: true,
    escribe: 'cambia el texto de una toma del anuncio en el historial',
    canales: APP, costo: 'ia', gating: GATING,
  },
  {
    id: 'cambiar_tomas_anuncio', area: 'video', tipo: 'accion',
    titulo: 'Agregar, partir, quitar o alargar una toma',
    descripcion: 'Cambia el reparto: agrega una toma después de otra, parte una en dos, quita una, o le cambia la duración (en segundos).',
    parametros: [
      ANUNCIO,
      { nombre: 'que', tipo: 'string', obligatorio: true, enum: ['agregar', 'partir', 'quitar', 'duracion'], descripcion: 'Qué hacer.' },
      { ...TOMA, descripcion: 'La toma sobre la que se hace (con «agregar», después de cuál).' },
      { nombre: 'segundos', tipo: 'number', entero: true, minimo: 2, maximo: 15, descripcion: 'Con «agregar» o «duracion»: cuántos segundos.' },
    ],
    confirmacion: 'chat', reversible: false,
    escribe: 'cambia las tomas del anuncio en el historial',
    canales: APP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'adaptar_voz_anuncio', area: 'video', tipo: 'accion',
    titulo: 'Decir el guion con mis muletillas',
    descripcion: 'Rehace el guion del anuncio con la forma de hablar de la persona (o lo vuelve al texto tal cual). Sólo mientras no haya ninguna toma filmada: descarta los escenarios.',
    parametros: [ANUNCIO, { nombre: 'adaptar', tipo: 'boolean', obligatorio: true, descripcion: 'true = con sus muletillas; false = el guion tal cual lo escribió.' }],
    confirmacion: 'chat', reversible: false,
    escribe: 'rehace las tomas del anuncio y descarta sus escenarios',
    canales: APP, costo: 'ia', gating: GATING,
  },
  // ── Dónde se graba y los escenarios ──
  {
    id: 'elegir_lugar_anuncio', area: 'video', tipo: 'accion',
    titulo: 'Elegir dónde se graba',
    descripcion: 'Fija el lugar del anuncio y MaKo vuelve a escribir sus escenarios con ese lugar (descarta las imágenes que tenían).',
    parametros: [ANUNCIO, { nombre: 'lugar', tipo: 'string', obligatorio: true, max: 80, descripcion: 'id del lugar (de listar_lugares_grabacion).' }],
    confirmacion: 'chat', reversible: false,
    escribe: 'cambia el lugar y los escenarios del anuncio en el historial',
    canales: APP, costo: 'ia', gating: GATING,
  },
  {
    id: 'corregir_escenario_anuncio', area: 'video', tipo: 'accion',
    titulo: 'Corregir un escenario',
    descripcion: 'MaKo corrige UN escenario con lo que pide la persona («más luz», «que se vea la cocina») y descarta su imagen.',
    parametros: [ANUNCIO, ESCENARIO, { nombre: 'ajuste', tipo: 'string', obligatorio: true, max: 600, descripcion: 'Qué cambiarle.' }],
    confirmacion: 'chat', reversible: false,
    escribe: 'cambia un escenario del anuncio en el historial',
    canales: APP, costo: 'ia', gating: GATING,
  },
  {
    id: 'otro_fondo_escenario', area: 'video', tipo: 'accion',
    titulo: 'Probar otro rincón del lugar',
    descripcion: 'Manda UN escenario a otro rincón del mismo lugar (otro fondo) y descarta su imagen.',
    parametros: [ANUNCIO, ESCENARIO],
    confirmacion: 'chat', reversible: false,
    escribe: 'cambia el fondo de un escenario del anuncio en el historial',
    canales: APP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'reusar_escenarios_anuncio', area: 'video', tipo: 'accion',
    titulo: 'Reusar los escenarios de otro anuncio',
    descripcion: 'Trae las imágenes de escenario que ya se generaron en otro anuncio con el mismo lugar (ahorra generarlas). Antes: contar_escenarios_reusables.',
    parametros: [ANUNCIO],
    confirmacion: 'chat', reversible: false,
    escribe: 'copia imágenes de escenario de otro anuncio al historial',
    canales: APP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'elegir_foto_anuncio', area: 'video', tipo: 'accion',
    titulo: 'Elegir la foto de la persona',
    descripcion: 'Elige cuál de las fotos de la persona da la cara en ESTE anuncio. Si no sabes el id, pasa su lugar en la lista («2» = la segunda): la respuesta trae las fotos que hay.',
    parametros: [ANUNCIO, { nombre: 'fotoId', tipo: 'string', obligatorio: true, max: 120, descripcion: 'id de la foto, o su lugar en la lista («1», «2»…).' }],
    confirmacion: 'chat', reversible: true,
    escribe: 'cambia la foto del anuncio en el historial',
    canales: APP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'generar_imagen_escenario', area: 'video', tipo: 'accion',
    titulo: 'Generar la imagen de un escenario',
    descripcion: 'Pide en Google Flow la imagen de UN escenario, con la cara de la persona. Las imágenes no gastan créditos. Necesita el navegador conectado (ver_puente_flow).',
    parametros: [ANUNCIO, ESCENARIO],
    confirmacion: 'chat', reversible: false,
    escribe: 'encola un pedido de imagen en Google Flow y lo marca en el historial',
    canales: APP, costo: 'externo', gating: GATING,
  },
  {
    id: 'elegir_opcion_escenario', area: 'video', tipo: 'accion',
    titulo: 'Elegir una de las imágenes de un escenario',
    descripcion: 'Cuando un escenario trae varias imágenes, se queda con la que dice la persona (la primera, la segunda…).',
    parametros: [ANUNCIO, ESCENARIO, { nombre: 'opcion', tipo: 'number', obligatorio: true, entero: true, minimo: 1, maximo: 8, descripcion: 'Cuál, contando desde 1.' }],
    confirmacion: 'chat', reversible: true,
    escribe: 'cambia la imagen elegida de un escenario en el historial',
    canales: APP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'aprobar_escenario_anuncio', area: 'video', tipo: 'accion',
    titulo: 'Aprobar un escenario',
    descripcion: 'Da por buena la imagen de UN escenario: es la que se usa para filmar sus tomas.',
    parametros: [ANUNCIO, ESCENARIO],
    confirmacion: 'chat', reversible: true,
    escribe: 'marca aprobado un escenario en el historial',
    canales: APP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'escribir_escenarios_anuncio', area: 'video', tipo: 'accion',
    titulo: 'Escribir los escenarios de un anuncio',
    descripcion: 'MaKo escribe (o vuelve a escribir) los escenarios del anuncio: dónde pasa cada tramo, con el lugar elegido. El estudio lo hace solo al abrir el anuncio; esto es el «Prueba otra vez» cuando falló, o un anuncio creado por aquí. Descarta las imágenes que tenían.',
    parametros: [ANUNCIO, { nombre: 'ajuste', tipo: 'string', max: 600, descripcion: 'Opcional: qué tener en cuenta («que se vea el producto»).' }],
    confirmacion: 'chat', reversible: false,
    escribe: 'escribe los escenarios del anuncio en el historial',
    canales: APP, costo: 'ia', gating: GATING,
  },
  // ── Filmar y montar ──
  {
    id: 'filmar_toma_anuncio', area: 'video', tipo: 'accion',
    titulo: 'Filmar una toma',
    descripcion: 'Filma UNA toma en Google Flow con los créditos de la cuenta del cliente. De a una toma por confirmación: se confirma en su pantalla, con lo que cuesta y lo que queda. Antes: ver_anuncio_video y ver_saldo_flow.',
    parametros: [ANUNCIO, TOMA],
    confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false, plata: true,
    escribe: 'encola un clip en Google Flow (gasta créditos de su cuenta) y lo marca en el historial',
    canales: APP, costo: 'dinero', gating: GATING,
  },
  {
    id: 'descartar_toma_anuncio', area: 'video', tipo: 'accion',
    titulo: 'Descartar el clip de una toma',
    descripcion: 'Saca el clip filmado de UNA toma para volver a filmarla (queda guardado: se puede restaurar).',
    parametros: [ANUNCIO, TOMA],
    confirmacion: 'chat', reversible: true,
    escribe: 'archiva el clip de una toma en el historial',
    canales: APP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'restaurar_toma_anuncio', area: 'video', tipo: 'accion',
    titulo: 'Restaurar el clip descartado de una toma',
    descripcion: 'Vuelve a poner el último clip que se descartó de UNA toma.',
    parametros: [ANUNCIO, TOMA],
    confirmacion: 'chat', reversible: true,
    escribe: 'devuelve el clip archivado de una toma en el historial',
    canales: APP, costo: 'gratis', gating: GATING,
  },
  {
    id: 'montar_anuncio_final', area: 'video', tipo: 'accion',
    titulo: 'Montar el anuncio entero',
    descripcion: 'Junta las tomas filmadas en el anuncio final (con los cortes que calcula MaKo). Sólo con todas las tomas filmadas. Antes: ver_montaje_anuncio.',
    parametros: [ANUNCIO],
    confirmacion: 'chat', reversible: true,
    escribe: 'encola el montaje del anuncio',
    canales: APP, costo: 'externo', gating: GATING,
  },
  {
    id: 'rehabilitar_puente_flow', area: 'video', tipo: 'accion',
    titulo: 'Volver a habilitar Google Flow',
    descripcion: 'Cuando Google pausó la sesión de Flow (ver_puente_flow: sesion_pausada_por_google), MaKo frena todo hasta que la persona dice que ya hizo lo que pide el aviso. Esto es ese «Ya lo hice»: sólo después de que lo hizo.',
    parametros: [],
    confirmacion: 'chat', reversible: false,
    escribe: 'vuelve a habilitar el navegador conectado (flow_puentes) y saca los trabajos que frenó la pausa',
    canales: APP, costo: 'gratis', gating: GATING,
  },
];
