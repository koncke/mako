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
