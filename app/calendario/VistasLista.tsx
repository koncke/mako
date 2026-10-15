'use client';

// =============================================================================
// VistasLista — Mes, Año y Agenda de Google Calendar
// =============================================================================
//   · MES: la grilla de semanas enteras; el número del día arriba al centro (hoy en el círculo azul, «1 oct» el
//     primero del mes); lo de todo el día o de varios días como BARRAS que cruzan las celdas (`barrasDeLaFila`), y lo que
//     tiene hora como «● 10 a.m. Título». Lo que no entra, «N más», que lleva al día.
//   · AÑO: los doce meses chicos; un clic en un día lleva al día, en el nombre del mes, al mes.
//   · AGENDA: los días con algo, uno debajo del otro, como la «Agenda» de Google.

import { useMemo, type CSSProperties } from 'react';
import {
  DIAS_CORTOS, barrasDeLaFila, diaDeLaSemana, horaDe, horaGoogle, itemsPorDia, vaArriba,
  type ItemCalendario,
} from '@/lib/calendario-modelo';
import { colorDe } from './comun';
import { MiniMes } from './MiniMes';
import { rangoGoogle, tituloDe } from './VistaTiempo';

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function VistaMes({ dias, mes, items, hoy, tz, onAbrir, onNuevo, onIrDia }: {
  dias: string[];
  /** 'YYYY-MM' del mes que se mira (lo de afuera va en gris). */
  mes: string;
  items: ItemCalendario[];
  hoy: string;
  tz: string;
  onAbrir: (it: ItemCalendario, ancla: DOMRect) => void;
  onNuevo: (dia: string, ancla: DOMRect) => void;
  onIrDia: (dia: string) => void;
}) {
  const filas = useMemo(() => Array.from({ length: dias.length / 7 }, (_, f) => dias.slice(f * 7, f * 7 + 7)), [dias]);
  const arriba = useMemo(() => items.filter((it) => vaArriba(it, tz)), [items, tz]);
  const conHora = useMemo(() => itemsPorDia(items.filter((it) => !vaArriba(it, tz)), dias, tz), [items, dias, tz]);
  // Cuántos renglones entran por celda (como Google, que mide la celda): 4 con hasta 5 semanas, 3 con 6.
  const entran = filas.length > 5 ? 3 : 4;
  // Las barras usan como mucho todos los lugares menos uno: el último queda para lo que tiene hora o para «N más».
  const LIM = entran - 1;
  return (
    <div className="gc-mes">
      <div className="gc-mes-sem">{DIAS_CORTOS.map((d) => <div key={d}>{d}</div>)}</div>
      <div className="gc-mes-filas" style={{ gridTemplateRows: `repeat(${filas.length}, minmax(0, 1fr))` }}>
        {filas.map((fila) => {
          const { barras } = barrasDeLaFila(arriba, fila, tz);
          return (
            <div key={fila[0]} className="gc-mes-fila">
              {fila.map((d, c) => {
                const lasBarras = barras.filter((b) => b.desde <= c && b.hasta >= c);
                const carrilesUsados = lasBarras.length ? Math.max(...lasBarras.map((b) => b.carril)) + 1 : 0;
                const barrasArriba = Math.min(carrilesUsados, LIM);
                const chips = conHora.get(d) ?? [];
                // Lo que queda por mostrar abajo de las barras: los chips y las barras que no entraron.
                const resto = chips.length + lasBarras.filter((b) => b.carril >= LIM).length;
                const lugar = entran - barrasArriba;
                const chipsVisibles = resto <= lugar ? chips : chips.slice(0, Math.max(0, lugar - 1));
                const ocultos = resto - chipsVisibles.length;
                const clase = ['gc-mes-celda'];
                if (d.slice(0, 7) !== mes) clase.push('gc-mes-celda--afuera');
                if (d === hoy) clase.push('gc-mes-celda--hoy');
                const num = d.endsWith('-01') ? `${Number(d.slice(8))} ${MESES_CORTOS[Number(d.slice(5, 7)) - 1]}` : String(Number(d.slice(8)));
                return (
                  <div key={d} className={clase.join(' ')}
                    onClick={(e) => { if (e.target === e.currentTarget) onNuevo(d, e.currentTarget.getBoundingClientRect()); }}>
                    <button type="button" className="gc-mes-num" onClick={() => onIrDia(d)} aria-label={`Ver el ${d}`}>{num}</button>
                    {/* El lugar de las barras de la fila: los chips empiezan debajo. */}
                    <div style={{ height: barrasArriba * 22, flex: 'none' }} aria-hidden />
                    {chipsVisibles.map((it) => (
                      <button key={it.id} type="button" className="gc-chip" onClick={(e) => onAbrir(it, e.currentTarget.getBoundingClientRect())}
                        style={it.hecho ? { opacity: 0.6 } : undefined}>
                        <span className="gc-chip-punto" style={{ background: colorDe(it) }} aria-hidden />
                        <span className="gc-chip-hora">{horaGoogle(horaDe(it.inicio, tz))}</span>
                        <span className="gc-chip-txt" style={it.hecho || it.google?.rechazado ? { textDecoration: 'line-through' } : undefined}>{tituloDe(it, tz)}</span>
                      </button>
                    ))}
                    {ocultos > 0 && <button type="button" className="gc-mas" onClick={() => onIrDia(d)}>{ocultos} más</button>}
                  </div>
                );
              })}
              {/* Las barras van por encima de las celdas, en la franja de debajo del número. */}
              {barras.filter((b) => b.carril < LIM).map((b) => {
                const estilo: CSSProperties = {
                  left: `calc(${(b.desde / 7) * 100}% + 4px)`, width: `calc(${((b.hasta - b.desde + 1) / 7) * 100}% - 9px)`,
                  top: 32 + b.carril * 22, height: 20, lineHeight: '20px', background: colorDe(b.item), zIndex: 1,
                };
                const clase = ['gc-barrita'];
                if (b.sigueAntes) clase.push('gc-barrita--antes');
                if (b.sigueDespues) clase.push('gc-barrita--despues');
                return (
                  <button key={`${b.item.id}-${fila[0]}`} type="button" className={clase.join(' ')} style={estilo}
                    onClick={(e) => onAbrir(b.item, e.currentTarget.getBoundingClientRect())}>
                    {b.item.diaCompleto ? '' : `${horaGoogle(horaDe(b.item.inicio, tz))} `}{tituloDe(b.item, tz)}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function VistaAnio({ anio, hoy, onIrDia, onIrMes }: {
  anio: number;
  hoy: string;
  onIrDia: (dia: string) => void;
  onIrMes: (fecha: string) => void;
}) {
  const vacio = useMemo(() => new Set<string>(), []);
  return (
    <div className="gc-anio">
      {Array.from({ length: 12 }, (_, m) => {
        const fecha = `${anio}-${String(m + 1).padStart(2, '0')}-01`;
        return <MiniMes key={fecha} mes={fecha} hoy={hoy} elegidos={vacio} onDia={onIrDia} conFlechas={false} onTitulo={() => onIrMes(fecha)} />;
      })}
    </div>
  );
}

export function VistaAgenda({ dias, items, hoy, tz, onAbrir, onIrDia }: {
  dias: string[];
  items: ItemCalendario[];
  hoy: string;
  tz: string;
  onAbrir: (it: ItemCalendario, ancla: DOMRect) => void;
  onIrDia: (dia: string) => void;
}) {
  const porDia = useMemo(() => itemsPorDia(items, dias, tz), [items, dias, tz]);
  const conAlgo = dias.filter((d) => (porDia.get(d) ?? []).length > 0);
  if (!conAlgo.length) return <div className="gc-ag-vacio">No hay eventos en los próximos 30 días.</div>;
  return (
    <div className="gc-agenda">
      {conAlgo.map((d) => {
        const m = Number(d.slice(5, 7));
        return (
          <div key={d} className={`gc-ag-dia${d === hoy ? ' gc-ag-dia--hoy' : ''}`}>
            <div className="gc-ag-fecha">
              <button type="button" className="gc-ag-num" onClick={() => onIrDia(d)} aria-label={`Ver el ${d}`}>{Number(d.slice(8))}</button>
              <span className="gc-ag-sem">{MESES_CORTOS[m - 1]}, {DIAS_CORTOS[diaDeLaSemana(d)]}</span>
            </div>
            <div>
              {(porDia.get(d) ?? []).map((it) => {
                const hora = vaArriba(it, tz) ? 'Todo el día' : rangoGoogle(horaDe(it.inicio, tz), it.fin ? horaDe(it.fin, tz) : null);
                return (
                  <button key={it.id} type="button" className="gc-ag-fila" onClick={(e) => onAbrir(it, e.currentTarget.getBoundingClientRect())}>
                    <span className="gc-ag-punto" style={{ background: colorDe(it) }} aria-hidden />
                    <span className="gc-ag-hora">{hora}</span>
                    <span className="gc-ag-titulo" style={it.hecho || it.google?.rechazado ? { textDecoration: 'line-through' } : undefined}>{tituloDe(it, tz)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

