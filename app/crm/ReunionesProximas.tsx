'use client';

// =============================================================================
// Las reuniones que vienen: un botón con calendario en la barra, y un pop-up
// =============================================================================
// Pedido de Martín (12/10/2026, segundo feedback del CRM, punto 1): «Elimina la sección
// grande que aparece arriba cuando hay una llamada cercana. En su lugar, luego del botón de
// filtro, haz que aparezca un nuevo botón con ícono de calendario que esté tintineando, y
// que se abra un modal para ver lo que hoy en día aparece en ese contenedor grande de
// arriba».
//
// Era la sección «Tus reuniones» de CrmBoard: una caja del ancho de la pantalla, ARRIBA de
// la barra, que empujaba el tablero entero hacia abajo cada vez que había una reunión
// cercana. Ahora es un control más de la fila, y lo que mostraba vive en el pop-up, tal cual
// (la etapa y el día, el aviso de «agendó sin ver el VSL», quién, qué quiere y el teléfono).
//
// ⚠️ SÓLO SE DIBUJA CUANDO HAY ALGO. Igual que la sección: «que aparezca» cuando hay una
// llamada cercana. Un botón de calendario sin nada adentro sería un control que abre un
// vacío. El latido no es un adorno: es lo que dice «tenés una reunión cerca» sin ocupar lugar.
// Late en el BORDE y la sombra, nunca en la opacidad (la regla de `.mk-tab-alarma`, en
// globals.css: animar la opacidad baja el contraste del ícono a la mitad del pulso), y con
// movimiento reducido queda fijo con el halo puesto.

import { useCallback, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import type { CrmJunta } from './CrmBoard';

const MONO = "'JetBrains Mono', ui-monospace, monospace";

function CalendarioIcono() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M16 2.5v4M8 2.5v4M3 10h18" />
    </svg>
  );
}

export function BotonReuniones({ juntas, onAbrir }: { juntas: CrmJunta[]; onAbrir: (leadId: number) => void }) {
  const [abierto, setAbierto] = useState(false);
  // `onCerrar` de identidad FIJA: el Modal de la casa re-ejecuta su efecto de foco con cada
  // identidad nueva (AGENTS.md → «Todo <Modal> recibe un onCerrar de identidad FIJA»).
  const cerrar = useCallback(() => setAbierto(false), []);
  if (juntas.length === 0) return null;
  const n = juntas.length;
  return (
    <>
      <style>{`
        @keyframes crmReunionLatido {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 50%, transparent); border-color: var(--primary); }
          50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--primary) 0%, transparent); border-color: var(--primary-weak); }
        }
        .crm-reunion-latido { animation: crmReunionLatido 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .crm-reunion-latido { animation: none; box-shadow: 0 0 0 2px var(--primary-bg); }
        }
      `}</style>
      <button
        type="button"
        className="crm-reunion-latido"
        onClick={() => setAbierto(true)}
        title={n === 1 ? 'Tienes una reunión cerca' : `Tienes ${n} reuniones cerca`}
        aria-label={n === 1 ? 'Ver la reunión que viene' : `Ver las ${n} reuniones que vienen`}
        style={{
          flex: 'none', height: 40, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 7,
          borderRadius: 10, border: '1px solid var(--primary)', background: 'var(--primary-bg)', color: 'var(--primary)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <CalendarioIcono />
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>{n}</span>
      </button>
      {abierto && (
        <Modal titulo="Tus reuniones" ancho={720} onCerrar={cerrar}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(288px, 1fr))', gap: 10 }}>
            {juntas.map((j) => (
              <div key={j.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, background: 'var(--ink)', color: 'var(--on-ink)' }}>{j.when}</span>
                  {j.warn && <span style={{ fontSize: 11, color: 'var(--bad)', background: 'var(--bad-bg)', padding: '3px 7px', borderRadius: 6 }}>⚠ {j.warnText}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.name}</span>
                  <button
                    type="button"
                    onClick={() => { setAbierto(false); onAbrir(j.leadId); }}
                    style={{ flex: 'none', background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', fontFamily: 'inherit' }}
                  >Abrir →</button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--dim)' }}>Quiere: {j.goal}</div>
                <div style={{ fontSize: 11.5, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>☎ {j.phone}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
