// =============================================================================
// plan-a-mano-reglas — el plan dado A MANO con vencimiento (28/10/2026)
// =============================================================================
// Lo que Martín le prometió a Teo («te puedo dar 7 días de prueba», 01:03:00): sin pasarela, el plan se da a mano en Customers,
// y ahora puede llevar un vencimiento. Mientras lo tiene, el negocio está «en prueba» (lib/prueba-uso.ts, `estadoDePrueba`) y
// valen los topes de la prueba; al vencer se le avisa a la persona y a Martín (lib/plan-a-mano.ts). NO se pausa: el corte de
// acceso general está apagado (`CORTE_DE_ACCESO_PRENDIDO`, lib/plan-acceso-reglas.ts), y el día que se prenda este plan cae
// en el corte como cualquier otro (la decisión del Cerebro, 28/10).
//
// Se guarda como un setting del negocio (sin migración). Puro: lo usan el server, Customers y los tests.
// =============================================================================

/** El setting del negocio con su vencimiento (JSON: `PlanAMano`). */
export const CLAVE_PLAN_A_MANO = 'plan.a_mano';

/** Los días que se pueden dar desde Customers (se eligen, no se escriben). */
export const DIAS_PLAN_A_MANO = [7, 14, 30] as const;

export type PlanAMano = { desde: string; hasta: string; avisadoAt: string | null };

const DIA_MS = 86_400_000;
const iso = (v: unknown): string | null => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null);

/** El plan a mano que vence a los `dias` desde ahora. Tira con días que no son un entero entre 1 y 60. */
export function planAManoNuevo(dias: number, ahoraMs: number): PlanAMano {
  if (!Number.isInteger(dias) || dias < 1 || dias > 60) throw new Error(`días inválidos para un plan a mano: ${dias}`);
  return { desde: new Date(ahoraMs).toISOString(), hasta: new Date(ahoraMs + dias * DIA_MS).toISOString(), avisadoAt: null };
}

/** Lo guardado, o null si no hay o no se entiende (tolerante: un setting roto es «sin plan a mano»). */
export function leerPlanAMano(crudo: string | null | undefined): PlanAMano | null {
  try {
    const o = crudo ? (JSON.parse(crudo) as Record<string, unknown>) : null;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const desde = iso(o.desde), hasta = iso(o.hasta);
    if (!desde || !hasta) return null;
    return { desde, hasta, avisadoAt: iso(o.avisadoAt) };
  } catch {
    return null;
  }
}

/** ¿Ya venció y todavía no se avisó? (Una sola vez por plan a mano.) */
export const tocaAvisarPlanAMano = (p: PlanAMano, ahoraMs: number): boolean => Date.parse(p.hasta) <= ahoraMs && !p.avisadoAt;

const fecha = (isoTxt: string): string => new Date(isoTxt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });

/** Los dos avisos del vencimiento: a la persona (qué sigue) y a Martín (qué hacer en Customers). */
export function avisosPlanAManoVencido(p: { negocio: string; plan: string; hasta: string; linkPlan: string; linkCustomers: string }): {
  persona: { asunto: string; cuerpo: string }; martin: { asunto: string; cuerpo: string };
} {
  return {
    persona: {
      asunto: 'Terminó tu prueba de MaKo',
      cuerpo: [
        'Hola,',
        '',
        `Tu prueba de ${p.plan} para ${p.negocio} terminó el ${fecha(p.hasta)}.`,
        'Tu cuenta sigue como está, con todo lo que cargaste. Para seguir con el plan completo, escríbenos o entra a «Tu plan»:',
        p.linkPlan,
      ].join('\n'),
    },
    martin: {
      asunto: `Venció la prueba a mano de ${p.negocio}`,
      cuerpo: [
        `La prueba de ${p.plan} que le diste a mano a ${p.negocio} venció el ${fecha(p.hasta)}.`,
        'No se pausó nada (el corte de acceso está apagado): sigue con los topes de la prueba hasta que lo resuelvas.',
        'Desde Customers le das más días, le dejas el plan sin vencimiento o lo pausas:',
        p.linkCustomers,
      ].join('\n'),
    },
  };
}
