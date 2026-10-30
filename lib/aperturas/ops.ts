// =============================================================================
// La apertura del Cerebro (Ops Center, la estrella de cada tab, la tarjeta de Create): la escalera del primer ingreso (PURO)
// =============================================================================
// docs/mako-iniciativa/plan.md §3.2. El Cerebro es UNO en toda la app, así que su apertura sale en el Ops Center y en la estrella
// de cada tab: gana el primer paso que falta, una cosa por día, y nunca repite una pregunta contestada.
//
// HOY (T1, 29/10/2026) la escalera tiene SU PASO 3, «tu IA», para todos los roles: es lo que frena todo lo demás (sin la app de
// escritorio o sin su IA, MaKo no escribe nada por nadie). Los pasos 1, 2 y 4 a 8 (la oferta, el funnel, la página, los
// anuncios, el plan, el closer con llamadas) son la T3 del plan: leen el negocio en el servidor y se suman acá.
//
// Los hechos se leen VIVOS: la app y la IA las dice `?suIA=1` de /api/mako/chat (lo mismo que bloquea la caja). Se conectó la
// computadora → el paso ya no sale, sin «marcarlo hecho».
// =============================================================================

import type { Apertura, Respuestas, Superficie } from './reglas';

export type HechosOps = {
  /** La app de escritorio, como la decide el servidor (lib/chat-mako-reglas.ts → appDeEscritorio). null = no se sabe todavía. */
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
 * El paso 3 de la escalera: su IA. Sin la app (`bloquea`) o sin su IA conectada, pregunta cuál usa y, según lo que contestó,
 * instalar la app o conectarla ahí mismo. En el teléfono no: ahí no se instala (la caja ya lo dice, `FranjaApp`) y su escalera
 * es la T16 del plan.
 */
export function aperturaOps(h: HechosOps, r: Respuestas): Apertura<never> | null {
  if (h.app == null || h.iaConectada == null || h.app === 'en-la-computadora') return null;
  const falta = h.app === 'bloquea' || h.iaConectada === false;
  if (!falta) return null;
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
  if (h.app === 'bloquea') {
    // «Instalar MaKo» es la MISMA pieza que la de la caja: tocada en cualquiera de las dos, las dos pasan a «Ya lo instalé: conectar».
    return {
      id: 'ops:ia-instalar', alcance: 'negocio', texto: `Instala MaKo en tu computadora y conecta tu ${nombre}.`,
      botones: [{ tipo: 'hacer', rotulo: 'Instalar MaKo', accion: 'instalar' }, { tipo: 'callar', rotulo: 'Ahora no' }],
    };
  }
  return {
    id: 'ops:ia-conectar', alcance: 'negocio', texto: `Conecta tu ${nombre} y ya escribo por ti.`,
    botones: [{ tipo: 'hacer', rotulo: 'Conectar tu IA', accion: 'conectar' }, { tipo: 'callar', rotulo: 'Ahora no' }],
  };
}

/** La superficie del Cerebro. Sus acciones son SÓLO las comunes (instalar, conectar), que hace la pieza: `Apertura<never>`. */
export const SUPERFICIE_OPS: Superficie<HechosOps> = { id: 'ops', acciones: [], apertura: aperturaOps };

/** Los pasos que puede decir, con su porqué (lo lee tests/aperturas.test.ts). */
export const CATALOGO: readonly { id: string; cuando: string }[] = [
  { id: ID_IA, cuando: 'Sin la app de escritorio o sin su IA conectada, nada contestado todavía.' },
  { id: 'ops:ia-cuenta', cuando: 'Contestó «Ninguna todavía».' },
  { id: 'ops:ia-instalar', cuando: 'Contestó Claude o ChatGPT y la app sigue sin estar.' },
  { id: 'ops:ia-conectar', cuando: 'Con la app, contestó Claude o ChatGPT y su IA sigue sin conectar.' },
];

/** Los hechos de prueba: con qué hechos y respuestas sale cada paso (o ninguno). Los corre tests/aperturas.test.ts. */
export const EJEMPLOS: readonly { nombre: string; h: HechosOps; r: Respuestas; espera: string | null; primerPaso?: true }[] = [
  { nombre: 'sin la app, nada contestado', h: { app: 'bloquea', iaConectada: false }, r: {}, espera: ID_IA, primerPaso: true },
  { nombre: 'con la app y sin su IA', h: { app: 'tiene', iaConectada: false }, r: {}, espera: ID_IA, primerPaso: true },
  { nombre: 'sin la app, eligió Claude', h: { app: 'bloquea', iaConectada: true }, r: { [ID_IA]: IA_CLAUDE }, espera: 'ops:ia-instalar' },
  { nombre: 'con la app, eligió ChatGPT', h: { app: 'tiene', iaConectada: false }, r: { [ID_IA]: IA_CHATGPT }, espera: 'ops:ia-conectar' },
  { nombre: 'sin cuenta todavía', h: { app: 'bloquea', iaConectada: false }, r: { [ID_IA]: IA_NINGUNA }, espera: 'ops:ia-cuenta' },
  { nombre: 'con la app y su IA: nada que decir', h: { app: 'tiene', iaConectada: true }, r: {}, espera: null },
  { nombre: 'en el teléfono: su escalera es otra', h: { app: 'en-la-computadora', iaConectada: false }, r: {}, espera: null },
  { nombre: 'sin saber todavía: calla', h: { app: null, iaConectada: null }, r: {}, espera: null },
];
