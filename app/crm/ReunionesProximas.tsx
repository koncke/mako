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
// ⚠️ EL MISMO POP-UP PARA TODOS, CON EL BLOQUE AZUL (22/10/2026). Martín: «En SuperAdmin el botón de "Tienes 2 reuniones
// cerca" aparece el bloque azul, pero en los demás como Mauricio aún aparece el pop-up antiguo... Quiero siempre unificar
// las cosas en todos lados... me gustaría que salga un pop-up sí, pero con el bloque azul. Y me falta un botón para poder
// ver el detalle». No era el rol: desde el 18/10 el botón desplegaba «Próximo» (el bloque azul, arriba del tablero) si
// había una reunión POR DELANTE, y abría la lista vieja si todas ya habían pasado. Cada uno veía lo que le tocaba según su
// agenda. Ahora el botón SIEMPRE abre el pop-up, y adentro va el bloque azul de cada reunión (lo arma el tablero, que tiene
// los leads: `contenido`), con «Ver detalle», que abre la ficha en «Reuniones».
//
// ⚠️ SÓLO SE DIBUJA CUANDO HAY ALGO. Igual que la sección: «que aparezca» cuando hay una
// llamada cercana. Un botón de calendario sin nada adentro sería un control que abre un
// vacío. El latido no es un adorno: es lo que dice «tenés una reunión cerca» sin ocupar lugar.
// Late en el BORDE y la sombra, nunca en la opacidad (la regla de `.mk-tab-alarma`, en
// globals.css: animar la opacidad baja el contraste del ícono a la mitad del pulso), y con
// movimiento reducido queda fijo con el halo puesto.

import { useCallback, useState, type ReactNode } from 'react';
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

export function BotonReuniones({ juntas, contenido }: {
  juntas: CrmJunta[];
  /** Lo que muestra el pop-up: el bloque azul de cada reunión. Lo arma el tablero; `cerrar` cierra el pop-up antes de
   *  abrir la ficha («Ver detalle»). */
  contenido: (cerrar: () => void) => ReactNode;
}) {
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
        <Modal titulo="Tus reuniones" ancho={960} onCerrar={cerrar}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{contenido(cerrar)}</div>
        </Modal>
      )}
    </>
  );
}
