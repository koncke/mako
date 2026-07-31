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
