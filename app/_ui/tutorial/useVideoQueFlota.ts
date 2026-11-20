'use client';
// =============================================================================
// EL VIDEO SIEMPRE A LA VISTA (18/11/2026)
// =============================================================================
// Martín: «si estoy viendo el tutorial y me voy a otro lugar… que aparezca la vista previa chiquitita abajo a la derecha, o si
// scrolleo en el chat y queda muy arriba… que aparezca también ahí abajito». Un video en su lugar (el del día del reto, el de un
// momento del onboarding) que corre y sale de la vista, o se desmonta corriendo porque se navegó, sigue flotando abajo a la derecha
// desde donde iba (`reproducirFlotante`, ./store.ts; lo dibuja <MotorTutorial>).
// =============================================================================
import { useEffect, useRef, type RefObject } from 'react';
import { reproducirFlotante, volverAlChat, type MotivoFin } from './store';

/** `alTerminarFuera`: si termina (o lo cierran) en la esquina (20/11, D1-03: el día 1 marca Offer Coach igual). */
export function useVideoQueFlota(ref: RefObject<HTMLVideoElement | null>, clave: string | null, titulo: string, alTerminarFuera?: (m: MotivoFin) => void): void {
  const aviso = useRef(alTerminarFuera);
  useEffect(() => { aviso.current = alTerminarFuera; }, [alTerminarFuera]);
  useEffect(() => {
    const v = ref.current;
    if (!v || !clave) return;
    const flotar = () => {
      if (v.paused || v.ended) return;
      const t = v.currentTime;
      v.pause();
      reproducirFlotante(clave, titulo, t, (m) => aviso.current?.(m));
    };
    const io = typeof IntersectionObserver !== 'undefined'
      // Al volver a verse, si estaba flotando, vuelve al chat desde el segundo en que iba (20/11, F2).
      ? new IntersectionObserver((es) => {
        for (const e of es) {
          if (!e.isIntersecting) { flotar(); continue; }
          const t = volverAlChat(clave);
          if (t != null) { try { v.currentTime = t; } catch { /* sin metadata todavía */ } void v.play().catch(() => {}); }
        }
      }, { threshold: 0.25 })
      : null;
    io?.observe(v);
    return () => { io?.disconnect(); flotar(); };
  }, [ref, clave, titulo]);
}
