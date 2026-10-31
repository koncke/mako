'use client';

// =============================================================================
// El puente con Google Flow, VIVO — el latido que pregunta la pantalla (mudado de VideoGeneratorApp.tsx, 27/10/2026)
// =============================================================================
// ⚠️ EL PUENTE ES ESTADO, NO PROP. El `puente` que trae la página es la foto del momento en que se sirvió; esto lo vuelve a
//    preguntar para que el botón de crear se encienda cuando la persona conecta su navegador, sin recargar.
// Tres límites, y los tres salen de un sondeo que ya se fue de las manos una vez en esta tab: sólo con la pestaña VISIBLE, cada
// 3 s mientras está bloqueado (alguien acaba de abrir Flow y mira el cartel) y cada 15 s ya conectado (el pulso de la
// extensión), y se corta al ocultarse preguntando una vez al volver.
// El reloj (`ahora`) arranca en `null` para no decidir una rama con dos relojes distintos —el del server y el del navegador—
// durante la hidratación, y avanza cada 30 s: así «el puente anda» se apaga solo cuando el latido envejece.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import type { Puente } from '@/lib/flow-cola';
import { estadoDelPuente } from '../puente-avisos';
import { estadoPuenteAction } from '../puente-actions';

export function usePuenteVivo(inicial: Puente | null) {
  const [puente, setPuente] = useState(inicial);
  const [ahora, setAhora] = useState<number | null>(null);
  const bloqueado = useRef(true);
  const arrancarRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let vivo = true;
    let t: number | undefined;
    const preguntar = async () => {
      if (!vivo || document.visibilityState !== 'visible') return;
      try {
        const p = await estadoPuenteAction();
        if (vivo && p) setPuente(p);
      } catch { /* la próxima vuelta reintenta */ }
    };
    const arrancar = () => {
      window.clearInterval(t);
      if (document.visibilityState !== 'visible') return;
      void preguntar();
      t = window.setInterval(() => void preguntar(), bloqueado.current ? 3000 : 15000);
    };
    arrancar();
    arrancarRef.current = arrancar;
    document.addEventListener('visibilitychange', arrancar);
    return () => {
      vivo = false;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', arrancar);
    };
  }, []);

  useEffect(() => {
    setAhora(Date.now());
    const t = window.setInterval(() => setAhora(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const anda = estadoDelPuente(puente, ahora).anda;
  // El ritmo depende de si hay algo que esperar: al cambiar, se rearma el intervalo.
  useEffect(() => {
    const ahoraBloqueado = !anda;
    if (bloqueado.current === ahoraBloqueado) return;
    bloqueado.current = ahoraBloqueado;
    arrancarRef.current?.();
  }, [anda]);

  return { puente, ahora, anda };
}
