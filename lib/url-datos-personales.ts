// =============================================================================
// url-datos-personales — sacar de una URL los datos de una PERSONA antes de guardarla (24/10/2026, P6)
// =============================================================================
// La página de gracias de una agenda lleva los datos de quien agendó en la URL: Calendly redirige a
// `…/gracias?name=Ana+Pérez&email=ana@…` (y `rescheduledby=<email>` al reprogramar). El Pixel manda la URL de cada
// página que se ve, y la guardábamos ENTERA: medido el 24/10/2026 (sólo lectura), 487 filas de `vsl_events.landing_url`
// y 112 de `landing_visits.landing_url` con nombre y email en claro, de Código Inmobiliario (~75 personas) y de P2P
// Consulting (3). Que el Pixel le pase esos datos a Meta (CAPI) está bien: van hasheados y lo hace el navegador. Lo que no
// estaba bien es que NOSOTROS los guardáramos en tablas de eventos que no son el lugar de los datos de una persona
// (docs/pendientes.md, P6; docs/hallazgos-landing.md, «Hay dos normalizarUrl…»).
//
// LA REGLA: un parámetro se va si su NOMBRE es de un dato personal (nombre, email, teléfono, documento, los `invitee_*`,
// las respuestas de Calendly) o si su NOMBRE o su VALOR traen un email. Lo demás se queda tal cual, BYTE POR BYTE (las
// UTM, los ids de clic, el marcador de prueba): una URL sin datos personales sale igual que entró, así nada que compare
// URLs cambia. Una URL ADENTRO de un parámetro (`?next=https%3A…%3Fname%3D…`, o un `?` repetido) se limpia igual.
// ⚠️ NO por «parece un teléfono» sin más: los ids de campaña de Meta (`utm_id=1202…`) son números largos y no son de nadie
//    (en la medición, 84 mil filas eran eso). Un nombre de TELÉFONO sí, pero sólo si el valor trae dígitos (`tel=1` no).
// ⚠️ Revisión adversarial del 24/10 (docs/hallazgos-landing.md, P6): los nombres de Hotmart y Calendly prellenado, las
//    claves con corchetes (`data[phone]`), `&amp;`, `;`, la doble codificación y el router con `#` entran por acá.
//
// Lo usan las rutas del Pixel (app/api/track/vsl, optin y replay) y `normalizarUrl` (lib/landing-paginas.ts).
// ⚠️ PURO: lo importa una lib que también corre en el navegador.
//
// ⚠️ EL MÓDULO TIENE DOS REGLAS PORQUE HAY DOS PREGUNTAS (30/10/2026), y confundirlas sale caro en los dos
// sentidos. «¿Esto es de una persona?» (lista negra, `urlSinDatosPersonales`) es la que vale para IDENTIFICAR
// una página o un destino de clic: ahí un `?plan=pro` informa y tiene que quedar. «¿Esto se guarda?» (lista
// blanca, `urlDeEntradaGuardable`) es la que vale para una columna de ANALÍTICA, y la de abajo explica por qué
// una lista negra no puede contestarla.
// =============================================================================

/** Nombres que son datos de una persona (sin mayúsculas ni acentos; guiones y espacios como `_`). */
const PERSONALES = new Set([
  // Nombre
  'name', 'nombre', 'nombres', 'nome', 'firstname', 'first_name', 'lastname', 'last_name', 'fullname', 'full_name', 'fname', 'lname',
  'apellido', 'apellidos', 'sobrenome', 'nombre_completo', 'nombrecompleto', 'nombre_y_apellido', 'your_name', 'customer_name',
  'client_name', 'cliente_nombre', 'contact_name', 'lead_name', 'user_name',
  // El nombre de quien agendó, como lo manda Cal.com en su página de éxito (medido el 30/10/2026 en P2P
  // Consulting: 38 filas con `attendeeName=<nombre y apellido>` que la lista negra dejaba pasar).
  'attendeename', 'attendee_name', 'attendee_email', 'attendeeemail', 'invitee', 'guest_name', 'guest_email',
  // Email
  'email', 'e_mail', 'mail', 'correo', 'correo_electronico', 'rescheduledby', 'your_email', 'customer_email',
  // El teléfono del recordatorio por SMS de Calendly
  'text_reminder_number',
  // Documento
  'dni', 'cuit', 'cuil', 'documento', 'cpf', 'cnpj', 'cedula', 'curp', 'rfc', 'ssn',
]);
/**
 * Nombres de TELÉFONO, y de documento que también pueden ser otra cosa (`doc` es el CPF en el prellenado de Hotmart, pero
 * `?doc=intro` no es de nadie): personales si el valor trae al menos 6 dígitos (`tel=1` o `mobile=1` no son un teléfono).
 */
const CON_DIGITOS = /(phone|telefon|celular|whats|wpp|movil|mobile|^tel$|^cel$|^doc$|^rut$)/;
/** Un email en un nombre o un valor (el `rescheduledby` de Calendly, o cualquier parámetro que lo traiga). */
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i;

/** Decodifica hasta tres veces (una doble codificación esconde un `@` como `%2540`); un `%` roto no lo frena. */
function decodificar(s: string): string {
  let v = s.replace(/\+/g, ' ');
  for (let i = 0; i < 3; i++) {
    let sig: string;
    try { sig = decodeURIComponent(v); } catch { sig = v.replace(/%40/gi, '@').replace(/%25/g, '%'); }
    if (sig === v) break;
    v = sig;
  }
  return v;
}

function normalizarClave(k: string): string {
  return k.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-\s]/g, '_');
}

/** ¿Este parámetro es un dato de una persona? Por su nombre (también adentro de corchetes), o por traer un email. */
export function esParametroPersonal(clave: string, valor: string): boolean {
  const k = decodificar(clave).replace(/^amp;/i, '');
  const v = decodificar(valor);
  if (EMAIL.test(k) || EMAIL.test(v)) return true;
  // `data[phone]`, `lead[nombre]`, `contact.email`: cuenta cualquiera de las partes.
  const partes = [k, ...k.split(/[[\].]+/)].map(normalizarClave).filter(Boolean);
  return partes.some((p) =>
    PERSONALES.has(p) || p.startsWith('invitee_') || /^answer_\d+$/.test(p) || /^a(10|[1-9])$/.test(p)
    || (CON_DIGITOS.test(p) && (v.replace(/\D/g, '').length >= 6)));
}

// =============================================================================
// LO QUE SE GUARDA: la lista blanca (30/10/2026)
// =============================================================================
// La lista de arriba (`PERSONALES`) contesta «¿esto es de una persona?» y sirve para IDENTIFICAR una página
// (`normalizarUrl`), donde lo que no es de medición sí identifica y tiene que quedar. Para DECIDIR QUÉ SE
// GUARDA en una columna de analítica no alcanza, y se midió por qué: el 30/10/2026, con el corte del 24/10 ya
// desplegado, `vsl_events.landing_url` seguía recibiendo de Cal.com `attendeeName=<nombre>`, `user=`, `uid=`,
// `title=`, `description=`, `location=` y `metadata[lead_id]=` — 38 filas de P2P Consulting—, porque ninguno de
// esos nombres estaba en la lista negra. Una lista negra se queda corta en cuanto el proveedor de agendas, la
// plataforma de pago o el propio cliente agregan un parámetro nuevo, y se queda corta EN SILENCIO.
//
// LA REGLA, en positivo: de la query de una URL DE ENTRADA se guarda SÓLO lo que está nombrado acá abajo, y
// BYTE POR BYTE. Todo lo demás se va, aunque no parezca de nadie. Lo que se guarda es lo que sirve para MEDIR
// —de dónde vino la visita, qué variante vio, qué video— y nada que identifique a una persona: por eso NO
// están el token de lead del link de WhatsApp (`l`, que apunta a un lead concreto), el `mc_eid` de Mailchimp
// (es el id del suscriptor; sí está `mc_cid`, que es el de la campaña) ni el `session_id` de un cobro.
//
// ⚠️ Un parámetro de esta lista con un EMAIL en el valor tampoco se guarda (`utm_content=ana@x.com` pasa en
//    las campañas de mail): estar en la lista blanca autoriza el NOMBRE, no cualquier contenido.
// ⚠️ NO se aplica a `normalizarUrl` ni a `detalle` (el destino de un clic): son otras dos preguntas y están
//    anotadas en docs/hallazgos-landing.md.
// =============================================================================

/** Los parámetros que SE GUARDAN de una URL de entrada. La migración 0357 limpia lo guardado con esta MISMA lista. */
export const PARAMS_QUE_SE_GUARDAN = [
  // De dónde vino la visita: es lo que lee `atribucionDeUrl` (lib/atribucion-url.ts) y lo que el CRM copia al lead.
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  // El clic de cada plataforma. Son ids de un ANUNCIO o de un clic, no de una persona.
  'fbclid', 'gclid', 'gbraid', 'wbraid', 'dclid', 'gad_source', 'gad_campaignid',
  'msclkid', 'ttclid', 'twclid', 'li_fat_id', 'igshid', 'yclid', 'rdt_cid', 'epik', 'scid', 'mc_cid',
  // La variante de una prueba A/B de la landing: sin esto, una prueba A/B no se puede leer en la analítica.
  'v', 'variante', 'variant', 'ab', 'ab_test', 'exp', 'experimento', 'prueba_ab',
  // Qué video del VSL se está mirando.
  'vsl', 'vsl_id', 'video', 'video_id', 'vid',
  // El nuestro: `?mko_test=<id>` abre la landing en una prueba (el probador del Pixel, el mapa en vivo). El beacon
  // lo manda además en su campo `prueba`, que es el que filtra; en la URL queda para poder ver de qué prueba era.
  'mko_test',
] as const;

const GUARDABLES = new Set<string>(PARAMS_QUE_SE_GUARDAN);

/** ¿Este parámetro se guarda? Sólo si su nombre está en la lista blanca y su valor no trae un email. */
export function paramSeGuarda(clave: string, valor: string): boolean {
  const k = decodificar(clave).replace(/^amp;/i, '');
  const v = decodificar(valor);
  if (EMAIL.test(k) || EMAIL.test(v)) return false;
  return GUARDABLES.has(normalizarClave(k));
}

/** `true` = el par se queda tal cual. */
type Criterio = (clave: string, valor: string) => boolean;

/**
 * Los pares de una query (o de un `#a=b&…`) que el criterio deja pasar, con sus separadores (`&` o `;`) tal cual;
 * null si no cambió nada. Un valor que es una URL (o trae su propio `?…`) se limpia adentro y se vuelve a codificar.
 */
function filtrarPares(parte: string, queda: Criterio, adentro: (u: string) => string): string | null {
  // `&amp;` (una URL escapada para HTML) es UN separador: partido en `&` y `;` dejaba un `amp` suelto.
  const trozos = parte.split(/(&amp;|[&;])/);
  const salida: string[] = [];
  let cambio = false;
  for (let i = 0; i < trozos.length; i += 2) {
    const par = trozos[i];
    const sep = i > 0 ? trozos[i - 1] : '';
    const eq = par.indexOf('=');
    const k = eq >= 0 ? par.slice(0, eq) : par;
    const v = eq >= 0 ? par.slice(eq + 1) : '';
    if (par && !queda(k, v)) { cambio = true; continue; }
    let nuevo = par;
    // Una URL o una query ADENTRO del valor (`?next=https%3A…%3Fname%3DAna`, o un `?` repetido: `?plan=pro?name=Ana`).
    const dv = decodificar(v);
    if (eq >= 0 && /[?&;#][^=]*=/.test(dv)) {
      const limpio = adentro(dv);
      if (limpio !== dv) nuevo = `${k}=${v.includes('%') || v !== dv ? encodeURIComponent(limpio) : limpio}`;
    }
    if (nuevo !== par) cambio = true;
    salida.push(salida.length ? (sep || '&') : '', nuevo);
  }
  return cambio ? salida.join('') : null;
}

/** La URL con sólo los pares que el criterio deja pasar, en la query y en un `#…` con forma de query. */
function limpiarUrl(url: string, queda: Criterio): string {
  const adentro = (u: string): string => limpiarUrl(u, queda);
  const s = String(url ?? '');
  const h = s.indexOf('#');
  const sinHash = h >= 0 ? s.slice(0, h) : s;
  // El `#…` tal cual (con su `#`) mientras no tenga forma de query: un router con hash lleva su propia ruta y query.
  let cola = h >= 0 ? s.slice(h) : '';
  if (h >= 0 && cola.includes('=')) {
    const dentro = cola.slice(1);
    const limpio = dentro.includes('?') ? adentro(dentro) : (filtrarPares(dentro, queda, adentro) ?? dentro);
    if (limpio !== dentro) cola = limpio ? `#${limpio}` : '';
  }
  const q = sinHash.indexOf('?');
  let base = sinHash;
  if (q >= 0) {
    const limpia = filtrarPares(sinHash.slice(q + 1), queda, adentro);
    if (limpia !== null) base = sinHash.slice(0, q) + (limpia ? `?${limpia}` : '');
  }
  return base + cola;
}

/**
 * La URL sin los datos de una persona en su query (ni en un `#…`: con forma de query, o un router con `#/ruta?…`). Lo
 * demás, intacto: una URL que no trae datos personales vuelve IDÉNTICA. Acepta cualquier texto (una URL relativa, una
 * rota, el «href — texto» de un clic): sólo mira lo que va después del `?` y del `#`.
 *
 * ⚠️ Contesta «¿qué página es ésta?» (`normalizarUrl`) y «¿a dónde fue este clic?» (`detalle`), donde lo que NO es de
 * medición sí informa y tiene que quedar. Para lo que se GUARDA en una columna de analítica va la lista blanca:
 * `urlDeEntradaGuardable`.
 */
export function urlSinDatosPersonales(url: string): string {
  return limpiarUrl(url, (k, v) => !esParametroPersonal(k, v));
}

/**
 * La URL DE ENTRADA como se guarda en una columna de analítica: la dirección tal cual y, de su query, SÓLO los
 * `PARAMS_QUE_SE_GUARDAN`. Lo que no está en la lista se va, aunque no parezca de nadie — es lo único que no se
 * queda corto cuando alguien agrega un parámetro nuevo. Una URL sin query, o con sólo parámetros de la lista,
 * vuelve IDÉNTICA: así nada que compare URLs cambia.
 *
 * Lo usan `landing_url` y `referrer` de las rutas del Pixel (app/api/track/vsl, optin y replay).
 */
export function urlDeEntradaGuardable(url: string): string {
  return limpiarUrl(url, paramSeGuarda);
}
