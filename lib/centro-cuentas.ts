// =============================================================================
// A qué cuenta va un trabajo, y con qué modelo: «Automático» o la que elija Martín (17/10/2026)
// =============================================================================
// Martín, mirando Ops Center en producción: «Al enviar un prompt por el Second Brain no me deja seleccionar qué cuenta...
// Si no selecciono nada que lo decida solo, pero debería poder seleccionar». Y: «Quiero que los jefes y el cerebro tengan
// la capacidad de ahorrar tokens, dando instrucciones precisas y eligiendo qué modelo de IA debe correr».
//
// Un chat es un NOMBRE con una sesión por cuenta (lib/centro-chats.ts → unirPorNombre). Elegir la cuenta es elegir a
// cuál de SUS sesiones va el trabajo: una cuenta en la que el chat no está abierto no se puede elegir (abrirlo ahí es el
// «un clic», docs/diseno-nuevo-chat-un-clic.md). «Automático» elige, entre sus sesiones, la que puede recibir ya y tiene
// más cuota libre (la ventana que se va a terminar primero manda).
//
// El modelo y el esfuerzo los aplica el Runner con `set_session_model` / `set_session_effort` antes de entregar (lib/
// runner.ts). Esas herramientas son de la APP: a un chat de terminal no se le puede cambiar el modelo desde afuera, así
// que ahí el selector no se ofrece. «Automático» no toca nada: lo decide el Cerebro.

import type { CarteroP, ChatCentro, SesionDeChat } from './centro-chats';
import { usoDeCuenta, type Cuota } from './centro-uso';
import { ESFUERZOS, MODELOS, carteroVivo, type Esfuerzo, type Modelo } from './operaciones-reglas';

export { ESFUERZOS, MODELOS, type Esfuerzo, type Modelo };

export const AUTOMATICO = 'auto';

/** Cuánto queda libre de una cuenta, 0-100: la ventana más usada manda (la de 5 horas o la semanal). null = no se sabe. */
export function libreDe(cuota: Cuota | null | undefined, ahora: number): number | null {
  const u = usoDeCuenta(cuota, ahora);
  const usados = [u.cinco, u.semana].filter((v): v is NonNullable<typeof v> => v != null)
    // Pasado su reinicio, la ventana está vacía.
    .map((v) => (v.reinicio ? 0 : v.pct))
    .filter((p): p is number => p != null && Number.isFinite(p));
  return usados.length ? Math.max(0, 100 - Math.max(...usados)) : null;
}

/** ¿Esta sesión puede recibir ya? Abierta, con su foto al día, con un Runner en su carpeta y el de su cuenta vivo. */
function recibeYa(s: SesionDeChat, carteros: readonly CarteroP[], ahora: number): boolean {
  const abierta = s.estado === 'abierto' || s.estado === 'trabajando';
  return abierta && !s.viejo && !s.sinRunner && carteroVivo(carteros.find((k) => k.cuenta === s.cuenta), ahora);
}

/** La sesión que elige «Automático»: primero la que recibe ya; entre ésas, la de más cuota libre (lo que no se sabe va
 *  después de lo que se sabe); y a igualdad, la que se movió último. null = el chat no tiene ninguna sesión. */
export function sesionAutomatica(c: Pick<ChatCentro, 'sesiones'>, carteros: readonly CarteroP[], ahora: number): SesionDeChat | null {
  const cuota = (cuenta: string | null) => carteros.find((k) => k.cuenta === cuenta)?.cuota ?? null;
  const puntaje = (s: SesionDeChat) => [recibeYa(s, carteros, ahora) ? 1 : 0, libreDe(cuota(s.cuenta), ahora) ?? -1, s.actividad ?? 0];
  let mejor: SesionDeChat | null = null;
  let pMejor: number[] = [];
  for (const s of c.sesiones) {
    const p = puntaje(s);
    const gana = !mejor || p[0] > pMejor[0] || (p[0] === pMejor[0] && (p[1] > pMejor[1] || (p[1] === pMejor[1] && p[2] > pMejor[2])));
    if (gana) { mejor = s; pMejor = p; }
  }
  return mejor;
}

/** A dónde va un trabajo con la elección de la caja: la sesión de esa cuenta (la mejor, si hay dos), o la automática.
 *  Sin sesiones conocidas, el chat tal cual (la caja ya dice qué hacer con eso). */
export function destinoDe(
  c: Pick<ChatCentro, 'sesion' | 'cuenta' | 'estado' | 'sesiones'>, eleccion: string, carteros: readonly CarteroP[], ahora: number,
): Pick<ChatCentro, 'sesion' | 'cuenta' | 'estado'> {
  const de = eleccion === AUTOMATICO ? c.sesiones : c.sesiones.filter((s) => s.cuenta === eleccion);
  const s = sesionAutomatica({ sesiones: de }, carteros, ahora);
  return s ? { sesion: s.sesion, cuenta: s.cuenta, estado: s.estado } : { sesion: c.sesion, cuenta: c.cuenta, estado: c.estado };
}

/** Las cuentas para elegir: las de las sesiones del chat, en orden, con lo libre de cada una. */
export function cuentasDelChat(c: Pick<ChatCentro, 'sesiones'>, carteros: readonly CarteroP[], ahora: number): { cuenta: string; libre: number | null }[] {
  const cuentas = [...new Set(c.sesiones.map((s) => s.cuenta).filter((x): x is string => !!x))]
    .sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
  return cuentas.map((cuenta) => ({ cuenta, libre: libreDe(carteros.find((k) => k.cuenta === cuenta)?.cuota ?? null, ahora) }));
}

// ── El modelo y el esfuerzo ─────────────────────────────────────────────────────────────────────────────────────────
export const NOMBRE_MODELO: Record<Modelo, string> = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' };
export const NOMBRE_ESFUERZO: Record<Esfuerzo, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto', xhigh: 'Muy alto', max: 'Máximo' };

/** El modelo se le puede cambiar sólo a un chat de la APP (`local_…`): las herramientas que lo hacen son de la app. */
export const aceptaModelo = (sesion: string | null | undefined): boolean => !!sesion && sesion.startsWith('local_');
