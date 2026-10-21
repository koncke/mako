'use client';

// =============================================================================
// CamposTarjetaModal — «Personalizar tarjetas»: el diseño, los datos y su orden, con la tarjeta en vivo
// =============================================================================
// Martín, 13/10/2026: «Tener varios diseños template, como el que tenemos en Clientes, y otros. Y poder elegir qué datos
// se colocan en la tarjeta… que siempre los personalizables muestren en tiempo real cómo quedaría y que se pueda
// arrastrar campos, acomodarlos, que sea interactivo». Y el 20/10: «por si el usuario quiere más o menos info».
//   · ARRIBA, LA TARJETA EN VIVO: la de un lead del tablero, armada por la MISMA función que el tablero
//     (`propsDeTarjeta` en CrmBoard, que llega como `vistaPrevia`): no puede mostrar algo que el tablero no dibuja.
//   · EL DISEÑO: Completa, Compacta o Con avance (lib/tarjeta-kanban.ts → DISENOS_TARJETA).
//   · LOS DATOS QUE VAN, EN SU ORDEN: se arrastran por el asa (y con ↑ ↓, para el teclado); la casilla los saca.
//     Abajo, los que no van, para sumarlos al final.
// Cada cambio se ve en el acto (también en el tablero de atrás) y se guarda para quien mira: por persona, no por
// funnel (el porqué en lib/tarjeta-kanban.ts → CAMPOS_TARJETA_LEAD). Sin fila propia, se dice: vale en esta pestaña.
// =============================================================================

import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import { Modal } from '@/app/_ui';
import {
  CAMPOS_TARJETA_DEFAULT, CAMPOS_TARJETA_LEAD, DETALLE_DISENO_TARJETA, DISENOS_TARJETA, NOMBRE_CAMPO_TARJETA, NOMBRE_DISENO_TARJETA,
  moverCampo, type CampoTarjetaLead, type DisenoTarjeta,
} from '@/lib/tarjeta-kanban';
import { guardarCamposTarjetaAction } from './tarjeta-campos-actions';

export function CamposTarjetaModal({ campos, diseno, guardable, onCambio, onCerrar, vistaPrevia }: {
  campos: readonly CampoTarjetaLead[];
  diseno: DisenoTarjeta;
  guardable: boolean;
  /** El tablero de atrás cambia en el acto (y vuelve atrás si no se pudo guardar). */
  onCambio: (campos: CampoTarjetaLead[], diseno: DisenoTarjeta) => void;
  onCerrar: () => void;
  /** La tarjeta de un lead del tablero con lo que se está eligiendo; null = el tablero está vacío. */
  vistaPrevia: ((campos: readonly CampoTarjetaLead[], diseno: DisenoTarjeta) => ReactNode) | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [arrastrado, setArrastrado] = useState<number | null>(null);
  const cerrar = useCallback(() => onCerrar(), [onCerrar]);

  const guardar = async (cs: CampoTarjetaLead[], d: DisenoTarjeta) => {
    const antes = { cs: [...campos], d: diseno };
    onCambio(cs, d);
    setError(null);
    if (!guardable) return;
    setGuardando(true);
    const r = await guardarCamposTarjetaAction(cs, d).catch(() => ({ ok: false as const, error: 'Sin conexión.' }));
    setGuardando(false);
    if (!r.ok) { onCambio(antes.cs, antes.d); setError(r.error); }
  };
  const quitar = (c: CampoTarjetaLead) => void guardar(campos.filter((x) => x !== c), diseno);
  const sumar = (c: CampoTarjetaLead) => void guardar([...campos, c], diseno);
  const mover = (de: number, a: number) => void guardar(moverCampo(campos, de, a), diseno);
  const fuera = CAMPOS_TARJETA_LEAD.filter((c) => !campos.includes(c));

  const boton: CSSProperties = { border: 'none', background: 'none', padding: '0 4px', color: 'var(--dim)', cursor: 'pointer', fontSize: 14, lineHeight: 1 };

  return (
    <Modal titulo="Personalizar tarjetas" ancho={460} onCerrar={cerrar}>
      {/* La tarjeta en vivo. */}
      <div aria-label="Así queda la tarjeta" style={{ background: 'var(--fondo-columna)', borderRadius: 20, padding: 10, marginBottom: 14 }}>
        {vistaPrevia ? vistaPrevia(campos, diseno) : <p style={{ margin: 6, fontSize: 13, color: 'var(--dim)' }}>Carga un lead para ver cómo queda.</p>}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Diseño</div>
      <div role="radiogroup" aria-label="Diseño de la tarjeta" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {DISENOS_TARJETA.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={diseno === d} disabled={guardando}
            onClick={() => { if (d !== diseno) void guardar([...campos], d); }}
            style={{ textAlign: 'left', padding: '9px 10px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              border: `1.5px solid ${diseno === d ? 'var(--primary)' : 'var(--border)'}`, background: diseno === d ? 'var(--primary-bg)' : 'var(--surface)' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{NOMBRE_DISENO_TARJETA[d]}</div>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{DETALLE_DISENO_TARJETA[d]}</div>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Datos, en su orden</div>
      <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--dim)' }}>Arrástralos para acomodarlos. El nombre va siempre.</p>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Los datos que muestra la tarjeta">
        {campos.map((c, i) => (
          <li key={c} draggable={!guardando}
            data-campo-tarjeta={c}
            onDragStart={(e) => { setArrastrado(i); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { if (arrastrado != null) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); if (arrastrado != null) mover(arrastrado, i); setArrastrado(null); }}
            onDragEnd={() => setArrastrado(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px', borderRadius: 10, marginBottom: 2,
              background: arrastrado === i ? 'var(--surface-2)' : 'transparent', cursor: guardando ? 'default' : 'grab' }}>
            <span aria-hidden style={{ color: 'var(--faint)', fontSize: 14, width: 14, textAlign: 'center', userSelect: 'none' }}>⋮⋮</span>
            <input type="checkbox" checked onChange={() => quitar(c)} disabled={guardando} aria-label={`Sacar ${NOMBRE_CAMPO_TARJETA[c]}`}
              style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer', flex: 'none' }} />
            <span style={{ flex: 1, fontSize: 14, color: 'var(--ink)' }}>{NOMBRE_CAMPO_TARJETA[c]}</span>
            <button type="button" style={boton} disabled={guardando || i === 0} onClick={() => mover(i, i - 1)} aria-label={`Subir ${NOMBRE_CAMPO_TARJETA[c]}`}>↑</button>
            <button type="button" style={boton} disabled={guardando || i === campos.length - 1} onClick={() => mover(i, i + 1)} aria-label={`Bajar ${NOMBRE_CAMPO_TARJETA[c]}`}>↓</button>
          </li>
        ))}
      </ol>
      {fuera.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '12px 0 4px' }}>Más info</div>
          {fuera.map((c) => (
            <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 28px', cursor: 'pointer', fontSize: 14, color: 'var(--ink)' }}>
              <input type="checkbox" checked={false} onChange={() => sumar(c)} disabled={guardando}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer', flex: 'none' }} />
              {NOMBRE_CAMPO_TARJETA[c]}
            </label>
          ))}
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <button type="button" disabled={guardando}
          onClick={() => void guardar([...CAMPOS_TARJETA_DEFAULT], 'completa')}
          style={{ border: 'none', background: 'none', padding: 0, color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Volver a lo de siempre
        </button>
        <span style={{ flex: 1 }} />
        {!guardable && <span style={{ fontSize: 12, color: 'var(--dim)' }}>Sin guardar: vale en esta pestaña.</span>}
      </div>
      {error && <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--bad)' }}>{error}</p>}
    </Modal>
  );
}
