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
export const AREAS = [
  'general', 'plan', 'crm', 'ads', 'whatsapp', 'email', 'chatbot',
  'metricas', 'experimentos', 'landing', 'closing', 'negocio', 'contenido', 'video',
  'integraciones', 'equipo', 'cs', 'mako',
] as const;
export type Area = (typeof AREAS)[number];

/** Cómo se llama y dónde vive cada área, para el catálogo y la referencia. */
export const AREA_INFO: Record<Area, { titulo: string; tab: string; ruta: string }> = {
  general: { titulo: 'General', tab: 'General', ruta: '/general' },
  plan: { titulo: 'Plan', tab: 'Plan', ruta: '/plan' },
  crm: { titulo: 'CRM', tab: 'CRM', ruta: '/crm' },
  ads: { titulo: 'Ads (Manager y Analyst)', tab: 'Ads Manager', ruta: '/ads-manager' },
  whatsapp: { titulo: 'WhatsApp', tab: 'WhatsApp', ruta: '/whatsapp' },
  email: { titulo: 'Email', tab: 'Email', ruta: '/email' },
  chatbot: { titulo: 'Chatbot y secuencias', tab: 'Chatbot', ruta: '/chatbot' },
  metricas: { titulo: 'Dashboard y análisis', tab: 'Dashboard', ruta: '/marketing' },
  experimentos: { titulo: 'Experiments y Retro', tab: 'Experiments', ruta: '/experimentos' },
  landing: { titulo: 'Landing (Analyst, Generator y tracking)', tab: 'Landing Analyst', ruta: '/landing-analyst' },
  closing: { titulo: 'Closing Analyst', tab: 'Closing Analyst', ruta: '/closing' },
  negocio: { titulo: 'El negocio (onboarding, Second Brain, conocimiento)', tab: 'Onboarding', ruta: '/onboarding' },
  contenido: { titulo: 'Content Machine', tab: 'Ads Writer', ruta: '/ads-writer' },
  video: { titulo: 'Video Generator', tab: 'Video Generator', ruta: '/video-generator' },
  integraciones: { titulo: 'Integraciones', tab: 'Integraciones', ruta: '/integraciones' },
  equipo: { titulo: 'Cuenta, equipo y notificaciones', tab: 'Configuraciones', ruta: '/configuraciones' },
  cs: { titulo: 'Customer Success', tab: 'Customer Success', ruta: '/customer-success' },
  mako: { titulo: 'MaKo (pendientes, propuestas, chats)', tab: 'Pregúntale a MaKo', ruta: '/mako' },
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
  /** true si lo que DEVUELVE al modelo sale de la API de Google (eventos, horarios,
   *  invitados de Google Calendar), aunque sea de rebote. No es una etiqueta: un turno
   *  que ofrece una herramienta así corre SÓLO en proveedores que no entrenan con lo
   *  que reciben (`lib/datos-google-ia.ts`). Es el Uso Limitado de Google, y la
   *  promesa que hace /privacidad. Un runner que llama a `lib/google-calendar` sin
   *  declararlo no pasa `tests/datos-google-ia.test.ts`. */
  datosDeGoogle?: true;
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

/** Dónde se revisa una propuesta. Cerrado: cada pantalla existe en app/. */
export type RutaPantalla = '/crm/revisar' | '/plan/revisar' | '/mako/revisar' | '/whatsapp';

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
  /** para las lecturas con `formatos`: el pedido por `?formato=` */
  formato?: Formato;
};

// ── Lo que devuelven los runners ─────────────────────────────────────────────

/** Igual que el `ToolRunner` de lib/anthropic.ts: texto, o «esto salió mal por
 *  adentro de un resultado válido». Para `formatos`, además el tipo y cabeceras. */
export type SalidaLectura =
  | string
  | { content: string; isError?: boolean; formato?: Formato; headers?: Record<string, string> };

/** Lo que una acción `chat` deja listo ANTES del «sí»: el payload saneado (lo que
 *  se va a ejecutar, con ids resueltos) y el resumen que lee la persona. `faltan`
 *  nombra lo que hay que pedir antes de proponer (monto, motivo). */
export type Preparado =
  | { payload: Record<string, unknown>; resumen: string }
  | { error: string; faltan?: string[]; disponibles?: unknown };

/** Lo que devuelve la escritura REAL. NUNCA lanza: si algo falla, `ok: false` con
 *  el motivo — así la pendiente se resuelve y un «sí» repetido no la re-ejecuta. */
export type Ejecutado = { ok: boolean; resumen: string; datos?: Record<string, unknown> };

export type Propuesto = { id: string; url: string; nueva: boolean; extra?: Record<string, unknown> } | { error: string };

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
  | { ok: false; error: string; faltan?: string[]; disponibles?: unknown; status: 400 | 404 | 500 };
