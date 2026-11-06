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
import { CLAVES_ZERNIO, slotDeClaveZernio } from './zernio-redes';
import { CLAVES_APIFY_DE_SPY, nombreDeClaveApify, slotDeClaveApify } from './instagram-perfil';

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
   * true → la pantalla ya NO lo pide: se ve sólo si el negocio lo tenía cargado (para verlo, cambiarlo o quitarlo). Va con
   * `opcional`. Existe por la clave de YouTube (27/10/2026): las vistas del VSL son públicas y MaKo las lee con su clave, y
   * el canal se conecta con el login de Zernio; pedirle a cada negocio una clave de Google Cloud era el laberinto. El token de
   * Meta también lo es (la misma tarde) y NO es `opcional`, a propósito: `opcional` lo leen los lectores de «conectado», y
   * Meta ya cuenta conectada con la conexión de Zernio (`metaConectadaConCampos`). La API de MaKo tampoco lo lista si falta.
   */
  retirado?: boolean;
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
    /**
     * Capturas REALES de cada paso, en el mismo orden (`null` = ese paso todavía no tiene una). Con capturas, la ayuda va UN PASO
     * POR PANTALLA (29/10/2026, el pedido del tutorial de Zernio). Viven en public/tutoriales/<servicio>/. Nunca una imagen armada.
     */
    capturas?: ReadonlyArray<string | null>;
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
      // ⚠️ LOS TOKENS DE META NO SE VEN NUNCA (29/10/2026, ticket #28, Martín: «ya no debería pedirte nada de Access Token. Toda esa
      // parte de los tokens ya no debería existir»): `retirado`, y el modal de Meta los filtra siempre (`esTokenDeMeta`,
      // ServicioConfigForm). Meta se conecta en la tarjeta de Zernio (`SE_CONFIGURA_EN`, lib/integraciones-catalogo.ts). El token
      // GUARDADO no se borra: sigue de respaldo hasta el corte (`CORTE_TOKEN_META`, lib/zernio-meta-cuerpo.ts).
      { env: 'META_ACCESS_TOKEN', label: 'Conexión anterior de Meta', secreto: true, retirado: true, placeholder: 'EAAG…', nota: 'La conexión de antes: ya no se pide ni se muestra. Meta se conecta en Zernio.' },
      { env: 'META_AD_ACCOUNT_ID', label: 'ID de cuenta publicitaria', auto: true, placeholder: 'act_1234567890', nota: 'Lo elige MaKo al conectar «Anuncios de Meta» en Zernio; con varias, eliges una ahí. Va con act_ adelante.' },
      { env: 'META_PAGE_ACCESS_TOKEN', label: 'Conexión anterior de la página', secreto: true, opcional: true, auto: true, retirado: true, placeholder: 'EAAG…', nota: 'La conexión de antes: ya no se pide. Los contactos de tus formularios llegan por Zernio.' },
      { env: 'META_PIXEL_ID', label: 'ID del píxel', opcional: true, auto: true, placeholder: '1234567890', nota: 'Lo completa MaKo al conectar «Anuncios de Meta» en Zernio. Con más de un píxel, eliges uno ahí.' },
      // El token del PÍXEL (25/10/2026): con el token de Meta deprecado, es la salida de CAPI cuando la conexión de Facebook por
      // Zernio no llega al píxel (lib/meta-capi.ts). Ya no es `auto`: MaKo no lo completa (nunca lo hizo) y la persona lo tiene
      // que VER para pegarlo. Tutorial entero: docs/tutorial-capi-pixel.md.
      { env: 'META_CAPI_TOKEN', label: 'Conexión anterior del píxel', secreto: true, opcional: true, retirado: true, placeholder: 'EAAG…', nota: 'La salida de antes para tu píxel: ya no se pide. Las conversiones salen por tu Zernio.' },
      { env: 'META_PAGE_ID', label: 'ID de tu página de Facebook', opcional: true, auto: true, placeholder: '1234567890', nota: 'Lo completa MaKo al conectar con Facebook en Zernio. Hace que tus formularios lleguen a tu cuenta.' },
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
      // La conexión de Zernio (25/10/2026, lib/meta-via.ts): el `_id` de la conexión de anuncios `metaads` del negocio en SU
      // Zernio. Un id, no un secreto, y `derivado`: lo escribe SÓLO el server al quedar conectado «Conectar con Facebook»
      // (una conexión tipeada podría ser la de otro negocio). Con esto y la cuenta publicitaria, Meta cuenta como conectada
      // sin el token (`metaConectadaConCampos`).
      { env: 'META_ZERNIO_CUENTA', label: 'Conexión de Facebook (Zernio)', opcional: true, auto: true, derivado: true, nota: 'La completa MaKo al conectar con Facebook. Con esto MaKo lee y publica en Meta por tu Zernio.' },
    ],
    tutorial: {
      url: 'https://zernio.com',
      urlLabel: 'Zernio',
      // El token SE VA (27/10/2026, pedido del Cerebro tras el alta de los negocios de Joan, que se perdió en el tutorial del
      // token: «tenía 45 pasos pero estaba muy resumido»). Ya no se enseña a sacarlo: el tutorial avisa el corte
      // (`CORTE_TOKEN_META`, lib/zernio-meta-cuerpo.ts; tests/meta-tutorial-app-propia.test.ts fija que la fecha sea la misma)
      // y lleva a «Conectar con Facebook», que pide la key de Zernio si falta. El de antes (crear la app, el usuario del
      // sistema, el token con 8 permisos) está en el historial de git.
      // ⚠️ Sigue valiendo la regla de Martín del 16/09: ningún paso pide publicar ni activar una app.
      // 27/10/2026, Martín: «ya no existe TOKEN de meta, todo por zernio con un simple login de facebook». El tutorial ya no nombra
      // el token (el corte del 03/11 lo dice sólo la nota del campo, que ve quien lo tenía): conectar es con Facebook.
      // 29/10/2026 (ticket #28): se conecta en la tarjeta de Zernio, en dos pasos. Este modal ya no tiene un botón propio.
      pasos: [
        'Meta se conecta con tu Facebook, por Zernio, en su tarjeta: no hay que crear ninguna app ni copiar nada de Meta.',
        'Paso 1: pega tu API key de Zernio (zernio.com → "Settings" → "API Keys").',
        'Paso 2: en «Anuncios de Meta» toca "Conectar con Facebook" y acepta.',
        'Si tienes varias cuentas publicitarias o píxeles, eliges el tuyo ahí mismo.',
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
    nombre: 'Zernio',
    categoria: 'Mensajería',
    paraQue: 'Conecta tu Facebook, tu Instagram y tus anuncios de Meta con tu cuenta de Zernio, sin salir de MaKo.',
    campos: [
      // BYOK SIN respaldo de plataforma (23/10/2026, Martín: «que cada usuario traiga su API de Zernio»): la key es
      // OBLIGATORIA y es siempre la del negocio. El ruteo del webhook NO sale de este campo (una key es secreta y jamás
      // se espeja a `webhook_routing`): lo acuña el server (`ensureProfile`, `cuentasConectadas`). Por eso no está en
      // ROUTING_CREDS. La nota es la línea del cobro: cada red cuenta aparte en Zernio, y lo paga el negocio.
      { env: 'ZERNIO_API_KEY', label: 'API key de Zernio', secreto: true,
        nota: 'Zernio te cobra a ti. Cada red cuenta aparte (página, Instagram, anuncios): 2 gratis, desde la 3.ª se paga.' },
      // VARIAS CLAVES (29/10/2026, Martín: «pegar una segunda API key con otra cuenta de Gmail del cliente... y ya tendrías cuatro
      // redes»): cada una es OTRA cuenta de Zernio del cliente, con su email. `opcional` a propósito: la tarjeta sigue conectada con la
      // 1 sola. Las redes que se conectan con una quedan atadas a ella (lib/zernio.ts, `cfgDeCuenta`).
      ...CLAVES_ZERNIO.slice(1).flatMap((env): CampoCredencial[] => [
        { env, label: `API key de Zernio ${slotDeClaveZernio(env)}`, secreto: true, opcional: true, slot: slotDeClaveZernio(env) ?? undefined,
          nota: 'De OTRA cuenta de Zernio tuya (otro Gmail): las redes que conectes con ella usan esta clave.' },
        { env: `${env}_ACCOUNT`, label: `Email de la cuenta de Zernio ${slotDeClaveZernio(env)}`, secreto: false, opcional: true,
          slot: slotDeClaveZernio(env) ?? undefined, placeholder: 'otromail@gmail.com',
          nota: 'El Gmail de esa cuenta de Zernio, para saber de un vistazo cuál es. No se usa para nada más.' },
      ]),
    ],
    tutorial: {
      url: 'https://zernio.com',
      urlLabel: 'Zernio',
      // Un paso por pantalla, con la captura real de cada uno (29/10/2026, el Cerebro: «el tutorial debe ser claro»). Los nombres de
      // los botones, tal cual los muestra zernio.com (docs.zernio.com/quickstart: «Open API keys and click Create API key»).
      pasos: [
        'Entra a zernio.com y crea tu cuenta con «Continue with Google»: con tu Gmail.',
        'En «API keys» toca «Create API key» y copia la clave: empieza con sk_ y Zernio la muestra UNA vez.',
        'Vuelve aquí, pégala en «API key de Zernio» y toca Guardar.',
        'En el Paso 2 toca «Conectar» en cada red y entra con su usuario. Cada clave conecta 2 redes gratis.',
      ],
      // El 1, la página real de registro (zernio.com/signup, 29/10/2026). El 2 pide entrar a una cuenta de Zernio, y el 3 y el 4 son
      // pantallas de MaKo: se suman cuando se puedan sacar de verdad (docs/hallazgos-integraciones.md).
      capturas: ['/tutoriales/zernio/1-crear-cuenta.webp', null, null, null],
    },
  },
  {
    key: 'email',
    nombre: 'Resend',
    categoria: 'Mensajería',
    paraQue: 'Envío de emails de nutrición, broadcasts y reportes.',
    campos: [
      { env: 'RESEND_API_KEY', label: 'API key', secreto: true, placeholder: 're_…', nota: 'Empieza con re_. En resend.com → "API Keys" → "Create API Key", con permiso "Full access". Se ve UNA sola vez.' },
      { env: 'RESEND_FROM', label: 'Remitente', opcional: true, sinEsto: 'Sin remitente, tus correos solo te llegan a ti.', placeholder: 'Tu negocio <hola@tudominio.com>', nota: 'Tu nombre y tu correo entre < >, de tu dominio verificado en Resend. Por ejemplo: Tu negocio <hola@tunegocio.com>.' },
    ],
    // 4/11/2026: cada negocio manda con SU cuenta de Resend (lib/email-cuenta.ts), y el dominio lo da de alta MaKo en esa
    // cuenta (la pestaña Email, o `conectar_dominio_email` por la API). Lo único técnico que hace la persona es la clave.
    tutorial: {
      url: 'https://resend.com/api-keys',
      urlLabel: 'Resend → API Keys',
      pasos: [
        'Crea tu cuenta gratis en resend.com: tus emails salen desde ahí.',
        'En "API Keys" toca "Create API Key" con permiso "Full access" y copia la key (re_…, se ve UNA vez).',
        'Pégala en "API key" y toca Guardar.',
        'Tu dominio lo conecta MaKo en la pestaña Email: te da los registros DNS para cargar donde lo compraste.',
      ],
    },
  },
  {
    key: 'anthropic',
    nombre: 'Anthropic API',
    categoria: 'Inteligencia',
    core: true,
    // ⚠️ DECÍA «El cerebro de MaKo: análisis, chats, sugerencias y todos los Analysts», y era
    // falso desde el veto del 13/08/2026. Lo que hace HOY la key de un negocio sale de
    // lib/veto-claude.ts: la segunda puerta (16/10/2026) la usa primero en sus funciones de
    // texto, salvo las del Plan, y la lista blanca, para el análisis de llamadas de cierre. Si
    // el veto cambia, esta frase cambia con él.
    paraQue: 'Claude. Con tu key, MaKo escribe y analiza con Claude antes que con la IA gratis, y lo paga tu cuenta. Sirve el crédito de API de Claude Max.',
    campos: [
      { env: 'ANTHROPIC_API_KEY', label: 'API key', secreto: true, placeholder: 'sk-ant-…', nota: 'Empieza con sk-ant-. Se guarda cifrada. Si la pierdes, bórrala en Claude Platform y crea otra.' },
    ],
    // El camino del crédito de Claude Max va PRIMERO (decisión de Martín, Ticketera
    // `clientes-usan-su-claude`, 15/10/2026). Los pasos salen de la página oficial
    // (platform.claude.com/docs/en/about-claude/api-credits-for-subscribers, leída el 15/10):
    // Max 5x US$100 y Max 20x US$200 por mes, desde los 7 días de suscripto, una organización
    // de Console por plan, y no se acumulan.
    tutorial: {
      url: 'https://platform.claude.com/settings/keys',
      urlLabel: 'Claude Platform → API Keys',
      pasos: [
        '¿Tienes Claude Max hace 7 días o más? En claude.ai → Settings → Billing → "API credits", vincula tu organización.',
        'Con Pro o sin Max: en platform.claude.com → "Billing" carga saldo con "Add funds" (mínimo 5 dólares).',
        'En platform.claude.com → "API Keys" toca "Create Key" y copia la key (sk-ant-…, se ve UNA vez).',
        'Pégala en "API key" y guarda. Max 5x trae 100 dólares por mes y Max 20x, 200; no se acumulan.',
      ],
    },
  },
  {
    key: 'openai',
    nombre: 'OpenAI API',
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
    nombre: 'Groq API',
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
    nombre: 'Gemini API',
    categoria: 'Inteligencia',
    paraQue: 'Tu Gemini: con tu clave, MaKo trabaja solo con tu cuenta. El plan gratis no cobra, pero Google puede usar tus datos para mejorar sus modelos (con revisión humana). Activa la facturación en AI Studio y no los usa.',
    campos: [
      { env: 'GEMINI_API_KEY', label: 'API key', secreto: true, placeholder: 'AQ.…', nota: 'Empieza con AQ. (o AIza, las viejas). En el plan gratis, Google usa tus textos y su gente puede leerlos.' },
      cuentaDe('GEMINI_API_KEY'),
      ...keysExtra('gemini', 'AQ.…'),
    ],
    tutorial: {
      url: 'https://aistudio.google.com/apikey',
      urlLabel: 'Google AI Studio → API keys',
      pasos: [
        'Entra a aistudio.google.com/apikey con tu cuenta de Google.',
        'Ojo: en el plan gratis Google entrena con tus textos. Para evitarlo: "Billing Tier" → "Set up billing" (10 dólares).',
        'Toca "Create API key" con cualquier proyecto de Google Cloud y copia la key (empieza con AQ.).',
        'Pégala en "API key" y guarda.',
        '"API key 2" es opcional: la key de otra cuenta de Google, para cuando la primera llega a su tope.',
      ],
    },
  },
  // IA8 (22/10/2026): Cerebras, Mistral y OpenRouter se sacaron (docs/hallazgos-ia.md). ⚠️ Sin su método, una fila ya
  // guardada no se puede borrar ni revelar desde la pantalla (ENVS_METODO): queda inerte; borrarla es SQL.
  {
    key: 'apple-push',
    nombre: 'Apple Push',
    categoria: 'Desarrollo',
    soloPlataforma: true,
    // De la PLATAFORMA, como GitHub: la app de iPhone es una sola, con el id `com.holamako.app`. lib/push-apns.ts lee estas tres del ws de plataforma.
    paraQue: 'Los avisos de la app de iPhone. Sin esto, los iPhones no reciben notificaciones (Android y la computadora siguen igual).',
    campos: [
      { env: 'APNS_KEY_ID', label: 'Key ID', secreto: false, placeholder: 'ABC123DEFG', nota: 'Los 10 caracteres que Apple muestra al lado de la clave.' },
      { env: 'APNS_TEAM_ID', label: 'Team ID', secreto: false, placeholder: 'XYZ987WVUT', nota: 'Los 10 caracteres de Membership, en developer.apple.com/account.' },
      { env: 'APNS_P8', label: 'La clave (.p8)', secreto: true, placeholder: '-----BEGIN PRIVATE KEY-----…', nota: 'Abre el archivo .p8 con el Bloc de notas y pega todo. Apple la deja bajar UNA sola vez.' }, // claves-en-el-diff: ok
    ],
    tutorial: {
      url: 'https://developer.apple.com/account/resources/authkeys/list',
      urlLabel: 'Apple Developer → Keys',
      pasos: [
        'Entra a developer.apple.com/account/resources/authkeys/list con tu cuenta de Apple.',
        'Toca «+», ponle de nombre «MaKo push» y marca «Apple Push Notifications service (APNs)».',
        'Toca «Continue» y «Register», y baja el archivo .p8: Apple lo deja bajar UNA sola vez. Guárdalo.',
        'Carga los tres campos de arriba: cada uno tiene su «?» con dónde está.',
      ],
    },
  },
  // ── El vigía de las aprobaciones (4/11/2026, lib/vigia-aprobaciones-server.ts) ── De la PLATAFORMA, como Apple Push: el vigía
  // lee estas claves del ws de plataforma y SÓLO LEE (en qué está la app en cada tienda). Con ellas no se publica nada.
  {
    key: 'app-store-connect',
    nombre: 'App Store Connect',
    categoria: 'Desarrollo',
    soloPlataforma: true,
    paraQue: 'MaKo mira cada hora si Apple aprobó, rechazó o pide algo de la app de iPhone, y te avisa sólo cuando cambia.',
    campos: [
      { env: 'ASC_ISSUER_ID', label: 'Issuer ID', secreto: false, placeholder: '00000000-0000-0000-0000-000000000000', nota: 'El código largo con guiones que Apple muestra arriba de la lista de claves.' },
      { env: 'ASC_KEY_ID', label: 'Key ID', secreto: false, placeholder: 'ABC123DEFG', nota: 'Los 10 caracteres al lado del nombre de la clave.' },
      { env: 'ASC_P8', label: 'La clave (.p8)', secreto: true, placeholder: '-----BEGIN PRIVATE KEY-----…', nota: 'Abre el archivo .p8 con el Bloc de notas y pega todo. Apple la deja bajar UNA sola vez.' }, // claves-en-el-diff: ok
    ],
    tutorial: {
      url: 'https://appstoreconnect.apple.com/access/integrations/api',
      urlLabel: 'App Store Connect → Integraciones',
      pasos: [
        'Entra a App Store Connect, abre «Usuarios y acceso» y su pestaña «Integraciones».',
        'En «Claves del equipo» toca «+», ponle de nombre «MaKo vigía» y el acceso «Developer».',
        'Toca «Generar» y baja el archivo .p8: Apple lo deja bajar UNA sola vez. Guárdalo.',
        'Carga los tres campos de arriba: cada uno tiene su «?» con dónde está.',
      ],
    },
  },
  {
    key: 'tiendas-google',
    nombre: 'Google Play y Chrome Web Store',
    categoria: 'Desarrollo',
    soloPlataforma: true,
    paraQue: 'MaKo mira cada hora si Google aprobó, rechazó o pide algo de la app de Android y de la extensión, y te avisa sólo cuando cambia.',
    campos: [
      { env: 'TIENDAS_GOOGLE_CUENTA_SERVICIO', label: 'Cuenta de servicio (JSON)', secreto: true, placeholder: '{"type": "service_account", …}', nota: 'Abre el archivo .json de la cuenta de servicio con el Bloc de notas y pega todo.' },
      { env: 'CWS_PUBLISHER_ID', label: 'Publisher ID de la Chrome Web Store', secreto: false, opcional: true, placeholder: 'El id de tu cuenta de la tienda', nota: 'Sin esto, de la extensión sólo se lee la versión publicada.' },
    ],
    tutorial: {
      url: 'https://console.cloud.google.com/iam-admin/serviceaccounts?project=mako-500317',
      urlLabel: 'Google Cloud → Cuentas de servicio',
      pasos: [
        'En el proyecto de Google Cloud de MaKo, crea una cuenta de servicio con el nombre «MaKo vigía».',
        'En su pestaña «Claves» toca «Agregar clave» › «JSON»: se baja el archivo. Guárdalo.',
        'Habilita las APIs «Google Play Android Developer» y «Chrome Web Store».',
        'Invita su email en Play Console, en «Usuarios y permisos», sólo para ver la app.',
        'Súmala en el panel de la Chrome Web Store, en Cuenta, y carga los dos campos de arriba.',
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
  // Los otros grabadores de reuniones (26/10/2026, lib/grabadores): leen lo mismo que Fathom, por la misma capa. Lo que da
  // cada API se midió ese día (docs/hallazgos-integraciones.md → «Los grabadores de reuniones»). Loom, Read AI y Google Meet
  // no están acá: no piden nada (su tarjeta dice por qué no se conectan; lib/integraciones.ts, `sinConexion`).
  {
    key: 'tldv',
    nombre: 'tl;dv',
    categoria: 'Reuniones',
    paraQue: 'Apenas termina una reunión grabada con tl;dv, MaKo la lee: saca las tareas al Plan y analiza las llamadas de venta.',
    // El correo es OBLIGATORIO: es lo que rutea el aviso al negocio (como FATHOM_HOST_EMAIL; tests/webhook-ruteo-obligatorio).
    campos: [
      { env: 'TLDV_API_KEY', label: 'API key', secreto: true, nota: 'Con esta key MaKo trae tus reuniones de tl;dv y lo que se habló en cada una.' },
      { env: 'TLDV_HOST_EMAIL', label: 'Email de la cuenta que graba', placeholder: 'tu@tudominio.com', nota: 'El correo con el que entras a tl;dv. Sin él, el aviso de cada reunión llega y se descarta.' },
    ],
    pasoExterno: {
      titulo: 'Pega esta dirección en tl;dv',
      porque: 'Es por donde tl;dv avisa al terminar una reunión. Sin esto, la reunión entra en la vuelta de cada hora.',
      valor: '{{APP_URL}}/api/webhooks/tldv',
      donde: 'En tl;dv: "Settings" → "Webhooks" → "Configure New Webhook", en la dirección de destino.',
      ojo: [
        'Elige el evento "MeetingReady": es el que dice quién organizó la reunión.',
      ],
    },
    tutorial: {
      url: 'https://tldv.io/app/settings/personal-settings/api-keys',
      urlLabel: 'tl;dv → API Keys',
      pasos: [
        'En tldv.io, con la cuenta que organiza las reuniones: "Settings" → "Personal Settings" → "API Keys".',
        'Toca "Create API Key" y pégala en "API key". Sólo anda con el plan Pro o Business.',
        'En "Email de la cuenta que graba" escribe el correo con el que entras a tl;dv.',
        'En "Webhooks" pega la dirección del recuadro amarillo con el evento "MeetingReady".',
      ],
    },
  },
  {
    key: 'fireflies',
    nombre: 'Fireflies.ai',
    categoria: 'Reuniones',
    paraQue: 'Cuando Fireflies termina de transcribir una reunión, MaKo la lee: saca las tareas al Plan y analiza las de venta.',
    campos: [
      { env: 'FIREFLIES_API_KEY', label: 'API key', secreto: true, nota: 'Con esta key MaKo trae tus reuniones de Fireflies y lo que se habló en cada una.' },
      { env: 'FIREFLIES_WEBHOOK_SECRET', label: 'Contraseña del webhook', secreto: true, opcional: true, sinEsto: 'Sin ella, tus reuniones entran en la vuelta de cada hora y no al terminar.', nota: 'El "Signing Secret" que escribes en el webhook de Fireflies. Con él, la reunión llega al terminar.' },
      { env: 'FIREFLIES_HOST_EMAIL', label: 'Email de la cuenta que graba', opcional: true, placeholder: 'tu@tudominio.com', nota: 'El correo de tu cuenta de Fireflies: así MaKo sabe quién es de la casa en cada reunión.' },
    ],
    pasoExterno: {
      titulo: 'Pega esta dirección en Fireflies',
      porque: 'Es por donde Fireflies avisa al terminar de transcribir. Sin esto, la reunión entra en la vuelta de cada hora.',
      valor: '{{APP_URL}}/api/webhooks/fireflies',
      donde: 'En app.fireflies.ai: "Integrations" → "Webhooks", en "Webhook URL".',
      ojo: [
        'Escribe un "Signing Secret" largo: sin él, MaKo no sabe de qué negocio es el aviso.',
      ],
    },
    tutorial: {
      url: 'https://app.fireflies.ai/integrations/custom/fireflies',
      urlLabel: 'Fireflies → API',
      pasos: [
        'En app.fireflies.ai, con la cuenta que graba: "Integrations" → "Fireflies API".',
        'Copia tu API key y pégala en "API key".',
        'En "Webhooks" pega la dirección del recuadro amarillo y escribe un "Signing Secret".',
        'Pega ese mismo secreto en "Contraseña del webhook".',
      ],
    },
  },
  {
    key: 'zoom',
    nombre: 'Zoom',
    categoria: 'Reuniones',
    paraQue: 'Cuando Zoom termina de transcribir una grabación en la nube, MaKo la lee: saca las tareas al Plan y analiza las de venta.',
    campos: [
      { env: 'ZOOM_ACCOUNT_ID', label: 'Account ID', placeholder: 'AbCdEf12GhIj', nota: 'El "Account ID" de tu app Server-to-Server OAuth de Zoom (en "App Credentials").' },
      { env: 'ZOOM_CLIENT_ID', label: 'Client ID', nota: 'El "Client ID" de esa misma app.' },
      { env: 'ZOOM_CLIENT_SECRET', label: 'Client Secret', secreto: true, nota: 'El "Client Secret" de esa app: con los tres, MaKo lee tus grabaciones en la nube.' },
      { env: 'ZOOM_WEBHOOK_SECRET', label: 'Secret Token', secreto: true, opcional: true, sinEsto: 'Sin él, tus grabaciones entran en la vuelta de cada hora y no al terminar.', nota: 'El "Secret Token" de la app (en "Feature"). Con él, la grabación llega al terminar.' },
    ],
    pasoExterno: {
      titulo: 'Pega esta dirección en tu app de Zoom',
      porque: 'Es por donde Zoom avisa cuando la transcripción está lista. Sin esto, entra en la vuelta de cada hora.',
      valor: '{{APP_URL}}/api/webhooks/zoom',
      donde: 'En marketplace.zoom.us, tu app → "Feature" → "Event Subscriptions", en "Event notification endpoint URL".',
      ojo: [
        'Suma los eventos "Recording Transcript files have completed" y "All Recordings have completed".',
        'Guarda primero el "Secret Token" en MaKo: Zoom valida la dirección apenas la pegas.',
      ],
    },
    tutorial: {
      url: 'https://marketplace.zoom.us/develop/create',
      urlLabel: 'Zoom → Build App',
      pasos: [
        'En marketplace.zoom.us, con la cuenta dueña de las grabaciones: "Develop" → "Build App" → "Server-to-Server OAuth".',
        'En "Scopes" suma los de grabaciones en la nube ("cloud_recording:read") y los de reuniones pasadas.',
        'Copia "Account ID", "Client ID" y "Client Secret" de "App Credentials" en sus campos.',
        'Activa la app con "Activate": sin eso, Zoom no entrega el permiso.',
      ],
    },
  },
  {
    key: 'otter',
    nombre: 'Otter.ai',
    categoria: 'Reuniones',
    paraQue: 'MaKo lee tus conversaciones de Otter cada hora: saca las tareas al Plan y analiza las llamadas de venta.',
    campos: [
      { env: 'OTTER_API_KEY', label: 'API key', secreto: true, nota: 'Sólo existe en el plan Enterprise de Otter. Con ella MaKo trae tus conversaciones.' },
    ],
    tutorial: {
      pasos: [
        'En otter.ai, con una cuenta del plan Enterprise: "Integrations" → pestaña "Developer".',
        'Toca "Create key" y copia la key: se ve UNA vez (puedes tener hasta 2).',
        'Pégala en "API key": MaKo lee tus conversaciones en la vuelta de cada hora.',
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
  // Los otros alojadores de video (25/10/2026, lib/alojadores-video.ts). Cada clave alcanza para LEER la lista de videos:
  // ninguna pide permiso de escribir.
  {
    key: 'pexels',
    nombre: 'Pexels',
    categoria: 'Datos',
    // El B-roll del Video Editor (lib/pexels.ts): la licencia de Pexels deja el uso comercial, y cada negocio usa SU
    // clave (el límite de 200 búsquedas por hora es de su cuenta). Gratis.
    paraQue: 'Fotos con licencia para el B-roll de tus videos: MaKo propone cuáles y dónde, y tú eliges.',
    campos: [
      { env: 'PEXELS_API_KEY', label: 'API key', secreto: true, placeholder: 'abc123…', nota: 'Gratis. Está en pexels.com/api, con tu cuenta de Pexels.' },
    ],
    tutorial: {
      url: 'https://www.pexels.com/api/',
      urlLabel: 'Pexels → API',
      pasos: [
        'Entra a pexels.com/api con tu cuenta de Pexels (crearla es gratis).',
        'Toca «Your API Key», completa para qué la usas (por ejemplo «videos de mi negocio») y acepta.',
        'Copia la key que aparece y pégala en "API key".',
      ],
    },
  },
  {
    key: 'vimeo',
    nombre: 'Vimeo',
    categoria: 'Datos',
    paraQue: 'Tus videos de Vimeo, para elegirlos en tus páginas y tus cursos.',
    campos: [
      { env: 'VIMEO_TOKEN', label: 'Token de acceso', secreto: true, placeholder: 'abc123…', nota: 'En developer.vimeo.com/apps → tu app → "Generate an access token", con "Public" y "Private".' },
    ],
    tutorial: {
      url: 'https://developer.vimeo.com/apps',
      urlLabel: 'Vimeo → Developer → My Apps',
      pasos: [
        'En developer.vimeo.com/apps toca "Create an app" (un nombre y una descripción cualquiera alcanzan).',
        'Adentro de la app, en "Generate an access token", elige "Authenticated (you)".',
        'Marca "Public" y "Private" (así se ven también tus videos no listados) y toca "Generate".',
        'Copia el token y pégalo en "Token de acceso". Vimeo lo muestra UNA vez.',
      ],
    },
  },
  {
    key: 'wistia',
    nombre: 'Wistia',
    categoria: 'Datos',
    paraQue: 'Tus videos de Wistia y cuántas veces los reproducen por día.',
    campos: [
      { env: 'WISTIA_TOKEN', label: 'Token de API', secreto: true, placeholder: 'abc123…', nota: 'En Wistia → "Account" → "Settings" → "API Access" → "Create a new token", con "Read all data".' },
    ],
    tutorial: {
      url: 'https://account.wistia.com/account/api',
      urlLabel: 'Wistia → Settings → API Access',
      pasos: [
        'En Wistia abre "Account" → "Settings" → "API Access".',
        'Toca "Create a new token" y marca "Read all data" (y "Read detailed stats", para los números por día).',
        'Copia el token y pégalo en "Token de API".',
      ],
    },
  },
  {
    key: 'bunny',
    nombre: 'Bunny Stream',
    categoria: 'Datos',
    paraQue: 'Tus videos de Bunny Stream y cuántas veces los reproducen por día.',
    campos: [
      { env: 'BUNNY_STREAM_KEY', label: 'API key de la biblioteca', secreto: true, placeholder: 'xxxxxxxx-xxxx-…', nota: 'En dash.bunny.net → "Stream" → tu biblioteca → "API". Es la de la BIBLIOTECA, no la de tu cuenta.' },
      { env: 'BUNNY_STREAM_LIBRARY', label: 'Library ID', placeholder: '123456', nota: 'El número de tu biblioteca, en la misma pantalla "API" (también va en el link de cada video: /embed/<Library ID>/…).' },
    ],
    tutorial: {
      url: 'https://dash.bunny.net/stream',
      urlLabel: 'Bunny → Stream → tu biblioteca → API',
      pasos: [
        'En dash.bunny.net abre "Stream" y entra a la biblioteca donde están tus videos.',
        'En el menú de la biblioteca toca "API".',
        'Copia "API Key" y pégala en "API key de la biblioteca".',
        'Copia "Video Library ID" y pégalo en "Library ID".',
      ],
    },
  },
  {
    key: 'cloudflare',
    nombre: 'Cloudflare Stream',
    categoria: 'Datos',
    paraQue: 'Tus videos de Cloudflare Stream, para elegirlos en tus páginas y tus cursos.',
    campos: [
      { env: 'CLOUDFLARE_STREAM_TOKEN', label: 'Token de API', secreto: true, placeholder: 'abc123…', nota: 'En dash.cloudflare.com → "My Profile" → "API Tokens" → "Create Token", con el permiso "Account" → "Stream" → "Read".' },
      { env: 'CLOUDFLARE_ACCOUNT_ID', label: 'Account ID', placeholder: '32 letras y números', nota: 'En el panel de Cloudflare, en "Stream": la columna de la derecha dice "Account ID".' },
    ],
    tutorial: {
      url: 'https://dash.cloudflare.com/profile/api-tokens',
      urlLabel: 'Cloudflare → My Profile → API Tokens',
      pasos: [
        'En dash.cloudflare.com abre "My Profile" → "API Tokens" → "Create Token" → "Create Custom Token".',
        'En "Permissions" elige "Account" → "Stream" → "Read", y toca "Continue to summary" → "Create Token".',
        'Copia el token y pégalo en "Token de API". Cloudflare lo muestra UNA vez.',
        'En el panel, entra a "Stream": copia el "Account ID" de la columna de la derecha y pégalo en "Account ID".',
      ],
    },
  },
  {
    key: 'youtube',
    nombre: 'YouTube',
    categoria: 'Datos',
    paraQue: 'Sólo para contar las vistas de TU VSL, si vive en YouTube. Para leer a tus competidores no hace falta nada, y tu canal se conecta en Zernio.',
    campos: [
      // La clave ya NO se pide (27/10/2026, pedido del Cerebro, feedback 876470842-22): las vistas de un video son públicas y
      // MaKo las lee con la suya (`claveDeYoutube`, lib/youtube.ts), y el canal se conecta con el login de Zernio
      // (lib/zernio-redes.ts). «Conectado» pasa a ser tener el video del VSL; quien ya tenía su clave la sigue usando.
      { env: 'YOUTUBE_API_KEY', label: 'Tu API key (no hace falta)', secreto: true, opcional: true, retirado: true, placeholder: 'AIza…', nota: 'MaKo lee YouTube con su clave. Déjala sólo si quieres usar tu propia cuota.' },
      { env: 'YOUTUBE_VSL_VIDEO_ID', label: 'ID del video del VSL', placeholder: 'dQw4w9WgXcQ', nota: 'Lo que va después de v= en youtube.com/watch?v=ESTO, o de la barra en youtu.be/ESTO. Si hay un &, corta ahí.' },
      { env: 'YOUTUBE_OAUTH_CLIENT_ID', label: 'OAuth Client ID', opcional: true, placeholder: '…apps.googleusercontent.com', nota: 'Opcional: déjalo vacío. Solo hace falta para la retención y las vistas diarias de TU canal.' },
      { env: 'YOUTUBE_OAUTH_CLIENT_SECRET', label: 'OAuth Client secret', secreto: true, opcional: true, placeholder: 'GOCSPX-…', nota: 'Opcional. Va de a pares con el "OAuth Client ID". Empieza con GOCSPX- y se ve UNA sola vez.' },
      { env: 'YOUTUBE_OAUTH_REFRESH_TOKEN', label: 'OAuth Refresh token', secreto: true, opcional: true, nota: 'Opcional: el permiso para leer las estadísticas de tu canal, del OAuth Playground de Google. Si no, vacío.' },
    ],
    tutorial: {
      url: 'https://studio.youtube.com',
      urlLabel: 'YouTube Studio',
      pasos: [
        'Abre tu video del VSL en YouTube y copia lo que sigue a v= en su dirección.',
        'Pégalo en "ID del video del VSL" y guarda: MaKo lee sus vistas cada día, sin claves.',
        'Para conectar tu canal: en la tarjeta de Zernio, en "YouTube", toca "Conectar" y entra con Google.',
        'Los tres campos "OAuth" son opcionales: solo dan la retención de tu canal. Déjalos vacíos.',
      ],
    },
  },
  {
    key: 'apify-instagram',
    nombre: 'Apify',
    categoria: 'Datos',
    paraQue: 'Lee el perfil y las publicaciones públicas de los competidores que miras en Competitors Spy, cuando Meta no puede. Corre con tu cuenta.',
    campos: [
      { env: 'APIFY_INSTAGRAM_TOKEN', label: 'API token', secreto: true, placeholder: 'apify_api_…', nota: 'Es TU cuenta: Apify cobra por perfil leído. MaKo la usa sólo para Competitors Spy, con un tope de 40 lecturas por día.' },
      // VARIAS CLAVES (5/11/2026, Martín: «Dame la opción de tener varias claves de apify» y «dame la opción también en integraciones
      // de cargar más api»). El patrón de Zernio y de las cuentas de IA: la 1 sigue siendo la que conecta la tarjeta; las extra son
      // `opcional`, de OTRA cuenta de Apify del negocio, y MaKo pasa a la siguiente cuando una se queda sin crédito
      // (lib/spy-claves.ts). Cada una lleva un nombre opcional para reconocerla (no es secreto; no se usa para nada más).
      ...CLAVES_APIFY_DE_SPY.flatMap((env): CampoCredencial[] => {
        const n = slotDeClaveApify(env) ?? 1;
        const nombre: CampoCredencial = {
          env: nombreDeClaveApify(env), label: `Nombre de la clave ${n}`, secreto: false, opcional: true, slot: n,
          placeholder: n === 1 ? 'Mi cuenta' : 'Otra cuenta', nota: 'Para reconocerla de un vistazo. No se usa para nada más.',
        };
        if (n === 1) return [nombre];
        return [
          { env, label: `API token ${n}`, secreto: true, opcional: true, slot: n, placeholder: 'apify_api_…',
            nota: 'De OTRA cuenta de Apify tuya: cuando una se queda sin crédito, MaKo sigue con la siguiente.' },
          nombre,
        ];
      }),
    ],
    tutorial: {
      url: 'https://console.apify.com/settings/integrations',
      urlLabel: 'Apify → Settings → API & Integrations',
      pasos: [
        'Entra a console.apify.com con tu cuenta. El plan gratis alcanza para empezar.',
        'Ve a «Settings» → «API & Integrations» y copia tu «Personal API token» (empieza con apify_api_).',
        'Pégalo en "API token" y guarda. MaKo comprueba que funcione sin gastar nada.',
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
        'Permisos "Write": Checkout Sessions, Webhook Endpoints, Refunds, Subscriptions y Coupons.',
        'Permisos "Read": Invoices, Charges, Payment Intents, Disputes, Prices, Products y Accounts. Lo demás, en "None".',
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
  {
    key: 'creem',
    nombre: 'Creem',
    categoria: 'Pagos',
    paraQue: 'Cobrar en dólares en todo el mundo con los impuestos resueltos: Creem cobra y paga el impuesto de cada país por ti, y te da la factura que cumple.',
    campos: [
      { env: 'CREEM_API_KEY', label: 'Clave de Creem', secreto: true, placeholder: 'creem_…', nota: 'Lo único que pegas: la clave de API de producción (creem_…). Con ella MaKo registra el aviso de pagos en tu cuenta.' },
      { env: 'CREEM_WEBHOOK_ID', label: 'ID del aviso', auto: true, derivado: true, placeholder: 'wh_…', nota: 'Lo completa MaKo al registrar el aviso; no se escribe a mano. Sin esto, tus pagos no entran a tu CRM.' },
      { env: 'CREEM_WEBHOOK_SECRET', label: 'Firma del aviso de pagos', secreto: true, auto: true, derivado: true, placeholder: 'whsec_…', nota: 'La da Creem cuando MaKo registra el aviso; no se escribe a mano. Sin esto, MaKo rechaza todos los avisos de pago.' },
    ],
    // Sin pasoExterno A PROPÓSITO, como Stripe y al revés que Mercado Pago: el aviso lo registra MaKo con la clave
    // (`asegurarWebhookCreem`), y Creem devuelve su secreto por API — `POST /v1/webhooks` lo da una vez y
    // `GET /v1/webhooks/{id}/secret` lo vuelve a dar. Pedirle a la persona que copie un secreto que la API ya entrega
    // era pedirle un paso de más y una forma de pegarlo mal.
    tutorial: {
      url: 'https://creem.io/dashboard/developers',
      urlLabel: 'Creem → Developers',
      // SIN «Para qué sirve» de primer paso, igual que Stripe y Mercado Pago (31/10/2026): el para qué del SERVICIO lo
      // dice `paraQue` acá arriba, y el de la clave lo dice AYUDA_CAMPO.CREEM_API_KEY —donde el test SÍ lo exige y donde
      // esta misma línea sigue estando. Acá era un paso de más: se entra por la acción.
      pasos: [
        'Entra a creem.io/dashboard/developers con la cuenta donde quieres recibir el dinero.',
        'En "API Keys" copia la clave de producción (empieza con creem_) y pégala en "Clave de Creem".',
        'Eso es todo: MaKo registra solo el aviso de pagos y guarda su firma.',
        'Para probar sin dinero real, usa una clave de test (creem_test_…): Creem las separa por completo de las reales.',
      ],
    },
  },
  // ⚠️ ACÁ ESTABAN Hotmart, Skool y Apify (el Leads Scraper): se fueron el 25/10/2026 sin una sola clave guardada en
  // producción. Ver tests/leads-scraper-retirado.test.ts.
  // Google NO va acá, por lo mismo que Supabase: GOOGLE_CLIENT_ID/SECRET son la
  // app OAuth de la AGENCIA (login + Google Calendar), infra compartida de la
  // plataforma. Un cliente jamás crea su propia app OAuth ni pisa estas
  // credenciales: conecta su agenda AUTORIZANDO (el botón "Conectar Google Calendar" del
  // modal, en Calendario y el CRM; al entrar con Google sólo con GOOGLE_LOGIN_CON_AGENDA=1,
  // lib/google-login-agenda.ts). Sigue en lib/integraciones.ts
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
        'Normalmente lo elige MaKo al conectar «Anuncios de Meta» en la tarjeta de Zernio; con varias cuentas, eliges una ahí.',
        'A mano: en adsmanager.facebook.com, el número largo junto al nombre de la cuenta, arriba a la izquierda.',
        'Escríbelo con act_ adelante y sin espacios (act_1234567890): sin el act_, el tablero queda en blanco.',
      ],
    url: 'https://adsmanager.facebook.com/adsmanager',
    urlLabel: 'Administrador de anuncios',
  },
  META_PAGE_ACCESS_TOKEN: {
    pasos: [
        'Para qué sirve: ya no se usa. Traía los contactos de tus formularios con la conexión de antes.',
        'No se pide: esos contactos llegan por Zernio.',
        'Para recibirlos, conecta «Anuncios de Meta» en la tarjeta de Zernio con la página de tus formularios.',
      ],
    url: 'https://business.facebook.com/settings',
    urlLabel: 'Configuración del negocio en Meta',
  },
  META_PIXEL_ID: {
    pasos: [
        'Para qué sirve: con el píxel, MaKo le devuelve a Meta las ventas que se cierran fuera de la web.',
        'Normalmente lo completa MaKo al conectar «Anuncios de Meta» en Zernio; con varios píxeles, eliges uno ahí.',
        'A mano: en business.facebook.com/events_manager2 ("Administrador de eventos") toca tu píxel y copia su número.',
        'Pégalo aquí, solo dígitos. Si no tienes píxel, déjalo vacío: MaKo funciona igual.',
        'Si tu página ya manda "Schedule" con el píxel, MaKo no lo repite: así Meta no lo cuenta dos veces.',
      ],
    url: 'https://business.facebook.com/events_manager2',
    urlLabel: 'Administrador de eventos',
  },
  // CAPI: el botón "Generar token de acceso" de Events Manager arma por detrás un
  // token con ads_management sobre ese píxel — no es un tipo especial de token.
  // Desde el 25/10/2026 (el token de Meta deprecado, Meta por Zernio) es la salida de
  // CAPI cuando la conexión de Facebook por Zernio no llega al píxel. Los pasos, de la
  // doc de Meta (conversions-api/get-started, leída el 25/10/2026); el detalle con la
  // deduplicación, en docs/tutorial-capi-pixel.md.
  META_CAPI_TOKEN: {
    pasos: [
        'Para qué sirve: ya no se usa. Mandaba tus contactos y agendas a tu píxel con la conexión de antes.',
        'No se pide: las conversiones salen por tu conexión de Zernio («Anuncios de Meta»).',
        'Si no llegan, en Meta dale a esa cuenta publicitaria acceso a tu píxel y vuelve a conectar en Zernio.',
      ],
    url: 'https://business.facebook.com/events_manager2',
    urlLabel: 'Administrador de eventos',
  },
  // La conexión de Zernio (25/10/2026): no se pega, la escribe MaKo al conectar con Facebook (`derivado`).
  META_ZERNIO_CUENTA: {
    pasos: [
        'Para qué sirve: con esta conexión MaKo lee tus métricas y publica tus anuncios, sin pedirte nada de Meta.',
        'No la escribes tú: en la tarjeta de Zernio, paso 2, «Anuncios de Meta» → "Conectar con Facebook".',
        'En la ventana de Facebook elige tu negocio, tu página y tu cuenta publicitaria, y acepta.',
      ],
    url: 'https://zernio.com',
    urlLabel: 'Zernio',
  },
  META_PAGE_ID: {
    pasos: [
        'Para qué sirve: sin esto, quien deja su teléfono en tus formularios de Facebook e Instagram no llega a ningún lado.',
        'Lo completa MaKo al conectar «Anuncios de Meta» en la tarjeta de Zernio; con varias páginas, eliges la de tus anuncios.',
        'Si quedó vacío, vuelve a conectar ahí y elige la página en la ventana de Facebook.',
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
        'Entra a resend.com (la cuenta es gratis) → "API Keys" y toca "Create API Key".',
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
        'Para qué sirve: con esta key MaKo escribe y analiza con Claude antes que con la IA gratis.',
        '¿Tienes Claude Max hace 7 días o más? En claude.ai → Settings → Billing → "API credits", vincula tu organización.',
        'Con Pro o sin Max: en platform.claude.com → "Billing" carga saldo con "Add funds" (mínimo 5 dólares).',
        'En platform.claude.com → "API Keys" toca "Create Key" y copia la key (sk-ant-…, se ve UNA vez).',
        'Pégala en este campo y guarda. Max 5x trae 100 dólares por mes y Max 20x, 200; no se acumulan.',
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
        'Para qué sirve: es tu IA. Con esta key MaKo contesta, lee documentos largos y busca en tu conocimiento con tu cuenta.',
        'Entra a aistudio.google.com/apikey con tu cuenta de Google (para "API key 2", con OTRA cuenta).',
        'Ojo: en el plan gratis Google entrena con tus textos. Para evitarlo: "Billing Tier" → "Set up billing" (10 dólares).',
        'Toca "Create API key" con cualquier proyecto de Google Cloud y copia la key (empieza con AQ.).',
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
  // Los grabadores (26/10/2026): «qué pongo ACÁ» en los campos que no son la API key.
  TLDV_HOST_EMAIL: {
    pasos: [
        'Para qué sirve: le dice a MaKo que la reunión es tuya. Sin esto, el aviso de tl;dv se descarta sin error.',
        'Escribe el correo de la cuenta de tl;dv que organiza las reuniones: el mismo con el que entras a tldv.io.',
        'Escríbelo tal cual, sin espacios. Las mayúsculas no importan.',
      ],
  },
  FIREFLIES_WEBHOOK_SECRET: {
    pasos: [
        'Para qué sirve: tus reuniones llegan apenas Fireflies termina de transcribir, y no en la vuelta de cada hora.',
        'En app.fireflies.ai: "Integrations" → "Webhooks". Pega la dirección del recuadro amarillo.',
        'En "Signing Secret" escribe una contraseña larga, y escribe la MISMA en este campo.',
      ],
    url: 'https://app.fireflies.ai/integrations/api/webhook',
    urlLabel: 'Fireflies → Webhooks',
  },
  ZOOM_WEBHOOK_SECRET: {
    pasos: [
        'Para qué sirve: tus grabaciones llegan apenas Zoom termina la transcripción.',
        'En marketplace.zoom.us, tu app → "Feature": copia el "Secret Token" y pégalo en este campo.',
        'Guárdalo ANTES de pegar la dirección en Zoom: Zoom la valida en el momento, con este token.',
      ],
    url: 'https://marketplace.zoom.us/user/build',
    urlLabel: 'Zoom → tus apps',
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
        'Va como usuario/repositorio: de github.com/koncke/mako, koncke/mako.',
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
  // ⚠️ LOS PERMISOS SON LOS QUE EL CÓDIGO USA (revisión del 23/10/2026): Coupons (la retención de un plan), Disputes (los
  // contracargos) y Prices/Products («Vincular cobro») no estaban, y una rk_ armada con la lista vieja conectaba bien y
  // fallaba después, con un 403, en la retención o en un contracargo. Una clave nueva que use otro recurso se suma acá.
  STRIPE_SECRET_KEY: {
    pasos: [
        'Para qué sirve: con esta clave MaKo crea tus links de pago y anota cada pago en la ficha del lead.',
        'En dashboard.stripe.com/apikeys toca "Create restricted key" y ponle de nombre MaKo.',
        'Permisos "Write": Checkout Sessions, Webhook Endpoints, Refunds, Subscriptions y Coupons.',
        'Permisos "Read": Invoices, Charges, Payment Intents, Disputes, Prices, Products y Accounts. Lo demás, en "None".',
        'Toca "Create key", copia la clave (rk_live_…, se ve UNA vez) y pégala en este campo.',
      ],
    url: 'https://dashboard.stripe.com/apikeys',
    urlLabel: 'Stripe → API keys',
  },
  APNS_KEY_ID: {
    pasos: [
        'Para qué sirve: junto con el Team ID y la clave .p8, es lo que le permite a MaKo avisar en un iPhone.',
        'Entra a developer.apple.com/account/resources/authkeys/list y abre la clave «MaKo push».',
        'Copia el «Key ID», los 10 caracteres de esa pantalla, y pégalo en este campo.',
      ],
    url: 'https://developer.apple.com/account/resources/authkeys/list',
    urlLabel: 'Apple Developer → Keys',
  },
  APNS_TEAM_ID: {
    pasos: [
        'Para qué sirve: le dice a Apple de qué cuenta de desarrollador sale el aviso.',
        'Entra a developer.apple.com/account y baja hasta «Membership details».',
        'Copia el «Team ID», los 10 caracteres, y pégalo en este campo.',
      ],
    url: 'https://developer.apple.com/account',
    urlLabel: 'Apple Developer → Membership',
  },
  APNS_P8: {
    pasos: [
        'Para qué sirve: es la clave con la que MaKo firma cada aviso a un iPhone.',
        'Abre con el Bloc de notas el archivo .p8 que bajaste al crear la clave.',
        'Copia todo, desde -----BEGIN hasta -----END, y pégalo en este campo.',
      ],
    url: 'https://developer.apple.com/account/resources/authkeys/list',
    urlLabel: 'Apple Developer → Keys',
  },
  ASC_ISSUER_ID: {
    pasos: [
        'Para qué sirve: le dice a Apple de qué equipo es la clave con la que MaKo mira la app de iPhone.',
        'Entra a App Store Connect, abre «Usuarios y acceso» y su pestaña «Integraciones».',
        'Copia el «Issuer ID», arriba de la lista de claves, y pégalo en este campo.',
      ],
    url: 'https://appstoreconnect.apple.com/access/integrations/api',
    urlLabel: 'App Store Connect → Integraciones',
  },
  TIENDAS_GOOGLE_CUENTA_SERVICIO: {
    pasos: [
        'Para qué sirve: con esta cuenta MaKo lee, sin publicar nada, en qué está la app de Android y la extensión.',
        'En Google Cloud, en «Cuentas de servicio», abre «MaKo vigía» y su pestaña «Claves».',
        'Toca «Agregar clave» › «JSON»: se baja un archivo.',
        'Abre ese archivo con el Bloc de notas y pega todo en este campo.',
      ],
    url: 'https://console.cloud.google.com/iam-admin/serviceaccounts?project=mako-500317',
    urlLabel: 'Google Cloud → Cuentas de servicio',
  },
  CREEM_API_KEY: {
    pasos: [
        'Para qué sirve: con esta clave MaKo crea tus links de pago en Creem y anota cada cobro en la ficha del lead.',
        'En creem.io/dashboard/developers abre "API Keys".',
        'Copia la clave de producción (empieza con creem_) y pégala en este campo.',
        'MaKo registra solo el aviso de pagos y guarda su firma: no hay ningún paso más.',
      ],
    url: 'https://creem.io/dashboard/developers',
    urlLabel: 'Creem → Developers',
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
        'En la URL de producción pega la dirección completa del recuadro amarillo (termina en ?u= y tu número).',
        'Marca los eventos "Pagos" y "Planes y suscripciones" y guarda.',
        'Copia la "clave secreta" que aparece y pégala en este campo.',
      ],
    url: 'https://www.mercadopago.com/developers/panel/app',
    urlLabel: 'Mercado Pago → Tus integraciones',
  },
  // Los alojadores de video con DOS campos (25/10/2026): la ayuda del servicio dice cómo conectarlo; la de cada campo,
  // qué va EN ese campo (tests/tutoriales-legibles.test.ts).
  BUNNY_STREAM_KEY: {
    pasos: [
        'Para qué sirve: con esta clave MaKo lista los videos de tu biblioteca y trae cuántas veces los reproducen por día.',
        'En dash.bunny.net abre "Stream" y entra a la biblioteca donde están tus videos.',
        'En el menú de la biblioteca toca "API" y copia "API Key". Es la de la BIBLIOTECA, no la de tu cuenta.',
      ],
    url: 'https://dash.bunny.net/stream',
    urlLabel: 'Bunny → Stream → tu biblioteca → API',
  },
  BUNNY_STREAM_LIBRARY: {
    pasos: [
        'Para qué sirve: le dice a MaKo cuál de tus bibliotecas de Bunny tiene los videos.',
        'En la misma pantalla "API" de tu biblioteca, copia "Video Library ID": es un número.',
        'También está en el link de cada video: /embed/<este número>/…',
      ],
    url: 'https://dash.bunny.net/stream',
    urlLabel: 'Bunny → Stream → tu biblioteca → API',
  },
  CLOUDFLARE_STREAM_TOKEN: {
    pasos: [
        'Para qué sirve: con este token MaKo lista tus videos de Cloudflare Stream para elegirlos en tus páginas y tus cursos.',
        'En dash.cloudflare.com abre "My Profile" → "API Tokens" → "Create Token" → "Create Custom Token".',
        'En "Permissions" elige "Account" → "Stream" → "Read", crea el token y cópialo: Cloudflare lo muestra una sola vez.',
      ],
    url: 'https://dash.cloudflare.com/profile/api-tokens',
    urlLabel: 'Cloudflare → My Profile → API Tokens',
  },
  CLOUDFLARE_ACCOUNT_ID: {
    pasos: [
        'Para qué sirve: le dice a MaKo en qué cuenta de Cloudflare están tus videos.',
        'En el panel de Cloudflare entra a "Stream".',
        'En la columna de la derecha copia "Account ID": son 32 letras y números.',
      ],
    url: 'https://dash.cloudflare.com',
    urlLabel: 'Cloudflare → Stream',
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
