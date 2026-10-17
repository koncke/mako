// =============================================================================
// El borrador de cada chat del Ops Center, en MaKo: el que cruza de la computadora al teléfono (17/10/2026)
// =============================================================================
// Martín (feedback del 17/10, la B): «el borrador nunca se pierde... uno por chat, guardado mientras escribe... Va en
// localStorage (sobrevive a cerrar el navegador) y en una copia en MaKo (app_settings, por chat) para que cruce al
// teléfono». El del navegador lo guarda useCentro.ts; esto es la copia. Las reglas (cuál vale) en lib/centro-caja.ts.
//
// Una clave por chat en el workspace de la PLATAFORMA, `operaciones.borrador.<dirección>`: la dirección es la sesión del
// chat (no cambia al renombrarlo) o, el que no tiene, su clave de nombre.
// ⚠️ ESCRIBIR COMPARA LA HORA: se guarda sólo si es MÁS NUEVO que el que está. Las escrituras salen con espera (2 s) y
//    desde dos dispositivos: sin esto, la de la computadora que llega tarde pisaría lo que se escribió en el teléfono.
//    Lee estricto: si no puede leer lo que había, no escribe.
// ⚠️ LA GUARDA NO VIVE ACÁ: la pide la acción (acciones.ts, `puedeOperar`).

import 'server-only';
import { createHash } from 'node:crypto';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { DESTINO_RE } from './operaciones-reglas';
import { MAX_BORRADOR, leerBorrador, type Borrador } from './centro-caja';

const PREFIJO = 'operaciones.borrador.';

/** La clave de app_settings de un chat: su sesión tal cual; un nombre, por su huella (sin espacios ni tildes en la clave). */
export function claveBorradorDe(direccion: string): string | null {
  if (DESTINO_RE.test(direccion)) return PREFIJO + direccion;
  if (direccion.startsWith('nombre:') && direccion.length <= 200) return PREFIJO + createHash('sha256').update(direccion).digest('hex').slice(0, 32);
  return null;
}

const parsear = (v: string | null): Borrador | null => { try { return v ? leerBorrador(JSON.parse(v)) : null; } catch { return null; } };

/** El borrador de un chat, para mostrarlo. Sin la base, ninguno (vale el del navegador). */
export async function leerBorradorDe(direccion: string): Promise<Borrador | null> {
  const clave = claveBorradorDe(direccion);
  if (!clave) return null;
  try {
    const ws = await wsSuperAdmin();
    return parsear(await runWithWorkspace(ws, () => getSetting(clave)));
  } catch {
    return null;
  }
}

/** Guarda el borrador si es más nuevo que el que hay. Devuelve el que quedó. */
export async function guardarBorradorDe(direccion: string, b: Borrador): Promise<Borrador> {
  const clave = claveBorradorDe(direccion);
  if (!clave) throw new Error('Falta el chat.');
  const nuevo: Borrador = { texto: b.texto.slice(0, MAX_BORRADOR), at: b.at };
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async () => {
    const actual = parsear(await getSettingEstricto(clave));
    if (actual && actual.at >= nuevo.at) return actual;
    await setSetting(clave, JSON.stringify(nuevo));
    return nuevo;
  });
}
