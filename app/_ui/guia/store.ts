'use client';

// =============================================================================
// La guía de la pestaña en el navegador: qué dice en el chat y qué se está señalando (29/10/2026)
// =============================================================================
// Una por página (la pestaña que se ve). La tab la registra con `useGuiaDeLaTab` (./useGuiaDeLaTab.ts); el chat la dibuja con
// la pieza de las aperturas (app/_chat/AperturaMako.tsx, por `useGuiaEnElChat`); el velo (./VeloGuia.tsx, montado una vez en
// app/layout.tsx) señala el paso de ahora y avisa cuando se hizo. No escribe en la base: la marca de la primera vez la pone
// quien pregunta (`alContestar`).
//   · `dice`: lo que la guía dice en el chat ahora (una apertura: la primera vez, «¿Qué quieres hacer?», «Listo. ¿Algo más?»…);
//   · `objetivo`: lo que se está señalando, con su paso;
//   · `pausado`: lo que se pausó (tocó otra parte de la tab, o Escape): «Seguir», por esta visita.
// La API para la tab y el «?»: `ofrecer(objetivo?)`, `senalar(pasos)`, `cerrar()`.

import { useSyncExternalStore } from 'react';
import type { EstadoApertura } from '@/app/_chat/AperturaMako';
import type { Apertura, Boton } from '@/lib/aperturas/reglas';
import { selectorDe } from '@/lib/recorridos';
import {
  enPausa, fraseDe, leerValor, listoAlgoMas, mientrasSenala, noLoVeo, objetivosOfrecidos, preguntaDeLaGuia, preguntaDonde,
  preguntaQueHacer,
} from '@/lib/guia/reglas';
import type { GuiaDeTab, HechosGuia, ObjetivoGuia, PasoGuia, RolGuia } from '@/lib/guia/tipos';

export type EstadoGuia = {
  guia: GuiaDeTab | null;
  hechos: HechosGuia;
  rol?: RolGuia;
  dice: Apertura | null;
  charla: readonly { mako: string; yo: string }[];
  objetivo: { o: ObjetivoGuia; i: number } | null;
  pausado: ObjetivoGuia | null;
  /** La primera vez: todavía no se sabe si pregunta, o pregunta y no contestó. La apertura de la iniciativa espera. */
  esperando: boolean;
  /** Cuántas veces pidió el chat abierto (la estrella lo abre al empezar un objetivo). */
  abrirChat: number;
  /** En una ventana angosta, el chat se aparta mientras se señala algo de la tab. */
  apartar: boolean;
  /**
   * Una pregunta de MaKo pide la atención (la tab Video, 9/11/2026): sin objetivo de la guía, el velo opaca todo menos los
   * chats y marca el mensaje `[data-mako-destacado]` (lib/guia/huecos.ts → dibujoDestacado). Lo prende y lo apaga quien
   * muestra la pregunta (`destacarEnElChat`).
   */
  destacado: boolean;
};

const VACIO: EstadoGuia = { guia: null, hechos: {}, dice: null, charla: [], objetivo: null, pausado: null, esperando: false, abrirChat: 0, apartar: false, destacado: false };
let estado: EstadoGuia = VACIO;
/** Qué hacer al contestar la pregunta de la primera vez (marcar lo visto): lo pone quien pregunta. */
let alContestar: ((yaSabe: boolean) => void) | null = null;
let donde = 0;
const oyentes = new Set<() => void>();
const poner = (cambio: Partial<EstadoGuia>) => { estado = { ...estado, ...cambio }; for (const f of oyentes) f(); };

/** Para los tests (sin DOM): qué anclas «están». null = el DOM. */
let presenciaFija: ((id: string) => boolean) | null = null;
export const fijarPresenciaParaPruebas = (f: ((id: string) => boolean) | null): void => { presenciaFija = f; };

/** ¿Está esta ancla en la pantalla (con cajas)? */
export function anclaPresente(id: string): boolean {
  if (presenciaFija) return presenciaFija(id);
  if (typeof document === 'undefined') return false;
  try {
    return Array.from(document.querySelectorAll<HTMLElement>(selectorDe(id))).some((el) => el.getClientRects().length > 0);
  } catch { return false; }
}

const ofrecidos = (): ObjetivoGuia[] => (estado.guia ? objetivosOfrecidos(estado.guia, estado.hechos, anclaPresente, estado.rol) : []);

// ── Lo que hace la tab ──────────────────────────────────────────────────────────────────────────────────────────────

/** La tab de la pantalla registra su guía (una por página: la última que se montó). */
export function registrarGuia(guia: GuiaDeTab, hechos: HechosGuia, rol?: RolGuia): void {
  if (estado.guia?.key === guia.key) { poner({ hechos, rol }); return; }
  alContestar = null;
  poner({ ...VACIO, guia, hechos, rol, esperando: true, abrirChat: estado.abrirChat });
}
export function soltarGuia(key: string): void {
  if (estado.guia?.key !== key) return;
  alContestar = null;
  poner({ ...VACIO, abrirChat: estado.abrirChat });
}
export function hechosDeLaGuia(hechos: HechosGuia): void {
  if (JSON.stringify(hechos) !== JSON.stringify(estado.hechos)) poner({ hechos });
}
/** La primera vez ya se decidió sin preguntar (ya la vio, o no corresponde): la iniciativa puede hablar. */
export function sinPrimeraVez(): void { if (estado.esperando && !estado.dice) poner({ esperando: false }); }

/** La pregunta de la primera vez, en el chat. `contestar` marca lo visto. Sin objetivos que se puedan empezar, no pregunta. */
export function preguntarPrimeraVez(contestar: (yaSabe: boolean) => void): void {
  const g = estado.guia;
  if (!g) return;
  const os = ofrecidos();
  if (!os.length) { poner({ esperando: false }); return; }
  alContestar = contestar;
  poner({ dice: preguntaDeLaGuia(g, os), charla: [], objetivo: null, pausado: null, esperando: true });
}

/** No contestó y usó la tab: «si ya lo quiere usar, que lo use». Cuenta como vista; la pregunta se va por esta visita. */
export function ignorarPrimeraVez(): void {
  if (!alContestar || estado.objetivo) return;
  const c = alContestar;
  alContestar = null;
  c(false);
  poner({ dice: null, charla: [], esperando: false });
}

/** El «?» de la tab: «¿Qué quieres hacer?», o un objetivo directo. */
export function ofrecer(objetivo?: string): void {
  const g = estado.guia;
  if (!g) return;
  const os = ofrecidos();
  const o = objetivo ? g.objetivos.find((x) => x.id === objetivo) : null;
  if (o) { empezar(o); return; }
  const conDonde = g.anclas.some((a) => a.pregunta && anclaPresente(a.id));
  poner({ dice: preguntaQueHacer(g, os, conDonde), charla: [], objetivo: null, pausado: null, abrirChat: estado.abrirChat + 1 });
}

/** Señalar unos pasos sueltos (lo que pidió la IA, un «Solucionar»): como un objetivo de esta visita. */
export function senalar(pasos: readonly PasoGuia[], titulo = 'Esto'): void {
  if (!estado.guia || !pasos.length) return;
  empezar({ id: 'suelto', titulo, pasos });
}

export function cerrarGuia(): void {
  if (alContestar) { const c = alContestar; alContestar = null; c(false); }
  poner({ dice: null, charla: [], objetivo: null, pausado: null, esperando: false, apartar: false });
}

// ── Lo que hace el velo ─────────────────────────────────────────────────────────────────────────────────────────────

function empezar(o: ObjetivoGuia): void {
  const g = estado.guia;
  if (!g) return;
  poner({ objetivo: { o, i: 0 }, pausado: null, dice: mientrasSenala(g, fraseDe(g, o.pasos[0])), esperando: false, abrirChat: estado.abrirChat + 1 });
}

/** El velo dice qué frase va en el chat (la del paso, o la de su `antes`). */
export function fraseEnElChat(frase: string): void {
  const g = estado.guia;
  if (!g || !estado.objetivo || estado.dice?.texto === frase) return;
  poner({ dice: mientrasSenala(g, frase) });
}

/** El paso se hizo (tocó el ancla, o apareció lo que esperaba): el próximo, o «Listo. ¿Algo más?». */
export function avanzar(): void {
  const g = estado.guia;
  const ob = estado.objetivo;
  if (!g || !ob) return;
  const i = ob.i + 1;
  if (i < ob.o.pasos.length) { poner({ objetivo: { o: ob.o, i }, dice: mientrasSenala(g, fraseDe(g, ob.o.pasos[i])) }); return; }
  poner({ objetivo: null, dice: listoAlgoMas(g, ofrecidos(), ob.o.id), apartar: false });
}

export function pausar(): void {
  const g = estado.guia;
  const ob = estado.objetivo;
  if (!g || !ob) return;
  poner({ objetivo: null, pausado: ob.o, dice: enPausa(g, ob.o), apartar: false });
}

export function noEsta(porque: 'no-esta' | 'modal'): void {
  const g = estado.guia;
  if (!g) return;
  poner({ objetivo: null, dice: noLoVeo(g, porque), apartar: false });
}

export function apartarChat(si: boolean): void { if (estado.apartar !== si) poner({ apartar: si }); }

/** Prende o apaga el velo de una pregunta de MaKo (ver `destacado`). Con un objetivo de la guía señalando, manda la guía. */
export function destacarEnElChat(si: boolean): void { if (estado.destacado !== si) poner({ destacado: si }); }

// ── Lo que toca la persona en el chat ───────────────────────────────────────────────────────────────────────────────

/** Un toque en lo que dice la guía en el chat (la pieza lo llama por `useGuiaEnElChat`). */
export function elegirEnLaGuia(b: Boton): void {
  const g = estado.guia;
  const dice = estado.dice;
  if (!g || !dice) return;
  const primeraVez = dice.id === `guia:${g.key}`;
  if (b.tipo === 'callar') {
    if (primeraVez && alContestar) { const c = alContestar; alContestar = null; c(b.rotulo === 'Ya sé usarla'); }
    cerrarGuia();
    return;
  }
  if (b.tipo !== 'respuesta') return;
  if (primeraVez && alContestar) { const c = alContestar; alContestar = null; c(false); }
  const v = leerValor(b.valor);
  const charla = [...estado.charla, { mako: dice.texto, yo: b.rotulo }];
  const os = ofrecidos();
  switch (v?.tipo) {
    case 'si': { const o = os[0]; if (o) { poner({ charla }); empezar(o); } return; }
    case 'objetivo': { const o = g.objetivos.find((x) => x.id === v.id); if (o) { poner({ charla }); empezar(o); } return; }
    case 'seguir': { const o = estado.pausado; if (o) { poner({ charla }); empezar(o); } return; }
    case 'donde': donde = 0; poner({ charla, dice: preguntaDonde(g, anclaPresente, donde) }); return;
    case 'otras': donde += 2; poner({ charla, dice: preguntaDonde(g, anclaPresente, donde) }); return;
    case 'ancla': {
      const a = g.anclas.find((x) => x.id === v.id);
      if (a) { poner({ charla }); empezar({ id: `donde-${a.id}`, titulo: a.nombre, pasos: [{ ancla: a.id, frase: a.para }] }); }
      return;
    }
    default:
  }
}

// ── Lo que leen el chat, la estrella y el velo ──────────────────────────────────────────────────────────────────────

const suscribir = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f); }; };
export function useGuia(): EstadoGuia {
  return useSyncExternalStore(suscribir, () => estado, () => VACIO);
}
/** Lo de afuera de React (el velo en sus cuadros de animación). */
export const guiaAhora = (): EstadoGuia => estado;

/**
 * Lo que la guía dice en el chat, con la forma de una apertura (la pieza es la misma, app/_chat/AperturaMako.tsx), y si está
 * señalando (entonces ninguna otra apertura habla: una cosa por vez).
 */
export function useGuiaEnElChat(): { pregunta: EstadoApertura | null; senalando: boolean; esperando: boolean } {
  const e = useGuia();
  return {
    pregunta: e.dice ? { apertura: e.dice, charla: e.charla, elegir: elegirEnLaGuia } : null,
    senalando: e.objetivo != null,
    esperando: e.esperando,
  };
}
