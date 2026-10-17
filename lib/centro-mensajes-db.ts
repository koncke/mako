// =============================================================================
// Las marcas de Martín en los mensajes de cada chat del Ops Center: reacciones, destacados, fijados y eliminados
// para él (17/10/2026). Las reglas, en lib/centro-mensajes.ts.
// =============================================================================
// Una clave por chat en el workspace de la PLATAFORMA, `operaciones.marcas.<dirección>`, con el mismo molde que el
// borrador (lib/centro-borradores-db.ts): la dirección es la sesión del chat (no cambia al renombrarlo) o, el que no
// tiene, la huella de su clave de nombre. Así cruzan de la computadora al teléfono.
// ⚠️ ESCRIBIR LEE ESTRICTO: si no puede leer lo que había, no escribe (pisaría las marcas con una sola).
// ⚠️ NO VAN AL CHAT: son de Martín. Lo que viaja a la PC es sólo lo firmado (responder y reenviar, por mandar.ts).
// ⚠️ LA GUARDA NO VIVE ACÁ: la pide la acción (app/admin/operaciones/acciones.ts, `puedeOperar`).

import 'server-only';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { claveDeChatCon } from './centro-borradores-db';
import { SIN_MARCAS, aplicarMarca, sanearMarcas, type CambioMarca, type MarcasChat } from './centro-mensajes';

const PREFIJO = 'operaciones.marcas.';

const parsear = (v: string | null): MarcasChat => { try { return v ? sanearMarcas(JSON.parse(v)) : SIN_MARCAS; } catch { return SIN_MARCAS; } };

/** Las marcas de un chat, para dibujarlo. Sin la base, ninguna. */
export async function leerMarcasDe(direccion: string): Promise<MarcasChat> {
  const clave = claveDeChatCon(PREFIJO, direccion);
  if (!clave) return SIN_MARCAS;
  try {
    const ws = await wsSuperAdmin();
    return parsear(await runWithWorkspace(ws, () => getSetting(clave)));
  } catch {
    return SIN_MARCAS;
  }
}

/** Aplica un cambio sobre lo que hay y devuelve cómo quedó. */
export async function marcarDe(direccion: string, cambio: CambioMarca): Promise<MarcasChat> {
  const clave = claveDeChatCon(PREFIJO, direccion);
  if (!clave) throw new Error('Falta el chat.');
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async () => {
    const nuevas = aplicarMarca(parsear(await getSettingEstricto(clave)), cambio);
    await setSetting(clave, JSON.stringify(nuevas));
    return nuevas;
  });
}
