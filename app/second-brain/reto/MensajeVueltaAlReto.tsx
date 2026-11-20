'use client';
// «Tu día 1 está completo…» en el chat de Funnel Coach (20/11/2026, verificación de la auditoría D1-05; la maqueta, RETO_LISTO y
// b-ver-reto): MaKo escribe (los tres puntitos) y manda el mensaje; recién después la pantalla marca la fila del reto
// (./useVueltaAlReto.ts espera a este mensaje). Antes la marca salía sola, sin que nada en el chat dijera por qué.
// Los puntitos duran lo de la cola de salida, según el largo (auditoría de chats del 20/11, reto-8: eran 1,2 s fijos); siempre menos
// que MS_ANTES_DE_LA_VUELTA, así la marca sale con el mensaje ya escrito.
import { useEffect, useState } from 'react';
import { RETO_LISTO } from '@/lib/reto/dias';
import { msEscribiendo } from '@/app/_chat/useColaDeSalida';
import { Burbuja } from './Burbuja';

export function MensajeVueltaAlReto() {
  const [listo, setListo] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setListo(true), msEscribiendo(RETO_LISTO)); return () => window.clearTimeout(t); }, []);
  return (
    <Burbuja>
      {listo ? <p data-recorrido="sb-funnel-vuelta-al-reto">{RETO_LISTO}</p>
        : <span className="co-escribiendo" role="status" aria-label="MaKo está escribiendo"><span className="co-trabajando__puntos" aria-hidden><i /><i /><i /></span></span>}
    </Burbuja>
  );
}
