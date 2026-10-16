'use server';

// Marca o desmarca un ítem de la checklist de /admin/runway/checklist. Lo guarda en app_settings del workspace de quien
// mira (la clave es CLAVE_CHECKLIST), así lo marcado se ve igual en la computadora y en el celular. Lee ESTRICTO: si no
// pudo leer lo guardado, no escribe (si no, una lectura caída borraría todo lo que ya estaba marcado).

import { getSesionAdmin } from '@/lib/auth';
import { getSettingEstricto, setSetting } from '@/lib/settings';
import { CLAVE_CHECKLIST, HECHO, PENDIENTE } from './datos';

const IDS = new Set([...HECHO, ...PENDIENTE].flatMap((s) => s.items.map((i) => i.id)));

export async function marcarItemChecklist(id: string, marcado: boolean): Promise<{ ok: boolean; marcados: string[] }> {
  if (!(await getSesionAdmin())) return { ok: false, marcados: [] };
  if (!IDS.has(id)) return { ok: false, marcados: [] };
  let actuales: string[];
  try {
    const crudo = await getSettingEstricto(CLAVE_CHECKLIST);
    const lista: unknown = crudo ? JSON.parse(crudo) : [];
    actuales = Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string' && IDS.has(x)) : [];
  } catch {
    return { ok: false, marcados: [] };
  }
  const nuevos = marcado ? [...new Set([...actuales, id])] : actuales.filter((x) => x !== id);
  await setSetting(CLAVE_CHECKLIST, JSON.stringify(nuevos));
  return { ok: true, marcados: nuevos };
}
