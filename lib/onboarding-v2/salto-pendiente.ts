// =============================================================================
// EL SALTO PENDIENTE: lo que «Ir a un paso» deja para la pantalla a la que va (21/11/2026)
// =============================================================================
// Martín: «para ir exactamente al paso que quiere». Lo de la base lo deja el server (./saltar-server.ts); la marca exacta la arranca
// quien corresponde al llegar: el motor el recorrido desde su paso (app/_ui/tutorial/MotorTutorial.tsx) y el chat del reto la tarea
// desde su marca (app/second-brain/reto/ChatDelReto.tsx). Viaja en sessionStorage: es de ESTA pestaña, y la toma uno solo.
// =============================================================================
import type { SaltoPendiente } from './saltar';

const CLAVE = 'mako.v2.salto';

/** Lo deja «Ir a un paso» antes de navegar (null: no hay nada que arrancar al llegar). */
export function anotarSalto(s: SaltoPendiente | null | undefined): void {
  try { if (s) sessionStorage.setItem(CLAVE, JSON.stringify(s)); else sessionStorage.removeItem(CLAVE); } catch { /* sin almacenamiento: se llega sin la marca */ }
}

/** Lo toma quien puede arrancarlo (`es` dice si es suyo); lo de otro queda para el otro. */
export function tomarSalto<T extends SaltoPendiente>(es: (s: SaltoPendiente) => s is T): T | null {
  try {
    const v = sessionStorage.getItem(CLAVE);
    if (!v) return null;
    const s = JSON.parse(v) as SaltoPendiente;
    if (!es(s)) return null;
    sessionStorage.removeItem(CLAVE);
    return s;
  } catch { return null; }
}

export const esDelRecorrido = (s: SaltoPendiente): s is { recorrido: number } => 'recorrido' in s;
export const esDeUnaTarea = (s: SaltoPendiente): s is { dia: number; tarea: string; marca: number } => 'tarea' in s;
