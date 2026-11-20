// =============================================================================
// La apertura del Cerebro (Ops Center, la estrella de cada tab, la tarjeta de Create): la escalera del primer ingreso (PURO)
// =============================================================================
// docs/mako-iniciativa/plan.md §3.2. El Cerebro es UNO en toda la app, así que su apertura sale en el Ops Center y en la estrella
// de cada tab: gana el primer paso que falta, una cosa por día, y nunca repite una pregunta contestada.
//
// HOY (T1, 29/10/2026) la escalera tiene SU PASO 3, «tu IA», para todos los roles. Los pasos 1, 2 y 4 a 8 (la oferta, el funnel,
// la página, los anuncios, el plan, el closer con llamadas) son la T3 del plan: leen el negocio en el servidor y se suman acá.
// Hasta el 20/11/2026 el paso también pedía «Instala MaKo en tu computadora» sin la app de escritorio; desde ese día ningún chat la
// pide (Martín: «hoy en día utilizamos los MaKo Tokens», lib/chat-mako-reglas.ts) y el paso pregunta sólo por su IA.
//
// Los hechos se leen VIVOS: la IA la dice `?suIA=1` de /api/mako/chat. Se conectó → el paso ya no sale, sin «marcarlo hecho».
// =============================================================================

import type { Apertura, Respuestas, Superficie } from './reglas';

export type HechosOps = {
  /** La app de escritorio, como la dice el servidor: `tiene` desde el 20/11/2026. null = `?suIA=1` todavía no contestó. */
  app: 'tiene' | 'bloquea' | 'en-la-computadora' | null;
  /** ¿Ya conectó su Claude o su ChatGPT? null = no se sabe todavía. */
  iaConectada: boolean | null;
};

/** Lo que contesta en «¿Cuál usas?». */
export const IA_CLAUDE = 'claude';
export const IA_CHATGPT = 'chatgpt';
export const IA_NINGUNA = 'ninguna';

export const ID_IA = 'ops:ia';

/**
 * El paso 3 de la escalera: su IA. Sin su IA conectada, pregunta cuál usa y, según lo que contestó, cómo crear la cuenta o
 * conectarla ahí mismo. Calla hasta que `?suIA=1` contesta.
 */
export function aperturaOps(h: HechosOps, r: Respuestas): Apertura<never> | null {
  if (h.app == null || h.iaConectada == null) return null;
  if (h.iaConectada) return null;
  const ia = r[ID_IA];
  if (!ia) {
    return {
      id: ID_IA, alcance: 'negocio', corto: '¿Qué IA usas?',
      texto: 'Para escribir por ti uso tu propia IA. ¿Cuál usas?',
      botones: [
        { tipo: 'respuesta', rotulo: 'Claude', valor: IA_CLAUDE },
        { tipo: 'respuesta', rotulo: 'ChatGPT', valor: IA_CHATGPT },
        { tipo: 'respuesta', rotulo: 'Ninguna todavía', valor: IA_NINGUNA },
        { tipo: 'callar', rotulo: 'Ahora no' },
      ],
    };
  }
  if (ia === IA_NINGUNA) {
    // «Ver cómo» abre «Tus cuentas de IA» ahí mismo: ahí está cómo se conecta cada una (para una integración no se sale de la tab).
    return {
      id: 'ops:ia-cuenta', alcance: 'negocio', texto: 'Crea tu cuenta de Claude o de ChatGPT y vuelve: te muestro cómo se conecta.',
      botones: [{ tipo: 'hacer', rotulo: 'Ver cómo', accion: 'conectar' }, { tipo: 'callar', rotulo: 'Ahora no' }],
    };
  }
  const nombre = ia === IA_CHATGPT ? 'ChatGPT' : 'Claude';
  return {
    id: 'ops:ia-conectar', alcance: 'negocio', texto: `Conecta tu ${nombre} y ya escribo por ti.`,
    botones: [{ tipo: 'hacer', rotulo: 'Conectar tu IA', accion: 'conectar' }, { tipo: 'callar', rotulo: 'Ahora no' }],
  };
}

/** La superficie del Cerebro. Sus acciones son SÓLO las comunes (conectar), que hace la pieza: `Apertura<never>`. */
export const SUPERFICIE_OPS: Superficie<HechosOps> = { id: 'ops', acciones: [], apertura: aperturaOps };

/** Los pasos que puede decir, con su porqué (lo lee tests/aperturas.test.ts). */
export const CATALOGO: readonly { id: string; cuando: string }[] = [
  { id: ID_IA, cuando: 'Sin su IA conectada, nada contestado todavía.' },
  { id: 'ops:ia-cuenta', cuando: 'Contestó «Ninguna todavía».' },
  { id: 'ops:ia-conectar', cuando: 'Contestó Claude o ChatGPT y su IA sigue sin conectar.' },
];

/** Los hechos de prueba: con qué hechos y respuestas sale cada paso (o ninguno). Los corre tests/aperturas.test.ts. */
export const EJEMPLOS: readonly { nombre: string; h: HechosOps; r: Respuestas; espera: string | null; primerPaso?: true }[] = [
  { nombre: 'sin su IA, nada contestado', h: { app: 'tiene', iaConectada: false }, r: {}, espera: ID_IA, primerPaso: true },
  { nombre: 'eligió Claude', h: { app: 'tiene', iaConectada: false }, r: { [ID_IA]: IA_CLAUDE }, espera: 'ops:ia-conectar' },
  { nombre: 'eligió ChatGPT', h: { app: 'tiene', iaConectada: false }, r: { [ID_IA]: IA_CHATGPT }, espera: 'ops:ia-conectar' },
  { nombre: 'sin cuenta todavía', h: { app: 'tiene', iaConectada: false }, r: { [ID_IA]: IA_NINGUNA }, espera: 'ops:ia-cuenta' },
  { nombre: 'con su IA: nada que decir', h: { app: 'tiene', iaConectada: true }, r: {}, espera: null },
  { nombre: 'sin saber todavía: calla', h: { app: null, iaConectada: null }, r: {}, espera: null },
];
