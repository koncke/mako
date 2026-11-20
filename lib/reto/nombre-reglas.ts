// El nombre del reto, lo puro (sin base): lo usa lib/reto/nombre.ts y lo prueba tests/reto-verificacion-tarde.test.ts.

/** La primera palabra de un nombre («Lala Pérez» → «Lala»). */
export const primerNombreDe = (s: string | null | undefined): string => (s ?? '').trim().split(/\s+/)[0] ?? '';

/** El nombre que dijo en el onboarding (`onboarding.arranque` guardado, en crudo). null si no hay uno. */
export function nombreDelArranque(crudo: string | null | undefined): string | null {
  try {
    const a = JSON.parse(crudo ?? 'null') as { nombre?: unknown } | null;
    const n = typeof a?.nombre === 'string' ? primerNombreDe(a.nombre) : '';
    return n || null;
  } catch { return null; }
}
