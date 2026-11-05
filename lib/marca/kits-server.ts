// =============================================================================
// marca/kits-server — los kits de marca del negocio en la base (`app_settings`, key `marca.kits`)
// =============================================================================
// Sin migración: es un JSON chico por negocio (30 kits como mucho, sin bytes: el logo es un archivo de «Subidos»). Lo
// escriben la pantalla del Second Brain y la API de MaKo, así que cada escritura es un compare-and-set sobre lo leído
// (`cambiarSettingSi`, que con un valor largo compara por `updated_at`): dos pestañas que suman un kit a la vez no se
// pisan, la segunda reintenta sobre lo nuevo.
//
// LEER para un PROMPT es tolerante (`kitParaUsar`): con la base caída, el chat sigue sin la marca. LEER para ESCRIBIR es
// estricto: escribir sobre una lectura caída borraría los kits.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { cambiarSettingSi, getSetting, getSettingEstricto } from '../settings';
import { getTenantDb } from '../workspace';
import { KEY_KITS, KITS_VACIOS, kitElegido, sanearKits, type CambioKits, type KitMarca, type KitsMarca, type LogoMarca } from './kits';

export { KEY_KITS };

/** Un id corto para un kit nuevo. */
export const nuevoIdKit = (): string => randomUUID().replace(/-/g, '').slice(0, 12);

/** Los kits del negocio en curso. Tolerante: si no se pudo leer, ninguno (para mostrar o para un prompt). */
export async function leerKits(): Promise<KitsMarca> {
  const v = await getSetting(KEY_KITS).catch(() => null);
  return v ? sanearKits(v) : KITS_VACIOS;
}

/** Los kits para decidir algo: tira si no se pudo leer. */
export async function leerKitsEstricto(): Promise<KitsMarca> {
  const v = await getSettingEstricto(KEY_KITS);
  return v ? sanearKits(v) : KITS_VACIOS;
}

/** El kit que usa un editor: el pedido por id, o el de por defecto. null sin kits (o si la base no contestó). */
export async function kitParaUsar(id?: string | null): Promise<KitMarca | null> {
  return kitElegido(await leerKits(), id ?? null);
}

/**
 * Cambia los kits con `cambio` aplicado sobre lo que hay AHORA en la base. Reintenta dos veces si otro escribió en el
 * medio; a la tercera, falla. Lo que no cambia nada no escribe.
 */
export async function cambiarKits(cambio: (k: KitsMarca) => CambioKits): Promise<CambioKits> {
  try {
    return await cambiarKitsSinAtrapar(cambio);
  } catch (e) {
    console.error(`[marca] no pude guardar los kits: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: 'No pude guardar tu marca. Vuelve a intentar.' };
  }
}

async function cambiarKitsSinAtrapar(cambio: (k: KitsMarca) => CambioKits): Promise<CambioKits> {
  for (let intento = 0; intento < 3; intento++) {
    const crudo = await getSettingEstricto(KEY_KITS);
    const actual = crudo ? sanearKits(crudo) : KITS_VACIOS;
    const r = cambio(actual);
    if (!r.ok) return r;
    const nuevo = JSON.stringify(r.kits);
    if (crudo && nuevo === JSON.stringify(actual)) return r;
    if (await cambiarSettingSi(KEY_KITS, crudo, nuevo)) return r;
  }
  return { ok: false, error: 'Otra pestaña cambió la marca al mismo tiempo. Vuelve a intentar.' };
}

/**
 * Un archivo de «Subidos» del negocio como logo de un kit (la API de MaKo lo pide por id). null si no es una imagen del
 * negocio o ya se sacó de «Subidos». Tira si no pudo leer.
 */
export async function logoDeSubido(id: string): Promise<LogoMarca | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from('image_subidos').select('id, nombre, tipo, ancho, alto, url')
    .eq('id', id).is('borrado_at', null).like('tipo', 'image/%').maybeSingle();
  if (error) throw new Error(error.message);
  const f = data as { id: string; nombre: string; ancho: number; alto: number; url: string } | null;
  return f ? { subidoId: f.id, url: f.url, nombre: f.nombre, ancho: Number(f.ancho) || 0, alto: Number(f.alto) || 0 } : null;
}
