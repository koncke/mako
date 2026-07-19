// =============================================================================
// Visual — biblioteca de gráficos SVG para las landings de feature (/vsl/<slug>).
// =============================================================================
// Mockups de producto abstractos, con TEXTO MÍNIMO (explican gráficamente) y
// MOVIMIENTO (animaciones SMIL). Server component puro. Sin datos de ejemplo
// hardcodeados que se filtren a otra feature: si un campo no viene, no se pinta.
// Dispatcher <Visual spec={{type,...params}} />. Specs en ./feature-visuals.ts.

import { VisualChart } from './VisualCharts';
import { VisualCanvas } from './VisualCanvas';

export type VisualSpec = { type: string; [k: string]: unknown };

const BLUE = '#2F6FED';
const INK = '#12151B';
const DIM = '#6B7280';
const RED = '#DC2626';
const AMBER = '#E0890C';
const GREEN = '#1E9E57';
const VIOLET = '#7C5CF0';
const TILE = '#EAF1FE';
const LINE = '#E4E9F2';
const SANS = 'Geist, system-ui, sans-serif';
const MONO = 'Geist Mono, ui-monospace, monospace';

const S = (v: unknown, d = ''): string => (typeof v === 'string' && v ? v : d);
const N = (v: unknown, d = 0): number => (typeof v === 'number' ? v : d);
const A = <T,>(v: unknown, d: T[]): T[] => (Array.isArray(v) && v.length ? (v as T[]) : d);
const clip = (v: unknown, n: number): string => { const s = String(v ?? ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const tone = (t: unknown): string => { const x = String(t || ''); return x === 'red' ? RED : x === 'amber' ? AMBER : x === 'green' ? GREEN : x === 'violet' ? VIOLET : BLUE; };

function Frame({ children }: { children: React.ReactNode }) {
  return <svg viewBox="0 0 400 300" width="100%" role="img" style={{ display: 'block', borderRadius: 14 }}>{children}</svg>;
}
function Title({ children }: { children: string }) {
  if (!children) return null;
  return <text x="24" y="30" fontSize="11.5" fontWeight="700" fill={INK} fontFamily={SANS}>{clip(children, 40)}</text>;
}
function Chrome({ title }: { title?: string }) {
  return (
    <g>
      <circle cx="20" cy="20" r="4" fill="#E2707A" /><circle cx="34" cy="20" r="4" fill="#EEC15A" /><circle cx="48" cy="20" r="4" fill="#7FCF9E" />
      {title ? <text x="200" y="24" textAnchor="middle" fontSize="11" fontWeight="600" fill={DIM} fontFamily={SANS}>{clip(title, 28)}</text> : null}
    </g>
  );
}
// ── 1. Funnel (etapas con caída, dot que fluye) ─────────────────────────────
function Funnel(s: VisualSpec) {
  const stages = A<{ label: string; w: number; tone?: string }>(s.stages, [{ label: 'Leads', w: 1 }, { label: 'Agenda', w: 0.6 }, { label: 'Cierre', w: 0.28 }]).slice(0, 6);
  const H = 30, gap = 10, top = 50;
  const total = stages.length * (H + gap);
  return (
    <Frame>
      <Title>{S(s.title, 'Tu embudo')}</Title>
      {stages.map((st, i) => {
        const w = 300 * Math.max(0.12, st.w), x = 200 - w / 2, y = top + i * (H + gap);
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={H} rx="7" fill={i === stages.length - 1 ? BLUE : i % 2 ? '#DBE7FD' : TILE} stroke={LINE}>
              <animate attributeName="width" from="0" to={w} dur="0.7s" begin={`${i * 0.12}s`} fill="freeze" />
              <animate attributeName="x" from="200" to={x} dur="0.7s" begin={`${i * 0.12}s`} fill="freeze" />
            </rect>
            <text x="200" y={y + 20} textAnchor="middle" fontSize="12" fontWeight="600" fill={i === stages.length - 1 ? '#fff' : INK} fontFamily={SANS} opacity="0">
              {clip(st.label, 22)}<animate attributeName="opacity" from="0" to="1" dur="0.4s" begin={`${0.4 + i * 0.12}s`} fill="freeze" /></text>
          </g>
        );
      })}
      <circle cx="34" cy={top} r="4" fill={BLUE}>
        <animate attributeName="cy" values={`${top};${top + total - gap - 12}`} dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0" dur="2.4s" repeatCount="indefinite" />
      </circle>
    </Frame>
  );
}

// ── 2. StatTiles (cifras grandes; rows solo si vienen) ──────────────────────
function StatTiles(s: VisualSpec) {
  const tiles = A<{ label: string; value: string; tone?: string }>(s.tiles, [{ label: '—', value: '—' }]).slice(0, 3);
  const rows = A<{ name: string; amount: string; tone?: string }>(s.rows, []).slice(0, 2);
  const w = (352 - (tiles.length - 1) * 12) / tiles.length;
  return (
    <Frame>
      <Title>{S(s.title)}</Title>
      {tiles.map((t, i) => {
        const c = tone(t.tone), x = 24 + i * (w + 12), y = s.title ? 48 : 60;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height="112" rx="12" fill="#fff" stroke={LINE} />
            <rect x={x} y={y} width={w} height="4" rx="2" fill={c}><animate attributeName="width" from="0" to={w} dur="0.6s" begin={`${i * 0.12}s`} fill="freeze" /></rect>
            <text x={x + w / 2} y={y + 62} textAnchor="middle" fontSize="29" fontWeight="700" fill={c} fontFamily={SANS} opacity="0">{clip(t.value, 9)}
              <animate attributeName="opacity" from="0" to="1" dur="0.5s" begin={`${0.2 + i * 0.12}s`} fill="freeze" /></text>
            <text x={x + w / 2} y={y + 86} textAnchor="middle" fontSize="11.5" fontWeight="500" fill={DIM} fontFamily={SANS}>{clip(t.label, 16)}</text>
          </g>
        );
      })}
      {rows.map((r, i) => (
        <g key={i}>
          <rect x="24" y={180 + i * 32} width="352" height="26" rx="7" fill="#FBFCFE" stroke={LINE} />
          <circle cx="38" cy={193 + i * 32} r="4" fill={tone(r.tone)} />
          <text x="52" y={197 + i * 32} fontSize="11.5" fill={INK} fontFamily={SANS}>{clip(r.name, 26)}</text>
          <text x="368" y={197 + i * 32} textAnchor="end" fontSize="11.5" fontWeight="700" fill={tone(r.tone)} fontFamily={MONO}>{clip(r.amount, 9)}</text>
        </g>
      ))}
    </Frame>
  );
}

// ── 3. Semaphore (3 luces, verdicto corto) ──────────────────────────────────
function Semaphore(s: VisualSpec) {
  const lit = S(s.lit, 'red');
  const verdict = clip(S(s.verdict, ''), 46);
  const lights: Array<[string, string]> = [['red', RED], ['amber', AMBER], ['green', GREEN]];
  return (
    <Frame>
      <rect x="152" y="26" width="96" height="192" rx="20" fill="#1B2130" />
      {lights.map(([k, c], i) => (
        <circle key={k} cx="200" cy={66 + i * 58} r="25" fill={lit === k ? c : '#2E3648'} opacity={lit === k ? 1 : 0.45}>
          {lit === k && <animate attributeName="opacity" values="1;.5;1" dur="1.6s" repeatCount="indefinite" />}
        </circle>
      ))}
      {verdict ? <><rect x="24" y="244" width="352" height="34" rx="9" fill={lit === 'green' ? '#EAF7EE' : lit === 'amber' ? '#FCF3E2' : '#FDECEC'} stroke={lit === 'green' ? '#B7E0C5' : lit === 'amber' ? '#F1DDB0' : '#F6C9C9'} />
        <text x="200" y="265" textAnchor="middle" fontSize="12" fontWeight="600" fill={lit === 'green' ? '#166a38' : lit === 'amber' ? '#8a5a06' : '#A11'} fontFamily={SANS}>{verdict}</text></> : null}
    </Frame>
  );
}

// ── 4. ChatThread (burbujas que aparecen) ───────────────────────────────────
function ChatThread(s: VisualSpec) {
  const msgs = A<{ from: 'in' | 'out'; text: string; voice?: boolean }>(s.msgs, []).slice(0, 5);
  const H = 32, GAP = 12;
  return (
    <Frame>
      <rect x="0" y="0" width="400" height="300" fill="#E7DED4" />
      <rect x="0" y="0" width="400" height="32" fill="#F0EAE1" />
      <text x="16" y="21" fontSize="12" fontWeight="700" fill={INK} fontFamily={SANS}>{clip(S(s.title, 'Chat'), 34)}</text>
      {msgs.map((m, i) => {
        const out = m.from === 'out', txt = clip(m.text, 30), w = Math.min(300, 34 + txt.length * 6.6), x = out ? 384 - w : 16, y = 46 + i * (H + GAP);
        return (
          <g key={i} opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.35s" begin={`${i * 0.5}s`} fill="freeze" />
            <rect x={x} y={y} width={w} height={H} rx="9" fill={out ? '#DCF8C6' : '#fff'} />
            {m.voice ? <path d={`M${x + 12} ${y + 16}h2v-6h-2zm5 0h2v-11h-2zm5 0h2v-3h-2z`} fill={BLUE} /> : null}
            <text x={x + (m.voice ? 32 : 12)} y={y + 20} fontSize="11.5" fill={INK} fontFamily={SANS}>{txt}</text>
          </g>
        );
      })}
    </Frame>
  );
}

// ── 5. BarChart (barras que crecen) ─────────────────────────────────────────
function BarChart(s: VisualSpec) {
  const bars = A<{ label: string; v: number; tone?: string }>(s.bars, [{ label: 'A', v: 0.5 }, { label: 'B', v: 0.8, tone: 'green' }, { label: 'C', v: 0.4 }]).slice(0, 6);
  const bw = (352 - (bars.length - 1) * 16) / bars.length, base = 232;
  return (
    <Frame>
      <Title>{S(s.title)}</Title>
      <line x1="24" y1={base} x2="376" y2={base} stroke={LINE} />
      {bars.map((b, i) => {
        const h = 150 * Math.max(0.05, Math.min(1, b.v)), x = 24 + i * (bw + 16), c = tone(b.tone);
        return (
          <g key={i}>
            <rect x={x} y={base - h} width={bw} height={h} rx="5" fill={c} opacity={b.tone ? 1 : 0.82}>
              <animate attributeName="height" from="0" to={h} dur="0.7s" begin={`${i * 0.1}s`} fill="freeze" />
              <animate attributeName="y" from={base} to={base - h} dur="0.7s" begin={`${i * 0.1}s`} fill="freeze" />
            </rect>
            <text x={x + bw / 2} y={base + 18} textAnchor="middle" fontSize="10.5" fill={DIM} fontFamily={SANS}>{clip(b.label, 10)}</text>
          </g>
        );
      })}
    </Frame>
  );
}

// ── 6. RetentionCurve (línea que se dibuja + caída marcada) ─────────────────
function RetentionCurve(s: VisualSpec) {
  const pts = A<number>(s.points, [1, 0.82, 0.55, 0.5, 0.42, 0.3, 0.26]);
  const drop = Math.min(pts.length - 1, N(s.dropIndex, 2));
  const W = 352, Hh = 150, x0 = 24, y0 = 44;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x0 + (W * i) / (pts.length - 1)},${y0 + Hh * (1 - Math.max(0, Math.min(1, p)))}`).join(' ');
  const dx = x0 + (W * drop) / (pts.length - 1), dy = y0 + Hh * (1 - pts[drop]);
  return (
    <Frame>
      <Title>{S(s.title, 'Retención del VSL')}</Title>
      <path d={`${path} L${x0 + W},${y0 + Hh} L${x0},${y0 + Hh} Z`} fill="rgba(47,111,237,.10)" />
      <path d={path} fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="600" strokeDashoffset="600"><animate attributeName="stroke-dashoffset" from="600" to="0" dur="1.2s" fill="freeze" /></path>
      <line x1={dx} y1={y0} x2={dx} y2={y0 + Hh} stroke={RED} strokeWidth="1.5" strokeDasharray="4 3" />
      <circle cx={dx} cy={dy} r="5" fill={RED}><animate attributeName="r" values="5;8;5" dur="1.6s" repeatCount="indefinite" /></circle>
      <text x={dx + 8} y={dy - 8} fontSize="10.5" fontWeight="700" fill={RED} fontFamily={SANS}>se cae acá</text>
      <text x={x0} y={y0 + Hh + 22} fontSize="10" fill={DIM} fontFamily={SANS}>0:00</text>
      <text x={x0 + W} y={y0 + Hh + 22} textAnchor="end" fontSize="10" fill={DIM} fontFamily={SANS}>fin</text>
    </Frame>
  );
}

// ── 7. Kanban (columnas, cards que entran) ──────────────────────────────────
function Kanban(s: VisualSpec) {
  const cols = A<{ label: string; cards: number; tone?: string }>(s.cols, [{ label: 'A', cards: 2 }, { label: 'B', cards: 3 }, { label: 'C', cards: 1 }]).slice(0, 3);
  const cw = (352 - (cols.length - 1) * 12) / cols.length;
  return (
    <Frame>
      <Chrome title="CRM" />
      {cols.map((c, i) => {
        const x = 24 + i * (cw + 12), col = tone(c.tone), nc = Math.min(4, Math.max(0, c.cards | 0));
        return (
          <g key={i}>
            <rect x={x} y="44" width={cw} height="240" rx="10" fill="#FBFCFE" stroke={LINE} />
            <rect x={x + 12} y="56" width={cw - 24} height="6" rx="3" fill={col} />
            <text x={x + cw / 2} y="82" textAnchor="middle" fontSize="10.5" fontWeight="600" fill={INK} fontFamily={SANS}>{clip(c.label, 14)}</text>
            {Array.from({ length: nc }).map((_, k) => (
              <rect key={k} x={x + 12} y={94 + k * 40} width={cw - 24} height="32" rx="7" fill="#fff" stroke={LINE} opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={`${0.2 + (i + k) * 0.12}s`} fill="freeze" /></rect>
            ))}
          </g>
        );
      })}
    </Frame>
  );
}

// ── 8. DiffCard (antes→abajo después, sin encimar) ──────────────────────────
function DiffCard(s: VisualSpec) {
  const rows = A<{ field: string; before: string; after: string }>(s.rows, []).slice(0, 3);
  const title = clip(S(s.title, 'Antes → después'), 28);
  return (
    <Frame>
      <rect x="34" y="30" width="332" height="210" rx="14" fill="#fff" stroke={LINE} />
      <rect x="34" y="30" width="332" height="40" rx="14" fill={TILE} />
      <circle cx="58" cy="50" r="9" fill={BLUE} /><path d="M53 50l3 3l6 -6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="74" y="55" fontSize="12.5" fontWeight="700" fill={INK} fontFamily={SANS}>{title}</text>
      {rows.map((r, i) => {
        const y = 90 + i * 46;
        return (
          <g key={i} fontFamily={SANS}>
            <text x="58" y={y} fontSize="10.5" fill={DIM}>{clip(r.field, 22)}</text>
            <text x="58" y={y + 18} fontSize="12" fill="#9AA3B2" textDecoration="line-through">{clip(r.before, 16)}</text>
            <text x="180" y={y + 18} fontSize="12" fill={BLUE}>→</text>
            <text x="196" y={y + 18} fontSize="12" fontWeight="700" fill={INK}>{clip(r.after, 18)}</text>
          </g>
        );
      })}
    </Frame>
  );
}

// ── 9. Pyramid (Alta/Media/Baja, barras que crecen) ─────────────────────────
function Pyramid(s: VisualSpec) {
  const tiers = A<{ label: string; tone: string }>(s.tiers, [{ label: 'Alta', tone: 'red' }, { label: 'Media', tone: 'amber' }, { label: 'Baja', tone: 'green' }]).slice(0, 3);
  return (
    <Frame>
      <Title>{S(s.title)}</Title>
      {tiers.map((t, i) => {
        const w = 120 + i * 100, x = 200 - w / 2, y = (s.title ? 56 : 44) + i * 66, c = tone(t.tone);
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height="52" rx="9" fill={c} opacity={0.92 - i * 0.16}>
              <animate attributeName="width" from="0" to={w} dur="0.6s" begin={`${i * 0.12}s`} fill="freeze" /><animate attributeName="x" from="200" to={x} dur="0.6s" begin={`${i * 0.12}s`} fill="freeze" /></rect>
            <text x="200" y={y + 32} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily={SANS} opacity="0">{clip(t.label, 26)}<animate attributeName="opacity" from="0" to="1" dur="0.4s" begin={`${0.3 + i * 0.12}s`} fill="freeze" /></text>
          </g>
        );
      })}
    </Frame>
  );
}

// ── 10. Gauge (arco que barre) ──────────────────────────────────────────────
function Gauge(s: VisualSpec) {
  const val = Math.max(0.02, Math.min(1, N(s.value, 0.68)));
  const c = tone(S(s.tone, val > 0.66 ? 'green' : val > 0.4 ? 'amber' : 'red'));
  const cx = 200, cy = 196, r = 100, circ = Math.PI * r;
  const ex = cx + r * Math.cos(Math.PI * (1 - val)), ey = cy - r * Math.sin(Math.PI * (1 - val));
  return (
    <Frame>
      <path d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} fill="none" stroke={LINE} strokeWidth="16" strokeLinecap="round" />
      <path d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${ex},${ey}`} fill="none" stroke={c} strokeWidth="16" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ}><animate attributeName="stroke-dashoffset" from={circ} to={circ * (1 - val)} dur="1s" fill="freeze" /></path>
      <text x={cx} y={cy - 16} textAnchor="middle" fontSize="46" fontWeight="700" fill={c} fontFamily={SANS}>{clip(S(s.big, String(Math.round(val * 100))), 6)}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="13" fontWeight="500" fill={DIM} fontFamily={SANS}>{clip(S(s.label, ''), 22)}</text>
    </Frame>
  );
}

// ── 11. ByokKey (key → cuenta reconocida) ───────────────────────────────────
function ByokKey(s: VisualSpec) {
  return (
    <Frame>
      <rect x="40" y="58" width="320" height="44" rx="10" fill="#fff" stroke={LINE} />
      <text x="58" y="85" fontSize="12" fill="#9AA3B2" fontFamily={MONO}>EAAB••••••••3f9</text>
      <path d="M330 78 a7 7 0 1 0 0 .1M336 84l6 6" stroke={AMBER} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <text x="200" y="138" textAnchor="middle" fontSize="20" fill={DIM}>↓</text>
      <rect x="40" y="156" width="320" height="70" rx="12" fill="#EAF7EE" stroke="#B7E0C5" />
      <circle cx="72" cy="191" r="15" fill={GREEN} /><path d="M65 191l5 5l9 -9" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round"><animate attributeName="stroke-dashoffset" from="30" to="0" dur="0.5s" begin="0.4s" fill="freeze" /><set attributeName="stroke-dasharray" to="30" /></path>
      <text x="98" y="186" fontSize="11" fill={DIM} fontFamily={SANS}>Reconocimos tu cuenta</text>
      <text x="98" y="206" fontSize="14" fontWeight="700" fill={INK} fontFamily={SANS}>{clip(S(s.account, 'Tu cuenta'), 26)}</text>
    </Frame>
  );
}

// ── 12. RoleMatrix (roles × herramientas) ───────────────────────────────────
function RoleMatrix(s: VisualSpec) {
  const roles = A<string>(s.roles, ['A', 'B']).slice(0, 3);
  const tools = A<{ tool: string; on: boolean[] }>(s.tools, []).slice(0, 4);
  const x0 = 168, cw = (376 - x0) / roles.length;
  return (
    <Frame>
      <Chrome title="Roles" />
      {roles.map((r, i) => <text key={i} x={x0 + cw / 2 + i * cw} y="62" textAnchor="middle" fontSize="12" fontWeight="700" fill={INK} fontFamily={SANS}>{clip(r, 12)}</text>)}
      {tools.map((t, ri) => (
        <g key={ri} fontFamily={SANS}>
          <rect x="24" y={74 + ri * 46} width="352" height="40" rx="8" fill={ri % 2 ? '#FBFCFE' : '#fff'} stroke={LINE} />
          <text x="40" y={99 + ri * 46} fontSize="12" fill={INK}>{clip(t.tool, 20)}</text>
          {roles.map((_, ci) => (
            <g key={ci} transform={`translate(${x0 + cw / 2 + ci * cw}, ${94 + ri * 46})`}>
              {t.on && t.on[ci] ? <><circle r="10" fill="#EAF7EE" /><path d="M-4 0l3 3l6 -6" stroke={GREEN} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>
                : <><circle r="10" fill="#F4F5F7" /><path d="M-3.5 -3.5l7 7M3.5 -3.5l-7 7" stroke="#B6BCC7" strokeWidth="2" strokeLinecap="round" /></>}
            </g>
          ))}
        </g>
      ))}
    </Frame>
  );
}

// ── 13. PhaseLadder (5 fases, actual pulsa) ─────────────────────────────────
function PhaseLadder(s: VisualSpec) {
  const phases = A<string>(s.phases, ['1', '2', '3', '4', '5']).slice(0, 5);
  const cur = Math.min(phases.length - 1, N(s.current, 1));
  return (
    <Frame>
      <Title>{S(s.title, 'Tu fase')}</Title>
      {phases.map((p, i) => {
        const y = 248 - i * 42, active = i === cur, done = i < cur, c = active ? BLUE : done ? '#B9CDF3' : '#E4E9F2';
        return (
          <g key={i} fontFamily={SANS}>
            <rect x="24" y={y} width={96 + i * 44} height="32" rx="8" fill={active ? TILE : '#FBFCFE'} stroke={active ? BLUE : LINE} strokeWidth={active ? 2 : 1} />
            <circle cx="42" cy={y + 16} r="7" fill={c}>{active && <animate attributeName="opacity" values="1;.4;1" dur="1.6s" repeatCount="indefinite" />}</circle>
            <text x="58" y={y + 20} fontSize="11.5" fontWeight={active ? 700 : 500} fill={active ? INK : DIM}>{clip(p, 15)}</text>
            {active ? <text x={136 + i * 44} y={y + 20} fontSize="11" fontWeight="700" fill={BLUE}>← acá</text> : null}
          </g>
        );
      })}
    </Frame>
  );
}

// ── 14. DocExtract (PDF → campos que aparecen) ──────────────────────────────
function DocExtract(s: VisualSpec) {
  const fields = A<{ k: string; v: string }>(s.fields, []).slice(0, 3);
  return (
    <Frame>
      <rect x="34" y="70" width="120" height="150" rx="8" fill="#fff" stroke={LINE} /><path d="M134 70 l20 20 h-20 z" fill="#E9EDF4" />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x="48" y={94 + i * 20} width={i === 4 ? 50 : 92} height="6" rx="3" fill="#E4E9F2" />)}
      <text x="94" y="240" textAnchor="middle" fontSize="10.5" fill={DIM} fontFamily={SANS}>{clip(S(s.doc, 'contrato.pdf'), 16)}</text>
      <text x="182" y="150" fontSize="20" fill={BLUE}>→</text>
      {fields.map((f, i) => (
        <g key={i} fontFamily={SANS} opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.4s" begin={`${0.5 + i * 0.25}s`} fill="freeze" />
          <rect x="210" y={80 + i * 46} width="156" height="36" rx="8" fill="#EAF7EE" stroke="#B7E0C5" />
          <text x="224" y={102 + i * 46} fontSize="10.5" fill={DIM}>{clip(f.k, 14)}</text>
          <text x="352" y={102 + i * 46} textAnchor="end" fontSize="12.5" fontWeight="700" fill={INK}>{clip(f.v, 14)}</text>
        </g>
      ))}
    </Frame>
  );
}

// ── 15. SignalFlow (A→B→C con dash que fluye) ───────────────────────────────
function SignalFlow(s: VisualSpec) {
  const nodes = A<{ label: string; sub?: string; tone?: string }>(s.nodes, [{ label: 'A' }, { label: 'B' }, { label: 'C', tone: 'green' }]).slice(0, 3);
  const bw = 100, y = 118, gap = (352 - nodes.length * bw) / Math.max(1, nodes.length - 1);
  return (
    <Frame>
      <Title>{S(s.title, 'Señal a Meta')}</Title>
      {nodes.map((n, i) => {
        const x = 24 + i * (bw + gap), c = tone(n.tone);
        return (
          <g key={i} fontFamily={SANS}>
            {i < nodes.length - 1 ? <line x1={x + bw} y1={y + 32} x2={x + bw + gap} y2={y + 32} stroke={c} strokeWidth="2" strokeDasharray="5 4"><animate attributeName="stroke-dashoffset" from="18" to="0" dur="0.8s" repeatCount="indefinite" /></line> : null}
            <rect x={x} y={y} width={bw} height="64" rx="12" fill="#fff" stroke={c} strokeWidth="1.5" />
            <text x={x + bw / 2} y={y + (n.sub ? 30 : 38)} textAnchor="middle" fontSize="13" fontWeight="700" fill={c}>{clip(n.label, 13)}</text>
            {n.sub ? <text x={x + bw / 2} y={y + 48} textAnchor="middle" fontSize="9.5" fill={DIM}>{clip(n.sub, 16)}</text> : null}
          </g>
        );
      })}
    </Frame>
  );
}

// ── 16. ScoreCard (barras de puntaje que crecen) ────────────────────────────
function ScoreCard(s: VisualSpec) {
  const items = A<{ label: string; v: number }>(s.items, [{ label: '—', v: 0.5 }]).slice(0, 5);
  return (
    <Frame>
      <Chrome title={S(s.chrome, 'Score')} />
      <Title>{S(s.title)}</Title>
      {items.map((it, i) => {
        const y = (s.title ? 56 : 50) + i * 40, w = 190 * Math.max(0.04, Math.min(1, it.v)), c = it.v > 0.66 ? GREEN : it.v > 0.45 ? AMBER : RED;
        return (
          <g key={i} fontFamily={SANS}>
            <text x="24" y={y + 14} fontSize="11.5" fill={INK}>{clip(it.label, 20)}</text>
            <rect x="160" y={y + 3} width="190" height="14" rx="7" fill="#EEF1F6" />
            <rect x="160" y={y + 3} width={w} height="14" rx="7" fill={c}><animate attributeName="width" from="0" to={w} dur="0.7s" begin={`${i * 0.1}s`} fill="freeze" /></rect>
            <text x="360" y={y + 14} textAnchor="end" fontSize="11" fontWeight="700" fill={DIM} fontFamily={MONO}>{Math.round(it.v * 10)}</text>
          </g>
        );
      })}
    </Frame>
  );
}

// ── 17. EmailSequence (timeline vertical) ───────────────────────────────────
function EmailSequence(s: VisualSpec) {
  const steps = A<{ day: string; subject: string }>(s.steps, []).slice(0, 4);
  return (
    <Frame>
      <Title>{S(s.title, 'Secuencia')}</Title>
      <line x1="42" y1="58" x2="42" y2={58 + (steps.length - 1) * 58} stroke={LINE} strokeWidth="2" />
      {steps.map((st, i) => {
        const y = 50 + i * 58;
        return (
          <g key={i} fontFamily={SANS} opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.35s" begin={`${i * 0.3}s`} fill="freeze" />
            <circle cx="42" cy={y + 18} r="7" fill={BLUE} />
            <rect x="64" y={y} width="308" height="40" rx="10" fill="#fff" stroke={LINE} />
            <text x="80" y={y + 18} fontSize="10.5" fontWeight="700" fill={BLUE}>{clip(st.day, 12)}</text>
            <text x="80" y={y + 33} fontSize="11.5" fill={INK}>✉ {clip(st.subject, 40)}</text>
          </g>
        );
      })}
    </Frame>
  );
}

// ── 18. Stamp (antes/después con valores CORTOS + sello) ────────────────────
function Stamp(s: VisualSpec) {
  const ok = s.result !== 'refuted';
  const label = S(s.label, ok ? 'VALIDADA' : 'REFUTADA');
  const c = ok ? GREEN : RED;
  return (
    <Frame>
      <Title>{S(s.title, 'Hipótesis medida')}</Title>
      <rect x="24" y="52" width="160" height="92" rx="12" fill="#FBFCFE" stroke={LINE} />
      <text x="104" y="82" textAnchor="middle" fontSize="11" fill={DIM} fontFamily={SANS}>antes</text>
      <text x="104" y="118" textAnchor="middle" fontSize="26" fontWeight="700" fill={DIM} fontFamily={SANS}>{clip(S(s.before, '—'), 8)}</text>
      <rect x="216" y="52" width="160" height="92" rx="12" fill={ok ? '#EAF7EE' : '#FDECEC'} stroke={ok ? '#B7E0C5' : '#F6C9C9'} />
      <text x="296" y="82" textAnchor="middle" fontSize="11" fill={DIM} fontFamily={SANS}>después</text>
      <text x="296" y="118" textAnchor="middle" fontSize="26" fontWeight="700" fill={c} fontFamily={SANS}>{clip(S(s.after, '—'), 8)}</text>
      <g transform="translate(200,214) rotate(-9)" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="0.7s" fill="freeze" />
        <animateTransform attributeName="transform" type="scale" values="1.6;1" dur="0.35s" begin="0.7s" additive="sum" fill="freeze" />
        <rect x="-96" y="-27" width="192" height="54" rx="10" fill="none" stroke={c} strokeWidth="3" />
        <text x="0" y="9" textAnchor="middle" fontSize="25" fontWeight="800" fill={c} fontFamily={SANS} letterSpacing="2">{clip(label, 12)}</text>
      </g>
    </Frame>
  );
}

// ── 19. SplitLoad (form | datos que se cargan con check) ────────────────────
function SplitLoad(s: VisualSpec) {
  const items = A<string>(s.loading, []).slice(0, 4);
  return (
    <Frame>
      <rect x="0" y="0" width="196" height="300" fill="#FBFCFE" />
      <text x="24" y="38" fontSize="11.5" fontWeight="700" fill={INK} fontFamily={SANS}>{clip(S(s.left, 'Contestás'), 20)}</text>
      {[0, 1, 2].map((i) => (<g key={i}><rect x="24" y={58 + i * 46} width="148" height="34" rx="8" fill="#fff" stroke={LINE} /><rect x="34" y={71 + i * 46} width={90 - i * 18} height="8" rx="4" fill="#E4E9F2" /></g>))}
      <line x1="200" y1="0" x2="200" y2="300" stroke={LINE} strokeDasharray="4 4" />
      <text x="224" y="38" fontSize="11.5" fontWeight="700" fill={BLUE} fontFamily={SANS}>{clip(S(s.right, 'Se cargan solos'), 24)}</text>
      {items.map((it, i) => (
        <g key={i} fontFamily={SANS} opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.35s" begin={`${0.3 + i * 0.4}s`} fill="freeze" />
          <rect x="224" y={54 + i * 46} width="152" height="36" rx="8" fill={TILE} />
          <circle cx="242" cy={72 + i * 46} r="7" fill={GREEN} /><path d={`M237 ${72 + i * 46}l3.5 3.5l7 -7`} stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text x="258" y={76 + i * 46} fontSize="10.5" fill={INK}>{clip(it, 22)}</text>
        </g>
      ))}
    </Frame>
  );
}

// ── 20. AlertCard (aviso WhatsApp; texto envuelve) ──────────────────────────
function AlertCard(s: VisualSpec) {
  const text = clip(S(s.text, 'Algo urgente necesita tu atención.'), 120);
  return (
    <Frame>
      <rect x="0" y="0" width="400" height="300" fill="#E7DED4" />
      <rect x="30" y="76" width="340" height="150" rx="16" fill="#fff" />
      <rect x="30" y="76" width="340" height="44" rx="16" fill="#FDECEC" />
      <circle cx="56" cy="98" r="9" fill={RED}><animate attributeName="opacity" values="1;.4;1" dur="1.4s" repeatCount="indefinite" /></circle>
      <text x="52" y="103" fontSize="12" fontWeight="800" fill="#fff">!</text>
      <text x="74" y="103" fontSize="12.5" fontWeight="700" fill="#A11" fontFamily={SANS}>MaKo · alerta</text>
      <foreignObject x="50" y="132" width="300" height="86"><div style={{ fontSize: 13, lineHeight: 1.4, color: INK, fontFamily: SANS }}>{text}</div></foreignObject>
    </Frame>
  );
}

// ── 21. DashboardMock (gráfico que se dibuja + botón MaKo) ───────────────────
function DashboardMock(s: VisualSpec) {
  const pts = A<number>(s.points, [0.3, 0.5, 0.42, 0.66, 0.6, 0.82]);
  const kpis = A<{ v: string; k: string }>(s.kpis, [{ v: '2.1%', k: 'CTR' }, { v: '$14', k: 'CPL' }, { v: '31%', k: 'Cierre' }]).slice(0, 3);
  const W = 352, Hh = 118, x0 = 24, y0 = 48;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x0 + (W * i) / (pts.length - 1)},${y0 + Hh * (1 - Math.max(0, Math.min(1, p)))}`).join(' ');
  return (
    <Frame>
      <Chrome title={S(s.title, 'Dashboard')} />
      <path d={`${path} L${x0 + W},${y0 + Hh} L${x0},${y0 + Hh} Z`} fill="rgba(47,111,237,.10)" />
      <path d={path} fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="600" strokeDashoffset="600"><animate attributeName="stroke-dashoffset" from="600" to="0" dur="1.2s" fill="freeze" /></path>
      {kpis.map((kp, i) => (<g key={i}><rect x={24 + i * 120} y="196" width="108" height="56" rx="10" fill="#FBFCFE" stroke={LINE} />
        <text x={78 + i * 120} y="226" textAnchor="middle" fontSize="19" fontWeight="700" fill={INK} fontFamily={SANS}>{clip(kp.v, 7)}</text>
        <text x={78 + i * 120} y="242" textAnchor="middle" fontSize="9.5" fill={DIM} fontFamily={SANS}>{clip(kp.k, 10)}</text></g>))}
      <g transform="translate(300,42)"><rect x="0" y="0" width="76" height="26" rx="13" fill={INK} /><text x="38" y="17" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#fff" fontFamily={SANS}>✦ MaKo</text></g>
    </Frame>
  );
}

// ── 22. RagIndex (doc → embeddings que laten) ───────────────────────────────
function RagIndex(s: VisualSpec) {
  return (
    <Frame>
      <Title>{S(s.title, 'Tu método, indexado')}</Title>
      <rect x="30" y="120" width="80" height="60" rx="10" fill="#fff" stroke={LINE} /><text x="70" y="156" textAnchor="middle" fontSize="20">🎬</text><text x="70" y="196" textAnchor="middle" fontSize="9.5" fill={DIM} fontFamily={SANS}>{clip(S(s.source, 'tu clase'), 14)}</text>
      <text x="126" y="155" fontSize="16" fill={BLUE}>→</text>
      <rect x="150" y="126" width="90" height="48" rx="10" fill={TILE} /><text x="195" y="155" textAnchor="middle" fontSize="10.5" fill={BLUE} fontFamily={SANS}>transcribe</text>
      <text x="252" y="155" fontSize="16" fill={BLUE}>→</text>
      {Array.from({ length: 9 }).map((_, i) => (<circle key={i} cx={286 + (i % 3) * 30} cy={126 + Math.floor(i / 3) * 30} r="9" fill={i === 4 ? VIOLET : '#C9D8F6'}><animate attributeName="opacity" values="1;.4;1" dur="2s" begin={`${i * 0.15}s`} repeatCount="indefinite" /></circle>))}
      <text x="316" y="216" textAnchor="middle" fontSize="9.5" fill={DIM} fontFamily={SANS}>embeddings</text>
    </Frame>
  );
}

// ── 23. AdRow (filas de anuncio con cash real) ──────────────────────────────
function AdRow(s: VisualSpec) {
  const rows = A<{ name: string; cash: string; roas: string; tone?: string }>(s.rows, []).slice(0, 3);
  return (
    <Frame>
      <Chrome title="Ads Manager" />
      <g fontFamily={SANS} fontSize="10" fill={DIM}><text x="40" y="62">Anuncio</text><text x="250" y="62">Cash</text><text x="336" y="62">ROAS</text></g>
      {rows.map((r, i) => (
        <g key={i} fontFamily={SANS}>
          <rect x="24" y={72 + i * 46} width="352" height="40" rx="8" fill={i % 2 ? '#FBFCFE' : '#fff'} stroke={LINE} />
          <text x="40" y={97 + i * 46} fontSize="11.5" fill={INK}>{clip(r.name, 26)}</text>
          <text x="250" y={97 + i * 46} fontSize="12" fontWeight="700" fill={INK} fontFamily={MONO}>{clip(r.cash, 8)}</text>
          <text x="336" y={97 + i * 46} fontSize="12" fontWeight="700" fill={tone(r.tone || 'green')} fontFamily={MONO}>{clip(r.roas, 6)}</text>
        </g>
      ))}
    </Frame>
  );
}

// ── 24. ThesisCard (6 tabs → tesis + fuga + plan) ───────────────────────────
function ThesisCard(s: VisualSpec) {
  const tabs = A<string>(s.tabs, []).slice(0, 6);
  return (
    <Frame>
      <g fontFamily={SANS}>{tabs.map((t, i) => (<g key={i}><rect x={24 + (i % 3) * 84} y={24 + Math.floor(i / 3) * 30} width="76" height="24" rx="6" fill={TILE} /><text x={62 + (i % 3) * 84} y={40 + Math.floor(i / 3) * 30} textAnchor="middle" fontSize="10" fill={BLUE}>{clip(t, 11)}</text></g>))}</g>
      <text x="200" y="106" textAnchor="middle" fontSize="13" fill={BLUE}>↓ una tesis</text>
      <rect x="24" y="120" width="352" height="122" rx="14" fill="#fff" stroke={LINE} />
      <text x="40" y="148" fontSize="12.5" fontWeight="700" fill={INK} fontFamily={SANS}>{clip(S(s.thesis, 'Tu cuello está entre R1 y R2'), 44)}</text>
      <rect x="40" y="162" width="150" height="62" rx="10" fill="#FDECEC" />
      <text x="56" y="184" fontSize="10.5" fill={DIM} fontFamily={SANS}>Fuga principal</text>
      <text x="56" y="210" fontSize="23" fontWeight="700" fill={RED} fontFamily={SANS}>{clip(S(s.leak, '$0'), 10)}</text>
      <rect x="206" y="162" width="150" height="62" rx="10" fill="#EAF7EE" />
      <text x="222" y="184" fontSize="10.5" fill={DIM} fontFamily={SANS}>Plan auto-creado</text>
      <text x="222" y="210" fontSize="13" fontWeight="700" fill={GREEN} fontFamily={SANS}>{clip(S(s.plan, '2 exp · 3 tareas'), 18)}</text>
    </Frame>
  );
}

// ── 25. WaInbox (bandeja por lead + ventana 24h) ────────────────────────────
function WaInbox(s: VisualSpec) {
  const rows = A<{ name: string; stage: string; win: number }>(s.rows, []).slice(0, 4);
  return (
    <Frame>
      <Chrome title="WhatsApp" />
      {rows.map((r, i) => {
        const y = 52 + i * 58, c = r.win > 12 ? GREEN : r.win > 0 ? AMBER : RED, nm = clip(r.name, 22), st = clip(r.stage, 14);
        return (
          <g key={i} fontFamily={SANS}>
            <rect x="24" y={y} width="352" height="48" rx="10" fill="#fff" stroke={LINE} />
            <circle cx="50" cy={y + 24} r="15" fill={TILE} /><text x="50" y={y + 29} textAnchor="middle" fontSize="13" fontWeight="700" fill={BLUE}>{(nm[0] || '·').toUpperCase()}</text>
            <text x="78" y={y + 21} fontSize="12" fontWeight="600" fill={INK}>{nm}</text>
            <rect x="78" y={y + 29} width={st.length * 6.2 + 12} height="16" rx="8" fill={TILE} /><text x="85" y={y + 41} fontSize="9.5" fill={BLUE}>{st}</text>
            <text x="366" y={y + 22} textAnchor="end" fontSize="10.5" fontWeight="700" fill={c}>{r.win > 0 ? `${r.win}h` : 'cerrada'}</text>
            <text x="366" y={y + 40} textAnchor="end" fontSize="8.5" fill={DIM}>ventana 24h</text>
          </g>
        );
      })}
    </Frame>
  );
}

// ── 26. MakoAnswer (pregunta → decisión de MaKo) ────────────────────────────
function MakoAnswer(s: VisualSpec) {
  return (
    <Frame>
      <rect x="120" y="30" width="256" height="34" rx="10" fill={TILE} />
      <text x="136" y="52" fontSize="11.5" fill={INK} fontFamily={SANS}>{clip(S(s.q, '¿Qué muevo?'), 38)}</text>
      <g transform="translate(24,82)"><rect width="30" height="30" rx="9" fill={INK} /><text x="15" y="20" textAnchor="middle" fontSize="13" fill="#F2B01E">✦</text></g>
      <rect x="62" y="82" width="314" height="176" rx="14" fill="#fff" stroke={LINE} />
      <text x="80" y="110" fontSize="13" fontWeight="700" fill={INK} fontFamily={SANS}>{clip(S(s.a, 'Una decisión, no un número.'), 40)}</text>
      <foreignObject x="80" y="120" width="280" height="82"><div style={{ fontSize: 12, lineHeight: 1.45, color: DIM, fontFamily: SANS }}>{clip(S(s.detail, ''), 150)}</div></foreignObject>
      <rect x="80" y="216" width="150" height="30" rx="8" fill={BLUE} /><text x="155" y="236" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#fff" fontFamily={SANS}>Aplicá el cambio</text>
    </Frame>
  );
}

// ── Dispatcher ──────────────────────────────────────────────────────────────
const REGISTRY: Record<string, (s: VisualSpec) => React.ReactElement> = {
  funnel: Funnel, statTiles: StatTiles, semaphore: Semaphore, chatThread: ChatThread, barChart: BarChart,
  retentionCurve: RetentionCurve, kanban: Kanban, diffCard: DiffCard, pyramid: Pyramid, gauge: Gauge,
  byokKey: ByokKey, roleMatrix: RoleMatrix, phaseLadder: PhaseLadder, docExtract: DocExtract, signalFlow: SignalFlow,
  scoreCard: ScoreCard, emailSequence: EmailSequence, stamp: Stamp, splitLoad: SplitLoad, alertCard: AlertCard,
  dashboardMock: DashboardMock, ragIndex: RagIndex, adRow: AdRow, thesisCard: ThesisCard, waInbox: WaInbox, makoAnswer: MakoAnswer,
};

export const VISUAL_TYPES = Object.keys(REGISTRY);

export function Visual({ spec }: { spec: VisualSpec | undefined }) {
  if (spec && spec.type.startsWith('rc')) return <VisualChart spec={spec} />;
  if (spec && spec.type.startsWith('cx')) return <VisualCanvas type={spec.type} />;
  const render = spec && REGISTRY[spec.type];
  if (!render) return <Funnel type="funnel" />;
  return render(spec);
}
