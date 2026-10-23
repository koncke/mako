// =============================================================================
// tope-cuentas — el tope del plan al conectar una cuenta más de cobro o de agenda (23/10/2026)
// =============================================================================
// La regla está en lib/tope-cuentas-reglas.ts. Esto lee lo que hace falta: si MaKo le cobra el plan por la pasarela
// (`suscripcionDeMakoDe`), la capa del negocio y cuántas cuentas del grupo ya tiene. Lo llaman las dos puertas que
// conectan una cuenta NUEVA: /api/integraciones/cuentas (`conectar`) y /api/integraciones/credencial (`descubrir-pago`,
// la principal de una pasarela que todavía no estaba).
// =============================================================================

import 'server-only';
import { suscripcionDeMakoDe } from './cobros';
import { cuentasDePago } from './cuentas-pago-server';
import { cuentasDeAgenda } from './cuentas-agenda-server';
import { getWorkspace } from './workspace';
import { topeAlConectar } from './tope-cuentas-reglas';

export { LINK_PLANES } from './tope-cuentas-reglas';

/** Cuántas cuentas tiene el GRUPO: las de cobro (Stripe y Mercado Pago) o las de agenda (Calendly y Cal). */
export async function cuentasDelGrupo(ws: number, grupo: 'cobro' | 'agenda'): Promise<number> {
  if (grupo === 'cobro') return (await cuentasDePago(ws)).length;
  const [a, b] = await Promise.all([cuentasDeAgenda(ws, 'calendly'), cuentasDeAgenda(ws, 'calcom')]);
  return a.length + b.length;
}

/** null = puede conectarla. Sin poder leer el plan o las cuentas, no se frena (el tope vende; no protege nada). */
export async function topeDeCuentas(ws: number, grupo: 'cobro' | 'agenda'): Promise<{ texto: string; tope: number } | null> {
  try {
    const sus = await suscripcionDeMakoDe(ws);
    if (!sus) return null;
    const [w, usadas] = await Promise.all([getWorkspace(ws), cuentasDelGrupo(ws, grupo)]);
    return topeAlConectar({ ws, cobradoPorPasarela: true, capa: w?.capa ?? null, usadas });
  } catch (e) {
    console.error(`[tope-cuentas] ws ${ws}: no pude leer el plan, no se frena:`, e instanceof Error ? e.message : String(e));
    return null;
  }
}
