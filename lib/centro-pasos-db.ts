// =============================================================================
// Los pasos en vivo de los chats, en la base (17/10/2026, la E)
// =============================================================================
// Una clave de app_settings POR CUENTA en el workspace de la plataforma, `operaciones.pasos.<cuenta>`, que la PC pisa
// entera cada vez que sube (es una foto de AHORA, no una historia): por cuenta para que dos Runners no se pisen. Las
// reglas en lib/centro-pasos.ts.
// ⚠️ LA GUARDA NO VIVE ACÁ: guarda el endpoint del cartero (su token) y lee la foto del Centro (`puedeOperar`).

import 'server-only';
import { getSetting, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { CUENTAS } from '../app/admin/dev/_registro/tipos';
import { CUENTA_RE } from './operaciones-reglas';
import { pasosVigentes, sanearPasos, type PasosPorChat } from './centro-pasos';

const PREFIJO = 'operaciones.pasos.';

/** Guarda la foto de lo que están haciendo los chats de una cuenta. */
export async function guardarPasos(cuenta: string, pasos: unknown): Promise<number> {
  if (!CUENTA_RE.test(cuenta)) throw new Error('falta la cuenta');
  const limpio = sanearPasos(pasos);
  const ws = await wsSuperAdmin();
  await runWithWorkspace(ws, () => setSetting(PREFIJO + cuenta, JSON.stringify({ at: new Date().toISOString(), pasos: limpio })));
  return Object.keys(limpio).length;
}

/** Lo que están haciendo los chats de todas las cuentas, si se subió hace poco. Para dibujar: sin la base, nada. */
export async function leerPasos(ahora = Date.now()): Promise<PasosPorChat> {
  try {
    const ws = await wsSuperAdmin();
    const registros = await runWithWorkspace(ws, () => Promise.all(Object.keys(CUENTAS).map(async (c) => {
      try {
        const v = await getSetting(PREFIJO + c);
        const o = v ? JSON.parse(v) : null;
        return o && typeof o.at === 'string' ? { at: o.at, pasos: sanearPasos(o.pasos) } : null;
      } catch { return null; }
    })));
    return pasosVigentes(registros, ahora);
  } catch {
    return {};
  }
}
