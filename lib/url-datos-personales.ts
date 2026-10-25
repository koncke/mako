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
// =============================================================================

/** Nombres que son datos de una persona (sin mayúsculas ni acentos; guiones y espacios como `_`). */
const PERSONALES = new Set([
  // Nombre
  'name', 'nombre', 'nombres', 'nome', 'firstname', 'first_name', 'lastname', 'last_name', 'fullname', 'full_name', 'fname', 'lname',
  'apellido', 'apellidos', 'sobrenome', 'nombre_completo', 'nombrecompleto', 'nombre_y_apellido', 'your_name', 'customer_name',
  'client_name', 'cliente_nombre', 'contact_name', 'lead_name', 'user_name',
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

/**
 * Los pares de una query (o de un `#a=b&…`) sin los personales, con sus separadores (`&` o `;`) tal cual; null si no
 * cambió nada. Un valor que es una URL (o trae su propio `?…`) se limpia adentro y se vuelve a codificar.
 */
function sinPersonales(parte: string): string | null {
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
    if (par && esParametroPersonal(k, v)) { cambio = true; continue; }
    let nuevo = par;
    // Una URL o una query ADENTRO del valor (`?next=https%3A…%3Fname%3DAna`, o un `?` repetido: `?plan=pro?name=Ana`).
    const dv = decodificar(v);
    if (eq >= 0 && /[?&;#][^=]*=/.test(dv)) {
      const limpio = urlSinDatosPersonales(dv);
      if (limpio !== dv) nuevo = `${k}=${v.includes('%') || v !== dv ? encodeURIComponent(limpio) : limpio}`;
    }
    if (nuevo !== par) cambio = true;
    salida.push(salida.length ? (sep || '&') : '', nuevo);
  }
  return cambio ? salida.join('') : null;
}

/**
 * La URL sin los datos de una persona en su query (ni en un `#…`: con forma de query, o un router con `#/ruta?…`). Lo
 * demás, intacto: una URL que no trae datos personales vuelve IDÉNTICA. Acepta cualquier texto (una URL relativa, una
 * rota, el «href — texto» de un clic): sólo mira lo que va después del `?` y del `#`.
 */
export function urlSinDatosPersonales(url: string): string {
  const s = String(url ?? '');
  const h = s.indexOf('#');
  const sinHash = h >= 0 ? s.slice(0, h) : s;
  // El `#…` tal cual (con su `#`), salvo que traiga datos personales: un router con hash lleva su propia ruta y query.
  let cola = h >= 0 ? s.slice(h) : '';
  if (h >= 0 && cola.includes('=')) {
    const adentro = cola.slice(1);
    const limpio = adentro.includes('?') ? urlSinDatosPersonales(adentro) : (sinPersonales(adentro) ?? adentro);
    if (limpio !== adentro) cola = limpio ? `#${limpio}` : '';
  }
  const q = sinHash.indexOf('?');
  let base = sinHash;
  if (q >= 0) {
    const limpia = sinPersonales(sinHash.slice(q + 1));
    if (limpia !== null) base = sinHash.slice(0, q) + (limpia ? `?${limpia}` : '');
  }
  return base + cola;
}
