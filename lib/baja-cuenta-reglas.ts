// =============================================================================
// baja-cuenta-reglas — qué borra «Eliminar mi cuenta», en cuánto tiempo y quién puede (3/11/2026)
// =============================================================================
// Apple (5.1.1(v)) y Play piden eliminar la cuenta desde la app; desactivarla no alcanza. T4, docs/tiendas-play-appstore.md:
// quien es el último admin de un negocio lo borra entero, en hasta 30 días, con un mail al terminar. Las demás personas se
// borran solas: el negocio sigue.
//
// ⚠️ PURO, por la regla de la casa: lo que gobierna algo irreversible se puede testear (AGENTS.md, «Un guard sobre algo
//    destructivo»). Lo que toca la base está en lib/baja-cuenta.ts.
// ⚠️ PEDIRLO NO BORRA NADA: apaga la cuenta y deja la marca. Borra el super admin, con `eliminarWorkspace` y su nombre escrito a
//    mano: es lo más destructivo de la app, y un toque en un teléfono no puede ser lo único entre un cliente y eso.
// =============================================================================

export const PLAZO_BAJA_DIAS = 30;

export type AlcanceBaja = 'persona' | 'negocio';

/**
 * Por qué esta sesión no puede pedirlo. `null` = puede.
 *   · el super admin: su cuenta sostiene la plataforma, y `motivoNoEliminable` tampoco la deja borrar;
 *   · mirando a otro: el pedido sería sobre SU cuenta y lo vería el cliente (lo que se borra se elige con la sesión, nunca con la pestaña);
 *   · sin fila propia (dev-login, contraseña maestra): no hay a quién borrar.
 */
export function motivoSinBaja(p: { rol: string | null; impersonando: boolean; tieneFila: boolean }): string | null {
  if (!p.tieneFila) return 'Esta sesión no tiene una cuenta propia.';
  if (p.rol === 'admin') return 'La cuenta de la plataforma no se elimina desde aquí.';
  if (p.impersonando) return 'Estás mirando la cuenta de otro: sal de ella para eliminar la tuya.';
  return null;
}

/**
 * Qué se lleva. El negocio entero SÓLO si quien pide es su último admin: con otro admin adentro, se va la persona y el
 * negocio sigue con quien queda. Un closer o un setter nunca se llevan el negocio.
 *
 * ⚠️ `wsPlataforma`: alguien del equipo de MaKo, admin del espacio de la plataforma sin ser super admin, no puede pausarla con un
 * toque. Sin saber cuál es (la lectura falló, `undefined`), tampoco: se va la persona.
 */
export function alcanceDeLaBaja(p: { rolWs: string | null; otrosAdmins: number; ws: number | null; wsPlataforma: number | null | undefined }): AlcanceBaja {
  if (p.ws == null || p.wsPlataforma == null || p.ws === p.wsPlataforma) return 'persona';
  return p.rolWs === 'admin' && p.otrosAdmins === 0 ? 'negocio' : 'persona';
}

/** Hasta cuándo hay plazo. */
export function venceDe(pedidaMs: number): string {
  return new Date(pedidaMs + PLAZO_BAJA_DIAS * 86_400_000).toISOString();
}

/** «3 de diciembre de 2026», en la hora de Argentina, la de MaKo. */
export function fechaDeLaBaja(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
}

/** Días que le quedan al super admin. Negativo = se pasó. */
export function diasQueQuedan(venceIso: string, ahoraMs: number): number {
  return Math.ceil((Date.parse(venceIso) - ahoraMs) / 86_400_000);
}

/** Lo que lee la persona antes de confirmar: el alcance y el plazo, en palabras. Lo mismo en el teléfono y en la computadora. */
export function textoDeLaBaja(alcance: AlcanceBaja, negocio: string | null): { que: string; plazo: string; plan: string | null } {
  const plazo = `Se borra en hasta ${PLAZO_BAJA_DIAS} días. Te avisamos por correo al terminar.`;
  if (alcance === 'negocio') {
    return {
      que: `Se borra ${negocio ? `«${negocio}»` : 'tu negocio'} entero: contactos, chats, archivos y equipo. No se puede recuperar.`,
      plazo,
      plan: 'Tu plan deja de cobrarse.',
    };
  }
  return { que: 'Se borran tu usuario y tus datos personales. Tu negocio sigue con su equipo.', plazo, plan: null };
}

export const TITULO_BAJA = 'Eliminar mi cuenta';
export const CONFIRMACION_BAJA = 'eliminar';
