// =============================================================================
// topes-plan — lo que puede usar cada plan de MaKo (la tabla; hacerla cumplir es de cada área)
// =============================================================================
// Las ofertas del 23/10/2026 (docs/ofertas-mako.md): Esencial y Pro se diferencian por TOPES, no por funciones escondidas
// («el cliente ve todo MaKo desde el primer día»), copiado de Systeme.io. Esto es la tabla, declarativa como la de las
// tabs por capa (lib/capas.ts): el chat de cada área la LEE en el punto donde se crea la cosa (`topeDe(capa, 'crm.leads')`)
// y dice «llegaste al tope de tu plan» con el link a /planes.
//
// La clave es la CAPA (lo que el workspace ya tiene): Esencial = `completo`, Pro = `agencia` (lib/planes-mako.ts, en la rama
// de la suscripción). Un negocio sin plan vendido por la pasarela (el ws1, los acuerdos a mano) también tiene capa `completo`
// y NO se le aplican topes: quien hace cumplir uno pregunta primero si MaKo le cobra el plan por la pasarela
// (`suscripcionDeMakoDe(ws) != null`, lib/cobros.ts).
// =============================================================================

import type { CapaId } from './capas';

export type Tope =
  | 'crm.funnels' | 'crm.leads' | 'chats.lineas_whatsapp' | 'automations.activas' | 'web.landings_publicadas'
  | 'web.dominios' | 'cobros.cuentas' | 'equipo.usuarios'
  // El media buyer con IA (25/10/2026, el Cerebro): Esencial lo tiene en modo «propone», con 2 recomendaciones por día y sin
  // piloto automático (el cupo del plan de entrada de AdAmigo). Lo hace cumplir el chat «Media Buyer»; la vitrina lo lee acá.
  | 'ads.recomendaciones_dia';

/** null = sin tope. */
export const TOPES: Readonly<Record<'completo' | 'agencia', Readonly<Record<Tope, number | null>>>> = {
  // MaKo Esencial (US$47)
  completo: {
    'crm.funnels': 1, 'crm.leads': 2000, 'chats.lineas_whatsapp': 1, 'automations.activas': 3,
    'web.landings_publicadas': 3, 'web.dominios': 1, 'cobros.cuentas': 1, 'equipo.usuarios': 1,
    'ads.recomendaciones_dia': 2,
  },
  // MaKo Pro (US$97): sin esos topes, con 3 líneas y 5 usuarios.
  agencia: {
    'crm.funnels': null, 'crm.leads': null, 'chats.lineas_whatsapp': 3, 'automations.activas': null,
    'web.landings_publicadas': null, 'web.dominios': null, 'cobros.cuentas': null, 'equipo.usuarios': 5,
    'ads.recomendaciones_dia': null,
  },
};

/** Las tabs que son SÓLO del Pro (docs/ofertas-mako.md): una capa «esencial» que las esconda es del área de capas. */
// 25/10/2026: 'ads-manager' salió de acá: el Media Buyer es de los dos planes y lo que separa a Pro es el piloto automático y el
// cupo (ads.recomendaciones_dia), no la tab.
export const TABS_SOLO_PRO = ['closing-analyst', 'image-editor', 'video-editor', 'ai-avatar'] as const;

/** El tope de esa cosa para esa capa. null = sin tope (también para una capa que no es un plan: pm, superadmin). */
export function topeDe(capa: CapaId | string, tope: Tope): number | null {
  const t = (TOPES as Record<string, Record<Tope, number | null>>)[capa];
  return t ? t[tope] : null;
}

/** ¿Puede crear una más? `usadas` es lo que ya tiene. */
export const cabeOtra = (capa: CapaId | string, tope: Tope, usadas: number): boolean => {
  const t = topeDe(capa, tope);
  return t == null || usadas < t;
};

/**
 * LA ruta para «Pasar a Pro» (el Cerebro, 23/10/2026): todo cartel de tope lleva acá, nunca a una ruta propia. Es «Tu plan»
 * (app/configuraciones/plan), donde el negocio ve y cambia su plan.
 */
export const RUTA_CAMBIAR_PLAN = '/configuraciones/plan';

export const textoTope = (t: number): string => `Llegaste al tope de tu plan (${t}). Pasa a MaKo Pro para tener más.`;
