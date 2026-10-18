'use client';

// =============================================================================
// CriaturaMako — la cara de MaKo en el onboarding: la ESTRELLA, con sus reacciones
// =============================================================================
// Martín (17/10/2026, Ops Center): «La estrella de MaKo debe aparecer en el onboarding... Y debe parpadear y reaccionar
// con las respuestas». 18/10/2026: «la criatura es la ESTRELLA (no el círculo), sin el círculo azul alrededor».
//
// ⚠️ NO SE DIBUJA ACÁ: es la `Criatura` del Ops Center (app/admin/operaciones/Criatura.tsx) con `ASPECTO_MAKO`
// (lib/centro-munecos.ts), la MISMA estrella que llevan la barra lateral y el Centro desde el run 141. Una copia del
// dibujo se queda vieja el día que el Centro cambie su criatura. Ella parpadea sola, reacciona con la cara y el cuerpo,
// y respeta el movimiento reducido. Hasta el 18/10 este adaptador dibujaba un muñeco redondo propio (MunecoMako, borrado ese día).
//
// Las reacciones, y cuándo las pide la pantalla (app/onboarding/ChatArranque.tsx):
//   · escucha  — esperando que la persona conteste;
//   · piensa   — guardando la respuesta o esperando a la IA;
//   · contenta — la respuesta entró;
//   · duda     — no la entendió.
// =============================================================================

import type { CSSProperties } from 'react';
import { Criatura } from '@/app/admin/operaciones/Criatura';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';

export type Reaccion = 'escucha' | 'piensa' | 'contenta' | 'duda';

export function CriaturaMako({ size = 40, reaccion = 'escucha', style }: { size?: number; reaccion?: Reaccion; style?: CSSProperties }) {
  return (
    <Criatura aspecto={ASPECTO_MAKO} titulo="MaKo" size={size} reaccion={reaccion}
      animo={reaccion === 'piensa' ? 'trabajando' : 'despierto'} style={style} />
  );
}
