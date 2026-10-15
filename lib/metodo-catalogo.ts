// =============================================================================
// metodo-catalogo — qué integraciones existen, sus campos y cómo sacar cada token
// =============================================================================
// Fuente de verdad del flujo /metodo (y del resumen en /admin): por servicio,
// qué env vars lo componen, cuáles son secretas/opcionales y el tutorial paso a
// paso para que un usuario nuevo consiga cada token SIN ayuda. Acá no hay valores,
// solo definiciones: los valores viven cifrados en la tabla credenciales
// (lib/credenciales.ts).
//
// ⚠️⚠️ ES SERVER-ONLY, Y NO SIEMPRE LO FUE. Este módulo decía «lo usa también la
// UI (client)», y tres componentes `'use client'` lo importaban: eso metía las 145
// KB del catálogo ENTERO en el bundle de cualquier cliente — los tutoriales de las
// 20 integraciones, los nombres de todas las envs y el copy interno de la agencia,
// incluida la entrada de GitHub, que es una credencial de PLATAFORMA que ningún
// cliente tiene por qué ver. No era un secreto, pero era información interna
// viajando al navegador de un cliente, y el filtro `serviciosPara()` que existe
// para eso no servía de nada: filtrar al PINTAR no sirve si el dato ya viajó.
//
// De todo el catálogo, esos tres componentes usaban: dos campos por servicio, un
// tutorial y la lista completa. Ahora los tres lo reciben POR PROPS desde su server
// component, que además puede pasarlo YA FILTRADO.
//
// El `import 'server-only'` de abajo es lo que impide que vuelva: importar un VALOR
// de este módulo desde un `'use client'` ahora rompe el build. Los TIPOS se pueden
// seguir importando con `import type`, que se borra en compilación y no arrastra
// nada.
//
// El campo `env` es a la vez la clave de la tabla credenciales y la env var
// que hidratamos a process.env: tiene que coincidir EXACTO con lo que leen las
// libs (lib/integraciones.ts, lib/meta-ads.ts, etc.).

import 'server-only';
// Se usa para escribir la URL real en los pasos que la piden (ver ayudaDeCampo).
import { APP_BASE_URL } from './app-url';
import { claveBaseDe, claveCuentaDe, clavesDe, slotDe } from './ia-keys';

export type CampoCredencial = {
  /** Nombre exacto de la env var (y clave en la tabla credenciales). */
  env: string;
  label: string;
  placeholder?: string;
  /** true → se muestra enmascarado y el input es tipo password. */
  secreto?: boolean;
  /** true → el servicio puede quedar "conectado" sin este campo. */
  opcional?: boolean;
  /**
   * Para un campo `opcional` que igual HACE FALTA: qué no anda sin él, en una frase. Con esto la
   * pantalla lo pinta «falta» y no «opcional».
   *
   * Existe por el remitente de Resend (09/10/2026, punto 15 del audio de Customer Success). No
   * puede dejar de ser `opcional`: eso lo leen los tres lectores de «conectado»
   * (`integracionConectada`, `verificarServicio`, /api/metodo) y la tab /email se abre con la key
   * sola, que es como se verifica el dominio desde MaKo. Marcarlo obligatorio dejaba esa tab detrás
   * de la activación justo a quien tiene que entrar a verificar. Pero sin remitente los correos
   * salen de onboarding@resend.dev y sólo le llegan al dueño de la cuenta, así que «opcional» era
   * mentira: son dos preguntas («¿se puede abrir?» y «¿sale algo?») y cada una tiene su campo.
   */
  sinEsto?: string;
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
  /**
   * true → lo escribe SÓLO el servidor, derivado de otro campo, y NINGÚN «guardar» lo acepta
   * tipeado: ni el de /integraciones, ni el de /metodo, ni detrás de «Prefiero cargarlos a mano».
   * Va siempre junto con `auto` (que es lo que leen la pantalla y el guard de ruteo).
   *
   * Existe por la pasarela de pagos (11/10/2026): el id de la cuenta de Stripe y el de Mercado
   * Pago son identificadores de RUTEO, y no son secretos. Si se pudieran escribir a mano, el
   * primero que pegara el de otro negocio le bloquearía la conexión (`IdentificadorOcupadoError`)
   * o se quedaría con sus avisos de pago — el caso del company_id de Whop en
   * docs/hallazgos-customer-success.md («Un identificador de ruteo que se pregunta…»). La firma
   * del aviso de Stripe también: la crea Stripe al registrar el aviso, y una tipeada no coincide
   * con ninguna. Meta NO lo usa: su cuenta y su página se ELIGEN entre varias, y eso lo decide la
   * persona.
   */
  derivado?: boolean;
  /** Nº de CUENTA de una API key que admite varias (ver lib/ia-keys.ts). 1 = la de
   *  siempre; 2 y 3 son cuentas extra del mismo proveedor para rotar cuando la
   *  primera se queda sin cuota. La UI las muestra plegadas: si aparecieran los
   *  tres inputs de entrada, conectar Gemini pasaría de un campo a tres. */
  slot?: number;
};

/**
 * Un paso que NO es una credencial: algo que se copia DE MaKo y se pega EN la otra
 * herramienta. Va al revés que un campo, y por eso es un tipo aparte y no una nota.
 *
 * Meterlo como ayuda de un campo lo escondía: los campos se completan una vez y la
 * UI les tapa la ayuda al guardarlos, mientras que ESTO hay que poder volver a
 * verlo siempre — el valor cambia si cambia el dominio, y que la credencial esté
 * guardada no dice nada sobre si del otro lado quedó bien pegado.
 */
export type PasoExterno = {
  titulo: string;
  /** Qué habilita, en una línea. Va antes del cómo. */
  porque: string;
  /** Lo que hay que copiar. Admite {{APP_URL}}. */
  valor: string;
  /** Dónde pegarlo, con el camino exacto de la otra herramienta. */
  donde: string;
  /** Detalles que se olvidan y rompen el paso en silencio. */
  ojo?: string[];
};

export type ServicioMetodo = {
  key: string;
  nombre: string;
  categoria: string;
  /** Qué hace en el dashboard (para decidir si conectarlo). */
  paraQue: string;
  campos: CampoCredencial[];
  /** Lo que el usuario tiene que pegar del OTRO lado. Se muestra como un paso más. */
  pasoExterno?: PasoExterno;
  tutorial: {
    /**
     * Pasos numerados, en el orden real de la UI del proveedor. De 3 a 5, cada uno de UNA línea y de 120
     * caracteres o menos, sin «Para qué sirve» (ya lo dice `paraQue`, arriba del tutorial en /metodo y en las
     * slides de /integraciones). Lo que rompe la conexión va DENTRO del paso («se ve UNA vez», «Nunca»).
     * Medido el 12/10/2026 (la prueba con Fiesta Music, «los tutoriales para conectar APIs están muy largos»):
     * eran 648 pasos en 55 tutoriales, y el de Meta tenía 29. Lo fija tests/tutoriales-legibles.test.ts.
     */
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
  /**
   * true → es una credencial de LA PLATAFORMA, no del negocio del cliente. Solo la ve
   * el super-admin.
   *
   * Existe porque metí GitHub como si fuera una integración de cliente y le habría
   * aparecido a Mauricio y a Leila un campo para el token del repo de la agencia. Y hay
   * precedente exacto en lib/credenciales.ts: GOOGLE_CLIENT_ID/SECRET quedaron como
   * filas zombie «cuando Google figuraba como si fuera una credencial de cliente».
   */
  soloPlataforma?: boolean;
};

/**
 * Las cuentas EXTRA de un proveedor gratis, como campos opcionales.
 *
 * El free tier se agota por CUENTA, no por proveedor: con dos cuentas de Gemini
 * tenés el doble de cuota gratis. La cascada ya rotaba entre proveedores; esto le
 * da el otro eje. Son `opcional: true` a propósito — el servicio sigue estando
 * "conectado" con la primera sola, así que agregar estos campos no cambia ningún
 * semáforo ya pintado (ver `integracionConectada`, que solo mira los requeridos).
 */
const keysExtra = (prov: string, placeholder: string): CampoCredencial[] =>
  clavesDe(prov).slice(1).flatMap((env) => [
    {
      env,
      label: `API key ${slotDe(env)}`,
      secreto: true,
      opcional: true,
      slot: slotDe(env),
      placeholder,
      nota: 'De OTRA cuenta del mismo proveedor: cuando la anterior se queda sin cuota, MaKo sigue con esta sola.',
    },
    cuentaDe(env),
  ]);

/**
 * El campo «de qué cuenta es esta key». NO es un secreto: se muestra entero, al lado
 * de la key enmascarada, para poder distinguir diez cuentas de un vistazo.
 *
 * No se autocompleta porque NO SE PUEDE: ningún proveedor expone el dueño de una key
 * (ver SUFIJO_CUENTA en lib/ia-keys.ts). Lo escribe la persona una vez.
 */
const cuentaDe = (envKey: string): CampoCredencial => ({
  env: claveCuentaDe(envKey),
  label: `Email de la cuenta ${slotDe(envKey)}`,
  secreto: false,
  opcional: true,
  slot: slotDe(envKey),
  placeholder: 'mimail@gmail.com',
  nota: 'Para saber de un vistazo a qué cuenta pertenece esta key. No se comparte con nadie ni se usa para nada más.',
});

export const SERVICIOS_METODO: ServicioMetodo[] = [
  {
    key: 'meta',
    nombre: 'Meta Ads',
    categoria: 'Publicidad',
    core: true,
    paraQue: 'Campañas, gasto, resultados y salud de la cuenta publicitaria. Sin esto no hay métricas de ads ni Ads Manager.',
    campos: [
      { env: 'META_ACCESS_TOKEN', label: 'Access token', secreto: true, placeholder: 'EAAG…', nota: 'Lo único que pegas: el token de un "usuario del sistema", vencimiento "Nunca" y los 8 permisos. MaKo completa el resto.' },
      { env: 'META_AD_ACCOUNT_ID', label: 'ID de cuenta publicitaria', auto: true, placeholder: 'act_1234567890', nota: 'Lo completa MaKo al pegar el token; si tienes varias cuentas, eliges una. A mano, va con act_ adelante.' },
      { env: 'META_PAGE_ACCESS_TOKEN', label: 'Token de la página', secreto: true, opcional: true, auto: true, placeholder: 'EAAG…', nota: 'Lo saca MaKo del "Access token". Trae los contactos de tus formularios de Facebook e Instagram.' },
      { env: 'META_PIXEL_ID', label: 'ID del píxel', opcional: true, auto: true, placeholder: '1234567890', nota: 'Lo completa MaKo al pegar el token. Si tienes más de un píxel, te pregunta cuál.' },
      { env: 'META_CAPI_TOKEN', label: 'Token de Conversions API', secreto: true, opcional: true, auto: true, placeholder: 'EAAG…', nota: 'Déjalo vacío: MaKo ya usa el "Access token". Solo sirve si tu píxel vive en otro negocio de Meta.' },
      { env: 'META_PAGE_ID', label: 'ID de tu página de Facebook', opcional: true, auto: true, placeholder: '1234567890', nota: 'Lo completa MaKo al pegar el token. Hace que los contactos de tus formularios lleguen a tu cuenta.' },
      // ⚠️ OPCIONAL A PROPÓSITO, Y NO ES UN DETALLE DE COPY. `opcional` es lo que
      // leen los TRES lectores de «está conectado» (lib/credenciales.ts:227,
      // lib/metodo-verificar.ts:601, app/api/metodo/route.ts:28): marcarlo requerido
      // dejaría «no conectado» a Meta Ads en todos los workspaces que ya funcionan,
      // sin que nadie tocara una credencial — ya pasó. Y el criterio de fondo es que
      // sin este dato NO se pierde nada de lo que hay: el píxel sigue recibiendo las
      // conversiones (ver `destinoCAPI` en lib/meta-capi-payload.ts). Lo único que se
      // pierde es optimizar por CALIDAD de lead, y eso lo dice la nota.
      //
      // Tampoco es `auto`: el conjunto de datos de CRM no existe hasta que la persona
      // lo crea en el Administrador de eventos, y Meta no tiene endpoint para crearlo
      // (medido el 05/10/2026, ver docs/hallazgos-ads.md). Marcarlo `auto` prometería
      // un autocompletado que nunca va a llegar.
      { env: 'META_CRM_DATASET_ID', label: 'ID del conjunto de datos de CRM', opcional: true, placeholder: '1234567890', nota: 'Opcional: el único dato de Meta que MaKo no completa sola. Hace que Meta busque contactos que califiquen.' },
    ],
    tutorial: {
      url: 'https://business.facebook.com/settings',
      urlLabel: 'Configuración del negocio en Meta',
      pasos: [
        'En business.facebook.com/settings → "Cuentas" → "Apps" anota tu app (si no hay: "Agregar" → "Crear un ID de app nueva").',
        'En "Usuarios" → "Usuarios del sistema" crea uno de tipo "Administrador".',
        'En "Agregar activos" dale "Control total" a tu cuenta publicitaria, página y píxel, y "Administrar app" a la app.',
        'Toca "Generar nuevo token": tu app, vencimiento "Nunca" y los 8 permisos: ads_read, ads_management, business_management, pages_show_list, pages_read_engagement, pages_manage_ads, leads_retrieval, pages_manage_metadata.',
        'Copia el token (empieza con EAA, se ve UNA vez) y pégalo en "Access token". MaKo completa el resto.',
      ],
    },
  },
  // WhatsApp (Chatwoot), el WhatsApp OFICIAL, salió el 09/10/2026: ver tests/sin-chatwoot.test.ts.
  // El WhatsApp del producto es el número de empresa (Evolution), que se vincula por QR desde
  // /whatsapp y no pide ninguna credencial acá.
  // Instagram (Zernio) salió el 06/10/2026 con la tab Instagram y volvió el 09/10/2026 como CANAL de
  // las automatizaciones, con Messenger (tests/sin-instagram.test.ts cuenta la historia).
  {
    key: 'zernio',
    nombre: 'Instagram y Messenger (Zernio)',
    categoria: 'Mensajería',
    paraQue: 'Mensajes de Instagram y Messenger en tus automatizaciones: comentarios, historias, mensajes y anuncios.',
    campos: [
      // BYOK con respaldo de plataforma: `opcional` a propósito — sin key propia, lib/zernio.ts usa la
      // cuenta de Zernio de la agencia y el aislamiento lo da el PROFILE por workspace. El ruteo del
      // webhook NO sale de este campo (una key es secreta y jamás se espeja a `webhook_routing`): lo
      // acuña el server (`ensureProfile`, `cuentasConectadas`). Por eso no está en ROUTING_CREDS.
      { env: 'ZERNIO_API_KEY', label: 'API key de Zernio', secreto: true, opcional: true,
        sinEsto: 'Sin key propia, MaKo usa la cuenta de la plataforma.',
        nota: 'Opcional: con tu key, Zernio te factura a ti. Incluye 2 cuentas conectadas; desde la 3.ª cobra por cada una.' },
    ],
    tutorial: {
      url: 'https://zernio.com',
      urlLabel: 'Zernio',
      pasos: [
        'Entra a zernio.com con tu cuenta, o crea una.',
        'En "Settings" → "API Keys" toca "Create API Key" y copia la key: se ve UNA sola vez.',
        'Pégala en "API key de Zernio" y guarda.',
        'En una tarjeta de Instagram o Messenger toca "Conectar" (cuenta de empresa o de creador).',
      ],
    },
  },
  {
    key: 'email',
    nombre: 'Email (Resend)',
    categoria: 'Mensajería',
    paraQue: 'Envío de emails de nutrición, broadcasts y reportes.',
    campos: [
      { env: 'RESEND_API_KEY', label: 'API key', secreto: true, placeholder: 're_…', nota: 'Empieza con re_. En resend.com → "API Keys" → "Create API Key", con permiso "Full access". Se ve UNA sola vez.' },
      { env: 'RESEND_FROM', label: 'Remitente', opcional: true, sinEsto: 'Sin remitente, tus correos solo te llegan a ti.', placeholder: 'Tu negocio <hola@tudominio.com>', nota: 'Tu nombre y tu correo entre < >, de tu dominio verificado en Resend. Por ejemplo: Tu negocio <hola@tunegocio.com>.' },
    ],
    tutorial: {
      url: 'https://resend.com/domains',
      urlLabel: 'Resend → Domains',
      pasos: [
        'Entra a resend.com → "Domains" → "Add Domain" y escribe tu dominio (por ejemplo tunegocio.com).',
        'Copia sus 3 registros (1 MX con prioridad 10 y 2 TXT) en la sección DNS de donde compraste tu dominio.',
        'Ojo: el nombre va sobre send.tudominio.com. Después toca "Verify DNS Records" hasta que diga "Verified".',
        'En "API Keys" toca "Create API Key" con "Full access", copia la key (re_…, se ve UNA vez) y pégala en "API key".',
        'En "Remitente" escribe Tu negocio <hola@tunegocio.com>, con tu dominio. Vacío, el correo solo te llega a ti.',
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
      { env: 'ANTHROPIC_API_KEY', label: 'API key', secreto: true, placeholder: 'sk-ant-…', nota: 'Empieza con sk-ant-. Se guarda cifrada. Si la pierdes, bórrala en Claude Platform y crea otra.' },
    ],
    tutorial: {
      url: 'https://platform.claude.com/settings/keys',
      urlLabel: 'Claude Platform → API Keys',
      pasos: [
        'Entra a platform.claude.com. Es otra cuenta que claude.ai: Claude Pro no sirve aquí.',
        'En "Billing" toca "Add funds" y carga saldo (mínimo 5 dólares): sin saldo la key no responde.',
        'En "API Keys" toca "Create Key" y copia la key (sk-ant-…, se ve UNA vez).',
        'Pégala en "API key" y guarda.',
      ],
    },
  },
  {
    key: 'openai',
    nombre: 'OpenAI',
    categoria: 'Inteligencia',
    paraQue: 'Transcripción de audios/videos (Whisper) y tareas simples de extracción.',
    campos: [
      { env: 'OPENAI_API_KEY', label: 'API key', secreto: true, placeholder: 'sk-…', nota: 'Empieza con sk-. Es la de platform.openai.com, no la de ChatGPT. Sin saldo da error aunque esté bien escrita.' },
    ],
    tutorial: {
      url: 'https://platform.openai.com/api-keys',
      urlLabel: 'OpenAI Platform → API keys',
      pasos: [
        'Entra a platform.openai.com. No es chatgpt.com: ChatGPT Plus no sirve aquí.',
        'En "Settings" → "Billing" toca "Add credit" y carga saldo (mínimo 5 dólares): sin saldo la key no responde.',
        'En "API keys" toca "Create new secret key" y copia la key (sk-…, se ve UNA vez).',
        'Pégala en "API key" y guarda.',
      ],
    },
  },
  {
    key: 'groq',
    nombre: 'Groq',
    categoria: 'Inteligencia',
    paraQue: 'IA rápida y gratis para tareas simples (clasificar, extraer, titular) y transcripción de notas de voz (Whisper). MaKo la prefiere sobre OpenAI cuando hay key: se limita por tokens/día, no por saldo.',
    campos: [
      { env: 'GROQ_API_KEY', label: 'API key', secreto: true, placeholder: 'gsk_…', nota: 'Empieza con gsk_. Es gratis y no pide tarjeta: el límite es de uso por día, no de dinero.' },
      cuentaDe('GROQ_API_KEY'),
      ...keysExtra('groq', 'gsk_…'),
    ],
    tutorial: {
      url: 'https://console.groq.com/keys',
      urlLabel: 'Groq Console → API Keys',
      pasos: [
        'Entra a console.groq.com/keys con Google, GitHub o tu correo. Es gratis y no pide tarjeta.',
        'Toca "Create API Key", ponle de nombre MaKo y copia la key (gsk_…, se ve UNA vez).',
        'Pégala en "API key" y guarda.',
        '"API key 2" es opcional: la key de otra cuenta, para cuando la primera llega a su tope del día.',
      ],
    },
  },
  {
    key: 'gemini',
    nombre: 'Google Gemini',
    categoria: 'Inteligencia',
    paraQue: 'IA de Google con 1M de contexto y function-calling. El plan gratis no cobra, pero Google usa tus datos para mejorar sus productos (con revisión humana). Para datos de clientes usa una key PAGA (activa facturación en el proyecto): esa NO entrena.',
    campos: [
      { env: 'GEMINI_API_KEY', label: 'API key', secreto: true, placeholder: 'AIza…', nota: 'Empieza con AIza. En el plan gratis, Google usa tus textos y su gente puede leerlos; la key del plan pago no entrena.' },
      cuentaDe('GEMINI_API_KEY'),
      ...keysExtra('gemini', 'AIza…'),
    ],
    tutorial: {
      url: 'https://aistudio.google.com/apikey',
      urlLabel: 'Google AI Studio → API keys',
      pasos: [
        'Entra a aistudio.google.com/apikey con tu cuenta de Google.',
        'Ojo: en el plan gratis Google entrena con tus textos. Para evitarlo: "Billing Tier" → "Set up billing" (10 dólares).',
        'Toca "Create API key" con cualquier proyecto de Google Cloud y copia la key (empieza con AIza).',
        'Pégala en "API key" y guarda.',
        '"API key 2" es opcional: la key de otra cuenta de Google, para cuando la primera llega a su tope.',
      ],
    },
  },
  {
    key: 'cerebras',
    nombre: 'Cerebras',
    categoria: 'Inteligencia',
    paraQue: 'IA gratis y MUY rápida (corre Llama en su propio chip). Con function-calling. Ideal para rotar cuando Gemini se queda sin cuota, sin gastar.',
    campos: [
      { env: 'CEREBRAS_API_KEY', label: 'API key', secreto: true, placeholder: 'csk-…', nota: 'Empieza con csk-. Desde agosto de 2026 pide una tarjeta cargada: sin ella da error aunque esté bien escrita.' },
      cuentaDe('CEREBRAS_API_KEY'),
      ...keysExtra('cerebras', 'csk-…'),
    ],
    tutorial: {
      url: 'https://cloud.cerebras.ai',
      urlLabel: 'Cerebras Cloud → API Keys',
      pasos: [
        'Si no quieres cargar una tarjeta, omite Cerebras: con Groq tienes lo mismo, gratis.',
        'Entra a cloud.cerebras.ai y carga la tarjeta que te pide (o en "Billing"): sin ella la key no responde.',
        'En "API Keys" toca "Create API Key" y copia la key (csk-…, se ve UNA vez).',
        'Pégala en "API key" y guarda.',
        '"API key 2" es opcional: la key de otra cuenta, para cuando la primera llega a su tope.',
      ],
    },
  },
  {
    key: 'mistral',
    nombre: 'Mistral AI',
    categoria: 'Inteligencia',
    paraQue: 'IA europea con free tier (La Plateforme) y function-calling. Otra IA gratis para rotar sin caer en gasto.',
    campos: [
      { env: 'MISTRAL_API_KEY', label: 'API key', secreto: true, placeholder: '…', nota: 'Sin prefijo: cópiala entera. El plan gratis "Experiment" pide verificar tu teléfono por SMS.' },
      cuentaDe('MISTRAL_API_KEY'),
      ...keysExtra('mistral', '…'),
    ],
    tutorial: {
      url: 'https://console.mistral.ai/api-keys',
      urlLabel: 'Mistral Console → API Keys',
      pasos: [
        'Entra a console.mistral.ai y verifica tu teléfono con el código por SMS (no pide tarjeta).',
        'Elige el plan "Experiment", el gratis. Ojo: en él Mistral puede usar tus textos para mejorar sus modelos.',
        'En "API Keys" toca "Create new key" y copia la key entera (no tiene prefijo, se ve UNA vez).',
        'Pégala en "API key" y guarda.',
        '"API key 2" es opcional: la key de otra cuenta, para cuando la primera llega a su tope.',
      ],
    },
  },
  {
    key: 'openrouter',
    nombre: 'OpenRouter',
    categoria: 'Inteligencia',
    paraQue: 'Agregador: UNA key para decenas de modelos, varios GRATIS (Llama y otros con sufijo ":free"). Sirve para rotar y probar modelos sin múltiples cuentas.',
    campos: [
      { env: 'OPENROUTER_API_KEY', label: 'API key', secreto: true, placeholder: 'sk-or-…', nota: 'Empieza con sk-or-. Una sola key te da acceso a decenas de modelos, incluidos los gratis (los que terminan en ":free").' },
      cuentaDe('OPENROUTER_API_KEY'),
      ...keysExtra('openrouter', 'sk-or-…'),
    ],
    tutorial: {
      url: 'https://openrouter.ai/keys',
      urlLabel: 'OpenRouter → Keys',
      pasos: [
        'Entra a openrouter.ai/keys con Google, GitHub o tu correo. Es gratis y no pide tarjeta.',
        'Toca "Create Key", ponle de nombre MaKo y deja vacío el tope de gasto ("Credit limit").',
        'Copia la key (sk-or-…, se ve UNA vez), pégala en "API key" y guarda.',
        'Los modelos ":free" no cobran: 50 usos por día, o 1.000 si cargas 10 dólares UNA sola vez.',
        '"API key 2" es opcional: la key de otra cuenta, para cuando la primera llega a su tope.',
      ],
    },
  },
  {
    key: 'github',
    nombre: 'GitHub',
    categoria: 'Desarrollo',
    soloPlataforma: true,
    // Es la ÚNICA integración del catálogo que no es del negocio del cliente sino del
    // producto: la carga la agencia, una vez, para su propio tablero. Está acá y no en
    // un env suelto para que se administre igual que el resto y se pueda rotar sin deploy.
    paraQue: 'MaKo lee los commits que entran a main y te propone cerrar las tareas de desarrollo que ya están hechas. Sin esto, el tablero acumula tareas terminadas para siempre — en la última revisión aparecieron 62 de golpe.',
    campos: [
      { env: 'GITHUB_TOKEN', label: 'Token de acceso', secreto: true, placeholder: 'github_pat_…', nota: 'Fine-grained, SOLO "Contents: Read-only" y SOLO sobre este repo: no puede escribir nada. Se ve UNA sola vez.' },
      { env: 'GITHUB_REPO', label: 'Repositorio', auto: true, nota: 'Lo completa MaKo al pegar el token: si el token ve uno solo lo pone, y si ve varios te los ofrece en una lista.' },
    ],
    tutorial: {
      url: 'https://github.com/settings/personal-access-tokens/new',
      urlLabel: 'GitHub → Fine-grained tokens',
      pasos: [
        'En github.com/settings/personal-access-tokens/new ponle un nombre y una expiración (anótala: no avisa al vencer).',
        'En "Resource owner" elige al dueño del repo, y en "Repository access", "Only select repositories" con SOLO este.',
        'En "Repository permissions" → "Contents" elige "Read-only". Nada más.',
        'Toca "Generate token", copia el token (se ve UNA vez) y pégalo en "Token de acceso". El repo lo saca MaKo.',
        'Si el repo es de una organización, el token queda en "Pending" hasta que un owner lo apruebe (la API da 404).',
      ],
    },
  },
  {
    key: 'elevenlabs',
    nombre: 'ElevenLabs',
    categoria: 'IA Generativa',
    // ⚠️ DE LA PLATAFORMA, y por eso el copy de acá abajo cambió entero. Decía
    // «usando tu propia cuenta de ElevenLabs» y «activa el acceso a Text to
    // Speech»: las dos cosas dejaron de ser verdad el día que se escribió
    // `lib/elevenlabs.ts`. Un tutorial que enseña a sacar una key que el producto
    // ya no usa manda a alguien a hacer un trámite para nada.
    paraQue: 'Clona TU voz y la pisa sobre la voz preset que genera Google Flow, así tus anuncios suenan a ti. Corre con tu propia cuenta de ElevenLabs.',
    campos: [
      { env: 'ELEVENLABS_API_KEY', label: 'API key', secreto: true, placeholder: 'sk_…', nota: 'Es TU cuenta: la voz se cobra por minuto. Necesita «Voices» con escritura y «Speech to Speech».' },
    ],
    tutorial: {
      url: 'https://elevenlabs.io/app/settings/api-keys',
      urlLabel: 'ElevenLabs → API Keys',
      pasos: [
        'Usa TU cuenta de ElevenLabs con un plan pago: el gratis es de uso NO COMERCIAL y no sirve para anuncios.',
        'Entra a elevenlabs.io/app/settings/api-keys y toca «Create API Key».',
        'Activa «Voices» con permiso de ESCRITURA y «Speech to Speech», y lectura de «User» y «Models».',
        'En «Expire After» deja «Never»: si vence, los anuncios salen con la voz de Google y nadie se entera.',
        'Copia la key (empieza con sk_, se ve UNA vez) y pégala en "API key".',
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
      { env: 'FATHOM_API_KEY', label: 'API key', secreto: true, nota: 'Con esta key MaKo trae tus grabaciones y el texto de lo que se habló en cada una.' },
      { env: 'FATHOM_HOST_EMAIL', label: 'Email de la cuenta que graba', placeholder: 'tu@tudominio.com', nota: 'El correo con el que entras a Fathom, sin espacios. Sin él, tus reuniones llegan y se descartan sin ningún error.' },
      { env: 'FATHOM_WEBHOOK_SECRET', label: 'Contraseña del webhook', secreto: true, nota: 'La genera Fathom al crear el aviso automático (whsec_…). Con ella la reunión llega al instante, no horas después.' },
    ],
    pasoExterno: {
      titulo: 'Pega esta dirección dentro de Fathom',
      porque: 'Es por donde Fathom avisa apenas cortas una llamada. Sin esto, la reunión llega horas tarde, ya en frío.',
      valor: '{{APP_URL}}/api/webhooks/fathom',
      donde: 'En fathom.video: "User Settings" → "API Access" → "Manage" → "Add Webhook", en el campo de la dirección de destino.',
      ojo: [
        'Marca "My Recordings" (y "Team Recordings" si tu plan es Team) y la casilla "transcript".',
        'Al guardar, copia la contraseña (whsec_…, se ve UNA vez) y pégala en "Contraseña del webhook".',
      ],
    },
    tutorial: {
      url: 'https://fathom.video/customize#api-access-header',
      urlLabel: 'Fathom → API Access',
      pasos: [
        'En fathom.video, con la cuenta que graba: tu foto → "Settings" → "API Access". Sin esa sección, tu plan no la incluye.',
        'Toca "Generate API Key", copia la key y pégala en "API key".',
        'En "Email de la cuenta que graba" escribe el correo con el que entras a Fathom.',
        'En "Manage" → "Add Webhook" pega la dirección del recuadro amarillo y marca "My Recordings" y "transcript".',
        'Guarda y copia la contraseña (whsec_…, se ve UNA vez) en "Contraseña del webhook".',
      ],
    },
  },
  {
    key: 'panda',
    nombre: 'Panda Video',
    categoria: 'Datos',
    paraQue: 'Métricas de reproducción del VSL (plays, retención).',
    campos: [
      { env: 'PANDA_API_KEY', label: 'API key', secreto: true, placeholder: 'panda-…', nota: 'En dashboard.pandavideo.com → "Settings" → "Advanced" → "Generate new API key". Da acceso completo: no la compartas.' },
      { env: 'PANDA_VSL_VIDEO_IDS', label: 'IDs de videos del VSL', opcional: true, placeholder: 'id1,id2', nota: 'El ID que va después de ?v= en el código de "Embed" ("Platform" en "Custom"), NO el de la barra. Varios, con coma.' },
    ],
    tutorial: {
      url: 'https://dashboard.pandavideo.com',
      urlLabel: 'Panda Video → Settings → Advanced',
      pasos: [
        'En dashboard.pandavideo.com → "Settings" → "Advanced" toca "Generate new API key".',
        'Copia la key, pégala en "API key" y guárdala también en otro lado: generar otra anula la anterior.',
        'En "Videos" abre tu video de ventas (tu VSL) → "Embed", con "Platform" en "Custom".',
        'Copia el ID que va después de ?v= en ese código y pégalo en "IDs de videos del VSL" (varios, con coma).',
        'Ojo: el número de la barra del navegador NO sirve; el que va es el del código de "Embed".',
      ],
    },
  },
  {
    key: 'youtube',
    nombre: 'YouTube',
    categoria: 'Datos',
    paraQue: 'Views del VSL alojado en YouTube (si tu VSL vive ahí).',
    campos: [
      { env: 'YOUTUBE_API_KEY', label: 'API key', secreto: true, placeholder: 'AIza…', nota: 'Empieza con AIza. Sale de console.cloud.google.com → "Credenciales" → "Clave de API", con "YouTube Data API v3".' },
      { env: 'YOUTUBE_VSL_VIDEO_ID', label: 'ID del video del VSL', opcional: true, placeholder: 'dQw4w9WgXcQ', nota: 'Lo que va después de v= en youtube.com/watch?v=ESTO, o de la barra en youtu.be/ESTO. Si hay un &, corta ahí.' },
      { env: 'YOUTUBE_OAUTH_CLIENT_ID', label: 'OAuth Client ID', opcional: true, placeholder: '…apps.googleusercontent.com', nota: 'Opcional: déjalo vacío. Solo hace falta para la retención y las vistas diarias de TU canal.' },
      { env: 'YOUTUBE_OAUTH_CLIENT_SECRET', label: 'OAuth Client secret', secreto: true, opcional: true, placeholder: 'GOCSPX-…', nota: 'Opcional. Va de a pares con el "OAuth Client ID". Empieza con GOCSPX- y se ve UNA sola vez.' },
      { env: 'YOUTUBE_OAUTH_REFRESH_TOKEN', label: 'OAuth Refresh token', secreto: true, opcional: true, nota: 'Opcional: el permiso para leer las estadísticas de tu canal, del OAuth Playground de Google. Si no, vacío.' },
    ],
    tutorial: {
      url: 'https://console.cloud.google.com/apis/credentials',
      urlLabel: 'Google Cloud Console → Credenciales',
      pasos: [
        'En console.cloud.google.com, con tu cuenta de YouTube, crea un proyecto nuevo (selector de proyecto, arriba).',
        'En "APIs y servicios" → "Biblioteca" busca "YouTube Data API v3" y toca "Habilitar" (es gratis).',
        'En "APIs y servicios" → "Credenciales" → "Crear credenciales" → "Clave de API", copia la key (AIza…).',
        'Pégala en "API key". En "ID del video del VSL" va lo que sigue a v= en la dirección de tu video.',
        'Los tres campos "OAuth" son opcionales: solo dan la retención de tu canal. Déjalos vacíos.',
      ],
    },
  },
  {
    key: 'calendly',
    nombre: 'Calendly',
    categoria: 'Reuniones',
    paraQue: 'Lectura de agendas para respaldos y backfills (los webhooks se configuran aparte).',
    campos: [
      { env: 'CALENDLY_API_TOKEN', label: 'Personal access token', secreto: true, nota: 'El token con el que MaKo lee tu agenda. Calendly lo muestra UNA sola vez: si lo pierdes, generas otro.' },
      // ⚠️ OBLIGATORIO, Y HASTA EL 04/10/2026 DECÍA «Opcional». No es un rótulo: es lo
      // ÚNICO que escribe la fila de `webhook_routing` (ROUTING_CREDS, lib/webhook-routing.ts),
      // y el webhook resuelve el workspace por ahí y es fail-CLOSED a propósito —sin mapeo no
      // toca un solo dato, para que la reserva de un cliente no caiga en el CRM del dueño—.
      // O sea que conectar Calendly «bien» (sólo el token) dejaba al cliente con CERO filas de
      // ruteo y todas sus reservas ignoradas con un 200 y un `console.warn`. Medido contra
      // producción el 04/10/2026: 1 de los 2 workspaces con Calendly conectado estaba así.
      // Es el MISMO caso de `FATHOM_HOST_EMAIL`, que dejó de ser opcional por esto mismo.
      { env: 'CALENDLY_EVENT_TYPE_J1', label: 'Tipo de evento de R1', placeholder: 'Llamada de auditoría', nota: 'Obligatorio: sin esto, las reuniones de tu gente no entran a tu CRM. El nombre de la reunión, tal cual en Calendly.' },
      { env: 'CALENDLY_EVENT_TYPE_J2', label: 'Tipo de evento de R2', opcional: true, placeholder: 'https://api.calendly.com/event_types/…', nota: 'Opcional. Igual que el de R1, para la segunda reunión, si se agenda con un link distinto.' },
      // ⚠️ ES OPCIONAL DE VERDAD —se puede conectar sin esto—, pero la nota tiene que
      // decir QUÉ SE PIERDE si queda vacía, no sólo que es opcional: sin el aviso
      // automático, una reserva NUEVA no crea el contacto. Con el token, MaKo completa
      // las fechas de un lead que ya existe (lib/auto-reuniones.ts) y reserva
      // (lib/calendly-agenda.ts); no hay ningún cron que ingiera la agenda.
      //
      // Y OJO CON EL OTRO MAL ENTENDIDO, que es el que hay que no volver a escribir:
      // la key que el cliente pega SÍ se lee. app/api/webhooks/calendly/route.ts hace
      // credWs('CALENDLY_WEBHOOK_SIGNING_KEY', ws) y sólo cae a la de plataforma si ese
      // workspace no tiene la suya — lib/tab-activacion.ts afirmaba lo contrario hasta
      // el 04/10/2026.
      { env: 'CALENDLY_WEBHOOK_SIGNING_KEY', label: 'Signing key del webhook', secreto: true, opcional: true, nota: 'Opcional: solo existe si alguien creó el aviso por programación. Sin ese aviso, una reserva nueva no crea el contacto.' },
    ],
    tutorial: {
      url: 'https://calendly.com/integrations/api_webhooks',
      urlLabel: 'Calendly → API and webhooks',
      pasos: [
        'Entra a calendly.com → "Automations" → "Integrations & apps" → "API and webhooks".',
        'En "Personal access tokens" toca "Generate new token" ("Get a token now" la primera vez) y "Create token".',
        'Toca "Copy token" (se ve UNA vez), pégalo en "Personal access token" y guarda.',
        'Es obligatorio: en "Tipo de evento de R1" escribe el nombre de tu primera reunión, tal cual figura en Calendly.',
        '"Tipo de evento de R2" y "Signing key del webhook" son opcionales: la signing key la tiene quien creó el aviso.',
      ],
    },
  },
  // ⚠️ CAL.COM ES OTRO PRODUCTO, NO UNA VARIANTE DE CALENDLY. calendly.com y
  // cal.com son dos empresas distintas, con API, firma y payload distintos. La
  // confusión ya costó una conversión real: el 24/08/2026 un cliente (ws13) se
  // agendó en su propia landing con una agenda de Cal.com embebida y MaKo no
  // registró nada, porque no había por dónde entrar. Van SEPARADAS a propósito:
  // fundirlas en una sola tarjeta «Agenda» obligaría a preguntar cuál usa, que es
  // justo la pregunta que la tarjeta ya contesta con su nombre.
  {
    key: 'calcom',
    nombre: 'Cal.com',
    categoria: 'Reuniones',
    paraQue: 'Cada reserva de tu calendario entra sola al CRM, con quién reservó y para cuándo — y si la cancelan, se marca sola.',
    // ⚠️ EL ORDEN NO ES COSMÉTICO: el primer campo es por donde la gente empieza, y
    // la validación exige los OBLIGATORIOS antes de dejar guardar nada. Con la API
    // key —que es opcional— arriba, el cliente pegaba eso primero y le rebotaba
    // «Falta completar: Secret del webhook» sobre el campo que acababa de llenar
    // bien. Primero va lo que hace funcionar la integración; lo opcional, después.
    campos: [
      { env: 'CALCOM_WEBHOOK_SECRET', label: 'Contraseña del webhook', secreto: true, nota: 'La inventas tú: un texto largo. Va igual aquí y en el "Secret" de Cal.com. Sin esto no entra ninguna reserva.' },
      { env: 'CALCOM_API_KEY', label: 'API key', secreto: true, opcional: true, placeholder: 'cal_live_…', nota: 'Opcional: para leer tu agenda hacia atrás. Al crearla, activa "Never expires" o deja de funcionar sola, sin aviso.' },
      // ⚠️ OBLIGATORIO POR LA MISMA RAZÓN QUE EL DE CALENDLY (ver arriba): su webhook
      // resuelve el workspace contra `webhook_routing` y también es fail-closed. Acá nunca
      // llegó a morder porque todavía no hay ningún Cal.com conectado — que es justo cuando
      // conviene arreglarlo.
      { env: 'CALCOM_EVENT_TYPE_J1', label: 'Tipo de evento de R1', placeholder: 'llamada-de-auditoria', nota: 'Obligatorio: sin esto, las reuniones de tu gente no entran a tu CRM. Es lo último de tu link: cal.com/juan/ESTO.' },
      { env: 'CALCOM_EVENT_TYPE_J2', label: 'Tipo de evento de R2', opcional: true, placeholder: 'cierre', nota: 'Opcional. Igual que el de R1, para la segunda reunión. Nunca crea un contacto: completa el que ya existe.' },
    ],
    pasoExterno: {
      titulo: 'Pega esta dirección dentro de Cal.com',
      porque: 'Es por donde Cal.com avisa apenas alguien reserva. Sin esto, quien agendó se queda afuera de tu CRM.',
      valor: '{{APP_URL}}/api/webhooks/calcom',
      donde: 'En app.cal.com: "Settings" → "Developer" → "Webhooks" → botón "+ New", arriba a la derecha → campo "Subscriber Url".',
      ojo: [
        'El campo "Secret" lleva la misma contraseña de MaKo: vacío, MaKo rechaza cada reserva.',
        'Marca "Booking Created" y "Booking Cancelled", y deja "Enable Webhook" encendido: apagado, no manda nada.',
      ],
    },
    tutorial: {
      url: 'https://app.cal.com/settings/developer/webhooks',
      urlLabel: 'Cal.com → Settings → Developer → Webhooks',
      pasos: [
        'En "Contraseña del webhook" escribe una clave larga que inventes (por ejemplo inmobiliariaperez2026clave).',
        'En app.cal.com → "Settings" → "Developer" → "Webhooks" → "+ New", pega la dirección del recuadro amarillo.',
        'En "Secret" escribe la misma contraseña y marca "Booking Created" y "Booking Cancelled".',
        'Deja "Enable Webhook" encendido y guarda. Es obligatorio: en "Tipo de evento de R1", lo último de tu link de reservas.',
        'Opcional, para leer tu agenda hacia atrás: "API key", en "Settings" → "Developer" → "API Keys" con "Never expires".',
      ],
    },
  },
  // ⚠️ LA PASARELA DE PAGOS (11/10/2026, docs/diseno-pasarela-pagos.md): Stripe y Mercado Pago.
  // BYOK: cada negocio pega SU clave, y MaKo se vende con la del workspace de la plataforma, pegada
  // aquí como la de cualquiera. La persona pega UNA cosa; el resto lo DERIVA MaKo de esa clave
  // (lib/cobros-conexion.ts) y no se acepta tipeado (`derivado`).
  //
  // Cada campo va en UNA línea con todos sus flags: tests/webhook-ruteo-obligatorio.test.ts lee el
  // catálogo línea por línea, y un campo partido en dos se lee como «sin auto» o «no declarado».
  // El id de la cuenta es `auto` y NO opcional a propósito: así «conectado» exige que exista la fila
  // de ruteo, que es lo que hace que un pago vuelva al CRM.
  {
    key: 'stripe',
    nombre: 'Stripe',
    categoria: 'Pagos',
    paraQue: 'Cobrar con un link de pago: cuando te pagan, la cuota queda pagada en la ficha del lead sin cargar nada.',
    campos: [
      { env: 'STRIPE_SECRET_KEY', label: 'Clave de Stripe', secreto: true, placeholder: 'rk_live_…', nota: 'Lo único que pegas: una clave restringida (rk_live_…) con los permisos de la guía. La secreta (sk_live_) también sirve.' },
      { env: 'STRIPE_ACCOUNT_ID', label: 'ID de tu cuenta', auto: true, derivado: true, placeholder: 'acct_…', nota: 'Lo completa MaKo con tu clave; no se escribe a mano. Sin esto, tus pagos no entran a tu CRM.' },
      { env: 'STRIPE_WEBHOOK_SECRET', label: 'Firma del aviso de pagos', secreto: true, auto: true, derivado: true, placeholder: 'whsec_…', nota: 'La crea Stripe cuando MaKo registra el aviso de pagos; no se escribe a mano. Sin esto, tus pagos no entran a tu CRM.' },
    ],
    // Sin pasoExterno A PROPÓSITO: el aviso lo registra MaKo en la cuenta (asegurarWebhookStripe),
    // con la URL que nombra la cuenta (`?acct=`). Pedirle a la persona que lo cree a mano era pedirle
    // que copie un secreto que la API ya devuelve.
    tutorial: {
      url: 'https://dashboard.stripe.com/apikeys',
      urlLabel: 'Stripe → API keys',
      pasos: [
        'Entra a dashboard.stripe.com/apikeys con la cuenta donde quieres recibir el dinero.',
        'Toca "Create restricted key" y ponle de nombre MaKo.',
        'Permisos "Write": Checkout Sessions, Webhook Endpoints, Refunds y Subscriptions.',
        'Permisos "Read": Invoices, Charges, Payment Intents y Accounts. Lo demás, en "None".',
        'Toca "Create key", copia la clave (rk_live_…, se ve UNA vez) y pégala en "Clave de Stripe".',
      ],
    },
  },
  {
    key: 'mercadopago',
    nombre: 'Mercado Pago',
    categoria: 'Pagos',
    paraQue: 'Cobrar con un link de Mercado Pago en la moneda de tu país: cuando te pagan, la cuota queda pagada en la ficha del lead sin cargar nada.',
    campos: [
      { env: 'MERCADOPAGO_ACCESS_TOKEN', label: 'Access token', secreto: true, placeholder: 'APP_USR-…', nota: 'Lo único obligatorio: el access token de producción de tu aplicación (APP_USR-…). Con él MaKo encuentra tu cuenta.' },
      { env: 'MERCADOPAGO_USER_ID', label: 'ID de tu cuenta', auto: true, derivado: true, placeholder: '123456789', nota: 'Lo completa MaKo con tu access token; no se escribe a mano. Sin esto, tus pagos no entran a tu CRM.' },
      // ⚠️ OPCIONAL DE VERDAD para «conectado», con `sinEsto` (hallazgos-integraciones.md, el
      // remitente de Resend): lo que protege de un aviso falso NO es esta firma, es que el webhook
      // vuelve a leer cada pago con el token del negocio y exige que sea de su cuenta. Pero esta
      // clave sólo existe después de guardar la dirección en el panel de Mercado Pago, y ese paso
      // es el ÚNICO camino de los avisos de una suscripción (POST /preapproval no acepta
      // `notification_url`). Vacía, lo más probable es que el paso no se hizo.
      { env: 'MERCADOPAGO_WEBHOOK_SECRET', label: 'Clave secreta del aviso', secreto: true, opcional: true, sinEsto: 'Sin el aviso configurado en Mercado Pago, las renovaciones de una suscripción no entran a tu CRM.', nota: 'Aparece en Mercado Pago al guardar la dirección del recuadro amarillo. Con ella MaKo comprueba cada aviso.' },
    ],
    pasoExterno: {
      titulo: 'Pega esta dirección dentro de Mercado Pago',
      porque: 'Es por donde Mercado Pago avisa cada cobro de una suscripción. Sin esto, las renovaciones no entran a tu CRM.',
      valor: '{{APP_URL}}/api/webhooks/mercadopago',
      donde: 'En mercadopago.com/developers/panel/app: tu aplicación → "Webhooks" → "Configurar notificaciones" → URL de producción.',
      ojo: [
        'Marca "Pagos" y "Planes y suscripciones", en la misma aplicación del access token.',
        'Al guardar, copia la "clave secreta" y pégala en "Clave secreta del aviso". Con cuenta de prueba, es obligatorio.',
      ],
    },
    tutorial: {
      url: 'https://www.mercadopago.com/developers/panel/app',
      urlLabel: 'Mercado Pago → Tus integraciones',
      pasos: [
        'En mercadopago.com/developers/panel/app abre tu aplicación o créala (tipo "Checkout Pro").',
        'Entra a "Credenciales de producción"; la primera vez, actívalas con tu rubro y tu sitio web.',
        'Copia el "Access Token" (empieza con APP_USR-) y pégalo en "Access token". La "Public Key" no sirve.',
        'Para que entren las renovaciones de una suscripción, sigue el recuadro amarillo de abajo.',
        'Para probar sin dinero real, usa una cuenta de prueba de Mercado Pago.',
      ],
    },
  },
  // ⚠️ LAS FUENTES QUE AVISAN del Leads Scraper (14/10/2026, docs/diseno-leads-scraper.md): el propio
  // público del negocio entra solo al CRM (lib/fuentes-leads.ts). No hay una API que conectar: el
  // negocio pega UN secreto y la dirección del recuadro amarillo del otro lado. Ese secreto es el
  // ÚNICO campo y es obligatorio: es lo que rutea el aviso —su hash va a webhook_routing,
  // lib/ruteo-hash.ts— y lo que lo prueba. Sin él no entra nadie (tests/webhook-ruteo-obligatorio).
  //
  // Los nombres de las pantallas de Hotmart salen de guías de terceros (en inglés y portugués:
  // «Tools» → «Webhook (API Notifications)» → «Authentication» → «Verification Hottok»), no de la
  // pantalla en español: NO MEDIDOS. Se corrigen con la primera cuenta real que se conecte.
  {
    key: 'hotmart',
    nombre: 'Hotmart',
    categoria: 'Pagos',
    paraQue: 'Cada compra y cada carrito abandonado de tus productos de Hotmart entran solos a tu CRM, con su historial.',
    campos: [
      { env: 'HOTMART_HOTTOK', label: 'Hottok', secreto: true, placeholder: 'Tu hottok de Hotmart', nota: 'Está en Hotmart, en Webhook → «Autenticación». Sin esto no entra ninguna compra a tu CRM.' },
    ],
    pasoExterno: {
      titulo: 'Pega esta dirección dentro de Hotmart',
      porque: 'Es por donde Hotmart avisa cada compra y cada carrito abandonado. Sin esto, no entra nadie a tu CRM.',
      valor: '{{APP_URL}}/api/webhooks/hotmart',
      donde: 'En Hotmart: «Herramientas» → «Webhook» → «Registrar webhook», en el campo de la URL.',
      ojo: [
        'Elige la versión 2.0.0 y marca los eventos de compra y de carrito abandonado.',
        'El «Hottok» de esa pantalla es el mismo que va en MaKo: si no coinciden, MaKo rechaza el aviso.',
      ],
    },
    tutorial: {
      url: 'https://app.hotmart.com/tools/list/producer',
      urlLabel: 'Hotmart → Herramientas',
      pasos: [
        'En app.hotmart.com entra a «Herramientas», busca «Webhook» y abre su tarjeta.',
        'En la pestaña «Autenticación» copia el «Hottok» y pégalo en «Hottok».',
        'Toca «Registrar webhook», ponle de nombre MaKo y pega la dirección del recuadro amarillo.',
        'Elige la versión 2.0.0 y marca los eventos de compra y de carrito abandonado.',
      ],
    },
  },
  // Skool no tiene un webhook propio documentado: lo oficial son los triggers de su app de Zapier
  // («Answered Membership Questions», «New Paid Member»), y el Zap termina en «Webhooks by Zapier».
  // La clave la INVENTA el negocio (como el «Secret» de Cal.com) y viaja en un header, nunca en la
  // URL. ⚠️ NO MEDIDO: que con «Data» vacío Zapier mande los campos crudos del trigger (es lo que
  // dice su ayuda del paso POST); el lector (lib/skool-evento.ts) acepta también los campos mapeados.
  {
    key: 'skool',
    nombre: 'Skool',
    categoria: 'Contenido',
    paraQue: 'Quien pide entrar a tu comunidad de Skool entra solo a tu CRM, con sus respuestas a las preguntas de ingreso.',
    campos: [
      { env: 'SKOOL_WEBHOOK_CLAVE', label: 'Clave del aviso', secreto: true, placeholder: 'Una clave larga que inventes', nota: 'La inventas tú. Va igual aquí y en el header X-MaKo-Clave del Zap. Sin esto no entra nadie.' },
    ],
    pasoExterno: {
      titulo: 'Pega esta dirección en tu Zap de Skool',
      porque: 'Skool avisa por Zapier. Sin este paso, quien pide entrar a tu comunidad no llega a tu CRM.',
      valor: '{{APP_URL}}/api/webhooks/skool',
      donde: 'En zapier.com: tu Zap con Skool → paso «Webhooks by Zapier» → «POST» → campo «URL».',
      ojo: [
        'En «Headers» agrega X-MaKo-Clave con la misma clave de MaKo: sin ella, MaKo rechaza el aviso.',
        'Deja «Data» vacío: así llegan el email, el nombre y las respuestas tal como los da Skool.',
      ],
    },
    tutorial: {
      url: 'https://zapier.com/apps/skool/integrations',
      urlLabel: 'Zapier → Skool',
      pasos: [
        'En «Clave del aviso» escribe una clave larga que inventes (por ejemplo micomunidad2026clave).',
        'En zapier.com crea un Zap con el trigger de Skool «Answered Membership Questions».',
        'Como acción elige «Webhooks by Zapier» → «POST» y pega la dirección del recuadro amarillo.',
        'En «Headers» agrega X-MaKo-Clave con la misma clave, y publica el Zap.',
      ],
    },
  },
  // APIFY (15/10/2026, docs/diseno-leads-scraper.md §5): donde corren las búsquedas de prospectos.
  // BYOK: cada búsqueda se cobra en la cuenta de Apify del negocio, con un techo que MaKo le pasa a
  // la corrida (`maxTotalChargeUsd`, lib/apify.ts). No recibe webhooks por credencial: el aviso de
  // vuelta se rutea por la búsqueda (app/api/webhooks/apify), así que no hay fila de ruteo.
  {
    key: 'apify',
    nombre: 'Apify',
    categoria: 'Datos',
    paraQue: 'Buscar prospectos en Google Maps e Instagram desde MaKo, con tu cuenta de Apify: pagas sólo lo que encuentras.',
    campos: [
      { env: 'APIFY_TOKEN', label: 'Token de Apify', secreto: true, placeholder: 'apify_api_…', nota: 'Está en Apify → Settings → API & Integrations. Cada búsqueda se cobra en tu cuenta, con un techo.' },
    ],
    tutorial: {
      url: 'https://console.apify.com/settings/integrations',
      urlLabel: 'Apify → Settings → API & Integrations',
      pasos: [
        'Crea tu cuenta en apify.com: el plan gratis alcanza para empezar.',
        'En console.apify.com entra a «Settings» → «API & Integrations».',
        'Copia tu «Personal API token» y pégalo en «Token de Apify».',
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

/** El catálogo que le corresponde ver a alguien. El super-admin ve todo; un cliente
 *  NUNCA ve las credenciales de la plataforma — no son suyas y no puede hacer nada con
 *  ellas más que confundirse o filtrarlas. */
export const serviciosPara = (esSuperAdmin: boolean): ServicioMetodo[] =>
  esSuperAdmin ? SERVICIOS_METODO : SERVICIOS_METODO.filter((s) => !s.soloPlataforma);

export const servicioMetodo = (key: string): ServicioMetodo | undefined => {
  const s = SERVICIOS_METODO.find((x) => x.key === key);
  if (!s) return undefined;
  // Tanto los pasos del tutorial como el pasoExterno pueden escribir {{APP_URL}}.
  // Se resuelve acá, en el único accessor, para que ninguna vista tenga que
  // acordarse de hacerlo (y para que una mudanza de dominio no deje instructivos
  // mintiendo en media app).
  return {
    ...s,
    tutorial: { ...s.tutorial, pasos: s.tutorial.pasos.map(conUrlReal) },
    ...(s.pasoExterno ? { pasoExterno: { ...s.pasoExterno, valor: conUrlReal(s.pasoExterno.valor) } } : {}),
  };
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
// El largo: «Para qué sirve: …» en una línea corta y de 2 a 4 acciones, de 120 caracteres o menos
// (tests/tutoriales-legibles.test.ts). Acortar es CONDENSAR los pasos que ya están: nunca sumar uno.
//
// OJO al editar: estos pasos nombran pantallas REALES de cada proveedor. Si no
// verificaste un paso contra la doc oficial, no lo escribas: un tutorial inventado
// hace perder más tiempo que no tener tutorial.
const AYUDA_CAMPO: Record<string, { pasos: string[]; url?: string; urlLabel?: string }> = {
  // META_ACCESS_TOKEN NO tiene entrada A PROPÓSITO (12/10/2026, duodécima tanda): repetía, paso por paso, el
  // tutorial del servicio. Sin entrada, su «?» cae a ese tutorial, que es lo que contesta «qué pongo aquí» para
  // el único dato que se pega. Los otros seis campos de Meta sí tienen ayuda propia (tests/tutoriales-legibles).
  META_AD_ACCOUNT_ID: {
    pasos: [
        'Para qué sirve: le dice a MaKo de qué cuenta de anuncios traer el gasto y los resultados.',
        'Normalmente lo completa MaKo al pegar el "Access token"; si tienes varias cuentas, eliges una.',
        'A mano: en adsmanager.facebook.com, el número largo junto al nombre de la cuenta, arriba a la izquierda.',
        'Escríbelo con act_ adelante y sin espacios (act_1234567890): sin el act_, el tablero queda en blanco.',
      ],
    url: 'https://adsmanager.facebook.com/adsmanager',
    urlLabel: 'Administrador de anuncios',
  },
  META_PAGE_ACCESS_TOKEN: {
    pasos: [
        'Para qué sirve: trae los datos de quien deja su contacto en tus formularios de Facebook e Instagram.',
        'No lo escribes tú: MaKo lo saca del "Access token". Si queda vacío, falta la página o algún permiso.',
        'En business.facebook.com/settings → "Usuarios del sistema" → tu usuario → "Agregar activos" → "Páginas".',
        'Marca tu página con "Control total", guarda y genera un token nuevo con: leads_retrieval, pages_show_list, pages_read_engagement, pages_manage_ads.',
        'Pega el token nuevo en "Access token" y guarda: el token de la página se completa solo.',
      ],
    url: 'https://business.facebook.com/settings',
    urlLabel: 'Configuración del negocio en Meta',
  },
  META_PIXEL_ID: {
    pasos: [
        'Para qué sirve: con el píxel, MaKo le devuelve a Meta las ventas que se cierran fuera de la web.',
        'Normalmente lo completa MaKo al pegar el "Access token"; si tienes varios píxeles, te pregunta cuál.',
        'A mano: en business.facebook.com/events_manager2 ("Administrador de eventos") toca tu píxel y copia su número.',
        'Pégalo aquí, solo dígitos. Si no tienes píxel, déjalo vacío: MaKo funciona igual.',
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
        'Para qué sirve: casi nunca. MaKo ya manda las conversiones con el "Access token": déjalo vacío.',
        'Solo hace falta si tu píxel vive en OTRO negocio de Meta que no puedes asignar a tu usuario del sistema.',
        'En business.facebook.com/events_manager2 elige tu píxel → "Configuración" → "Conversions API".',
        'Toca "Generar token de acceso", copia el código y pégalo en este campo.',
      ],
    url: 'https://business.facebook.com/events_manager2',
    urlLabel: 'Administrador de eventos',
  },
  META_PAGE_ID: {
    pasos: [
        'Para qué sirve: sin esto, quien deja su teléfono en tus formularios de Facebook e Instagram no llega a ningún lado.',
        'Lo completa MaKo al pegar el "Access token"; si tienes varias páginas, eliges la de tus anuncios.',
        'Si quedó vacío: business.facebook.com/settings → "Usuarios del sistema" → tu usuario → "Agregar activos".',
        'En "Páginas" marca tu página con "Control total" y guarda.',
        'Toca "Generar nuevo token" y pégalo en "Access token": la página se completa sola.',
      ],
    url: 'https://business.facebook.com/settings',
    urlLabel: 'Configuración del negocio en Meta',
  },
  // El ÚNICO paso de Meta que no tiene endpoint: `POST /{business_id}/adspixels` crea
  // píxeles de sitio, y la doc de la integración de CRM no ofrece ninguna llamada para
  // crear un conjunto de datos de tipo CRM ni para configurar el embudo. Por eso esto
  // es un tutorial de CAMPO y no un paso automático.
  //
  // Los pasos salen de la doc oficial leída el 05/10/2026
  // (developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration),
  // con los rótulos de la pantalla de HOY: "Connect Data Sources" → "CRM" → "Connect"
  // → "Create New Dataset". Meta renombra este panel seguido —lo que antes era un
  // "píxel" hoy es un "conjunto de datos"—, así que al editar esto se vuelve a mirar la
  // doc, no la memoria.
  META_CRM_DATASET_ID: {
    pasos: [
        'Para qué sirve: que Meta busque gente que califique, no solo que deje sus datos. Opcional: sin esto no se rompe nada.',
        'En business.facebook.com/events_manager2 ("Administrador de eventos") toca "Conectar orígenes de datos" → "CRM".',
        'Crea uno nuevo, llámalo "CRM" y, si pregunta, elige hacerlo por tu cuenta, con "MaKo" como programa.',
        'Toca el nuevo (lleva el icono de CRM), copia el número junto a su nombre y pégalo en este campo.',
        'Con 200 contactos al mes, Meta habilita "Clientes potenciales de conversión" en el administrador de anuncios.',
      ],
    url: 'https://business.facebook.com/events_manager2',
    urlLabel: 'Administrador de eventos',
  },
  RESEND_API_KEY: {
    pasos: [
        'Para qué sirve: deja a MaKo mandar tus correos de seguimiento y tus reportes desde tu cuenta de Resend.',
        'Entra a resend.com → "API Keys" y toca "Create API Key".',
        'En "Permission" elige "Full access": con "Sending access" MaKo marca la conexión como fallada.',
        'Copia la key (re_…, se ve UNA vez) y pégala en este campo.',
        'Para no caer en spam, tu dominio va verificado en "Domains": los pasos están en el "?" de "Remitente".',
      ],
    url: 'https://resend.com/api-keys',
    urlLabel: 'Resend → API Keys',
  },
  RESEND_FROM: {
    pasos: [
        'Para qué sirve: es quién firma tus correos. Sin esto salen de onboarding@resend.dev y solo te llegan a ti.',
        'Entra a resend.com → "Domains" → "Add Domain" y escribe tu dominio (por ejemplo tunegocio.com).',
        'Copia sus 3 registros (1 MX con prioridad 10 y 2 TXT) en la sección DNS de donde compraste tu dominio.',
        'Ojo: el nombre va sobre send.tudominio.com. Después toca "Verify DNS Records" hasta que diga "Verified".',
        'Escribe aquí tu nombre y un correo de ese dominio entre < >: Tu negocio <hola@tunegocio.com>.',
      ],
    url: 'https://resend.com/domains',
    urlLabel: 'Resend → Domains',
  },
  ANTHROPIC_API_KEY: {
    pasos: [
        'Para qué sirve: con esta key MaKo piensa. Sin ella no hay análisis, ni chat, ni sugerencias.',
        'Entra a platform.claude.com. Es otra cuenta que claude.ai: Claude Pro no sirve aquí.',
        'En "Billing" toca "Add funds" y carga saldo (mínimo 5 dólares): sin saldo la key no responde.',
        'En "API Keys" toca "Create Key" y copia la key (sk-ant-…, se ve UNA vez).',
        'Pégala en este campo y guarda.',
      ],
    url: 'https://platform.claude.com/settings/keys',
    urlLabel: 'Claude Platform → API Keys',
  },
  OPENAI_API_KEY: {
    pasos: [
        'Para qué sirve: con esta key MaKo pasa a texto tus audios y videos: notas de voz, llamadas y reuniones.',
        'Entra a platform.openai.com. No es chatgpt.com: ChatGPT Plus no sirve aquí.',
        'En "Settings" → "Billing" toca "Add credit" y carga saldo (mínimo 5 dólares): sin saldo la key no responde.',
        'En "API keys" toca "Create new secret key" y copia la key (sk-…, se ve UNA vez).',
        'Pégala en este campo y guarda.',
      ],
    url: 'https://platform.openai.com/api-keys',
    urlLabel: 'OpenAI Platform → API keys',
  },
  GROQ_API_KEY: {
    pasos: [
        'Para qué sirve: con esta key MaKo clasifica, resume, titula y pasa a texto tus notas de voz. Es gratis.',
        'Entra a console.groq.com/keys con Google, GitHub o tu correo (para "API key 2", con OTRA cuenta).',
        'Toca "Create API Key", ponle de nombre MaKo y copia la key (gsk_…, se ve UNA vez).',
        'Pégala en este campo y guarda.',
      ],
    url: 'https://console.groq.com/keys',
    urlLabel: 'Groq Console → API Keys',
  },
  GEMINI_API_KEY: {
    pasos: [
        'Para qué sirve: con esta key MaKo lee de una vez documentos y conversaciones muy largas.',
        'Entra a aistudio.google.com/apikey con tu cuenta de Google (para "API key 2", con OTRA cuenta).',
        'Ojo: en el plan gratis Google entrena con tus textos. Para evitarlo: "Billing Tier" → "Set up billing" (10 dólares).',
        'Toca "Create API key" con cualquier proyecto de Google Cloud y copia la key (empieza con AIza).',
        'Pégala en este campo y guarda.',
      ],
    url: 'https://aistudio.google.com/apikey',
    urlLabel: 'Google AI Studio → API keys',
  },
  FATHOM_API_KEY: {
    pasos: [
        'Para qué sirve: MaKo trae tus grabaciones y lo que se habló, para resumirlas y actualizar la ficha en el CRM.',
        'Entra a fathom.video con la cuenta que graba: la key solo ve sus grabaciones y las que le comparten.',
        'Toca tu foto → "Settings" → "API Access". Sin esa sección, tu plan de Fathom no la incluye.',
        'Toca "Generate API Key", copia la key y pégala en este campo.',
      ],
    url: 'https://fathom.video/customize#api-access-header',
    urlLabel: 'Fathom → API Access',
  },
  FATHOM_HOST_EMAIL: {
    pasos: [
        'Para qué sirve: le dice a MaKo que la grabación es tuya. Sin esto, tus reuniones se descartan sin ningún error.',
        'Escribe el correo de la cuenta de Fathom que graba: el mismo con el que entras a fathom.video.',
        'Si graban varias personas, va el de la dueña de la grabación: la que Fathom muestra como anfitrión.',
        'Escríbelo tal cual, sin espacios. Las mayúsculas no importan.',
      ],
  },
  FATHOM_WEBHOOK_SECRET: {
    pasos: [
        'Para qué sirve: tus reuniones llegan apenas cortas la llamada, y no horas después.',
        'En fathom.video: tu foto → "Settings" → "API Access" → "Manage" → "Add Webhook".',
        'En la dirección de destino pega {{APP_URL}}/api/webhooks/fathom (está en el recuadro amarillo).',
        'Marca "My Recordings" (y "Team Recordings" si tu plan es Team) y la casilla "transcript".',
        'Guarda, copia la contraseña (whsec_…, se ve UNA vez) y pégala en este campo.',
      ],
    url: 'https://fathom.video/customize#api-access-header',
    urlLabel: 'Fathom → API Access',
  },
  PANDA_API_KEY: {
    pasos: [
        'Para qué sirve: deja a MaKo leer cuánta gente le dio play a tu video de ventas y hasta qué minuto.',
        'En dashboard.pandavideo.com → "Settings" → "Advanced" toca "Generate new API key".',
        'Copia la key y pégala en este campo. Da acceso completo a tu cuenta: no la compartas.',
        'Guárdala también en otro lado: generar otra anula la anterior.',
      ],
    url: 'https://dashboard.pandavideo.com',
    urlLabel: 'Panda Video → Settings → Advanced',
  },
  PANDA_VSL_VIDEO_IDS: {
    pasos: [
        'Para qué sirve: le dice a MaKo de qué videos traer los números. Sin esto no llega ninguna métrica.',
        'En dashboard.pandavideo.com → "Videos" abre tu video de ventas y toca "Embed".',
        'Si hay un selector "Platform", elige "Custom".',
        'Copia el texto que va después de ?v= (hasta la comilla) y pégalo aquí; varios, separados por coma.',
        'Ojo: el número de la barra del navegador NO sirve; el que va es el del código de "Embed".',
      ],
    url: 'https://dashboard.pandavideo.com',
    urlLabel: 'Panda Video → Videos → Embed',
  },
  YOUTUBE_API_KEY: {
    pasos: [
        'Para qué sirve: deja a MaKo contar cuántas veces se reprodujo tu video de ventas en YouTube.',
        'En console.cloud.google.com, con tu cuenta de YouTube, crea un proyecto nuevo (selector de proyecto, arriba).',
        'En "APIs y servicios" → "Biblioteca" busca "YouTube Data API v3" y toca "Habilitar".',
        'En "APIs y servicios" → "Credenciales" → "Crear credenciales" → "Clave de API", copia la key (AIza…).',
        'Pégala en este campo.',
      ],
    url: 'https://console.cloud.google.com/apis/credentials',
    urlLabel: 'Google Cloud Console → Credenciales',
  },
  YOUTUBE_VSL_VIDEO_ID: {
    pasos: [
        'Para qué sirve: le dice a MaKo de qué video traer las reproducciones.',
        'Abre tu video de ventas en youtube.com y mira la dirección: youtube.com/watch?v=dQw4w9WgXcQ',
        'El ID es lo que va después de v= (dQw4w9WgXcQ); si hay un &, corta ahí. En youtu.be/ID, lo que sigue a la barra.',
        'Pégalo en este campo.',
      ],
  },
  YOUTUBE_OAUTH_CLIENT_ID: {
    pasos: [
        'Para qué sirve: la retención y las vistas diarias de TU canal. Para contar reproducciones no hace falta.',
        'En console.cloud.google.com (mismo proyecto que la "API key") → "Biblioteca", habilita "YouTube Analytics API".',
        'En console.cloud.google.com/auth/clients toca "Crear cliente" de tipo "Aplicación web".',
        'En "URIs de redireccionamiento autorizados" agrega https://developers.google.com/oauthplayground y toca "Crear".',
        'Copia el "Client ID" (termina en .apps.googleusercontent.com) aquí. No cierres: el secret se ve UNA vez.',
      ],
    url: 'https://console.cloud.google.com/auth/clients',
    urlLabel: 'Google Cloud → Clientes OAuth',
  },
  YOUTUBE_OAUTH_CLIENT_SECRET: {
    pasos: [
        'Para qué sirve: va de a pares con el "OAuth Client ID". Si ese quedó vacío, este también.',
        'Google lo muestra en la misma ventana en la que creas el cliente OAuth del campo anterior.',
        'Cópialo en ese momento (empieza con GOCSPX-, se ve UNA vez) y pégalo en este campo.',
        'Si ya cerraste esa ventana, crea un cliente OAuth nuevo y usa el par nuevo: el ID y el secret.',
      ],
    url: 'https://console.cloud.google.com/auth/clients',
    urlLabel: 'Google Cloud → Clientes OAuth',
  },
  YOUTUBE_OAUTH_REFRESH_TOKEN: {
    pasos: [
        'Para qué sirve: el permiso, dado una vez, para que MaKo lea las estadísticas de tu canal.',
        'En developers.google.com/oauthplayground, el engranaje: marca "Use your own OAuth credentials" y pega tu par.',
        'Deja "Access type" en "Offline": en "Online" Google no devuelve ningún refresh token.',
        'En "Step 1" pega https://www.googleapis.com/auth/yt-analytics.readonly, toca "Authorize APIs" y acepta.',
        'En "Step 2" toca "Exchange authorization code for tokens" y copia el "Refresh token" en este campo.',
      ],
    url: 'https://developers.google.com/oauthplayground',
    urlLabel: 'OAuth 2.0 Playground',
  },
  CALENDLY_API_TOKEN: {
    pasos: [
        'Para qué sirve: MaKo lee tu agenda de Calendly para que no se te pierda ninguna reunión.',
        'Entra a calendly.com → "Automations" → "Integrations & apps" → "API and webhooks".',
        'En "Personal access tokens" toca "Generate new token" ("Get a token now" la primera vez) y "Create token".',
        'Toca "Copy token" (se ve UNA vez), pégalo en este campo y guarda.',
        'MaKo te dice con qué cuenta quedó conectada: si no es la que esperabas, copiaste el token de otra.',
      ],
    url: 'https://calendly.com/integrations/api_webhooks',
    urlLabel: 'Calendly → API and webhooks',
  },
  CALENDLY_EVENT_TYPE_J1: {
    pasos: [
        'Para qué sirve: le dice a MaKo que la reserva es TUYA. Es obligatorio: sin esto, tus reuniones no entran a tu CRM.',
        'En calendly.com, cada link de agenda es un "Event Type": están en la lista de la pantalla principal.',
        'Copia el nombre del de tu primera reunión, tal cual (por ejemplo Llamada de auditoría), y pégalo aquí.',
        'También acepta la dirección técnica https://api.calendly.com/event_types/…, si te la pasó tu programador.',
      ],
    url: 'https://developer.calendly.com/api-docs/e17ac52b4b6f0-list-user-s-event-types',
    urlLabel: 'Calendly → List Event Types',
  },
  CALENDLY_EVENT_TYPE_J2: {
    pasos: [
        'Para qué sirve: opcional. Marca la reserva como tu segunda reunión ("R2"), si va por un link distinto.',
        'En calendly.com, cada link de agenda es un "Event Type": están en la lista de la pantalla principal.',
        'Copia el nombre del de tu segunda reunión, tal cual (por ejemplo Reunión de cierre), y pégalo aquí.',
        'Una segunda reunión nunca crea un contacto nuevo: completa el que ya existe.',
      ],
    url: 'https://developer.calendly.com/api-docs/e17ac52b4b6f0-list-user-s-event-types',
    urlLabel: 'Calendly → List Event Types',
  },
  // ⚠️ CAL.COM NECESITA AYUDA POR CAMPO, y sin ella los CUATRO campos abrían el
  // MISMO tutorial de 20 pasos: quien tocaba el «?» de «API key» recibía, desde el
  // paso 1, cómo crear el webhook. La ayuda del servicio contesta «cómo conecto
  // esto»; la del campo contesta «qué pongo ACÁ», que es la pregunta que se hace
  // quien tiene el cursor adentro del input.
  // ⚠️ SIN ENTRADA ACA, EL «?» DE CADA CAMPO ABRE EL MISMO TEXTO. En clarity
  // y en la plataforma de cursos (las dos salieron del producto el 06/10/2026) y
  // en github, los campos no tenian ayuda propia, asi que abrian
  // el tutorial entero del servicio — el cliente lo reporto como «la guia de cada
  // cosa aparece siempre el mismo». La del servicio contesta «como conecto esto»;
  // la del campo, «que pongo ACA», que es la pregunta de quien tiene el cursor
  // adentro del input.
  GITHUB_TOKEN: {
    pasos: [
        'Para qué sirve: MaKo lee los commits que entran a main y propone cerrar las tareas de desarrollo ya hechas.',
        'En github.com/settings/personal-access-tokens/new ponle un nombre y una expiración (anótala: no avisa al vencer).',
        '"Only select repositories" con SOLO este repo, y en "Repository permissions" → "Contents", "Read-only".',
        'Toca "Generate token", copia el token (se ve UNA vez) y pégalo en este campo. El repo lo saca MaKo.',
        'Si el repo es de una organización, el token queda en "Pending" hasta que un owner lo apruebe (la API da 404).',
      ],
    url: 'https://github.com/settings/personal-access-tokens/new',
    urlLabel: 'GitHub → Fine-grained tokens',
  },
  GITHUB_REPO: {
    pasos: [
        'Para qué sirve: de qué repo leer los commits. Casi siempre lo completa MaKo al guardar el token.',
        'Llénalo a mano solo si el token ve varios repos y MaKo te pide elegir.',
        'Va como usuario/repositorio: de github.com/mbustos-digital/dashboard-marketing, mbustos-digital/dashboard-marketing.',
        'Si te equivocaste de repo, cámbialo aquí: MaKo pasa a leer los commits del nuevo.',
      ],
    url: 'https://github.com/settings/personal-access-tokens',
    urlLabel: 'GitHub → Fine-grained tokens',
  },
  CALCOM_WEBHOOK_SECRET: {
    pasos: [
        'Para qué sirve: hace que cada reserva entre sola al CRM. Sin esta contraseña MaKo las rechaza todas.',
        'Escribe aquí una clave larga que inventes (por ejemplo inmobiliariaperez2026clave). No es la de Cal.com.',
        'En app.cal.com → "Settings" → "Developer" → "Webhooks" → "+ New", pega la dirección del recuadro amarillo.',
        'En "Secret" escribe EXACTAMENTE la misma clave, y marca "Booking Created" y "Booking Cancelled".',
        'Deja "Enable Webhook" encendido y guarda: apagado, Cal.com no manda nada.',
      ],
    url: 'https://app.cal.com/settings/developer/webhooks',
    urlLabel: 'Cal.com → Settings → Developer → Webhooks',
  },
  CALCOM_API_KEY: {
    pasos: [
        'Para qué sirve: opcional. MaKo lee tu agenda hacia atrás y recupera reservas viejas; las nuevas entran igual.',
        'En app.cal.com → "Settings" → "Developer" → "API Keys" toca "+ New" y ponle de nombre MaKo.',
        'Activa "Never expires": con fecha, la key deja de funcionar sola y sin avisar.',
        'Copia la key (cal_live_…, se ve UNA vez) y pégala en este campo.',
      ],
    url: 'https://app.cal.com/settings/developer/api-keys',
    urlLabel: 'Cal.com → Settings → Developer → API Keys',
  },
  CALCOM_EVENT_TYPE_J1: {
    pasos: [
        'Para qué sirve: le dice a MaKo que la reserva es TUYA. Sin esto, tus reuniones no entran a tu CRM.',
        'Llénalo aunque uses un solo link. Si la segunda reunión va por otro link, llena también el de R2.',
        'Abre tu página de reservas de Cal.com y mira su dirección: cal.com/juan/llamada-de-auditoria',
        'Escribe lo último, tras la última barra (llamada-de-auditoria), o el nombre de la reunión tal cual.',
      ],
  },
  CALCOM_EVENT_TYPE_J2: {
    pasos: [
        'Para qué sirve: opcional. Marca la reserva como tu segunda reunión ("R2"), si usas dos links distintos.',
        'Abre tu página de reservas de Cal.com y mira su dirección: cal.com/juan/llamada-de-auditoria',
        'Escribe lo último, tras la última barra (llamada-de-auditoria), o el nombre de la reunión tal cual.',
        'Una segunda reunión nunca crea un contacto nuevo: completa el que ya existe.',
      ],
  },
  CALENDLY_WEBHOOK_SIGNING_KEY: {
    pasos: [
        'Para qué sirve: opcional. Es la contraseña del aviso automático que crea el contacto de una reserva nueva.',
        'Calendly no tiene pantalla para ese aviso (se crea por programación, en planes pagos). Si no te montaron uno, vacío.',
        'Ojo: sin ese aviso, una reserva NUEVA no crea el contacto; MaKo solo completa a quien ya está en el CRM.',
        'Si te lo montó tu agencia, pídele la signing key y pégala idéntica: si difiere en un carácter, MaKo rechaza el aviso.',
        'Si lo montas tú: POST a https://api.calendly.com/webhook_subscriptions con tu token y la misma "signing_key".',
      ],
    url: 'https://developer.calendly.com/api-docs/b3A6NTkxNDI1-create-webhook-subscription',
    urlLabel: 'Calendly → Create Webhook Subscription',
  },
  // La pasarela de pagos (11/10/2026). Los pasos de Stripe salen de docs.stripe.com/keys/restricted-api-keys
  // (leída ese día): «Create restricted key» → «Key name» → None/Read/Write por recurso → «Create key»
  // → verificación en dos pasos → la clave se copia UNA vez. Los nombres de los recursos NO se pudieron
  // ver en el panel: si falta uno, MaKo lo nombra al guardar (el 403 de Stripe trae el permiso en el mensaje,
  // y lib/cobros-conexion.ts lo muestra tal cual).
  STRIPE_SECRET_KEY: {
    pasos: [
        'Para qué sirve: con esta clave MaKo crea tus links de pago y anota cada pago en la ficha del lead.',
        'En dashboard.stripe.com/apikeys toca "Create restricted key" y ponle de nombre MaKo.',
        'Permisos "Write": Checkout Sessions, Webhook Endpoints, Refunds y Subscriptions.',
        'Permisos "Read": Invoices, Charges, Payment Intents y Accounts. Lo demás, en "None".',
        'Toca "Create key", copia la clave (rk_live_…, se ve UNA vez) y pégala en este campo.',
      ],
    url: 'https://dashboard.stripe.com/apikeys',
    urlLabel: 'Stripe → API keys',
  },
  MERCADOPAGO_ACCESS_TOKEN: {
    pasos: [
        'Para qué sirve: con este token MaKo crea tus links de pago y anota cada pago en la ficha del lead.',
        'En mercadopago.com/developers/panel/app abre tu aplicación o créala (tipo "Checkout Pro").',
        'Entra a "Credenciales de producción"; la primera vez, actívalas con tu rubro y tu sitio web.',
        'Copia el "Access Token" (empieza con APP_USR-) y pégalo en este campo. La "Public Key" no sirve.',
      ],
    url: 'https://www.mercadopago.com/developers/panel/app',
    urlLabel: 'Mercado Pago → Tus integraciones',
  },
  MERCADOPAGO_WEBHOOK_SECRET: {
    pasos: [
        'Para qué sirve: confirma el aviso de pagos, que es lo que hace entrar las renovaciones de una suscripción.',
        'En tu aplicación de Mercado Pago (la del access token) entra a "Webhooks" → "Configurar notificaciones".',
        'En la URL de producción pega {{APP_URL}}/api/webhooks/mercadopago (está en el recuadro amarillo).',
        'Marca los eventos "Pagos" y "Planes y suscripciones" y guarda.',
        'Copia la "clave secreta" que aparece y pégala en este campo.',
      ],
    url: 'https://www.mercadopago.com/developers/panel/app',
    urlLabel: 'Mercado Pago → Tus integraciones',
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
  // Una cuenta EXTRA (`GEMINI_API_KEY_2`) se consigue igual que la primera: el
  // tutorial es el de su clave base. Sin esto, el "?" de la segunda key no abre
  // nada — y es justo donde el usuario más lo necesita (tiene que crear una
  // cuenta nueva en el proveedor, no repetir la que ya tiene).
  const a = AYUDA_CAMPO[env] ?? AYUDA_CAMPO[claveBaseDe(env)];
  if (!a) return null;
  return { ...a, pasos: a.pasos.map(conUrlReal) };
}
