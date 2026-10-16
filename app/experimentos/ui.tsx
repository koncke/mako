'use client';

// =============================================================================
// ui — átomos visuales compartidos de /experimentos
// =============================================================================
// Mismo lenguaje que el wizard de "Nueva campaña": tokens del diseño, marca MaKo
// (chispa dorada), tipografía Geist, tarjetas redondeadas y foco en una cosa por
// pantalla. Todo consume var(--token) para respetar el tema.
// =============================================================================

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import type { Punto } from '@/lib/experimentos';
import { METRICA_FMT, fmtVal, fmtFechaCorta, fmtFechaLarga, fmtDelta, dirLabel } from '@/lib/experimentos-formato';

export const MONO = "'Geist Mono', monospace";
export const SANS = "'Geist', sans-serif";

// Chispa de 4 puntas de MaKo (mismo path que MakoBrand), centrada en (0,0).
const SPARK = 'M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z';

// ── Formato de métricas: vive en lib/experimentos-formato.ts (módulo PURO, 15/10/2026) ──
// Lo lee también el server del teléfono (app/m/experimentos), que no puede importar valores de un
// módulo 'use client'. Acá se re-exporta para que las tabs sigan importándolo de './ui'.
export { METRICA_FMT, fmtVal, fmtFechaCorta, fmtFechaLarga, fmtDelta, dirLabel };

// ── Estilos compartidos ──
export const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
export const btnDark: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 18px', borderRadius: 12, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
export const btnPrimary: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 18px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
export const btnGhost: CSSProperties = { padding: '10px 15px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, cursor: 'pointer' };
export const pregunta: CSSProperties = { fontSize: 25, fontWeight: 600, color: 'var(--ink)', textAlign: 'center', letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0 };
export const ayuda: CSSProperties = { fontSize: 14.5, color: 'var(--dim)', textAlign: 'center', lineHeight: 1.5, margin: '10px 0 0', maxWidth: 460 };
export const sectionLabel: CSSProperties = { fontFamily: MONO, fontSize: 11.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)' };

// ── Pill ──
export function Pill({ tone = 'faint', children, style }: { tone?: 'good' | 'bad' | 'warn' | 'faint' | 'primary'; children: ReactNode; style?: CSSProperties }) {
  const map = {
    good: { bg: 'var(--good-bg)', bd: 'var(--good)', fg: 'var(--good)' },
    bad: { bg: 'var(--bad-bg)', bd: 'var(--bad)', fg: 'var(--bad)' },
    warn: { bg: 'var(--warn-bg)', bd: 'var(--warn)', fg: 'var(--warn)' },
    faint: { bg: 'var(--surface-2)', bd: 'var(--border-strong)', fg: 'var(--dim)' },
    primary: { bg: 'var(--primary-bg)', bd: 'var(--primary-weak)', fg: 'var(--primary-strong)' },
  }[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: map.bg, border: `1px solid ${map.bd}`, color: map.fg, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', ...style }}>
      {children}
    </span>
  );
}

// ── Sparkline ──
export function Spark({ serie, color = 'var(--primary)', height = 64 }: { serie: Punto[]; color?: string; height?: number }) {
  const data = serie.filter((p) => p.valor != null).map((p) => ({ x: fmtFechaCorta(p.fecha), y: p.valor }));
  const uid = useId().replace(/[:]/g, '');
  if (data.length < 2) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--faint)', fontFamily: MONO }}>aún sin serie</div>;
  }
  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`sp${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="x" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'var(--faint)' }} formatter={(val) => [String(val), ''] as [string, string]} />
          <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2} fill={`url(#sp${uid})`} connectNulls dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Loader de MaKo con mensajes rotativos (chispa + anillos sonar) ──
export function MakoLoading({ pasos, pad = '52px 30px' }: { pasos: string[]; pad?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (pasos.length <= 1) return; const id = setInterval(() => setI((p) => (p + 1 < pasos.length ? p + 1 : p)), 1800); return () => clearInterval(id); }, [pasos.length]);
  const uid = `mkl${useId().replace(/[:]/g, '')}`;
  const cur = Math.min(i, pasos.length - 1);
  const css = `
    .${uid}-spark { transform-box: fill-box; transform-origin: center; animation: ${uid}-pulse 1.5s ease-in-out infinite; }
    @keyframes ${uid}-pulse { 0%,100% { transform: scale(.9); opacity: .85; } 50% { transform: scale(1.12); opacity: 1; } }
    .${uid}-ring { transform-box: fill-box; transform-origin: center; opacity: 0; animation: ${uid}-sonar 1.8s ease-out infinite; }
    .${uid}-ring2 { animation-delay: .9s; }
    @keyframes ${uid}-sonar { 0% { transform: scale(.5); opacity: .5; } 100% { transform: scale(2.3); opacity: 0; } }
    .${uid}-txt { animation: ${uid}-tin .4s ease; }
    @keyframes ${uid}-tin { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
  `;
  return (
    <div style={{ padding: pad, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, textAlign: 'center' }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <svg width={60} height={60} viewBox="-33 -33 66 66" role="img" aria-label="MaKo trabajando">
        <defs><linearGradient id={`${uid}-g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F6D365" /><stop offset="100%" stopColor="#EF9F27" /></linearGradient></defs>
        <circle className={`${uid}-ring`} r="13" fill="none" stroke="#EF9F27" strokeWidth="1.5" strokeOpacity=".5" />
        <circle className={`${uid}-ring ${uid}-ring2`} r="13" fill="none" stroke="#F6D365" strokeWidth="1.5" strokeOpacity=".45" />
        <g transform="scale(1.5)"><path className={`${uid}-spark`} d={SPARK} fill={`url(#${uid}-g)`} /></g>
      </svg>
      <h3 key={cur} className={`${uid}-txt`} style={{ ...pregunta, fontSize: 20, minHeight: 25 }}>{pasos[cur]}</h3>
      {pasos.length > 1 && (
        <div style={{ display: 'flex', gap: 6 }}>
          {pasos.map((_, k) => <span key={k} style={{ width: 6, height: 6, borderRadius: 999, background: k <= cur ? 'var(--primary)' : 'var(--border-strong)', transition: 'background .3s' }} />)}
        </div>
      )}
    </div>
  );
}

// ── Mini-markdown (para el resumen de la Retro): **bold**, viñetas, ## títulos ──
function inline(text: string, k: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p) ? <strong key={`${k}-${i}`}>{p.slice(2, -2)}</strong> : <span key={`${k}-${i}`}>{p}</span>);
}
export function Markdown({ text }: { text: string }) {
  const lines = (text || '').split('\n');
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    const items = bullets; bullets = [];
    blocks.push(<ul key={`ul-${blocks.length}`} style={{ margin: '6px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>{items.map((b, i) => <li key={i} style={{ lineHeight: 1.55 }}>{inline(b, `li-${blocks.length}-${i}`)}</li>)}</ul>);
  };
  lines.forEach((raw, idx) => {
    const t = raw.trim();
    if (/^[-*•]\s+/.test(t)) { bullets.push(t.replace(/^[-*•]\s+/, '')); return; }
    flush();
    if (t === '') return;
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) { blocks.push(<div key={idx} style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)', margin: '10px 0 2px' }}>{inline(h[2], `h-${idx}`)}</div>); return; }
    blocks.push(<p key={idx} style={{ margin: '4px 0', lineHeight: 1.6, color: 'var(--ink)' }}>{inline(t, `p-${idx}`)}</p>);
  });
  flush();
  return <>{blocks}</>;
}

// ── Modal (overlay con blur, tarjeta redondeada) ──
export function Modal({ onClose, children, maxWidth = 620 }: { onClose: () => void; children: ReactNode; maxWidth?: number }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 18px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, boxShadow: '0 30px 80px rgba(18,21,27,.4)', overflow: 'hidden', fontFamily: SANS }}>
        {children}
      </div>
    </div>
  );
}

// ── Estado vacío elegante ──
export function Empty({ titulo, sub, children }: { titulo: string; sub?: string; children?: ReactNode }) {
  return (
    <div style={{ ...card, borderStyle: 'dashed', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', padding: '44px 30px' }}>
      <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{titulo}</div>
      {sub && <p style={{ margin: 0, fontSize: 14, color: 'var(--dim)', lineHeight: 1.55, maxWidth: 480 }}>{sub}</p>}
      {children}
    </div>
  );
}

