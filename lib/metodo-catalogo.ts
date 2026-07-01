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
  /** true → se configura en el server (Vercel), la UI solo muestra estado. */
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
      { env: 'META_ACCESS_TOKEN', label: 'Access token', secreto: true, placeholder: 'EAAG…', nota: 'Token de usuario de sistema (no expira). Permisos: ads_read, ads_management, business_management.' },
      { env: 'META_AD_ACCOUNT_ID', label: 'ID de cuenta publicitaria', placeholder: 'act_1234567890', nota: 'Con el prefijo act_.' },
      { env: 'META_PIXEL_ID', label: 'ID del píxel', opcional: true, placeholder: '1234567890', nota: 'Solo si vas a usar la Conversions API y la creación de campañas.' },
    ],
    tutorial: {
      url: 'https://business.facebook.com/settings/system-users',
      urlLabel: 'Configuración del negocio → Usuarios del sistema',
      pasos: [
        'Entrá a Meta Business Suite → Configuración del negocio → Usuarios → Usuarios del sistema.',
        'Creá un usuario de sistema (rol Administrador) o elegí uno existente.',
        'En "Agregar activos", asignale tu cuenta publicitaria con control total.',
        'Tocá "Generar token": elegí tu app, marcá los permisos ads_read, ads_management y business_management, y poné expiración "Nunca".',
        'Copiá el token y pegalo acá (empieza con EAAG…).',
        'El ID de la cuenta publicitaria está en Administrador de anuncios, arriba a la izquierda: es el número que acompaña al nombre de la cuenta, con el prefijo act_.',
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
        'Primero verificá tu dominio: Domains → Add Domain, y cargá los registros DNS que te da (SPF y DKIM) en tu proveedor de dominio.',
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
    key: 'fathom',
    nombre: 'Fathom',
    categoria: 'Reuniones',
    paraQue: 'Grabaciones y transcripciones de llamadas de venta para el Closing Analyst.',
    campos: [
      { env: 'FATHOM_API_KEY', label: 'API key', secreto: true },
    ],
    tutorial: {
      url: 'https://fathom.video/customize/integrations',
      urlLabel: 'Fathom → Integrations',
      pasos: [
        'Entrá a fathom.video con tu cuenta (la que graba las llamadas).',
        'Andá a Settings → Integrations → API Access (requiere plan Team Edition o superior).',
        'Generá una API key y copiala.',
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
    key: 'telegram',
    nombre: 'Telegram',
    categoria: 'Mensajería',
    paraQue: 'Avisos internos: mensajes nuevos de leads y reportes diarios al celular.',
    campos: [
      { env: 'TELEGRAM_MB_BOT_TOKEN', label: 'Token del bot', secreto: true, placeholder: '123456:ABC-…' },
      { env: 'TELEGRAM_MB_CHAT_ID', label: 'ID del chat', placeholder: '-100123456 o 123456', nota: 'El chat (o grupo) donde el bot manda los avisos.' },
    ],
    tutorial: {
      url: 'https://t.me/BotFather',
      urlLabel: '@BotFather en Telegram',
      pasos: [
        'En Telegram, abrí @BotFather y mandá /newbot. Elegí nombre y usuario para tu bot.',
        'BotFather te devuelve el token (formato 123456:ABC-…). Copialo.',
        'Escribile cualquier mensaje a tu bot nuevo (o agregalo a un grupo si querés los avisos ahí).',
        'Abrí en el navegador: api.telegram.org/bot<TU_TOKEN>/getUpdates — el número en "chat":{"id":…} es tu ID de chat.',
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
    ],
    tutorial: {
      url: 'https://calendly.com/integrations/api_webhooks',
      urlLabel: 'Calendly → API & Webhooks',
      pasos: [
        'Entrá a calendly.com → Integrations → API & Webhooks.',
        'En "Personal access tokens" tocá "Generate new token".',
        'Copiá el token — se muestra una sola vez.',
      ],
    },
  },
  {
    key: 'google',
    nombre: 'Google (login)',
    categoria: 'Acceso',
    paraQue: 'El botón "Continuar con Google" del login. Avanzado: si está mal configurado, el login con contraseña sigue funcionando.',
    campos: [
      { env: 'GOOGLE_CLIENT_ID', label: 'Client ID', placeholder: '…apps.googleusercontent.com' },
      { env: 'GOOGLE_CLIENT_SECRET', label: 'Client secret', secreto: true, placeholder: 'GOCSPX-…' },
    ],
    tutorial: {
      url: 'https://console.cloud.google.com/apis/credentials',
      urlLabel: 'Google Cloud Console → Credentials',
      pasos: [
        'En console.cloud.google.com, andá a APIs y servicios → Credenciales.',
        'Crear credenciales → ID de cliente de OAuth → tipo "Aplicación web".',
        'En "URIs de redireccionamiento autorizados" agregá: https://TU-DOMINIO/api/auth/callback/google.',
        'Copiá el Client ID y el Client secret.',
        'Si el proyecto está en modo "Testing", agregá los emails de los usuarios en la pantalla de consentimiento de OAuth.',
      ],
    },
  },
  {
    key: 'supabase',
    nombre: 'Base de datos (Supabase)',
    categoria: 'Datos',
    core: true,
    soloServidor: true,
    paraQue: 'Almacena leads, métricas y toda la configuración. Se configura en el server (Vercel) porque el resto de las credenciales dependen de ella.',
    campos: [
      { env: 'NEXT_PUBLIC_SUPABASE_URL', label: 'URL del proyecto' },
      { env: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service role key', secreto: true },
    ],
    tutorial: {
      url: 'https://supabase.com/dashboard',
      urlLabel: 'Supabase Dashboard',
      pasos: [
        'Esta credencial la configura el administrador en Vercel (env vars del proyecto) — no se carga desde acá.',
        'En supabase.com → tu proyecto → Settings → API están la URL y la service_role key.',
      ],
    },
  },
];

export const servicioMetodo = (key: string): ServicioMetodo | undefined =>
  SERVICIOS_METODO.find((s) => s.key === key);

/** Todas las envs administrables desde /metodo (whitelist del API). */
export const ENVS_METODO = new Set(
  SERVICIOS_METODO.filter((s) => !s.soloServidor).flatMap((s) => s.campos.map((c) => c.env)),
);
