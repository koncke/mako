'use client';

// =============================================================================
// usePosicionesLienzo — dónde quedó cada tarjeta movida en el lienzo de /automations
// =============================================================================
// Quinta tanda, punto 2 (Martín, 09/10/2026): «tampoco se puede mover las tarjetas libremente
// por el lienzo». El lienzo (app/_components/Lienzo.tsx) entrega la posición al SOLTAR; acá se
// guarda con SU PROPIA acción (POST /api/chat-agent/secuencias, `action: 'posiciones'`), nunca
// con Publicar: acomodar el dibujo no cambia qué hace la automatización (lib/secuencia-posiciones.ts).
//
//   · OPTIMISTA: la tarjeta queda donde se soltó en el mismo pintado. Si el guardado falla se dice
//     («No se guardó la posición») y NO se revierte: devolver una tarjeta a mitad de acomodar es más
//     desconcertante que un cartel (el mismo criterio que /mensajes, app/agencia/FlujoAviso.tsx).
//   · CON UN RESPIRO: soltar tres tarjetas seguidas es UN guardado, con el mapa final.
//   · AL IRSE (otra automatización, cerrar la pestaña) lo que esperaba su respiro se manda igual.
//   · SI NO SE LEYERON (`inicial === null`: falta la columna, o la lectura falló) se mueve y NO se
//     guarda: el mapa local arranca vacío, y guardarlo pisaría lo que la persona ya había acomodado.
//     Lo mismo cuando el server contesta `sinColumna`: se deja de intentar, sin cartel (no es nada
//     que la persona pueda arreglar; el server lo deja en el log).

import { useEffect, useRef, useState } from 'react';
import type { Posiciones } from '@/lib/lienzo-posiciones';

/** El respiro entre soltar y guardar. Es el de /mensajes (`mover` en FlujoAviso). */
export const RESPIRO_POSICIONES_MS = 450;

export function usePosicionesLienzo(
  secuenciaId: number,
  inicial: Posiciones | null | undefined,
  opts: { puedeGuardar: boolean; onError?: (m: string) => void },
): { posiciones: Posiciones; mover: (sig: Posiciones) => void } {
  const [posiciones, setPosiciones] = useState<Posiciones>(() => inicial ?? {});
  const guardable = useRef(opts.puedeGuardar && inicial != null);
  const pendiente = useRef<{ t: ReturnType<typeof setTimeout>; pos: Posiciones } | null>(null);
  const onError = useRef(opts.onError);
  useEffect(() => { onError.current = opts.onError; });

  const mandar = useRef(async (pos: Posiciones) => {
    try {
      const r = await fetch('/api/chat-agent/secuencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ action: 'posiciones', secuenciaId, posiciones: pos }),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; sinColumna?: boolean } | null;
      if (j?.sinColumna) { guardable.current = false; return; }
      if (!j?.ok) onError.current?.('No se guardó la posición');
    } catch {
      onError.current?.('No se guardó la posición');
    }
  }).current;

  const despachar = () => {
    const p = pendiente.current;
    if (!p) return;
    clearTimeout(p.t);
    pendiente.current = null;
    void mandar(p.pos);
  };

  const mover = (sig: Posiciones) => {
    setPosiciones(sig);
    if (!guardable.current) return;
    if (pendiente.current) clearTimeout(pendiente.current.t);
    const t = setTimeout(() => { pendiente.current = null; void mandar(sig); }, RESPIRO_POSICIONES_MS);
    pendiente.current = { t, pos: sig };
  };

  // Al irse, y al esconder la pestaña (el desmonte no corre al cerrarla): lo que esperaba su respiro
  // sale ya, con `keepalive` para que sobreviva al cierre.
  useEffect(() => {
    const alEsconder = () => { if (document.visibilityState === 'hidden') despachar(); };
    document.addEventListener('visibilitychange', alEsconder);
    return () => { document.removeEventListener('visibilitychange', alEsconder); despachar(); };
    // `despachar` lee refs: no cambia nada entre renders que importe acá.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { posiciones, mover };
}
