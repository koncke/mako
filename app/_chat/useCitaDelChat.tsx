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
    citar,
    arriba: cita ? <CitaCaja cita={cita} onQuitar={soltar} /> : null,
    con: (texto, conAdjuntos = false) => armarConCita(cita, texto.trim() || (cita && conAdjuntos ? 'Mira lo que te adjunto.' : '')),
    reserva: cita ? armarConCita(cita, 'x').length - 1 : 0,
    soltar,
  };
}
