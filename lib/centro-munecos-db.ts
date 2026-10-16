// =============================================================================
// Los muñecos que eligió Martín, en la base (15/10/2026)
// =============================================================================
// Un JSON en app_settings del workspace de la PLATAFORMA (`wsSuperAdmin()`, nunca OWNER_WS: el 1 es un cliente), con
// la clave de cada nombre y su aspecto. Las reglas (qué es un aspecto válido, el tope) viven en lib/centro-munecos.ts.
//
// ⚠️ LEER PARA DIBUJAR NO ES LEER PARA ESCRIBIR (AGENTS.md → «Una lectura que cae al DEFAULT sirve para dibujar, nunca
// para DECIDIR»): la pantalla lee tolerante (sin la base, cada uno con el suyo de siempre), pero guardar uno es
// leer-cambiar-escribir el mapa ENTERO, y con la lectura tolerante una caída de la base lo escribiría vacío y se
// llevaría todo lo elegido. Guardar lee estricto: si no puede leer, no escribe.

import 'server-only';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { CLAVE_MUNECOS, TOPE_MUNECOS, claveDeMuneco, sanearMunecos, type Aspecto, type MunecosElegidos } from './centro-munecos';

const parsear = (v: string | null): unknown => { try { return v ? JSON.parse(v) : {}; } catch { return {}; } };

/** Lo elegido, para dibujar. Sin la base, vacío: cada chat con su muñeco de siempre. */
export async function leerMunecos(): Promise<MunecosElegidos> {
  try {
    const ws = await wsSuperAdmin();
    return sanearMunecos(parsear(await runWithWorkspace(ws, () => getSetting(CLAVE_MUNECOS))));
  } catch {
    return {};
  }
}

/** Guarda (o, con null, olvida) el muñeco de un nombre. Devuelve el mapa como quedó. */
export async function guardarMuneco(titulo: string, aspecto: Aspecto | null): Promise<MunecosElegidos> {
  const clave = claveDeMuneco(titulo);
  if (!clave) throw new Error('Elige un chat para cambiarle el muñeco.');
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async () => {
    const actual = sanearMunecos(parsear(await getSettingEstricto(CLAVE_MUNECOS)));
    const nuevo: MunecosElegidos = { ...actual };
    if (aspecto) nuevo[clave] = aspecto; else delete nuevo[clave];
    // El tope: si se pasa, se van los primeros que se eligieron (el orden de inserción del objeto).
    const claves = Object.keys(nuevo);
    for (const k of claves.slice(0, Math.max(0, claves.length - TOPE_MUNECOS))) delete nuevo[k];
    await setSetting(CLAVE_MUNECOS, JSON.stringify(nuevo));
    return nuevo;
  });
}
