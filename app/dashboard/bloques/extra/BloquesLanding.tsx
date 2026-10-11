'use client';

// =============================================================================
// BloquesLanding — los bloques de la plantilla «Landing»: el mapa de calor y la curva del video
// =============================================================================
// · El MAPA es el de Landing Analyst TAL CUAL (app/landing-analyst/MapaDeCalor.tsx): la foto de una
//   grabación reconstruida en un iframe sin scripts, el calor encima y «Lo más tocado» al lado. Pide sus
//   propios datos a sus rutas (sólo admin, igual que el Dashboard) y la foto se baja al montarse, no en el
//   primer pintado de la hoja. Mira SUS 30 días: el período de la hoja no le llega (y él lo dice).
// · La CURVA no existía en ninguna pantalla: sale de curvaRetencion (lib/vsl-retencion.ts), 20 cortes con
//   el denominador «medidos». Sin medición dice que no hay, nunca dibuja una curva en cero.

import { useMemo, useState } from 'react';
import { Select } from '@/app/_ui';
import { MapaDeCalor } from '@/app/landing-analyst/MapaDeCalor';
import type { EstiloEfectivo } from '@/lib/graficos-temas';
import type { DatosCurvaVsl } from '@/lib/graficos-bloques-extra-catalogo';
import { NO_ARRASTRAR } from '../piezas';
import { MONO, Vacio, fmt1 } from './piezas-extra';

export function BloqueMapaCalor() {
  // Todo el mapa es interactivo (selector, capas, el resaltado de «Lo más tocado»): sin la clase, en modo
  // edición cualquier clic adentro empezaría a mover la tarjeta.
  return <div className={NO_ARRASTRAR} style={{ minWidth: 0 }}><MapaDeCalor /></div>;
}

const W = 640, H = 240, ML = 40, MR = 12, MT = 12, MB = 30;
const PW = W - ML - MR, PH = H - MT - MB;
const x = (corte: number) => ML + (corte / 100) * PW;
const y = (pct: number) => MT + (1 - pct / 100) * PH;

export function BloqueCurvaVsl({ d, estilo }: { d: DatosCurvaVsl; estilo: EstiloEfectivo }) {
  const videos = useMemo(() => d.videos ?? [], [d.videos]);
  const [elegido, setElegido] = useState<string | null>(null);
  const v = videos.find((x) => x.id === elegido) ?? videos[0] ?? null;
  if (!v) return <Vacio>Nadie le dio play a un video en este período.</Vacio>;
  const color = estilo.colores[0] ?? 'var(--primary)';
  const selector = videos.length > 1 && (
    <div className={NO_ARRASTRAR} style={{ maxWidth: 360 }}>
      <Select ariaLabel="Video" value={v.id} onChange={setElegido} options={videos.map((x) => ({ value: x.id, label: `${x.nombre} · ${x.arrancaron}` }))} />
    </div>
  );
  if (!v.hayDatos) {
    return (
      <>
        {selector}
        <Vacio>{v.arrancaron} {v.arrancaron === 1 ? 'persona le dio' : 'personas le dieron'} play, pero no hay medición de hasta dónde vieron.</Vacio>
      </>
    );
  }
  const puntos = [{ corte: 0, pct: 100 }, ...v.curva.map((p) => ({ corte: p.corte, pct: p.pct }))];
  const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(p.corte).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ');
  const area = `${linea} L${x(100).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const caida = v.mayorCaida;
  const maxSalidas = Math.max(1, ...v.salidas.map((s) => s.salidas));
  const haySalidas = v.salidas.some((s) => s.salidas > 0);
  return (
    <>
      {selector}
      <div className="bx-linea" style={{ fontFamily: MONO }}>
        {v.medidos} con avance medido de {v.arrancaron} que le dieron play
        {v.medianaPct != null ? ` · la mitad llega al ${v.medianaPct}%` : ''}
        {caida ? ` · la mayor caída es entre el ${caida.desde}% y el ${caida.hasta}% (${fmt1(caida.pct)}% se va)` : ''}
      </div>
      <svg className="bx-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Curva de retención del video">
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={ML} y1={y(t)} x2={ML + PW} y2={y(t)} stroke="var(--border)" />
            <text x={ML - 6} y={y(t) + 3} fontSize={9.5} fill="var(--faint)" textAnchor="end">{t}%</text>
            <text x={x(t)} y={MT + PH + 16} fontSize={9.5} fill="var(--faint)" textAnchor="middle">{t}%</text>
          </g>
        ))}
        {caida && <rect x={x(caida.desde)} y={MT} width={x(caida.hasta) - x(caida.desde)} height={PH} fill="var(--bad)" fillOpacity={0.1} />}
        {/* Las salidas (eventos «exit»): dónde se van, como barras finas sobre el piso. */}
        {haySalidas && v.salidas.map((s) => s.salidas > 0 && (
          <rect key={s.corte} x={x(s.corte - 5) + 2} y={y((s.salidas / maxSalidas) * 30)} width={Math.max(1, x(5) - x(0) - 4)} height={y(0) - y((s.salidas / maxSalidas) * 30)} fill="var(--faint)" fillOpacity={0.35} />
        ))}
        <path d={area} fill={color} fillOpacity={0.14} />
        <path d={linea} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 11.5, color: 'var(--faint)' }}>
        <span><span style={{ color }}>●</span> siguen mirando, de los medidos</span>
        {caida && <span><span style={{ color: 'var(--bad)' }}>■</span> el tramo con más salidas</span>}
        {haySalidas && <span><span style={{ color: 'var(--faint)' }}>■</span> dónde cierran el video</span>}
        {v.sinMedicion > 0 && <span>· {v.sinMedicion} sin avance medido no cuentan</span>}
      </div>
    </>
  );
}
