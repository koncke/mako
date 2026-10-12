'use client';

// =============================================================================
// PiezasRail — «Tu oferta»: las piezas del marco y lo que MaKo sabe de cada una
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
import { PIEZAS, type PiezaKey, type PiezasSabidas } from '@/lib/offer-marco';
import { contarSabidas, estadoDePieza, tituloDePieza, type EstadoPieza } from './ayudas';

export type AccionesPiezas = {
  puedeConcluir: boolean;
  hayConclusion: boolean;
  /** Lo que dice el botón de armar: «Armar mi oferta», o el de actualizar el PDF si ya hay una versión (ayudas.ts → etiquetaArmar). */
  etiquetaArmar: string;
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

/**
 * Las piezas agrupadas por tema, para que 20 renglones se lean de un vistazo (Martín, 12/10/2026: «más
 * legible, más fácil»). Es SÓLO cómo se dibujan: el orden y la lista salen de PIEZAS (lib/offer-marco.ts),
 * y una pieza nueva que nadie agrupó cae en «Más» en vez de desaparecer (tests/offer-pulir-pdf.test.ts).
 */
export const GRUPOS_PIEZAS: ReadonlyArray<{ titulo: string; keys: readonly PiezaKey[] }> = [
  { titulo: 'Para quién', keys: ['cliente', 'problema', 'resultado', 'objecion'] },
  { titulo: 'Cómo', keys: ['mecanismo', 'entregables', 'semana', 'formato'] },
  { titulo: 'Prueba', keys: ['ventas', 'prueba'] },
  { titulo: 'Precio', keys: ['precio', 'cobro', 'valor', 'costo'] },
  { titulo: 'Cierre', keys: ['garantia', 'bonos', 'urgencia', 'frase'] },
  { titulo: 'Tu negocio', keys: ['escalera', 'otras'] },
];

/** Los grupos con sus piezas, en el orden de GRUPOS_PIEZAS, más «Más» con lo que no esté agrupado. */
export function piezasAgrupadas<P extends { key: string }>(
  lista: readonly P[] = PIEZAS as unknown as readonly P[],
  gruposDef: ReadonlyArray<{ titulo: string; keys: readonly string[] }> = GRUPOS_PIEZAS,
): Array<{ titulo: string; piezas: P[] }> {
  const usadas = new Set<string>();
  const grupos = gruposDef.map((g) => {
    const piezas = lista.filter((p) => g.keys.includes(p.key));
    piezas.forEach((p) => usadas.add(p.key));
    return { titulo: g.titulo, piezas };
  }).filter((g) => g.piezas.length > 0);
  const resto = lista.filter((p) => !usadas.has(p.key));
  return resto.length ? [...grupos, { titulo: 'Más', piezas: resto }] : grupos;
}

export function ListaPiezas({ piezas }: { piezas: PiezasSabidas }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {piezasAgrupadas(PIEZAS).map((g) => (
        <div key={g.titulo} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 600, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.04em', padding: '0 2px 2px' }}>
            {g.titulo}
          </span>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {g.piezas.map((p) => {
              const e = estadoDePieza(piezas, p.key);
              return (
                <li key={p.key} title={tituloDePieza(piezas, p.key)} aria-label={`${p.label}: ${ESTADO_TEXTO[e]}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '6px 2px',
                    fontSize: 'var(--fs-md)', lineHeight: 1.3,
                    color: e === 'vacia' ? 'var(--faint)' : 'var(--ink)', fontWeight: e === 'vacia' ? 500 : 600,
                  }}>
                  <Marca estado={e} />
                  <span>{p.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
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

function Acciones({ puedeConcluir, hayConclusion, etiquetaArmar, ocupado, onArmar, onVer }: AccionesPiezas) {
  if (!puedeConcluir && !hayConclusion) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {puedeConcluir && (
        <Button variant="mako" size="lg" full disabled={ocupado} onClick={onArmar} icon={<MakoStar size={16} color="currentColor" />}>
          {etiquetaArmar}
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
          "Tu oferta" debe ser del mismo alto que el chat»). Con flex y no con un alto en porcentaje:
          contra un padre que estira con flex, un porcentaje da cero en Safari (AGENTS.md, «Dos reglas de
          layout»).
          ⚠️ LO QUE SCROLLEA ES LA LISTA, NO LA TARJETA (12/10/2026, con las piezas pasando de 13 a 15):
          el título con el conteo y el botón de armar quedan fijos arriba y abajo. Con la tarjeta entera
          scrolleando, en una ventana baja el botón quedaba debajo de la última pieza, fuera de la vista. */}
      <div style={{
        flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 18px 20px',
      }}>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 'var(--fs-card)', fontWeight: 700, color: 'var(--ink)' }}>Tu oferta</span>
          <Conteo piezas={piezas} grande />
        </div>
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', marginInline: -6, paddingInline: 6 }}>
          <ListaPiezas piezas={piezas} />
        </div>
        {(acciones.puedeConcluir || acciones.hayConclusion) && <div style={{ flex: 'none' }}><Acciones {...acciones} /></div>}
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
