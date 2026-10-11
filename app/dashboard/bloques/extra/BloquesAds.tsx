'use client';

// =============================================================================
// BloquesAds — los bloques de la plantilla «Ads Analyst»: los patrones y el cuadrante de retención
// =============================================================================
// Lo que dibujaba app/ads-analyst/ScriptsBrowser.tsx, con los colores de la hoja (tokens y paleta del
// tema) en vez de los hex de la tab. Los datos los arma lib/graficos-bloques-extra.ts con las MISMAS
// funciones que la tab (buildPatterns, getQuadrantData).
//
// ⚠️ LOS PATRONES SON EL HISTÓRICO COMPLETO (las ScriptView no tienen ventana) y el bloque lo dice: un
// período de la hoja que no aplica y no se avisa se lee como que aplicó.

import { useMemo, useState } from 'react';
import type { EstiloEfectivo } from '@/lib/graficos-temas';
import { HOOK_MID, HOLD_MID, POL, VEREDICTO_ROTULO } from '@/lib/ads-analyst-patrones';
import type { DatosCuadrante, DatosPatrones, GuionResumen } from '@/lib/graficos-bloques-extra-catalogo';
import { NO_ARRASTRAR } from '../piezas';
import { COLOR_POLARIDAD, COLOR_VEREDICTO, MONO, Subtitulo, Vacio, suave, usdEntero } from './piezas-extra';

function ChipVeredicto({ v }: { v: GuionResumen['veredicto'] }) {
  const c = COLOR_VEREDICTO[v];
  return <span className="bx-chip" style={{ color: c, background: suave(c), border: `1px solid ${suave(c, 35)}` }}>{VEREDICTO_ROTULO[v]}</span>;
}

function FilaGuion({ a }: { a: GuionResumen }) {
  return (
    <div className="bx-fila">
      <span className="bx-crece" title={a.nombre}>{a.nombre}</span>
      <span className="bx-num">{a.angulo} · hook {a.hook}% · {usdEntero(a.gasto)} · {a.agendas} ag</span>
      <ChipVeredicto v={a.veredicto} />
    </div>
  );
}

function Barra({ valor, max, color }: { valor: number; max: number; color: string }) {
  const w = max > 0 ? Math.max(2, Math.min(100, (valor / max) * 100)) : 0;
  return <span className="bx-carril" style={{ height: 6, flex: 1 }}><span style={{ width: `${w}%`, background: color }} /></span>;
}

export function BloquePatrones({ d }: { d: DatosPatrones }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verMuestra, setVerMuestra] = useState(false);
  const patrones = d.patrones ?? [];
  if (!d.total) return <Vacio>Todavía no hay guiones con pauta. Aparecen cuando MaKo analice tus anuncios.</Vacio>;
  const ab = patrones.find((p) => p.key === abierto) ?? null;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span className="bx-linea">{d.total} guiones · {d.confiables} con muestra suficiente · todo el histórico</span>
        <span style={{ display: 'inline-flex', gap: 12, fontSize: 12, color: 'var(--dim)' }}>
          {(['bueno', 'malo', 'proceso'] as const).map((p) => <span key={p}><span style={{ color: COLOR_POLARIDAD[p] }}>●</span> {POL[p].label.toLowerCase()}</span>)}
        </span>
      </div>
      {patrones.length === 0 ? <Vacio>Todavía no hay patrones claros. Deja correr más presupuesto.</Vacio> : (
        <div className="bx-grilla">
          {patrones.map((p, i) => {
            const c = COLOR_POLARIDAD[p.polarity];
            return (
              <button key={p.key} type="button" className={`bx-tarjeta ${NO_ARRASTRAR}`} aria-expanded={abierto === p.key}
                onClick={() => setAbierto((x) => (x === p.key ? null : p.key))}
                style={{ borderLeft: `3px solid ${c}`, ...(i === 0 ? { gridColumn: '1 / -1', background: suave(c, 7) } : {}) }}>
                <span className="bx-chip" style={{ alignSelf: 'flex-start', color: c, background: suave(c) }}>{POL[p.polarity].label} · {p.chip}</span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: i === 0 ? 40 : 26, fontWeight: 600, color: c, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{p.big}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{p.tlabel}</span>
                </span>
                <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink)' }}>{p.stmt}</span>
                <span style={{ display: 'grid', gap: 5 }}>
                  {[[p.aLabel, p.aVal, p.a], [p.bLabel, p.bVal, p.b]].map(([l, v, n]) => (
                    <span key={String(l)} className="bx-fila" style={{ fontSize: 12 }}>
                      <span style={{ width: 92, flex: 'none', color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</span>
                      <Barra valor={Number(n)} max={p.max} color={c} />
                      <span className="bx-num" style={{ width: 52, textAlign: 'right' }}>{v}</span>
                    </span>
                  ))}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: c }}>{abierto === p.key ? 'Ocultar guiones' : `Ver ${p.ads.length} guiones`}</span>
              </button>
            );
          })}
        </div>
      )}
      {ab && (
        <div style={{ display: 'grid', gap: 8 }}>
          <Subtitulo>Guiones detrás de «{ab.chip}»</Subtitulo>
          <div className="bx-lista">{ab.ads.map((a) => <FilaGuion key={a.id} a={a} />)}</div>
        </div>
      )}
      {d.muestraChica.length > 0 && (
        <div style={{ border: `1px solid ${suave('var(--bad)', 40)}`, background: suave('var(--bad)', 6), borderRadius: 12, padding: '12px 14px', display: 'grid', gap: 8 }}>
          <button type="button" className={`bx-boton ${NO_ARRASTRAR}`} style={{ color: 'var(--bad)' }} aria-expanded={verMuestra} onClick={() => setVerMuestra((v) => !v)}>
            Cuidado con la muestra chica · {d.muestraChica.length} {verMuestra ? '▴' : '▾'}
          </button>
          {verMuestra && <div className="bx-lista">{d.muestraChica.map((a) => <FilaGuion key={a.id} a={a} />)}</div>}
        </div>
      )}
    </>
  );
}

// ── El cuadrante ──────────────────────────────────────────────────────────────────────────
// Dominio FIJO, como la tab: el marco no se auto-escala ni se mueve nunca, así la posición de un punto
// significa lo mismo en cada ventana. Las divisorias son los umbrales del veredicto.
const XMAX = 55, YMAX = 30;
const W = 720, H = 360, ML = 46, MR = 16, MT = 14, MB = 40;
const PW = W - ML - MR, PH = H - MT - MB;
const px = (hook: number) => ML + (Math.min(XMAX, Math.max(0, hook)) / XMAX) * PW;
const py = (hold: number) => MT + (1 - Math.min(YMAX, Math.max(0, hold)) / YMAX) * PH;

type Punto = { id: string; nombre: string; angulo: string; hook: number; hold: number; gasto: number; agendas: number; baja: boolean; texto: string };

export function BloqueCuadrante({ d, estilo }: { d: DatosCuadrante; estilo: EstiloEfectivo }) {
  const [vista, setVista] = useState<'anuncios' | 'angulos'>('anuncios');
  const [sinMuestraChica, setSinMuestraChica] = useState(false);
  const [hov, setHov] = useState<string | null>(null);
  const puntos0 = useMemo(() => d.puntos ?? [], [d.puntos]);
  const angulos = useMemo(() => [...new Set(puntos0.map((p) => p.angulo))].sort(), [puntos0]);
  const colorDe = (a: string) => estilo.colores[angulos.indexOf(a) % Math.max(1, estilo.colores.length)] ?? 'var(--primary)';

  const puntos: Punto[] = useMemo(() => {
    const base = puntos0.filter((p) => !sinMuestraChica || p.confianza !== 'baja');
    if (vista === 'anuncios') {
      return base.map((p) => ({
        id: p.id, nombre: p.nombre, angulo: p.angulo, hook: p.hook, hold: p.hold, gasto: p.gasto, agendas: p.agendas, baja: p.confianza === 'baja',
        texto: `${p.nombre} · ${p.angulo} — hook ${p.hook}% · retiene ${p.hold}% · ${usdEntero(p.gasto)} · ${p.agendas} agendas · ${VEREDICTO_ROTULO[p.veredicto]}`,
      }));
    }
    // Por ángulo: el promedio de cada uno PONDERADO POR GASTO, como la vista de la tab.
    const g = new Map<string, { hook: number; hold: number; gasto: number; agendas: number; n: number }>();
    for (const p of base) {
      const a = g.get(p.angulo) ?? { hook: 0, hold: 0, gasto: 0, agendas: 0, n: 0 };
      const peso = p.gasto > 0 ? p.gasto : 0;
      a.hook += p.hook * peso; a.hold += p.hold * peso; a.gasto += peso; a.agendas += p.agendas; a.n++;
      g.set(p.angulo, a);
    }
    return [...g.entries()].filter(([, a]) => a.gasto > 0).map(([angulo, a]) => {
      const hook = Math.round(a.hook / a.gasto), hold = Math.round(a.hold / a.gasto);
      return { id: angulo, nombre: angulo, angulo, hook, hold, gasto: a.gasto, agendas: a.agendas, baja: false, texto: `${angulo} · ${a.n} guiones — hook ${hook}% · retiene ${hold}% · ${usdEntero(a.gasto)} · ${a.agendas} agendas` };
    });
  }, [puntos0, vista, sinMuestraChica]);

  if (!puntos0.length) return <Vacio>Sin guiones de video con pauta en este período.</Vacio>;
  const maxGasto = Math.max(1, ...puntos.map((p) => p.gasto));
  const radio = (g: number) => 4 + Math.sqrt(g / maxGasto) * (vista === 'angulos' ? 22 : 14);
  const xm = px(HOOK_MID), ym = py(HOLD_MID);
  const hp = puntos.find((p) => p.id === hov) ?? null;
  const zonas = [
    { x: xm, y: MT, w: ML + PW - xm, h: ym - MT, c: 'var(--good)', t: 'Escalar', ax: ML + PW - 6, ay: MT + 14, anchor: 'end' },
    { x: ML, y: MT, w: xm - ML, h: ym - MT, c: 'var(--primary)', t: 'Mejorar gancho', ax: ML + 6, ay: MT + 14, anchor: 'start' },
    { x: xm, y: ym, w: ML + PW - xm, h: MT + PH - ym, c: 'var(--warn)', t: 'Reescribir cuerpo', ax: ML + PW - 6, ay: MT + PH - 8, anchor: 'end' },
    { x: ML, y: ym, w: xm - ML, h: MT + PH - ym, c: 'var(--bad)', t: 'Repensar', ax: ML + 6, ay: MT + PH - 8, anchor: 'start' },
  ] as const;
  return (
    <>
      <div className={NO_ARRASTRAR} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div className="bx-pildoras" role="group" aria-label="Vista">
          {([['anuncios', 'Por anuncio'], ['angulos', 'Por ángulo']] as const).map(([k, l]) => (
            <button key={k} type="button" className="bx-pildora" aria-pressed={vista === k} onClick={() => setVista(k)}>{l}</button>
          ))}
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--dim)', cursor: 'pointer' }}>
          <input type="checkbox" checked={sinMuestraChica} onChange={(e) => setSinMuestraChica(e.target.checked)} /> Ocultar muestra chica
        </label>
      </div>
      <svg className="bx-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Hook rate contra retención al CTA">
        {zonas.map((z) => <rect key={z.t} x={z.x} y={z.y} width={Math.max(0, z.w)} height={Math.max(0, z.h)} fill={z.c} fillOpacity={0.07} />)}
        {zonas.map((z) => <text key={`t${z.t}`} x={z.ax} y={z.ay} fontSize={10} fontWeight={700} fill={z.c} textAnchor={z.anchor} style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{z.t}</text>)}
        <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="var(--border-strong)" />
        <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="var(--border-strong)" />
        <line x1={xm} y1={MT} x2={xm} y2={MT + PH} stroke="var(--border-strong)" strokeDasharray="4 4" />
        <line x1={ML} y1={ym} x2={ML + PW} y2={ym} stroke="var(--border-strong)" strokeDasharray="4 4" />
        {[0, 10, 20, 28, 40, 55].map((v) => <text key={`x${v}`} x={px(v)} y={MT + PH + 15} fontSize={9.5} fill="var(--faint)" textAnchor="middle">{v}%</text>)}
        {[0, 10, 20, 30].map((v) => <text key={`y${v}`} x={ML - 6} y={py(v) + 3} fontSize={9.5} fill="var(--faint)" textAnchor="end">{v}%</text>)}
        <text x={ML + PW / 2} y={H - 6} fontSize={10.5} fill="var(--dim)" textAnchor="middle">Hook rate: ¿frena el scroll? →</text>
        <text x={12} y={MT + PH / 2} fontSize={10.5} fill="var(--dim)" textAnchor="middle" transform={`rotate(-90 12 ${MT + PH / 2})`}>Retención al CTA →</text>
        {[...puntos].sort((a, b) => b.gasto - a.gasto).map((p) => {
          const c = colorDe(p.angulo);
          const on = hov === p.id;
          return (
            <circle key={p.id} cx={px(p.hook)} cy={py(p.hold)} r={radio(p.gasto)} fill={c} fillOpacity={p.baja ? 0.18 : on ? 0.85 : 0.55}
              stroke={c} strokeWidth={on ? 2 : 1.2} strokeDasharray={p.baja ? '3 2' : undefined} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHov(p.id)} onMouseLeave={() => setHov(null)} />
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11.5, color: 'var(--faint)' }}>
        {angulos.map((a) => <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: colorDe(a) }} />{a}</span>)}
        <span>· tamaño = gasto · punteado = muestra chica</span>
      </div>
      <div style={{ minHeight: 20, fontSize: 12.5, fontFamily: MONO, color: hp ? 'var(--ink)' : 'var(--faint)' }}>
        {hp ? hp.texto : 'Pasa el cursor por un punto para ver el guion.'}
      </div>
    </>
  );
}
