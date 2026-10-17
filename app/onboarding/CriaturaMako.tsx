'use client';

// =============================================================================
// CriaturaMako — la cara de MaKo en el onboarding, con sus reacciones
// =============================================================================
// Martín (17/10/2026, Ops Center): «La estrella de MaKo debe aparecer en el onboarding... Y debe parpadear y reaccionar
// con las respuestas». La estrella (el dibujo y sus reacciones) la está haciendo Ops Center 3 para TODAS las
// criaturas; hasta que esté, este ADAPTADOR dibuja el muñeco de hoy (./MunecoMako.tsx) y traduce la reacción a lo que el
// muñeco sabe hacer (el ánimo de los ojos) más un gesto del cuerpo en CSS. Cambiar a la estrella es cambiar el cuerpo de
// esta función: la pantalla sólo conoce `reaccion`.
//
// Las reacciones, y cuándo las pide la pantalla (app/onboarding/ChatArranque.tsx):
//   · escucha  — esperando que la persona conteste (parpadea solo);
//   · piensa   — guardando la respuesta o esperando a la IA;
//   · contenta — la respuesta entró (un saltito);
//   · duda     — no la entendió (se ladea).
// Con movimiento reducido, sin gestos: sólo los ojos.
// =============================================================================

import type { CSSProperties } from 'react';
import { MunecoMako } from './MunecoMako';

export type Reaccion = 'escucha' | 'piensa' | 'contenta' | 'duda';

export function CriaturaMako({ size = 40, reaccion = 'escucha', style }: { size?: number; reaccion?: Reaccion; style?: CSSProperties }) {
  const animo = reaccion === 'piensa' ? 'trabajando' : reaccion === 'duda' ? 'cansado' : 'despierto';
  return (
    <span className={`cr-mako cr-mako--${reaccion}`} data-reaccion={reaccion} style={{ display: 'inline-flex', ...style }}>
      <style>{CSS_CRIATURA}</style>
      <MunecoMako size={size} animo={animo} />
    </span>
  );
}

const CSS_CRIATURA = `
.cr-mako { transform-origin: 50% 90%; }
.cr-mako--contenta { animation: cr-salto .55s cubic-bezier(.34,1.56,.64,1) 1; }
.cr-mako--duda { animation: cr-ladea .7s ease-in-out 1; }
.cr-mako--piensa { animation: cr-respira 1.4s ease-in-out infinite; }
@keyframes cr-salto { 0% { transform: translateY(0) scale(1) } 35% { transform: translateY(-22%) scale(1.06, .96) } 70% { transform: translateY(0) scale(.97, 1.04) } 100% { transform: none } }
@keyframes cr-ladea { 0%, 100% { transform: rotate(0) } 30% { transform: rotate(-12deg) } 65% { transform: rotate(8deg) } }
@keyframes cr-respira { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.05) } }
@media (prefers-reduced-motion: reduce) { .cr-mako { animation: none !important; } }
`;
