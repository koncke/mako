'use client';

// =============================================================================
// Comentario — un comentario del diagnóstico en la lista de la derecha
// =============================================================================
// Tanda 2, punto 7 (docs/diseno-editor-landing.md, T5): «que queden guardados todos los comentarios y
// sugerencias y claro, la opción de solucionarlo allí mismo con IA». Cada fila: la severidad, el título,
// la cita que señala, la sugerencia (y el porqué, plegado), y sus acciones.
//
// Tanda 6, decisión (c) de Martín (14/10/2026): «"Aplicar" de cada comentario del Diagnóstico = un clic,
// con la versión guardada antes y "Deshacer"; más "Aplicar todos" […] y "Preguntar a MaKo" (el chat de
// MaKo al costado con el comentario). En una landing externa, "Aplicar" lleva a replicar primero y los
// comentarios pasan a la copia.» Las acciones:
//   · «Aplicar»: UN clic, sin revisar antes (era «Solucionar con IA» + «Aceptar»: dos pasos). En una landing
//     nuestra hace falta saber de qué sección es; en una de afuera, replica primero (el panel decide).
//     Aplicado, queda «Deshacer» (si es lo último que se aplicó) y «Ver cambio»: el «Original | Modificado»
//     de antes, ahora para mirar DESPUÉS lo que cambió;
//   · «Preguntar a MaKo»: el chat de MaKo al costado, con este comentario (lo abre el panel);
//   · «Ver»: el recorrido desde este comentario (o sólo éste, si ya no está pendiente);
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

/** Lo que pasa con «Aplicar» de un comentario. */
export type EstadoArreglo =
  | { fase: 'en-cola' | 'aplicando' }
  | { fase: 'aplicado'; original: JsonNodo; nuevas: JsonNodo[] }
  | { fase: 'deshaciendo' }
  | { fase: 'error'; error: string };

const SEVERIDAD: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };

export function Comentario({
  s, activa, ubicacion, tema, formato, proporcion, arreglo, puedeAplicar, ocupado,
  onVer, onEstado, onAplicar, onPreguntar, onDeshacer, onVerCopia,
}: {
  s: Sugerencia;
  activa: boolean;
  /** null = no se encontró la cita; undefined = la vista todavía no lo sabe. */
  ubicacion: Ubicacion | undefined;
  /** El tema de una landing nuestra (las miniaturas de «Ver cambio»); null en una de afuera. */
  tema: Tema | null;
  formato: FormatoDoc;
  proporcion: Proporcion;
  arreglo: EstadoArreglo | undefined;
  /** Hay «Aplicar» (pendiente y, en una nuestra, con su sección). Lo decide el panel. */
  puedeAplicar: boolean;
  /** Otra aplicación está corriendo («Aplicar todos», una réplica): los botones que escriben esperan. */
  ocupado: boolean;
  onVer: () => void;
  onEstado: (estado: Sugerencia['estado']) => void;
  onAplicar: () => void;
  onPreguntar: () => void;
  /** Sólo si es lo último que se aplicó (la pila de Deshacer, lib/editor-landing/diagnostico.ts). */
  onDeshacer?: () => void;
  /**
   * Un comentario RESUELTO de una página de afuera que tiene copia (tanda 7): «Aplicar» lo resolvió acá y
   * lo aplicó en la copia, así que la fila lleva a ESA copia (su Diagnóstico). Lo decide el panel.
   */
  onVerCopia?: () => void;
}) {
  const [verCambio, setVerCambio] = useState(false);
  const [vista, setVista] = useState<'original' | 'modificado'>('modificado');
  const h = s.hallazgo;
  const pendiente = s.estado === 'pendiente';
  const trabajando = arreglo?.fase === 'en-cola' || arreglo?.fase === 'aplicando' || arreglo?.fase === 'deshaciendo';
  const aplicado = arreglo?.fase === 'aplicado' ? arreglo : null;
  const quieto = ocupado || trabajando;

  return (
    <li className="gdg-com" data-activa={activa ? 'si' : undefined} data-estado={aplicado ? 'aplicada' : s.estado}>
      <div className="gdg-com-cab">
        <span className="gdg-sev" data-sev={h.severidad}>{SEVERIDAD[h.severidad] ?? h.severidad}</span>
        {aplicado
          ? <span className="gdg-com-estado gdg-com-estado--ok"><Ico n="check" t={12} /> Aplicada</span>
          : s.estado !== 'pendiente' && <span className="gdg-com-estado">{s.estado === 'resuelta' ? 'Resuelta' : 'Descartada'}</span>}
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

      {arreglo?.fase === 'en-cola' && (
        <p className="gdg-com-trabajando"><span className="gp-giro" aria-hidden /> En cola…</p>
      )}
      {arreglo?.fase === 'aplicando' && (
        <p className="gdg-com-trabajando"><span className="gp-giro" aria-hidden /> Aplicando… hasta 1 minuto.</p>
      )}
      {arreglo?.fase === 'deshaciendo' && (
        <p className="gdg-com-trabajando"><span className="gp-giro" aria-hidden /> Deshaciendo…</p>
      )}
      {arreglo?.fase === 'error' && <p className="gdg-com-error" role="alert">{arreglo.error}</p>}

      {aplicado ? (
        <>
          <div className="gdg-com-acciones">
            {onDeshacer && (
              <button type="button" className="gp-btn gp-btn-contorno" disabled={quieto} onClick={onDeshacer}><Ico n="deshacer" t={14} /> Deshacer</button>
            )}
            {tema && (
              <button type="button" className="gp-btn gp-btn-fantasma" aria-expanded={verCambio} onClick={() => setVerCambio((v) => !v)}>
                <Ico n={verCambio ? 'chevron-arriba' : 'chevron-abajo'} t={14} /> Ver cambio
              </button>
            )}
            <button type="button" className="gp-btn gp-btn-fantasma" onClick={onPreguntar}><Ico n="chat" t={14} /> Preguntar a MaKo</button>
          </div>
          {verCambio && tema && (
            <div className="gdg-com-revision">
              <div className="gdg-segmento" role="group" aria-label="Comparar">
                <button type="button" aria-pressed={vista === 'original'} onClick={() => setVista('original')}>Original</button>
                <button type="button" aria-pressed={vista === 'modificado'} onClick={() => setVista('modificado')}>Modificado</button>
              </div>
              {(vista === 'original' ? [aplicado.original] : aplicado.nuevas).map((t, k) => (
                <div key={k} className="gdg-com-mini">
                  <MiniaturaLanding tarjeta={t} tema={tema} formato={formato} proporcion={proporcion} entera />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="gdg-com-acciones">
          {pendiente && puedeAplicar && (
            <button type="button" className="gp-btn gp-btn-ia" disabled={quieto} onClick={onAplicar}>
              <Ico n="destellos" t={14} /> Aplicar
            </button>
          )}
          {onVerCopia && (
            <button type="button" className="gp-btn gp-btn-contorno" onClick={onVerCopia}><Ico n="flecha-externa" t={14} /> Ver en tu copia</button>
          )}
          <button type="button" className="gp-btn gp-btn-contorno" onClick={onPreguntar}><Ico n="chat" t={14} /> Preguntar a MaKo</button>
          <button type="button" className="gp-btn gp-btn-fantasma" onClick={onVer}><Ico n="ojo" t={14} /> Ver</button>
          {pendiente ? (
            <>
              <button type="button" className="gp-btn gp-btn-fantasma" disabled={quieto} onClick={() => onEstado('resuelta')}><Ico n="check" t={14} /> Resuelta</button>
              <button type="button" className="gp-btn gp-btn-fantasma" disabled={quieto} onClick={() => onEstado('descartada')}><Ico n="x-circulo" t={14} /> Descartar</button>
            </>
          ) : (
            <button type="button" className="gp-btn gp-btn-fantasma" disabled={quieto} onClick={() => onEstado('pendiente')}><Ico n="deshacer" t={14} /> Reabrir</button>
          )}
        </div>
      )}
    </li>
  );
}
