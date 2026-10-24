'use client';

// =============================================================================
// UnificarFichas — «Unificar» desde «Hay otra ficha parecida»: qué queda de cada una, y recién después se hace (23/10/2026)
// =============================================================================
// Martín: «que me de la opción ahí mismo de unificarlas». No se deshace (la otra ficha deja de existir), así que ANTES
// se dice, con la previa que arma el server (`previaDeUnificarAction`, app/crm/unificar-actions.ts):
//   · cuál queda (de entrada la más vieja; «Quedarme con la otra» la da vuelta) y cuál se va;
//   · los datos: de cuál sale cada uno (lo que tiene la que queda, gana; lo que le falta, lo trae de la otra);
//   · los CRM y su etapa, y lo que se mueve (mensajes, historial, automatizaciones, pagos, etiquetas…);
//   · los choques, dichos («las dos están en «X»: queda la que va más adelante»).
// La referencia: «Merge» de HubSpot (eliges el registro principal y ves qué valor queda de cada propiedad).
// =============================================================================

import { useEffect, useState } from 'react';
import { Button } from '@/app/_ui';
import { Modal } from '@/app/_ui/Modal';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { previaDeUnificarAction, unificarFichasAction } from '@/app/crm/unificar-actions';
import type { PreviaUnificar } from '@/lib/leads-unificar-reglas';
import { textoDeLaPrevia } from '@/lib/leads-unificar-reglas';
import { useRefrescarFicha } from '../../ficha-cambio';

export function UnificarFichas({ esta, otra, onCerrar, onUnificado }: {
  esta: { id: number; nombre: string };
  otra: { id: number; nombre: string };
  onCerrar: () => void;
  onUnificado: (quedo: number) => void;
}) {
  const refrescar = useRefrescarFicha();
  // Cuál queda: null = la que propone el server (la más vieja, o la que tiene la venta).
  const [queda, setQueda] = useState<number | null>(null);
  // La previa es de UN pedido (cuál queda): mientras no llega la de ESE pedido, se dibuja «cargando» (sin un setState
  // sincrónico en el efecto, la regla de react-hooks).
  const [leida, setLeida] = useState<{ queda: number | null; previa: PreviaUnificar | null; error: string | null } | null>(null);
  const [errorAlUnificar, setError] = useState<string | null>(null);
  const [haciendo, setHaciendo] = useState(false);

  useEffect(() => {
    let vivo = true;
    void previaDeUnificarAction(esta.id, otra.id, queda).then(
      (r) => { if (vivo) setLeida(r.ok ? { queda, previa: r.previa, error: null } : { queda, previa: null, error: r.error }); },
      () => { if (vivo) setLeida({ queda, previa: null, error: 'No pude armar la previa.' }); },
    );
    return () => { vivo = false; };
  }, [esta.id, otra.id, queda]);
  const previa: PreviaUnificar | null | 'cargando' = leida && leida.queda === queda ? leida.previa : 'cargando';
  const error = errorAlUnificar ?? (leida && leida.queda === queda ? leida.error : null);

  const confirmar = async () => {
    if (!previa || previa === 'cargando' || haciendo) return;
    setHaciendo(true);
    try {
      const r = await unificarFichasAction(previa.queda.id, previa.seVa.id, previa.version);
      if (!r.ok) { setError(r.error); setHaciendo(false); return; }
      refrescar();
      onUnificado(previa.queda.id);
      // Si se fue la ficha que estaba abierta, se abre la que queda.
      if (previa.seVa.id === esta.id && typeof window !== 'undefined') window.location.assign(`/crm/${previa.queda.id}`);
    } catch {
      setError('No se pudo unificar. No se cambió nada: vuelve a intentar.');
      setHaciendo(false);
    }
  };

  const t = previa && previa !== 'cargando' ? textoDeLaPrevia(previa) : null;
  return (
    <Modal titulo="Unificar las dos fichas" onCerrar={haciendo ? () => {} : onCerrar} ancho={620}>
      {previa === 'cargando' && <p className="fr-sub">Armando lo que queda de cada una…</p>}
      {error && <p className="fr-sub fr-aut-mal" role="alert">{error}<ReportarASoporte /></p>}
      {t && previa && previa !== 'cargando' && (
        <div className="fr-unif">
          <p className="fr-unif-tit">{t.titulo}</p>
          <p className="fr-sub">{t.bajada}</p>
          <button type="button" className="fr-link" disabled={haciendo} onClick={() => setQueda(previa.seVa.id)}>
            Quedarme con «{previa.seVa.nombre}»
          </button>
          {t.secciones.map((s) => (
            <section key={s.titulo} className="fr-unif-sec">
              <h4>{s.titulo}</h4>
              <ul>{s.lineas.map((l, i) => <li key={i} className={l.tono ? `fr-unif-${l.tono}` : undefined}>{l.texto}</li>)}</ul>
            </section>
          ))}
          <p className="fr-sub">{t.aviso}</p>
          <div className="fr-unif-acciones">
            <Button variant="tertiary" onClick={onCerrar} disabled={haciendo}>Cancelar</Button>
            <Button variant="danger" onClick={() => void confirmar()} loading={haciendo}>Unificar</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
