// =============================================================================
// La caché corta de lo que contestan Calendly y Cal.com (23/10/2026)
// =============================================================================
// Martín, 22/10/2026: «Vincular evento» tarda en abrir, en vincular y en «Conectar Cal». Cada apertura, cada vínculo
// (`prepararVinculo` valida contra la cuenta) y cada «Volver a leer» le preguntaban a la API de cada agenda. Esto guarda
// la lista de eventos de UNA cuenta un minuto, y lib/agenda-evento-etapa-server.ts la usa.
//
// LA LLAVE ES negocio + proveedor + una huella del secreto (el token o la API key, nunca el secreto mismo):
//   · por negocio, porque la lista decide qué se puede vincular (`prepararVinculo`: sólo eventos de SU cuenta);
//   · con la huella, porque conectar otra cuenta cambia la llave y nunca se ve la lista de la anterior. Por eso
//     «Conectar Cal» no necesita borrar nada;
//   · Cobros le suma la cuenta a la llave cuando haya varias por proveedor (fase B de varias cuentas).
// Un error no se guarda nunca: la próxima vez se vuelve a preguntar. Crear o editar un evento olvida la del proveedor.
// Puro, sin red ni base: lo prueba tests/agenda-velocidad-23-10.test.ts.
// =============================================================================

import { createHash } from 'node:crypto';

/** Cuánto vale lo guardado. Corto: lo que se cambia en Calendly o Cal.com, afuera de MaKo, se ve al minuto. */
export const TTL_AGENDA_MS = 60_000;
/** Cuántas cuentas guarda como mucho (la más vieja sale primero). */
export const TOPE_AGENDA = 300;

/** La huella del secreto: 16 caracteres de su sha256. Sirve para distinguir cuentas, no para reconstruirlo. */
export const huellaDe = (secreto: string): string => createHash('sha256').update(secreto).digest('hex').slice(0, 16);

/** La llave de una cuenta: negocio + proveedor + la huella de su secreto. */
export const llaveAgenda = (ws: number, proveedor: string, secreto: string): string => `${ws}:${proveedor}:${huellaDe(secreto)}`;

export type CacheAgenda<T> = {
  leer(llave: string): T | undefined;
  guardar(llave: string, valor: T): void;
  /** Olvida lo de un negocio (con proveedor, sólo lo de ése). */
  olvidar(ws: number, proveedor?: string): void;
};

export function crearCacheAgenda<T>(ttl = TTL_AGENDA_MS, ahora: () => number = Date.now): CacheAgenda<T> {
  const m = new Map<string, { hasta: number; valor: T }>();
  return {
    leer(llave) {
      const e = m.get(llave);
      if (!e) return undefined;
      if (e.hasta <= ahora()) { m.delete(llave); return undefined; }
      return e.valor;
    },
    guardar(llave, valor) {
      m.delete(llave);
      // Map conserva el orden de inserción: el primero es el más viejo.
      if (m.size >= TOPE_AGENDA) m.delete(m.keys().next().value as string);
      m.set(llave, { hasta: ahora() + ttl, valor });
    },
    olvidar(ws, proveedor) {
      const prefijo = proveedor ? `${ws}:${proveedor}:` : `${ws}:`;
      for (const k of [...m.keys()]) if (k.startsWith(prefijo)) m.delete(k);
    },
  };
}

/**
 * Lo guardado si vale; si no (o con `fresco`), lo lee y lo guarda. Sin llave (sin negocio), lee siempre. Lo que tira, tira
 * y no se guarda.
 */
export async function conCache<T>(c: CacheAgenda<T>, llave: string | null, fresco: boolean, leer: () => Promise<T>): Promise<T> {
  if (llave && !fresco) {
    const ya = c.leer(llave);
    if (ya !== undefined) return ya;
  }
  const valor = await leer();
  if (llave) c.guardar(llave, valor);
  return valor;
}
