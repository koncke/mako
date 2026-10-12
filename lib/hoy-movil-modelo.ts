// =============================================================================
// «Today» de MaKo Mobile — lo PURO: qué se pide por rol, la frase héroe, las horas
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
// ⚠️ LA FRASE HÉROE NUNCA DICE «TODO BIEN» SOBRE LO QUE NO SE LEYÓ (#165). Una lectura
// caída, o un negocio sin fuentes de datos, cambian la frase; el cero de algo que no se
// pudo contar no es un cero.
// =============================================================================

import { puedeVerKey, type RolMovil } from './movil-rutas';
import type { EstadoFuentes, EstadoLampara, AlertaGeneral } from './vista-general-modelo';
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
// La frase héroe: el número va ADENTRO
// ─────────────────────────────────────────────────────────────────────────────

export type SegmentoHeroe = { texto: string; numero?: true };

export type EntradaHeroe = {
  /** null = no aplica o no se pudo leer (cuenta en `fallas` si no se pudo). */
  aprobaciones: number | null;
  revisiones: number | null;
  llamadas: number | null;
  urgentes: number | null;
  tareas: number | null;
  leads: number | null;
  /** Sólo con el Pulso: qué se sabe de las fuentes de datos. null = no hay Pulso. */
  fuentes: EstadoFuentes | null;
  /** Cuántas lecturas pedidas se cayeron. */
  fallas: number;
};

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/**
 * «Te esperan 2 aprobaciones y 3 llamadas» / «Hoy no tienes nada urgente».
 * Devuelve segmentos para que la pantalla ponga el número en negrita sin re-parsear.
 */
export function fraseHeroe(e: EntradaHeroe): SegmentoHeroe[] {
  const partes: Array<{ n: number; txt: string }> = [];
  const suma = (n: number | null, uno: string, varios: string) => {
    if (n != null && n > 0) partes.push({ n, txt: `${n} ${plural(n, uno, varios)}` });
  };
  suma(e.aprobaciones, 'aprobación', 'aprobaciones');
  suma(e.llamadas, 'llamada', 'llamadas');
  suma(e.urgentes, 'alerta urgente', 'alertas urgentes');
  suma(e.leads, 'lead por decidir', 'leads por decidir');
  suma(e.tareas, 'tarea para hoy', 'tareas para hoy');
  suma(e.revisiones, 'cosa para revisar', 'cosas para revisar');

  if (partes.length) {
    const visibles = partes.slice(0, 3);
    const verbo = visibles.length > 1 || visibles[0].n > 1 ? 'Te esperan ' : 'Te espera ';
    const out: SegmentoHeroe[] = [{ texto: verbo }];
    visibles.forEach((p, i) => {
      if (i > 0) out.push({ texto: i === visibles.length - 1 ? ' y ' : ', ' });
      out.push({ texto: p.txt, numero: true });
    });
    return out;
  }
  // Sin nada contado: el «todo tranquilo» sólo si se leyó TODO y hay datos para opinar.
  if (e.fallas > 0) return [{ texto: 'No pude leer todo lo de hoy' }];
  if (e.fuentes === 'sin-leer') return [{ texto: 'No pude leer tus datos' }];
  if (e.fuentes === 'sin-datos') return [{ texto: 'Aún no hay datos de tu negocio' }];
  return [{ texto: 'Hoy no tienes nada urgente' }];
}

// ─────────────────────────────────────────────────────────────────────────────
// La lámpara, en palabras (el color nunca va solo)
// ─────────────────────────────────────────────────────────────────────────────

export function textoLampara(l: { estado: EstadoLampara; urgentes: number; vigilar: number }, fuentes: EstadoFuentes): string {
  if (l.estado === 'apagado') return fuentes === 'sin-leer' ? 'No pude leer tus datos' : 'Sin datos todavía';
  if (l.estado === 'rojo') return `${l.urgentes} ${plural(l.urgentes, 'urgente', 'urgentes')}`;
  if (l.estado === 'ambar') return l.vigilar > 0 ? `${l.vigilar} para vigilar` : 'Para vigilar';
  return 'Todo en orden';
}

/** Las alertas que quedan debajo del titular: sin la que ya es LA acción, y sin las verdes. */
export function alertasRestantes(alertas: readonly AlertaGeneral[], alertaIdx: number | null): AlertaGeneral[] {
  return alertas.filter((a, i) => i !== alertaIdx && a.nivel !== 'verde');
}

// ─────────────────────────────────────────────────────────────────────────────
// Horas y días
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

/** Días que quedan hasta `hasta` (inclusive), desde `hoy`. Nunca negativo. */
export function diasQueQuedan(hoy: string, hasta: string): number {
  const a = Date.parse(`${hoy}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000) + 1);
}
