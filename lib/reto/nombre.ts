import 'server-only';
// =============================================================================
// EL NOMBRE DEL RETO: el que dijo la persona en SU onboarding (20/11/2026, Martín probando en Lalaland como administrador)
// =============================================================================
// El chat del reto saludaba «¡Hola, Martin!» en el negocio de «Lala»: el nombre salía de quien inició sesión. La regla de Martín
// (memoria, onboarding-16-11-decisiones, «20/11, ~13:00 UTC»): la vista como administrador muestra LO MISMO que ve el cliente. El
// nombre sale del onboarding del negocio (`onboarding.arranque` → `nombre`, lo que contestó el dueño), no de la sesión.
// Liviano a propósito (una lectura de la base): lo importan el Ops Center y su página del teléfono, y traer el servidor del
// onboarding (lib/onboarding-arranque-server.ts) les sumaría sus rutas (tests/d6b-rutas.test.ts).
// =============================================================================
import { getSetting } from '../settings';
import { estaImpersonando } from '../workspace';
import { nombreDelArranque, primerNombreDe } from './nombre-reglas';

const CLAVE_ARRANQUE = 'onboarding.arranque';

/**
 * El nombre con que el reto le habla al negocio de ahora. Sin nombre en su onboarding: el de la sesión SÓLO si es de este negocio;
 * mirando a un cliente, ninguno («¡Hola! …»), nunca el del administrador.
 */
export async function nombreDelReto(nombreDeLaSesion: string | null | undefined): Promise<string> {
  const delOnboarding = nombreDelArranque(await getSetting(CLAVE_ARRANQUE).catch(() => null));
  if (delOnboarding) return delOnboarding;
  if (await estaImpersonando().catch(() => true)) return '';
  return primerNombreDe(nombreDeLaSesion);
}
