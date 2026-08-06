// =============================================================================
// metodo-catalogo — qué integraciones existen, sus campos y cómo sacar cada token
// =============================================================================
// Fuente de verdad del flujo /metodo (y del resumen en /admin): por servicio,
// qué env vars lo componen, cuáles son secretas/opcionales y el tutorial paso a
// paso para que un usuario nuevo consiga cada token SIN ayuda. Este módulo lo
// usa también la UI (client) — acá no hay valores, solo definiciones. Los
// valores viven cifrados en la tabla credenciales (lib/credenciales.ts).
//
// El campo `env` es a la vez la clave de la tabla credenciales y la env var
// que hidratamos a process.env: tiene que coincidir EXACTO con lo que leen las
// libs (lib/integraciones.ts, lib/meta-ads.ts, etc.).

// Seguro de importar acá aunque el módulo llegue al bundle del cliente:
// lib/app-url no tiene `server-only` y, sin APP_BASE_URL (que es server-side),
// cae a NEXT_PUBLIC_APP_URL, que Next inlinea en el build. Se usa para escribir
// la URL real en los pasos que la piden (ver ayudaDeCampo).
import { APP_BASE_URL } from './app-url';

export type CampoCredencial = {
  /** Nombre exacto de la env var (y clave en la tabla credenciales). */
  env: string;
  label: string;
  placeholder?: string;
  /** true → se muestra enmascarado y el input es tipo password. */
  secreto?: boolean;
  /** true → el servicio puede quedar "conectado" sin este campo. */
  opcional?: boolean;
  /** Nota corta debajo del campo (formato esperado, dónde se ve, etc.). */
  nota?: string;
  /** true → su valor define el HOST de un request de "Probar conexión". Al
   *  probar con un host provisto por el request, NO se rellenan secretos desde
   *  storage (evita exfiltrarlos a un host arbitrario). */
  host?: boolean;
  /** true → la APP lo completa sola a partir de otra credencial del servicio.
   *  La UI no lo pide como campo: lo muestra como resultado ("lo completó MaKo")
   *  y solo deja editarlo a mano detrás de "cargar a mano". Meta es el caso: de
   *  sus 6 credenciales, 5 salen del access token (ver lib/meta-descubrir.ts). */
  auto?: boolean;
};

export type ServicioMetodo = {
  key: string;
  nombre: string;
  categoria: string;
  /** Qué hace en el dashboard (para decidir si conectarlo). */
  paraQue: string;
  campos: CampoCredencial[];
  tutorial: {
    /** Pasos numerados, en el orden real de la UI del proveedor. */
    pasos: string[];
    /** Link directo a donde se crea el token. */
    url?: string;
    urlLabel?: string;
  };
  /** true → la UI solo muestra estado, sin inputs (no se carga desde la app).
   *  HOY NINGÚN SERVICIO LO USA: Supabase era el único y salió del catálogo (es
   *  infra de la plataforma, no una integración del cliente). Se mantiene el flag
   *  por si vuelve a hacer falta; los call-sites que lo leen quedan inertes. */
  soloServidor?: boolean;
  /** true → sin esto el dashboard pierde funciones núcleo. */
  core?: boolean;
};

export const SERVICIOS_METODO: ServicioMetodo[] = [
  {
    key: 'meta',
    nombre: 'Meta Ads',
    categoria: 'Publicidad',
    core: true,
    paraQue: 'Campañas, gasto, resultados y salud de la cuenta publicitaria. Sin esto no hay métricas de ads ni Ads Manager.',
    campos: [
      { env: 'META_ACCESS_TOKEN', label: 'Access token', secreto: true, placeholder: 'EAAG…', nota: 'Lo ÚNICO que tenés que pegar. Token de usuario de sistema (no expira) con los 8 permisos del tutorial: con eso MaKo completa el resto de los campos solo.' },
      { env: 'META_AD_ACCOUNT_ID', label: 'ID de cuenta publicitaria', auto: true, placeholder: 'act_1234567890', nota: 'Lo completa MaKo al pegar el token (te pregunta si tenés más de una cuenta).' },
      { env: 'META_PAGE_ACCESS_TOKEN', label: 'Token de la página', secreto: true, opcional: true, auto: true, placeholder: 'EAAG…', nota: 'Lo deriva MaKo del token principal. Sirve para traer los datos de los leads de tus formularios (Lead Ads).' },
      { env: 'META_PIXEL_ID', label: 'ID del píxel', opcional: true, auto: true, placeholder: '1234567890', nota: 'Lo completa MaKo al pegar el token (te pregunta si tenés más de un píxel). Se usa para la Conversions API y el creador de campañas.' },
      { env: 'META_CAPI_TOKEN', label: 'Token de Conversions API', secreto: true, opcional: true, auto: true, placeholder: 'EAAG…', nota: 'Avanzado: dejalo vacío. MaKo manda los eventos de CAPI con el token principal. Solo hace falta si el píxel vive en otro negocio que no podés asignar a tu usuario de sistema.' },
      { env: 'META_PAGE_ID', label: 'ID de tu página de Facebook', opcional: true, auto: true, placeholder: '1234567890', nota: 'Lo completa MaKo al pegar el token. Es lo que rutea los leads de tus formularios a tu cuenta.' },
    ],
    tutorial: {
      url: 'https://business.facebook.com/settings/system-users',
      urlLabel: 'Configuración del negocio → Usuarios del sistema',
      pasos: [
        'Necesitás una app en developers.facebook.com (tipo Negocio). Si ya tenés una, usá esa.',
        'Entrá a Meta Business Suite → Configuración del negocio → Usuarios → Usuarios del sistema.',
        'Creá un usuario de sistema (rol Administrador) o elegí uno existente.',
        'En "Agregar activos" asignale con control total TRES cosas: tu cuenta publicitaria, tu página de Facebook y tu píxel.',
        'Tocá "Generar token" y elegí tu app.',
        'Marcá los 8 permisos: ads_read, ads_management, business_management, pages_show_list, pages_read_engagement, pages_manage_ads, leads_retrieval y pages_manage_metadata.',
        'Poné expiración "Nunca".',
        'Copiá el token y pegalo acá (empieza con EAA…). Es lo ÚNICO que tenés que cargar: MaKo busca tu cuenta publicitaria, tu página y tu píxel, y los completa solo.',
        'Si tenés más de una cuenta, página o píxel, MaKo te muestra la lista para que elijas cuál.',
      ],
    },
  },
  {
    key: 'whatsapp',
    nombre: 'WhatsApp (Chatwoot)',
    categoria: 'Mensajería',
    core: true,
    paraQue: 'Inbox de WhatsApp, plantillas y envíos de nutrición automática a leads.',
    campos: [
      { env: 'CHATWOOT_BASE_URL', label: 'URL base de Chatwoot', placeholder: 'https://app.chatwoot.com', nota: 'Sin barra final. Si es self-hosted, tu dominio.', host: true },
      { env: 'CHATWOOT_ACCOUNT_ID', label: 'ID de la cuenta', placeholder: '1' },
      { env: 'CHATWOOT_API_TOKEN', label: 'Access token', secreto: true },
      { env: 'CHATWOOT_WA_INBOX_ID', label: 'ID del inbox de WhatsApp', opcional: true, placeholder: '2', nota: 'Necesario para plantillas y nutrición.' },
    ],
    tutorial: {
      url: 'https://app.chatwoot.com',
      urlLabel: 'Chatwoot',
      pasos: [
        'Entrá a tu Chatwoot y mirá la URL: es del estilo app.chatwoot.com/app/accounts/3/… — ese 3 es tu ID de cuenta.',
        'Tocá tu foto de perfil (abajo a la izquierda) → Configuración del perfil.',
        'Bajá hasta "Access Token" y copialo — ese es el CHATWOOT_API_TOKEN.',
        'Para el inbox: andá a Configuración → Bandejas de entrada, abrí la de WhatsApp y copiá el número que aparece en la URL (…/inboxes/2).',
      ],
    },
  },
  {
    key: 'email',
    nombre: 'Email (Resend)',
    categoria: 'Mensajería',
    paraQue: 'Envío de emails de nutrición, broadcasts y reportes.',
    campos: [
      { env: 'RESEND_API_KEY', label: 'API key', secreto: true, placeholder: 're_…' },
      { env: 'RESEND_FROM', label: 'Remitente', opcional: true, placeholder: 'Mauricio <hola@tudominio.com>', nota: 'El dominio tiene que estar verificado en Resend.' },
    ],
    tutorial: {
      url: 'https://resend.com/api-keys',
      urlLabel: 'Resend → API Keys',
      pasos: [
        'Creá una cuenta en resend.com (el plan gratis alcanza para arrancar).',
        'Primero verificá tu dominio: Domains → Add Domain.',
        'Cargá los registros DNS que te da (SPF y DKIM) en tu proveedor de dominio.',
        'Cuando el dominio figure "Verified", andá a API Keys → Create API Key, permiso "Sending access".',
        'Copiá la key (empieza con re_) — se muestra una sola vez.',
        'El remitente va con formato Nombre <correo@tudominio.com>, usando el dominio verificado.',
      ],
    },
  },
  {
    key: 'anthropic',
    nombre: 'MaKo IA (Anthropic)',
    categoria: 'Inteligencia',
    core: true,
    paraQue: 'El cerebro de MaKo: análisis, chats, sugerencias y todos los Analysts.',
    campos: [
      { env: 'ANTHROPIC_API_KEY', label: 'API key', secreto: true, placeholder: 'sk-ant-…' },
    ],
    tutorial: {
      url: 'https://console.anthropic.com/settings/keys',
      urlLabel: 'Anthropic Console → API Keys',
      pasos: [
        'Entrá a console.anthropic.com y creá una cuenta (o logueate).',
        'Cargá saldo en Settings → Billing (la API es prepaga).',
        'Andá a Settings → API Keys → Create Key, poné un nombre (ej. "dashboard") y creala.',
        'Copiá la key (empieza con sk-ant-) — se muestra una sola vez.',
      ],
    },
  },
  {
    key: 'openai',
    nombre: 'OpenAI',
    categoria: 'Inteligencia',
    paraQue: 'Transcripción de audios/videos (Whisper) y tareas simples de extracción.',
    campos: [
      { env: 'OPENAI_API_KEY', label: 'API key', secreto: true, placeholder: 'sk-…' },
    ],
    tutorial: {
      url: 'https://platform.openai.com/api-keys',
      urlLabel: 'OpenAI Platform → API keys',
      pasos: [
        'Entrá a platform.openai.com (es la plataforma de API, no ChatGPT).',
        'Cargá saldo en Settings → Billing.',
        'Andá a API keys → Create new secret key.',
        'Copiá la key (empieza con sk-) — se muestra una sola vez.',
      ],
    },
  },
  {
    key: 'groq',
    nombre: 'Groq',
    categoria: 'Inteligencia',
    paraQue: 'IA rápida y gratis para tareas simples (clasificar, extraer, titular) y transcripción de notas de voz (Whisper). MaKo la prefiere sobre OpenAI cuando hay key: se limita por tokens/día, no por saldo.',
    campos: [
      { env: 'GROQ_API_KEY', label: 'API key', secreto: true, placeholder: 'gsk_…' },
    ],
    tutorial: {
      url: 'https://console.groq.com/keys',
      urlLabel: 'Groq Console → API Keys',
      pasos: [
        'Entrá a console.groq.com y creá una cuenta (el plan gratis alcanza; el límite es por tokens/día, no por dinero).',
        'Andá a API Keys → Create API Key, poné un nombre (ej. "dashboard") y creala.',
        'Copiá la key (empieza con gsk_) — se muestra una sola vez.',
      ],
    },
  },
  {
    key: 'gemini',
    nombre: 'Google Gemini',
    categoria: 'Inteligencia',
    paraQue: 'IA de Google con 1M de contexto y function-calling. El plan gratis no cobra, pero Google usa tus datos para mejorar sus productos (con revisión humana). Para datos de clientes usá una key PAGA (activá facturación en el proyecto): esa NO entrena.',
    campos: [
      { env: 'GEMINI_API_KEY', label: 'API key', secreto: true, placeholder: 'AIza…' },
    ],
    tutorial: {
      url: 'https://aistudio.google.com/apikey',
      urlLabel: 'Google AI Studio → API keys',
      pasos: [
        'Entrá a aistudio.google.com y logueate con tu cuenta de Google.',
        'Abrí "Get API key" (o entrá directo a aistudio.google.com/apikey).',
        'Tocá "Create API key" y elegí (o creá) un proyecto de Google Cloud.',
        'Copiá la key (empieza con AIza).',
        'Por default queda en el plan GRATIS (1M de contexto, sin cargo) pero Google entrena con tus datos y puede revisarlos a mano. Para datos sensibles, activá facturación en el proyecto → pasa al plan pago, que NO entrena.',
      ],
    },
  },
  {
    key: 'cerebras',
    nombre: 'Cerebras',
    categoria: 'Inteligencia',
    paraQue: 'IA gratis y MUY rápida (corre Llama en su propio chip). Con function-calling. Ideal para rotar cuando Gemini se queda sin cuota, sin gastar.',
    campos: [
      { env: 'CEREBRAS_API_KEY', label: 'API key', secreto: true, placeholder: 'csk-…' },
    ],
    tutorial: {
      url: 'https://cloud.cerebras.ai',
      urlLabel: 'Cerebras Cloud → API Keys',
      pasos: [
        'Entrá a cloud.cerebras.ai y creá una cuenta gratis (con Google o email).',
        'En el menú, abrí "API Keys".',
        'Tocá "Create API Key", ponele un nombre y copiala.',
        'Es gratis con límite de uso (rate limit), no por dinero. Perfecta para la rotación.',
      ],
    },
  },
  {
    key: 'mistral',
    nombre: 'Mistral AI',
    categoria: 'Inteligencia',
    paraQue: 'IA europea con free tier (La Plateforme) y function-calling. Otra IA gratis para rotar sin caer en gasto.',
    campos: [
      { env: 'MISTRAL_API_KEY', label: 'API key', secreto: true, placeholder: '…' },
    ],
    tutorial: {
      url: 'https://console.mistral.ai/api-keys',
      urlLabel: 'Mistral Console → API Keys',
      pasos: [
        'Entrá a console.mistral.ai y creá una cuenta.',
        'Elegí el plan "Experiment" (GRATIS) cuando te lo pida — no requiere tarjeta para empezar.',
        'Abrí "API Keys" → "Create new key" y copiala.',
        'El free tier tiene rate limit, no cobra. Ideal para rotar.',
      ],
    },
  },
  {
    key: 'openrouter',
    nombre: 'OpenRouter',
    categoria: 'Inteligencia',
    paraQue: 'Agregador: UNA key para decenas de modelos, varios GRATIS (Llama y otros con sufijo ":free"). Sirve para rotar y probar modelos sin múltiples cuentas.',
    campos: [
      { env: 'OPENROUTER_API_KEY', label: 'API key', secreto: true, placeholder: 'sk-or-…' },
    ],
    tutorial: {
      url: 'https://openrouter.ai/keys',
      urlLabel: 'OpenRouter → Keys',
      pasos: [
        'Entrá a openrouter.ai y creá una cuenta (con Google o email).',
        'Abrí openrouter.ai/keys → "Create Key" y copiala (empieza con sk-or-).',
        'Los modelos con ":free" no cobran (tienen rate limit diario). Para más cuota podés cargar saldo, pero para rotar alcanza el free.',
      ],
    },
  },
  {
    key: 'elevenlabs',
    nombre: 'ElevenLabs',
    categoria: 'IA Generativa',
    paraQue: 'Voz por IA de alta calidad (text-to-speech y clonación de voz). MaKo la usa para generar locuciones y audio con tu propia cuenta.',
    campos: [
      { env: 'ELEVENLABS_API_KEY', label: 'API key', secreto: true, placeholder: 'sk_…' },
    ],
    tutorial: {
      url: 'https://elevenlabs.io/app/settings/api-keys',
      urlLabel: 'ElevenLabs → API Keys',
      pasos: [
        'Entrá a elevenlabs.io y creá una cuenta (tiene un plan gratis con caracteres/mes).',
        'Abrí tu perfil → "API Keys" (o elevenlabs.io/app/settings/api-keys).',
        'Tocá "Create API Key", ponele un nombre y copiala (empieza con sk_).',
        'Pegala acá. El plan gratis alcanza para probar; para volumen conviene un plan pago.',
      ],
    },
  },
  {
    key: 'fathom',
    nombre: 'Fathom',
    categoria: 'Reuniones',
    paraQue: 'Apenas termina una llamada de venta, MaKo la tiene: la analiza, actualiza el CRM y puede escribirle al cliente en caliente.',
    // Los TRES campos son obligatorios, y el webhook dejó de ser opcional a
    // propósito. Con solo la API key las reuniones igual entran, pero en la pasada
    // siguiente del cron: llegan tarde para lo único que de verdad importa acá, que
    // es hacer algo MIENTRAS la llamada está fresca (mandarle el resumen al lead,
    // disparar el seguimiento, avisarle al closer). Ofrecerlo como "opcional" hacía
    // que la mayoría lo saltee y después la función quedara a medias sin que se
    // entienda por qué.
    // FATHOM_HOST_EMAIL también es obligatorio: es lo que rutea la grabación a este
    // workspace. Sin él, el webhook llega y se descarta EN SILENCIO — el peor de los
    // mundos, porque el cliente lo configuró y cree que quedó andando.
    campos: [
      { env: 'FATHOM_API_KEY', label: 'API key', secreto: true, nota: 'Con esto traemos tus grabaciones y transcripciones.' },
      { env: 'FATHOM_HOST_EMAIL', label: 'Email de la cuenta que graba', placeholder: 'vos@tudominio.com', nota: 'El email con el que entrás a Fathom. Es lo que nos dice que esa grabación es TUYA: sin esto, tus reuniones llegan y se descartan.' },
      { env: 'FATHOM_WEBHOOK_SECRET', label: 'Secret del webhook', secreto: true, nota: 'Es lo que hace que la reunión llegue AL INSTANTE y no varias horas después. De eso depende poder mandarle el resumen al cliente mientras la charla está fresca.' },
    ],
    tutorial: {
      url: 'https://fathom.video/customize/integrations',
      urlLabel: 'Fathom → Integrations',
      pasos: [
        'Para qué sirve: cuando cortás una llamada de venta, MaKo la escucha, la resume, marca la asistencia y actualiza el CRM. Sin que toques nada.',
        'Entrá a fathom.video con la cuenta que graba las llamadas.',
        'Andá a Settings → API Access (requiere plan Team Edition o superior) y generá una API key.',
        'En la misma pantalla tocá "Add Webhook" y pegá esta URL: {{APP_URL}}/api/webhooks/fathom',
        'Activá include_transcript y copiá el secret que te muestra (empieza con whsec_).',
        'Pegá acá las tres cosas: la API key, el email de tu cuenta de Fathom y el secret del webhook.',
      ],
    },
  },
  {
    key: 'panda',
    nombre: 'Panda Video',
    categoria: 'Datos',
    paraQue: 'Métricas de reproducción del VSL (plays, retención).',
    campos: [
      { env: 'PANDA_API_KEY', label: 'API key', secreto: true, placeholder: 'panda-…' },
      { env: 'PANDA_VSL_VIDEO_IDS', label: 'IDs de videos del VSL', opcional: true, placeholder: 'id1,id2', nota: 'Separados por coma. El ID está en la URL de cada video.' },
    ],
    tutorial: {
      url: 'https://dashboard.pandavideo.com',
      urlLabel: 'Panda Video → Dashboard',
      pasos: [
        'Entrá a dashboard.pandavideo.com.',
        'Tocá tu perfil → API → Create API Key.',
        'Copiá la key (empieza con panda-).',
        'Los IDs de video están en la URL al abrir cada video en el dashboard.',
      ],
    },
  },
  {
    key: 'youtube',
    nombre: 'YouTube',
    categoria: 'Datos',
    paraQue: 'Views del VSL alojado en YouTube (si tu VSL vive ahí).',
    campos: [
      { env: 'YOUTUBE_API_KEY', label: 'API key', secreto: true, placeholder: 'AIza…' },
      { env: 'YOUTUBE_VSL_VIDEO_ID', label: 'ID del video del VSL', opcional: true, placeholder: 'dQw4w9WgXcQ', nota: 'Lo que va después de v= en la URL del video.' },
      { env: 'YOUTUBE_OAUTH_CLIENT_ID', label: 'OAuth Client ID', opcional: true, placeholder: '…apps.googleusercontent.com', nota: 'Para YouTube Analytics (retención/views diarias del canal propio).' },
      { env: 'YOUTUBE_OAUTH_CLIENT_SECRET', label: 'OAuth Client secret', secreto: true, opcional: true, placeholder: 'GOCSPX-…' },
      { env: 'YOUTUBE_OAUTH_REFRESH_TOKEN', label: 'OAuth Refresh token', secreto: true, opcional: true, nota: 'Se obtiene autorizando el canal una vez (OAuth Playground con scope yt-analytics.readonly).' },
    ],
    tutorial: {
      url: 'https://console.cloud.google.com/apis/credentials',
      urlLabel: 'Google Cloud Console → Credentials',
      pasos: [
        'Entrá a console.cloud.google.com y creá un proyecto (o usá uno existente).',
        'En "APIs y servicios" → Biblioteca, buscá "YouTube Data API v3" y habilitala.',
        'En Credenciales → Crear credenciales → Clave de API.',
        'Copiá la key (empieza con AIza).',
      ],
    },
  },
  {
    key: 'calendly',
    nombre: 'Calendly',
    categoria: 'Reuniones',
    paraQue: 'Lectura de agendas para respaldos y backfills (los webhooks se configuran aparte).',
    campos: [
      { env: 'CALENDLY_API_TOKEN', label: 'Personal access token', secreto: true },
      { env: 'CALENDLY_EVENT_TYPE_J1', label: 'Event type de R1', opcional: true, placeholder: 'https://api.calendly.com/event_types/…', nota: 'URI del event type de Calendly para R1 — rutea las reuniones entrantes a tu workspace y las clasifica.' },
      { env: 'CALENDLY_EVENT_TYPE_J2', label: 'Event type de R2', opcional: true, placeholder: 'https://api.calendly.com/event_types/…', nota: 'URI del event type de Calendly para R2 — rutea las reuniones entrantes a tu workspace y las clasifica.' },
      { env: 'CALENDLY_WEBHOOK_SIGNING_KEY', label: 'Signing key del webhook', secreto: true, opcional: true, nota: 'Signing key del webhook de Calendly.' },
    ],
    tutorial: {
      url: 'https://calendly.com/integrations/api_webhooks',
      urlLabel: 'Calendly → API & Webhooks',
      pasos: [
        'Entrá a calendly.com → Integrations → API & Webhooks.',
        'En "Personal access tokens" tocá "Generate new token".',
        'Copiá el token — se muestra una sola vez.',
        'Opcional: pegá las URIs de los event types de R1 y R2 (rutean y clasifican las reuniones entrantes).',
        'Opcional: pegá la signing key del webhook, si configurás el tuyo.',
      ],
    },
  },
  // Google NO va acá, por lo mismo que Supabase: GOOGLE_CLIENT_ID/SECRET son la
  // app OAuth de la AGENCIA (login + Google Calendar), infra compartida de la
  // plataforma. Un cliente jamás crea su propia app OAuth ni pisa estas
  // credenciales: conecta su agenda AUTORIZANDO (entra con Google, o el botón
  // "Conectar Google Calendar" de /integraciones). Sigue en lib/integraciones.ts
  // como "Google Calendar", medido por señal real (el refresh token del ws).
];

/** Reemplaza `{{APP_URL}}` por el dominio real. Ver el porqué en ayudaDeCampo(). */
const conUrlReal = (s: string): string => s.replaceAll('{{APP_URL}}', APP_BASE_URL);

export const servicioMetodo = (key: string): ServicioMetodo | undefined => {
  const s = SERVICIOS_METODO.find((x) => x.key === key);
  if (!s) return undefined;
  // Los pasos del tutorial también pueden escribir {{APP_URL}} (el de Fathom pide
  // pegar NUESTRA URL en el panel de ellos). Se resuelve acá, en el único accessor,
  // para que ninguna vista tenga que acordarse de hacerlo.
  if (!s.tutorial?.pasos?.some((p) => p.includes('{{APP_URL}}'))) return s;
  return { ...s, tutorial: { ...s.tutorial, pasos: s.tutorial.pasos.map(conUrlReal) } };
};

/** Servicio (key) al que pertenece una env del catálogo. */
export const servicioDeEnv = (env: string): string | undefined =>
  SERVICIOS_METODO.find((s) => s.campos.some((c) => c.env === env))?.key;

/** Todas las envs administrables desde /metodo (whitelist del API). */
export const ENVS_METODO = new Set(
  SERVICIOS_METODO.filter((s) => !s.soloServidor).flatMap((s) => s.campos.map((c) => c.env)),
);

// =============================================================================
// AYUDA_CAMPO — "¿cómo consigo ESTA key?", una por credencial
// =============================================================================
// El botón "?" de /integraciones despliega estos pasos debajo de su propia fila.
// Existe porque el `tutorial` de arriba es UNO por servicio y no alcanza: un
// servicio pide varias credenciales y casi nunca se sacan del mismo lado (youtube
// pide 5 campos y su tutorial tiene 4 pasos que ni mencionan el OAuth).
//
// Va como mapa aparte y no como campo de CampoCredencial para no volver ilegibles
// las líneas del catálogo, que ya son largas. Si un env no está acá, la UI cae al
// `tutorial` del servicio.
//
// OJO al editar: estos pasos nombran pantallas REALES de cada proveedor. Si no
// verificaste un paso contra la doc oficial, no lo escribas: un tutorial inventado
// hace perder más tiempo que no tener tutorial.
const AYUDA_CAMPO: Record<string, { pasos: string[]; url?: string; urlLabel?: string }> = {
  // Este token es LA credencial de Meta: con los permisos y los activos completos,
  // MaKo descubre solo la cuenta publicitaria, la página (y su token) y el píxel.
  // Por eso el tutorial pide de una los 8 permisos y los 3 activos: si el cliente
  // asigna solo la cuenta publicitaria (como pedía la versión vieja), /me/accounts
  // vuelve vacío y hay que mandarlo de nuevo a Business Manager.
  META_ACCESS_TOKEN: {
    pasos: [
      'Necesitás una app en developers.facebook.com (tipo Negocio). Si ya tenés una, seguí con la que está.',
      'Entrá a Meta Business Suite → Configuración del negocio → Usuarios → Usuarios del sistema.',
      'Creá un usuario de sistema con rol Administrador, o elegí uno que ya tengas.',
      'En "Agregar activos" asignale TRES cosas con control total: tu cuenta publicitaria, tu página de Facebook y tu píxel.',
      'Tocá "Generar token", elegí tu app y marcá los 8 permisos: ads_read, ads_management, business_management, pages_show_list, pages_read_engagement, pages_manage_ads, leads_retrieval y pages_manage_metadata.',
      'Poné expiración "Nunca", copiá el token (empieza con EAA…) y pegalo acá: con esto solo, MaKo completa el resto de los campos por vos.',
    ],
    url: 'https://business.facebook.com/settings/system-users',
    urlLabel: 'Configuración del negocio → Usuarios del sistema',
  },
  META_AD_ACCOUNT_ID: {
    pasos: [
      'Normalmente NO lo cargás a mano: al pegar el token de arriba, MaKo lista tus cuentas y la completa sola (si tenés varias, te pregunta cuál).',
      'Si querés ponerla igual: abrí el Administrador de anuncios con la cuenta que querés conectar.',
      'Arriba a la izquierda, mirá el número que acompaña al nombre de la cuenta.',
      'Pegalo acá con el prefijo act_ (ej. act_1234567890).',
    ],
    url: 'https://adsmanager.facebook.com/adsmanager',
    urlLabel: 'Administrador de anuncios',
  },
  META_PAGE_ACCESS_TOKEN: {
    pasos: [
      'Este NO lo cargás a mano: MaKo lo deriva del token de arriba (la misma llamada que antes te pedíamos hacer en el Explorador de la API Graph).',
      'Si viene vacío es porque tu usuario de sistema no tiene la página asignada, o al token le faltan los permisos de páginas.',
      'Arreglo: Configuración del negocio → Usuarios del sistema → "Agregar activos" → sumá tu página, y regenerá el token con leads_retrieval, pages_show_list, pages_read_engagement y pages_manage_ads.',
    ],
    url: 'https://business.facebook.com/settings/system-users',
    urlLabel: 'Configuración del negocio → Usuarios del sistema',
  },
  META_PIXEL_ID: {
    pasos: [
      'Normalmente lo completa MaKo: al pegar el token lista los píxeles de tu cuenta (si tenés varios, te pregunta cuál).',
      'Si querés ponerlo a mano: entrá al Administrador de eventos y elegí tu píxel en la lista de orígenes de datos.',
      'Copiá el número que figura junto al nombre del píxel — solo dígitos, sin comillas.',
    ],
    url: 'https://business.facebook.com/events_manager2',
    urlLabel: 'Administrador de eventos',
  },
  // CAPI: el botón "Generar token de acceso" de Events Manager arma por detrás un
  // token con ads_management sobre ese píxel — no es un tipo especial de token.
  // Por eso el token principal sirve, siempre que el píxel esté asignado al usuario
  // de sistema. Este campo queda solo para el caso raro de un píxel de otro negocio.
  META_CAPI_TOKEN: {
    pasos: [
      'Dejalo VACÍO salvo que sepas que lo necesitás: MaKo manda los eventos de CAPI con el token principal.',
      'Solo hace falta si el píxel vive en OTRO negocio y no lo podés asignar a tu usuario de sistema.',
      'En ese caso: Administrador de eventos → tu píxel → Configuración → Conversions API → "Generar token de acceso".',
    ],
    url: 'https://business.facebook.com/events_manager2',
    urlLabel: 'Administrador de eventos',
  },
  META_PAGE_ID: {
    pasos: [
      'Normalmente lo completa MaKo con el token de arriba: es el id de la página cuyos leads entran a tu workspace.',
      'Si tenés varias páginas, te pregunta cuál de ellas es la que usás para tus anuncios.',
      'Solo a mano si hace falta: abrí el Explorador de la API Graph, hacé un GET a /me/accounts y copiá el id (solo dígitos).',
    ],
    url: 'https://developers.facebook.com/tools/explorer',
    urlLabel: 'Explorador de la API Graph',
  },
  CHATWOOT_BASE_URL: {
    pasos: [
      'Entrá a tu Chatwoot y mirá la barra de direcciones del navegador.',
      'Copiá solo el dominio, hasta antes de /app (si usás la nube de Chatwoot es https://app.chatwoot.com; si es self-hosted, tu propio dominio).',
      'Pegalo acá sin barra final.',
    ],
    url: 'https://app.chatwoot.com',
    urlLabel: 'Chatwoot',
  },
  CHATWOOT_ACCOUNT_ID: {
    pasos: [
      'Entrá a tu Chatwoot con tu usuario.',
      'Mirá la URL: es del estilo app.chatwoot.com/app/accounts/3/…',
      'Copiá el número que va justo después de /accounts/ — ese es el ID de la cuenta.',
    ],
    url: 'https://app.chatwoot.com',
    urlLabel: 'Chatwoot',
  },
  CHATWOOT_API_TOKEN: {
    pasos: [
      'Logueate con un usuario administrador — el token solo se le muestra a los admins.',
      'Tocá tu foto de perfil, abajo a la izquierda.',
      'Entrá a Configuración del perfil.',
      'Bajá hasta el final de la página, hasta "Access Token".',
      'Copiá el token y pegalo acá.',
    ],
    url: 'https://www.chatwoot.com/hc/user-guide/articles/1757445004-how-to-find-your-personal-access-token-in-chatwoot',
    urlLabel: 'Chatwoot → Cómo encontrar tu token',
  },
  CHATWOOT_WA_INBOX_ID: {
    pasos: [
      'Solo hace falta si vas a usar plantillas o nutrición automática; si no, dejalo vacío.',
      'Andá a Configuración → Bandejas de entrada.',
      'Abrí la bandeja de WhatsApp.',
      'Copiá el número que aparece en la URL después de /inboxes/ (…/inboxes/2).',
    ],
    url: 'https://app.chatwoot.com',
    urlLabel: 'Chatwoot → Bandejas de entrada',
  },
  RESEND_API_KEY: {
    pasos: [
      'Creá tu cuenta en resend.com — el plan gratis alcanza para arrancar.',
      'Andá a API Keys → Create API Key.',
      'Ponele un nombre y elegí el permiso Full access: con Sending access falla el botón Probar conexión, que consulta tus dominios.',
      'Copiá la key apenas se genere: empieza con re_ y Resend no te la muestra de nuevo.',
    ],
    url: 'https://resend.com/api-keys',
    urlLabel: 'Resend → API Keys',
  },
  RESEND_FROM: {
    pasos: [
      'Cargalo si querés escribirle a tus leads: sin esto los emails salen desde onboarding@resend.dev, que solo entrega a tu propia casilla.',
      'Andá a Domains → Add Domain y cargá tu dominio.',
      'Copiá los registros SPF y DKIM que te da y pegalos en el DNS de tu proveedor de dominio.',
      'Esperá a que el dominio figure Verified; si sigue en pending, tocá Verify DNS Records.',
      'Escribí el remitente como Nombre <correo@tudominio.com>, con el dominio ya verificado.',
    ],
    url: 'https://resend.com/domains',
    urlLabel: 'Resend → Domains',
  },
  ANTHROPIC_API_KEY: {
    pasos: [
      'Entrá a console.anthropic.com y creá una cuenta (o logueate).',
      'Cargá saldo en Settings → Billing (la API es prepaga).',
      'Andá a Settings → API Keys → Create Key, poné un nombre (ej. "dashboard") y creala.',
      'Copiá la key (empieza con sk-ant-) — se muestra una sola vez.',
    ],
    url: 'https://console.anthropic.com/settings/keys',
    urlLabel: 'Anthropic Console → API Keys',
  },
  OPENAI_API_KEY: {
    pasos: [
      'Entrá a platform.openai.com y logueate (es la plataforma de API, no ChatGPT).',
      'Cargá saldo en Settings → Billing.',
      'Andá a API keys → Create new secret key.',
      'Copiá la key (empieza con sk-) — se muestra una sola vez.',
    ],
    url: 'https://platform.openai.com/api-keys',
    urlLabel: 'OpenAI Platform → API keys',
  },
  GROQ_API_KEY: {
    pasos: [
      'Entrá a console.groq.com y creá una cuenta (el plan gratis alcanza: el límite es por tokens/día, no por dinero).',
      'Andá a API Keys → Create API Key y poné un nombre (ej. "dashboard").',
      'Copiá la key que empieza con gsk_ — se muestra una sola vez.',
    ],
    url: 'https://console.groq.com/keys',
    urlLabel: 'Groq Console → API Keys',
  },
  GEMINI_API_KEY: {
    pasos: [
      'Entrá a aistudio.google.com y logueate con tu cuenta de Google.',
      'Abrí "Get API key" → "Create API key" y elegí o creá un proyecto de Google Cloud.',
      'Copiá la key (empieza con AIza) — se muestra una sola vez.',
      'Queda en el plan GRATIS (1M de contexto, sin cargo) pero Google usa tus datos para mejorar sus productos, con revisión humana. Para datos de clientes, activá facturación en el proyecto → plan pago, que no entrena.',
    ],
    url: 'https://aistudio.google.com/apikey',
    urlLabel: 'Google AI Studio → API keys',
  },
  FATHOM_API_KEY: {
    pasos: [
      'Entrá a fathom.video con la cuenta que graba las llamadas (requiere plan Team Edition o superior).',
      'Andá a User Settings → API Access.',
      'Tocá Generate API Key y copiala.',
      'Generala con la cuenta que graba: la key queda scopeada a ese usuario y solo ve sus grabaciones o las compartidas con su Team.',
    ],
    url: 'https://fathom.video/customize#api-access-header',
    urlLabel: 'Fathom → API Access',
  },
  FATHOM_HOST_EMAIL: {
    pasos: [
      'Es lo que nos dice que una grabación es TUYA. Sin esto tus reuniones llegan y se descartan, sin ningún error a la vista.',
      'Usá el email de la cuenta de Fathom que graba las llamadas — el mismo con el que entrás a fathom.video.',
      'Si graban varias personas, cargá el de la cuenta dueña de la grabación (la que Fathom reporta como recorded_by).',
      'Pegalo tal cual, sin espacios — se compara en minúscula contra el recorded_by de cada webhook.',
    ],
  },
  FATHOM_WEBHOOK_SECRET: {
    pasos: [
      // El PRIMER paso es el beneficio, no la instrucción. Este campo es el que más
      // se saltea si no se explica: pide salir de MaKo, entrar a otra herramienta y
      // volver. Cuesta poco decir para qué sirve, y sin eso el usuario lo lee como
      // burocracia nuestra.
      'Qué te da: sin esto tus reuniones llegan horas después; con esto llegan apenas cortás. Esa diferencia es la que permite mandarle el resumen al cliente mientras la charla está fresca, y no al día siguiente.',
      'En fathom.video: User Settings → API Access → Manage → "Add Webhook".',
      // La URL REAL, no un placeholder: que el cliente tenga que deducir su propio
      // dominio era la fricción principal de este paso.
      'Pegá esta URL como destino: {{APP_URL}}/api/webhooks/fathom',
      'Marcá "External Recordings" además de "My Recordings": si no, las llamadas que grabe otra persona de tu equipo no llegan.',
      'Activá include_transcript — lo usamos para confirmar que el invitado habló y para analizar la llamada.',
      'Copiá el secret que Fathom te muestra al crear el webhook (empieza con whsec_) y pegalo acá.',
    ],
    url: 'https://fathom.video/customize#api-access-header',
    urlLabel: 'Fathom → API Access',
  },
  PANDA_API_KEY: {
    pasos: [
      'Entrá a dashboard.pandavideo.com con tu cuenta.',
      'En el menú lateral andá a Settings → Advanced.',
      'Tocá "Generate new API key".',
      'Copiá la key que aparece (empieza con panda-) y pegala acá.',
      'Guardala aparte: si después generás una nueva, la anterior deja de funcionar.',
    ],
    url: 'https://dashboard.pandavideo.com',
    urlLabel: 'Panda Video → Settings → Advanced',
  },
  PANDA_VSL_VIDEO_IDS: {
    pasos: [
      'Completalo solo si querés las métricas de reproducción del VSL: sin IDs, el cron diario de Panda no trae nada.',
      'En el dashboard andá a Videos y abrí el video de tu VSL.',
      'Tocá el botón Embed (arriba a la derecha) y en Platform elegí Custom.',
      'Copiá el UUID que va después de ?v= en el código del player — ese es el ID que necesitamos, no el ID interno.',
      'Si tenés varias variantes del VSL, repetí con cada una y pegá todos los IDs separados por coma.',
    ],
    url: 'https://dashboard.pandavideo.com',
    urlLabel: 'Panda Video → Videos → Embed',
  },
  YOUTUBE_API_KEY: {
    pasos: [
      'Entrá a console.cloud.google.com y creá un proyecto (o usá uno existente).',
      'En "APIs y servicios" → Biblioteca, buscá "YouTube Data API v3" y habilitala.',
      'Andá a Credenciales → Crear credenciales → Clave de API.',
      'Copiá la key (empieza con AIza).',
    ],
    url: 'https://console.cloud.google.com/apis/credentials',
    urlLabel: 'Google Cloud Console → Credenciales',
  },
  YOUTUBE_VSL_VIDEO_ID: {
    pasos: [
      'Cargalo solo si tu VSL vive en YouTube: sin esto la key funciona igual, pero no trackeamos las views del VSL.',
      'Abrí el video del VSL en youtube.com.',
      'De la URL, copiá lo que va después de v= (cortá en el & si hay más parámetros).',
    ],
  },
  YOUTUBE_OAUTH_CLIENT_ID: {
    pasos: [
      'Cargalo solo si querés YouTube Analytics del canal propio (retención y views diarias): para las views acumuladas alcanza con la API key.',
      'En el mismo proyecto, "APIs y servicios" → Biblioteca, habilitá "YouTube Analytics API".',
      'Andá a console.cloud.google.com/auth/clients → Crear cliente → tipo "Aplicación web".',
      'En "URIs de redireccionamiento autorizados" agregá https://developers.google.com/oauthplayground y creá el cliente.',
      'Copiá el Client ID (termina en .apps.googleusercontent.com).',
    ],
    url: 'https://console.cloud.google.com/auth/clients',
    urlLabel: 'Google Cloud → Clientes OAuth',
  },
  YOUTUBE_OAUTH_CLIENT_SECRET: {
    pasos: [
      'Va en el mismo par que el Client ID: si no vas a usar YouTube Analytics, saltealo.',
      'Apenas creás el cliente OAuth del campo anterior, Google te muestra el secret en pantalla.',
      'Copiálo ahí mismo (empieza con GOCSPX-).',
      'Si ya cerraste esa pantalla, creá un cliente OAuth nuevo: Google no te deja volver a verlo.',
    ],
    url: 'https://console.cloud.google.com/auth/clients',
    urlLabel: 'Google Cloud → Clientes OAuth',
  },
  YOUTUBE_OAUTH_REFRESH_TOKEN: {
    pasos: [
      'Va junto con el Client ID y el secret: si no vas a usar YouTube Analytics, saltealo.',
      'Entrá al OAuth Playground → engranaje (arriba a la derecha) → tildá "Use your own OAuth credentials" y pegá tu Client ID y tu secret.',
      'Chequeá que "Access type" quede en "Offline": si no, Google no devuelve refresh token.',
      'En "Step 1" pegá el scope https://www.googleapis.com/auth/yt-analytics.readonly, dale "Authorize APIs" y autorizá con la cuenta dueña del canal.',
      'En "Step 2" tocá "Exchange authorization code for tokens" y copiá el "Refresh token".',
    ],
    url: 'https://developers.google.com/oauthplayground',
    urlLabel: 'OAuth 2.0 Playground',
  },
  CALENDLY_API_TOKEN: {
    pasos: [
      'Entrá a calendly.com → Integrations → API & Webhooks.',
      'En "Personal access tokens" tocá "Generate new token".',
      'Copiá el token — se muestra una sola vez.',
      'Pegalo acá y tocá "Probar conexión": MaKo te dice con qué cuenta quedó conectado.',
    ],
    url: 'https://calendly.com/integrations/api_webhooks',
    urlLabel: 'Calendly → API & Webhooks',
  },
  CALENDLY_EVENT_TYPE_J1: {
    pasos: [
      'Llenalo solo si tenés event types separados para R1 y R2 y querés que MaKo distinga cada reunión.',
      'Con el personal access token de arriba, llamá a https://api.calendly.com/users/me y copiá el "uri" de tu usuario.',
      'Llamá a https://api.calendly.com/event_types?user=<ese uri> con el mismo token.',
      'Buscá el event type de tu R1 y copiá su campo "uri" (https://api.calendly.com/event_types/…).',
      'Atajo: si no querés tocar la API, pegá el nombre del event type tal cual figura en Calendly — MaKo también matchea por nombre.',
    ],
    url: 'https://developer.calendly.com/api-docs/e17ac52b4b6f0-list-user-s-event-types',
    urlLabel: 'Calendly → List Event Types',
  },
  CALENDLY_EVENT_TYPE_J2: {
    pasos: [
      'Llenalo solo si tu R2 se agenda con un event type distinto al de R1.',
      'Con el personal access token de arriba, llamá a https://api.calendly.com/users/me y copiá el "uri" de tu usuario.',
      'Llamá a https://api.calendly.com/event_types?user=<ese uri> con el mismo token.',
      'Buscá el event type de tu R2 y copiá su campo "uri" (https://api.calendly.com/event_types/…).',
      'Atajo: si no querés tocar la API, pegá el nombre del event type tal cual figura en Calendly — MaKo también matchea por nombre.',
    ],
    url: 'https://developer.calendly.com/api-docs/e17ac52b4b6f0-list-user-s-event-types',
    urlLabel: 'Calendly → List Event Types',
  },
  CALENDLY_WEBHOOK_SIGNING_KEY: {
    pasos: [
      'Llenalo solo si el webhook de Calendly lo creás vos; si lo configuró tu agencia, pedile la signing key a quien lo creó.',
      'El webhook se crea por API, no hay pantalla: POST https://api.calendly.com/webhook_subscriptions con tu personal access token.',
      'Mandá en el body el campo "signing_key" con un secreto largo elegido por vos.',
      'Pegá acá ese mismo valor, idéntico: con él MaKo verifica la firma de cada webhook y rechaza los que no coinciden.',
    ],
    url: 'https://developer.calendly.com/api-docs/b3A6NTkxNDI1-create-webhook-subscription',
    urlLabel: 'Calendly → Create Webhook Subscription',
  },
};

/**
 * Pasos para conseguir ESA credencial. null → la UI cae al tutorial del servicio.
 *
 * Los pasos pueden escribir `{{APP_URL}}` y acá se reemplaza por el dominio REAL.
 * No es cosmético: cuando un paso pide pegar una URL NUESTRA en el panel de un
 * tercero (el webhook de Fathom), un `https://<tu-dominio>/…` obliga al cliente a
 * deducir cuál es su dominio, que es justo lo que no tiene por qué saber. Y al
 * salir del literal, una mudanza de dominio ya no deja el instructivo mintiendo.
 */
export function ayudaDeCampo(env: string): { pasos: string[]; url?: string; urlLabel?: string } | null {
  const a = AYUDA_CAMPO[env];
  if (!a) return null;
  return { ...a, pasos: a.pasos.map(conUrlReal) };
}
