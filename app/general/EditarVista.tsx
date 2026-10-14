'use client';

// =============================================================================
// EditarVista — «Personalizar»: el nombre de la vista, qué bloques ve y en qué orden
// =============================================================================
// Pedido de Martín (13/10/2026): «Que los usuarios puedan elegir que ver». Una lista de los bloques del catálogo
// (`BLOQUES_GENERAL`, lib/general-vistas-modelo.ts): los elegidos arriba, en su orden, con ↑ ↓ para moverlos; los
// otros abajo, para sumarlos. Un paso por pantalla: este modal hace UNA cosa, armar esta vista. El alcance (funnels y
// ofertas) vive en su propio botón de la barra, al lado del título, porque se cambia más seguido.
//
// ⚠️ NO GUARDA SOLO: «Guardar» devuelve la vista entera a quien monta (BarraVistas), que la guarda con versión. Y
//    «Borrar vista» no existe con una sola vista: sin vistas no hay pantalla.

import { useState, type CSSProperties } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { Checkbox } from '@/app/_ui/Toggle';
import { TextField } from '@/app/_ui/Field';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import {
  BLOQUES_GENERAL, MAX_NOMBRE_VISTA, alternarBloque, defDeBloque, moverBloque, nombreDeVista,
  type BloqueGeneral, type VistaGeneral,
} from '@/lib/general-vistas-modelo';

export function EditarVista({ vista, puedeBorrar, guardando, onCerrar, onGuardar, onBorrar }: {
  vista: VistaGeneral;
  /** false con una sola vista. */
  puedeBorrar: boolean;
  guardando: boolean;
  onCerrar: () => void;
  onGuardar: (v: VistaGeneral) => void;
  onBorrar: () => void;
}) {
  const [nombre, setNombre] = useState(vista.nombre);
  const [bloques, setBloques] = useState<BloqueGeneral[]>(vista.bloques);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const cerrar = useCerrarEstable(onCerrar, guardando);

  const otros = BLOQUES_GENERAL.filter((b) => !bloques.includes(b.id));
  const flecha = (activo: boolean): CSSProperties => ({
    width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--surface)', color: activo ? 'var(--ink)' : 'var(--faint)', cursor: activo ? 'pointer' : 'default', fontSize: 14,
  });

  return (
    <Modal titulo="Personalizar vista" ancho={620} onCerrar={cerrar}
      pie={
        <>
          {puedeBorrar && (
            confirmarBorrar ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginRight: 'auto' }}>
                <span style={{ fontSize: 13, color: 'var(--ink)' }}>Se borra «{vista.nombre}».</span>
                <Button variant="danger" size="sm" disabled={guardando} onClick={onBorrar}>Borrar vista</Button>
                <Button variant="tertiary" size="sm" disabled={guardando} onClick={() => setConfirmarBorrar(false)}>No borrar</Button>
              </span>
            ) : (
              <BotonBorrar title="Borrar esta vista" texto="Borrar vista" disabled={guardando} onClick={() => setConfirmarBorrar(true)} style={{ marginRight: 'auto' }} />
            )
          )}
          <Button variant="tertiary" disabled={guardando} onClick={cerrar}>Cancelar</Button>
          <Button variant="primary" loading={guardando}
            onClick={() => onGuardar({ ...vista, nombre: nombreDeVista(nombre), bloques })}>
            Guardar
          </Button>
        </>
      }>
      <div data-editar-vista="" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <TextField label="Nombre" value={nombre} maxLength={MAX_NOMBRE_VISTA} onChange={(e) => setNombre(e.target.value)} />

        <div>
          <div style={S.rotulo}>Lo que ves</div>
          {!bloques.length && <div style={S.vacio}>Todavía no elegiste ningún bloque.</div>}
          {bloques.map((id, i) => {
            const b = defDeBloque(id);
            return (
              <div key={id} data-bloque-elegido={id} style={{ ...S.fila, borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <Checkbox checked onChange={() => setBloques((bs) => alternarBloque(bs, id))} label={<span>{b.emoji} {b.nombre}</span>} />
                <span style={S.linea}>{b.linea}</span>
                <span style={{ display: 'inline-flex', gap: 6, flex: 'none' }}>
                  <button type="button" aria-label={`Subir ${b.nombre}`} disabled={i === 0} style={flecha(i > 0)}
                    onClick={() => setBloques((bs) => moverBloque(bs, id, -1))}>↑</button>
                  <button type="button" aria-label={`Bajar ${b.nombre}`} disabled={i === bloques.length - 1} style={flecha(i < bloques.length - 1)}
                    onClick={() => setBloques((bs) => moverBloque(bs, id, 1))}>↓</button>
                </span>
              </div>
            );
          })}
        </div>

        {otros.length > 0 && (
          <div>
            <div style={S.rotulo}>Para sumar</div>
            {otros.map((b, i) => (
              <div key={b.id} data-bloque-libre={b.id} style={{ ...S.fila, borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <Checkbox checked={false} onChange={() => setBloques((bs) => alternarBloque(bs, b.id))} label={<span>{b.emoji} {b.nombre}</span>} />
                <span style={S.linea}>{b.linea}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

const S: Record<string, CSSProperties> = {
  rotulo: { fontSize: 13, fontWeight: 600, color: 'var(--dim)', marginBottom: 6 },
  vacio: { fontSize: 13, color: 'var(--faint)', padding: '8px 0' },
  fila: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 0' },
  linea: { flex: '1 1 180px', minWidth: 0, fontSize: 13, color: 'var(--dim)' },
};
