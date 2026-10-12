// =============================================================================
// «Today» de MaKo Mobile — lo PURO: qué se pide por rol, qué cuenta como bloqueo, las horas
// =============================================================================
// SIN `server-only` a propósito: lo importan los tests y los componentes cliente de
// app/m/hoy. Las lecturas viven en lib/hoy-movil.ts (server-only).
//
// ⚠️ QUÉ SE PIDE LO DECIDE `composicionHoy`, Y LO QUE EL ROL NO VE NO SE PIDE. La
// visibilidad es la MISMA regla del Sidebar (`puedeVerKey`, lib/movil-rutas.ts): esto no
// es una segunda tabla de permisos, es la COMPOSICIÓN de Today que fijó el diseño
// (docs/diseno-mako-mobile.md, «Today por rol»):
//   · admin-cliente (ve `general`): el Pulso + reuniones de hoy + prioridades;
//   · closer / setter (sin `general`): reuniones + leads que esperan una decisión + prioridades;
//   · capa pm y superadmin (Martín, ws9): prioridades + vencimientos + borradores + aprobaciones.
// ⚠️ La capa `superadmin` SÍ ve `general` (tabEnCapa la deja pasar: medido el 11/10/2026),
// y aun así su Today no es el Pulso: por eso se nombra la capa acá y no se deriva de
// `puedeVerKey('general')` solo.
//
// ⚠️ EL CERO DE ALGO QUE NO SE PUDO CONTAR NO ES UN CERO (#165): `sumaDe` devuelve null si
// una bandeja no se leyó. (La v2 borró la frase héroe, la lámpara y las alertas de la v1 —
// fraseHeroe, textoLampara, alertasRestantes, diasQueQuedan—: Today ya no las dibuja.)
// =============================================================================

import { puedeVerKey, type RolMovil } from './movil-rutas';
import type { TipoDecision } from './inbox-movil-reglas';

// ─────────────────────────────────────────────────────────────────────────────
// Qué se pide
// ─────────────────────────────────────────────────────────────────────────────

export type ComposicionHoy = {
  /** La lámpara, LA acción del día, el objetivo, KPIs y alertas (lee `leerVistaGeneral`, que ESCRIBE). */
  pulso: boolean;
  /** Las reuniones de hoy y mañana del CRM, con hora. */
  reuniones: boolean;
  /** Leads cuya etapa adeuda algo (closer/setter). `getPendientesDeMarcar` ESCRIBE. */
  leadsPorDecidir: boolean;
  /** Las prioridades del plan, con su check. */
  plan: boolean;
  /** Vencidas, proyectos atrasados y borradores para confirmar (pm y superadmin). */
  vencimientos: boolean;
};

export function composicionHoy(rol: RolMovil, capa: string | null | undefined): ComposicionHoy {
  const deLaAgencia = capa === 'superadmin' || capa === 'pm';
  const pulso = !deLaAgencia && puedeVerKey('general', rol, capa);
  const crm = !deLaAgencia && puedeVerKey('crm', rol, capa);
  const plan = puedeVerKey('todo', rol, capa);
  return {
    pulso,
    reuniones: crm,
    // El admin-cliente ya tiene el Pulso: «lo que la etapa adeuda» es la cola del closer.
    leadsPorDecidir: crm && !pulso,
    plan,
    vencimientos: plan && deLaAgencia,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que bloquea vs lo que se revisa
// ─────────────────────────────────────────────────────────────────────────────

/** Las bandejas que FRENAN algo hasta que una persona decide (MaKo o el CRM automático esperan). */
export const TIPOS_QUE_BLOQUEAN: readonly TipoDecision[] = ['pendiente', 'accion', 'confirmacion'];

/** Suma las bandejas pedidas; null si alguna no se pudo leer (nunca un 0 inventado). */
export function sumaDe(porTipo: Partial<Record<TipoDecision, number | null>>, tipos: readonly TipoDecision[]): number | null {
  let n = 0;
  for (const t of tipos) {
    if (!(t in porTipo)) continue; // el rol no ve esa bandeja: no suma ni falla
    const v = porTipo[t];
    if (v == null) return null;
    n += v;
  }
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Horas
// ─────────────────────────────────────────────────────────────────────────────

/** «10:00» en la zona del NEGOCIO (no la del teléfono). null si el instante no se lee. */
export function horaEnZona(iso: string | null | undefined, tz: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(d);
  } catch {
    return null;
  }
}
