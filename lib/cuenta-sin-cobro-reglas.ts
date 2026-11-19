// =============================================================================
// cuenta-sin-cobro-reglas — «Habilitado sin cobro»: el interruptor de super admin por negocio (19/11/2026)
// =============================================================================
// Martín: un negocio cargado a mano, sin prueba ni cobro (P2P Consulting en Essential), contra el circuito normal de cualquier negocio nuevo
// («si desactivo eso, simplemente entra en la configuración de siempre»). Decisión del Cerebro (19/11): UN ajuste por negocio, SIN migración:
// `cuenta.sin_cobro` en `app_settings` de ESE negocio, con `{ activo, por, at }`.
//   · PRENDIDO (`activo: true`): como hoy, habilitado sin prueba ni cobro; la lista de Customers lo marca con un chip.
//   · APAGADO (`activo: false`): el circuito normal de un negocio nuevo (7 días de prueba y después el cobro de su plan, con los avisos de la
//     prueba). No se pausa ni se borra nada en el acto.
//   · SIN REGISTRO: nunca se tocó el interruptor: como hoy (el negocio no se cobra por esta vía) y sin chip.
// ⚠️ LO ESCRIBE SÓLO MARTÍN AL TOCAR EL INTERRUPTOR (`ponerSinCobroAction`, la acción pide el super admin en su primera línea): ningún código
// cambia ninguna cuenta solo. ⚠️ HOY EL INTERRUPTOR SÓLO REGISTRA LA DECISIÓN (con quién y cuándo); abrir la prueba y el cobro de ese negocio
// (una prueba necesita su tarjeta: el link de lib/compra-plan.ts `reactivarPlan`) es el paso siguiente y todavía no está conectado.
// Puro: sin base ni red. Lo prueba tests/cuenta-sin-cobro.test.ts.
// =============================================================================

export const CLAVE_SIN_COBRO = 'cuenta.sin_cobro';

export type SinCobro = { activo: boolean; por: string | null; at: string | null };

/** Lo guardado en el ajuste (JSON); vacío o roto = nunca se tocó (`null`: ni prendido ni apagado). */
export function sinCobroDeSetting(crudo: string | null | undefined): SinCobro | null {
  if (!crudo) return null;
  try {
    const o = JSON.parse(crudo) as Record<string, unknown>;
    if (!o || typeof o !== 'object' || typeof o.activo !== 'boolean') return null;
    const t = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    return { activo: o.activo, por: t(o.por, 120), at: t(o.at, 40) };
  } catch { return null; }
}

/** ¿Está marcado «Habilitado sin cobro»? Sólo con el interruptor prendido a propósito. */
export const habilitadoSinCobro = (s: SinCobro | null | undefined): boolean => s?.activo === true;

/** Lo que pide el cartel antes de APAGAR (una línea, tal cual lo dijo el Cerebro). */
export const TEXTO_CONFIRMAR_APAGAR = 'Este negocio pasa al circuito normal: 7 días de prueba y después el cobro de su plan.';
export const TEXTO_SIN_COBRO = 'Habilitado sin cobro: cargado a mano, sin prueba ni cobro.';
export const CHIP_SIN_COBRO = 'Sin cobro';
