'use client';

// =============================================================================
// MiniMes — el mes chico de Google Calendar: el de la barra lateral y cada uno de los doce de la vista Año
// =============================================================================
// Como en Google: las iniciales arriba (L M X J V S D), hoy en un círculo azul, la semana que se está mirando
// sombreada, y un clic en un día lleva a ese día. Las flechas ‹ › mueven sólo el mes chico (no la vista).

import { useState } from 'react';
import { INICIALES_DIAS, NOMBRES_MESES, semanasDelMes } from '@/lib/calendario-modelo';

export function MiniMes({ mes, hoy, elegidos, onDia, conFlechas = true, onTitulo }: {
  /** Cualquier fecha del mes ('YYYY-MM-DD'). */
  mes: string;
  hoy: string;
  /** Los días que la vista grande está mostrando (se sombrean). */
  elegidos: ReadonlySet<string>;
  onDia: (dia: string) => void;
  conFlechas?: boolean;
  /** Un clic en el nombre del mes (la vista Año lleva al mes). */
  onTitulo?: () => void;
}) {
  const [propio, setPropio] = useState<string | null>(null);
  const mostrado = propio ?? mes;
  const [y, m] = mostrado.split('-').map(Number);
  const semanas = semanasDelMes(mostrado);
  const mover = (d: -1 | 1) => setPropio(new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 10));
  const titulo = `${NOMBRES_MESES[m - 1]} ${y}`;
  return (
    <div className="gc-mini">
      <div className="gc-mini-cab">
        {onTitulo
          ? <button type="button" className="gc-mini-mes" onClick={onTitulo} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, font: 'inherit', fontSize: 14, fontWeight: 500, color: 'inherit' }}>{titulo}</button>
          : <span className="gc-mini-mes">{titulo}</span>}
        {conFlechas && (
          <span style={{ display: 'inline-flex' }}>
            <button type="button" className="gc-ico gc-ico--chico" aria-label="Mes anterior" onClick={() => mover(-1)}><Flecha dir="izq" /></button>
            <button type="button" className="gc-ico gc-ico--chico" aria-label="Mes siguiente" onClick={() => mover(1)}><Flecha dir="der" /></button>
          </span>
        )}
      </div>
      <div className="gc-mini-grilla" role="grid" aria-label={titulo}>
        {INICIALES_DIAS.map((d, i) => <div key={`i${i}`} className="gc-mini-ini" aria-hidden>{d}</div>)}
        {semanas.flat().map((d) => {
          const clase = ['gc-mini-dia'];
          if (d.slice(0, 7) !== mostrado.slice(0, 7)) clase.push('gc-mini-dia--afuera');
          if (elegidos.has(d)) clase.push('gc-mini-dia--semana');
          if (d === hoy) clase.push('gc-mini-dia--hoy');
          return (
            <button key={d} type="button" className={clase.join(' ')} aria-current={d === hoy ? 'date' : undefined}
              aria-label={d} onClick={() => onDia(d)}>
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Flecha({ dir, tam = 20 }: { dir: 'izq' | 'der' | 'abajo' | 'arriba'; tam?: number }) {
  const d = dir === 'izq' ? 'M15 6l-6 6 6 6' : dir === 'der' ? 'M9 6l6 6-6 6' : dir === 'abajo' ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6';
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
