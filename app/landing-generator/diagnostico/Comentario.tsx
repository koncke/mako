'use client';

// =============================================================================
// Comentario — un comentario del diagnóstico en la lista de la derecha
// =============================================================================
// Tanda 2, punto 7 (docs/diseno-editor-landing.md, T5): «que queden guardados todos los comentarios y
// sugerencias y claro, la opción de solucionarlo allí mismo con IA». Cada fila: la severidad, el título,
// la cita que señala, la sugerencia (y el porqué, plegado), y sus acciones:
//   · «Ver»: el recorrido desde este comentario (o sólo éste, si ya no está pendiente);
//   · «Solucionar con IA» (sólo en una landing nuestra y si se sabe de qué sección es): la propuesta se
//     revisa ACÁ con «Original | Modificado» (como el agente del editor, Gamma 5) y «Aceptar» la guarda;
//   · «Resuelta» / «Descartar», y «Reabrir» las que ya no están pendientes. Nunca se borra.
// El trabajo (los pedidos) lo hace el panel; esto sólo dibuja y avisa.
// =============================================================================

import { useState } from 'react';
import type { JsonNodo } from '@/lib/editor-landing/doc';
import type { Tema } from '@/lib/editor-landing/temas';
import type { FormatoDoc, Proporcion } from '@/lib/editor-landing/api-tipos';
import type { Sugerencia } from '@/lib/editor-landing/diagnostico';
import { Ico, MiniaturaLanding } from '../MiniaturaLanding';
import type { Ubicacion } from './vista';

/** Lo que pasa con «Solucionar con IA» de un comentario. */
export type EstadoArreglo =
  | { fase: 'pidiendo' }
  | { fase: 'revision' | 'aplicando'; original: JsonNodo; propuestas: JsonNodo[] }
  | { fase: 'error'; error: string };

const SEVERIDAD: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };

export function Comentario({
  s, activa, ubicacion, deNuestra, tema, formato, proporcion, arreglo,
  onVer, onEstado, onSolucionar, onAceptar, onDescartarPropuesta,
}: {
  s: Sugerencia;
  activa: boolean;
  /** null = no se encontró la cita; undefined = la vista todavía no lo sabe. */
  ubicacion: Ubicacion | undefined;
  /** Una landing nuestra (hay «Solucionar con IA» y miniaturas). */
  deNuestra: boolean;
  tema: Tema | null;
  formato: FormatoDoc;
  proporcion: Proporcion;
  arreglo: EstadoArreglo | undefined;
  onVer: () => void;
  onEstado: (estado: Sugerencia['estado']) => void;
  onSolucionar: () => void;
  onAceptar: () => void;
  onDescartarPropuesta: () => void;
}) {
  const [vista, setVista] = useState<'original' | 'modificado'>('modificado');
  const h = s.hallazgo;
  const pendiente = s.estado === 'pendiente';
  const ocupado = arreglo?.fase === 'pidiendo' || arreglo?.fase === 'aplicando';
  const puedeIA = deNuestra && pendiente && !!s.seccionId;

  return (
    <li className="gdg-com" data-activa={activa ? 'si' : undefined} data-estado={s.estado}>
      <div className="gdg-com-cab">
        <span className="gdg-sev" data-sev={h.severidad}>{SEVERIDAD[h.severidad] ?? h.severidad}</span>
        {s.estado !== 'pendiente' && <span className="gdg-com-estado">{s.estado === 'resuelta' ? 'Resuelta' : 'Descartada'}</span>}
        {ubicacion === null && <span className="gdg-com-sin" title="No encontré esta cita en la página">Sin ubicar</span>}
      </div>
      <button type="button" className="gdg-com-tit" onClick={onVer} title="Ver en la página">{h.titulo}</button>
      <blockquote className="gdg-com-cita">«{s.cita}»</blockquote>
      {h.arreglo && <p className="gdg-com-arreglo">{h.arreglo}</p>}
      {h.por_que && (
        <details className="gdg-com-porque">
          <summary>Por qué</summary>
          <p>{h.por_que}</p>
        </details>
      )}

      {arreglo?.fase === 'pidiendo' && (
        <p className="gdg-com-trabajando"><span className="gp-giro" aria-hidden /> Revisando… hasta 1 minuto.</p>
      )}
      {arreglo?.fase === 'error' && <p className="gdg-com-error" role="alert">{arreglo.error}</p>}
      {(arreglo?.fase === 'revision' || arreglo?.fase === 'aplicando') && (
        <div className="gdg-com-revision">
          <div className="gdg-segmento" role="group" aria-label="Comparar">
            <button type="button" aria-pressed={vista === 'original'} onClick={() => setVista('original')}>Original</button>
            <button type="button" aria-pressed={vista === 'modificado'} onClick={() => setVista('modificado')}>Modificado</button>
          </div>
          {tema && (vista === 'original' ? [arreglo.original] : arreglo.propuestas).map((t, k) => (
            <div key={k} className="gdg-com-mini">
              <MiniaturaLanding tarjeta={t} tema={tema} formato={formato} proporcion={proporcion} entera />
            </div>
          ))}
          <div className="gdg-com-acciones">
            {arreglo.fase === 'aplicando'
              ? <span className="gdg-com-trabajando"><span className="gp-giro" aria-hidden /> Aplicando el cambio…</span>
              : (
                <>
                  <button type="button" className="gp-btn gp-btn-fantasma" onClick={onDescartarPropuesta}>Descartar</button>
                  <button type="button" className="gp-btn gp-btn-primario" onClick={onAceptar}>Aceptar</button>
                </>
              )}
          </div>
        </div>
      )}

      {!(arreglo?.fase === 'revision' || arreglo?.fase === 'aplicando') && (
        <div className="gdg-com-acciones">
          {puedeIA && (
            <button type="button" className="gp-btn gp-btn-ia" disabled={ocupado} onClick={onSolucionar}>
              <Ico n="destellos" t={14} /> Solucionar con IA
            </button>
          )}
          <button type="button" className="gp-btn gp-btn-contorno" onClick={onVer}><Ico n="ojo" t={14} /> Ver</button>
          {pendiente ? (
            <>
              <button type="button" className="gp-btn gp-btn-fantasma" disabled={ocupado} onClick={() => onEstado('resuelta')}><Ico n="check" t={14} /> Resuelta</button>
              <button type="button" className="gp-btn gp-btn-fantasma" disabled={ocupado} onClick={() => onEstado('descartada')}><Ico n="x-circulo" t={14} /> Descartar</button>
            </>
          ) : (
            <button type="button" className="gp-btn gp-btn-fantasma" onClick={() => onEstado('pendiente')}><Ico n="deshacer" t={14} /> Reabrir</button>
          )}
        </div>
      )}
    </li>
  );
}
