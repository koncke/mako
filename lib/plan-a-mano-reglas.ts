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

/**
 * LOS 6 MESES GRATIS (30/10/2026, lo que Martín le ofreció a Gabriela: «acceso a la app gratis por 6 meses»). NO son una prueba
 * larga: los topes de la prueba (3 videos, 1 avatar, 1 landing, sin exportar: `TOPES_PRUEBA`) son para probar, y seis meses con
 * eso no es lo que se prometió. Mientras dura tiene su plan entero; lo único que comparte con la prueba es el aviso al vencer,
 * y vencido sin resolver queda como una prueba vencida. 183 días para no quedar nunca cortos de los seis meses.
 */
export const DIAS_REGALO = 183;

/** Los días que se pueden dar desde Customers (se eligen, no se escriben). */
export const DIAS_PLAN_A_MANO = [7, 14, 30, DIAS_REGALO] as const;

/** Cómo se ve cada opción. */
export const rotuloDeDias = (d: number): string => (d === DIAS_REGALO ? '6 meses gratis' : `${d} días`);

/** Cuántos días antes del fin de los 6 meses se avisa (30/10/2026): enterarse el día que se corta es tarde para un cliente. */
export const DIAS_AVISO_REGALO = 14;

export type PlanAMano = { desde: string; hasta: string; avisadoAt: string | null; regalo?: true; avisoPrevioAt?: string };

/** ¿Valen los topes de la prueba? Sí, salvo los 6 meses gratis mientras duran. */
export const llevaTopesDePrueba = (p: PlanAMano, ahoraMs: number): boolean => !(p.regalo && Date.parse(p.hasta) > ahoraMs);

const DIA_MS = 86_400_000;
const iso = (v: unknown): string | null => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null);

/** El plan a mano que vence a los `dias` desde ahora. Tira con días que no son un entero entre 1 y 60 (o los 6 meses gratis). */
export function planAManoNuevo(dias: number, ahoraMs: number): PlanAMano {
  const regalo = dias === DIAS_REGALO;
  if (!regalo && (!Number.isInteger(dias) || dias < 1 || dias > 60)) throw new Error(`días inválidos para un plan a mano: ${dias}`);
  return { desde: new Date(ahoraMs).toISOString(), hasta: new Date(ahoraMs + dias * DIA_MS).toISOString(), avisadoAt: null, ...(regalo ? { regalo: true as const } : {}) };
}

/** Lo guardado, o null si no hay o no se entiende (tolerante: un setting roto es «sin plan a mano»). */
export function leerPlanAMano(crudo: string | null | undefined): PlanAMano | null {
  try {
    const o = crudo ? (JSON.parse(crudo) as Record<string, unknown>) : null;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const desde = iso(o.desde), hasta = iso(o.hasta);
    if (!desde || !hasta) return null;
    return { desde, hasta, avisadoAt: iso(o.avisadoAt), ...(o.regalo === true ? { regalo: true as const } : {}), ...(iso(o.avisoPrevioAt) ? { avisoPrevioAt: iso(o.avisoPrevioAt)! } : {}) };
  } catch {
    return null;
  }
}

/** ¿Ya venció y todavía no se avisó? (Una sola vez por plan a mano.) */
export const tocaAvisarPlanAMano = (p: PlanAMano, ahoraMs: number): boolean => Date.parse(p.hasta) <= ahoraMs && !p.avisadoAt;

/** ¿Los 6 meses gratis terminan pronto y todavía no se avisó? (Una sola vez; sólo los 6 meses: una prueba de 7 días no lo necesita.) */
export const tocaAvisarFinDeRegalo = (p: PlanAMano, ahoraMs: number): boolean => {
  const falta = Date.parse(p.hasta) - ahoraMs;
  return !!p.regalo && !p.avisoPrevioAt && !p.avisadoAt && falta > 0 && falta <= DIAS_AVISO_REGALO * DIA_MS;
};

const fecha = (isoTxt: string): string => new Date(isoTxt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
/** Con el año: a seis meses de distancia, «1 de mayo» solo no alcanza. */
export const fechaConAnio = (isoTxt: string): string => new Date(isoTxt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });

/** Lo que dicen Customers y Accounts de un plan a mano: hasta cuándo va, o que ya venció. */
export function textoDePlanAMano(p: PlanAMano, ahoraMs: number): string {
  const vigente = Date.parse(p.hasta) > ahoraMs;
  if (p.regalo) return vigente ? `Gratis hasta el ${fechaConAnio(p.hasta)}` : `Sus 6 meses gratis terminaron el ${fechaConAnio(p.hasta)}`;
  return vigente ? `Prueba a mano hasta el ${fechaConAnio(p.hasta)}` : `Su prueba a mano venció el ${fechaConAnio(p.hasta)}`;
}

/** Lo que «Para mirar» dice de unos 6 meses que terminan en `DIAS_AVISO_REGALO` días o que terminaron sin resolver. null = todavía no. */
export function regaloParaMirar(p: PlanAMano, ahoraMs: number): string | null {
  if (!p.regalo || Date.parse(p.hasta) - ahoraMs > DIAS_AVISO_REGALO * DIA_MS) return null;
  return Date.parse(p.hasta) > ahoraMs ? `Sus 6 meses gratis terminan el ${fechaConAnio(p.hasta)}` : `Sus 6 meses gratis terminaron el ${fechaConAnio(p.hasta)}`;
}

/** Los dos avisos ANTES de que terminen los 6 meses. Dice qué cambia y que no se pierde nada: es lo que esa persona necesita saber. */
export function avisosFinDeRegaloCerca(p: { negocio: string; plan: string; hasta: string; linkPlan: string; linkCustomers: string }): {
  persona: { asunto: string; cuerpo: string }; martin: { asunto: string; cuerpo: string };
} {
  return {
    persona: {
      asunto: `Tus 6 meses gratis de MaKo terminan el ${fecha(p.hasta)}`,
      cuerpo: [
        'Hola,',
        '',
        `Tus 6 meses gratis de ${p.plan} para ${p.negocio} terminan el ${fechaConAnio(p.hasta)}. Hasta ese día sigue todo igual.`,
        'Después, tu cuenta y todo lo que cargaste siguen ahí, con límites en lo que creas con IA. Para seguir con el plan completo, escríbenos o entra a «Tu plan»:',
        p.linkPlan,
      ].join('\n'),
    },
    martin: {
      asunto: `Terminan los 6 meses gratis de ${p.negocio}`,
      cuerpo: [
        `Los 6 meses gratis de ${p.plan} que le diste a ${p.negocio} terminan el ${fechaConAnio(p.hasta)}. Ya se lo avisamos a la persona.`,
        'Si no haces nada, desde ese día sigue con los topes de la prueba. No se pausa nada.',
        'Desde Customers le das más días, le dejas el plan sin vencimiento o lo pausas:',
        p.linkCustomers,
      ].join('\n'),
    },
  };
}

/** Los dos avisos del vencimiento: a la persona (qué sigue) y a Martín (qué hacer en Customers). */
export function avisosPlanAManoVencido(p: { negocio: string; plan: string; hasta: string; linkPlan: string; linkCustomers: string; regalo?: boolean }): {
  persona: { asunto: string; cuerpo: string }; martin: { asunto: string; cuerpo: string };
} {
  if (p.regalo) {
    return {
      persona: {
        asunto: 'Terminaron tus 6 meses gratis de MaKo',
        cuerpo: [
          'Hola,',
          '',
          `Tus 6 meses gratis de ${p.plan} para ${p.negocio} terminaron el ${fecha(p.hasta)}.`,
          'Tu cuenta sigue como está, con todo lo que cargaste. Para seguir con el plan completo, escríbenos o entra a «Tu plan»:',
          p.linkPlan,
        ].join('\n'),
      },
      martin: {
        asunto: `Terminaron los 6 meses gratis de ${p.negocio}`,
        cuerpo: [
          `Los 6 meses gratis de ${p.plan} que le diste a ${p.negocio} terminaron el ${fecha(p.hasta)}.`,
          'No se pausó nada (el corte de acceso está apagado): desde hoy sigue con los topes de la prueba hasta que lo resuelvas.',
          'Desde Customers le das más días, le dejas el plan sin vencimiento o lo pausas:',
          p.linkCustomers,
        ].join('\n'),
      },
    };
  }
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
