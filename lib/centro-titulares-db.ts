// =============================================================================
// El nombre y el email de cada cuenta, en la base (17/10/2026, la G)
// =============================================================================
// Un JSON en app_settings del workspace de la plataforma, `operaciones.cuentas`: por cuenta, el titular que sube su
// Runner (de ~/.claude/cuentas.tsv) y el nombre que le puso Martín (`alias`). Las reglas en lib/centro-titulares.ts.
// ⚠️ ESCRIBIR LEE ESTRICTO: leer-cambiar-escribir el mapa entero con una lectura que cae al default lo pisaría vacío.
// ⚠️ LA GUARDA NO VIVE ACÁ: el titular lo sube el endpoint del cartero (su token); el alias, una acción con `puedeOperar`.

import 'server-only';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { CUENTA_RE } from './operaciones-reglas';
import { sanearCuentasConNombre, sanearTitular, type CuentasConNombre } from './centro-titulares';

const CLAVE = 'operaciones.cuentas';
const parsear = (v: string | null): unknown => { try { return v ? JSON.parse(v) : {}; } catch { return {}; } };

async function cambiar(hacer: (m: CuentasConNombre) => CuentasConNombre | null): Promise<CuentasConNombre> {
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async () => {
    const antes = sanearCuentasConNombre(parsear(await getSettingEstricto(CLAVE)));
    const despues = hacer(antes);
    if (!despues || JSON.stringify(despues) === JSON.stringify(antes)) return antes;
    await setSetting(CLAVE, JSON.stringify(despues));
    return despues;
  });
}

/** El titular de una cuenta, como lo sube su Runner. Sólo escribe si cambió. */
export async function guardarTitular(cuenta: string, titular: unknown): Promise<void> {
  const t = sanearTitular(titular);
  if (!CUENTA_RE.test(cuenta) || !t) return;
  await cambiar((m) => ({ ...m, [cuenta]: { ...t, alias: m[cuenta]?.alias ?? null } }));
}

/** El nombre que Martín le pone a una cuenta (null = volver al del titular). */
export async function guardarAlias(cuenta: string, alias: string | null): Promise<CuentasConNombre> {
  if (!CUENTA_RE.test(cuenta)) throw new Error('Falta la cuenta.');
  return cambiar((m) => ({ ...m, [cuenta]: { nombre: m[cuenta]?.nombre ?? null, email: m[cuenta]?.email ?? null, alias } }));
}

/** Los nombres y emails de las cuentas, para dibujar. Sin la base, ninguno («Cuenta N»). */
export async function leerCuentasConNombre(): Promise<CuentasConNombre> {
  try {
    const ws = await wsSuperAdmin();
    return sanearCuentasConNombre(parsear(await runWithWorkspace(ws, () => getSetting(CLAVE))));
  } catch {
    return {};
  }
}
