'use client';

// =============================================================================
// EliminarModal — una pregunta, dos botones
// =============================================================================
// Era un wizard de dos a cuatro pasos que terminaba en «que el perro decida»: un POST a
// /api/mako-guardian que podía tardar medio minuto y que, si el veredicto era CONSERVAR,
// no dejaba ninguna salida — el pie de esa pantalla tenía un solo botón, «Ok, la dejo»,
// que cerraba el modal. Y `decidirEliminar` cae a 'conservar' cuando el JSON del modelo no
// parsea (lib/mako-guardian.ts:420). O sea que la tarea NO SE BORRABA, y así se reportó:
// «borrar no refresca la lista». La lista se refrescaba; el borrado no llegaba a ocurrir.
//
// ⚠️ ES LA MISMA REGLA QUE LA PRIORIDAD, EN OTRA PUERTA: la IA propone, la persona dispone
// (AGENTS.md). Borrar una tarea del tablero propio es una decisión, no una solicitud.
//
// Lo que SÍ se conserva, porque no era fricción sino ayuda:
//  · Las dos salidas que NUNCA borraban nada y hacían otra cosa mejor — «ya se hizo» la
//    marca completada (regla del dueño: cerrar no es borrar) y «cambió la prioridad» abre
//    el debate. Ahora son dos atajos a la vista, no dos pasos de un cuestionario.
//  · El motivo, que va al historial del proyecto (`board.remove`). Ahora es OPCIONAL: era
//    obligatorio y no se leía nunca antes de borrar.
//  · La consecuencia PEGADA al botón, no en un cartel arriba: borrar un proyecto se lleva
//    sus tareas y eso no se puede deshacer.
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type Tipo = 'tarea' | 'proyecto';

export function EliminarModal({ tipo, nombre, nTareas = 0, onBorrar, onCompletar, onDebate, onClose }: {
  tipo: Tipo;
  nombre: string;
  /** cuántas tareas se lleva puestas un proyecto */
  nTareas?: number;
  onBorrar: (motivo: string) => void;
  /** «ya se hizo»: marcarla completada en vez de borrarla */
  onCompletar?: () => void;
  /** «cambió la prioridad»: discutirla con el Perro en vez de borrarla */
  onDebate?: () => void;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const esProy = tipo === 'proyecto';
  const irreversible = esProy && nTareas > 0;
  const borrar = () => { onBorrar(motivo.trim().slice(0, 80) || 'sin motivo'); onClose(); };

  return (
    // ⚠️ POR ENCIMA DE LA PILA DE MODALES, NO ADENTRO DE ELLA. Estaba en 130, que es
    // exactamente `Z_BASE` de `app/_components/pila-modales.ts`: alcanzaba mientras esto se
    // abriera desde el PRIMER modal de la pila, y cada nivel suma 2. Con el detalle de una
    // tarea abierto (130) y el de su proyecto espiado encima (132), el tacho de una fila
    // pedía confirmación DETRÁS del modal que la abrió — sin cartel, sin fondo oscuro y sin
    // ninguna pista: se lee como un botón que no hace nada. El camino se abrió el 25/09 al
    // pasarle `onEliminarTask` al detalle del proyecto («falta el botón de basura en la
    // vista de tabla»), y ya existía desde antes por la tarea abierta DESDE un proyecto.
    // 3400 es el mismo razonamiento que `Z_CONFIRM` (app/_ui/Confirm.tsx: 3500, arriba de
    // los modales escritos a mano que eligen su z solos), un escalón abajo para que una
    // pregunta del sistema siga pudiendo taparla. No se suma a la pila a propósito:
    // preguntar «¿seguro?» escondiendo lo que estás por borrar sería absurdo.
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3400, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 470, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 22px 4px' }}>
          <div style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
            {esProy ? '¿Eliminar el proyecto?' : '¿Eliminar la tarea?'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 14 }}>
            «{nombre.slice(0, 90)}{nombre.length > 90 ? '…' : ''}»
          </div>

          {/* Las dos salidas que antes eran pasos del cuestionario y nunca borraban nada.
              Acá están a la vista y a un click, que es lo que valían. */}
          {!esProy && (onCompletar || onDebate) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
              {onCompletar && (
                <button type="button" onClick={() => { onClose(); onCompletar(); }} style={atajo}>
                  <span style={{ flex: 'none' }}>✓</span>
                  <span>Ya se hizo — <b>marcarla completada</b> en vez de borrarla</span>
                </button>
              )}
              {onDebate && (
                <button type="button" onClick={() => { onClose(); onDebate(); }} style={atajo}>
                  <span style={{ flex: 'none' }}>↓</span>
                  <span>Solo cambió la prioridad — <b>bajársela</b> en vez de borrarla</span>
                </button>
              )}
            </div>
          )}

          {/* El motivo se pide SÓLO para una tarea, porque es lo único que tiene dónde
              quedar: `board.remove` lo escribe en el historial de su proyecto. Borrando un
              proyecto se borra también su historial, así que preguntarlo sería pedir un
              dato para tirarlo. */}
          {!esProy && (
            <label style={{ display: 'block' }}>
              <span style={rotulo}>¿Por qué? <span style={{ textTransform: 'none', letterSpacing: 0, fontFamily: SANS }}>(opcional, queda en el historial del proyecto)</span></span>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') borrar(); }}
                placeholder="Ej: el cliente canceló ese servicio"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, outline: 'none', fontFamily: SANS }} />
            </label>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flexWrap: 'wrap' }}>
          {/* La consecuencia de lo irreversible va PEGADA al botón y en tinta normal: arriba
              y en gris no la lee nadie (regla de la casa). */}
          <span style={{ flex: 1, minWidth: 180, fontSize: 12.5, color: irreversible ? 'var(--bad)' : 'var(--faint)', lineHeight: 1.4 }}>
            {irreversible
              ? `Se borran también sus ${nTareas} tarea${nTareas === 1 ? '' : 's'}. No se puede deshacer.`
              : esProy ? 'El proyecto no tiene tareas: no se pierde nada más.' : 'Vas a poder deshacerlo por unos segundos.'}
          </span>
          <div style={{ display: 'flex', gap: 9, flex: 'none' }}>
            <button type="button" onClick={onClose} style={ghostBtn}>No eliminar</button>
            <button type="button" onClick={borrar} style={{ ...primaryBtn, background: 'var(--bad)' }}>
              {esProy ? (nTareas > 0 ? `Eliminar y sus ${nTareas}` : 'Eliminar el proyecto') : 'Eliminar la tarea'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const rotulo: CSSProperties = { display: 'block', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 };
const atajo: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
  padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, cursor: 'pointer', fontFamily: SANS,
};
const primaryBtn: CSSProperties = { padding: '10px 18px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
const ghostBtn: CSSProperties = { padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
