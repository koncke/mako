'use client';

// =============================================================================
// EditarEtiqueta — renombrar, cambiarle el color o archivar UNA etiqueta, desde el desplegable
// =============================================================================
// Pedido de Martín (12/10/2026, segundo feedback del CRM, punto 8): «Para renombrarlas o editarlas
// para eso están las etiquetas dentro del detail de un lead, ahí en ese desplegable debe tener los
// 3 puntos de opciones en cada etiqueta para hacer esas acciones». Es la respuesta a «el CRUD de
// etiquetas (app/crm/EditorEtiquetas.tsx) quedó sin pantalla» desde que se fue su pestaña: lo que
// se edita de una etiqueta se edita donde se la elige.
//
// Lo de acá son las tres acciones de todos los días (nombre, color, archivar). El vínculo a una
// etapa y la etiqueta del WhatsApp siguen en EditorEtiquetas, sin montar.
//
// Las tres van por el MISMO POST que el CRUD (`/api/crm/etiquetas`, `editar` y `archivar`), que
// decide quién puede (sólo el admin del workspace: el server contesta 403 y la frase se muestra).
// Archivar pregunta SÓLO si algo la usa (`?uso=`, la misma consecuencia que dice MaKo antes del
// «sí»: `consecuenciaDeArchivar`). Después se avisa a todas las listas abiertas
// (`avisarCambioEtiquetas`): sin eso, el chip de la ficha seguiría con el nombre viejo.

import { useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { Confirm } from '@/app/_ui/Confirm';
import { COLORES_ETIQUETA, TOPE_NOMBRE_ETIQUETA, consecuenciaDeArchivar } from '@/lib/etiquetas-reglas';
import type { Etiqueta } from '@/lib/etiquetas';
import { useFocoInicial } from '@/app/customer-success/curso/dialogo-foco';

const SANS = "'Geist', sans-serif";
/** El campo del nombre, para enfocarlo cuando la caja YA se ve (`autoFocus` adentro de un Modal no llega). */
const ID_NOMBRE = 'editar-etiqueta-nombre';

type Uso = { disparadores: number | null; condiciones: number | null; acciones: number | null; leads: number | null };

async function post(cuerpo: Record<string, unknown>): Promise<string | null> {
  try {
    const r = await fetch('/api/crm/etiquetas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const j = await r.json() as { ok?: boolean; error?: string };
    return j.ok ? null : (j.error || 'No se pudo guardar.');
  } catch {
    return 'No se pudo guardar.';
  }
}

/**
 * `onCerrar` con identidad FIJA (lo pasa quien monta con un `useCallback`): el Modal de la casa
 * re-ejecuta su efecto de foco con cada identidad nueva y el campo perdería la letra.
 * `onCambio` corre después de guardar o archivar bien (quien monta avisa a las listas).
 */
export function EditarEtiqueta({ etiqueta, onCerrar, onCambio }: { etiqueta: Etiqueta; onCerrar: () => void; onCambio: () => void }) {
  const [nombre, setNombre] = useState(etiqueta.nombre);
  const [color, setColor] = useState(etiqueta.color);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [freno, setFreno] = useState<string | null>(null);
  useFocoInicial(ID_NOMBRE);

  const limpio = nombre.trim().replace(/\s+/g, ' ');
  const cambio = (limpio && limpio !== etiqueta.nombre) || color !== etiqueta.color;

  const guardar = async () => {
    if (!limpio) { setError('El nombre no puede quedar vacío.'); return; }
    if (!cambio || ocupado) { if (!cambio) onCerrar(); return; }
    setOcupado(true); setError(null);
    const e = await post({ action: 'editar', id: etiqueta.id, nombre: limpio, color });
    setOcupado(false);
    if (e) { setError(e); return; }
    onCambio();
    onCerrar();
  };

  const archivar = async () => {
    setOcupado(true); setError(null);
    const e = await post({ action: 'archivar', id: etiqueta.id });
    setOcupado(false);
    if (e) { setError(e); return; }
    onCambio();
    onCerrar();
  };

  const pedirArchivar = async () => {
    if (ocupado) return;
    // Se pregunta SÓLO si algo la usa: una pregunta que no advierte enseña a ignorar las que sí.
    let f: string | null = null;
    try {
      const r = await fetch(`/api/crm/etiquetas?uso=${etiqueta.id}`, { cache: 'no-store' });
      const j = await r.json() as { ok?: boolean; uso?: Uso };
      f = j.ok && j.uso ? consecuenciaDeArchivar(j.uso) : 'No pude ver quién la usa.';
    } catch { f = 'No pude ver quién la usa.'; }
    if (f) setFreno(f);
    else void archivar();
  };

  return (
    <>
      <Modal titulo="Editar etiqueta" ancho={420} onCerrar={onCerrar}
        pie={
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={() => void pedirArchivar()} disabled={ocupado}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--bad)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: ocupado ? 'default' : 'pointer' }}>
              Archivar
            </button>
            <span style={{ flex: 1 }} />
            <button type="button" className="mk-btn mk-btn--md mk-btn--primary" onClick={() => void guardar()} disabled={ocupado || !limpio}>
              {ocupado ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 12.5, marginBottom: 6, color: 'var(--dim)' }}>Nombre</span>
            <input id={ID_NOMBRE} value={nombre} maxLength={TOPE_NOMBRE_ETIQUETA} aria-label="Nombre de la etiqueta"
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void guardar(); } }}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none' }} />
          </label>
          <div role="group" aria-label="Color">
            <span style={{ display: 'block', fontSize: 12.5, marginBottom: 6, color: 'var(--dim)' }}>Color</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {COLORES_ETIQUETA.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={color === c}
                  style={{ width: 28, height: 28, borderRadius: 999, background: c, cursor: 'pointer', padding: 0,
                    border: color === c ? '2px solid var(--ink)' : '2px solid transparent', boxShadow: color === c ? '0 0 0 2px var(--surface) inset' : 'none' }} />
              ))}
            </div>
          </div>
          {error && <p role="alert" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--bad)' }}>{error}</p>}
        </div>
      </Modal>
      {freno && (
        <Confirm
          title={`¿Archivar «${etiqueta.nombre}»?`}
          message={freno}
          confirmLabel="Archivar"
          cancelLabel="No archivar"
          onCancel={() => setFreno(null)}
          onConfirm={() => { setFreno(null); void archivar(); }}
        />
      )}
    </>
  );
}
