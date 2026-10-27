// =============================================================================
// estudio/inventario — cada botón del Video Generator ↔ su operación del chat (módulo PURO, lo fija un test)
// =============================================================================
// Martín, 27/10/2026: «todo lo que se hace a mano se puede hacer por prompt». Cada server action que exporta la tab es lo que
// corre un botón, así que la lista de botones SON las acciones exportadas de estos archivos. Cada una está acá con:
//   · `op`: la operación del registro de la API de MaKo que hace lo mismo. Si es de lib/api-mako/areas/video-estudio.def.ts,
//     su runner llama a ESTA acción (lo mira tests/video-estudio-api.test.ts); si es una lectura anterior (ver_saldo_flow,
//     ver_puente_flow…), hace la misma pregunta con su propio lector, sin la sesión.
//   · o `motivo`: por qué no hay una, en una frase. No es un botón (un sondeo de la pantalla), o necesita algo que el chat no
//     tiene (un archivo de la computadora, mirar la toma con los ojos).
// Una acción nueva en estos archivos, sin su fila acá, no pasa el test. Y una fila de una acción que ya no existe, tampoco.
// `BOTONES_SIN_ACCION`: los botones que no llaman al server (abrir un proyecto es cambiar la URL), con la misma regla.
// =============================================================================

export type Equivalente = { op: string } | { motivo: string };

/** Los archivos de la tab que exportan server actions (relativos a app/video-generator/). */
export const ARCHIVOS_DE_ACCIONES = [
  'video-action.ts', 'actions.ts', 'cargar-guiones-action.ts', 'puente-actions.ts', 'onboarding-actions.ts', 'estudio/acciones.ts',
] as const;

const SONDEO = 'La pantalla lo pregunta sola mientras algo se genera (no es un botón).';
const ONBOARDING = 'Es el onboarding de la tab: se hace una vez, en su recorrido.';
const PROMPT = 'Es el texto técnico que va a Google: el chat no lo muestra (ninguna respuesta devuelve prompts), y no se cambia sin verlo. Para cambiar la toma o el escenario, reescribir_toma_con_ia o corregir_escenario_anuncio.';
const ARCHIVO = 'Lleva un archivo que la persona elige en su computadora.';

export const INVENTARIO: Readonly<Record<string, Equivalente>> = {
  // ── video-action.ts ──
  generarTomaAction: { op: 'filmar_toma_anuncio' },
  estadoTomaAction: { motivo: SONDEO },
  pedirSaldoAction: { motivo: 'Le pide el saldo fresco a Google al abrir un anuncio: por el chat se lee el último con ver_saldo_flow (preguntarle a Google en cada turno es tráfico contra su sesión).' },
  saldoAction: { op: 'ver_saldo_flow' },
  escribirEscenasAction: { op: 'escribir_escenarios_anuncio' },
  corregirEscenaAction: { op: 'corregir_escenario_anuncio' },
  generarImagenAction: { op: 'generar_imagen_escenario' },
  estadoImagenAction: { motivo: SONDEO },
  elegirImagenAction: { op: 'elegir_opcion_escenario' },
  descartarTomaAction: { op: 'descartar_toma_anuncio' },
  editarClipsAction: { op: 'cambiar_tomas_anuncio' },
  escribirVozTomaAction: { op: 'editar_texto_toma' },
  guardarPromptEscenaAction: { motivo: PROMPT },
  guardarPromptTomaAction: { motivo: PROMPT },
  restaurarTomaAction: { op: 'restaurar_toma_anuncio' },
  elegirFotoAction: { op: 'elegir_foto_anuncio' },
  elegirUltimaFotoAction: { motivo: `Elige la foto que se acaba de subir: ${ARCHIVO} Ya subida, elegir_foto_anuncio.` },
  marcarEjemploVistoAction: { motivo: 'Anota que la persona ya vio el ejemplo del formato (una pantalla que sale una vez): no es algo que se pida.' },
  marcarCaraVistaAction: { motivo: 'La persona confirma MIRANDO la toma 1 al lado de su foto que la cara es la suya: no se confirma sin verla.' },
  confirmarEscenaAction: { op: 'aprobar_escenario_anuncio' },
  subirImagenEscenaAction: { motivo: `Sube una imagen propia como escenario: ${ARCHIVO}` },
  cambiarMuletillasAction: { op: 'adaptar_voz_anuncio' },
  montarAnuncioAction: { op: 'montar_anuncio_final' },
  estadoMontajeAction: { op: 'ver_montaje_anuncio' },
  escenariosYaGeneradosAction: { op: 'contar_escenarios_reusables' },
  reusarEscenariosAction: { op: 'reusar_escenarios_anuncio' },
  elegirEscenarioAction: { op: 'elegir_lugar_anuncio' },
  otroFondoAction: { op: 'otro_fondo_escenario' },
  // ── actions.ts ──
  generarPlanAction: { op: 'crear_anuncio_con_guion' },
  editarLineaPlanAction: { op: 'editar_texto_toma' },
  reescribirTomaAction: { op: 'reescribir_toma_con_ia' },
  // ── cargar-guiones-action.ts ──
  previoCargaAction: { op: 'cargar_guion_propio' },
  cargarGuionesAction: { op: 'cargar_guion_propio' },
  textoDeLinkAction: { op: 'cargar_guion_propio' },
  textoDeArchivoAction: { motivo: `Lee un Word o un PDF: ${ARCHIVO} Por el chat, se pega el texto o el link (cargar_guion_propio).` },
  editarGuionAction: { op: 'editar_texto_guion_anuncio' },
  // ── puente-actions.ts ──
  conectarPuenteAction: { motivo: 'Empareja ESTE navegador con la extensión: se hace desde el navegador que se conecta, no se pide desde otro.' },
  estadoPuenteAction: { op: 'ver_puente_flow' },
  probarPuenteAction: { motivo: 'Ninguna pantalla la llama hoy: la prueba del navegador es el primer trabajo de verdad.' },
  estadoPruebaAction: { motivo: 'Ninguna pantalla la llama hoy (va con probarPuenteAction).' },
  probarImagenAction: { motivo: 'Ninguna pantalla la llama hoy (va con probarPuenteAction).' },
  rehabilitarPuenteAction: { op: 'rehabilitar_puente_flow' },
  // ── onboarding-actions.ts ──
  marcarPasoVideoAction: { motivo: ONBOARDING },
  guardarAcentoAction: { motivo: ONBOARDING },
  guardarMuletillasAction: { motivo: ONBOARDING },
  leerVozAction: { op: 'ver_voz_cliente' },
  escucharMiVozAction: { motivo: `${ONBOARDING} Además se escucha: no tiene sentido por el chat.` },
  // ── estudio/acciones.ts ──
  releerProyectosAction: { op: 'listar_anuncios_video' },
};

/** Los botones del estudio que no llaman a una server action. */
export const BOTONES_SIN_ACCION: Readonly<Record<string, Equivalente>> = {
  'Abrir un anuncio (la barra de proyectos)': { op: 'abrir_anuncio_en_estudio' },
  'Nuevo anuncio': { op: 'crear_anuncio_con_guion' },
  'Descargar un anuncio terminado': { motivo: 'Baja el archivo a la computadora de la persona: por el chat, ver_montaje_anuncio da su link.' },
  'Editar en el editor': { motivo: 'Abre el Video Editor (otra tab): por el chat, sus operaciones del área video.' },
  'Ver el ejemplo de un formato': { motivo: 'Es mirar un video: por el chat, listar_formatos_video describe cada formato.' },
};

/** Las operaciones del chat que hace cada acción, sin repetir. */
export const opsDelInventario = (): string[] => [...new Set(
  [...Object.values(INVENTARIO), ...Object.values(BOTONES_SIN_ACCION)].flatMap((e) => ('op' in e ? [e.op] : [])),
)];
