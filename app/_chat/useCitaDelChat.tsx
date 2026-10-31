'use client';

// =============================================================================
// useCitaDelChat — «Responder» del clic derecho en un chat con MaKo: la cita arriba de la caja, y sale con lo escrito
// =============================================================================
// `HiloMako` ya abre el menú (Copiar siempre; Responder si la pantalla pasa `onCitar`). Lo que cada chat tenía que escribir era
// lo mismo: guardar la cita, dibujarla en la caja y pegarla al texto al mandar. Acá, una vez (Martín, 24/10/2026: «si le doy
// click derecho, no hace nada»; pendiente P5). `clave`: la conversación. Una cita no viaja a otro diseño, proyecto o lead.
//
// El Web Generator y el Copywriter lo tienen escrito aparte desde antes, con su propia lógica de mandar.
// =============================================================================

import { useCallback, useState, type ReactNode } from 'react';
import { CitaCaja } from '@/app/admin/operaciones/MensajeWA';
import { armarConCita, type Cita, type MensajeWA } from '@/lib/centro-mensajes';

export function useCitaDelChat(clave: string | number | null = null): {
  /** Para `onCitar` de `HiloMako`. */
  citar: (m: MensajeWA) => void;
  /** Para `arriba` de `CajaChat`. */
  arriba: ReactNode;
  /** Lo escrito con la cita adelante. No la saca: si el pedido no sale, sigue ahí. */
  con: (texto: string) => string;
  /** Al vaciar la caja. */
  soltar: () => void;
} {
  const [guardada, setGuardada] = useState<{ clave: string | number | null; cita: Cita } | null>(null);
  const cita = guardada && guardada.clave === clave ? guardada.cita : null;
  const citar = useCallback((m: MensajeWA) => {
    setGuardada({ clave, cita: { de: m.de, texto: m.texto, id: m.id } });
  }, [clave]);
  const soltar = useCallback(() => setGuardada(null), []);
  return {
    citar,
    arriba: cita ? <CitaCaja cita={cita} onQuitar={soltar} /> : null,
    con: (texto) => armarConCita(cita, texto),
    soltar,
  };
}
