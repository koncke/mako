// =============================================================================
// useCita — el estado de «Responder»: qué mensaje se cita, y cómo sale con lo escrito
// =============================================================================
// Sin dibujar nada y sin «use client»: lo usa también un hook de pantalla que no puede traer MensajeWA (app/tickets/soporte/useSoporte.ts,
// tests/frontera-use-client.test.ts). Con la cita dibujada arriba de la caja: ./useCitaDelChat.tsx.
// `clave`: la conversación. Una cita no viaja a otro diseño, proyecto o lead.
// =============================================================================

import { useCallback, useState } from 'react';
import { armarConCita, type Cita, type MensajeWA } from '@/lib/centro-mensajes';

export function useCita(clave: string | number | null = null): {
  cita: Cita | null;
  /** Para `onCitar` de `HiloMako`. */
  citar: (m: MensajeWA) => void;
  /**
   * Lo escrito con la cita adelante. No la saca: si el pedido no sale, sigue ahí. `conAdjuntos`: sale con archivos y sin texto, y la
   * cita igual tiene que viajar (`armarConCita` con texto vacío la perdía, y `soltar` la borraba sin haber salido).
   */
  con: (texto: string, conAdjuntos?: boolean) => string;
  /** Lo que ocupa la cita: se le descuenta al tope de lo escrito, o cortaría el final del mensaje (y el cierre de un documento pegado). */
  reserva: number;
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
    cita,
    citar,
    con: (texto, conAdjuntos = false) => armarConCita(cita, texto.trim() || (cita && conAdjuntos ? 'Mira lo que te adjunto.' : '')),
    reserva: cita ? armarConCita(cita, 'x').length - 1 : 0,
    soltar,
  };
}
