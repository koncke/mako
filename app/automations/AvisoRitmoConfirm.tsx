'use client';

// =============================================================================
// AvisoRitmoConfirm — el cartel de lo que va a pasar al prender una automatización (lib/ritmo-al-activar.ts)
// =============================================================================
// UN SOLO CARTEL para la tarjeta del lienzo y el «⋯» de la lista. `Confirm` tiene dos botones, y cada uno ya tiene su trabajo:
// confirmar prende y cancelar lleva a Configuraciones (Escape y el fondo cancelan: cerrarlo nunca la prende). Descartar los
// borradores viejos es otra cosa, y por eso va adentro del mensaje, al lado de lo que explica. No prende nada.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { Confirm } from '@/app/_ui/Confirm';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import type { AvisoDeRitmo } from '@/lib/ritmo-al-activar';
import { descartarViejosDelAviso } from './aviso-ritmo-descartar';

export function AvisoRitmoConfirm({ aviso, secuenciaId, incluir, puedePoner, onDescartado, onConfirm, onCancel }: {
  aviso: AvisoDeRitmo; secuenciaId: number; incluir?: boolean; puedePoner: boolean;
  /** Se descartaron: el aviso de nuevo, ya sin ellos. */
  onDescartado: (a: AvisoDeRitmo) => void;
  onConfirm: () => void; onCancel: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ⚠️ Al volver, el botón ya no está y el foco quedaba en ningún lado: el Enter siguiente, el mismo que descartó, prendía la automatización sin haber leído el
  // aviso nuevo (revisión del 31/10/2026). El foco va al mensaje, donde Enter no hace nada (`data-sin-enter`).
  const mensajeRef = useRef<HTMLDivElement | null>(null);
  const [volvio, setVolvio] = useState(0);
  useEffect(() => { if (volvio) mensajeRef.current?.focus(); }, [volvio]);
  const descartar = async () => {
    if (!aviso.viejos) return;
    setOcupado(true);
    setError(null);
    const r = await descartarViejosDelAviso(secuenciaId, aviso.viejos.ids, incluir);
    setOcupado(false);
    setVolvio((n) => n + 1);
    if (r.ok) onDescartado(r.aviso);
    else setError(r.error);
  };
  return (
    <Confirm tone="primary" bloqueado={ocupado} onConfirm={onConfirm} onCancel={onCancel}
      confirmLabel={aviso.poner || aviso.viejos ? 'Activar igual' : 'Activar'}
      cancelLabel={aviso.poner && puedePoner ? aviso.poner : 'Cancelar'}
      message={(
        <div ref={mensajeRef} tabIndex={-1} data-sin-enter style={{ outline: 'none' }}>
          {aviso.texto}
          {aviso.viejos && (
            <div style={{ marginTop: aviso.texto ? 12 : 0 }}>
              {aviso.viejos.frase}
              <div style={{ marginTop: 10 }}>
                <Button variant="secondary" size="sm" loading={ocupado} onClick={() => void descartar()}>{aviso.viejos.boton}</Button>
              </div>
            </div>
          )}
          {error && <p role="alert" style={{ margin: '10px 0 0', color: 'var(--bad)' }}>{error}<ReportarASoporte /></p>}
        </div>
      )} />
  );
}
