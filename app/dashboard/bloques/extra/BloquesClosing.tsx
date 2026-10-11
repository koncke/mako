'use client';

// =============================================================================
// BloquesClosing — los bloques de la plantilla «Closing»: el embudo, los factores y los closers
// =============================================================================
// Lo que calculaba el `useMemo ag` de app/closing/ClosingBrowser.tsx, leído con su copia de
// lib/api-mako/areas/closing.helpers.ts (embudoDe, factoresDe, closersDe). Revisar o re-evaluar una
// llamada es una TAREA y se queda en la tab: acá cada ejemplo lleva a la llamada, nada más.
//
// ⚠️ «GANADA» NO ES UNA VENTA: la pone el modelo POR LLAMADA (en una R1 quiere decir que avanzó). Y con
// pocas perdidas, la brecha se mueve mucho: el bloque lo dice cuando son menos de 3.

import { useState } from 'react';
import Link from '@/app/_ui/Link';
import type { EstiloEfectivo } from '@/lib/graficos-temas';
import type { DatosClosers, DatosEmbudoCierre, DatosFactores, EjemploLlamada } from '@/lib/graficos-bloques-extra-catalogo';
import { NO_ARRASTRAR } from '../piezas';
import { MONO, Vacio, colorPuntaje, fechaCorta, fmt1, suave } from './piezas-extra';

export function BloqueEmbudoCierre({ d, estilo }: { d: DatosEmbudoCierre; estilo: EstiloEfectivo }) {
  if (!d.r1 && !d.r2) return <Vacio>Sin llamadas de venta analizadas en este período.</Vacio>;
  const color = estilo.colores[0] ?? 'var(--primary)';
  const etapas = [
    { rotulo: 'Diagnóstico · R1', n: d.r1 },
    { rotulo: 'Propuesta · R2', n: d.r2 },
    { rotulo: 'Cierre ganado', n: d.ganadasR2 },
  ];
  const max = Math.max(1, ...etapas.map((e) => e.n));
  const pasos = [
    { de: etapas[0].rotulo, a: etapas[1].rotulo, pct: d.r1 ? Math.round((d.r2 / d.r1) * 100) : null, perdidas: d.r1 - d.r2 },
    { de: etapas[1].rotulo, a: etapas[2].rotulo, pct: d.r2 ? Math.round((d.ganadasR2 / d.r2) * 100) : null, perdidas: d.r2 - d.ganadasR2 },
  ];
  const fuga = [...pasos].filter((p) => p.pct != null).sort((a, b) => (a.pct as number) - (b.pct as number))[0];
  return (
    <>
      <div style={{ display: 'grid', gap: 6 }}>
        {etapas.map((e, i) => (
          <div key={e.rotulo} style={{ display: 'grid', gap: 6 }}>
            <div className="bx-fila">
              <span style={{ width: 132, flex: 'none', color: 'var(--dim)' }}>{e.rotulo}</span>
              <span className="bx-carril" style={{ height: 26, borderRadius: 7 }}>
                <span style={{ width: `${Math.max(2, (e.n / max) * 100)}%`, background: suave(color, 30 + i * 22), borderRadius: 7 }} />
              </span>
              <span className="bx-num" style={{ width: 40, textAlign: 'right', color: 'var(--ink)', fontWeight: 600 }}>{e.n}</span>
            </div>
            {i < pasos.length && (
              <div className="bx-num" style={{ paddingLeft: 142, color: pasos[i].pct != null && pasos[i].pct! < 50 ? 'var(--bad)' : 'var(--faint)' }}>
                ↓ {pasos[i].pct != null ? `${pasos[i].pct}% sigue` : '—'}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="bx-linea">
        {d.tasa != null ? `Tasa de cierre ${d.tasa}% de las R2` : 'Todavía no hay R2'}
        {fuga && fuga.perdidas > 0 ? ` · la mayor fuga está entre ${fuga.de.split(' · ')[0].toLowerCase()} y ${fuga.a.split(' · ')[0].toLowerCase()}` : ''}
      </div>
      <div className="bx-linea">Cuenta llamadas, no personas: una R2 cuya R1 no se analizó cuenta igual.</div>
    </>
  );
}

function Ejemplos({ titulo, xs, color }: { titulo: string; xs: EjemploLlamada[]; color: string }) {
  if (!xs.length) return null;
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>{titulo}</span>
      {xs.map((x) => (
        <Link key={x.id} href={`/closing?call=${x.id}`} className={NO_ARRASTRAR} style={{ fontSize: 12.5, color: 'var(--primary)', textDecoration: 'none' }}>
          <span style={{ fontFamily: MONO, color }}>{fmt1(x.puntaje)}</span> · {fechaCorta(x.fecha)}{x.tipo ? ` · ${x.tipo}` : ''} · Ver la llamada →
        </Link>
      ))}
    </div>
  );
}

export function BloqueFactores({ d }: { d: DatosFactores }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  if (!d.ganadas || !d.perdidas) return <Vacio>Hace falta al menos una llamada ganada y una perdida para comparar.</Vacio>;
  const filas = d.dimensiones ?? [];
  const top = filas[0];
  const pos = (s: number | null) => `${Math.max(0, Math.min(10, s ?? 0)) * 10}%`;
  return (
    <>
      {top && top.brecha != null && top.brecha > 0 && (
        <div style={{ border: `1px solid ${suave('var(--mako)', 45)}`, background: suave('var(--mako)', 10), borderRadius: 12, padding: '12px 14px', display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>✦ {top.dimension} decide tus cierres <span style={{ fontFamily: MONO, color: 'var(--mako-ink)' }}>+{fmt1(top.brecha)}</span></span>
          <span className="bx-linea">Ganadas {fmt1(top.ganadas)} · perdidas {fmt1(top.perdidas)} · equipo {fmt1(top.equipo)}</span>
        </div>
      )}
      <div className="bx-linea">
        {d.ganadas} ganadas · {d.perdidas} perdidas{d.enProceso ? ` · ${d.enProceso} en proceso no cuentan` : ''}
        {d.perdidas < 3 ? ' · con tan pocas perdidas la brecha se mueve mucho' : ''}
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--faint)' }}>
        <span><span style={{ color: 'var(--bad)' }}>●</span> perdidas</span>
        <span><span style={{ color: 'var(--good)' }}>●</span> ganadas</span>
        <span>│ equipo</span>
      </div>
      <div className="bx-lista" style={{ gap: 4 }}>
        {filas.map((f, i) => {
          const on = abierta === f.dimension;
          const dif = i < 3 && f.brecha != null && f.brecha > 0;
          const a = Math.min(f.ganadas ?? 0, f.perdidas ?? 0), b = Math.max(f.ganadas ?? 0, f.perdidas ?? 0);
          return (
            <div key={f.dimension} style={{ display: 'grid', gap: 8 }}>
              <button type="button" className={`bx-tarjeta ${NO_ARRASTRAR}`} aria-expanded={on} onClick={() => setAbierta(on ? null : f.dimension)}
                style={{ flexDirection: 'row', alignItems: 'center', padding: '9px 12px', background: 'transparent', border: 'none', borderRadius: 10 }}>
                <span style={{ width: 190, flex: 'none', fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.dimension}{dif && <span className="bx-chip" style={{ marginLeft: 8, color: 'var(--mako-ink)', background: suave('var(--mako)', 14) }}>Diferenciador</span>}
                </span>
                <span style={{ flex: 1, position: 'relative', height: 18, minWidth: 80 }}>
                  <span style={{ position: 'absolute', left: 0, right: 0, top: 8, height: 2, background: 'var(--surface-2)' }} />
                  {f.ganadas != null && f.perdidas != null && <span style={{ position: 'absolute', left: pos(a), width: `calc(${pos(b)} - ${pos(a)})`, top: 8, height: 2, background: 'var(--border-strong)' }} />}
                  {f.equipo != null && <span style={{ position: 'absolute', left: pos(f.equipo), top: 2, width: 2, height: 14, background: 'var(--faint)' }} />}
                  {f.perdidas != null && <span style={{ position: 'absolute', left: `calc(${pos(f.perdidas)} - 6px)`, top: 3, width: 12, height: 12, borderRadius: '50%', background: 'var(--bad)' }} />}
                  {f.ganadas != null && <span style={{ position: 'absolute', left: `calc(${pos(f.ganadas)} - 6px)`, top: 3, width: 12, height: 12, borderRadius: '50%', background: 'var(--good)' }} />}
                </span>
                <span className="bx-num" style={{ width: 56, textAlign: 'right', color: f.brecha != null && f.brecha > 0 ? 'var(--good)' : 'var(--dim)' }}>
                  {f.brecha == null ? '—' : `${f.brecha > 0 ? '+' : ''}${fmt1(f.brecha)}`}
                </span>
              </button>
              {on && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, padding: '0 12px 8px' }}>
                  <Ejemplos titulo="Donde brilló (ganadas)" xs={f.brillo} color="var(--good)" />
                  <Ejemplos titulo="Donde faltó (perdidas)" xs={f.falto} color="var(--bad)" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

const iniciales = (s: string) => {
  const p = s.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '—';
};

export function BloqueClosers({ d, estilo }: { d: DatosClosers; estilo: EstiloEfectivo }) {
  const closers = d.closers ?? [];
  if (!closers.length) return <Vacio>Sin llamadas de venta analizadas en este período.</Vacio>;
  return (
    <div className="bx-grilla">
      {closers.map((c, i) => {
        const color = estilo.colores[i % Math.max(1, estilo.colores.length)] ?? 'var(--primary)';
        return (
          <div key={c.closer} className="bx-tarjeta">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 700, color, background: suave(color, 16) }}>{iniciales(c.closer)}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.closer}</span>
              <span style={{ fontSize: 22, fontWeight: 600, color: colorPuntaje(c.puntaje), fontVariantNumeric: 'tabular-nums' }}>{fmt1(c.puntaje)}</span>
            </div>
            <span className="bx-linea">{c.llamadas} {c.llamadas === 1 ? 'llamada' : 'llamadas'} · {c.ganadas} {c.ganadas === 1 ? 'ganada' : 'ganadas'}</span>
            {c.flojo && (
              <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>
                Punto débil: <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{c.flojo.dimension}</b> <span style={{ fontFamily: MONO, color: colorPuntaje(c.flojo.puntaje) }}>{fmt1(c.flojo.puntaje)}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
