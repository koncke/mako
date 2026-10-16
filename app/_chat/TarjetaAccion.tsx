'use client';

// =============================================================================
// La tarjeta de una acción que MaKo propuso, en la pieza única de chat (16/10/2026)
// =============================================================================
// La MISMA tarjeta del chat del CRM (app/crm/mako-crm/ChatMakoCrm.tsx) y del MaKo Analyst de la ficha, sacada a un
// componente: lo que se ejecuta, a la vista ANTES del botón; la consecuencia pegada al botón; y después, lo que pasó.
// Los textos y el estado salen de app/m/mako/chat-ui.ts (`PILL_PROPUESTA`, `rotuloPrimario`, `SALIDA_PROPUESTA`):
// una tarjeta no puede decir una cosa acá y otra en el teléfono.

import { Button, Status } from '@/app/_ui';
import { PILL_PROPUESTA, SALIDA_PROPUESTA, rotuloPrimario, type ItemHilo } from '@/app/m/mako/chat-ui';

export type ItemPropuesta = Extract<ItemHilo, { k: 'propuesta' }>;

export function TarjetaAccion({ x, enCurso, bloqueada, onCorrer }: {
  x: ItemPropuesta;
  /** Qué botón de ESTA tarjeta está corriendo (null = ninguno). */
  enCurso: 'confirmar' | 'cancelar' | null;
  /** Otra tarjeta está corriendo: ésta espera. */
  bloqueada: boolean;
  onCorrer: (accion: 'confirmar' | 'cancelar') => void;
}) {
  const t = x.t;
  const pill = PILL_PROPUESTA[x.estado];
  const abierta = x.estado === 'pendiente' || x.estado === 'aplicando';
  return (
    <div className="ch-tarjeta" aria-busy={x.estado === 'aplicando' || undefined}>
      <div className="ch-tarjeta__cabeza">
        <Status tono={pill.tono === 'neutro' ? 'neutral' : pill.tono}>{pill.texto}</Status>
        <span>{t.titulo}</span>
      </div>
      <p className="ch-tarjeta__resumen">{t.resumen}</p>
      {abierta && t.detalle.length > 0 && (
        <dl className="ch-tarjeta__lineas">
          {t.detalle.map((l, i) => <div key={i} style={{ display: 'contents' }}><dt>{l.rotulo}</dt><dd>{l.valor}</dd></div>)}
        </dl>
      )}
      {abierta ? (
        <>
          {x.nota && <p className="ch-tarjeta__nota" role="alert">{x.nota}</p>}
          <p className="ch-tarjeta__consecuencia">{t.consecuencia ?? 'MaKo lo ejecuta en cuanto confirmes.'}</p>
          <div className="ch-tarjeta__botones">
            <Button variant="primary" size="sm" loading={enCurso === 'confirmar' || x.estado === 'aplicando'}
              disabled={bloqueada || enCurso === 'cancelar'} onClick={() => onCorrer('confirmar')}>
              {rotuloPrimario(t)}
            </Button>
            <Button variant="tertiary" size="sm" loading={enCurso === 'cancelar'}
              disabled={bloqueada || enCurso === 'confirmar'} onClick={() => onCorrer('cancelar')}>
              {SALIDA_PROPUESTA}
            </Button>
          </div>
        </>
      ) : x.nota ? <p className="ch-tarjeta__nota">{x.nota}</p> : null}
    </div>
  );
}
