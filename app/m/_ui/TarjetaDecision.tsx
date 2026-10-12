'use client';

// =============================================================================
// TarjetaDecision — la decisión que BLOQUEA, arriba de Today (una sola)
// =============================================================================
// Es una de las dos tarjetas que /m permite (la otra es «Siguiente acción» en la
// ficha del lead): todo lo demás es una lista con filete. Nunca una pila de estas.
//
//   [Aprobación pendiente]                ← el único naranja de la pantalla
//   Mandar el recordatorio de pago
//   340 mensajes · no se puede deshacer    ← la consecuencia en TINTA, no en gris
//   [ Revisar y aprobar ]                  → abre el sheet que MUESTRA todo
//
// La tarjeta NO aprueba: abre el detalle (el sheet de aprobación), que es donde
// la consecuencia queda pegada al botón que nombra acción + objeto («Enviar 340
// mensajes»). Aprobar desde acá sería aprobar sin haber visto qué sale.
//
// Los rótulos de estado salen de GRAMATICA (lib/mako-gramatica.ts) y no son un
// prop: tres pantallas no pueden llamar distinto al mismo estado.
// =============================================================================

import type { ReactNode } from 'react';
import { Button, ButtonLink } from '@/app/_ui/Button';
import { shadow } from '@/app/_ui/tokens';
import { GRAMATICA } from '@/lib/mako-gramatica';

export type EstadoDecision = 'pendiente' | 'aplicando' | 'hecho' | 'resuelta';

export function TarjetaDecision({ titulo, consecuencia, accion, estado = 'pendiente', resueltaPor, onDeshacer }: {
  titulo: ReactNode;
  /** La consecuencia en prosa, con el número: «340 mensajes · no se puede deshacer». */
  consecuencia: ReactNode;
  /** Lo que abre el detalle: «Revisar y aprobar». Acción + objeto, nunca «Ver» a secas. */
  accion: { rotulo: string; href?: string; onClick?: () => void };
  estado?: EstadoDecision;
  /** Si la resolvió otra persona (en otra pestaña o en WhatsApp): su nombre. */
  resueltaPor?: string;
  /** En «hecho», si se puede revertir. */
  onDeshacer?: () => void;
}) {
  return (
    <article className="m-decision" style={{ boxShadow: shadow.card }}>
      {estado === 'pendiente' && <span className="mk-pill m-decision__pill">{GRAMATICA.aprobacion.rotulo}</span>}
      <h3 className="m-decision__titulo">{titulo}</h3>
      <p className="m-decision__consecuencia">{consecuencia}</p>

      {estado === 'pendiente' && (accion.href
        ? <ButtonLink href={accion.href} variant="primary" size="md" full>{accion.rotulo}</ButtonLink>
        : <Button variant="primary" size="md" full onClick={accion.onClick}>{accion.rotulo}</Button>)}

      {estado === 'aplicando' && (
        <>
          <span className="m-decision__estado" role="status">{GRAMATICA.ejecuta.rotulo}</span>
          <span className="m-decision__barra" aria-hidden><i /></span>
        </>
      )}

      {estado === 'hecho' && (
        <>
          <span className="m-decision__estado m-decision__estado--hecho" role="status">{GRAMATICA.completo.rotulo}</span>
          {onDeshacer && <Button variant="tertiary" size="md" onClick={onDeshacer}>Deshacer</Button>}
        </>
      )}

      {estado === 'resuelta' && (
        <span className="m-decision__estado" role="status">
          {resueltaPor ? `Ya la resolvió ${resueltaPor}` : 'Ya está resuelta'}
        </span>
      )}
    </article>
  );
}
