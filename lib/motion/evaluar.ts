// =============================================================================
// motion/evaluar — el estado de cada pedazo en el tiempo t (una función pura del tiempo)
// =============================================================================
// «Pure function of time. No requestAnimationFrame state, no CSS animations, no accumulated physics» (javascript-
// animation, de las skills de iart-ai, MIT, Copyright (c) 2026 iart.ai). El lienzo pide el estado en t y dibuja;
// buscar un cuadro, retroceder o exportar dan el mismo resultado.
//
// Cada efecto es un «desde → hasta» con UNA curva, exactamente lo que hace una animación de CSS con
// `cubic-bezier(...)`: así el CSS de la landing (./html.ts y ./css.ts) y este lienzo pintan lo mismo en el mismo t.
// Si se agrega un efecto, se agrega acá Y su @keyframes en ./css.ts (el test lo cruza).
// =============================================================================

import { aplicarCurva } from './curvas';
import type { Capa, Efecto, Latido, Tramo } from './tipos';

export type EstadoPedazo = {
  alfa: number;
  /** Corrimiento en em de la letra (texto) o en fracción del lado (cajas): x a la derecha, y hacia abajo. */
  dxEm: number;
  dyEm: number;
  /** Corrimiento en fracciones del alto del propio pedazo: la máscara de «subir» (110 %). */
  dyAlto: number;
  escala: number;
  escalaX: number;
  escalaY: number;
  rot: number;
  blurEm: number;
  /** Cuánto del pedazo tapa el recorte por la derecha (0 = nada, 1 = todo). */
  corteDer: number;
  /** Cuánto rodó un dígito hacia su valor (0 a 1). */
  rodar: number;
};

const QUIETO: EstadoPedazo = { alfa: 1, dxEm: 0, dyEm: 0, dyAlto: 0, escala: 1, escalaX: 1, escalaY: 1, rot: 0, blurEm: 0, corteDer: 0, rodar: 1 };

/** Los valores de partida de cada efecto (el cuadro 0 de su @keyframes). Lo comparte el CSS (./css.ts). */
export const DESDE = {
  subirAlto: 1.1,
  deslizarEm: 0.5,
  escalaDesde: 0.85,
  blurEm: 0.25,
  girarGrados: -40,
  salidaDeslizarEm: 0.4,
  salidaEscala: 0.6,
} as const;

/** El estado de un efecto de ENTRADA con avance e (ya con la curva: puede pasar de 1 con un rebote). */
export function entrada(efecto: Efecto, e: number): EstadoPedazo {
  const s = { ...QUIETO };
  const op = Math.max(0, Math.min(1, e));
  switch (efecto) {
    case 'aparecer': s.alfa = op; break;
    case 'subir': s.dyAlto = DESDE.subirAlto * (1 - e); break;
    case 'deslizar': s.alfa = op; s.dyEm = DESDE.deslizarEm * (1 - e); break;
    case 'caer': s.alfa = op; s.dyEm = -DESDE.deslizarEm * (1 - e); break;
    case 'escalar': s.alfa = op; s.escala = DESDE.escalaDesde + (1 - DESDE.escalaDesde) * e; break;
    case 'desenfoque': s.alfa = op; s.blurEm = DESDE.blurEm * (1 - op); break;
    case 'barrido': s.corteDer = 1 - op; break;
    case 'crecer-x': s.escalaX = e; break;
    case 'crecer-y': s.escalaY = e; break;
    case 'girar': s.alfa = op; s.escala = e; s.rot = DESDE.girarGrados * (1 - e); break;
    // El odómetro aparece mientras gira: un clip arranca vacío (no con «0000» en el cuadro 0).
    case 'rodar': s.alfa = op; s.rodar = e; break;
  }
  return s;
}

/** El estado de un efecto de SALIDA con avance e (del estado natural al final). */
export function salida(efecto: Efecto, e: number): EstadoPedazo {
  const s = { ...QUIETO };
  const op = Math.max(0, Math.min(1, e));
  switch (efecto) {
    case 'aparecer': case 'rodar': s.alfa = 1 - op; break;
    case 'subir': s.dyAlto = -DESDE.subirAlto * e; break;
    case 'deslizar': s.alfa = 1 - op; s.dyEm = -DESDE.salidaDeslizarEm * e; break;
    case 'caer': s.alfa = 1 - op; s.dyEm = DESDE.salidaDeslizarEm * e; break;
    case 'escalar': s.alfa = 1 - op; s.escala = 1 - (1 - DESDE.salidaEscala) * e; break;
    case 'desenfoque': s.alfa = 1 - op; s.blurEm = DESDE.blurEm * op; break;
    case 'barrido': s.corteDer = op; break;
    case 'crecer-x': s.escalaX = 1 - e; break;
    case 'crecer-y': s.escalaY = 1 - e; break;
    case 'girar': s.alfa = 1 - op; s.escala = 1 - e; s.rot = -DESDE.girarGrados * e; break;
  }
  return s;
}

/** Cuándo arranca el pedazo i de un tramo. */
export const inicioPedazo = (tr: Tramo, i: number): number => tr.t0 + i * tr.paso;

const avance = (tr: Tramo, i: number, t: number): number => aplicarCurva(tr.curva, (t - inicioPedazo(tr, i)) / Math.max(1, tr.dur));

/** El efecto que corresponde a un pedazo: en una cifra, los dígitos ruedan y lo demás aparece. */
function efectoDe(c: Capa, i: number, ef: Efecto): Efecto {
  if (c.k === 'cifra' && ef === 'rodar') return 'd' in c.partes[i] ? 'rodar' : 'aparecer';
  return ef;
}

/** El estado del pedazo i de una capa en el tiempo t (ms desde el inicio). */
export function estadoPedazo(c: Capa, i: number, t: number): EstadoPedazo {
  if (c.sale && t >= inicioPedazo(c.sale, i)) return salida(efectoDe(c, i, c.sale.efecto), avance(c.sale, i, t));
  return entrada(efectoDe(c, i, c.entra.efecto), avance(c.entra, i, t));
}

/** La escala del latido en t (1 fuera de él). La mitad que sube y la que baja con la misma curva, como el @keyframes. */
export function escalaLatido(l: Latido | undefined, t: number): number {
  if (!l || t < l.t0 || t >= l.t0 + l.periodo * l.veces) return 1;
  const fase = ((t - l.t0) % l.periodo) / l.periodo;
  const mitad = fase < 0.5 ? fase * 2 : (1 - fase) * 2;
  return 1 + (l.escala - 1) * aplicarCurva('suave', mitad);
}
