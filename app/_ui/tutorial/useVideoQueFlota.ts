'use client';
// =============================================================================
// EL VIDEO SIEMPRE A LA VISTA (18/11/2026)
// =============================================================================
// Martín: «si estoy viendo el tutorial y me voy a otro lugar… que aparezca la vista previa chiquitita abajo a la derecha, o si
// scrolleo en el chat y queda muy arriba… que aparezca también ahí abajito». Un video en su lugar (el del día del reto, el de un
// momento del onboarding) que corre y sale de la vista, o se desmonta corriendo porque se navegó, sigue flotando abajo a la derecha
// desde donde iba (`reproducirFlotante`, ./store.ts; lo dibuja <MotorTutorial>).
// =============================================================================
import { useEffect, type RefObject } from 'react';
import { reproducirFlotante } from './store';

export function useVideoQueFlota(ref: RefObject<HTMLVideoElement | null>, clave: string | null, titulo: string): void {
  useEffect(() => {
    const v = ref.current;
    if (!v || !clave) return;
    const flotar = () => {
      if (v.paused || v.ended) return;
      const t = v.currentTime;
      v.pause();
      reproducirFlotante(clave, titulo, t);
    };
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((es) => { for (const e of es) if (!e.isIntersecting) flotar(); }, { threshold: 0.25 })
      : null;
    io?.observe(v);
    return () => { io?.disconnect(); flotar(); };
  }, [ref, clave, titulo]);
}
