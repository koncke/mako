// =============================================================================
// paises — códigos de país (lada) para el selector de teléfono del onboarding
// =============================================================================
// Sin 'server-only': es data pura, se usa desde componentes cliente (el
// Dropdown de lada en OnboardingWizard.tsx). LatAm + España primero (audiencia
// real de MaKo), después el resto de América y Europa/mundo más relevante.

export type Pais = { iso2: string; dial: string; nombre: string };

/**
 * Bandera como IMAGEN (flagcdn). Los emoji de bandera NO se renderizan en
 * Windows (Chrome/Edge los muestran como letras "MX" — bug real reportado):
 * Microsoft nunca incluyó las banderas en Segoe UI Emoji. Imagen o nada.
 */
export function flagUrl(iso2: string): string {
  return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
}

export const PAISES: Pais[] = [
  // LatAm + España (audiencia principal)
  { iso2: 'MX', dial: '+52', nombre: 'México' },
  { iso2: 'ES', dial: '+34', nombre: 'España' },
  { iso2: 'AR', dial: '+54', nombre: 'Argentina' },
  { iso2: 'CO', dial: '+57', nombre: 'Colombia' },
  { iso2: 'CL', dial: '+56', nombre: 'Chile' },
  { iso2: 'PE', dial: '+51', nombre: 'Perú' },
  { iso2: 'EC', dial: '+593', nombre: 'Ecuador' },
  { iso2: 'UY', dial: '+598', nombre: 'Uruguay' },
  { iso2: 'PY', dial: '+595', nombre: 'Paraguay' },
  { iso2: 'BO', dial: '+591', nombre: 'Bolivia' },
  { iso2: 'VE', dial: '+58', nombre: 'Venezuela' },
  { iso2: 'CR', dial: '+506', nombre: 'Costa Rica' },
  { iso2: 'PA', dial: '+507', nombre: 'Panamá' },
  { iso2: 'GT', dial: '+502', nombre: 'Guatemala' },
  { iso2: 'HN', dial: '+504', nombre: 'Honduras' },
  { iso2: 'SV', dial: '+503', nombre: 'El Salvador' },
  { iso2: 'NI', dial: '+505', nombre: 'Nicaragua' },
  { iso2: 'DO', dial: '+1809', nombre: 'República Dominicana' },
  { iso2: 'PR', dial: '+1787', nombre: 'Puerto Rico' },
  { iso2: 'CU', dial: '+53', nombre: 'Cuba' },
  { iso2: 'BR', dial: '+55', nombre: 'Brasil' },
  // Norteamérica
  { iso2: 'US', dial: '+1', nombre: 'Estados Unidos' },
  { iso2: 'CA', dial: '+1', nombre: 'Canadá' },
  // Europa
  { iso2: 'GB', dial: '+44', nombre: 'Reino Unido' },
  { iso2: 'FR', dial: '+33', nombre: 'Francia' },
  { iso2: 'DE', dial: '+49', nombre: 'Alemania' },
  { iso2: 'IT', dial: '+39', nombre: 'Italia' },
  { iso2: 'PT', dial: '+351', nombre: 'Portugal' },
  { iso2: 'NL', dial: '+31', nombre: 'Países Bajos' },
  { iso2: 'CH', dial: '+41', nombre: 'Suiza' },
  { iso2: 'IE', dial: '+353', nombre: 'Irlanda' },
  // Resto del mundo (relevante)
  { iso2: 'IN', dial: '+91', nombre: 'India' },
  { iso2: 'AU', dial: '+61', nombre: 'Australia' },
  { iso2: 'AE', dial: '+971', nombre: 'Emiratos Árabes Unidos' },
];

export const PAIS_DEFAULT = 'MX';

/** El nombre de un país por su ISO-2, para escribirlo en pantalla. Uno que no esté en la lista se dice como vino. */
export const nombreDePais = (iso2: string): string =>
  PAISES.find((p) => p.iso2 === (iso2 ?? '').trim().toUpperCase())?.nombre ?? (iso2 ?? '').trim().toUpperCase();

/** ¿Es uno de los países de la lista? Lo que se guarda en una columna ISO-2 pasa por acá (el `check` de la base es de 2 letras). */
export const esPaisConocido = (iso2: unknown): boolean =>
  typeof iso2 === 'string' && PAISES.some((p) => p.iso2 === iso2.trim().toUpperCase());

/** La lada que arranca seleccionada cuando todavía no hay número. */
export const DIAL_DEFAULT = PAISES.find((p) => p.iso2 === PAIS_DEFAULT)!.dial;

/**
 * Separa un teléfono guardado en (lada, resto) para hidratar el selector.
 *
 * Heurística: la lada más LARGA que matchea primero, o `+1` le gana a `+1809`.
 *
 * ⚠️ Compara sobre DÍGITOS, no sobre el texto con `+`. La versión que vivía
 * suelta en OnboardingWizard.tsx hacía `t.startsWith(p.dial)` con el `+` puesto,
 * y todo lo que este repo GUARDA son dígitos pelados (`542233550684`): o sea,
 * para cualquier número ya guardado no matcheaba ninguna lada y caía al default
 * — México, con el `54` argentino adentro del "resto". Se ve como un país mal
 * elegido y un número imposible, y el que lo mira no tiene forma de saber por
 * qué. Vive acá y no allá para que haya UN solo separador.
 */
export function splitTelefono(telefono: string): { lada: string; resto: string } {
  const digitos = (telefono || '').replace(/\D/g, '');
  if (!digitos) return { lada: DIAL_DEFAULT, resto: '' };
  const candidatos = [...PAISES].sort((a, b) => b.dial.length - a.dial.length);
  const match = candidatos.find((p) => digitos.startsWith(p.dial.slice(1)));
  return match
    ? { lada: match.dial, resto: digitos.slice(match.dial.length - 1) }
    : { lada: DIAL_DEFAULT, resto: digitos };
}

/** La contracara: (lada, número local) → los dígitos que se guardan y se mandan. */
export function unirTelefono(lada: string, local: string): string {
  return `${lada}${local}`.replace(/\D/g, '');
}

/**
 * La lada que arranca elegida para quien está en ese país (dos letras). Un país que no está en la lista, o que no se sabe, la de siempre.
 * República Dominicana y Puerto Rico están como +1809 y +1787, que ya traen el código de área: quien escribe su número entero (829…) lo
 * tendría dos veces, así que arrancan en +1.
 */
export function ladaDelPais(iso2: string | null | undefined): string {
  const dial = PAISES.find((p) => p.iso2 === iso2)?.dial ?? DIAL_DEFAULT;
  return /^\+1\d/.test(dial) ? '+1' : dial;
}

/**
 * Los dígitos que escribió en un formulario público con `TelefonoConPais`, con su lada, o '' si no escribió ningún número (la lada
 * sola no es un número). Sin el 0 de larga distancia del número local: «+54 011…» no existe. Un `+código` que el selector no
 * reconoció sigue en el campo (`numeroTecleado`): ahí ya viene el país, y sumarle la lada serían dos. Lo mismo sin el `+` («54 9 11…»,
 * «0054…»): con 11 dígitos o más ya no es un número local, y si arranca con la lada elegida, ésa es la que trae. Con menos no se toca:
 * 5512345678 es un celular de México, no un +52 sin terminar. Con +54, el celular lleva el 9 (`localArgentino`).
 * AUNQUE NO ESTÉ COMPLETO: es para decir QUÉ le falta (el formulario de MaKo Accelerator, `faltaAlWhatsapp`). Lo que se manda es
 * `telefonoDeFormulario`.
 */
export function digitosDeFormulario(lada: string, local: string): string {
  const t = (local || '').trim();
  const digitos = t.replace(/\D/g, '');
  if (!digitos) return '';
  if (t.startsWith('+')) return digitos;
  const pais = lada.replace(/\D/g, '');
  const sinCero = digitos.replace(/^0+/, '');
  const resto = sinCero.length >= 11 && sinCero.startsWith(pais) ? sinCero.slice(pais.length) : sinCero;
  return unirTelefono(lada, pais === '54' ? localArgentino(resto) : resto);
}

/**
 * Lo que manda un formulario público con `TelefonoConPais` (`digitosDeFormulario`), o '' si no escribió un número que sirva: un
 * WhatsApp de Argentina sin el código de área, o que no es 549 y 10 dígitos (`faltaAlWhatsapp`), no se manda. Así el botón del
 * checkout (app/planes/[plan]/CompraPlan.tsx, «al menos 10 dígitos») queda apagado con «5555-1234», que con el 54 sumaba 10, y el
 * campo dice qué falta (`TelefonoConPais`, revisión del 16/11/2026, hallazgo 3).
 */
export function telefonoDeFormulario(lada: string, local: string): string {
  const d = digitosDeFormulario(lada, local);
  return d && faltaAlWhatsapp(d) ? '' : d;
}

/** Lo que se le dice a quien escribe un celular de Argentina sin el código de área («15 2345 6789», «5555-1234»). */
export const TEXTO_FALTA_EL_AREA = 'Agrega el código de área (11 en Buenos Aires).';
/** Y a quien escribe uno de Argentina que no puede ser un número (le faltan o le sobran dígitos). */
export const TEXTO_NUMERO_ARGENTINO_INCOMPLETO = 'Ese número no parece completo. Revísalo.';

/**
 * EL WHATSAPP CON SU PAÍS (los dígitos, E.164 sin el «+»), como lo guarda un servidor: con 54, el celular con el 9 (`localArgentino`);
 * de otro país, tal cual. (Revisión del 16/11/2026, hallazgo 3: sólo lo hacía el navegador, y una pestaña con el código de antes o
 * un POST directo guardaban el número sin el 9.) Ningún otro código de país empieza con 54.
 */
export function whatsappNormalizado(digitos: string): string {
  const d = (digitos || '').replace(/\D/g, '');
  return d.startsWith('54') ? `54${localArgentino(d.slice(2))}` : d;
}

/**
 * ¿QUÉ LE FALTA A UN WHATSAPP DE ARGENTINA? (16/11/2026, revisión, hallazgo 3.) Los dígitos con el 54, normalizados
 * (`whatsappNormalizado`). Completo es 549, el código de área y el número: 10 dígitos que empiezan con 11, 2 o 3 (todos los códigos
 * de área de Argentina). 'area': escribió el número sin el código de área —8 dígitos, o 10 que empiezan con 15, el del celular:
 * ningún código de área empieza con 15—, que con +54 y la regla de «10 dígitos o más» pasaba («5555-1234» quedaba 5455551234, y
 * «15 2345 6789», 5491523456789: un código de área que no existe). 'numero': cualquier otra cosa que no es 549 y esos 10 dígitos.
 * null: está completo, o no es de Argentina (ahí no se mira).
 */
export function faltaAlWhatsapp(digitos: string): 'area' | 'numero' | null {
  const n = whatsappNormalizado(digitos);
  if (!n.startsWith('54')) return null;
  const local = n.slice(2);
  const nacional = local.startsWith('9') ? local.slice(1) : local;
  if (nacional.length === 8 || (nacional.length === 10 && nacional.startsWith('15'))) return 'area';
  return /^549(?:11\d{8}|[23]\d{9})$/.test(n) ? null : 'numero';
}

/**
 * El WhatsApp de un PEDIDO que llega al servidor del checkout (lib/compra-plan.ts): normalizado (`whatsappNormalizado`), o por qué
 * no sigue (un número de Argentina que no sirve, `faltaAlWhatsapp`). Lo de otro país lo sigue mirando la ruta (`whatsappEscritoMal`).
 * El texto nombra al WhatsApp: llega arriba del botón, no debajo del campo (sólo lo ve una pestaña de antes o un POST directo; el
 * formulario de hoy no lo manda).
 */
export function whatsappDelPedido(digitos: string | null | undefined): { ok: true; whatsapp: string | null } | { ok: false; error: string } {
  if (!digitos) return { ok: true, whatsapp: digitos ?? null };
  const falta = faltaAlWhatsapp(digitos);
  if (falta === 'area') return { ok: false, error: 'A tu WhatsApp le falta el código de área (11 en Buenos Aires).' };
  if (falta === 'numero') return { ok: false, error: 'Ese WhatsApp no parece completo. Revísalo.' };
  return { ok: true, whatsapp: whatsappNormalizado(digitos) };
}

/**
 * EL CELULAR ARGENTINO LLEVA EL 9 (16/11/2026, revisión del formulario del Accelerator, hallazgo 2). Para WhatsApp, un celular de
 * Argentina es +54 9 <área sin el 0> <número sin el 15>: 10 dígitos después del 9. Quien lo escribe como lo marca en Argentina
 * («11 2345 6789», «011 15 2345-6789», «223 15 555 1234») mandaba +54 11 2345 6789, sin el 9: la validación lo aceptaba (tiene los
 * dígitos) y a ese número WhatsApp no lo encuentra, así que el `wa.me` del correo y el mensaje de la agenda iban a ningún lado.
 * Acá: sin el 0, sin el 15 que va después del código de área y, si quedan 10 dígitos que no empiezan con 9, con el 9 adelante.
 * Ningún código de área argentino empieza con 9 (son 11, 2xx(x) y 3xx(x)), así que un 9 adelante es siempre el del celular. Lo que no
 * se reconoce (otro largo) queda como vino: no se inventa un número.
 */
export function localArgentino(local: string): string {
  const d = (local || '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.startsWith('9')) {
    // «9 11 15 2345 6789»: ya trae el 9, y también el 15.
    const sin = d.length === 13 ? sinElQuince(d.slice(1)) : null;
    return sin ? `9${sin}` : d;
  }
  const sin = d.length === 12 ? sinElQuince(d) ?? d : d;
  return sin.length === 10 ? `9${sin}` : sin;
}

/**
 * El 15 del celular va después del código de área: de 2 dígitos sólo es Buenos Aires (11); el resto, 3 o 4. Con el 15, el número
 * tiene 12 dígitos; sin él, 10. El 15 no puede estar a la vez después del tercero y del cuarto dígito (uno pide un 5 y el otro un 1 en
 * el mismo lugar), así que no hay dos lecturas.
 */
function sinElQuince(d: string): string | null {
  if (d.length !== 12) return null;
  for (const n of d.startsWith('11') ? [2] : [3, 4]) if (d.slice(n, n + 2) === '15') return d.slice(0, n) + d.slice(n + 2);
  return null;
}

/**
 * UN EJEMPLO POR PAÍS (16/11/2026): el que muestra el campo del número de `TelefonoConPais` mientras está vacío, como se escribe un
 * celular de ESE país sin el código. Era uno solo para todos («223 355 0684», un fijo de Mar del Plata sin el 9): con +54 enseñaba
 * a escribirlo sin el 9 (hallazgo 2 de la revisión), y con México o España no se parecía a nada que la persona conozca. Los
 * números son de ejemplo (series reservadas o de muestra), no de nadie.
 */
const EJEMPLO_POR_LADA: Readonly<Record<string, string>> = {
  '+52': '55 1234 5678', '+34': '612 34 56 78', '+54': '9 11 2345 6789', '+57': '300 123 4567', '+56': '9 6123 4567',
  '+51': '912 345 678', '+593': '99 123 4567', '+598': '94 123 456', '+595': '981 123 456', '+591': '7123 4567',
  '+58': '412 123 4567', '+506': '8312 3456', '+507': '6123 4567', '+502': '5123 4567', '+504': '9123 4567', '+503': '7012 3456',
  '+505': '8123 4567', '+1809': '555 0123', '+1787': '555 0123', '+53': '5 123 4567', '+55': '11 91234 5678', '+1': '201 555 0123',
  '+44': '7400 123456', '+33': '6 12 34 56 78', '+49': '1512 3456789', '+39': '312 345 6789', '+351': '912 345 678',
  '+31': '6 12345678', '+41': '78 123 45 67', '+353': '85 123 4567', '+91': '81234 56789', '+61': '412 345 678', '+971': '50 123 4567',
};

/** El ejemplo del campo del número para esa lada; uno genérico si no hay (nunca uno de otro país). */
export function ejemploDeTelefono(lada: string): string {
  return EJEMPLO_POR_LADA[lada] ?? 'Tu número, sin el código de país';
}

/**
 * Lo que se escribió o se pegó en el campo del NÚMERO de `TelefonoConPais`: si arranca con `+`, lo
 * que sigue es el código de país, y va al selector (`lada`); si no, `lada: null` (no se toca).
 *
 * ⚠️ REVISIÓN DEL 12/10/2026: el campo borraba el `+` y dejaba los dígitos del país ADENTRO del
 * número. Pegar «+54 9 11 2233-4455» (copiado de WhatsApp) con México elegido guardaba
 * «525491122334455»: dos códigos de país y un número al que el WhatsApp no llega. Mientras el código
 * todavía no se reconoce (se está tipeando «+5»), el `+` y los dígitos quedan en el campo sin decidir
 * nada. Tipeado de a uno, decide el primer código que se reconoce («+1» antes que «+1809»): los
 * dígitos que se guardan son los mismos.
 */
export function numeroTecleado(texto: string): { lada: string | null; numero: string } {
  // Sin las marcas invisibles que agregan las apps de contactos alrededor de un número pegado: con ellas, el `+` no se veía como el primero.
  const pegado = (texto || '').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
  const t = pegado.trimStart();
  if (!t.startsWith('+')) return { lada: null, numero: pegado.replace(/[^\d\s-]/g, '') };
  const digitos = t.replace(/\D/g, '');
  const p = splitTelefono(digitos);
  // `splitTelefono` cae a la lada por defecto con TODOS los dígitos cuando ninguna coincide.
  if (digitos && p.resto.length < digitos.length) return { lada: p.lada, numero: p.resto };
  return { lada: null, numero: `+${t.slice(1).replace(/[^\d\s-]/g, '')}` };
}

/**
 * Zona horaria por código de país — SOLO para los países que tienen UNA sola.
 *
 * ⚠️ La lista es corta a propósito y lo que NO está es lo importante. Estados
 * Unidos (+1) tiene seis zonas, México cuatro, Brasil cuatro, Chile dos (más
 * Pascua): para esos, la lada no dice la hora y adivinar es peor que no saber —
 * un cliente de Tijuana y uno de Cancún tienen el mismo +52 y tres horas de
 * diferencia. Cuando no se puede afirmar, se devuelve null y decide quien llama.
 *
 * Es el ÚLTIMO recurso: primero se pregunta a Cal.com y a Google Calendar, que
 * saben la zona porque el usuario la eligió. Esto solo cubre al cliente que no
 * conectó ninguna de las dos.
 */
const TZ_POR_LADA: Record<string, string> = {
  '+54': 'America/Argentina/Buenos_Aires',
  '+598': 'America/Montevideo',
  '+595': 'America/Asuncion',
  '+591': 'America/La_Paz',
  '+51': 'America/Lima',
  '+593': 'America/Guayaquil',
  '+57': 'America/Bogota',
  '+58': 'America/Caracas',
  '+506': 'America/Costa_Rica',
  '+507': 'America/Panama',
  '+502': 'America/Guatemala',
  '+504': 'America/Tegucigalpa',
  '+503': 'America/El_Salvador',
  '+505': 'America/Managua',
  '+1809': 'America/Santo_Domingo',
  '+1787': 'America/Puerto_Rico',
  '+53': 'America/Havana',
  '+34': 'Europe/Madrid',
  '+351': 'Europe/Lisbon',
  '+33': 'Europe/Paris',
  '+49': 'Europe/Berlin',
  '+39': 'Europe/Rome',
  '+31': 'Europe/Amsterdam',
  '+41': 'Europe/Zurich',
  '+353': 'Europe/Dublin',
  '+44': 'Europe/London',
  '+971': 'Asia/Dubai',
};

/** `542233550684` → `America/Argentina/Buenos_Aires`. null si la lada es ambigua. */
export function tzDeTelefono(telefono: string | null | undefined): string | null {
  const { lada } = splitTelefono(telefono ?? '');
  if (!telefono) return null;
  return TZ_POR_LADA[lada] ?? null;
}
