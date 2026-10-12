'use client';

// =============================================================================
// PiezasRail — «Tu oferta»: las 13 piezas y lo que MaKo sabe de cada una
// =============================================================================
// Es el progreso de la conversación sin escribir una palabra de más: cada pieza
// del marco (lib/offer-marco.ts → PIEZAS) con su estado, el conteo arriba y, cuando
// están las mínimas, el botón que arma la oferta.
//
// Dos formas del mismo bloque: un riel a la derecha en escritorio y, en pantalla
// chica, una barra compacta («8/13») que se despliega. Las dos dibujan la MISMA
// lista (`ListaPiezas`) para que no haya dos lecturas de qué está hecho.
//
// ⚠️ El estado «del negocio» (borde dorado) es lo que MaKo YA sabía antes de
// preguntar (el Archivero, la oferta guardada). No es lo mismo que confirmado: por
// eso no lleva el check verde hasta que el dueño lo dice en el chat o en un archivo.

import { useId, useState } from 'react';
import { Button } from '@/app/_ui';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { Icon } from '@/app/_components/icons';
import { MakoStar } from '@/app/_components/MakoBrand';
import { PIEZAS, type PiezasSabidas } from '@/lib/offer-marco';
import { contarSabidas, estadoDePieza, tituloDePieza, type EstadoPieza } from './ayudas';

export type AccionesPiezas = {
  puedeConcluir: boolean;
  hayConclusion: boolean;
  /** Mientras MaKo contesta o se lee un archivo: armar ahora dejaría afuera lo último. */
  ocupado: boolean;
  onArmar: () => void;
  onVer: () => void;
};

const ESTADO_TEXTO: Record<EstadoPieza, string> = { vacia: 'falta', negocio: 'del negocio', confirmada: 'confirmada' };

function Marca({ estado }: { estado: EstadoPieza }) {
  if (estado === 'confirmada') {
    return (
      <span aria-hidden style={{ flex: 'none', width: 20, height: 20, borderRadius: 999, background: 'var(--good-bg)', border: '1.5px solid var(--good)', color: 'var(--good)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconoMenu nombre="check" size={12} />
      </span>
    );
  }
  return (
    <span aria-hidden style={{
      flex: 'none', width: 20, height: 20, borderRadius: 999, boxSizing: 'border-box',
      border: `2px solid ${estado === 'negocio' ? 'var(--mako)' : 'var(--border-strong)'}`,
      background: estado === 'negocio' ? 'var(--mako-bg)' : 'transparent',
    }} />
  );
}

export function ListaPiezas({ piezas }: { piezas: PiezasSabidas }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {PIEZAS.map((p) => {
        const e = estadoDePieza(piezas, p.key);
        return (
          <li key={p.key} title={tituloDePieza(piezas, p.key)} aria-label={`${p.label}: ${ESTADO_TEXTO[e]}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '7px 2px',
              fontSize: 'var(--fs-md)', lineHeight: 1.3,
              color: e === 'vacia' ? 'var(--faint)' : 'var(--ink)', fontWeight: e === 'vacia' ? 500 : 600,
            }}>
            <Marca estado={e} />
            <span>{p.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** El conteo «8/13», con el total del marco (no un 13 escrito a mano). */
function Conteo({ piezas, grande = false }: { piezas: PiezasSabidas; grande?: boolean }) {
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: grande ? 'var(--fs-card)' : 'var(--fs-md)', color: 'var(--ink)' }}>
      {contarSabidas(piezas)}<span style={{ color: 'var(--faint)', fontWeight: 600 }}>/{PIEZAS.length}</span>
    </span>
  );
}

function Acciones({ puedeConcluir, hayConclusion, ocupado, onArmar, onVer }: AccionesPiezas) {
  if (!puedeConcluir && !hayConclusion) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {puedeConcluir && (
        <Button variant="mako" size="lg" full disabled={ocupado} onClick={onArmar} icon={<MakoStar size={16} color="currentColor" />}>
          Armar mi oferta
        </Button>
      )}
      {hayConclusion && <Button variant="secondary" full onClick={onVer}>Ver mi oferta</Button>}
    </div>
  );
}

/** El riel de escritorio. Se esconde solo en pantalla chica (estilos.ts → .of-riel). */
export function RielPiezas({ piezas, acciones }: { piezas: PiezasSabidas; acciones: AccionesPiezas }) {
  return (
    <aside className="of-riel" aria-label="Tu oferta" style={{ flex: 'none', width: 264, flexDirection: 'column', minHeight: 0 }}>
      {/* La tarjeta ESTIRA hasta el alto del chat (flex 1 1 auto: Martín, 11/10/2026, «la columna de
          "Tu oferta" debe ser del mismo alto que el chat») y scrollea adentro si no entra (minHeight
          0). Con flex y no con un alto en porcentaje: contra un padre que estira con flex, un
          porcentaje da cero en Safari (AGENTS.md, «Dos reglas de layout»). */}
      <div style={{
        flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 18px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 'var(--fs-card)', fontWeight: 700, color: 'var(--ink)' }}>Tu oferta</span>
          <Conteo piezas={piezas} grande />
        </div>
        <ListaPiezas piezas={piezas} />
        <Acciones {...acciones} />
      </div>
    </aside>
  );
}

/** La barra compacta del celular: el conteo, y la lista al tocarla. */
export function BarraPiezasMovil({ piezas, acciones }: { piezas: PiezasSabidas; acciones: AccionesPiezas }) {
  const [abierta, setAbierta] = useState(false);
  const id = useId();
  return (
    <div className="of-barra-movil" style={{ flex: 'none', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
      <button type="button" className="of-pill" aria-expanded={abierta} aria-controls={id} onClick={() => setAbierta((v) => !v)}
        style={{ width: '100%', justifyContent: 'space-between', borderRadius: 14 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span>Tu oferta</span>
          <Conteo piezas={piezas} />
        </span>
        <span aria-hidden style={{ display: 'flex', color: 'var(--faint)', transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform .16s ease' }}>
          <Icon name="chevron" size={18} />
        </span>
      </button>
      {abierta && (
        <div id={id} style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 16px 16px', maxHeight: '45dvh', overflowY: 'auto' }}>
          <ListaPiezas piezas={piezas} />
          <Acciones {...acciones} />
        </div>
      )}
    </div>
  );
}
