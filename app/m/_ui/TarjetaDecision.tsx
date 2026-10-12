'use client';

// =============================================================================
// TarjetaDecision — la decisión que BLOQUEA, arriba de Today (una sola)
// =============================================================================
// Es una de las dos tarjetas que /m permite (la otra es «Siguiente acción» en la
// ficha del lead): todo lo demás es una lista con filete. Nunca una pila de estas.
//
//   ✦ Mandar el recordatorio de pago       ← la estrella SÓLO si MaKo lo propuso (`estrella`)
//   340 mensajes · no se puede deshacer    ← la consecuencia en TINTA, no en gris
//   [        Revisar y aprobar         ]   → botón grande (lg, ancho completo): abre lo que MUESTRA todo
//
// v2 (prototipo `#today`, 11/10/2026): sin la píldora «Aprobación pendiente» (una píldora que no
// decide nada se va; la tarjeta suelta ya dice que algo espera) y con el botón grande.
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
import { MakoStar } from '@/app/_components/MakoBrand';

export type EstadoDecision = 'pendiente' | 'aplicando' | 'hecho' | 'resuelta';

export function TarjetaDecision({ titulo, consecuencia, accion, estado = 'pendiente', resueltaPor, onDeshacer, estrella = false }: {
  titulo: ReactNode;
  /** La estrella de MaKo junto al título: SÓLO si lo que bloquea lo propuso MaKo (nunca «porque sí»). */
  estrella?: boolean;
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
      <div className="m-decision__cab">
        {estrella && <MakoStar size={20} animate={false} />}
        <h3 className="m-decision__titulo">{titulo}</h3>
      </div>
      <p className="m-decision__consecuencia">{consecuencia}</p>

      {estado === 'pendiente' && (accion.href
        ? <ButtonLink href={accion.href} variant="primary" size="lg" full>{accion.rotulo}</ButtonLink>
        : <Button variant="primary" size="lg" full onClick={accion.onClick}>{accion.rotulo}</Button>)}

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
