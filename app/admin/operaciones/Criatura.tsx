'use client';

// =============================================================================
// La CRIATURA viva: el muñeco que parpadea solo, entra con una animación, invita a tocarlo y reacciona (17/10/2026)
// =============================================================================
// Martín (por el Cerebro): «Agrega a las criaturas la criatura de MaKo, la típica estrella... Y debe parpadear y reaccionar
// con las respuestas... y también una reacción si la clickeo, estén presentes en todos lados y en todas las criaturas».
// Envuelve a `Muneco` (que sigue sin hooks: lo dibuja también el servidor). La de MaKo es `ASPECTO_MAKO`
// (lib/centro-munecos.ts): la estrella dorada, que sólo tiene el Cerebro.
//   · `entrada`: corre UNA vez al montar (crece con un rebote, como la entrada de un personaje) y avisa con `onEntrada`;
//   · `invita`: late y brilla hasta el primer clic (el onboarding la usa para «tocame»);
//   · el CLIC siempre tiene su reacción (salta contenta), además de `onClick`;
//   · `reaccion`: la cara y el cuerpo de una respuesta («escucha» se inclina, «contenta» salta y se ríe, «piensa» mira
//     arriba, «sorpresa» se estira con la boca abierta, «duda» ladea la cabeza);
//   · el PARPADEO es solo, cada tanto, en todas.
// Con movimiento reducido: sin entrada ni latido, y las reacciones sólo con la cara.
// La referencia del movimiento son los personajes de Duolingo (entra, invita, reacciona a lo que pasa), no sus dibujos.

import { useEffect, useRef, useState, type AnimationEvent, type CSSProperties } from 'react';
import { Muneco, type Animo } from './Muneco';
import type { Aspecto, CaraMuneco } from '@/lib/centro-munecos';
import { aspectoDe } from '@/lib/centro-munecos';
import './criatura.css';

export type Reaccion = 'escucha' | 'contenta' | 'piensa' | 'sorpresa' | 'duda';
/** La boca de cada reacción: la cara cuenta la reacción aunque no haya movimiento. */
export const BOCA_DE: Record<Reaccion, CaraMuneco> = { escucha: 'sonrisa', contenta: 'risa', piensa: 'tranquila', sorpresa: 'asombro', duda: 'tranquila' };
const DURA_CLIC_MS = 900;

export function Criatura({ aspecto, titulo = 'MaKo', size = 40, animo = 'despierto', reaccion = null, entrada = false, onEntrada, invita = false, onClick, style }: {
  aspecto?: Aspecto | null; titulo?: string; size?: number; animo?: Animo;
  reaccion?: Reaccion | null; entrada?: boolean; onEntrada?: () => void; invita?: boolean; onClick?: () => void;
  style?: CSSProperties;
}) {
  const [entrando, setEntrando] = useState(entrada);
  const [tocada, setTocada] = useState(false);
  const [deClic, setDeClic] = useState(false);
  const reloj = useRef<number | null>(null);
  useEffect(() => () => { if (reloj.current) window.clearTimeout(reloj.current); }, []);
  // Sin movimiento, la entrada termina en el acto (no hay animación que espere).
  useEffect(() => {
    if (!entrada) return;
    let quieta = false;
    try { quieta = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* sin matchMedia */ }
    if (quieta) { setEntrando(false); onEntrada?.(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const viva: Reaccion | null = deClic ? 'contenta' : reaccion;
  const base = aspectoDe(titulo, aspecto);
  const cara: Aspecto = viva ? { ...base, cara: BOCA_DE[viva] } : base;
  const clases = ['cri', entrando ? 'cri--entra' : '', invita && !tocada ? 'cri--invita' : '', viva ? `cri--${viva}` : '', onClick ? 'cri--toca' : ''].filter(Boolean).join(' ');
  const tocar = () => {
    setTocada(true);
    setDeClic(true);
    if (reloj.current) window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => setDeClic(false), DURA_CLIC_MS);
    onClick?.();
  };
  const dibujo = <Muneco titulo={titulo} aspecto={cara} animo={animo} size={size} />;
  const comun = {
    className: clases, style: { display: 'inline-flex', ...style },
    onAnimationEnd: (e: AnimationEvent) => { if (e.animationName === 'cri-entra') { setEntrando(false); onEntrada?.(); } },
  };
  return onClick
    ? <button type="button" aria-label={titulo} onClick={tocar} {...comun}>{dibujo}</button>
    : <span aria-hidden onClick={tocar} {...comun}>{dibujo}</span>;
}
