// =============================================================================
// D6b en las RUTAS y las ACCIONES: todo handler que llega a una IA gratis está decidido — adentro de «sólo su IA», o
// afuera con su porqué
// =============================================================================
// Martín (D6b, 21/10/2026): un negocio con su Claude o su GPT corre su Ops Center con SU cuenta, y nada de sus datos va a
// Gemini ni a una IA o red gratis. El corte vive abajo (lib/ai-cheap.ts), pero sólo corta lo que corre ADENTRO del contexto
// (lib/solo-su-ia.ts), y el contexto lo prende quien atiende el pedido. La segunda revisión del Cerebro encontró tres
// caminos del Ops Center que no lo prendían (El Archivero de su pantalla, «Buscar con MaKo», las áreas del Second Brain) y
// pidió la guarda: «el test que recorre los callers tiene que cubrir también las RUTAS». La TERCERA la encontró
// floja de tres maneras, y se rehízo para que las tres den rojo:
//   (a) una acción 'use server' en app/_components/ importada desde un área del Second Brain pasaba como «otra tab», y la
//       prueba 4 sólo seguía los imports adentro de las carpetas del Ops Center;
//   (b) un handler NUEVO (un PATCH) en un archivo cuyo POST ya prendía pasaba: se decidía por ARCHIVO;
//   (c) un 'use server' en lib/ no era una entrada, y lib/transcribe.ts (la otra IA gratis) no era destino del grafo.
//
// Lo que fija este archivo:
//   1. EL GRAFO: cada app/api/**/route.ts y cada archivo 'use server' del repo (no sólo de app/), con su clausura de
//      imports (estáticos y `import()`, transitivos; el armador es el de scripts/tests-afectados.mjs). Dos destinos:
//      lib/ai-cheap.ts (la cascada, que el contexto corta) y lib/transcribe.ts (va DIRECTO a Groq y Gemini con las keys
//      del entorno: el contexto NO la corta).
//   2. SE DECIDE POR HANDLER: cada GET/POST/… de una ruta y cada acción exportada de un 'use server' es una unidad, con lo
//      que usa ella (y las funciones del mismo archivo que llama). Una unidad que llega a la cascada PRENDE el contexto
//      (llama a `conSuIADelNegocio`, `conSoloSuIA` o `entrarSoloSuIA`, o a una función del repo que lo prende — se
//      DETECTA siguiendo las llamadas), o está en `SIN_IA` (no le pide nada a una IA: lo que usa queda fijado), o su
//      archivo está en `FUERA_DE_D6B` con su porqué. Una que llega a lib/transcribe.ts no se salva prendiendo nada.
//   3. EL OPS CENTER VA ADENTRO: lo que el NAVEGADOR de sus pantallas puede llamar (el Second Brain de escritorio y del
//      teléfono, /mako): se siguen sus imports por TODO el repo (app/_components, app/_chat, lib/…) y se juntan las /api/…
//      que nombran y las acciones que importan. Eso nunca va a `FUERA_DE_D6B`. Lo que se alcanza SÓLO a través de un
//      componente de OTRA tab (el chat embebe el bloque de una landing, de un gráfico, la ficha de un lead) queda con la
//      decisión de esa tab, y se lista (`D6B_VOLCAR=1`).
//   4. Y CORRIENDO: tests/_d6b-rutas-hijo.ts corre DE VERDAD «Buscar con MaKo», El Archivero (una foto y un texto) y el
//      cron del AI Analyst programado con un negocio que tiene sólo su PC: cero pedidos a Gemini, Groq, Mistral,
//      OpenRouter o Cerebras, y la pantalla (o la fila) dice lo cierto; el control (sin su IA) sí sale; y con el
//      onboarding en curso el crédito de Claude de la plataforma sigue.
//
// PROBADO ROMPIÉNDOLO (21/10/2026, sobre feb8efbdc; una rotura por vez, restaurada y comprobada con sha256; base 9 / 0).
// 34 roturas, todas con su rojo:
//   · cada una de las 11 rutas envueltas sin el contexto → la 3 y la 4 (Buscar además la 2 y la 7; El Archivero la 2, la 7
//     y la 9, que lo corren de verdad).
//   · las tres de la tercera revisión: (a) una acción 'use server' en app/_components/ importada desde ProductosView → 3 y 4;
//     (b) un PATCH sin contexto al lado del POST de El Archivero que prende, y una acción nueva al lado de la de /mako/revisar
//     → 3 y 4 cada una; (c) un 'use server' en lib/ importado desde ProductosView → 3 y 4; una ruta nueva que transcribe con
//     lib/transcribe.ts → 3; Buscar transcribiendo ADENTRO del contexto (no la salva) → 3 y 4.
//   · los crons: el del AI Analyst sin contexto → 2, 3, 7 y 8; sin contexto Y escondido en el prefijo (sin su `salvo`) → 2, 7
//     y 8 (lo ve el hijo); el de las landings sin contexto → 3.
//   · la guarda misma: una ruta nueva sin decidir → 3 · un área sin contexto escondida en FUERA_DE_D6B → 4 · el detector sin
//     seguir las llamadas → 2, 3 y 4 · el detector por ARCHIVO otra vez → 2 y 5 · el grafo sin resolver `@/` → 1, 4 y 5 · el
//     recorrido del Ops Center sin salir de sus carpetas (como antes) → 4 · una unidad SIN_IA que empieza a usar la cascada
//     → 5 · un prefijo de FUERA_DE_D6B que no toca nada → 5.
//   · el corte de D6b antes del crédito de Claude → 9 · `errorDeCascada` sin su texto de D6b → 7 y 8 · `leerDocumentoIA`,
//     `extraerDeArchivo` y Buscar sin el suyo → 7 cada uno.
//
// Correr: npx tsx --test tests/d6b-rutas.test.ts   ·   `D6B_VOLCAR=1` lista cómo quedó decidida cada unidad.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { especificadores, resolver, sinComentarios } from '../scripts/tests-afectados.mjs';

const RAIZ = join(__dirname, '..');
/** La cascada barata: el contexto la corta (lib/solo-su-ia.ts). */
const CASCADA = 'lib/ai-cheap.ts';
/** La otra IA gratis: transcribe con Groq y Gemini y las keys del ENTORNO, sin mirar el contexto. Prender no la salva. */
const SIN_CORTE = 'lib/transcribe-plataforma.ts';
const DESTINOS = [CASCADA, SIN_CORTE] as const;
type Destino = (typeof DESTINOS)[number];
const ES_CODIGO = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const HANDLERS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

// ─────────────────────────────────────────────────────────────────────────────
// La tabla: lo que se DECIDIÓ dejar afuera de D6b, y por qué
// ─────────────────────────────────────────────────────────────────────────────

// IA6 (22/10/2026): lo que llega SÓLO a la cascada lo decide la PUERTA de la capa de IA (lib/solo-su-ia.ts → `conD6bDelPedido`):
// los crons, los webhooks, WhatsApp, las tabs, Offer, la API… todo lo que corre con un workspace usa SU IA si la tiene. Las
// únicas excepciones son de Martín y viven en la puerta: las funciones del Plan (`FEATURES_DEL_PLAN`) y la plataforma.
// IA7 (22/10/2026): los anuncios y los creativos del negocio también pasan por la puerta (lib/transcribe.ts → la capa de IA).
// Esta tabla quedó para lo único que la puerta NO ve: lib/transcribe-plataforma.ts, las keys del ENTORNO, de la plataforma.

/**
 * Por PREFIJO de archivo. Un prefijo que ya no toca ninguna unidad sin decidir, se borra (lo pide la prueba 5). `salvo`:
 * los archivos del prefijo que van ADENTRO (y si dejan de prender, la prueba 3 los nombra: no los tapa el prefijo).
 */
const FUERA_DE_D6B: ReadonlyArray<{ prefijo: string; porque: string; salvo?: string[] }> = [
  { prefijo: 'app/api/mako/knowledge/', porque: 'el Conocimiento de MaKo: lo carga el super admin, es de la plataforma, y transcribe sus clases con las keys del entorno (lib/transcribe-plataforma.ts)' },
];

/**
 * Unidades (`archivo#HANDLER` o `archivo#acción`) que llegan a una IA gratis sólo DE PASO (el módulo que usan también
 * tiene funciones con IA) y NO le piden nada: lo que usan del repo queda FIJADO en `usa`. Si cambia, la prueba lo dice y
 * se vuelve a mirar: si ahora le pide algo a una IA, va adentro de `conSuIADelNegocio`.
 */
const SIN_IA: ReadonlyArray<{ unidad: string; usa: string[]; porque: string }> = [
  // Los grupos de la persona, para la lista de chats (3/11/2026): filas de `grupo_mensajes`. El turno de MaKo corre en otra invocación (app/api/cron/grupo-turno).
  { unidad: 'app/api/grupos/route.ts#GET', usa: ['getWorkspaceActual', 'gruposDeLaPersona', 'resumenParaLaLista'], porque: 'lista los grupos de la persona con lo último y lo no leído: no le pide nada a una IA' },
  // Cuántos teléfonos de la persona reciben avisos (Settings › Notificaciones › Celular, 25/10/2026): lee push_suscripciones.
  { unidad: 'app/api/push/suscripcion/route.ts#GET', usa: ['getSupabaseServer', 'getUsuarioActual', 'usuarioPropio'], porque: 'cuenta los teléfonos de la persona con avisos (push_suscripciones): no le pide nada a una IA' },
  // El interruptor de «Aprende solo» (P8, 25/10/2026): guarda el setting second-brain.recolector; la vuelta que le pide a la IA es el cron, adentro de conSuIADelNegocio.
  { unidad: 'app/second-brain/recolector-actions.ts#cambiarRecolectorAction', usa: ['adminDeWorkspaceActual', 'cambiarRecolector'], porque: 'prende o apaga el recolector del negocio (un setting): no le pide nada a una IA; la que lee es la vuelta del cron, con la IA del negocio' },
  // Cómo se ve la tarjeta de una tarea (21/10/2026, las plantillas de tarjeta): de quien mira, en `usuarios.perfil`.
  { unidad: 'app/plan/board/tarjeta-actions.ts#guardarTarjetaPlanAction', usa: ['exigirSesion', 'getRolWsEfectivo', 'setTarjetaPlan'], porque: 'guarda cómo se ve la tarjeta de quien mira (usuarios.perfil): no le pide nada a una IA' },
  // El chat: abrir y listar las conversaciones (el turno, el POST, prende).
  // `claveDeAntes` (21/10/2026): de quién es un chat de antes que se sigue en el Ops Center; lee chart_sessions, ninguna IA. Las
  // marcas (lib/chat-mako-marcas-db.ts) y si ya tiene su IA (`negocioConSuIA`, `pcDe`: leen la base, no llaman a ninguna).
  { unidad: 'app/api/mako/chat/route.ts#GET', usa: ['abrirSesion', 'appDeEscritorio', 'asesorPorId', 'chatsDeAntes', 'chatsDeAutomations', 'chatsDeLasTabs', 'chatsDeLosEditores', 'chatsDeOffer', 'claveDeAntes', 'claveDeTab', 'claveDelCreditoAsignado', 'conTemas', 'cuentasDeIA', 'esChatDeMarcas', 'estadoDeTrabajo', 'gurusConCharla', 'hiloDeAntes', 'hiloDeAutomatizacion', 'hiloDeEditor', 'hiloDeOffer', 'cursoDe', 'leerMarcasDelChat', 'leerPlanFunnel', 'leerReferentes', 'listarOfertas', 'listarSesiones', 'negocioConSuIA', 'pcDe', 'personaDelRequest', 'quienChateaDelRequest', 'runWithWorkspace', 'sesionDeTab', 'tipoDeDispositivo', 'urlDeAdjunto', 'urlDeVozDelChat', 'wsSuperAdmin'], porque: 'lee las conversaciones (y la del Second Brain de la persona, `sesionDeTab` sin crear: chart_sessions, sin IA; y si ya instaló la app de escritorio, `laApp`: su computadora y si mira desde un teléfono, sin IA), el avance de un trabajo, las marcas de la persona y si ya tiene su IA (o el crédito de Claude que le asignó Martín: lib/credito-negocio.ts, lee la clave, sin IA); el Second Brain de un gurú (#18: `cursoDe` lee su curso del CDN, y `vistaDeReferente` y `layoutCerebro` —import dinámico— le dan forma y lo acomodan, sin IA); los gurús con los que ya habló (`gurusConCharla`: chart_sessions, sin IA); `conTemas` lee el primer mensaje de los chats sin título o repetidos (lib/chart-chats.ts → temasDeSesiones, sin IA); las charlas del lienzo de Automations se LEEN (lib/automatizacion-chat-db.ts: app_settings y nutricion_secuencias, sin IA); los chats del Image Editor y del Video Editor se LEEN (image_editor_chats y video_editor_chats, sin IA); la nota de voz de la persona se FIRMA para escucharla (`urlDeVozDelChat`, sin IA: la escucha el POST, adentro de su IA); y las cuentas que el «+» de la caja deja elegir (8b, lib/chat-ia.ts → `cuentasDeIA`: lee su computadora y si tiene SUS claves, sin llamar a ninguna IA)' },
  { unidad: 'app/api/m/mako/route.ts#GET', usa: ['abrirSesion', 'listarSesiones', 'personaDelRequest'], porque: 'lee las conversaciones del teléfono' },
  // Cancelar o descartar una tarjeta: no ejecuta nada (confirmarla sí, y prende).
  { unidad: 'app/m/mako/acciones.ts#cancelarEnChatAction', usa: ['cancelarDesdeTarjeta', 'personaDelRequest'], porque: 'cancela una tarjeta: no la ejecuta' },
  { unidad: 'app/mako/pendientes/acciones.ts#cancelarPendienteAction', usa: ['cancelarPendiente', 'ctxDeBandeja'], porque: 'cancela una pendiente: no la ejecuta' },
  { unidad: 'app/mako/revisar/[id]/acciones.ts#descartarAccionAction', usa: ['ctxDeBandeja', 'descartarPropuestaGenerica', 'getPropuesta'], porque: 'descarta una propuesta: no la aplica' },
  { unidad: 'app/m/inbox/acciones.ts#cancelarPendienteMovil', usa: ['cancelarPendienteAction', 'getCapaActual', 'getRolWsEfectivo', 'getUsuarioActual', 'idNumerico', 'tiposVisibles'], porque: 'cancela una pendiente desde el teléfono: no la ejecuta' },
  { unidad: 'app/m/inbox/acciones.ts#descartarAccionMovil', usa: ['descartarAccionAction', 'getCapaActual', 'getRolWsEfectivo', 'getUsuarioActual', 'idDePropuesta', 'tiposVisibles'], porque: 'descarta una propuesta desde el teléfono: no la aplica' },
  // El Second Brain: leer el mapa, El Archivero sin leer documentos, y las áreas sin generar (sus POST prenden).
  { unidad: 'app/api/second-brain/cerebro/route.ts#GET', usa: ['cerebroQueSeDibuja', 'chatsMakoDeQuienMira', 'construirCerebro', 'soloAdminDeTab'], porque: 'arma el mapa con lecturas (lib/cerebro-grafo.ts)' },
  { unidad: 'app/api/second-brain/exportar/route.ts#POST', usa: ['AREAS', 'construirCerebro', 'construirVault', 'requireRolWs'], porque: 'exporta el mapa que ya está armado' },
  // «Aprende solo» (25/10/2026, el recolector): el interruptor guarda un setting del negocio; la vuelta que lee y resume corre en el
  // cron, adentro de `conSuIADelNegocio` (app/api/cron/second-brain-recolector).
  { unidad: 'app/second-brain/recolector-actions.ts#cambiarRecolectorAction', usa: ['adminDeWorkspaceActual', 'cambiarRecolector'], porque: 'prende o apaga el recolector (un setting del negocio): no le pide nada a una IA' },
  { unidad: 'app/api/onboarding/archivero/route.ts#GET', usa: ['buildEstado', 'resolverWsAdmin', 'runWithWorkspace'], porque: 'lee el estado de El Archivero' },
  { unidad: 'app/api/onboarding/archivero/route.ts#DELETE', usa: ['borrarBinario', 'buildEstado', 'deleteFileRow', 'getFile', 'listFiles', 'resolverWsAdmin', 'runWithWorkspace', 'setPanorama'], porque: 'borra un documento y recalcula sin IA' },
  { unidad: 'app/api/onboarding/archivero/download/route.ts#GET', usa: ['getFile', 'resolverWsAdmin', 'runWithWorkspace', 'urlDescarga', 'urlPreview'], porque: 'firma el link de un archivo guardado' },
  { unidad: 'app/api/onboarding/archivero/manual/route.ts#POST', usa: ['buildEstado', 'computeEffective', 'getManual', 'getSesionAdmin', 'listFiles', 'resolverWsAdmin', 'runWithWorkspace', 'setManual'], porque: 'guarda lo que la persona escribe a mano' },
  { unidad: 'app/api/onboarding/archivero/upload-url/route.ts#POST', usa: ['getSupabaseServer', 'resolverWsAdmin', 'runWithWorkspace'], porque: 'firma la subida de un archivo (lo lee el POST de El Archivero, que prende)' },
  { unidad: 'app/api/onboarding/avatares/route.ts#GET', usa: ['getAnswers', 'getAvatares', 'resolverWsAdmin', 'runWithWorkspace'], porque: 'lee los avatares guardados' },
  { unidad: 'app/api/onboarding/entregable/route.ts#GET', usa: ['getAnswers', 'getEntregables', 'resolverWsAdmin', 'runWithWorkspace'], porque: 'lee los entregables guardados' },
  { unidad: 'app/api/onboarding/fase/route.ts#GET', usa: ['getDiagnosticoFase', 'resolverWsAdmin', 'runWithWorkspace'], porque: 'el diagnóstico de la fase es una cuenta, sin IA (lib/fase-store.ts)' },
  { unidad: 'app/api/onboarding/fase/route.ts#POST', usa: ['resolverWsAdmin', 'runWithWorkspace', 'setDiagnosticoFase'], porque: 'guarda las respuestas del diagnóstico (una cuenta, sin IA)' },
  { unidad: 'app/api/onboarding/fase/route.ts#PATCH', usa: ['guardarHechasFase', 'resolverWsAdmin', 'runWithWorkspace'], porque: 'marca pasos hechos de la fase' },
  { unidad: 'app/api/onboarding/formatos/route.ts#GET', usa: ['BIBLIOTECA_ANGULOS', 'getAvatares', 'getRazones', 'resolverWsAdmin', 'runWithWorkspace', 'usosPorFormato'], porque: 'la biblioteca y cuántos anuncios de la matriz usan cada formato (los de un avatar que existe), contados sin IA (la recomendación salió el 23/10/2026)' },
  { unidad: 'app/api/onboarding/ofertas/route.ts#GET', usa: ['getAnswers', 'getPanorama', 'listProductos', 'listarFunnels', 'listarOfertas', 'ofertasDeFunnels', 'perfilNegocioTexto', 'productosDeOfertas', 'resolverOfertaPrincipal', 'resolverWsAdmin', 'runWithWorkspace', 'seedOfertaDesdeBrief'], porque: 'lee las ofertas (la semilla desde el brief es sólo base, sin IA)' },
  { unidad: 'app/api/onboarding/persona/route.ts#GET', usa: ['personaEstado', 'resolverWsAdmin', 'runWithWorkspace'], porque: 'lee la cara de marca guardada' },
  { unidad: 'app/api/onboarding/persona/route.ts#DELETE', usa: ['deletePersonaFoto', 'personaEstado', 'resolverWsAdmin', 'runWithWorkspace'], porque: 'borra una foto de la cara de marca' },
  { unidad: 'app/api/onboarding/personalidad/route.ts#GET', usa: ['PERSONALIDAD_PREGUNTAS', 'getPersonalidad', 'resolverWsAdmin', 'runWithWorkspace'], porque: 'lee la personalidad guardada' },
  { unidad: 'app/api/onboarding/productos/route.ts#GET', usa: ['getPanorama', 'listProductos', 'perfilNegocioTexto', 'resolverWsAdmin', 'runWithWorkspace', 'seedProductosDesdeOferta'], porque: 'lee los productos (la semilla desde la oferta es sólo base, sin IA)' },
  { unidad: 'app/api/onboarding/razones/route.ts#GET', usa: ['getAngulosGuion', 'getAnswers', 'getAvatares', 'getEstructurasGuion', 'getRazones', 'resolverWsAdmin', 'runWithWorkspace', 'siguientePasoDefault', 'siguientePasoOpciones'], porque: 'lee las razones y los guiones guardados' },
  // Lo compartido que el Ops Center también llama.
  { unidad: 'app/api/ia/proveedores/route.ts#GET', usa: ['MAX_KEYS', 'PROVS_MULTIKEY', 'cuentasDe', 'cuotasProveedores', 'getUsuarioActual', 'servicioMetodo'], porque: 'lista las IA gratis cargadas y su cuota de hoy (la guardada, y el saldo de OpenRouter): no le manda ningún dato del negocio a una IA' },
  { unidad: 'app/api/push/clave/route.ts#GET', usa: ['clavePublicaPush', 'getUsuarioActual'], porque: 'la clave pública de las notificaciones' },
  { unidad: 'app/api/push/prueba/route.ts#POST', usa: ['enviarPushAUsuario', 'getUsuarioActual', 'usuarioPropio'], porque: 'manda una notificación de prueba' },
  { unidad: 'app/api/push/suscripcion/route.ts#POST', usa: ['MARCA_SIN_CLAVE_APNS', 'endpointDeApns', 'endpointPermitido', 'getSupabaseServer', 'getUsuarioActual', 'plataformaDeUA', 'tokenApnsValido', 'usuarioPropio'], porque: 'guarda la suscripción a las notificaciones, de la web o del iPhone (APNs)' },
  { unidad: 'app/api/push/suscripcion/route.ts#DELETE', usa: ['endpointDeApns', 'getSupabaseServer', 'getUsuarioActual', 'tokenApnsValido', 'usuarioPropio'], porque: 'borra la suscripción a las notificaciones' },
  { unidad: 'app/_components/zona-actions.ts#detectarZonaAction', usa: ['contextoDeAgencia', 'fijarZonaDelNegocio', 'getUsuarioActual', 'getWorkspaceActual', 'inferirZonaDesdeIntegraciones', 'zonaDeUbicacion', 'zonaDelNegocioDetalle'], porque: 'fija la zona horaria del negocio' },
  // «Probar mi clave» de «Tus cuentas de IA» (IA3, 22/10/2026): un pedido que no cobra a SU Claude o SU OpenAI, con su
  // clave y sin datos del negocio (count_tokens de «hola», o la lista de modelos). Ninguna IA gratis.
  { unidad: 'app/api/ia-del-negocio/probar-clave/route.ts#POST', usa: ['PROVS_SU_CLAVE', 'limitePorClave', 'personaDelRequest', 'probarSuClave'], porque: 'prueba la clave del negocio con un pedido que no cobra (lib/su-clave.ts): ninguna IA gratis' },
  // Llegó con el merge de main (Pagos en el chat, 2.27): lee la cobranza de la base y la arma, sin IA.
  { unidad: 'app/_chat/bloques/cobranza-actions.ts#leerCobranzaDelHilo', usa: ['TZ_DEFAULT', 'armarCobranza', 'cobrosDeFilas', 'getPorCobrar', 'getRolWsEfectivo', 'getWorkspaceActual', 'hoyEnWorkspace', 'tzDeWorkspace'], porque: 'lee «A quién cobrar» del hilo, de la base' },
  // «Reportar a Soporte» del portal del ALUMNO (f78574342, 27/10/2026): el botón de toda la app (app/_ui/ReportarASoporte.tsx,
  // que el Ops Center monta) lo nombra, por eso es del Ops Center. Llega a la cascada sólo DE PASO: `resolverAccesoPortal`
  // vive en lib/curso-datos.ts → app/customer-success/entrega.ts → lib/nutricion.ts → lib/ai-cheap.ts. Lo que hace es validar
  // el token del alumno y CREAR el ticket (lib/tickets-db.ts no llega a ninguna IA: /api/soporte/reportar, el mismo ticket con
  // sesión, ni aparece en el grafo); su triage es con reglas (lib/tickets-reglas.ts), sin IA.
  { unidad: 'app/api/compartido/curso/soporte/route.ts#POST', usa: ['SIN_ACCESO_PORTAL', 'TOPE_BYTES', 'claveDelAlumno', 'clientIp', 'crearTicket', 'emailDuenoWorkspace', 'identidadDe', 'leerJsonTopeado', 'leerTokenPortal', 'rateLimit', 'resolverAccesoPortal', 'runWithWorkspace', 'rutaDelPortal', 'sanearReporteSoporte', 'semillaDeRef', 'ticketDelAlumno'], porque: 'el alumno reporta un error: valida su token del portal y crea el ticket para el dueño del curso; no le pide nada a una IA' },
];

/** Sus carpetas. Lo de app/ fuera de éstas (y de las compartidas, `app/_…`) es de OTRA tab. app/onboarding/ es suya por las
 *  vistas de las áreas que monta el Second Brain (su page.tsx, el chat de arranque, no es una pantalla del Ops Center). */
const CARPETAS_OPS_CENTER = ['app/second-brain/', 'app/m/second-brain/', 'app/mako/', 'app/m/mako/', 'app/onboarding/', 'app/_chat/'];
/** Archivos que NOMBRAN rutas sin llamarlas (una lista): sus /api/… no son llamadas del navegador. */
const NOMBRAN_SIN_LLAMAR = ['lib/rutas-publicas.ts'];

// ─────────────────────────────────────────────────────────────────────────────
// El grafo
// ─────────────────────────────────────────────────────────────────────────────

const ARCHIVOS = execFileSync('git', ['ls-files', '-z', '-co', '--exclude-standard'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\0').filter(Boolean);
const EXISTE = new Set(ARCHIVOS);
const existe = (r: string) => EXISTE.has(r);
const memo = <T>(f: (a: string) => T) => { const m = new Map<string, T>(); return (a: string): T => { if (!m.has(a)) m.set(a, f(a)); return m.get(a)!; }; };
const limpio = memo((f: string) => { try { return sinComentarios(readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n')) as string; } catch { return ''; } });
const deps = memo((f: string) => [...new Set((especificadores(limpio(f)) as string[]).map((s) => resolver(f, s, existe) as string | null).filter((r): r is string => !!r && ES_CODIGO.test(r)))]);
const resolverDe = (f: string, spec: string) => resolver(f, spec, existe) as string | null;

const esRuta = (f: string) => /^app\/api\/.+\/route\.tsx?$/.test(f);
const esAccion = memo((f: string) => /\.tsx?$/.test(f) && !/^(?:tests|scripts|supabase|docs|public)\//.test(f) && /^\s*['"]use server['"]/.test(limpio(f)));
const esCliente = memo((f: string) => /^\s*['"]use client['"]/.test(limpio(f)));
const RUTAS = ARCHIVOS.filter(esRuta);
const ACCIONES = ARCHIVOS.filter((f) => !esRuta(f) && esAccion(f));
const ENTRADAS = [...RUTAS, ...ACCIONES];
/** Las pantallas del Ops Center (todas sus page.tsx: el Second Brain, el teléfono, /mako y su bandeja): de acá se saca lo que
 *  su navegador puede llamar (prueba 4). */
const PANTALLAS_OPS_CENTER = ARCHIVOS.filter((f) => /^app\/(?:m\/)?(?:second-brain|mako)\/(?:.*\/)?page\.tsx$/.test(f));

/** Los archivos desde los que se llega a cada destino (incluido), sobre la clausura de las entradas. */
const LLEGAN: Record<Destino, Set<string>> = (() => {
  const inversa = new Map<string, string[]>();
  const vistos = new Set<string>();
  const cola = [...ENTRADAS];
  while (cola.length) {
    const f = cola.pop()!;
    if (vistos.has(f)) continue;
    vistos.add(f);
    for (const d of deps(f)) {
      if (!inversa.has(d)) inversa.set(d, []);
      inversa.get(d)!.push(f);
      if (!vistos.has(d)) cola.push(d);
    }
  }
  const desde = (destino: string) => {
    const out = new Set<string>([destino]);
    const pila = [destino];
    while (pila.length) for (const p of inversa.get(pila.pop()!) ?? []) if (!out.has(p)) { out.add(p); pila.push(p); }
    return out;
  };
  return { [CASCADA]: desde(CASCADA), [SIN_CORTE]: desde(SIN_CORTE) } as Record<Destino, Set<string>>;
})();

// ─────────────────────────────────────────────────────────────────────────────
// Lo que hay adentro de un archivo: imports, declaraciones, y las unidades (handlers y acciones)
// ─────────────────────────────────────────────────────────────────────────────

type Importado = { archivo: string; nombre: string };

/** Los nombres que un archivo importa del repo (por valor): local → de dónde y con qué nombre. */
const importsDe = memo((f: string) => {
  const src = limpio(f);
  const out = new Map<string, Importado>();
  const sumar = (lista: string, spec: string, sep: RegExp) => {
    const archivo = resolverDe(f, spec);
    if (!archivo) return;
    for (const parte of lista.split(',')) {
      const p = parte.trim();
      if (!p || /^type\s/.test(p)) continue;
      const [nombre, local] = p.split(sep).map((s) => s.trim());
      out.set(local || nombre, { archivo, nombre });
    }
  };
  for (const m of src.matchAll(/import\s+(?!type\s)(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) sumar(m[1], m[2], /\s+as\s+/);
  for (const m of src.matchAll(/import\s+(?!type\s)([\w$]+)\s*(?:,\s*\{[^}]*\})?\s*from\s*['"]([^'"]+)['"]/g)) sumar(`default as ${m[1]}`, m[2], /\s+as\s+/);
  for (const m of src.matchAll(/import\s+\*\s+as\s+([\w$]+)\s+from\s*['"]([^'"]+)['"]/g)) sumar(`* as ${m[1]}`, m[2], /\s+as\s+/);
  // const { a, b: c } = await import('…')
  for (const m of src.matchAll(/const\s*\{([^}]*)\}\s*=\s*await\s+import\(\s*['"]([^'"]+)['"]\s*\)/g)) sumar(m[1], m[2], /\s*:\s*/);
  return out;
});

/** Las declaraciones de primer nivel de un archivo (funciones y constantes): nombre → su texto, hasta la siguiente. */
const declaraciones = memo((f: string) => {
  const src = limpio(f);
  const inicios = [...src.matchAll(/^(?:export|import|const|let|var|function|async|type|interface|class|enum|declare)\b/gm)].map((m) => m.index!);
  const out = new Map<string, string>();
  for (const m of src.matchAll(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([\w$]+)|^(?:export\s+)?(?:const|let)\s+([\w$]+)\s*(?::[^=\n]*)?=/gm)) {
    const fin = inicios.find((i) => i > m.index!) ?? src.length;
    out.set(m[1] ?? m[2], src.slice(m.index!, fin));
  }
  return out;
});

const identificadores = (t: string) => new Set(t.match(/[A-Za-z_$][\w$]*/g) ?? []);
/** Los nombres que un texto LLAMA (`x(`, `x<T>(`), sin los métodos (`a.x(`). Una pasada por texto. */
const llamados = (texto: string) => new Set([...texto.matchAll(/(?<![\w$.])([\w$]+)\s*(?:<[^>()]*>)?\(/g)].map((m) => m[1]));

/** Las unidades de una entrada: los handlers de una ruta, o las acciones exportadas de un 'use server'. */
const unidadesDe = memo((f: string) => {
  const nombres = [...limpio(f).matchAll(/^export\s+(?:default\s+)?(?:async\s+)?function\s*\*?\s*([\w$]+)|^export\s+(?:const|let)\s+([\w$]+)/gm)].map((m) => m[1] ?? m[2]);
  return [...new Set(esRuta(f) ? nombres.filter((n) => HANDLERS.has(n)) : nombres)];
});

/** El texto de una unidad con las funciones del MISMO archivo que usa (transitivo): lo que corre cuando la llaman. */
const cierre = memo((clave: string) => {
  const [f, nombre] = clave.split('#');
  const decls = declaraciones(f);
  const vistos = new Set([nombre]);
  const cola = [nombre];
  const partes: string[] = [];
  while (cola.length) {
    const t = decls.get(cola.pop()!);
    if (t == null) continue;
    partes.push(t);
    for (const id of identificadores(t)) if (decls.has(id) && !vistos.has(id)) { vistos.add(id); cola.push(id); }
  }
  return partes.join('\n');
});

/** Lo que una unidad usa del repo: los nombres importados que aparecen en su cierre. */
const usaDe = (clave: string) => {
  const f = clave.split('#')[0];
  const ids = identificadores(cierre(clave));
  return [...importsDe(f).keys()].filter((l) => ids.has(l)).sort();
};

/** ¿La unidad llega a ese destino? Por lo que USA (sus imports y sus `import()`), no por el archivo entero. */
function unidadLlega(clave: string, destino: Destino): boolean {
  const f = clave.split('#')[0];
  const texto = cierre(clave);
  if (!texto) return LLEGAN[destino].has(f);   // no se encontró su cuerpo: se toma el archivo entero (para el lado seguro)
  const ids = identificadores(texto);
  for (const [local, imp] of importsDe(f)) if (ids.has(local) && LLEGAN[destino].has(imp.archivo)) return true;
  for (const spec of especificadores(texto) as string[]) { const r = resolverDe(f, spec); if (r && LLEGAN[destino].has(r)) return true; }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// ¿Prende el contexto? Siguiendo las llamadas, no con una lista a mano
// ─────────────────────────────────────────────────────────────────────────────

const RE_CONTEXTO = /(?<![\w$.])(?:conSuIADelNegocio|conSoloSuIA|entrarSoloSuIA)\s*\(/;

const prendeMemo = new Map<string, boolean>();
/** ¿La función `nombre` de `f` prende el contexto (ella o algo que llama, del repo)? */
function prende(f: string, nombre: string, pila: Set<string>): boolean {
  const k = `${f}#${nombre}`;
  if (prendeMemo.has(k)) return prendeMemo.get(k)!;
  // La PUERTA de la capa de IA (IA6) decide sola por el workspace: no es «quien atiende el pedido prende». Sin esto, todo lo
  // que llama a una IA «prendería» (cada función de lib/ai-cheap.ts pasa por ella) y el detector no distinguiría nada.
  if (f === 'lib/solo-su-ia.ts' && nombre === 'conD6bDelPedido') return false;
  if (pila.has(k)) return false;
  pila.add(k);
  const cuerpo = declaraciones(f).get(nombre);
  let r = false;
  if (cuerpo != null) r = textoPrende(f, cuerpo, pila);
  else {
    // Un re-export (`export { x } from './y'`).
    for (const m of limpio(f).matchAll(/export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
      const parte = m[1].split(',').map((p) => p.trim().split(/\s+as\s+/)).find(([n, l]) => (l || n) === nombre);
      const archivo = parte && resolverDe(f, m[2]);
      if (parte && archivo) { r = prende(archivo, parte[0], pila); break; }
    }
  }
  pila.delete(k);
  prendeMemo.set(k, r);
  return r;
}
function textoPrende(f: string, texto: string, pila: Set<string>): boolean {
  if (RE_CONTEXTO.test(texto)) return true;
  const imps = importsDe(f);
  const decls = declaraciones(f);
  for (const n of llamados(texto)) {
    const imp = imps.get(n);
    if (imp && prende(imp.archivo, imp.nombre, pila)) return true;
    if (!imp && decls.has(n) && prende(f, n, pila)) return true;
  }
  return false;
}
/** ¿Esta unidad prende el contexto? Mira SU cierre: el POST que prende no salva al PATCH de al lado. */
const unidadPrende = memo((clave: string) => textoPrende(clave.split('#')[0], cierre(clave), new Set()));

/** El «afuera» de una unidad: por prefijo de su clave (`archivo#export`), así una entrada puede ser una carpeta, un archivo o
 *  UN handler. */
const fueraDe = (clave: string) => FUERA_DE_D6B.find((x) => clave.startsWith(x.prefijo) && !x.salvo?.includes(clave.split('#')[0]));
const sinIADe = (clave: string) => SIN_IA.find((x) => x.unidad === clave);

/** Cada unidad de cada entrada, con a qué destino llega. */
type Unidad = { clave: string; archivo: string; cascada: boolean; sinCorte: boolean };
const UNIDADES: Unidad[] = ENTRADAS.flatMap((f) => unidadesDe(f).map((n) => {
  const clave = `${f}#${n}`;
  return { clave, archivo: f, cascada: unidadLlega(clave, CASCADA), sinCorte: unidadLlega(clave, SIN_CORTE) };
}));
const ALCANZAN = UNIDADES.filter((u) => u.cascada || u.sinCorte);

// ─────────────────────────────────────────────────────────────────────────────
// Lo que el navegador del Ops Center puede llamar
// ─────────────────────────────────────────────────────────────────────────────

/** La carpeta de OTRA tab de un archivo de app/ (`app/crm/`, `app/m/crm/`), o null si es del Ops Center o compartido. */
function carpetaDeOtraTab(f: string): string | null {
  // El micrófono de la caja única vive con las piezas del super admin, y desde el 22/10/2026 el teléfono del cliente dicta con
  // él (app/m/second-brain/ChatClienteM.tsx; antes, con el Composer de app/m/mako/): lo que llama (/api/plan-dictado) lo llama el
  // Ops Center. El resto de app/admin/operaciones/ (las acciones del super admin, con `puedeOperar`) sigue siendo otra tab.
  if (f === 'app/admin/operaciones/Microfono.tsx') return null;
  const m = f.match(/^app\/(m\/)?([^/]+)\//);
  if (!m) return null;
  if (m[2] === 'api' || m[2].startsWith('_') || (m[1] == null && m[2] === 'm')) return null;
  const carpeta = `app/${m[1] ?? ''}${m[2]}/`;
  return CARPETAS_OPS_CENTER.includes(carpeta) ? null : carpeta;
}

/**
 * Lo que alcanza el navegador desde las pantallas. Del lado del SERVER (las page.tsx y sus componentes de servidor) se
 * siguen sólo los archivos de app/ y las fronteras ('use client', 'use server'); del lado del CLIENTE, todo el repo. Una
 * acción ('use server') se anota y no se entra: lo de adentro corre en el server y lo mira su propia unidad.
 * `cruzaTabs: false` no entra a las carpetas de otras tabs.
 */
function alcanceDe(cruzaTabs: boolean): { cliente: Set<string>; acciones: Set<string> } {
  const lado = new Map<string, 'server' | 'cliente'>();
  const acciones = new Set<string>();
  const cola: Array<[string, 'server' | 'cliente']> = PANTALLAS_OPS_CENTER.map((f) => [f, 'server']);
  while (cola.length) {
    const [f, l0] = cola.pop()!;
    const l = l0 === 'cliente' || esCliente(f) ? 'cliente' : 'server';
    if (lado.get(f) === 'cliente' || lado.get(f) === l) continue;
    lado.set(f, l);
    if (esAccion(f)) { acciones.add(f); continue; }
    for (const d of deps(f)) {
      if (!cruzaTabs && carpetaDeOtraTab(d)) continue;
      if (l === 'server' && !(d.startsWith('app/') && !d.startsWith('app/api/')) && !esCliente(d) && !esAccion(d)) continue;
      cola.push([d, l]);
    }
  }
  return { cliente: new Set([...lado].filter(([, l]) => l === 'cliente').map(([f]) => f)), acciones };
}

/** Las rutas que nombra el código del navegador (`'/api/…'`), y las que no se encuentran. */
function rutasNombradas(archivos: Set<string>): { rutas: Set<string>; sinRuta: string[] } {
  const rutas = new Set<string>();
  const sinRuta: string[] = [];
  for (const f of archivos) {
    if (NOMBRAN_SIN_LLAMAR.includes(f)) continue;
    for (const m of limpio(f).matchAll(/['"`](\/api\/[A-Za-z0-9/_[\]-]+)/g)) {
      const api = m[1].replace(/\/+$/, '');
      const exacta = [`app${api}/route.ts`, `app${api}/route.tsx`].find(existe);
      // `/api/x/${id}`: el literal termina en el prefijo; la ruta es la del segmento dinámico.
      const dinamica = exacta ? null : ARCHIVOS.find((a) => new RegExp(`^app${api.replace(/[[\]]/g, '\\$&')}/\\[[^\\]]+\\]/route\\.tsx?$`).test(a));
      const ruta = exacta ?? dinamica;
      if (ruta) rutas.add(ruta); else sinRuta.push(`${api} (${f})`);
    }
  }
  return { rutas, sinRuta };
}

const PROPIO = alcanceDe(false);
const TODO = alcanceDe(true);
const RUTAS_PROPIAS = rutasNombradas(PROPIO.cliente);
/** Lo que el navegador del Ops Center llama por SUS componentes (los suyos, los compartidos y lib/), y las acciones que
 *  viven en sus carpetas: va adentro. */
const OPS_CENTER = new Set([...RUTAS_PROPIAS.rutas, ...PROPIO.acciones, ...ACCIONES.filter((f) => CARPETAS_OPS_CENTER.some((c) => f.startsWith(c)))]);
/** Lo que llama sólo a través de un componente de OTRA tab (el bloque que el chat embebe): la decisión es de esa tab. */
const EMBEBIDO = new Set([...rutasNombradas(TODO.cliente).rutas, ...TODO.acciones].filter((f) => !OPS_CENTER.has(f)));

/** ¿Está decidida, y cómo? null = no. Lo que llega a lib/transcribe-plataforma.ts (antes lib/transcribe.ts) no se salva prendiendo el contexto. */
function decision(u: Unidad): string | null {
  const fuera = fueraDe(u.clave);
  if (sinIADe(u.clave)) return 'SIN_IA';
  if (u.sinCorte && !fuera) return null;
  if (u.cascada && unidadPrende(u.clave)) return u.sinCorte ? `PRENDE, y FUERA ${fuera!.prefijo} por ${SIN_CORTE}` : 'PRENDE';
  // IA6 (22/10/2026): lo que llega SÓLO a la cascada lo decide la PUERTA de la capa de IA (lib/solo-su-ia.ts →
  // `conD6bDelPedido`), con el workspace del pedido: no hace falta que la ruta prenda nada. Las excepciones (el Plan y la
  // plataforma) viven en la puerta, no en esta tabla. Lo que llega a ${SIN_CORTE} no pasa por la puerta: sigue acá.
  if (porLaPuerta(u)) return 'PUERTA';
  return fuera ? `FUERA ${fuera.prefijo}` : null;
}

/** ¿La decide la puerta de la capa de IA? (IA6) Llega a la cascada y no a lib/transcribe-plataforma.ts. */
function porLaPuerta(u: Unidad): boolean {
  return u.cascada && !u.sinCorte;
}

// ─────────────────────────────────────────────────────────────────────────────
// Las pruebas
// ─────────────────────────────────────────────────────────────────────────────

test('1. el grafo ve las dos IA gratis: lo que les pide llega, y lo que no, no', () => {
  // Rota: un armador que no sigue los imports (o los lee mal) daría un verde vacío. Medido el 21/10/2026: ~370 entradas.
  assert.ok(ALCANZAN.length >= 300, `sólo ${ALCANZAN.length} unidades llegan a una IA gratis: el grafo no está leyendo los imports`);
  for (const r of ['app/api/second-brain/buscar/route.ts#POST', 'app/api/onboarding/archivero/route.ts#POST', 'app/api/mako/chat/route.ts#POST', 'app/api/onboarding/avatares/route.ts#POST']) {
    assert.ok(UNIDADES.find((u) => u.clave === r)?.cascada, `${r} tendría que llegar a ${CASCADA}`);
  }
  // IA7: los anuncios del negocio pasan por la capa de IA (la puerta); lo de la plataforma (el Conocimiento) sigue sin corte.
  assert.ok(UNIDADES.find((u) => u.clave === 'app/api/mako/knowledge/transcribe/route.ts#POST')?.sinCorte, `knowledge/transcribe tendría que llegar a ${SIN_CORTE}`);
  assert.ok(!UNIDADES.find((u) => u.clave === 'app/api/regenerate-transcript/route.ts#POST')?.sinCorte, `regenerate-transcript ya no tendría que llegar a ${SIN_CORTE}`);
  assert.ok(!LLEGAN[CASCADA].has('app/api/auth/me/route.ts'), 'auth/me no le pide nada a una IA: si llega, el grafo está de más');
  // Las acciones de afuera de app/ también son entradas (antes sólo se miraba app/).
  assert.ok(ACCIONES.some((f) => f.startsWith('app/')), 'no encontré ninguna acción \'use server\'');
});

test('2. el detector de «prende» decide por HANDLER: ve a quien lo prende (por su cuerpo o por lo que llama) y no al de al lado', () => {
  for (const r of ['app/api/mako/pedidos/route.ts#POST', 'app/api/plan-dictado/route.ts#POST', 'app/api/second-brain/buscar/route.ts#POST',
    'app/api/onboarding/archivero/route.ts#POST', 'app/mako/pendientes/acciones.ts#confirmarPendienteAction',
    'app/api/cron/dashboard-analisis/route.ts#GET']) {
    assert.ok(unidadPrende(r), `${r} prende el contexto`);
  }
  // A través de lo que llama: `turnoApp` (el chat), `confirmarDesdeTarjeta` (el teléfono), `confirmarAccionAction` (la
  // propuesta del chat), y `turnoDelCrm` → `turnoApp` (el chat del CRM, dos saltos).
  for (const r of ['app/api/mako/chat/route.ts#POST', 'app/api/m/mako/route.ts#POST', 'app/m/mako/acciones.ts#confirmarEnChatAction',
    'app/api/mako/propuesta/route.ts#POST', 'app/api/crm/mako/route.ts#POST']) {
    assert.ok(unidadPrende(r), `${r} prende el contexto (por lo que llama)`);
  }
  // Por HANDLER: el GET de El Archivero no prende aunque el POST del mismo archivo sí (antes el archivo entero «prendía»).
  assert.equal(unidadPrende('app/api/onboarding/archivero/route.ts#GET'), false, 'el GET de El Archivero no prende: se está decidiendo por archivo');
  // Y no a cualquiera: un cron que le pide a la IA no lo prende (si el detector dijera que sí, todo pasaría).
  assert.equal(unidadPrende('app/api/cron/nutricion/route.ts#GET'), false, 'el detector dice «prende» de más');
});

test('3. TODO handler y toda acción que llega a una IA gratis está decidido: adentro, sin IA, o afuera con su porqué', () => {
  if (process.env.D6B_VOLCAR) {
    for (const u of ALCANZAN) console.log(`D6B ${decision(u) ?? '??'} ${u.clave}${OPS_CENTER.has(u.archivo) ? ' [OPS]' : EMBEBIDO.has(u.archivo) ? ' [EMBEBIDO]' : ''} usa=${JSON.stringify(usaDe(u.clave))}`);
  }
  const sinDecidir = ALCANZAN.filter((u) => decision(u) == null);
  assert.deepEqual(sinDecidir.map((u) => u.clave), [], [
    'Estos handlers o acciones llegan a una IA gratis y nadie decidió D6b (Martín, 21/10/2026: con su Claude o su GPT, nada',
    'de sus datos va a Gemini). Si es del Ops Center, que corra adentro de `conSuIADelNegocio(ws, …)` (lib/ia-del-negocio.ts);',
    `si no le pide nada a una IA, a SIN_IA con lo que usa; si no, su archivo a FUERA_DE_D6B con su porqué. Lo que llega a`,
    `${SIN_CORTE} no se salva prendiendo el contexto (no lo mira): SIN_IA o FUERA_DE_D6B.`,
    ...sinDecidir.map((u) => `  · ${u.clave}${u.sinCorte ? ` (llega a ${SIN_CORTE})` : ''}`),
  ].join('\n'));
});

test('4. el Ops Center va ADENTRO: lo que su navegador llama prende el contexto o no le pide nada a una IA — nunca «afuera»', () => {
  for (const r of ['app/api/second-brain/buscar/route.ts', 'app/api/onboarding/archivero/route.ts', 'app/api/onboarding/razones/route.ts',
    'app/api/mako/chat/route.ts', 'app/mako/pendientes/acciones.ts', 'app/api/plan-dictado/route.ts']) {
    assert.ok(OPS_CENTER.has(r), `el navegador del Ops Center llama ${r}: si no aparece, la lectura de sus componentes está rota`);
  }
  // Y el recorrido CRUZA a lo que el chat embebe de otras tabs (si no, «embebido» estaría vacío por un recorrido corto).
  assert.ok(EMBEBIDO.has('app/api/landing-generator/ia/route.ts'), 'el chat embebe el bloque de una landing: el recorrido no está cruzando a otras tabs');
  assert.deepEqual(RUTAS_PROPIAS.sinRuta, [], 'el navegador del Ops Center llama una /api/… que no existe (o la lectura de sus rutas está rota)');
  const afuera = ALCANZAN.filter((u) => OPS_CENTER.has(u.archivo) && !sinIADe(u.clave) && (u.sinCorte || !unidadPrende(u.clave)));
  assert.deepEqual(afuera.map((u) => u.clave), [], [
    'Estos handlers o acciones los llama el navegador del Ops Center, llegan a una IA gratis y NO prenden «sólo su IA»: con su',
    'Claude, lo que piden iría a la Gemini gratis. Que corran adentro de `conSuIADelNegocio(ws, …)` (lib/ia-del-negocio.ts),',
    `o, si no le piden nada a una IA, a SIN_IA. Lo que llega a ${SIN_CORTE} no se salva prendiendo nada:`,
    ...afuera.map((u) => `  · ${u.clave}${fueraDe(u.clave) ? ` (está en FUERA_DE_D6B: «${fueraDe(u.clave)!.prefijo}», y el Ops Center no va afuera)` : ''}${u.sinCorte ? ` (llega a ${SIN_CORTE})` : ''}`),
  ].join('\n'));
});

test('5. la tabla es HONESTA: cada «afuera» dice por qué y toca algo, y cada «sin IA» sigue sin IA', () => {
  for (const x of FUERA_DE_D6B) {
    assert.ok(x.porque.length >= 40, `«${x.prefijo}» sin un porqué de verdad`);
    assert.ok(!CARPETAS_OPS_CENTER.some((c) => c.startsWith(x.prefijo) || x.prefijo.startsWith(c)), `«${x.prefijo}» deja afuera una carpeta del Ops Center`);
    for (const s of x.salvo ?? []) assert.ok(existe(s) && s.startsWith(x.prefijo), `«${s}» en el «salvo» de «${x.prefijo}» no existe o no es de ese prefijo`);
  }
  // Rota: dejar un prefijo que ya no toca nada → esta prueba lo nombra (una tabla vieja deja de decir lo que pasa).
  // Desde IA6 lo que llega sólo a la cascada lo decide la puerta: un prefijo «toca algo» si cubre algo que la puerta no ve.
  const viejos = FUERA_DE_D6B.filter((x) => !ALCANZAN.some((u) => fueraDe(u.clave) === x && !sinIADe(u.clave) && !porLaPuerta(u) && (u.sinCorte || !unidadPrende(u.clave)))).map((x) => x.prefijo);
  assert.deepEqual(viejos, [], 'estos prefijos de FUERA_DE_D6B ya no tocan ninguna unidad que llegue a una IA gratis sin prender el contexto: bórralos');
  for (const x of SIN_IA) {
    const u = UNIDADES.find((v) => v.clave === x.unidad);
    assert.ok(u, `${x.unidad} ya no existe: bórrala de SIN_IA`);
    assert.ok(u.cascada || u.sinCorte, `${x.unidad} ya no llega a una IA gratis: bórrala de SIN_IA`);
    assert.ok(u.sinCorte || !unidadPrende(x.unidad), `${x.unidad} ya prende el contexto: bórrala de SIN_IA`);
    assert.ok(x.porque.length >= 15, `${x.unidad} sin un porqué`);
    // Rota: que una de éstas empiece a usar una función con IA → esta prueba lo nombra, y se decide si va adentro.
    assert.deepEqual(usaDe(x.unidad), [...x.usa].sort(), `${x.unidad} cambió lo que usa del repo: ¿ahora le pide algo a una IA? Si sí, adentro de \`conSuIADelNegocio\`; si no, actualiza \`usa\` en SIN_IA`);
    const f = x.unidad.split('#')[0];
    assert.ok(!usaDe(x.unidad).some((l) => DESTINOS.includes(importsDe(f).get(l)!.archivo as Destino)), `${x.unidad} usa una IA gratis directo: no es «sin IA»`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Y corriendo de verdad (tests/_d6b-rutas-hijo.ts)
// ─────────────────────────────────────────────────────────────────────────────

type Corrida = { red: string[]; status: number; cuerpo: { ok?: boolean; ids?: unknown; porTexto?: boolean; explico?: string; warnings?: string[]; corridos?: number; fallidos?: number }; fila?: { estado?: string | null; error?: string | null } | null };
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_d6b-rutas-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as {
  sinSuIA: Record<string, Corrida>; conSuPc: Record<string, Corrida>; enOnboardingConSuPc: Record<string, Corrida>;
  errorAdentro: string; errorAdentroConSuyo: string; error?: string;
};
const GRATIS = /generativelanguage\.googleapis\.com|api\.groq\.com|api\.mistral\.ai|openrouter\.ai|api\.cerebras\.ai/;

test('6. el control: con su Gemini y sin su PC, «Buscar con MaKo», El Archivero (foto y texto) y el AI Analyst programado SÍ salen a su Gemini', () => {
  assert.equal(R.error, undefined, R.error);
  assert.deepEqual(Object.keys(R.sinSuIA).sort(), ['archiveroFoto', 'archiveroTexto', 'buscar', 'cronAnalista']);
  for (const [caso, c] of Object.entries(R.sinSuIA)) {
    assert.ok(c.red.some((h) => GRATIS.test(h)), `${caso}: el control no salió a su Gemini (${c.red.join(', ') || 'nada'}): la prueba no vería una fuga`);
  }
});

test('7. con sólo su PC (su Claude), las rutas de verdad no mandan NADA a una IA gratis, y la pantalla dice lo cierto', () => {
  assert.deepEqual(Object.keys(R.conSuPc).sort(), ['archiveroFoto', 'archiveroTexto', 'buscar', 'cronAnalista']);
  for (const [caso, c] of Object.entries(R.conSuPc)) {
    // Rota: sacar `conSuIADelNegocio` de Buscar, de El Archivero o del cron → esta prueba falla.
    assert.deepEqual(c.red.filter((h) => GRATIS.test(h)), [], `${caso} salió a una IA gratis con el negocio en su propio Claude`);
  }
  // Buscar: vuelve a la búsqueda por texto y lo dice (no «MaKo eligió 0»).
  const b = R.conSuPc.buscar.cuerpo;
  assert.equal(b.porTexto, true);
  assert.equal(b.ids, null);
  assert.match(String(b.explico), /^Con tu propio Claude, para buscar con MaKo necesito tu clave de Claude o de OpenAI.* por texto\.$/);
  // El Archivero: la foto y el texto piden su clave (de Claude o de OpenAI: sin ofrecer Gemini desde el 25/10/2026). Nunca la
  // IA de la plataforma.
  assert.match(String(R.conSuPc.archiveroFoto.cuerpo.warnings?.[0]), /las fotos y los PDF escaneados los leo con tu clave de Claude o de OpenAI/);
  assert.match(String(R.conSuPc.archiveroTexto.cuerpo.warnings?.[0]), /para leer tus documentos necesito tu clave de Claude o de OpenAI/);
  // «tu clave … de Gemini» sí (es SU Gemini, IA16); la Gemini gratis de la plataforma, no.
  for (const c of Object.values(R.conSuPc)) assert.doesNotMatch(JSON.stringify(c.cuerpo), /IA gratis|Gemini \(gratis\)|Gemini gratis/, 'con su propio Claude no se le ofrece la Gemini gratis');
  // Un área (lib/ai-cheap.ts, `errorDeCascada`): sin nada suyo, lo de D6b; con un error suyo, tiene IA (nunca «no hay ninguna IA»).
  assert.equal(R.errorAdentro, 'Con tu propio Claude, para armar los productos necesito tu clave de Claude o de OpenAI (en Integraciones).');
  assert.doesNotMatch(R.errorAdentroConSuyo, /No hay ninguna IA|Gemini/);
});

test('8. el AI Analyst PROGRAMADO falla CERRADO con su PC: la fila queda en error, y el error dice lo cierto', () => {
  const c = R.conSuPc.cronAnalista;
  assert.equal(c.status, 200, `el cron contestó ${c.status}: ${JSON.stringify(c.cuerpo)}`);
  assert.equal(c.cuerpo.fallidos, 1, `el análisis vencido tenía que correr y fallar (${JSON.stringify(c.cuerpo)})`);
  // Rota: sacar `conSuIADelNegocio` del cron → sale a Gemini (prueba 7) y el error es el de la cascada, no éste.
  assert.equal(c.fila?.estado, 'error');
  assert.equal(c.fila?.error, 'Con tu propio Claude, para analizar tus gráficos necesito tu clave de Claude o de OpenAI (en Integraciones).');
  // Y el control llegó a la IA (corrió el análisis de verdad, no se cortó antes por no poder leer la hoja).
  assert.equal(R.sinSuIA.cronAnalista.fila?.estado, 'error');
  assert.doesNotMatch(String(R.sinSuIA.cronAnalista.fila?.error), /Con tu propio Claude/);
});

test('9. el onboarding no se rompe: adentro del contexto, el crédito de Claude de la plataforma sigue', () => {
  const c = R.enOnboardingConSuPc.archiveroTexto;
  // Rota: mover el corte de D6b de `chatCheapCascade` antes del crédito → esta prueba falla (El Archivero del onboarding
  // de un negocio que conectó su Claude quedaría sin IA).
  assert.ok(c.red.includes('api.anthropic.com'), `con el onboarding en curso, El Archivero tendría que probar el crédito de Claude (salió a: ${c.red.join(', ') || 'nada'})`);
  assert.deepEqual(c.red.filter((h) => GRATIS.test(h)), []);
});
