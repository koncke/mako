// =============================================================================
// EL CORREO DE «SIGAMOS EN TU COMPUTADORA» (20/11/2026, la llamada con Leila: la pantalla del teléfono promete «Abre MaKo en tu
// computadora con el link que te mandamos a tu correo», y nadie lo mandaba)
// =============================================================================
// Lo manda lib/seguir-en-pc-correo.ts (una vez por persona; lo marca `CLAVE_CORREO_PC`, que «Reiniciar onboarding» borra). El link
// abre el chat del reto en la computadora: ahí está la llegada con «Hola de nuevo» (y /second-brain la abre igual la primera vez).
// Puro: lo lee el test sin servidor.
// =============================================================================

/** app_settings del negocio: a quién y cuándo se mandó (JSON `{ a, at }`). Va en `SETTINGS_QUE_SE_BORRAN` del reinicio. */
export const CLAVE_CORREO_PC = 'onboarding.correo-pc';

/** Adónde lleva el link: el chat del reto, con la llegada («Hola de nuevo») primero. */
export const RUTA_DEL_CORREO_PC = '/second-brain?reto=1';

/** El correo: corto, de tú, neutro en género, con el link solo en su renglón. */
export function correoSeguirEnPc(nombre: string, link: string): { asunto: string; preheader: string; cuerpo: string } {
  const n = nombre.trim();
  return {
    asunto: 'Sigue tu onboarding en la computadora',
    preheader: 'Ahí te muestro MaKo por dentro, con tu reto de 7 días.',
    cuerpo: [
      `Hola${n ? `, ${n}` : ''}:`,
      '',
      'Tu onboarding sigue en una pantalla grande: ahí te muestro MaKo por dentro, con tu reto de 7 días.',
      '',
      'Ábrelo en tu computadora con este link:',
      link,
      '',
      'Lo que contestaste ya está guardado.',
    ].join('\n'),
  };
}
