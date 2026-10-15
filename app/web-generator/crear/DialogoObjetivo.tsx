'use client';

// =============================================================================
// web-generator/crear/DialogoObjetivo — «¿De qué quieres crearla?»
// =============================================================================
// Feedback de Martín (12/10/2026), textual: «En el panel principal, se tienen que ver plantillas del
// diseño, y al darle a una, puede salir un pop-up o algo así que te pregunte de que quieres crearla, y
// ahí las opciones de "Agendar llamada, webinar, lead magnet, y todas las opciones que pusiste"».
// El diseño ya está elegido; acá se elige el OBJETIVO (el copy). Lo montan los dos lugares que
// muestran diseños: la caja de crear (CajaCrear) y la galería del Panel (Inicio).
// =============================================================================

import { useEffect, useState } from 'react';
import { OBJETIVOS_LANDING } from '@/lib/editor-landing/disenos-landing';
import { DialogoGamma, Ico } from '../MiniaturaLanding';

/**
 * `ocupado` lo pone quien crea; el renglón tocado lleva el giro mientras dura. Si el alta falla
 * (`ocupado` vuelve a false), el giro se va y se puede elegir de nuevo. `onCerrar` va con identidad
 * fija (DialogoGamma lo pide).
 */
export function DialogoObjetivo({ ocupado, onElegir, onCerrar }: {
  ocupado: boolean;
  onElegir: (objetivo: string) => void;
  onCerrar: () => void;
}) {
  const [elegido, setElegido] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!ocupado) setElegido(null); }, [ocupado]);
  return (
    <DialogoGamma titulo="¿De qué quieres crearla?" ancho={560} onCerrar={onCerrar} cerrable={!ocupado}>
      <ul className="gp-borradores">
        {OBJETIVOS_LANDING.map((o, i) => (
          <li key={o.id}>
            <button
              type="button"
              className="gp-borrador gp-objetivo"
              disabled={ocupado}
              data-foco={i === 0 ? '' : undefined}
              onClick={() => { setElegido(o.id); onElegir(o.id); }}
            >
              <Ico n={o.icono} t={18} />
              <span className="gp-borrador-textos">
                <span className="gp-borrador-titulo">{o.nombre}</span>
                <span className="gp-borrador-sub">{o.descripcion}</span>
              </span>
              {ocupado && elegido === o.id ? <span className="gp-giro" /> : <Ico n="chevron-derecha" t={14} />}
            </button>
          </li>
        ))}
      </ul>
    </DialogoGamma>
  );
}
