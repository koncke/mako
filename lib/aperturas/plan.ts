// =============================================================================
// La apertura del Plan: el borrador que MaKo dejó al terminar el onboarding (PURO; 5/11/2026)
// =============================================================================
// docs/mako-iniciativa/plan.md §4 («Plan · estrella») y el paso 7 de la escalera (§3.2), T17. Al cerrar el onboarding MaKo arma un
// BORRADOR del plan (app/api/onboarding/plan-arranque/route.ts), y desde el 5/11/2026 su link queda en el estado del onboarding
// (`EstadoArranque.planBorrador`). Si sigue sin revisar, la estrella del Plan pregunta un HECHO, «¿Tu equipo ya sabe qué hacer esta
// semana?»; con «Todavía no», «Te dejé un borrador con N tareas.» y «Ver el borrador» (/plan/revisar: el borrador se confirma ahí y
// pasa por el Perro; MaKo nunca escribe tareas desde acá). Sólo a quien administra: un closer no confirma el plan del negocio.
//
// ⚠️ LA CLAVE ES DEL NEGOCIO, NO DEL PLAN: `negocio:plan`, la MISMA del paso 7 de la escalera del Ops Center (plan.md §4: «con la
// MISMA clave»). Contestada allá, acá no se repite (useApertura mira la memoria por la clave entera, y suma las respuestas de
// `negocio:` a las de la superficie). Es el caso que lib/aperturas/comunes.ts anuncia con `negocio:funnel`.
// =============================================================================

import type { Apertura, Respuestas, Superficie } from './reglas';

export type HechosPlan = {
  /** El borrador del plan del onboarding, sólo si sigue PENDIENTE. null = no hay, ya se revisó, o no se pudo leer. */
  borrador: { id: string; n: number } | null;
  esAdmin: boolean;
};

export const ID_PLAN = 'negocio:plan';
export const ID_BORRADOR = 'negocio:plan-borrador';
export const TODAVIA_NO = 'no';
export const YA_SABE = 'si';

/** El id del borrador como lo arma `crearPropuesta` (lib/plan-propuesta.ts): letras y números, sin nada que rompa el link. */
const idValido = (id: string): boolean => /^[A-Za-z0-9_-]{4,64}$/.test(id);

export function aperturaPlan(h: HechosPlan, r: Respuestas): Apertura<never> | null {
  if (!h.esAdmin || !h.borrador || !idValido(h.borrador.id)) return null;
  const dijo = r[ID_PLAN];
  if (dijo === YA_SABE) return null;
  if (dijo !== TODAVIA_NO) {
    return {
      id: ID_PLAN, alcance: 'negocio', corto: '¿Tu equipo ya sabe?',
      texto: '¿Tu equipo ya sabe qué hacer esta semana?',
      botones: [
        { tipo: 'respuesta', rotulo: 'Todavía no', valor: TODAVIA_NO },
        { tipo: 'respuesta', rotulo: 'Sí', valor: YA_SABE },
        { tipo: 'callar', rotulo: 'Ahora no' },
      ],
    };
  }
  const n = Math.max(0, Math.round(h.borrador.n));
  return {
    id: ID_BORRADOR, alcance: 'negocio', corto: '¿Viste el borrador?',
    texto: `Te dejé un borrador con ${n === 1 ? '1 tarea' : `${n} tareas`}.`,
    botones: [
      { tipo: 'ir', rotulo: 'Ver el borrador', href: `/plan/revisar/${h.borrador.id}` },
      { tipo: 'callar', rotulo: 'Ahora no' },
    ],
  };
}

export const SUPERFICIE_PLAN: Superficie<HechosPlan> = { id: 'plan', acciones: [], apertura: aperturaPlan };

export const CATALOGO: readonly { id: string; cuando: string }[] = [
  { id: ID_PLAN, cuando: 'Quien administra, con el borrador del plan del onboarding todavía sin revisar.' },
  { id: ID_BORRADOR, cuando: 'Contestó «Todavía no»: el link al borrador.' },
];

const BORRADOR = { id: 'propmskimbc4s4b4h', n: 6 };
export const EJEMPLOS: readonly { nombre: string; h: HechosPlan; r: Respuestas; espera: string | null; primerPaso?: true }[] = [
  { nombre: 'el borrador sin revisar', h: { borrador: BORRADOR, esAdmin: true }, r: {}, espera: ID_PLAN, primerPaso: true },
  { nombre: 'contestó «Todavía no»', h: { borrador: BORRADOR, esAdmin: true }, r: { [ID_PLAN]: TODAVIA_NO }, espera: ID_BORRADOR },
  { nombre: 'contestó «Sí»', h: { borrador: BORRADOR, esAdmin: true }, r: { [ID_PLAN]: YA_SABE }, espera: null },
  { nombre: 'ya se revisó (o no hay)', h: { borrador: null, esAdmin: true }, r: {}, espera: null },
  { nombre: 'un closer no confirma el plan', h: { borrador: BORRADOR, esAdmin: false }, r: {}, espera: null },
];
