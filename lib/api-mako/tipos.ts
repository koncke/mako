// =============================================================================
// api-mako/tipos — el CONTRATO de una operación de la API de MaKo
// =============================================================================
// Una operación es una cosa que un agente puede LEER o HACER en MaKo: buscar un
// lead, pausar una campaña, proponer una tarea. Se declara UNA vez
// (lib/api-mako/areas/<area>.def.ts) y de esa declaración salen, sin copiar:
//   · los ToolDefs que ve MaKo por WhatsApp y en la app (lib/anthropic.ts),
//   · el catálogo y las rutas HTTP (app/api/v1/**),
//   · la referencia en markdown (docs/api-mako.md, generada),
//   · lo que enseña la skill de Claude del cliente.
//
// SIN `server-only` A PROPÓSITO: los tests, el generador de docs y el catálogo
// importan las definiciones. Los runners (lo que toca la base y los proveedores)
// viven aparte, en `<area>.run.ts`, que sí lleva `server-only`, y se cruzan por id.
//
// ⚠️ «Sin server-only» NO significa «apto para el navegador». Ningún componente
// `'use client'` puede importar un VALOR de acá, de `registro.ts` ni de las defs:
// las ~400 descripciones entrarían al bundle de cada cliente. Hay un test que lo
// cuida (tests/api-mako-registro.test.ts), con el molde de catalogo-fuera-del-bundle.
//
// ⚠️ Y una def solo puede importar VALORES de módulos que tampoco lleven
// `server-only` (detalle-contrato, preguntas-contrato, plan-proyectos-catalogo…):
// el generador de docs corre con `node --import tsx` sin `--conditions react-server`
// y un import transitivo de server-only lo revienta en el pre-push. El mismo test
// lo verifica leyendo el archivo destino de cada import.
// =============================================================================

/** Las áreas son las TABS donde vive el código, no los temas. Cerrado a propósito.
 *  `instagram` salió el 06/10/2026 con su tab (decisión de Martín): sus 21 operaciones
 *  hablaban de una bandeja y un programador que ya no existen. */
import type { Permisos } from './permisos';
import type { Bloque } from '../chat-bloques';

export const AREAS = [
  'general', 'plan', 'crm', 'ads', 'chats', 'whatsapp', 'email', 'chatbot',
  'metricas', 'experimentos', 'landing', 'closing', 'negocio', 'contenido', 'video',
  'imagen', 'integraciones', 'equipo', 'cs', 'curso', 'comunidad', 'calendario', 'creaciones', 'operaciones', 'spy', 'leadmagnet', 'cobros', 'mako',
] as const;
export type Area = (typeof AREAS)[number];

/** Cómo se llama y dónde vive cada área, para el catálogo y la referencia. */
export const AREA_INFO: Record<Area, { titulo: string; tab: string; ruta: string }> = {
  general: { titulo: 'General', tab: 'General', ruta: '/general' },
  plan: { titulo: 'Plan', tab: 'Plan', ruta: '/plan' },
  crm: { titulo: 'CRM', tab: 'CRM', ruta: '/crm' },
  ads: { titulo: 'Ads (Manager y Analyst)', tab: 'Ads Manager', ruta: '/ads-manager' },
  // La bandeja unificada (14/10/2026, docs/diseno-chats.md): WhatsApp, Instagram y Messenger por contacto. Lee y
  // cambia el ESTADO de una conversación (cerrar, reabrir, posponer); no manda nada (eso es crear_borrador_whatsapp_empresa).
  chats: { titulo: 'Chats (WhatsApp, Instagram y Messenger)', tab: 'Chats', ruta: '/chats' },
  whatsapp: { titulo: 'WhatsApp', tab: 'WhatsApp', ruta: '/whatsapp' },
  email: { titulo: 'Email', tab: 'Email', ruta: '/email' },
  // El ÁREA se sigue llamando `chatbot` (es la clave del registro, de las operaciones y de
  // los permisos de los tokens); la TAB es Automations desde el 09/10/2026 (ex /chatbot).
  chatbot: { titulo: 'Chatbot y secuencias', tab: 'Automations', ruta: '/automations' },
  metricas: { titulo: 'Dashboard y análisis', tab: 'Dashboard', ruta: '/dashboard' },
  // 17/10/2026: la tab Experiments se retiró y los experimentos viven en el Dashboard («Editar con MaKo»). El ÁREA sigue
  // llamándose `experimentos`: es la clave del registro, de las operaciones y de los permisos de los tokens.
  experimentos: { titulo: 'Experimentos y Retro', tab: 'Dashboard', ruta: '/dashboard' },
  // Landing Analyst y Closing Analyst se retiraron como tabs el 11/10/2026: analizar una página es parte
  // de Web Generator, y las llamadas son la hoja «Closing» del Dashboard. Las ÁREAS (`landing`,
  // `closing`) y sus títulos no cambian: son la clave del registro y de los permisos de los tokens.
  landing: { titulo: 'Landing (Analyst, Generator y tracking)', tab: 'Web Generator', ruta: '/web-generator' },
  closing: { titulo: 'Closing Analyst', tab: 'Dashboard', ruta: '/dashboard?hoja=closing' },
  // El TÍTULO no cambia (es la clave del área). La tab sí: el hub de /onboarding se retiró el 15/10/2026 y lo que
  // carga esta área se edita en Second Brain (lib/secciones-negocio.ts).
  negocio: { titulo: 'El negocio (onboarding, Second Brain, conocimiento)', tab: 'Second Brain', ruta: '/second-brain' },
  contenido: { titulo: 'Content Machine', tab: 'Ads Writer', ruta: '/ads-writer' },
  video: { titulo: 'Video Generator', tab: 'Video Generator', ruta: '/video-generator' },
  // El Image Editor, la copia de Canva (15/10/2026, el día que se abrió a todos los workspaces). Área propia y no
  // `contenido`: un token con escritura en Content Machine no crea ni cambia diseños, y los tokens que ya existen no la tienen.
  imagen: { titulo: 'Image Editor (diseños)', tab: 'Image', ruta: '/image-editor' },
  integraciones: { titulo: 'Integraciones', tab: 'Integraciones', ruta: '/integraciones' },
  // `/configuraciones` redirige desde el 26/10/2026 (se fue «General»): la cuenta empieza en el Perfil de Settings.
  equipo: { titulo: 'Cuenta, equipo y notificaciones', tab: 'Settings', ruta: '/perfil' },
  // La CLAVE del área (`cs`) no cambia: la usan los tokens y los permisos. El título sí, porque es lo que MaKo lee y
  // dice (el prompt de los pedidos, la referencia, el permiso de un token): desde el 17/10/2026 Clientes, Curso y
  // Comunidad son UNA tab, Clients (docs/diseno-clients.md), y el 24/10 MaKo le mandó a Leandro a buscar los cursos en
  // «Customer Success», una tab que ya no existe (f30 de la llamada).
  cs: { titulo: 'Clients (la cartera y su entrega)', tab: 'Classroom › Clients', ruta: '/classroom/clients' },
  curso: { titulo: 'Curso (módulos y clases)', tab: 'Classroom', ruta: '/classroom' },
  // La comunidad de cada producto (posts, comentarios, eventos), 17/10/2026: sale SÓLO por HTTP, como `curso`.
  comunidad: { titulo: 'Comunidad', tab: 'Classroom › Community', ruta: '/classroom/community' },
  // Las creaciones que un negocio publica para los demás y sus estrellas (13/10/2026, lib/creaciones.ts). Sin tab
  // en la barra: la galería vive en /creaciones y cada feature pone su botón «Publicar».
  creaciones: { titulo: 'Creaciones de la comunidad (estrellas)', tab: 'Creaciones', ruta: '/creaciones' },
  // La pasarela de pagos (11/10/2026, docs/diseno-pasarela-pagos.md). Área PROPIA y no `crm`, a
  // propósito: un token detallado con escritura en el CRM no crea links de pago ni reembolsa, y los
  // tokens que ya existen no la tienen. Vive en la ficha del lead (tab Pagos), por eso la tab es el CRM.
  cobros: { titulo: 'Cobros (Stripe, Mercado Pago y Creem)', tab: 'CRM', ruta: '/crm' },
  // El Calendario (13/10/2026): sólo lo que se agenda en la tab. La agenda de Google no sale por la API.
  calendario: { titulo: 'Calendario', tab: 'Calendario', ruta: '/calendario' },
  // El Centro de Operaciones (15/10/2026): sólo la plataforma, sólo lecturas (operaciones.def.ts).
  operaciones: { titulo: 'Centro de Operaciones (pedidos a los chats de Claude)', tab: 'Centro de Operaciones', ruta: '/admin/operaciones' },
  // Competitors Spy (31/10/2026, docs/diseno-competitors-spy.md): mira a los competidores que el negocio eligió.
  // El ÁREA se llama `spy` y la TAB «Competitor Spy», con la nav key 'market-an', que está escrita en la base.
  spy: { titulo: 'Competidores', tab: 'Competitor Spy', ruta: '/competitor-spy' },
  // El Lead Magnet Generator (5/11/2026): las plantillas y lo que cada una arma en su herramienta (lib/lead-magnets/).
  leadmagnet: { titulo: 'Lead magnets', tab: 'Lead Magnet', ruta: '/lead-magnet-generator' },
  // Desde el 16/10/2026 el chat con MaKo es el Second Brain (etapa 2 de docs/diseno-mako-ai-native.md).
  mako: { titulo: 'MaKo (pendientes, propuestas, chats)', tab: 'Second Brain', ruta: '/second-brain' },
};

/**
 * ¿Lo que devuelven las operaciones de esta área lleva DATOS DE LOS CLIENTES DEL NEGOCIO: sus leads, sus conversaciones,
 * sus llamadas, sus cobros, sus alumnos, su equipo? Lo pregunta quien manda un turno a una IA que entrena con lo que
 * recibe (la red gratis de la plataforma): con datos de clientes, ese turno no va (AGENTS.md, regla del 16/10/2026).
 *
 * Por ÁREA y con todas escritas: un área nueva no compila sin decidirlo, y `true` es el lado cerrado. Lo propio del
 * negocio (sus tareas, sus KPIs, sus páginas, sus anuncios, su perfil) no es de un cliente. Una operación que no sigue a
 * su área lo dice en su def (`datosDeClientes`), y lo lee `leeDatosDeClientes` (registro.ts). En las áreas en `false`,
 * tests/doer-red-datos-clientes.test.ts exige esa marca escrita en toda operación con un nombre sospechoso (lead,
 * llamada, chat, cobro…): sumar una así es DECIDIR. `mako` va en `true` aunque sus pendientes no: lo que traen
 * listar/confirmar/cancelar es lo de cada pendiente, y eso se mira aparte (`turnoParaLaRed`,
 * lib/doer-herramientas.ts).
 */
export const DATOS_DE_CLIENTES_POR_AREA: Record<Area, boolean> = {
  general: false, plan: false, crm: true, ads: false, chats: true, whatsapp: true, email: true, chatbot: true,
  // El Dashboard lee leads uno por uno (a quién cobrar, los del embudo maduro, el detalle de un número).
  metricas: true, experimentos: false, landing: false, closing: true, negocio: false, contenido: false, video: false,
  imagen: false, integraciones: false,
  // Los datos del equipo y las identidades fiscales del negocio son de personas que no son quien escribe.
  equipo: true, cs: true, curso: true,
  // Posts, comentarios y miembros son de personas que no son quien escribe (los alumnos del negocio).
  comunidad: true, calendario: false, creaciones: false, operaciones: false, cobros: true,
  // Un competidor NO es un cliente del negocio: lo que se guarda de él es público y no sale de ninguna
  // conversación, ningún lead ni ningún cobro.
  spy: false,
  // Lead Magnet (5/11/2026): plantillas y lo que el negocio regala (una página, una landing): nada de un lead ni de un cliente.
  leadmagnet: false,
  mako: true,
};

/** Por dónde puede entrar un pedido. Lo declara CADA operación, en positivo. */
export const CANALES = ['whatsapp', 'app', 'http'] as const;
export type Canal = (typeof CANALES)[number];

/**
 * Cómo se confirma una acción. NO existe «sin confirmación»: la regla de la casa es
 * que un canal PROPONE y una persona confirma, y el tipo no deja declarar otra cosa.
 *   · chat     → queda PENDIENTE con vencimiento (2 h). La confirma una PERSONA: con
 *                un «sí» aparte en WhatsApp, o en la bandeja /mako/pendientes de la
 *                app. Por HTTP solo la confirma un token con alcance `ejecutar`.
 *                Para cambios de estado de UNA entidad ya identificada por id,
 *                reversibles o de bajo impacto.
 *   · pantalla → queda una PROPUESTA con un link a una pantalla de MaKo, editable,
 *                donde una persona la mira, la corrige y la confirma. Para datos
 *                exactos que un modelo puede transcribir mal, creaciones con varios
 *                campos, lo que gasta plata o créditos, y envíos masivos.
 */
export type Confirmacion = 'chat' | 'pantalla';

/**
 * Qué puede pedir un token, EN POSITIVO y por lo que AGREGA cada nivel:
 *   · lectura  → solo lecturas.
 *   · proponer → + acciones (dejan una pendiente o una propuesta que confirma una
 *                persona). Es lo que hoy ya hacen /api/agente/plan y /lead, y el
 *                DEFAULT de todo token acuñado antes de que existiera el alcance.
 *   · ejecutar → + confirmar y cancelar pendientes por API. Se acuña a propósito,
 *                con el texto de lo que significa a la vista.
 * Va en el PREFIJO del token (ver lib/api-mako/alcance.ts): rotar el token resetea
 * el alcance junto con él, sin un segundo setting que pueda quedar desfasado.
 */
export const ALCANCES = ['lectura', 'proponer', 'ejecutar'] as const;
export type Alcance = (typeof ALCANCES)[number];

/** Qué cuesta correrla. Decide topes, cuotas y qué se dice en el catálogo.
 *   gratis  → solo nuestra base
 *   ia      → invoca un modelo (por las libs que ya pasan por el veto y el registro)
 *   externo → pega a un proveedor (Meta, Chatwoot, Calendly, Fathom): puede tardar
 *   dinero  → mueve plata o gasta créditos de terceros */
export type Costo = 'gratis' | 'ia' | 'externo' | 'dinero';

/** En qué viene el resultado de una lectura. Markdown es lo que un modelo lee mejor
 *  y lo que se puede pegar en un chat; JSON es para calcular encima. */
export type Salida = 'json' | 'markdown' | 'texto';
export type Formato = 'json' | 'md' | 'csv' | 'texto';

export type TipoParametro = 'string' | 'number' | 'boolean' | 'string[]' | 'object' | 'object[]';

/**
 * Un parámetro de entrada. De acá salen el `input_schema` del ToolDef, la
 * validación del input, el formulario de la pantalla genérica de revisión y la
 * tabla de la referencia. Una sola declaración, cuatro usos.
 */
export type Parametro = {
  /** el nombre EXACTO que lee la lib (no lo que parezca: buscar_tutorial pide `tema`) */
  nombre: string;
  tipo: TipoParametro;
  /** lo que lee el modelo y la persona: qué es, de dónde se saca, qué forma tiene.
   *  Español neutro: lo lee un cliente en la referencia. */
  descripcion: string;
  /** el rótulo que ve una PERSONA en un formulario (el paso «⚡ Acción» de un flujo), con sus
   *  tildes y en 1-3 palabras: «Título», «Año», «Automatización». Opcional: sin él sale del
   *  diccionario de respaldo de lib/editor-acciones.ts (`rotuloDeParametro`) o del nombre partido.
   *  Antes el editor lo derivaba del camelCase y salía «Titulo», «Razon», «Anio». */
  rotulo?: string;
  obligatorio?: boolean;
  /** valores permitidos (para `string` y `string[]`) */
  enum?: readonly string[];
  /** tope de largo (string: caracteres; string[] / object[]: ítems). Sin declarar,
   *  el validador aplica 4000 caracteres y 200 ítems: un cuerpo sin tope es un
   *  JSON.parse de megas en una función serverless. */
  max?: number;
  /** solo `number`: exige un entero (ids, cantidades). Sin esto `1.5` pasa como leadId. */
  entero?: true;
  /** solo `number`: el rango permitido, inclusive. */
  minimo?: number;
  maximo?: number;
  /** sólo listas: `[]` es un VALOR (vaciar), no «no vino». Sin esto el validador descarta una lista
   *  vacía, que es lo correcto para un filtro y deja sin forma de vaciar algo que se reemplaza entero
   *  (las tareas de una clase: `tareas: []` las saca). */
  vaciaEsValor?: true;
  /** el que dice SOBRE QUÉ se hace (el cobro que se devuelve): en /mako/revisar se ve y NO se cambia. El resumen que la
   *  persona confirma se armó con él; cambiarlo ejecutaba la acción sobre otro bajo el título del primero (devolverle la
   *  plata a otro cliente). Para otro, se propone de nuevo. Lo hace cumplir `aplicarPropuestaGenerica` (15/10/2026). */
  fijoAlRevisar?: true;
  /** para `object` y `object[]`: sus campos, recursivo */
  campos?: readonly Parametro[];
  ejemplo?: unknown;
};

/** Quién puede correrla y qué necesita conectado. Todo en positivo. */
export type Gating = {
  /** Fase 1: las escrituras a Meta salen por la cuenta del workspace principal
   *  (OWNER_WS = 1, que es Mauricio, un CLIENTE, no la plataforma). Con esto, la
   *  operación existe solo para ws 1 con rol admin; para el resto, 404. */
  soloWs1?: true;
  /** SÓLO LA PLATAFORMA: el workspace de capa `superadmin` (el de MaKo). Para cualquier otro
   *  negocio la operación no existe. Para lo que la plataforma decide SOBRE los negocios y un
   *  negocio no puede deshacer en el suyo (exigir el 2FA: un admin de cliente que pudiera
   *  «dejar de exigir» anularía la exigencia de Martín). Se resuelve por CAPA en `vistaDe`. */
  soloPlataforma?: true;
  /** la integración que tiene que estar conectada (`meta`, `calendly`, `chatwoot`, …).
   *  Informativa en el catálogo; el runner contesta un error legible si falta. */
  integracion?: string;
  /** la key de app/_components/nav.ts que la CAPA del workspace tiene que incluir
   *  (lib/capas.ts). Un cliente `pm` no tiene CRM: para él la operación no existe. */
  tab?: string;
  /** `admin` = solo el admin del workspace (en la app un closer/setter no la ve).
   *  Por HTTP y WhatsApp el rol es siempre admin (solo un admin acuña el token y el
   *  grupo es del dueño). Obligatorio en todo lo que mueve plata. */
  rolMinimo?: 'admin';
};

type Base = {
  /** snake_case en español, verbo + objeto, único en TODO el registro */
  id: string;
  area: Area;
  /** 3-6 palabras, para el catálogo humano */
  titulo: string;
  /** lo que lee el MODELO para decidir cuándo usarla: qué es, cuándo, qué necesita
   *  antes. Es la `description` del ToolDef, textual. Español neutro (hay un test
   *  de voseo sobre todo lib/). */
  descripcion: string;
  parametros: readonly Parametro[];
  /** POR DÓNDE se expone. En positivo y obligatorio: declarar `tipo:'lectura'` no
   *  es decidir que salga por HTTP a un token que vive en la máquina de un tercero
   *  (transcripts de llamadas, emails del equipo, costos). Un test snapshot fija el
   *  conjunto que sale por `http`; sumar una es DECIDIR, no un default. */
  canales: readonly Canal[];
  costo: Costo;
  gating?: Gating;
  /** nombres anteriores (de MAKO_TOOLS, MAKO_ACCION_TOOLS o de /api/agente/*) que
   *  siguen resolviendo acá. Los usa el doer, la skill instalada y las pendientes. */
  alias?: readonly string[];
  /** true si el runner LEE la agenda de Google (eventos, horarios, invitados). Lo que
   *  lee va a la persona por `paraLaPersona`, NUNCA al modelo: el modelo recibe un
   *  estado de `lib/agenda-sin-ia.ts` o un resumen armado con lo que dijo la persona y
   *  el CRM (decisión de Martín, 07/10/2026). El chat de la app no las ofrece: guarda
   *  cada respuesta y la reusa, y no tiene dónde separar lo que es para la persona.
   *  Un runner que llama a `lib/google-calendar` sin declararlo, o que interpola un dato
   *  de la agenda en lo que ve el modelo, no pasa `tests/agenda-sin-ia.test.ts`. */
  datosDeGoogle?: true;
  /** Pisa, para ESTA operación, lo que dice su área en `DATOS_DE_CLIENTES_POR_AREA`: `true` si lee leads,
   *  conversaciones, llamadas o cobros de los clientes del negocio en un área que no los tiene; `false` si lo que trae
   *  no es de ningún cliente en un área que sí. No va al modelo ni al catálogo. */
  datosDeClientes?: boolean;
  /** true si puede pasar de 30 s (pagina tablas grandes, sale a un proveedor lento).
   *  Va al catálogo; la ruta HTTP tiene `maxDuration = 60`. */
  lenta?: true;
};

export type LecturaDef = Base & {
  tipo: 'lectura';
  salida: Salida;
  /** formatos alternativos que acepta por `?formato=` (p.ej. metricas: md, csv, json).
   *  Sin esto, solo `salida`. El runner recibe `formato` en el input. */
  formatos?: readonly Formato[];
};

/** Dónde se revisa una propuesta. Cerrado: cada pantalla existe en app/. `/video-editor` es el editor mismo: lo que la
 *  API propone en un proyecto se acepta en su chat «Editar con IA» (lib/editor-video/propuestas.ts). */
export type RutaPantalla = '/crm/revisar' | '/plan/revisar' | '/mako/revisar' | '/whatsapp' | '/video-editor';

export type AccionDef = Base & {
  tipo: 'accion';
  confirmacion: Confirmacion;
  /** true si deshacerla es trivial (pausar/activar, mover etapa). Va al catálogo y al modelo */
  reversible: boolean;
  /** qué escribe y dónde, en una frase: «cambia pipeline_stage del lead y deja historial» */
  escribe: string;
  /** solo `pantalla`: dónde se revisa. `/mako/revisar` es la pantalla GENÉRICA, que
   *  pinta un formulario desde `parametros` y al confirmar llama `ejecutar()`. Las
   *  otras tienen su propia pantalla y su propio `proponer()`. */
  pantalla?: RutaPantalla;
  /** el `tipo` que se persiste en mako_acciones_pendientes al proponer por chat.
   *  Default: el id. Las 7 acciones heredadas usan el slug que ya está en la base
   *  (`lead_etapa`, `meta_estado`, …) para que las pendientes vigentes al momento
   *  del deploy sigan resolviendo. */
  tipoPendiente?: string;
  /**
   * true si, al ejecutarla, ALGO LE LLEGA A OTRA PERSONA (el email y el WhatsApp al alumno, el aviso de Calendly o la invitación de
   * Google al lead): no se deshace. Por WhatsApp se confirma sólo con un «sí» sin nada más (lib/confirmacion-pura.ts, 21/10/2026):
   * un «ok, esperá que lo reviso» no la ejecuta. Una acción nueva que le escribe a alguien lo declara acá;
   * tests/confirmacion-terceros.test.ts frena la que lo dice en su descripción y no lo marca.
   */
  aTerceros?: boolean;
  /**
   * true si, al ejecutarla, MUEVE PLATA (D2: activar una campaña de Meta enciende el gasto, un monto de una venta o de una cuota):
   * por WhatsApp se confirma con la MISMA puerta que lo que le llega a un tercero, un «sí» sin nada más (22/10/2026, la revisión
   * adversarial de Ops Center 1.2: «perfecto, después lo veo» activaba la campaña si el modelo lo decidía).
   */
  plata?: boolean;
};

/**
 * Las DOS operaciones que gobiernan pendientes (confirmar y cancelar). No son
 * acciones —no dejan una pendiente ni una propuesta: cierran una— y no son
 * lecturas. Corren directo, con el alcance que declaran. Solo existen en el área
 * `mako`; el test lo fija.
 */
export type ControlDef = Base & {
  tipo: 'control';
  /** `ejecutar` para confirmar (por HTTP ejecuta una escritura real); `proponer`
   *  para cancelar (deshacer lo propio no exige más que haberlo propuesto). */
  alcanceMinimo: Alcance;
};

export type OperacionDef = LecturaDef | AccionDef | ControlDef;

export const esAccion = (d: OperacionDef): d is AccionDef => d.tipo === 'accion';
export const esLectura = (d: OperacionDef): d is LecturaDef => d.tipo === 'lectura';
export const esControl = (d: OperacionDef): d is ControlDef => d.tipo === 'control';

/** El alcance mínimo que exige una operación. Derivado, no declarado: una lectura
 *  con `lectura`, toda acción con `proponer` (dejar una pendiente o una propuesta
 *  no escribe nada), y un control con el suyo. */
export function alcanceMinimo(d: OperacionDef): Alcance {
  if (esLectura(d)) return 'lectura';
  if (esAccion(d)) return 'proponer';
  return d.alcanceMinimo;
}

// ── El contexto con el que corre una operación ───────────────────────────────

export type Rol = 'admin' | 'miembro';

export type Ctx = {
  /** el workspace: SALE del bearer o del grupo, jamás del input */
  ws: number;
  canal: Canal;
  /** la clave de scope de las pendientes (lib/api-mako/canal.ts): el grupoJid en
   *  WhatsApp, `app:<sesión>`, `api:<ws>` en HTTP. Un «sí» solo alcanza lo que se
   *  propuso en ESTE canal — salvo la bandeja de la app, que ve todo el workspace. */
  canalKey: string;
  alcance: Alcance;
  /** admin del workspace o miembro (closer/setter). http y whatsapp son siempre admin. */
  rol: Rol;
  /** true solo desde la bandeja /mako/pendientes: una persona logueada confirmando
   *  cualquier pendiente del workspace, venga del canal que venga. */
  bandeja?: true;
  /** ms del arranque del turno (whatsapp/app): una pendiente creada en este mismo
   *  turno no se puede confirmar en él — el «sí» del humano es un mensaje aparte */
  turnStart?: number;
  /** el último mensaje del humano (whatsapp): algunas acciones se niegan a inventar
   *  contenido cuando lo único que dijo es «sí, dale» */
  mensajeUsuario?: string;
  /** quién confirma (email de la sesión), para el historial */
  actor?: string;
  /** Sólo en un grupo de WhatsApp: quién escribe (el `participant`, lib/confirmacion-pura.ts `quienEnElGrupo`; null en un lote
   *  de varios) y si el mensaje le habla a MaKo («sí, MaKo», «@MaKo», la respuesta citada a MaKo). Lo que se propone guarda quién
   *  lo pidió, y una pendiente de plata sólo la confirma ésa persona o un «sí» a MaKo (`elSiEsDeQuienPidio`). */
  enElGrupo?: { quien: string | null; aMaKo: boolean };
  /** Sólo en la app: la persona de la sesión que chatea (`usuarios.id` como `sub`). «Mi hoja» es la suya: el Dashboard
   *  y General leen el informe de quien chatea, como la pantalla, salvo que se nombre a otra persona (20/10/2026, Ops
   *  Center = lo principal, pieza 1.5). Se lee con `quienChatea(ctx)`, que lo ignora en otro canal. */
  quien?: { sub: string; email: string; nombre: string };
  /** para las lecturas con `formatos`: el pedido por `?formato=` */
  formato?: Formato;
  /** Por dónde el CÓDIGO le habla a la persona sin pasar por el modelo: el doer de
   *  WhatsApp lo junta y lo agrega a la respuesta. Sin esto (HTTP, la bandeja) el
   *  `paraLaPersona` de un runner no tiene a quién llegar y se descarta. */
  aPersona?: (texto: string) => void;
  /** Por dónde una herramienta le DIBUJA algo a la persona (lib/chat-bloques.ts): una LECTURA con el `bloque` de su salida
   *  («A quién cobrar», un gráfico) o una PROPUESTA de pantalla con `extra.bloque` (el antes y el después del Video Editor).
   *  Lo pone sólo el turno de la app (`turnoApp`), que lo guarda con la respuesta de MaKo. El modelo no lo ve; sin esto
   *  (WhatsApp, HTTP) se descarta. El camino es de Pagos (20/10/2026, la 2.27); las propuestas, 21/10.
   *  Devuelve `false` si NO lo dibujó (el tope de bloques del mensaje): así el `siSeDibuja` de una lectura no se dice. */
  aDibujar?: (b: Bloque) => boolean | void;
  /** Por dónde el CÓDIGO le dice a la persona qué conexión le falta (`Falta`, 25/10/2026): el doer de WhatsApp agrega la línea
   *  con su link (lib/conexiones-catalogo.ts, `lineaParaConectar`) sin que la escriba el modelo. Sin esto, el link viaja en el
   *  JSON que lee el modelo (`runnerDelRegistro`). */
  aFalta?: (f: Falta) => void;
  /** Sólo en la app: los archivos que la persona adjuntó en el mensaje de ESTE turno, ya guardados (su `ref` es la de
   *  /api/mako/chat?adjunto=). El estado de cuenta del lead toma el comprobante de acá (la 2.28). */
  adjuntos?: readonly { ref: string; nombre: string; tipo: 'image' | 'document' }[];
  /** Sólo un token DETALLADO por /api/v1 (lib/api-mako/permisos.ts): qué nivel tiene en
   *  cada área. Ausente = no hay restricción por área (los demás canales y el token
   *  clásico, que se gobiernan con `alcance`). Lo mira `gatingOk` al proponer Y al
   *  confirmar, así que una pendiente de un área sin escritura tampoco se confirma. */
  permisos?: Permisos;
  /** El token detallado que pidió (id y nombre), para el rastro: va en el `actor` de lo
   *  que confirma y en `api_llamadas`. */
  token?: { id: string; nombre: string };
  /** Sólo un token DETALLADO por /api/v1: el email de la persona que lo creó (y que sigue administrando el negocio:
   *  si no, el token no vale). Es QUIÉN FIRMA lo que se publica en la comunidad (`personaDe`,
   *  lib/api-mako/areas/comunidad.helpers.ts): un token clásico, WhatsApp o un flujo no traen persona y esas
   *  escrituras fallan con el motivo en vez de inventar un autor. */
  persona?: string;
  /** Lo que el TURNO sabe para un ticket (lib/tickets-reglas.ts, `ContextoTicket`): lo que pidió la persona, lo que
   *  contestó MaKo y los errores que registró el código al correr las herramientas. Lo pone el chat que corre el turno
   *  (lib/mako-turno-app.ts) y lo lee `levantar_ticket`: así el error de un ticket nunca lo escribe el modelo. */
  contextoTicket?: () => Record<string, unknown>;
  /** La imagen o el video que mandaron en el MENSAJE de este turno (29/10/2026, «súbeme este anuncio» desde el grupo,
   *  `proponer_anuncio_desde_archivo`): lo pone el turno del grupo (lib/mako-doer-in.ts) y lo baja recién cuando se pide. null si
   *  el mensaje no trae ninguno o no se pudo bajar. */
  archivoDelMensaje?: () => Promise<{ base64: string; mime: string; nombre: string } | null>;
};

/** La persona que chatea, sólo en la app (`Ctx.quien`). En WhatsApp, por HTTP o en un flujo no hay nadie «mío». */
export const quienChatea = (ctx: Pick<Ctx, 'canal' | 'quien'>): { sub: string; email: string; nombre: string } | null =>
  (ctx.canal === 'app' && ctx.quien ? ctx.quien : null);

// ── Lo que devuelven los runners ─────────────────────────────────────────────

/**
 * LO QUE LE FALTA CONECTAR AL NEGOCIO, COMO DATO (25/10/2026, docs/conexiones-y-ayuda.md). Los runners decían «Fathom no está
 * conectado en este negocio: se conecta en /integraciones», un texto suelto: con eso el código no podía armar el link directo
 * al modal ni ofrecer ayuda, y el modelo mandaba a la pantalla general. `servicio` es una key de lib/conexiones-catalogo.ts
 * (la de la tarjeta de /integraciones, o 'pc', 'ia', 'whatsapp').
 */
export type Falta = { servicio: string };

/** Igual que el `ToolRunner` de lib/anthropic.ts: texto, o «esto salió mal por
 *  adentro de un resultado válido». Para `formatos`, además el tipo y cabeceras.
 *  `siSeDibuja`: lo que el modelo lee además de `content` SÓLO si el `bloque` se dibujó de verdad («la persona ya lo ve:
 *  no repitas la tabla»). Dicho siempre, con el bloque descartado, el modelo callaba algo que nadie veía (21/10). */
export type SalidaLectura =
  | string
  | { content: string; isError?: boolean; formato?: Formato; headers?: Record<string, string>; paraLaPersona?: string; bloque?: Bloque; siSeDibuja?: string; falta?: Falta };

/** Lo que una acción `chat` deja listo ANTES del «sí»: el payload saneado (lo que
 *  se va a ejecutar, con ids resueltos) y el resumen que lee la persona. `faltan`
 *  nombra lo que hay que pedir antes de proponer (monto, motivo).
 *
 *  ⚠️ El `resumen` lo lee también el MODELO: viaja en la respuesta de la herramienta,
 *  en el system de cada turno mientras la pendiente esté viva y en listar_pendientes.
 *  Lo que no puede ver un modelo (la agenda de Google) va en `paraLaPersona`. */
export type Preparado =
  | { payload: Record<string, unknown>; resumen: string; paraLaPersona?: string }
  | {
      error: string; faltan?: string[]; disponibles?: unknown; paraLaPersona?: string;
      /** La conexión que hace falta para esto (`Falta`). */
      falta?: Falta;
      /** «Ya está así»: lo pedido YA es el estado actual (el lead ya está en esa secuencia, en
       *  ese producto, ya está marcado). Para un canal con persona es un rechazo como cualquier
       *  otro; para un paso de un flujo (lib/api-mako/flujo.ts) es un éxito sin nada que hacer,
       *  y no le manda una alarma al dueño cada vez que el evento se repite. */
      yaEstaba?: boolean;
      /** Es una GUARDA (un dato que falta, un pedido que MaKo no deja hacer). Desde el 28/10/2026 lo es TODO `error` de un
       *  preparar sin `falla` (lib/api-mako/ejecutar.ts): son validaciones por construcción, y son cientos (la verificación de
       *  692368a60: 734 reglas sin marca abrían ticket). Queda para quien la quiera explícita. */
      guarda?: true;
      /** Es una FALLA nuestra (una lectura que no anduvo: «No pude leer las pasarelas conectadas»), no una regla: el «no pude»
       *  que la sigue abre ticket (lib/no-pude.ts, `esGuardaDeHerramienta`). La pone quien la produce; tests/guarda-por-defecto
       *  pide que todo `return { error: 'No pude…' }` de un preparar la lleve. */
      falla?: true;
    };

/** Lo que devuelve la escritura REAL. NUNCA lanza: si algo falla, `ok: false` con
 *  el motivo — así la pendiente se resuelve y un «sí» repetido no la re-ejecuta. El
 *  `resumen` vuelve al modelo y se guarda en la pendiente; el detalle que no puede ver
 *  un modelo va en `paraLaPersona`.
 *  `datos.bloque` (20/10/2026, el marco de bloques: lib/chat-bloques.ts) es lo que el chat DIBUJA con el resultado (lo
 *  creado con su miniatura, el antes y el después): lo arma el runner con sus datos y sus rutas, nunca con texto del
 *  modelo, y se sanea antes de guardarlo. */
export type Ejecutado = { ok: boolean; resumen: string; datos?: Record<string, unknown> & { bloque?: Bloque }; paraLaPersona?: string };

/** `extra.bloque`: lo que la propuesta DIBUJA (va por `ctx.aDibujar`; el modelo recibe `extra` sin él). */
/** `falla`: como en `Preparado`, el error de un proponer es una GUARDA salvo que sea una falla nuestra. */
export type Propuesto = { id: string; url: string; nueva: boolean; extra?: Record<string, unknown> & { bloque?: unknown } } | { error: string; falla?: true };

export type LecturaRun = {
  leer: (input: Record<string, unknown>, ctx: Ctx) => Promise<SalidaLectura>;
};

export type AccionRun = {
  /** valida el input contra la base (existe el lead en ESTE ws, el hueco sigue
   *  libre, falta el monto) y arma { payload, resumen }. No escribe nada.
   *  Obligatorio salvo en las heredadas que traen `proponerLegado` o `proponer`. */
  preparar?: (input: Record<string, unknown>, ctx: Ctx) => Promise<Preparado>;
  /** SOLO las acciones `chat` heredadas de lib/mako-doer-acciones.ts, hasta que se
   *  muden: corre la tool vieja ENTERA (valida y deja la pendiente ella misma) y
   *  devuelve su JSON con `pendiente_id`. Con esto presente, el choke point no llama
   *  preparar() ni crea la pendiente: parsea ese JSON. `ejecutar` sigue siendo
   *  obligatorio (corre al confirmar, por `ejecutarAccion`). */
  proponerLegado?: (input: Record<string, unknown>, ctx: Ctx) => Promise<string>;
  /** la escritura, por el caller ya gateado (setPipelineStage, metaWrite, …). Corre
   *  al confirmar: en WhatsApp, en la bandeja, o por HTTP con `ejecutar`. */
  ejecutar: (payload: Record<string, unknown>, ctx: Ctx) => Promise<Ejecutado>;
  /** Lo que se puede saber SIN escribir y haría fallar a `ejecutar` (por ejemplo: «esto sale firmado y este pedido no trae a
   *  nadie que firme»). Lo pregunta `confirmarPendiente` ANTES de reclamar la pendiente, y la pantalla genérica antes de
   *  marcarla aplicada: reclamar la quema (queda en `error`), y un «sí» que no se puede cumplir no puede dejarla así para
   *  quien sí la podía confirmar (regla 3 de AGENTS.md: lo que se sabe sin escribir falla antes). Devuelve el motivo, o null.
   *  `{ yaNoVale }`: la propuesta no se va a poder cumplir NUNCA (el plan de cuotas cambió desde que se propuso): se cierra con
   *  ese motivo. Viva, el «sí» pelado de WhatsApp a la que se pide de nuevo chocaba con ella (revisión de 7f79a4e6c, B12). */
  faltaParaConfirmar?: (payload: Record<string, unknown>, ctx: Ctx) => Promise<string | { yaNoVale: string } | null>;
  /** SOLO las `pantalla` con pantalla PROPIA (leads → /crm/revisar, tareas →
   *  /plan/revisar, borradores → /whatsapp): dejan la propuesta en su tabla y
   *  devuelven el link. Sin esto, una `pantalla` va a la genérica /mako/revisar/<id>. */
  proponer?: (input: Record<string, unknown>, ctx: Ctx) => Promise<Propuesto>;
};

export type ControlRun = {
  correr: (input: Record<string, unknown>, ctx: Ctx) => Promise<SalidaLectura>;
};

export type Run = LecturaRun | AccionRun | ControlRun;
export type Runners = Readonly<Record<string, Run>>;

// ── Lo que devuelve `ejecutarOperacion` (y lo que sale por HTTP) ─────────────

export type Resultado =
  | { ok: true; tipo: 'lectura'; salida: Salida; formato?: Formato; headers?: Record<string, string>; resultado: string }
  /** `crudo` = lo que devolvió la tool HEREDADA, textual: el doer de WhatsApp lo
   *  recibe tal cual (misma salida que siempre) mientras los cuerpos no se muden. */
  | { ok: true; tipo: 'pendiente'; pendiente: { id: number; resumen: string; venceEnMin: number; url: string }; crudo?: string }
  | { ok: true; tipo: 'propuesta'; propuesta: { id: string; url: string; nueva: boolean; extra?: Record<string, unknown> } }
  | { ok: true; tipo: 'control'; resultado: string }
  /** `motivo`: lo que contestó la base cuando la pendiente no entró (va al rastro de un flujo, nunca a una persona ni por
   *  HTTP). `noCorrio`: se sabe que NO se ejecutó nada (la pendiente no existe): un flujo lo puede reintentar sin repetir. */
  /** `guarda`: el 400 es una GUARDA de MaKo, no una falla (`Preparado`, la marca explícita). */
  | { ok: false; error: string; faltan?: string[]; disponibles?: unknown; status: 400 | 404 | 500; yaEstaba?: boolean; motivo?: string; noCorrio?: true; falta?: Falta; guarda?: true };
