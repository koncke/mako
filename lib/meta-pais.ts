// =============================================================================
// meta-pais — ¿de qué país es una cuenta publicitaria de Meta?
// =============================================================================
// Existe por un bug concreto y caro: la segmentación de todo lo que se creaba
// desde Ads Manager estaba cableada a `{ countries: ['MX'] }` en CUATRO lugares
// (NuevaCampanaModal ×3, AgregarConjuntoModal, campaign-structurer y el fallback
// de meta-ads-create). Un cliente argentino armaba su campaña, la publicaba, y
// Meta la entregaba en México — sin avisar y sin ninguna pantalla donde cambiarlo.
//
// ⚠️ `business_country_code` NO alcanza: es el país FISCAL del negocio, no el del
// público. Medido el 2026-09-08 sobre la cuenta de Código Inmobiliario (ws13):
// act_1357728489423123 es "P2P Consulting LLC", business_country_code = "US" y
// timezone_name = "America/Argentina/Buenos_Aires". Venden en Argentina desde una
// LLC de Estados Unidos. Si mirás el país fiscal concluís "US" y errás igual que
// antes, solo que con otro país. La ZONA HORARIA es la que se eligió al abrir la
// cuenta para operarla, así que manda ella; el país fiscal queda de respaldo.
//
// ⚠️ Y esto es un DEFAULT, nunca una decisión cerrada: la pantalla que lo usa
// SIEMPRE deja cambiarlo. Adivinar bien no reemplaza a poder editar.
// =============================================================================

/**
 * Zona horaria de la cuenta → ISO-2. Solo hace falta acertarle a los países donde
 * hay (o puede haber) clientes; para el resto está el respaldo fiscal y, al final,
 * el selector. Las de `America/Argentina/*` y demás anidadas se resuelven por
 * prefijo, más abajo.
 */
const TZ_PAIS: Record<string, string> = {
  // ── América Latina ──
  'America/Mexico_City': 'MX', 'America/Cancun': 'MX', 'America/Merida': 'MX',
  'America/Monterrey': 'MX', 'America/Chihuahua': 'MX', 'America/Hermosillo': 'MX',
  'America/Mazatlan': 'MX', 'America/Tijuana': 'MX', 'America/Bahia_Banderas': 'MX',
  'America/Buenos_Aires': 'AR', 'America/Cordoba': 'AR', 'America/Rosario': 'AR',
  'America/Santiago': 'CL', 'Pacific/Easter': 'CL',
  'America/Bogota': 'CO',
  'America/Lima': 'PE',
  'America/Caracas': 'VE',
  'America/Guayaquil': 'EC', 'Pacific/Galapagos': 'EC',
  'America/La_Paz': 'BO',
  'America/Asuncion': 'PY',
  'America/Montevideo': 'UY',
  'America/Sao_Paulo': 'BR', 'America/Bahia': 'BR', 'America/Fortaleza': 'BR',
  'America/Recife': 'BR', 'America/Manaus': 'BR', 'America/Belem': 'BR',
  'America/Panama': 'PA',
  'America/Costa_Rica': 'CR',
  'America/Guatemala': 'GT',
  'America/El_Salvador': 'SV',
  'America/Tegucigalpa': 'HN',
  'America/Managua': 'NI',
  'America/Havana': 'CU',
  'America/Santo_Domingo': 'DO',
  'America/Puerto_Rico': 'PR',
  'America/Port-au-Prince': 'HT',
  'America/Jamaica': 'JM',
  // ── Norteamérica ──
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
  'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Anchorage': 'US',
  'America/Detroit': 'US', 'America/Indiana/Indianapolis': 'US', 'Pacific/Honolulu': 'US',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA',
  'America/Winnipeg': 'CA', 'America/Halifax': 'CA', 'America/Montreal': 'CA',
  // ── Europa ──
  'Europe/Madrid': 'ES', 'Atlantic/Canary': 'ES',
  'Europe/Lisbon': 'PT',
  'Europe/London': 'GB', 'Europe/Dublin': 'IE',
  'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH',
  'Europe/Vienna': 'AT', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL',
  'Europe/Prague': 'CZ', 'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO',
  'Europe/Athens': 'GR', 'Europe/Istanbul': 'TR', 'Europe/Moscow': 'RU',
  // ── Resto ──
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Pacific/Auckland': 'NZ',
  'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN',
  'Asia/Singapore': 'SG', 'Asia/Dubai': 'AE', 'Asia/Jerusalem': 'IL',
  'Asia/Kolkata': 'IN', 'Africa/Johannesburg': 'ZA', 'Africa/Lagos': 'NG',
};

/** Zonas anidadas (`America/Argentina/Buenos_Aires`, `America/Kentucky/Louisville`…). */
const TZ_PREFIJO_PAIS: Array<[string, string]> = [
  ['America/Argentina/', 'AR'],
  ['America/Indiana/', 'US'],
  ['America/Kentucky/', 'US'],
  ['America/North_Dakota/', 'US'],
];

const ISO2 = /^[A-Za-z]{2}$/;

/**
 * ISO-2 del país de una cuenta publicitaria, o null si no se puede afirmar.
 *
 * `null` NO es un problema a tapar con un default: es la señal de que la pantalla
 * tiene que preguntar. Inventar un país acá es exactamente el bug que este archivo
 * viene a cerrar.
 */
export function paisDeCuentaMeta(raw: { timezone_name?: unknown; business_country_code?: unknown } | null | undefined): string | null {
  const tz = typeof raw?.timezone_name === 'string' ? raw.timezone_name.trim() : '';
  if (tz) {
    const exacto = TZ_PAIS[tz];
    if (exacto) return exacto;
    for (const [pre, pais] of TZ_PREFIJO_PAIS) if (tz.startsWith(pre)) return pais;
  }
  const fiscal = typeof raw?.business_country_code === 'string' ? raw.business_country_code.trim().toUpperCase() : '';
  return ISO2.test(fiscal) ? fiscal : null;
}
