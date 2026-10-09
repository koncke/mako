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
      nota: 'De OTRA cuenta del mismo proveedor. Cuando la anterior se queda sin cuota, MaKo sigue con esta sin que tengas que hacer nada.',
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
      { env: 'META_ACCESS_TOKEN', label: 'Access token', secreto: true, placeholder: 'EAAG…', nota: 'Es lo único que tienes que pegar. Tiene que ser el token de un "usuario del sistema", con vencimiento "Nunca" y los 8 permisos del tutorial. Con ese solo dato MaKo completa los demás campos.' },
      { env: 'META_AD_ACCOUNT_ID', label: 'ID de cuenta publicitaria', auto: true, placeholder: 'act_1234567890', nota: 'Lo completa MaKo al pegar el token, y si tienes más de una cuenta publicitaria te muestra la lista para que elijas cuál. Si lo escribes a mano, va con el prefijo act_ adelante.' },
      { env: 'META_PAGE_ACCESS_TOKEN', label: 'Token de la página', secreto: true, opcional: true, auto: true, placeholder: 'EAAG…', nota: 'Lo saca MaKo del token del campo "Access token". Es lo que permite traer los datos de las personas que dejan su contacto en tus formularios de Facebook e Instagram.' },
      { env: 'META_PIXEL_ID', label: 'ID del píxel', opcional: true, auto: true, placeholder: '1234567890', nota: 'Lo completa MaKo al pegar el token. El píxel es el medidor que Meta pone en tu página web para saber qué anuncio trajo cada venta. Si tienes más de uno, MaKo te pregunta cuál.' },
      { env: 'META_CAPI_TOKEN', label: 'Token de Conversions API', secreto: true, opcional: true, auto: true, placeholder: 'EAAG…', nota: 'Déjalo vacío. MaKo ya manda esas mediciones con el token del campo "Access token". Solo hace falta en un caso raro: que tu píxel viva en otro negocio de Meta que no puedas asignarle a tu usuario del sistema.' },
      { env: 'META_PAGE_ID', label: 'ID de tu página de Facebook', opcional: true, auto: true, placeholder: '1234567890', nota: 'Lo completa MaKo al pegar el token. Es lo que hace que los contactos de tus formularios de Facebook e Instagram lleguen a tu cuenta y no se pierdan.' },
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
      { env: 'META_CRM_DATASET_ID', label: 'ID del conjunto de datos de CRM', opcional: true, placeholder: '1234567890', nota: 'Opcional, y el único dato de Meta que MaKo no puede completar sola: hay que crearlo una vez en el Administrador de eventos. Sirve para que Meta busque contactos que CALIFIQUEN y no solo contactos. Los pasos están en el "?" de este campo. Sin esto todo lo demás sigue igual.' },
    ],
    tutorial: {
      url: 'https://business.facebook.com/settings',
      urlLabel: 'Configuración del negocio en Meta',
      pasos: [
        'Para qué sirve: ves tu gasto, tus resultados y la salud de tu cuenta de anuncios aquí adentro, y puedes crear y pausar campañas sin entrar a Meta. Se hace una sola vez y toma unos 10 minutos.',
        'Antes de empezar: tienes que ser administrador del negocio en Meta — el "portafolio comercial", que es la cuenta donde viven tu página y tu cuenta publicitaria. Si en los pasos de abajo no ves las opciones que se nombran, no eres administrador: pídeselo a quien administra la cuenta.',
        'Entra a business.facebook.com/settings. Es la pantalla de "Configuración del negocio", distinta del administrador de anuncios donde ves tus campañas.',
        'Abre el menú de secciones —en la computadora es la columna de la izquierda; en el celular, el botón de las tres rayitas de arriba—, entra a "Cuentas" y toca "Apps".',
        'Una "app" aquí es solo un permiso con nombre que Meta te obliga a tener para entregarte el token: no se publica, no la busca nadie y ningún cliente tuyo la ve.',
        'Si ya hay una app en esa lista, anota su nombre —lo vas a necesitar más adelante— y omite los cuatro pasos de crear una que vienen ahora.',
        'Si la lista está vacía hay que crear una. Toca "Agregar" y elige "Crear un ID de app nueva": eso te lleva a otro sitio de Meta, developers.facebook.com, pensado para programadores. Solo vas a poner un nombre.',
        'Si es tu primera vez ahí, Meta te pide aceptar sus condiciones y verificar tu cuenta con un código por teléfono o por correo. Es un trámite de una sola vez.',
        'Ponle un nombre —"MaKo" sirve— y anótalo. Si te pregunta para qué la vas a usar, elige la opción relacionada con anuncios o con administrar tu negocio; si te pregunta el tipo, elige "Negocio".',
        'Créala y vuelve a business.facebook.com/settings. Comprueba que ahora sí aparezca en "Cuentas" → "Apps": si no aparece ahí, más adelante el menú para elegirla va a salir vacío.',
        'En ese mismo menú de secciones, entra a "Usuarios" y toca "Usuarios del sistema".',
        'Un "usuario del sistema" no es una persona: es un usuario automático que Meta crea para que los programas entren en tu lugar. Se usa para que la conexión no se caiga si cambias tu contraseña o si alguien sale de tu equipo.',
        'Toca "Agregar" (en algunas cuentas dice "Agregar nuevo usuario del sistema").',
        'Ponle un nombre —"MaKo" está bien—, elige el tipo "Administrador" y confirma con "Crear usuario del sistema". Si tu cuenta solo te deja elegir "Normal", también funciona, siempre que le des "Control total" a cada cosa en los pasos que siguen.',
        'Toca el nombre del usuario que acabas de crear y después el botón "Agregar activos". Un "activo" es cada cosa de tu negocio en Meta: tu cuenta publicitaria, tu página, tu píxel, tu app.',
        'Entra a la pestaña "Cuentas publicitarias", marca la tuya, activa "Control total" y guarda.',
        'Vuelve a "Agregar activos" y entra a la pestaña "Páginas": marca tu página de Facebook, activa "Control total" y guarda. Esto es lo que hace que los contactos de tus formularios lleguen a tu cuenta.',
        'Vuelve otra vez y busca tu píxel: según la cuenta, está bajo "Orígenes de datos" o bajo "Píxeles". Márcalo, activa "Control total" y guarda. El píxel es el medidor que Meta pone en tu página web para saber qué anuncio trajo cada venta. Si todavía no tienes uno, omite este paso: MaKo funciona igual, sin las métricas de la web.',
        'Vuelve una última vez y entra a la pestaña "Apps": marca la app cuyo nombre anotaste, activa "Administrar app" y guarda. Este paso se olvida siempre, y es el que hace que después el token no se pueda generar.',
        'Cierra la ventana de "Agregar activos". Vuelves a la ficha de tu usuario del sistema, donde ahora se ve listado todo lo que le asignaste.',
        'Ahí mismo, toca "Generar nuevo token".',
        'Elige tu app en el menú desplegable. Si el menú sale vacío, es porque la app no está agregada al negocio: vuelve a "Cuentas" → "Apps" y agrégala antes de seguir.',
        'En "Vencimiento del token" elige "Nunca". Si eliges "60 días", la conexión se corta sola a los dos meses y hay que repetir todo esto.',
        'Más abajo aparece una lista larga de casillas: son los permisos, o sea lo que le estás dejando hacer a MaKo con tu cuenta. Cada uno abre una parte del tablero: si falta uno, esa parte queda vacía.',
        'Arriba de esa lista hay un buscador. Copia el primero de estos ocho nombres, pégalo en el buscador y marca la casilla del resultado que diga EXACTAMENTE ese nombre: ads_read, ads_management, business_management, pages_show_list, pages_read_engagement, pages_manage_ads, leads_retrieval, pages_manage_metadata.',
        'Repite con los ocho, uno por uno. Van los ocho, ni uno menos: si falta alguno, una parte del tablero queda en blanco y no te dice cuál faltó. Al terminar, borra lo que quede escrito en el buscador para ver todo lo que marcaste.',
        'Toca "Generar token".',
        'Copia el código que aparece —empieza con "EAA"— y pégalo en el campo "Access token". Cópialo ahora: se muestra UNA sola vez y no hay forma de volver a verlo. Si lo pierdes, no pasa nada grave: generas otro con "Generar nuevo token", en la ficha de tu usuario del sistema.',
        'Guarda, y listo. MaKo va a buscar sola tu cuenta publicitaria, tu página y tu píxel, y completa los demás campos por ti. Si tienes más de una cuenta, más de una página o más de un píxel, te muestra la lista para que elijas cuál.',
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
        nota: 'Opcional. Con tu propia key, el consumo se factura a tu cuenta de Zernio. Zernio incluye 2 cuentas conectadas; desde la 3.ª cobra por cada una.' },
    ],
    tutorial: {
      url: 'https://zernio.com',
      urlLabel: 'Zernio',
      pasos: [
        'Para qué sirve: para que el consumo de tu Instagram y tu Messenger se facture a tu propia cuenta de Zernio en vez de a la de la plataforma. Es opcional.',
        'Zernio es el servicio que conecta Instagram y Facebook por detrás; por eso aparece su nombre aquí.',
        'Entra a zernio.com y crea una cuenta, o entra a la tuya si ya la tienes.',
        'Ya dentro de Zernio, abre "Settings" (el panel está en inglés) y toca "API Keys".',
        'Toca "Create API Key" y copia la key en ese mismo momento: se muestra UNA sola vez.',
        'Pégala en el campo "API key de Zernio" y guarda.',
        'Después, en una automatización, agrega una tarjeta de Instagram o de Messenger y toca "Conectar". Tiene que ser una cuenta de empresa o de creador: Instagram no deja que un programa responda desde una cuenta personal.',
      ],
    },
  },
  {
    key: 'email',
    nombre: 'Email (Resend)',
    categoria: 'Mensajería',
    paraQue: 'Envío de emails de nutrición, broadcasts y reportes.',
    campos: [
      { env: 'RESEND_API_KEY', label: 'API key', secreto: true, placeholder: 're_…', nota: 'Empieza con re_. Se saca en resend.com → "API Keys" → "Create API Key", con el permiso "Full access". Se muestra UNA sola vez.' },
      { env: 'RESEND_FROM', label: 'Remitente', opcional: true, sinEsto: 'Sin remitente, tus correos solo te llegan a ti.', placeholder: 'Tu negocio <hola@tudominio.com>', nota:'Tu nombre, un espacio y tu correo entre < >. Por ejemplo: Tu negocio <hola@tunegocio.com>. El dominio (lo que va después de la arroba) tiene que estar verificado en Resend, o el envío falla.' },
    ],
    tutorial: {
      url: 'https://resend.com/domains',
      urlLabel: 'Resend → Domains',
      pasos: [
        'Para qué sirve: MaKo manda los correos de seguimiento y los reportes desde tu propia dirección, para que a tu cliente le llegue de ti y no de un desconocido.',
        'Entra a resend.com y crea una cuenta.',
        'El plan gratis manda hasta 100 correos por día (3.000 al mes) desde un solo dominio: alcanza de sobra para los seguimientos uno a uno y para los reportes. Si vas a mandarle lo mismo a toda tu lista de golpe y son más de 100, ahí sí hace falta un plan pago — Resend no cobra de más, corta el envío.',
        'Lo primero es autorizar tu dominio, que es lo que va después de la arroba en tu correo. Sin eso los correos salen igual, pero caen en spam.',
        'Abre el menú de Resend (en el celular es el botón de las tres rayitas, arriba) y entra a "Domains".',
        'Toca "Add Domain".',
        'Escribe tu dominio (por ejemplo tunegocio.com) y créalo.',
        'Resend te muestra una tabla con tres renglones: uno de tipo MX y dos de tipo TXT. Son las tres autorizaciones que tu dominio tiene que declarar para que nadie pueda escribir haciéndose pasar por ti. No hay nada que decidir: se copian tal cual.',
        'Abre en otra pestaña el sitio donde compraste tu dominio (GoDaddy, Namecheap, Hostinger, Porkbun, Cloudflare, el que sea) y busca la sección de DNS. Suele llamarse "DNS", "Zona DNS" o "Administrar registros".',
        'Empieza por los dos renglones que dicen TXT, que son los fáciles. Por cada uno: toca "Agregar registro", elige el tipo TXT, copia el "nombre" de Resend en el campo de nombre y el "valor" en el campo de valor, y guarda.',
        'Ahora el renglón que dice MX, que tiene un campo más: además del nombre y el valor te pide una "Prioridad". Escribe 10, que es lo que dice Resend.',
        'Ojo con el nombre: Resend los pide sobre send.tudominio.com y no sobre tudominio.com. Si tu proveedor completa solo el final del dominio, escribe únicamente la parte de adelante. Este es el error que más veces deja un dominio sin verificar.',
        'Vuelve a Resend y toca "Verify DNS Records".',
        'Si los tres renglones quedan en verde y dicen "Verified", ya está. Si alguno queda en "Pending", espera un rato y vuelve a tocar el botón: un cambio de DNS puede tardar de unos minutos a unas horas en aplicarse.',
        'Con el dominio verificado, en el mismo menú entra a "API Keys".',
        'Toca "Create API Key".',
        'Ponle un nombre para reconocerla después, por ejemplo MaKo.',
        'Donde dice "Permission" elige "Full access". Es más permiso del que hace falta para mandar correos, pero es el que MaKo necesita para poder revisar si tu dominio quedó bien verificado. Con "Sending access" el correo sale igual, pero MaKo te va a marcar la conexión como fallada.',
        'Si te deja elegir un dominio, elige el que acabas de verificar.',
        'Copia la key —empieza con re_— y pégala en el campo "API key". Se muestra UNA sola vez.',
        'En el campo "Remitente" escribe cómo quieres que te vean: tu nombre, un espacio, y tu correo entre los signos < >. Por ejemplo: Tu negocio <hola@tunegocio.com>.',
        'Ese correo tiene que ser del dominio que acabas de verificar, o el envío falla.',
        // ⚠️ Decía «El remitente es opcional: si lo dejas vacío MaKo usa uno por defecto». Falso
        // con tu propia key: el «por defecto» es onboarding@resend.dev, que sólo le entrega al
        // dueño de la cuenta de Resend (punto 15 del audio de Customer Success, 08/10/2026).
        'No dejes el remitente vacío: sin él los correos salen desde onboarding@resend.dev, que solo te los entrega a ti. Nadie más los recibe.',
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
      { env: 'ANTHROPIC_API_KEY', label: 'API key', secreto: true, placeholder: 'sk-ant-…', nota: 'Empieza con sk-ant-. Se guarda cifrada y no se vuelve a mostrar entera. Si la pierdes, bórrala en Claude Platform y crea una nueva.' },
    ],
    tutorial: {
      url: 'https://platform.claude.com/settings/keys',
      urlLabel: 'Claude Platform → API Keys',
      pasos: [
        'Para qué sirve: con esta key MaKo piensa. Sin ella no hay análisis, ni chat, ni sugerencias. Es de pago por uso, con saldo que cargas por adelantado.',
        'Lo que vas a conseguir se llama una "API key": una clave larga de letras y números, como una contraseña pero para programas, que le da permiso a MaKo para usar tu cuenta de Claude. Se saca una vez y se pega una vez.',
        'Entra a platform.claude.com y crea una cuenta, o entra con la que ya tienes. Si escribes console.anthropic.com llegas al mismo lugar: le cambiaron el nombre.',
        'Ojo con esto: esa cuenta es distinta de la de claude.ai. Si ya pagas Claude Pro, ese pago no sirve para esto; el saldo para conectar programas se carga aparte.',
        'Carga saldo antes que nada, porque sin saldo la key no responde. Abre el menú de la plataforma (en el celular, el botón de las tres rayitas) y entra a "Billing"; en algunas cuentas dice "Plans & Billing".',
        'Toca "Add funds", que es el botón para agregar fondos.',
        'Elige el monto. Con 5 dólares, que es el mínimo, arrancas tranquilo: cada análisis cuesta centavos.',
        'Carga los datos de tu tarjeta y confirma. Tu banco puede pedirte una confirmación aparte.',
        'Cuando veas el saldo cargado, ya está la parte de la plata. Ahora la key.',
        'En ese mismo menú, entra a "API Keys".',
        'Toca el botón "Create Key".',
        'Escribe un nombre para reconocerla después, por ejemplo "MaKo", y confirma. El nombre es solo para ti y no cambia nada.',
        'Copia la key en ese momento: empieza con sk-ant- y se muestra UNA sola vez. Después de cerrar esa ventana ya no se puede volver a ver.',
        'Pégala en el campo "API key" y guarda. Si la perdiste, no pasa nada: la borras de la lista en Claude Platform y creas otra.',
      ],
    },
  },
  {
    key: 'openai',
    nombre: 'OpenAI',
    categoria: 'Inteligencia',
    paraQue: 'Transcripción de audios/videos (Whisper) y tareas simples de extracción.',
    campos: [
      { env: 'OPENAI_API_KEY', label: 'API key', secreto: true, placeholder: 'sk-…', nota: 'Empieza con sk-. Es la de platform.openai.com, no la de tu cuenta de ChatGPT. Sin saldo cargado devuelve error aunque esté bien escrita.' },
    ],
    tutorial: {
      url: 'https://platform.openai.com/api-keys',
      urlLabel: 'OpenAI Platform → API keys',
      pasos: [
        'Para qué sirve: con esta key MaKo pasa a texto tus audios y videos: notas de voz, grabaciones de llamadas y reuniones. Es de pago por uso, con saldo que cargas por adelantado.',
        'La "API key" es esa clave larga de letras y números que se saca una vez y se pega una vez: le da permiso a MaKo para usar tu cuenta de OpenAI.',
        'Entra a platform.openai.com y crea una cuenta, o entra con la que ya tienes.',
        'Ojo con esto: platform.openai.com es la plataforma para conectar programas y no es chatgpt.com. Si ya pagas ChatGPT Plus, ese pago no sirve para esto; el saldo se carga aparte.',
        'Carga saldo antes que nada, porque sin saldo la key no responde. Abre la configuración de tu cuenta: es el engranaje "Settings", arriba a la derecha.',
        'Dentro de "Settings", en el menú (en el celular, el botón de las tres rayitas), entra a "Billing".',
        'Toca "Add credit", que es el botón para agregar crédito. La primera vez puede decir "Add payment details".',
        'Elige el monto. Con 5 dólares, que es el mínimo, arrancas tranquilo.',
        'Carga los datos de tu tarjeta y confirma. Tu banco puede pedirte una confirmación aparte.',
        'Cuando veas el saldo cargado, ya está la parte de la plata. Ahora la key.',
        'En ese mismo menú, entra a "API keys".',
        'Toca el botón "Create new secret key".',
        'Escribe un nombre para reconocerla después, por ejemplo "MaKo", deja el resto de las opciones como vienen y confirma.',
        'Copia la key en ese momento: empieza con sk- y se muestra UNA sola vez. Después de cerrar esa ventana ya no se puede volver a ver.',
        'Pégala en el campo "API key" y guarda. Si la perdiste, la borras de la lista en OpenAI y creas otra.',
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
        'Para qué sirve: con esta key MaKo hace las tareas rápidas del día a día: clasificar, resumir, poner títulos y pasar a texto tus notas de voz. Es gratis y no pide tarjeta.',
        'La "API key" es esa clave larga de letras y números que se saca una vez y se pega una vez: le da permiso a MaKo para usar tu cuenta de Groq.',
        'Entra a console.groq.com y crea una cuenta con Google, con GitHub o con tu correo.',
        'Entra directo a console.groq.com/keys. Si prefieres ir por el menú (en el celular, el botón de las tres rayitas), la sección se llama "API Keys".',
        'Toca el botón "Create API Key".',
        'Escribe un nombre para reconocerla después, por ejemplo "MaKo", y confirma.',
        'Copia la key en ese momento: empieza con gsk_ y se muestra UNA sola vez.',
        'Pégala en el campo "API key" y guarda.',
        'El plan gratis no cobra nunca: lo que tiene es un tope de uso por minuto y por día. Si un día lo pasas, MaKo sigue con otra de las IA que tengas conectadas, y al día siguiente el tope arranca de cero.',
        'Los campos de abajo son opcionales. La cuota gratis se agota POR CUENTA, así que si abres una segunda cuenta en Groq tienes el doble de uso gratis: pega su key en "API key 2" y MaKo pasa sola a esa cuando la primera llega a su tope.',
        'El campo "Email de la cuenta 1" es solo para que reconozcas de un vistazo de qué cuenta salió cada key. No se comparte con nadie y puedes dejarlo vacío.',
      ],
    },
  },
  {
    key: 'gemini',
    nombre: 'Google Gemini',
    categoria: 'Inteligencia',
    paraQue: 'IA de Google con 1M de contexto y function-calling. El plan gratis no cobra, pero Google usa tus datos para mejorar sus productos (con revisión humana). Para datos de clientes usa una key PAGA (activa facturación en el proyecto): esa NO entrena.',
    campos: [
      { env: 'GEMINI_API_KEY', label: 'API key', secreto: true, placeholder: 'AIza…', nota: 'Empieza con AIza. Si es del plan gratis, Google usa esos textos para mejorar sus productos y personas de Google pueden llegar a leerlos. La key del plan pago no entrena.' },
      cuentaDe('GEMINI_API_KEY'),
      ...keysExtra('gemini', 'AIza…'),
    ],
    tutorial: {
      url: 'https://aistudio.google.com/apikey',
      urlLabel: 'Google AI Studio → API keys',
      pasos: [
        'Para qué sirve: con esta key MaKo puede leer de una sola vez documentos y conversaciones muy largas. El plan gratis alcanza de sobra para probar.',
        'La "API key" es esa clave larga de letras y números que se saca una vez y se pega una vez: le da permiso a MaKo para usar tu cuenta de Google.',
        'Entra a aistudio.google.com/apikey con tu cuenta de Google.',
        'Toca el botón "Create API key".',
        'Google te pide elegir un proyecto de Google Cloud. Un "proyecto" es solo la carpeta donde Google lleva la cuenta de tu uso: elige el que te ofrece o crea uno nuevo. El nombre da igual.',
        'Copia la key: empieza con AIza. Si la pierdes, vuelves a esa misma pantalla de AI Studio y la copias otra vez.',
        'Ojo con la privacidad, y la decisión es antes de conectar: MaKo le manda a Gemini textos de tu trabajo —conversaciones con clientes, notas de reuniones— y en el plan gratis Google usa eso para mejorar sus productos, con personas que pueden llegar a leerlo. No hay forma de elegir qué se le manda y qué no.',
        'Si eso no te sirve, tienes dos salidas: no conectar Gemini, y MaKo funciona igual con las otras IA, o pasar al plan pago, donde tus datos NO se usan para entrenar.',
        'Si te sirve como está, pega la key en el campo "API key" y guarda. Con eso ya funciona, gratis.',
        'Si eliges el plan pago: en esa misma pantalla de API keys de AI Studio, busca la columna "Billing Tier" y toca "Set up billing".',
        'Google te pide vincular una cuenta de facturación y prepagar un mínimo de 10 dólares. Desde ese momento tus textos ya no se usan para entrenar.',
        'Los campos de abajo son opcionales. La cuota gratis se agota POR CUENTA, así que si abres una segunda cuenta de Google tienes el doble de uso gratis: pega su key en "API key 2" y MaKo pasa sola a esa cuando la primera llega a su tope.',
        'El campo "Email de la cuenta 1" es solo para que reconozcas de un vistazo de qué cuenta salió cada key. No se comparte con nadie y puedes dejarlo vacío.',
      ],
    },
  },
  {
    key: 'cerebras',
    nombre: 'Cerebras',
    categoria: 'Inteligencia',
    paraQue: 'IA gratis y MUY rápida (corre Llama en su propio chip). Con function-calling. Ideal para rotar cuando Gemini se queda sin cuota, sin gastar.',
    campos: [
      { env: 'CEREBRAS_API_KEY', label: 'API key', secreto: true, placeholder: 'csk-…', nota: 'Empieza con csk-. Desde agosto de 2026 la cuenta necesita una tarjeta cargada para que la key funcione: sin eso da error aunque esté bien escrita.' },
      cuentaDe('CEREBRAS_API_KEY'),
      ...keysExtra('cerebras', 'csk-…'),
    ],
    tutorial: {
      url: 'https://cloud.cerebras.ai',
      urlLabel: 'Cerebras Cloud → API Keys',
      pasos: [
        'Para qué sirve: con esta key MaKo suma una IA extra muy rápida, útil cuando las otras llegan a su tope del día. Desde agosto de 2026 pide cargar una tarjeta.',
        'Si no quieres cargar una tarjeta, omite Cerebras: con Groq tienes lo mismo y sigue siendo gratis. Deja el campo vacío y cierra esta ventana; no hay nada que guardar y no te falta nada.',
        'La "API key" es esa clave larga de letras y números que se saca una vez y se pega una vez: le da permiso a MaKo para usar tu cuenta de Cerebras.',
        'Entra a cloud.cerebras.ai y crea una cuenta con tu cuenta de Google o con tu correo.',
        'Cerebras te va a pedir una tarjeta apenas entres. Cárgala ahí: hasta que lo hagas, la cuenta queda sin acceso y la key no responde aunque esté bien pegada.',
        'Si no te la pidió sola, abre el menú (en el celular, el botón de las tres rayitas) y busca la sección de pagos: suele decir "Billing" o "Plans". Carga la tarjeta desde ahí.',
        'Al cargar la tarjeta te dan 5 dólares de crédito de regalo. Vencen a los 30 días: no es saldo eterno.',
        'En ese mismo menú, entra a "API Keys".',
        'Toca el botón para crear una key nueva, que dice "Create API Key".',
        'Escribe un nombre para reconocerla después, por ejemplo "MaKo", y confirma.',
        'Copia la key en ese momento: empieza con csk- y se muestra UNA sola vez.',
        'Pégala en el campo "API key" y guarda.',
        'Los campos de abajo son opcionales. El crédito se agota POR CUENTA, así que si abres una segunda cuenta en Cerebras tienes el doble: pega su key en "API key 2" y MaKo pasa sola a esa cuando la primera llega a su tope.',
        'El campo "Email de la cuenta 1" es solo para que reconozcas de un vistazo de qué cuenta salió cada key. No se comparte con nadie y puedes dejarlo vacío.',
      ],
    },
  },
  {
    key: 'mistral',
    nombre: 'Mistral AI',
    categoria: 'Inteligencia',
    paraQue: 'IA europea con free tier (La Plateforme) y function-calling. Otra IA gratis para rotar sin caer en gasto.',
    campos: [
      { env: 'MISTRAL_API_KEY', label: 'API key', secreto: true, placeholder: '…', nota: 'No tiene prefijo: es una cadena larga de letras y números, cópiala entera. El plan gratis "Experiment" pide verificar tu teléfono con un código por SMS.' },
      cuentaDe('MISTRAL_API_KEY'),
      ...keysExtra('mistral', '…'),
    ],
    tutorial: {
      url: 'https://console.mistral.ai/api-keys',
      urlLabel: 'Mistral Console → API Keys',
      pasos: [
        'Para qué sirve: con esta key MaKo suma otra IA gratis, para rotar cuando las demás llegan a su tope del día.',
        'La "API key" es esa clave larga de letras y números que se saca una vez y se pega una vez: le da permiso a MaKo para usar tu cuenta de Mistral.',
        'Entra a console.mistral.ai y crea una cuenta con tu correo o con tu cuenta de Google.',
        'Mistral te pide tu número de teléfono y te manda un código por SMS. Es obligatorio para usar el plan gratis y se hace una sola vez. No te está pidiendo una tarjeta.',
        'Cuando te pregunte qué plan quieres, elige "Experiment": ese es el gratis.',
        'Entra directo a console.mistral.ai/api-keys. Si prefieres ir por el menú (en el celular, el botón de las tres rayitas), la sección se llama "API Keys".',
        'Toca el botón para crear una key nueva, que dice "Create new key".',
        'Escribe un nombre para reconocerla después, por ejemplo "MaKo", y confirma.',
        'Copia la key en ese momento: se muestra UNA sola vez. La de Mistral no empieza con ningún prefijo, es una cadena larga de letras y números: cópiala entera.',
        'Ojo con la privacidad, y la decisión es antes de conectar: en el plan gratis Mistral puede usar para mejorar sus modelos los textos que MaKo le manda —conversaciones con clientes, notas de reuniones—, y no hay forma de elegir qué se le manda y qué no. Si eso no te sirve, no conectes Mistral, que MaKo funciona igual con las otras IA, o pasa a un plan pago.',
        'Pega la key en el campo "API key" y guarda.',
        'El plan "Experiment" no cobra: lo que tiene es un tope de uso por día. Si lo pasas, MaKo sigue con otra de las IA que tengas conectadas.',
        'Los campos de abajo son opcionales. La cuota gratis se agota POR CUENTA, así que si abres una segunda cuenta en Mistral tienes el doble de uso gratis: pega su key en "API key 2" y MaKo pasa sola a esa cuando la primera llega a su tope.',
        'El campo "Email de la cuenta 1" es solo para que reconozcas de un vistazo de qué cuenta salió cada key. No se comparte con nadie y puedes dejarlo vacío.',
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
        'Para qué sirve: con esta key MaKo suma decenas de modelos de IA de una sola vez, varios gratis, para tener de dónde elegir sin abrir cuenta en cada proveedor. Es gratis y no pide tarjeta.',
        'La "API key" es esa clave larga de letras y números que se saca una vez y se pega una vez: le da permiso a MaKo para usar tu cuenta de OpenRouter.',
        'Entra a openrouter.ai y crea una cuenta con Google, con GitHub o con tu correo.',
        'Entra a openrouter.ai/keys: es la pantalla donde se manejan las keys de tu cuenta.',
        'Toca el botón "Create Key".',
        'Escribe un nombre para reconocerla después, por ejemplo "MaKo".',
        'Si te ofrece ponerle un tope de gasto ("Credit limit"), déjalo vacío.',
        'Confirma para crearla.',
        'Copia la key en ese momento: empieza con sk-or- y se muestra UNA sola vez.',
        'Pégala en el campo "API key" y guarda.',
        'Los modelos gratis son los que llevan ":free" al final del nombre, y esos no cobran nunca. Si nunca cargaste saldo, el tope es de 50 usos por día.',
        'Si te queda corto: cargando 10 dólares de saldo UNA sola vez, el tope sube a 1.000 usos por día y queda así para siempre. Esos 10 dólares no se gastan por usar los modelos gratis: son un desbloqueo, no un consumo.',
        'Los campos de abajo son opcionales. El tope se cuenta POR CUENTA, así que si abres una segunda cuenta en OpenRouter tienes el doble de uso gratis: pega su key en "API key 2" y MaKo pasa sola a esa cuando la primera llega a su tope.',
        'El campo "Email de la cuenta 1" es solo para que reconozcas de un vistazo de qué cuenta salió cada key. No se comparte con nadie y puedes dejarlo vacío.',
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
      { env: 'GITHUB_TOKEN', label: 'Token de acceso', secreto: true, placeholder: 'github_pat_…', nota: 'Fine-grained, SOLO lectura de contenido ("Contents: Read-only") y SOLO sobre este repo. No puede escribir nada. Se muestra UNA sola vez.' },
      { env: 'GITHUB_REPO', label: 'Repositorio', auto: true, nota: 'Lo completa MaKo al pegar el token: si el token ve uno solo lo pone, y si ve varios te los ofrece en una lista.' },
    ],
    tutorial: {
      url: 'https://github.com/settings/personal-access-tokens/new',
      urlLabel: 'GitHub → Fine-grained tokens',
      pasos: [
        'Para qué sirve: MaKo lee los commits que entran a main y te propone cerrar las tareas de desarrollo que ya están hechas. Sin esto el tablero acumula tareas terminadas para siempre: en la última revisión aparecieron 62 de golpe.',
        'Entra a github.com/settings/personal-access-tokens/new (por el menú es "Settings" → "Developer settings" → "Personal access tokens" → "Fine-grained tokens" → "Generate new token").',
        'Ponle un nombre, por ejemplo MaKo — cerrar tareas.',
        'Elige una expiración y anota la fecha: cuando venza, MaKo deja de proponer cierres y no avisa solo.',
        'En "Resource owner" elige al dueño del repo. Si el repo es de una organización y no la ves en la lista, es que tu cuenta no tiene permiso para pedir tokens ahí.',
        'En "Repository access" elige "Only select repositories".',
        'En la lista que aparece marca SOLO el repo del producto.',
        'Baja hasta "Permissions" y abre "Repository permissions".',
        'Busca la fila "Contents" y en su desplegable elige "Read-only". No toques ninguna otra: con esa alcanza, y así el token no puede escribir nada.',
        'Toca "Generate token".',
        'Copia el token: se muestra UNA sola vez.',
        'Pégalo en el campo "Token de acceso". El campo "Repositorio" no hace falta escribirlo: MaKo lo saca del token.',
        'Si el repo es de una organización que exige aprobación para estos tokens, el token queda en "Pending" hasta que un owner de la organización lo apruebe, y mientras tanto solo lee cosas públicas: la API contesta 404 y no 403, así que el síntoma es «el repo no existe» aunque el token esté perfecto.',
        'Si tú mismo eres owner de esa organización, se aprueba solo y no hay nada que esperar.',
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
      { env: 'ELEVENLABS_API_KEY', label: 'API key', secreto: true, placeholder: 'sk_…', nota: 'Es TU cuenta de ElevenLabs: la voz se cobra por minuto y corre contra ella. ⚠️ El plan GRATIS de ElevenLabs es de uso NO COMERCIAL, así que para anuncios hace falta un plan pago (el más barato alcanza). Y la key necesita DOS permisos: «Voices» con escritura (para crear el clon) y «Speech to Speech» (para convertir); con sólo «Text to Speech» se ve válida y falla recién al convertir.' },
    ],
    tutorial: {
      url: 'https://elevenlabs.io/app/settings/api-keys',
      urlLabel: 'ElevenLabs → API Keys',
      pasos: [
        'Para qué sirve: Google Flow genera cada clip con una voz preset suya, y su propia documentación dice que no acepta subir audio de referencia. ElevenLabs es lo que convierte esa voz en la del cliente conservando la entonación del clip, así que los labios siguen cerrando.',
        '⚠️ El plan GRATIS de ElevenLabs es de uso NO COMERCIAL: produce audio que no se puede poner en un anuncio, y no falla — sale bien. Para anuncios hace falta un plan pago, y el más barato alcanza.',
        'Entra a elevenlabs.io/app/settings/api-keys y toca «Create API Key».',
        'Antes de confirmar, mira los permisos: ElevenLabs crea la key restringida.',
        'Activa «Voices» con permiso de ESCRITURA. Sin eso no se puede crear un clon.',
        'Activa «Speech to Speech». Es la operación que convierte el audio, y es la que cuesta cuota.',
        'Ojo con «User»: si no le das lectura, la key funciona igual para todo lo anterior pero MaKo no puede mostrarte cuánta cuota te queda. Conviene activarlo.',
        'Y ojo con «Models»: sin ese permiso, /v1/models contesta 200 con la lista VACÍA. No es que no haya modelos — es que la key no los ve, y eso se lee como que la cuenta no puede convertir.',
        'Si te ofrece vencimiento («Expire After»), déjalo en «Never»: el día que venza, los anuncios salen con la voz de Google y nadie se entera.',
        'Copia la key —empieza con sk_— y pégala. Se muestra UNA sola vez.',
        'Ojo con el plan: el gratis produce audio que NO se puede usar comercialmente sin nombrar a ElevenLabs. Para anuncios hace falta un plan pago.',
        'Cómo comprobar que quedó bien sin gastar nada: MaKo manda los dos pedidos reales a propósito SIN cuerpo. Si contestan 422 «Field required», los permisos están. Si contestan 401, falta uno.',
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
      { env: 'FATHOM_HOST_EMAIL', label: 'Email de la cuenta que graba', placeholder: 'tu@tudominio.com', nota: 'El correo con el que entras a Fathom. Es lo que le dice a MaKo que esa grabación es tuya: sin él, tus reuniones llegan y se descartan sin ningún error a la vista. Escríbelo tal cual, sin espacios.' },
      { env: 'FATHOM_WEBHOOK_SECRET', label: 'Contraseña del webhook', secreto: true, nota: 'La genera Fathom cuando creas el aviso automático y empieza con whsec_. Es lo que hace que la reunión llegue al instante y no varias horas después: de eso depende poder mandarle el resumen al cliente mientras la charla está fresca.' },
    ],
    pasoExterno: {
      titulo: 'Pega esta dirección dentro de Fathom',
      porque: 'Es por donde Fathom avisa apenas cortas una llamada. Sin esto la reunión llega horas más tarde, cuando ya no sirve para escribirle al cliente en caliente.',
      valor: '{{APP_URL}}/api/webhooks/fathom',
      donde: 'En fathom.video: "User Settings" → sección "API Access" → "Manage" → "Add Webhook", en el campo de la dirección de destino.',
      ojo: [
          'Marca "My Recordings" siempre. "External Recordings" son las que te comparte gente de afuera de tu equipo; las de tus compañeros están en la opción de equipo ("Team Recordings"), que solo existe en el plan Team. Si quieres las llamadas de tu equipo y no marcas esa, no llegan nunca.',
          'Marca la casilla que dice "transcript" o "include transcript": es el texto escrito de la charla, y sin él MaKo no puede confirmar que el cliente habló ni analizar la llamada.',
          'Al guardar, Fathom te muestra una contraseña que empieza con whsec_ y se muestra UNA sola vez. Cópiala en ese momento y pégala en el campo "Contraseña del webhook".',
          'Si no ves la sección "API Access" en tu configuración, tu plan de Fathom no la incluye.',
        ],
    },
    tutorial: {
      url: 'https://fathom.video/customize#api-access-header',
      urlLabel: 'Fathom → API Access',
      pasos: [
        'Para qué sirve: apenas cortas una llamada, MaKo la escucha, te deja el resumen, marca si el cliente asistió y actualiza su ficha en el CRM. Sin que toques nada.',
        'Entra a fathom.video con la cuenta que graba tus llamadas.',
        'Abre la configuración de tu usuario: toca tu foto o tus iniciales, arriba a la derecha.',
        'Elige "Settings" (Fathom a esa pantalla la llama "User Settings").',
        'Baja hasta la sección que dice "API Access". Si no la ves, tu plan de Fathom no la incluye: escríbele al soporte de Fathom preguntando por "API access" antes de pagar nada.',
        'Toca "Generate API Key".',
        'Copia la key que aparece.',
        'Pega esa key en el campo "API key".',
        'Escribe tu correo de Fathom en el campo "Email de la cuenta que graba": el mismo con el que acabas de entrar. Es lo que le dice a MaKo que esa grabación es tuya; sin él tus reuniones llegan y se descartan, sin ningún error a la vista.',
        'Ahora el aviso automático. Más abajo en esta pantalla hay un recuadro amarillo que dice "Pega esta dirección dentro de Fathom", con un botón "Copiar". Tócalo.',
        'Vuelve a Fathom, a esa misma sección "API Access", y toca "Manage".',
        'Toca "Add Webhook". Un webhook es un aviso automático: hace que Fathom le avise a MaKo apenas termina una grabación, en vez de que MaKo tenga que salir a preguntar cada tanto.',
        'En el campo de la dirección de destino pega la dirección que copiaste del recuadro amarillo.',
        'Donde Fathom pregunta qué grabaciones disparan el aviso, marca "My Recordings": son las que grabas tú. Esa va siempre.',
        'Si trabajas con gente de afuera que te comparte sus grabaciones, marca también "External Recordings": son las que graba alguien ajeno a tu equipo y comparte contigo.',
        'Si tu plan es Team y quieres además las llamadas que graban tus compañeros, marca la opción de grabaciones del equipo ("Team Recordings"). Sin esa, las llamadas de tu equipo no llegan nunca. Si tu plan no es Team, esa opción no aparece: no te falta nada.',
        'En el mismo formulario, más abajo, Fathom te deja elegir qué información mandar en cada aviso: es una lista de casillas. Marca la que diga "transcript" o "include transcript" — es el texto escrito de lo que se habló, y sin eso MaKo no puede confirmar que el cliente habló ni analizar la reunión. Si no encuentras ninguna casilla parecida, deja todo como viene: Fathom manda la transcripción por defecto en las cuentas nuevas.',
        'Guarda el webhook. Fathom te muestra una contraseña que empieza con whsec_: cópiala ahí mismo, porque se muestra UNA sola vez.',
        'Pega esa contraseña en el campo "Contraseña del webhook". Si cerraste la ventana sin copiarla, borra el webhook y créalo de nuevo.',
      ],
    },
  },
  {
    key: 'panda',
    nombre: 'Panda Video',
    categoria: 'Datos',
    paraQue: 'Métricas de reproducción del VSL (plays, retención).',
    campos: [
      { env: 'PANDA_API_KEY', label: 'API key', secreto: true, placeholder: 'panda-…', nota: 'Se saca en dashboard.pandavideo.com → "Settings" → "Advanced" → "Generate new API key". Da acceso completo a tu cuenta de Panda: no la compartas ni la pegues en tu página.' },
      { env: 'PANDA_VSL_VIDEO_IDS', label: 'IDs de videos del VSL', opcional: true, placeholder: 'id1,id2', nota: 'El ID que sirve es el que aparece después de ?v= en el código de "Embed" del video, con "Platform" en "Custom" — NO el número de la barra del navegador. Varios videos, separados por coma.' },
    ],
    tutorial: {
      url: 'https://dashboard.pandavideo.com',
      urlLabel: 'Panda Video → Settings → Advanced',
      pasos: [
        'Para qué sirve: MaKo te dice cuánta gente le dio play a tu video de ventas y hasta qué minuto lo miró, sin que entres a Panda a mirarlo.',
        'Entra a dashboard.pandavideo.com con tu cuenta.',
        'Abre el menú de Panda (en el celular es el botón de las tres rayitas, arriba) y entra a "Settings".',
        'Dentro de Settings abre la pestaña "Advanced".',
        'Toca "Generate new API key".',
        'Copia la key que aparece —esa cadena larga de letras y números que se pega una sola vez— y pégala en el campo "API key".',
        'Guarda esa key también en otro lado: si la pierdes tienes que generar una nueva, y al hacerlo la anterior deja de funcionar.',
        'Ahora los videos. En el mismo menú entra a "Videos" y abre tu video de ventas: el que le muestras a la gente antes de que agende contigo. En MaKo a ese video se lo llama tu VSL.',
        'Arriba a la derecha toca "Embed". Se abre una ventana con el código que sirve para poner el video en una página.',
        'Si esa ventana tiene un selector que dice "Platform", elige "Custom": con las otras opciones el código no muestra el dato que hace falta.',
        'En ese código busca el trozo que dice ?v= . Justo después viene un texto largo con guiones, así: b1e4f0c2-3a5d-4f21-9c88-0d1e2f3a4b5c',
        'Ese texto es el ID del video: empieza después del signo = y termina antes de la comilla que sigue. Cópialo.',
        'Pégalo en el campo "IDs de videos del VSL". Si tienes más de una versión de tu video de ventas, pega los IDs uno detrás de otro separados por coma.',
        'Ojo: el número que aparece en la barra del navegador al abrir el video NO sirve. Panda maneja dos identificadores distintos y el que funciona es el del código de "Embed".',
        'Ese último campo es opcional: sin él la conexión queda guardada igual, pero MaKo no tiene ningún video del que traerte números.',
        'Si tienes la cuenta de Panda en portugués, los rótulos dicen "Configurações" y "Avançado": es el mismo camino.',
      ],
    },
  },
  {
    key: 'youtube',
    nombre: 'YouTube',
    categoria: 'Datos',
    paraQue: 'Views del VSL alojado en YouTube (si tu VSL vive ahí).',
    campos: [
      { env: 'YOUTUBE_API_KEY', label: 'API key', secreto: true, placeholder: 'AIza…', nota: 'Empieza con AIza. Sale de console.cloud.google.com → "APIs y servicios" → "Credenciales" → "Crear credenciales" → "Clave de API", con la "YouTube Data API v3" ya habilitada.' },
      { env: 'YOUTUBE_VSL_VIDEO_ID', label: 'ID del video del VSL', opcional: true, placeholder: 'dQw4w9WgXcQ', nota: 'Lo que va después de v= en la dirección del video (youtube.com/watch?v=ESTO). Si copiaste un link corto youtu.be/ESTO, es lo que va después de la barra. Si hay un &, corta ahí.' },
      { env: 'YOUTUBE_OAUTH_CLIENT_ID', label: 'OAuth Client ID', opcional: true, placeholder: '…apps.googleusercontent.com', nota: 'Opcional: déjalo vacío. Solo hace falta si además quieres la retención y las vistas diarias de TU canal. Para contar reproducciones no se usa.' },
      { env: 'YOUTUBE_OAUTH_CLIENT_SECRET', label: 'OAuth Client secret', secreto: true, opcional: true, placeholder: 'GOCSPX-…', nota: 'Opcional. Va de a pares con el "OAuth Client ID": si dejaste ese vacío, este también. Empieza con GOCSPX- y se muestra UNA sola vez, al crear el cliente.' },
      { env: 'YOUTUBE_OAUTH_REFRESH_TOKEN', label: 'OAuth Refresh token', secreto: true, opcional: true, nota: 'Opcional. Es un permiso que se autoriza una sola vez para que MaKo lea las estadísticas de tu canal. Hoy solo se consigue en el OAuth Playground de Google, una herramienta para programadores. Si no lo necesitas, déjalo vacío: las reproducciones se cuentan igual.' },
    ],
    tutorial: {
      url: 'https://console.cloud.google.com/apis/credentials',
      urlLabel: 'Google Cloud Console → Credenciales',
      pasos: [
        'Para qué sirve: si tu video de ventas está en YouTube, MaKo trae solo cuántas veces se reprodujo y lo muestra junto al resto de tus números.',
        'Entra a console.cloud.google.com con la misma cuenta de Google con la que entras a YouTube. Es el panel de Google para desarrolladores. Parece complicado y no lo es: vas a crear una carpeta, prender una función y copiar una key. Diez minutos.',
        'Arriba a la izquierda, al lado del logo, toca el selector de proyecto y luego "Proyecto nuevo". Un proyecto es esa carpeta donde Google guarda lo que crees.',
        'Ponle cualquier nombre (por ejemplo MaKo) y créalo.',
        'Espera a que arriba figure ese proyecto como el elegido. Todo lo que hagas de aquí en adelante queda guardado dentro de él.',
        'Abre el menú de Google Cloud (en el celular es el botón de las tres rayitas, arriba a la izquierda) y entra a "APIs y servicios".',
        'Dentro entra a "Biblioteca".',
        'Escribe "YouTube Data API v3" en el buscador y abre el resultado que se llame exactamente así.',
        'Toca "Habilitar" y espera unos segundos. Es gratis y no pide tarjeta.',
        'Vuelve al mismo menú, a "APIs y servicios", y entra a "Credenciales".',
        'Arriba toca "Crear credenciales".',
        'En la lista que se abre elige "Clave de API".',
        'Copia la key que aparece —empieza con AIza— y pégala en el campo "API key".',
        'Con el plan gratis alcanza de sobra: son 10.000 consultas por día y MaKo usa unas pocas.',
        'Si tu cuenta de Google está en inglés, esos menús dicen "APIs & Services", "Library", "Credentials", "Create credentials" y "API key": es el mismo camino.',
        'Ahora el "ID del video del VSL". Tu VSL es tu video de ventas: el que le muestras a la gente antes de que agende contigo.',
        'El ID es lo que va después de v= en la dirección de YouTube: en youtube.com/watch?v=dQw4w9WgXcQ el ID es dQw4w9WgXcQ. Si después hay un signo &, corta ahí.',
        'Si copiaste un link corto tipo youtu.be/dQw4w9WgXcQ, el ID es lo que va después de la barra.',
        'Los tres campos que dicen "OAuth" son opcionales: déjalos vacíos. Solo hacen falta si además quieres la retención y las vistas diarias de tu propio canal, y eso se autoriza aparte. Sin ellos, las reproducciones del video se cuentan igual.',
      ],
    },
  },
  {
    key: 'calendly',
    nombre: 'Calendly',
    categoria: 'Reuniones',
    paraQue: 'Lectura de agendas para respaldos y backfills (los webhooks se configuran aparte).',
    campos: [
      { env: 'CALENDLY_API_TOKEN', label: 'Personal access token', secreto: true, nota: 'Es el token con el que MaKo lee tu agenda de Calendly. Calendly lo muestra UNA sola vez, al crearlo: si lo pierdes, generas otro.' },
      // ⚠️ OBLIGATORIO, Y HASTA EL 04/10/2026 DECÍA «Opcional». No es un rótulo: es lo
      // ÚNICO que escribe la fila de `webhook_routing` (ROUTING_CREDS, lib/webhook-routing.ts),
      // y el webhook resuelve el workspace por ahí y es fail-CLOSED a propósito —sin mapeo no
      // toca un solo dato, para que la reserva de un cliente no caiga en el CRM del dueño—.
      // O sea que conectar Calendly «bien» (sólo el token) dejaba al cliente con CERO filas de
      // ruteo y todas sus reservas ignoradas con un 200 y un `console.warn`. Medido contra
      // producción el 04/10/2026: 1 de los 2 workspaces con Calendly conectado estaba así.
      // Es el MISMO caso de `FATHOM_HOST_EMAIL`, que dejó de ser opcional por esto mismo.
      { env: 'CALENDLY_EVENT_TYPE_J1', label: 'Tipo de evento de R1', placeholder: 'Llamada de auditoría', nota: 'Obligatorio: es lo que le dice a MaKo que esa reserva es tuya. Sin esto, las reuniones que agende tu gente no entran a tu CRM y no vas a ver ningún error. Escribe el nombre de la reunión tal cual figura en Calendly (Calendly a esos links los llama "Event Types"). También acepta la dirección técnica que empieza con https://api.calendly.com/event_types/, si te la pasó tu programador.' },
      { env: 'CALENDLY_EVENT_TYPE_J2', label: 'Tipo de evento de R2', opcional: true, placeholder: 'https://api.calendly.com/event_types/…', nota: 'Opcional. Igual que el anterior, pero para la segunda reunión ("R2"). Llénalo solo si tu segunda reunión se agenda con un link distinto al de la primera.' },
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
      { env: 'CALENDLY_WEBHOOK_SIGNING_KEY', label: 'Signing key del webhook', secreto: true, opcional: true, nota: 'Opcional. Un webhook es un aviso automático, y esta signing key es su contraseña. Solo existe si alguien lo creó por programación: Calendly no tiene pantalla para hacerlo. Si te lo montó tu agencia, pídele ese valor; si no sabes de qué se trata, déjalo vacío. Lo que se pierde sin ese aviso: una reserva nueva no crea el contacto, MaKo solo completa los datos de alguien que ya está en el CRM.' },
    ],
    tutorial: {
      url: 'https://calendly.com/integrations/api_webhooks',
      urlLabel: 'Calendly → API and webhooks',
      pasos: [
        'Para qué sirve: MaKo lee tu agenda de Calendly para que no se te pierda ninguna reunión — trae las que ya están agendadas y recupera las que hayan quedado afuera del CRM.',
        'Entra a calendly.com con la cuenta donde recibes las reuniones.',
        'Abre el menú principal (en el celular es el botón de las tres rayitas, arriba) y entra a "Automations".',
        'Arriba de esa pantalla abre la pestaña "Integrations & apps". Si tu cuenta muestra "Integrations & apps" suelto en el menú principal, entra ahí directamente: es la misma pantalla.',
        'Dentro busca el recuadro que dice "API and webhooks" y ábrelo.',
        'Baja hasta "Personal access tokens" y toca "Generate new token". Si nunca creaste uno, ese botón dice "Get a token now".',
        'Escribe un nombre para reconocerlo después, por ejemplo MaKo.',
        'Toca "Create token".',
        'Toca "Copy token". Calendly lo muestra UNA sola vez: si cierras esa ventana sin copiarlo, no hay forma de recuperarlo y tienes que generar otro.',
        'Pega ese token en el campo "Personal access token".',
        'Guarda. MaKo prueba la conexión sola al guardar y te dice con qué cuenta de Calendly quedó conectada: si no es la que esperabas, es que copiaste el token de otra cuenta.',
        'Falta un dato más, y es obligatorio: "Tipo de evento de R1". Es lo que le dice a MaKo que la reserva es tuya, y sin él las reuniones que agende tu gente no entran a tu CRM y no vas a ver ningún error.',
        'En Calendly, cada link de agenda se llama un "Event Type", y están todos en la lista de la pantalla principal. Escribe en ese campo el nombre del que usas para tu primera reunión, tal cual figura ahí.',
        'Opcional — "Tipo de evento de R2": llénalo solo si tu segunda reunión se agenda con un link distinto al de la primera, y quieres que MaKo las distinga.',
        'Opcional — "Signing key del webhook": un webhook es un aviso automático, y esa signing key es su contraseña. Solo existe si alguien lo creó por programación, porque Calendly no tiene ninguna pantalla para crearlo. Si te lo montó tu agencia o tu programador, pídele ese valor y pégalo en el campo.',
        'Si no sabes qué es ese aviso, deja la signing key vacía. Ojo con una cosa: lo que hace que una reserva NUEVA entre sola a tu CRM es ese aviso — sin él, MaKo usa tu agenda para completar los datos de alguien que ya está en el CRM, pero no crea el contacto.',
        'Ten en cuenta que esos avisos automáticos solo funcionan en los planes pagos de Calendly (Professional, Standard, Standard Plus, Teams, Teams Plus o Enterprise). Leer tu agenda con el token funciona en cualquier plan, incluso el gratis.',
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
      { env: 'CALCOM_WEBHOOK_SECRET', label: 'Contraseña del webhook', secreto: true, nota: 'La inventas tú: cualquier texto largo sirve, por ejemplo el nombre de tu negocio pegado a un año y unos números. Va igual en este campo y en el campo "Secret" de Cal.com, y es lo que prueba que la reserva salió de tu calendario. Sin esto no entra ninguna.' },
      { env: 'CALCOM_API_KEY', label: 'API key', secreto: true, opcional: true, placeholder: 'cal_live_…', nota: 'Opcional. Solo hace falta si quieres que MaKo lea tu agenda hacia atrás (traer reservas viejas y recuperar las que se hayan perdido). Las reservas nuevas entran igual sin esto. Al crearla, activa "Never expires": si le dejas fecha de vencimiento, la key deja de funcionar sola y sin aviso.' },
      // ⚠️ OBLIGATORIO POR LA MISMA RAZÓN QUE EL DE CALENDLY (ver arriba): su webhook
      // resuelve el workspace contra `webhook_routing` y también es fail-closed. Acá nunca
      // llegó a morder porque todavía no hay ningún Cal.com conectado — que es justo cuando
      // conviene arreglarlo.
      { env: 'CALCOM_EVENT_TYPE_J1', label: 'Tipo de evento de R1', placeholder: 'llamada-de-auditoria', nota: 'Obligatorio: es lo que le dice a MaKo que esa reserva es tuya. Sin esto, las reuniones que agende tu gente no entran a tu CRM y no vas a ver ningún error. Es lo último de la dirección de tu página de reservas: si tu link es cal.com/juan/llamada-de-auditoria, escribe llamada-de-auditoria. También funciona con el nombre de la reunión tal cual figura en Cal.com.' },
      { env: 'CALCOM_EVENT_TYPE_J2', label: 'Tipo de evento de R2', opcional: true, placeholder: 'cierre', nota: 'Opcional. Igual que el anterior, pero para la segunda reunión ("R2"). Una segunda reunión nunca crea un contacto nuevo: completa el que ya existe.' },
    ],
    pasoExterno: {
      titulo: 'Pega esta dirección dentro de Cal.com',
      porque: 'Es por donde Cal.com avisa apenas alguien reserva. Sin esto la reserva no llega nunca: quien agendó se queda afuera de tu CRM.',
      valor: '{{APP_URL}}/api/webhooks/calcom',
      donde: 'En app.cal.com: "Settings" → "Developer" → "Webhooks" → botón "+ New", arriba a la derecha → campo "Subscriber Url".',
      ojo: [
          'En la lista "Event Triggers" (son los avisos que Cal.com manda) marca al menos "Booking Created" y "Booking Cancelled". Sin la primera no entra ninguna reserva; sin la segunda, una cancelación te queda en pie en el CRM.',
          'El campo "Secret" no puede quedar vacío. Va la misma contraseña que escribiste en el campo "Contraseña del webhook" de MaKo, idéntica. Si lo dejas en blanco, Cal.com manda el texto "no-secret-provided" en lugar de una firma y MaKo rechaza la reserva: es a propósito, porque sin esa clave cualquiera podría inventarte reuniones.',
          'Si el formulario trae un interruptor "Enable Webhook", déjalo encendido antes de guardar: apagado, Cal.com no manda nada.',
          'El tipo de evento es lo último de la dirección de tu página de reservas: en cal.com/juan/llamada-de-auditoria, es llamada-de-auditoria.',
        ],
    },
    tutorial: {
      url: 'https://app.cal.com/settings/developer/webhooks',
      urlLabel: 'Cal.com → Settings → Developer → Webhooks',
      pasos: [
        'Para qué sirve: cuando alguien reserva una hora en tu calendario, esa persona entra sola a tu CRM con su nombre, su correo y la fecha. Y si después cancela, la reunión se marca sola.',
        'Empieza por un dato que inventas tú: en el campo "Contraseña del webhook" de esta pantalla escribe una contraseña propia. Un webhook es el aviso automático que vas a crear en un momento: hace que Cal.com le avise a MaKo apenas alguien reserva, en vez de que MaKo tenga que salir a preguntar cada tanto.',
        'No tiene que ser difícil de recordar, tiene que ser larga: sirve el nombre de tu negocio pegado a un año y unos números, por ejemplo inmobiliariaperez2026clave. No es tu contraseña de Cal.com ni la de MaKo: es una clave que van a conocer solamente esas dos herramientas.',
        'Más abajo en esta pantalla hay un recuadro amarillo que dice "Pega esta dirección dentro de Cal.com", con un botón "Copiar". Tócalo: eso copia el buzón de MaKo, la dirección donde Cal.com va a avisar cada reserva.',
        'Entra a app.cal.com con la cuenta donde recibes las reservas.',
        'Abre la pantalla de avisos automáticos: app.cal.com/settings/developer/webhooks (por el menú es "Settings" → "Developer" → "Webhooks").',
        'Toca el botón "+ New", arriba a la derecha.',
        'Pega en el campo "Subscriber Url" la dirección que copiaste del recuadro amarillo.',
        'Más abajo hay una lista llamada "Event Triggers": son los avisos que Cal.com puede mandar. Marca "Booking Created" (alguien reservó).',
        'En esa misma lista marca también "Booking Cancelled" (alguien canceló). Si no la marcas, una reunión cancelada te queda en pie en el CRM. Si vienen otros avisos marcados, puedes dejarlos: MaKo solo usa esos dos.',
        'Busca el campo "Secret" y escribe ahí EXACTAMENTE la misma contraseña que pusiste en MaKo, sin espacios de más. Tiene que quedar idéntica de los dos lados: es lo que le prueba a MaKo que la reserva salió de tu calendario.',
        'Si ves un interruptor que dice "Enable Webhook", déjalo encendido: apagado, Cal.com no manda nada y tampoco avisa.',
        'Guarda con el botón del final del formulario. Con eso las reservas ya entran solas.',
        'Opcional — solo si además quieres que MaKo pueda leer tu agenda hacia atrás y recuperar reservas viejas: en Cal.com entra a "Settings" → "Developer" → "API Keys".',
        'Toca "+ New", arriba a la derecha: es el mismo botón que usaste para el aviso automático.',
        'Ponle un nombre para reconocerla después, por ejemplo MaKo.',
        'Donde dice la fecha de vencimiento, activa "Never expires" para que la key no caduque sola con el tiempo, y confirma.',
        'Copia la key en ese momento: empieza con cal_live_ y se muestra UNA sola vez.',
        'Pega esa key en el campo "API key". Si cerraste la ventana sin copiarla, bórrala en la lista de Cal.com y crea otra.',
        'Opcional — para que MaKo distinga la primera reunión de la segunda: mira la dirección de tu página de reservas. Si es cal.com/juan/llamada-de-auditoria, lo que va en el campo "Tipo de evento de R1" es llamada-de-auditoria. "R1" es la primera reunión con un interesado; "R2", la segunda.',
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
        'Para qué sirve: es el único dato que hay que pegar de Meta. Con este token ves tu gasto, tus resultados y la salud de tu cuenta de anuncios aquí adentro, puedes crear y pausar campañas, y MaKo completa sola los demás campos de esta pantalla.',
        'Tienes que ser administrador del negocio en Meta — el "portafolio comercial", que es la cuenta donde viven tu página y tu cuenta publicitaria. Si no ves las opciones que se nombran abajo, no eres administrador: pídeselo a quien administra la cuenta.',
        'Entra a business.facebook.com/settings. Es la pantalla de "Configuración del negocio", distinta del administrador de anuncios donde ves tus campañas.',
        'Abre el menú de secciones —en la computadora es la columna de la izquierda; en el celular, el botón de las tres rayitas de arriba—, entra a "Cuentas" y toca "Apps".',
        'Una "app" aquí es solo un permiso con nombre que Meta te obliga a tener para entregarte el token: no se publica, no la busca nadie y ningún cliente tuyo la ve.',
        'Si ya hay una app en esa lista, anota su nombre —lo vas a necesitar más adelante— y omite los tres pasos de crear una que vienen ahora.',
        'Si la lista está vacía, toca "Agregar" y elige "Crear un ID de app nueva": eso te lleva a otro sitio de Meta, developers.facebook.com. Si es tu primera vez ahí, te pide aceptar sus condiciones y verificar tu cuenta con un código; es un trámite de una sola vez.',
        'Ponle un nombre —"MaKo" sirve—, anótalo y créala. Si te pregunta el tipo, elige "Negocio".',
        'Vuelve a business.facebook.com/settings y comprueba que la app aparezca en "Cuentas" → "Apps". Si no aparece ahí, más adelante el menú para elegirla va a salir vacío.',
        'En ese mismo menú de secciones, entra a "Usuarios" y toca "Usuarios del sistema". Un "usuario del sistema" no es una persona: es un usuario automático que Meta crea para que los programas entren en tu lugar, y así la conexión no se cae si cambias tu contraseña.',
        'Toca "Agregar" (en algunas cuentas dice "Agregar nuevo usuario del sistema").',
        'Ponle un nombre —"MaKo" está bien—, elige el tipo "Administrador" y confirma con "Crear usuario del sistema".',
        'Toca el nombre de ese usuario y después el botón "Agregar activos". Un "activo" es cada cosa de tu negocio en Meta: tu cuenta publicitaria, tu página, tu píxel, tu app.',
        'Entra a la pestaña "Cuentas publicitarias", marca la tuya, activa "Control total" y guarda.',
        'Vuelve a "Agregar activos" y entra a la pestaña "Páginas": marca tu página de Facebook, activa "Control total" y guarda.',
        'Vuelve otra vez y busca tu píxel: según la cuenta, está bajo "Orígenes de datos" o bajo "Píxeles". Márcalo, activa "Control total" y guarda. Si todavía no tienes píxel, omite este paso.',
        'Vuelve una última vez y entra a la pestaña "Apps": marca la app cuyo nombre anotaste, activa "Administrar app" y guarda. Este paso se olvida siempre, y es el que hace que después el token no se pueda generar.',
        'Cierra la ventana de "Agregar activos". Vuelves a la ficha de tu usuario del sistema, donde ahora se ve listado todo lo que le asignaste.',
        'Ahí mismo, toca "Generar nuevo token".',
        'Elige tu app en el menú desplegable. Si el menú sale vacío, es porque la app no está agregada al negocio: vuelve a "Cuentas" → "Apps" y agrégala antes de seguir.',
        'En "Vencimiento del token" elige "Nunca". Si eliges "60 días", la conexión se corta sola a los dos meses y hay que repetir todo esto.',
        'Más abajo aparece una lista larga de casillas: son los permisos, o sea lo que le estás dejando hacer a MaKo con tu cuenta. Cada uno abre una parte del tablero: si falta uno, esa parte queda vacía.',
        'Arriba de esa lista hay un buscador. Copia el primero de estos ocho nombres, pégalo en el buscador y marca la casilla del resultado que diga EXACTAMENTE ese nombre: ads_read, ads_management, business_management, pages_show_list, pages_read_engagement, pages_manage_ads, leads_retrieval, pages_manage_metadata.',
        'Repite con los ocho, uno por uno. Van los ocho, ni uno menos: si falta alguno, una parte del tablero queda en blanco y no te dice cuál faltó.',
        'Toca "Generar token".',
        'Copia el código que aparece —empieza con "EAA"— y pégalo en el campo "Access token". Cópialo ahora: se muestra UNA sola vez. Si lo pierdes, generas otro con "Generar nuevo token", en la ficha de tu usuario del sistema.',
      ],
    url: 'https://business.facebook.com/settings',
    urlLabel: 'Configuración del negocio en Meta',
  },
  META_AD_ACCOUNT_ID: {
    pasos: [
        'Para qué sirve: le dice a MaKo de qué cuenta de anuncios traer el gasto y los resultados.',
        'Normalmente no lo escribes tú: al pegar el token en el campo "Access token", MaKo lista tus cuentas y lo completa sola. Si tienes más de una, te muestra la lista para que elijas cuál.',
        'Si prefieres ponerlo a mano, entra a adsmanager.facebook.com con la cuenta que quieres conectar.',
        'Arriba a la izquierda, junto al nombre de la cuenta, aparece un número largo: ese es el identificador.',
        'Escríbelo en el campo "ID de cuenta publicitaria" con el prefijo act_ adelante y sin espacios. Queda así: act_1234567890.',
        'Si lo pegas sin el act_, MaKo no encuentra la cuenta y el tablero de anuncios queda en blanco.',
      ],
    url: 'https://adsmanager.facebook.com/adsmanager',
    urlLabel: 'Administrador de anuncios',
  },
  META_PAGE_ACCESS_TOKEN: {
    pasos: [
        'Para qué sirve: es lo que permite traer los datos de las personas que dejan su contacto en tus formularios de Facebook e Instagram.',
        'No lo escribes tú: MaKo lo saca solo del token que pegaste en el campo "Access token".',
        'Si queda vacío, es por una de dos cosas: tu usuario del sistema de Meta no tiene la página asignada, o al token le faltan permisos de páginas.',
        'Para arreglarlo, entra a business.facebook.com/settings y en el menú de secciones abre "Usuarios" → "Usuarios del sistema".',
        'Toca tu usuario del sistema y después el botón "Agregar activos".',
        'Entra a la pestaña "Páginas", marca tu página de Facebook, activa "Control total" y guarda.',
        'Cierra esa ventana y toca "Generar nuevo token" en la ficha del usuario.',
        'Marca los permisos leads_retrieval, pages_show_list, pages_read_engagement y pages_manage_ads, y genera el token.',
        'Pega ese token nuevo en el campo "Access token" y guarda: el token de la página se vuelve a completar solo.',
      ],
    url: 'https://business.facebook.com/settings',
    urlLabel: 'Configuración del negocio en Meta',
  },
  META_PIXEL_ID: {
    pasos: [
        'Para qué sirve: el píxel es el medidor que Meta pone en tu página web para saber qué anuncio trajo cada venta. Con su identificador, MaKo le devuelve a Meta las ventas que se cierran fuera de la web y afina a quién le muestra tus anuncios.',
        'Normalmente lo completa MaKo: al pegar el token en el campo "Access token" lista los píxeles de tu cuenta, y si tienes más de uno te pregunta cuál.',
        'Si prefieres ponerlo a mano, entra a business.facebook.com/events_manager2, que es el "Administrador de eventos".',
        'En la lista de orígenes de datos, a la izquierda, toca tu píxel.',
        'Junto al nombre del píxel aparece un número: cópialo y pégalo en el campo "ID del píxel". Solo dígitos, sin comillas ni espacios.',
        'Si todavía no tienes píxel, deja el campo vacío: MaKo funciona igual, sin las métricas de la web.',
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
        'Para qué sirve: casi siempre, para nada — déjalo vacío. MaKo ya le manda a Meta las conversiones con el token que pegaste en el campo "Access token".',
        'Solo hace falta en un caso raro: que tu píxel viva en OTRO negocio de Meta y no puedas asignárselo a tu usuario del sistema.',
        'Si estás en ese caso, entra a business.facebook.com/events_manager2, que es el "Administrador de eventos".',
        'Elige tu píxel en la lista de orígenes de datos, a la izquierda.',
        'Abre "Configuración" y baja hasta la sección "Conversions API": es la vía por la que tu servidor le informa las ventas a Meta, sin depender del navegador de quien compró.',
        'Toca "Generar token de acceso" y copia el código que aparece.',
        'Pégalo en el campo "Token de Conversions API" y guarda.',
      ],
    url: 'https://business.facebook.com/events_manager2',
    urlLabel: 'Administrador de eventos',
  },
  META_PAGE_ID: {
    pasos: [
        'Para qué sirve: identifica la página cuyos contactos entran a tu cuenta. Sin este dato, quien deja su teléfono en tus formularios de Facebook e Instagram no llega a ningún lado.',
        'No hace falta que lo busques: MaKo lo completa al pegar el token en el campo "Access token".',
        'Si tienes varias páginas, MaKo te muestra la lista para que elijas cuál es la que usas para tus anuncios.',
        'Si quedó vacío, casi siempre es porque tu usuario del sistema de Meta no tiene la página asignada.',
        'Para arreglarlo, entra a business.facebook.com/settings y en el menú de secciones abre "Usuarios" → "Usuarios del sistema".',
        'Toca tu usuario del sistema y después el botón "Agregar activos".',
        'Entra a la pestaña "Páginas", marca tu página, activa "Control total" y guarda.',
        'Cierra esa ventana, toca "Generar nuevo token" y pega el token nuevo en el campo "Access token": el identificador de la página se completa solo.',
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
        'Para qué sirve: hoy Meta busca gente que DEJE sus datos, y le da igual si sirve o no. Con este dato pasa a buscar gente que califique, porque MaKo le cuenta cuáles de tus contactos avanzaron y cuáles no.',
        'Es el único dato de Meta que MaKo no puede completar sola: hay que crear el conjunto de datos una vez en su pantalla. Toma unos cinco minutos y no se repite.',
        'Si lo dejas vacío no se rompe nada: tus anuncios, tus métricas y tus contactos siguen igual. Lo único que no pasa es esto, que Meta aprenda a quién le sirve tu negocio.',
        'Entra a business.facebook.com/events_manager2, que es el "Administrador de eventos".',
        'Toca "Conectar orígenes de datos". Si tu pantalla está en inglés, dice "Connect Data Sources".',
        'Elige la opción "CRM" y confirma con "Conectar".',
        'Cuando pregunte si usar uno que ya tienes o crear uno nuevo, elige crear uno nuevo. Meta lo recomienda así: mezclado con el de tu página web, los dos tipos de dato se confunden y después no se sabe cuál falló.',
        'Ponle un nombre que lo distinga —"CRM" sirve— y créalo.',
        'Si pregunta qué programa usas, escribe "MaKo". Y donde ofrezca conectarlo con un socio o hacerlo por tu cuenta, elige hacerlo por tu cuenta: la conexión ya está hecha de este lado.',
        'Vuelves a la lista de orígenes de datos. Comprueba que el nuevo tenga el icono de CRM: es lo que dice que quedó listo.',
        'Tócalo. Junto a su nombre aparece un número largo: ese es el identificador.',
        'Cópialo y pégalo en el campo "ID del conjunto de datos de CRM". Solo dígitos, sin espacios ni comillas.',
        'Guarda. Desde ese momento MaKo le manda ahí cada avance de tus contactos, además del contacto crudo.',
        'A los pocos días, en la pestaña "Información general" de ese conjunto de datos, Meta habilita el paso para ordenar tus etapas y elegir cuál quieres que persiga. Elige la primera que ya signifique "este contacto sirve": Meta persigue también las que vienen después.',
        'Recién entonces aparece el objetivo "Clientes potenciales de conversión" en el administrador de anuncios, dentro de "Optimización y entrega". Al activarlo, Meta tarda de dos a cuatro semanas en aprender antes de que se note la mejora.',
        'Dos cosas que conviene saber antes de empezar. Meta pide un mínimo de 200 contactos por mes en la cuenta y que al menos 6 de cada 10 tengan sus avances cargados; con menos, no habilita el objetivo.',
        'Y solo cuenta los contactos de los formularios de Facebook e Instagram: los que llegan por tu página web no entran en esta cuenta, aunque los veas igual en tu tablero.',
      ],
    url: 'https://business.facebook.com/events_manager2',
    urlLabel: 'Administrador de eventos',
  },
  RESEND_API_KEY: {
    pasos: [
        'Para qué sirve: es el permiso que deja a MaKo mandar los correos de seguimiento y los reportes desde tu cuenta de Resend.',
        'Entra a resend.com y crea una cuenta, o inicia sesión si ya tienes una.',
        'El plan gratis manda hasta 100 correos por día (3.000 al mes) desde un solo dominio.',
        'Abre el menú de Resend (en el celular es el botón de las tres rayitas, arriba) y entra a "API Keys".',
        'Toca "Create API Key".',
        'Ponle un nombre para reconocerla después, por ejemplo MaKo.',
        'Donde dice "Permission" elige "Full access". Es más permiso del que hace falta para mandar correos, pero es el que MaKo necesita para poder revisar si tu dominio quedó bien verificado. Con "Sending access" el correo sale igual, pero MaKo te va a marcar la conexión como fallada.',
        'Si te deja elegir un dominio, elige el que ya tengas verificado en Resend.',
        'Copia la key —empieza con re_— y pégala en el campo "API key". Se muestra UNA sola vez: si cierras esa ventana, tienes que crear otra.',
        'Para que los correos no caigan en spam hace falta además tener tu dominio verificado en Resend. Eso se hace en "Domains", y los pasos están en la ayuda del campo "Remitente".',
      ],
    url: 'https://resend.com/api-keys',
    urlLabel: 'Resend → API Keys',
  },
  RESEND_FROM: {
    pasos: [
        'Para qué sirve: es el nombre y la dirección que tu cliente ve cuando le llega un correo de MaKo. Sin esto los correos salen desde onboarding@resend.dev, que solo entrega a tu propia casilla: nadie más los recibe.',
        'Antes de escribir el remitente hay que autorizar tu dominio, que es lo que va después de la arroba en tu correo.',
        'Entra a resend.com, abre el menú (en el celular es el botón de las tres rayitas, arriba) y entra a "Domains".',
        'Toca "Add Domain".',
        'Escribe tu dominio (por ejemplo tunegocio.com) y créalo.',
        'Resend te muestra una tabla con tres renglones: uno de tipo MX y dos de tipo TXT. Son las tres autorizaciones que tu dominio tiene que declarar para que nadie pueda escribir haciéndose pasar por ti. No hay nada que decidir: se copian tal cual.',
        'Abre en otra pestaña el sitio donde compraste tu dominio (GoDaddy, Namecheap, Hostinger, Porkbun, Cloudflare, el que sea) y busca la sección de DNS. Suele llamarse "DNS", "Zona DNS" o "Administrar registros".',
        'Empieza por los dos renglones que dicen TXT, que son los fáciles. Por cada uno: toca "Agregar registro", elige el tipo TXT, copia el "nombre" de Resend en el campo de nombre y el "valor" en el campo de valor, y guarda.',
        'Ahora el renglón que dice MX, que tiene un campo más: además del nombre y el valor te pide una "Prioridad". Escribe 10, que es lo que dice Resend.',
        'Ojo con el nombre: Resend los pide sobre send.tudominio.com y no sobre tudominio.com. Si tu proveedor completa solo el final del dominio, escribe únicamente la parte de adelante. Este es el error que más veces deja un dominio sin verificar.',
        'Vuelve a Resend y toca "Verify DNS Records".',
        'Espera a que el dominio figure "Verified". Si queda en "Pending", vuelve a tocar el botón un rato después: un cambio de DNS puede tardar de unos minutos a unas horas en aplicarse.',
        'Con el dominio verificado, escribe en el campo "Remitente" tu nombre, un espacio, y tu correo entre los signos < >. Por ejemplo: Tu negocio <hola@tunegocio.com>.',
        'Ese correo tiene que ser del dominio que acabas de verificar, o el envío falla.',
      ],
    url: 'https://resend.com/domains',
    urlLabel: 'Resend → Domains',
  },
  ANTHROPIC_API_KEY: {
    pasos: [
        'Para qué sirve: es la key con la que MaKo piensa. Sin ella no hay análisis, ni chat, ni sugerencias. Es de pago por uso, con saldo que cargas por adelantado.',
        'Una "API key" es una clave larga de letras y números, como una contraseña pero para programas: le da permiso a MaKo para usar tu cuenta de Claude. Se saca una vez y se pega una vez.',
        'Entra a platform.claude.com y crea una cuenta, o entra con la que ya tienes. Si escribes console.anthropic.com llegas al mismo lugar: le cambiaron el nombre.',
        'Ojo con esto: esa cuenta es distinta de la de claude.ai. Si ya pagas Claude Pro, ese pago no sirve para esto; el saldo para conectar programas se carga aparte.',
        'Carga saldo antes que nada, porque sin saldo la key no responde. Abre el menú de la plataforma (en el celular, el botón de las tres rayitas) y entra a "Billing"; en algunas cuentas dice "Plans & Billing".',
        'Toca "Add funds", que es el botón para agregar fondos.',
        'Elige el monto. Con 5 dólares, que es el mínimo, arrancas tranquilo: cada análisis cuesta centavos.',
        'Carga los datos de tu tarjeta y confirma. Tu banco puede pedirte una confirmación aparte.',
        'En ese mismo menú, entra a "API Keys".',
        'Toca el botón "Create Key".',
        'Escribe un nombre para reconocerla después, por ejemplo "MaKo", y confirma. El nombre es solo para ti y no cambia nada.',
        'Copia la key en ese momento: empieza con sk-ant- y se muestra UNA sola vez. Después de cerrar esa ventana ya no se puede volver a ver.',
        'Pégala en el campo "API key" y guarda. Si la perdiste, la borras de la lista en Claude Platform y creas otra.',
      ],
    url: 'https://platform.claude.com/settings/keys',
    urlLabel: 'Claude Platform → API Keys',
  },
  OPENAI_API_KEY: {
    pasos: [
        'Para qué sirve: es la key con la que MaKo pasa a texto tus audios y videos: notas de voz, grabaciones de llamadas y reuniones. Es de pago por uso, con saldo que cargas por adelantado.',
        'Una "API key" es una clave larga de letras y números, como una contraseña pero para programas: le da permiso a MaKo para usar tu cuenta de OpenAI. Se saca una vez y se pega una vez.',
        'Entra a platform.openai.com y crea una cuenta, o entra con la que ya tienes.',
        'Ojo con esto: platform.openai.com es la plataforma para conectar programas y no es chatgpt.com. Si ya pagas ChatGPT Plus, ese pago no sirve para esto; el saldo se carga aparte.',
        'Carga saldo antes que nada, porque sin saldo la key no responde. Abre la configuración de tu cuenta: es el engranaje "Settings", arriba a la derecha.',
        'Dentro de "Settings", en el menú (en el celular, el botón de las tres rayitas), entra a "Billing".',
        'Toca "Add credit", que es el botón para agregar crédito. La primera vez puede decir "Add payment details".',
        'Elige el monto. Con 5 dólares, que es el mínimo, arrancas tranquilo.',
        'Carga los datos de tu tarjeta y confirma. Tu banco puede pedirte una confirmación aparte.',
        'En ese mismo menú, entra a "API keys".',
        'Toca el botón "Create new secret key".',
        'Escribe un nombre para reconocerla después, por ejemplo "MaKo", deja el resto de las opciones como vienen y confirma.',
        'Copia la key en ese momento: empieza con sk- y se muestra UNA sola vez. Después de cerrar esa ventana ya no se puede volver a ver.',
        'Pégala en el campo "API key" y guarda. Si la perdiste, la borras de la lista en OpenAI y creas otra.',
      ],
    url: 'https://platform.openai.com/api-keys',
    urlLabel: 'OpenAI Platform → API keys',
  },
  GROQ_API_KEY: {
    pasos: [
        'Para qué sirve: es la key con la que MaKo hace las tareas rápidas del día a día: clasificar, resumir, poner títulos y pasar a texto tus notas de voz. Es gratis y no pide tarjeta.',
        'Una "API key" es una clave larga de letras y números, como una contraseña pero para programas: le da permiso a MaKo para usar tu cuenta de Groq. Se saca una vez y se pega una vez.',
        'Entra a console.groq.com y crea una cuenta con Google, con GitHub o con tu correo.',
        'Entra directo a console.groq.com/keys. Si prefieres ir por el menú (en el celular, el botón de las tres rayitas), la sección se llama "API Keys".',
        'Toca el botón "Create API Key".',
        'Escribe un nombre para reconocerla después, por ejemplo "MaKo", y confirma.',
        'Copia la key en ese momento: empieza con gsk_ y se muestra UNA sola vez.',
        'Pégala en el campo "API key" y guarda.',
        'El plan gratis no cobra nunca: lo que tiene es un tope de uso por minuto y por día. Si un día lo pasas, MaKo sigue con otra de las IA que tengas conectadas, y al día siguiente el tope arranca de cero.',
        'Si estás llenando "API key 2" o "API key 3", el camino es el mismo pero con OTRA cuenta de Groq: el tope se cuenta por cuenta, así que una cuenta nueva te da el doble de uso gratis.',
      ],
    url: 'https://console.groq.com/keys',
    urlLabel: 'Groq Console → API Keys',
  },
  GEMINI_API_KEY: {
    pasos: [
        'Para qué sirve: es la key con la que MaKo puede leer de una sola vez documentos y conversaciones muy largas. El plan gratis alcanza de sobra para probar.',
        'Una "API key" es una clave larga de letras y números, como una contraseña pero para programas: le da permiso a MaKo para usar tu cuenta de Google. Se saca una vez y se pega una vez.',
        'Entra a aistudio.google.com/apikey con tu cuenta de Google.',
        'Toca el botón "Create API key".',
        'Google te pide elegir un proyecto de Google Cloud. Un "proyecto" es solo la carpeta donde Google lleva la cuenta de tu uso: elige el que te ofrece o crea uno nuevo. El nombre da igual.',
        'Copia la key: empieza con AIza. Si la pierdes, vuelves a esa misma pantalla de AI Studio y la copias otra vez.',
        'Ojo con la privacidad, y la decisión es antes de conectar: MaKo le manda a Gemini textos de tu trabajo —conversaciones con clientes, notas de reuniones— y en el plan gratis Google usa eso para mejorar sus productos, con personas que pueden llegar a leerlo. No hay forma de elegir qué se le manda y qué no.',
        'Si eso no te sirve, tienes dos salidas: no conectar Gemini, y MaKo funciona igual con las otras IA, o pasar al plan pago, donde tus datos NO se usan para entrenar.',
        'Si te sirve como está, pega la key en el campo "API key" y guarda. Con eso ya funciona, gratis.',
        'Si eliges el plan pago: en esa misma pantalla de API keys de AI Studio, busca la columna "Billing Tier" y toca "Set up billing".',
        'Google te pide vincular una cuenta de facturación y prepagar un mínimo de 10 dólares. Desde ese momento tus textos ya no se usan para entrenar.',
        'Si estás llenando "API key 2" o "API key 3", el camino es el mismo pero con OTRA cuenta de Google: el tope se cuenta por cuenta, así que una cuenta nueva te da el doble de uso gratis.',
      ],
    url: 'https://aistudio.google.com/apikey',
    urlLabel: 'Google AI Studio → API keys',
  },
  FATHOM_API_KEY: {
    pasos: [
        'Para qué sirve: con esta key MaKo trae tus grabaciones de Fathom y el texto de lo que se habló en cada llamada, para resumirlas y actualizar la ficha del cliente en el CRM.',
        'Entra a fathom.video con la cuenta que graba tus llamadas. Tiene que ser esa: la key queda atada a ese usuario y solo ve sus grabaciones y las que le comparten.',
        'Abre la configuración de tu usuario: toca tu foto o tus iniciales, arriba a la derecha.',
        'Elige "Settings" (Fathom a esa pantalla la llama "User Settings").',
        'Baja hasta la sección que dice "API Access". Si no la ves, tu plan de Fathom no la incluye: escríbele al soporte de Fathom preguntando por "API access" antes de pagar nada.',
        'Toca "Generate API Key".',
        'Copia la key que aparece.',
        'Pega esa key en el campo "API key".',
      ],
    url: 'https://fathom.video/customize#api-access-header',
    urlLabel: 'Fathom → API Access',
  },
  FATHOM_HOST_EMAIL: {
    pasos: [
        'Para qué sirve: es lo que le dice a MaKo que una grabación es tuya. Sin esto tus reuniones llegan y se descartan, sin ningún error a la vista: la conexión figura bien y el CRM queda vacío.',
        'Escribe en el campo "Email de la cuenta que graba" el correo de la cuenta de Fathom que graba las llamadas — el mismo con el que entras a fathom.video.',
        'Si en tu equipo graban varias personas, escribe el de la cuenta dueña de la grabación: la que Fathom muestra como anfitrión de la reunión.',
        'Escríbelo tal cual, sin espacios delante ni detrás. Las mayúsculas no importan: se compara en minúscula contra el correo que manda Fathom en cada aviso.',
      ],
  },
  FATHOM_WEBHOOK_SECRET: {
    pasos: [
        'Para qué sirve: sin esto tus reuniones llegan horas después; con esto llegan apenas cortas la llamada. Esa diferencia es la que permite mandarle el resumen al cliente mientras la charla está fresca, y no al día siguiente.',
        'La genera Fathom cuando creas un webhook, que es un aviso automático: hace que Fathom le avise a MaKo apenas termina una grabación, en vez de que MaKo tenga que salir a preguntar cada tanto.',
        'Entra a fathom.video y toca tu foto o tus iniciales, arriba a la derecha.',
        'Elige "Settings" (Fathom a esa pantalla la llama "User Settings").',
        'Baja hasta la sección "API Access" y toca "Manage". Si no ves esa sección, tu plan de Fathom no la incluye.',
        'Toca "Add Webhook".',
        'En el campo de la dirección de destino pega esta dirección: {{APP_URL}}/api/webhooks/fathom — es el buzón de MaKo. Más abajo en esta pantalla hay un recuadro amarillo con esa misma dirección y un botón "Copiar".',
        'Donde Fathom pregunta qué grabaciones disparan el aviso, marca "My Recordings": son las que grabas tú. Esa va siempre.',
        'Si trabajas con gente de afuera que te comparte sus grabaciones, marca también "External Recordings": son las que graba alguien ajeno a tu equipo y comparte contigo.',
        'Si tu plan es Team y quieres además las llamadas que graban tus compañeros, marca la opción de grabaciones del equipo ("Team Recordings"). Sin esa, las llamadas de tu equipo no llegan nunca. Si tu plan no es Team, esa opción no aparece: no te falta nada.',
        'Más abajo, Fathom te deja elegir qué información mandar en cada aviso: es una lista de casillas. Marca la que diga "transcript" o "include transcript" — es el texto escrito de lo que se habló, y sin eso MaKo no puede confirmar que el cliente habló ni analizar la reunión. Si no encuentras ninguna casilla parecida, deja todo como viene: Fathom manda la transcripción por defecto en las cuentas nuevas.',
        'Guarda el webhook. Fathom te muestra una contraseña que empieza con whsec_: cópiala ahí mismo, porque se muestra UNA sola vez.',
        'Pega esa contraseña en el campo "Contraseña del webhook". Si cerraste la ventana sin copiarla, borra el webhook y créalo de nuevo.',
      ],
    url: 'https://fathom.video/customize#api-access-header',
    urlLabel: 'Fathom → API Access',
  },
  PANDA_API_KEY: {
    pasos: [
        'Para qué sirve: es el permiso que deja a MaKo leer cuánta gente le dio play a tu video de ventas y hasta qué minuto lo miró.',
        'Entra a dashboard.pandavideo.com con tu cuenta.',
        'Abre el menú de Panda (en el celular es el botón de las tres rayitas, arriba) y entra a "Settings".',
        'Dentro de Settings abre la pestaña "Advanced".',
        'Toca "Generate new API key".',
        'Copia la key que aparece —esa cadena larga de letras y números que se pega una sola vez— y pégala en el campo "API key".',
        'Guarda esa key también en otro lado: si la pierdes tienes que generar una nueva, y al hacerlo la anterior deja de funcionar.',
        'Esa key da acceso completo a tu cuenta de Panda: no la compartas ni la pegues en tu página.',
        'Si tienes la cuenta de Panda en portugués, los rótulos dicen "Configurações" y "Avançado": es el mismo camino.',
      ],
    url: 'https://dashboard.pandavideo.com',
    urlLabel: 'Panda Video → Settings → Advanced',
  },
  PANDA_VSL_VIDEO_IDS: {
    pasos: [
        'Para qué sirve: le dice a MaKo de cuál de tus videos traer los números. Sin esto la conexión queda guardada igual, pero no llega ninguna métrica de reproducción.',
        'Tu VSL es tu video de ventas: el que le muestras a la gente antes de que agende contigo.',
        'Entra a dashboard.pandavideo.com, abre el menú (en el celular es el botón de las tres rayitas, arriba) y entra a "Videos".',
        'Abre tu video de ventas.',
        'Arriba a la derecha toca "Embed". Se abre una ventana con el código que sirve para poner el video en una página.',
        'Si esa ventana tiene un selector que dice "Platform", elige "Custom": con las otras opciones el código no muestra el dato que hace falta.',
        'En ese código busca el trozo que dice ?v= . Justo después viene un texto largo con guiones, así: b1e4f0c2-3a5d-4f21-9c88-0d1e2f3a4b5c',
        'Ese texto es el ID: empieza después del signo = y termina antes de la comilla que sigue. Cópialo.',
        'Pégalo en el campo "IDs de videos del VSL".',
        'Si tienes varias versiones de tu video de ventas, repite con cada una y pega todos los IDs separados por coma.',
        'Ojo: el número que aparece en la barra del navegador al abrir el video NO sirve. Panda maneja dos identificadores distintos y el que funciona es el del código de "Embed".',
      ],
    url: 'https://dashboard.pandavideo.com',
    urlLabel: 'Panda Video → Videos → Embed',
  },
  YOUTUBE_API_KEY: {
    pasos: [
        'Para qué sirve: es el permiso que deja a MaKo contar cuántas veces se reprodujo tu video de ventas alojado en YouTube.',
        'Entra a console.cloud.google.com con la misma cuenta de Google con la que entras a YouTube. Es el panel de Google para desarrolladores: vas a crear una carpeta, prender una función y copiar una key.',
        'Arriba a la izquierda, al lado del logo, toca el selector de proyecto y luego "Proyecto nuevo". Un proyecto es esa carpeta donde Google guarda lo que crees.',
        'Ponle cualquier nombre (por ejemplo MaKo) y créalo.',
        'Espera a que arriba figure ese proyecto como el elegido.',
        'Abre el menú de Google Cloud (en el celular es el botón de las tres rayitas, arriba a la izquierda) y entra a "APIs y servicios".',
        'Dentro entra a "Biblioteca".',
        'Escribe "YouTube Data API v3" en el buscador y abre el resultado que se llame exactamente así.',
        'Toca "Habilitar" y espera unos segundos. Es gratis y no pide tarjeta.',
        'Vuelve al mismo menú, a "APIs y servicios", y entra a "Credenciales".',
        'Arriba toca "Crear credenciales".',
        'En la lista que se abre elige "Clave de API".',
        'Copia la key —empieza con AIza— y pégala en el campo "API key".',
        'Si tu cuenta de Google está en inglés, esos menús dicen "APIs & Services", "Library", "Credentials", "Create credentials" y "API key": es el mismo camino.',
      ],
    url: 'https://console.cloud.google.com/apis/credentials',
    urlLabel: 'Google Cloud Console → Credenciales',
  },
  YOUTUBE_VSL_VIDEO_ID: {
    pasos: [
        'Para qué sirve: le dice a MaKo de cuál video traer las reproducciones. Sin esto la key funciona igual, pero no se cuenta ninguna vista.',
        'Tu VSL es tu video de ventas: el que le muestras a la gente antes de que agende contigo.',
        'Abre ese video en youtube.com.',
        'Mira la dirección de la página: dice algo como youtube.com/watch?v=dQw4w9WgXcQ',
        'El ID es lo que va después de v= — en el ejemplo, dQw4w9WgXcQ. Si después hay un signo &, corta ahí: lo que sigue no forma parte del ID.',
        'Si en vez de eso tienes un link corto tipo youtu.be/dQw4w9WgXcQ, el ID es lo que va después de la barra.',
        'Pégalo en el campo "ID del video del VSL".',
      ],
  },
  YOUTUBE_OAUTH_CLIENT_ID: {
    pasos: [
        'Para qué sirve: solo hace falta si además de las reproducciones quieres la retención y las vistas diarias de TU canal. Para contar reproducciones no se usa: si no lo necesitas, déjalo vacío y no te falta nada.',
        'Aviso antes de empezar: este campo y los dos que le siguen se sacan de pantallas pensadas para programadores, y MaKo todavía no tiene un botón que lo haga por ti. Si prefieres, déjalos los tres vacíos o pídeselo a quien te lleva la parte técnica.',
        'Entra a console.cloud.google.com con la cuenta de Google dueña del canal, y elige arriba el mismo proyecto donde creaste la "API key" de YouTube.',
        'Abre el menú (en el celular es el botón de las tres rayitas, arriba a la izquierda), entra a "APIs y servicios" y luego a "Biblioteca".',
        'Busca "YouTube Analytics API" y ábrela.',
        'Toca "Habilitar".',
        'Ahora entra a console.cloud.google.com/auth/clients y toca "Crear cliente".',
        'En el tipo de aplicación elige "Aplicación web".',
        'En "URIs de redireccionamiento autorizados" agrega esta dirección: https://developers.google.com/oauthplayground',
        'Toca "Crear".',
        'Copia el "Client ID" que aparece —termina en .apps.googleusercontent.com— y pégalo en el campo "OAuth Client ID".',
        'No cierres esa ventana: el "Client secret" del campo siguiente se muestra ahí mismo y después no se puede volver a ver.',
      ],
    url: 'https://console.cloud.google.com/auth/clients',
    urlLabel: 'Google Cloud → Clientes OAuth',
  },
  YOUTUBE_OAUTH_CLIENT_SECRET: {
    pasos: [
        'Para qué sirve: va de a pares con el "OAuth Client ID". Los dos juntos solo hacen falta si quieres la retención y las vistas diarias de TU canal; si dejaste ese campo vacío, este también va vacío.',
        'Entra a console.cloud.google.com/auth/clients con la cuenta de Google dueña del canal.',
        'Apenas creas el cliente OAuth del campo anterior, Google muestra el secret en la misma ventana.',
        'Cópialo en ese momento —empieza con GOCSPX-— y pégalo en el campo "OAuth Client secret". Se muestra UNA sola vez.',
        'Si ya cerraste esa ventana no hay forma de volver a verlo: crea un cliente OAuth nuevo y usa el par nuevo entero, tanto el ID como el secret.',
      ],
    url: 'https://console.cloud.google.com/auth/clients',
    urlLabel: 'Google Cloud → Clientes OAuth',
  },
  YOUTUBE_OAUTH_REFRESH_TOKEN: {
    pasos: [
        'Para qué sirve: es el permiso, dado una sola vez, para que MaKo lea las estadísticas de tu canal. Va junto con el "OAuth Client ID" y el "OAuth Client secret": si dejaste esos dos vacíos, este también.',
        'Aviso: hoy este dato solo se consigue en una herramienta de Google pensada para programadores, y MaKo no tiene una pantalla que lo haga por ti. Si algo de esto no te cierra, déjalo vacío: las reproducciones del video se cuentan igual.',
        'Entra a developers.google.com/oauthplayground.',
        'Arriba a la derecha toca el engranaje, que abre "OAuth 2.0 Configuration".',
        'Marca la casilla "Use your own OAuth credentials".',
        'Pega tu "OAuth Client ID" y tu "OAuth Client secret" en los dos campos que aparecen.',
        'Comprueba que "Access type" quede en "Offline". Si queda en "Online", Google no devuelve ningún refresh token y hay que empezar de nuevo.',
        'En el bloque "Step 1", en el campo de abajo donde se escribe un permiso a mano, pega esto: https://www.googleapis.com/auth/yt-analytics.readonly',
        'Toca "Authorize APIs".',
        'Google te pide iniciar sesión: hazlo con la cuenta dueña del canal y acepta.',
        'Vuelves al Playground, al bloque "Step 2". Toca "Exchange authorization code for tokens".',
        'Copia el valor que aparece en "Refresh token" y pégalo en el campo "OAuth Refresh token".',
      ],
    url: 'https://developers.google.com/oauthplayground',
    urlLabel: 'OAuth 2.0 Playground',
  },
  CALENDLY_API_TOKEN: {
    pasos: [
        'Para qué sirve: es el token con el que MaKo lee tu agenda de Calendly, para que no se te pierda ninguna reunión — trae las que ya están agendadas y recupera las que hayan quedado afuera del CRM.',
        'Entra a calendly.com con la cuenta donde recibes las reuniones.',
        'Abre el menú principal (en el celular es el botón de las tres rayitas, arriba) y entra a "Automations".',
        'Arriba de esa pantalla abre la pestaña "Integrations & apps". Si tu cuenta muestra "Integrations & apps" suelto en el menú principal, entra ahí directamente: es la misma pantalla.',
        'Busca el recuadro que dice "API and webhooks" y ábrelo.',
        'Baja hasta "Personal access tokens" y toca "Generate new token". Si nunca creaste uno, ese botón dice "Get a token now".',
        'Escribe un nombre para reconocerlo después, por ejemplo MaKo.',
        'Toca "Create token".',
        'Toca "Copy token". Calendly lo muestra UNA sola vez: si cierras esa ventana sin copiarlo, no hay forma de recuperarlo y tienes que generar otro.',
        'Pega ese token en el campo "Personal access token".',
        'Guarda. MaKo prueba la conexión sola al guardar y te dice con qué cuenta de Calendly quedó conectada: si no es la que esperabas, es que copiaste el token de otra cuenta.',
        'El token funciona en cualquier plan de Calendly, incluso el gratis.',
      ],
    url: 'https://calendly.com/integrations/api_webhooks',
    urlLabel: 'Calendly → API and webhooks',
  },
  CALENDLY_EVENT_TYPE_J1: {
    pasos: [
        'Para qué sirve: es lo que le dice a MaKo que esa reserva es TUYA. Sin este dato, las reuniones que agende tu gente no entran a tu CRM y no vas a ver ningún error — así que no lo dejes vacío aunque uses un solo link de agenda. De paso, es lo que distingue tu primera reunión ("R1") de la segunda.',
        'En Calendly, cada link de agenda se llama un "Event Type". Entra a calendly.com y mira la lista de la pantalla principal: ahí están todos, con su nombre.',
        'Copia el nombre del que usas para tu primera reunión, tal cual figura en Calendly (por ejemplo Llamada de auditoría).',
        'Pega ese nombre en el campo "Tipo de evento de R1". Con el nombre alcanza: MaKo también reconoce la reunión por ahí.',
        'El campo acepta además la dirección técnica del Event Type, la que empieza con https://api.calendly.com/event_types/. Esa no está en ninguna pantalla de Calendly: sale de su API, así que solo la tienes si te la pasó tu agencia o tu programador.',
      ],
    url: 'https://developer.calendly.com/api-docs/e17ac52b4b6f0-list-user-s-event-types',
    urlLabel: 'Calendly → List Event Types',
  },
  CALENDLY_EVENT_TYPE_J2: {
    pasos: [
        'Para qué sirve: es opcional, y sirve para que MaKo sepa que esa reserva es tu segunda reunión ("R2"), la de cierre, y no la primera. Llénalo solo si tu segunda reunión se agenda con un link distinto al de la primera.',
        'En Calendly, cada link de agenda se llama un "Event Type". Entra a calendly.com y mira la lista de la pantalla principal: ahí están todos, con su nombre.',
        'Copia el nombre del que usas para la segunda reunión, tal cual figura en Calendly (por ejemplo Reunión de cierre).',
        'Pega ese nombre en el campo "Tipo de evento de R2".',
        'Una segunda reunión nunca crea un contacto nuevo en el CRM: completa el que ya existe.',
        'El campo acepta además la dirección técnica del Event Type, la que empieza con https://api.calendly.com/event_types/. Esa no está en ninguna pantalla de Calendly: sale de su API, así que solo la tienes si te la pasó tu agencia o tu programador.',
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
      'Para qué sirve: MaKo lee los commits que entran a main y propone cerrar las tareas de desarrollo que ya están hechas.',
      'Entra a github.com/settings/personal-access-tokens/new (por el menú es "Settings" → "Developer settings" → "Personal access tokens" → "Fine-grained tokens" → "Generate new token").',
      'Ponle un nombre —por ejemplo "MaKo — cerrar tareas"— y una fecha de expiración. Anota esa fecha: cuando venza, MaKo deja de proponer cierres y no avisa solo.',
      'En "Resource owner" elige al dueño del repo. Si el repo es de una organización y no la ves en la lista, es que tu cuenta no tiene permiso para pedir tokens ahí.',
      'En "Repository access" elige "Only select repositories" y marca SOLO el repo del producto.',
      'En "Permissions" → "Repository permissions" → "Contents", elige "Read-only". Nada más: con eso alcanza y el token no puede escribir.',
      'Toca "Generate token".',
      'Copia el token y pégalo en el campo "Token de acceso". Se muestra UNA sola vez.',
      'El repositorio NO hace falta escribirlo: MaKo lo saca del token.',
      'Si el repo es de una organización, el token queda en "Pending" hasta que un owner de la org lo apruebe. Hasta entonces la API contesta 404 y no 403, así que el síntoma es «el repo no existe» aunque el token esté perfecto.',
    ],
    url: 'https://github.com/settings/personal-access-tokens/new',
    urlLabel: 'GitHub → Fine-grained tokens',
  },
  GITHUB_REPO: {
    pasos: [
      'Para qué sirve: es opcional y casi siempre se completa solo. Al guardar el token, MaKo pregunta a GitHub a qué repos da acceso y, si es uno solo, lo completa solo, sin que hagas nada.',
      'Llénalo a mano únicamente si el token da acceso a varios repos y MaKo te pide elegir cuál.',
      'El formato es usuario/repositorio, tal cual aparece en la dirección de GitHub: en github.com/mbustos-digital/dashboard-marketing, va mbustos-digital/dashboard-marketing.',
      'Si te equivocaste de repo, cámbialo en este campo: MaKo pasa a leer los commits del nuevo.',
    ],
    url: 'https://github.com/settings/personal-access-tokens',
    urlLabel: 'GitHub → Fine-grained tokens',
  },
  CALCOM_WEBHOOK_SECRET: {
    pasos: [
      'Para qué sirve: es lo que hace que cada reserva de tu calendario entre sola al CRM. Sin esta contraseña no entra ninguna: MaKo las rechaza.',
      'Un webhook es un aviso automático: hace que Cal.com le avise a MaKo apenas alguien reserva, en vez de que MaKo tenga que salir a preguntar cada tanto. Esta contraseña es la que le prueba a MaKo que el aviso salió de TU calendario y no lo inventó otro.',
      'Empieza por este campo, porque el dato lo inventas tú: escribe en este campo una contraseña propia.',
      'No tiene que ser difícil de recordar, tiene que ser larga: sirve el nombre de tu negocio pegado a un año y unos números, por ejemplo inmobiliariaperez2026clave. No es tu contraseña de Cal.com ni la de MaKo: es una clave que van a conocer solamente esas dos herramientas.',
      'Más abajo en esta pantalla hay un recuadro que dice "Pega esta dirección dentro de Cal.com", con un botón para copiarla. Tócalo: eso copia el buzón de MaKo, la dirección donde Cal.com va a avisar cada reserva.',
      'Entra a app.cal.com con la cuenta donde recibes las reservas.',
      'Abre la pantalla de avisos automáticos: app.cal.com/settings/developer/webhooks (por el menú es "Settings" → "Developer" → "Webhooks").',
      'Toca el botón "+ New", arriba a la derecha.',
      'Pega en el campo "Subscriber Url" la dirección que copiaste recién.',
      'Más abajo hay una lista llamada "Event Triggers": son los avisos que Cal.com puede mandar. Marca "Booking Created" (alguien reservó).',
      'En esa misma lista marca también "Booking Cancelled" (alguien canceló). Si no la marcas, una reunión cancelada te queda en pie en el CRM. Si vienen otros avisos marcados, puedes dejarlos: MaKo solo usa esos dos.',
      'Busca el campo "Secret" y escribe ahí EXACTAMENTE la misma contraseña que pusiste en MaKo, sin espacios de más. Si difieren en un carácter, MaKo rechaza las reservas.',
      'Si ves un interruptor que dice "Enable Webhook", déjalo encendido: apagado, Cal.com no manda nada y tampoco avisa.',
      'Guarda con el botón del final del formulario. Con eso las reservas ya entran solas.',
    ],
    url: 'https://app.cal.com/settings/developer/webhooks',
    urlLabel: 'Cal.com → Settings → Developer → Webhooks',
  },
  CALCOM_API_KEY: {
    pasos: [
      'Para qué sirve: es opcional. Solo hace falta si además quieres que MaKo lea tu agenda hacia atrás, para traer reservas viejas o recuperar alguna que se haya perdido. Las reservas nuevas entran igual sin esto.',
      'Si no lo necesitas, deja el campo vacío y no te falta nada.',
      'Entra a app.cal.com y abre "Settings" → "Developer" → "API Keys".',
      'Toca "+ New", arriba a la derecha.',
      'Ponle un nombre para reconocerla después, por ejemplo MaKo.',
      'Donde dice la fecha de vencimiento, activa "Never expires". Si le dejas fecha, la key deja de funcionar sola meses después y sin avisar.',
      'Confirma.',
      'Copia la key en ese momento: empieza con cal_live_ y se muestra UNA sola vez.',
      'Pégala en el campo "API key". Si cerraste la ventana sin copiarla, bórrala de la lista en Cal.com y crea otra.',
    ],
    url: 'https://app.cal.com/settings/developer/api-keys',
    urlLabel: 'Cal.com → Settings → Developer → API Keys',
  },
  CALCOM_EVENT_TYPE_J1: {
    pasos: [
      'Para qué sirve: es lo que le dice a MaKo que esa reserva es TUYA. Sin este dato, las reuniones que agende tu gente no entran a tu CRM y no vas a ver ningún error.',
      'Llénalo aunque uses un solo link de agenda. Si además tu segunda reunión va por otro link, llena también el de abajo y MaKo las distingue; si no, todas entran como primera reunión.',
      'Abre tu página de reservas de Cal.com, la que le pasas a la gente.',
      'Mira su dirección: es algo como cal.com/juan/llamada-de-auditoria',
      'Lo que va en este campo es lo último, después de la última barra: en el ejemplo, llamada-de-auditoria',
      'También funciona con el nombre de la reunión tal cual figura en Cal.com, si te resulta más fácil de encontrar.',
    ],
  },
  CALCOM_EVENT_TYPE_J2: {
    pasos: [
      'Para qué sirve: es opcional. Sirve para que MaKo sepa que esa reserva es tu segunda reunión con un interesado — lo que en el CRM se llama "R2".',
      'Llénalo solo si usas dos links de agenda distintos, uno para cada reunión, y quieres que MaKo las distinga. Si los dejas vacíos, todas las reservas entran como primera reunión.',
      'Abre tu página de reservas de Cal.com, la que le pasas a la gente.',
      'Mira su dirección: es algo como cal.com/juan/llamada-de-auditoria',
      'Lo que va en este campo es lo último, después de la última barra: en el ejemplo, llamada-de-auditoria',
      'También funciona con el nombre de la reunión tal cual figura en Cal.com, si te resulta más fácil de encontrar.',
      'Una segunda reunión nunca crea un contacto nuevo: completa el que ya existe.',
    ],
  },
  CALENDLY_WEBHOOK_SIGNING_KEY: {
    pasos: [
        'Para qué sirve: es opcional y la mayoría lo deja vacío. Un webhook es un aviso automático: hace que Calendly le avise a MaKo apenas alguien reserva, en vez de que MaKo tenga que salir a preguntar cada tanto. Esta signing key es la contraseña de ese aviso, y es lo que le prueba a MaKo que la reserva salió de tu calendario.',
        // ⚠️ ACÁ DECÍA «tus reuniones igual entran, porque MaKo lee tu agenda con el
        // Personal access token», y es FALSO para una reserva nueva: no hay ningún cron
        // que ingiera la agenda. Con el token MaKo COMPLETA las fechas de un lead que ya
        // existe (`auto-reuniones.ts`, al mover una tarjeta del CRM) y RESERVA (`calendly-
        // agenda.ts`). Lo que crea el contacto a partir de una reserva es el webhook, y
        // nada más. Lo medido el 04/10/2026 es el otro lado del mismo mal entendido.
        'Calendly no tiene ninguna pantalla para crear ese aviso: se crea por programación. Si nunca te montaron uno, deja el campo vacío. Ojo con una cosa: lo que hace que una reserva NUEVA entre sola a tu CRM es ese aviso — sin él, MaKo usa tu agenda para completar los datos de alguien que ya está en el CRM, pero no crea el contacto.',
        'Si te lo montó tu agencia o tu programador, pídele la signing key con la que lo creó.',
        'Pega ese valor en el campo "Signing key del webhook", idéntico: si difiere en un carácter, MaKo rechaza cada aviso que llega.',
        'Si lo montas tú: el aviso se crea con una llamada POST a https://api.calendly.com/webhook_subscriptions usando tu personal access token, y la signing key es un texto largo que eliges tú y mandas en el campo "signing_key" de esa llamada. Ese mismo valor va en este campo.',
        'Ten en cuenta que estos avisos automáticos solo funcionan en los planes pagos de Calendly (Professional, Standard, Standard Plus, Teams, Teams Plus o Enterprise).',
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
  // Una cuenta EXTRA (`GEMINI_API_KEY_2`) se consigue igual que la primera: el
  // tutorial es el de su clave base. Sin esto, el "?" de la segunda key no abre
  // nada — y es justo donde el usuario más lo necesita (tiene que crear una
  // cuenta nueva en el proveedor, no repetir la que ya tiene).
  const a = AYUDA_CAMPO[env] ?? AYUDA_CAMPO[claveBaseDe(env)];
  if (!a) return null;
  return { ...a, pasos: a.pasos.map(conUrlReal) };
}
