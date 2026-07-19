// =============================================================================
// Visual — biblioteca de gráficos SVG para las landings de feature (/vsl/<slug>).
// =============================================================================
// Mockups de producto ABSTRACTOS y stylizados (no capturas): quedan limpios, no
// exponen tabs feas y se ven intencionales. Server component puro (sin hooks).
// Cada visual es parametrizable; el dispatcher <Visual> elige por `spec.type`.
// Paleta de marca: azul #2F6FED, tile #EAF1FE, ink #12151B, rojo/ámbar/verde.
//
// Los specs por feature viven en ./feature-visuals.ts (hero + uno por capacidad).

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

const S = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const N = (v: unknown, d = 0): number => (typeof v === 'number' ? v : d);
const A = <T,>(v: unknown, d: T[]): T[] => (Array.isArray(v) ? (v as T[]) : d);

// Marco SVG común (viewBox 0 0 400 300).
function Frame({ children, pad = true }: { children: React.ReactNode; pad?: boolean }) {
  return (
    <svg viewBox="0 0 400 300" width="100%" role="img" style={{ display: 'block', borderRadius: 14 }}>
      {pad && <rect x="0" y="0" width="400" height="300" fill="none" />}
      {children}
    </svg>
  );
}

const toneColor = (t: string): string =>
  t === 'red' ? RED : t === 'amber' ? AMBER : t === 'green' ? GREEN : t === 'violet' ? VIOLET : BLUE;

// ── Windows chrome (barrita de 3 puntitos, para que parezca panel de app) ──
function Chrome({ title }: { title?: string }) {
  return (
    <g>
      <circle cx="20" cy="20" r="4" fill="#E2707A" />
      <circle cx="34" cy="20" r="4" fill="#EEC15A" />
      <circle cx="48" cy="20" r="4" fill="#7FCF9E" />
      {title && <text x="200" y="24" textAnchor="middle" fontSize="11" fontWeight="600" fill={DIM} fontFamily="Geist, sans-serif">{title}</text>}
    </g>
  );
}

// ── 1. Funnel (etapas con caída + leyenda de disparadores) ──────────────────
function Funnel(s: VisualSpec) {
  const stages = A<{ label: string; w: number; trg?: string }>(s.stages, [
    { label: 'Impresiones', w: 1, trg: 'auto' }, { label: 'Clicks', w: 0.72, trg: 'auto' },
    { label: 'Agenda R1', w: 0.5, trg: 'auto' }, { label: 'Calificado', w: 0.34, trg: 'mako' },
    { label: 'Cierre', w: 0.2, trg: 'manual' },
  ]);
  const trg: Record<string, [string, string]> = { auto: ['⚡', BLUE], mako: ['◐', VIOLET], manual: ['✋', AMBER] };
  const H = 34, gap = 8, top = 46;
  return (
    <Frame>
      <text x="24" y="24" fontSize="11.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">Tu embudo, en vivo</text>
      {stages.map((st, i) => {
        const w = 300 * st.w, x = 24 + (300 - w) / 2, y = top + i * (H + gap);
        const c = trg[st.trg || 'auto'];
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={H} rx="7" fill={i % 2 ? '#DCE8FD' : TILE} stroke={LINE} />
            <text x="200" y={y + 22} textAnchor="middle" fontSize="12" fontWeight="600" fill={INK} fontFamily="Geist, sans-serif">{st.label}</text>
            <text x={x + w + 10} y={y + 23} fontSize="14" fill={c[1]}>{c[0]}</text>
          </g>
        );
      })}
      <g fontFamily="Geist, sans-serif" fontSize="10" fill={DIM}>
        <text x="24" y="290">⚡ automático   ◐ MaKo   ✋ marcás vos</text>
      </g>
    </Frame>
  );
}

// ── 2. StatTiles (cifras gigantes) ──────────────────────────────────────────
function StatTiles(s: VisualSpec) {
  const tiles = A<{ label: string; value: string; tone?: string }>(s.tiles, [
    { label: 'Vendido', value: '$48k', tone: 'blue' }, { label: 'Cobrado', value: '$31k', tone: 'green' },
    { label: 'Por cobrar', value: '$17k', tone: 'amber' },
  ]).slice(0, 3);
  const w = (352 - (tiles.length - 1) * 12) / tiles.length;
  return (
    <Frame>
      <text x="24" y="30" fontSize="11.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{S(s.title, 'Revenue real')}</text>
      {tiles.map((t, i) => {
        const c = toneColor(t.tone || 'blue'), x = 24 + i * (w + 12);
        return (
          <g key={i}>
            <rect x={x} y="48" width={w} height="110" rx="12" fill="#fff" stroke={LINE} />
            <rect x={x} y="48" width={w} height="4" rx="2" fill={c} />
            <text x={x + w / 2} y="108" textAnchor="middle" fontSize="30" fontWeight="700" fill={c} fontFamily="Geist, sans-serif">{t.value}</text>
            <text x={x + w / 2} y="134" textAnchor="middle" fontSize="12" fontWeight="500" fill={DIM} fontFamily="Geist, sans-serif">{t.label}</text>
          </g>
        );
      })}
      {A<{ name: string; amount: string; tone?: string }>(s.rows, [{ name: 'Cuota vencida · Ana', amount: '$2.5k', tone: 'red' }, { name: 'Por vencer · Luis', amount: '$1.8k', tone: 'amber' }]).slice(0, 2).map((r, i) => (
        <g key={i}>
          <rect x="24" y={178 + i * 34} width="352" height="26" rx="7" fill="#FBFCFE" stroke={LINE} />
          <circle cx="38" cy={191 + i * 34} r="4" fill={toneColor(r.tone || 'red')} />
          <text x="52" y={195 + i * 34} fontSize="11.5" fill={INK} fontFamily="Geist, sans-serif">{r.name}</text>
          <text x="368" y={195 + i * 34} textAnchor="end" fontSize="11.5" fontWeight="700" fill={toneColor(r.tone || 'red')} fontFamily="Geist Mono, monospace">{r.amount}</text>
        </g>
      ))}
    </Frame>
  );
}

// ── 3. Semaphore (3 luces + dictamen) ───────────────────────────────────────
function Semaphore(s: VisualSpec) {
  const lit = S(s.lit, 'red');
  const verdict = S(s.verdict, 'Hay algo urgente: entrega frenada');
  const lights: Array<[string, string]> = [['red', RED], ['amber', AMBER], ['green', GREEN]];
  return (
    <Frame>
      <rect x="150" y="30" width="100" height="200" rx="20" fill="#1B2130" />
      {lights.map(([k, c], i) => (
        <circle key={k} cx="200" cy={70 + i * 60} r="26" fill={lit === k ? c : '#2E3648'} opacity={lit === k ? 1 : 0.5}>
          {lit === k && <animate attributeName="opacity" values="1;.55;1" dur="1.6s" repeatCount="indefinite" />}
        </circle>
      ))}
      <rect x="24" y="250" width="352" height="34" rx="9" fill="#FDECEC" stroke="#F6C9C9" />
      <text x="200" y="271" textAnchor="middle" fontSize="12" fontWeight="600" fill="#A11" fontFamily="Geist, sans-serif">{verdict}</text>
    </Frame>
  );
}

// ── 4. ChatThread (WhatsApp) ────────────────────────────────────────────────
function ChatThread(s: VisualSpec) {
  const msgs = A<{ from: 'in' | 'out'; text: string; voice?: boolean }>(s.msgs, [
    { from: 'out', text: '🎤 nota de voz', voice: true }, { from: 'in', text: 'Pauso la campaña que quema plata?' }, { from: 'out', text: 'Sí, dale' }, { from: 'in', text: '✓ Hecho' },
  ]).slice(0, 6);
  const H = 30, GAP = 10;
  return (
    <Frame>
      <rect x="0" y="0" width="400" height="300" fill="#E7DED4" />
      <rect x="0" y="0" width="400" height="30" fill="#F0EAE1" />
      <text x="16" y="20" fontSize="12" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{S(s.title, 'Hola MaKo')}</text>
      {msgs.map((m, i) => {
        const out = m.from === 'out';
        const w = Math.min(300, 40 + m.text.length * 6.6);
        const x = out ? 380 - w : 20;
        const y = 40 + i * (H + GAP);
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={H} rx="9" fill={out ? '#DCF8C6' : '#fff'} />
            <text x={x + 12} y={y + 19} fontSize="11.5" fill={m.voice ? BLUE : INK} fontFamily="Geist, sans-serif">{m.text}</text>
          </g>
        );
      })}
    </Frame>
  );
}

// ── 5. BarChart ─────────────────────────────────────────────────────────────
function BarChart(s: VisualSpec) {
  const bars = A<{ label: string; v: number; tone?: string }>(s.bars, [
    { label: 'Ene', v: 0.5 }, { label: 'Feb', v: 0.7 }, { label: 'Mar', v: 0.45 }, { label: 'Abr', v: 0.9, tone: 'green' }, { label: 'May', v: 0.65 },
  ]);
  const bw = (352 - (bars.length - 1) * 14) / bars.length, base = 240;
  return (
    <Frame>
      <text x="24" y="28" fontSize="11.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{S(s.title, 'Cash cobrado por mes')}</text>
      <line x1="24" y1={base} x2="376" y2={base} stroke={LINE} />
      {bars.map((b, i) => {
        const h = 170 * Math.max(0.05, b.v), x = 24 + i * (bw + 14), c = toneColor(b.tone || 'blue');
        return (
          <g key={i}>
            <rect x={x} y={base - h} width={bw} height={h} rx="5" fill={c} opacity={b.tone ? 1 : 0.85} />
            <text x={x + bw / 2} y={base + 18} textAnchor="middle" fontSize="10.5" fill={DIM} fontFamily="Geist, sans-serif">{b.label}</text>
          </g>
        );
      })}
    </Frame>
  );
}

// ── 6. RetentionCurve (curva sobre beats del guion) ─────────────────────────
function RetentionCurve(s: VisualSpec) {
  const pts = A<number>(s.points, [1, 0.82, 0.55, 0.5, 0.42, 0.3, 0.26]);
  const drop = N(s.dropIndex, 2);
  const beats = A<string>(s.beats, ['Hook', 'Problema', 'Oferta', 'Prueba', 'CTA']);
  const W = 352, H = 150, x0 = 24, y0 = 40;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x0 + (W * i) / (pts.length - 1)},${y0 + H * (1 - p)}`).join(' ');
  const area = `${path} L${x0 + W},${y0 + H} L${x0},${y0 + H} Z`;
  const dx = x0 + (W * drop) / (pts.length - 1);
  return (
    <Frame>
      <text x="24" y="26" fontSize="11.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{S(s.title, 'Retención del VSL')}</text>
      <path d={area} fill="rgba(47,111,237,.10)" />
      <path d={path} fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinejoin="round" />
      <line x1={dx} y1={y0} x2={dx} y2={y0 + H} stroke={RED} strokeWidth="1.5" strokeDasharray="4 3" />
      <circle cx={dx} cy={y0 + H * (1 - pts[drop])} r="5" fill={RED} />
      <text x={dx + 6} y={y0 + H * (1 - pts[drop]) - 8} fontSize="10.5" fontWeight="700" fill={RED} fontFamily="Geist, sans-serif">se cae acá</text>
      {beats.map((b, i) => (
        <text key={i} x={x0 + (W * i) / (beats.length - 1)} y={y0 + H + 22} textAnchor="middle" fontSize="10" fill={DIM} fontFamily="Geist, sans-serif">{b}</text>
      ))}
    </Frame>
  );
}

// ── 7. Kanban ───────────────────────────────────────────────────────────────
function Kanban(s: VisualSpec) {
  const cols = A<{ label: string; cards: number; tone?: string }>(s.cols, [
    { label: 'No agendó', cards: 2, tone: 'amber' }, { label: 'Nutrición', cards: 3, tone: 'blue' }, { label: 'Reactivación', cards: 1, tone: 'violet' },
  ]).slice(0, 3);
  const cw = (352 - (cols.length - 1) * 12) / cols.length;
  return (
    <Frame>
      <Chrome title="CRM" />
      {cols.map((c, i) => {
        const x = 24 + i * (cw + 12), col = toneColor(c.tone || 'blue');
        return (
          <g key={i}>
            <rect x={x} y="44" width={cw} height="240" rx="10" fill="#FBFCFE" stroke={LINE} />
            <rect x={x + 10} y="54" width={cw - 20} height="6" rx="3" fill={col} />
            <text x={x + cw / 2} y="80" textAnchor="middle" fontSize="10.5" fontWeight="600" fill={INK} fontFamily="Geist, sans-serif">{c.label}</text>
            {Array.from({ length: c.cards }).map((_, k) => (
              <rect key={k} x={x + 10} y={92 + k * 40} width={cw - 20} height="32" rx="7" fill="#fff" stroke={LINE} />
            ))}
          </g>
        );
      })}
    </Frame>
  );
}

// ── 8. DiffCard (antes→después + confirmar/deshacer) ────────────────────────
function DiffCard(s: VisualSpec) {
  const rows = A<{ field: string; before: string; after: string }>(s.rows, [
    { field: 'Estado', before: 'Agendado', after: 'No Show R1' }, { field: 'Fathom', before: '—', after: '✓ link' },
  ]);
  return (
    <Frame>
      <rect x="40" y="34" width="320" height="200" rx="14" fill="#fff" stroke={LINE} />
      <rect x="40" y="34" width="320" height="40" rx="14" fill={TILE} />
      <text x="60" y="59" fontSize="12.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">MaKo movió un lead</text>
      {rows.map((r, i) => (
        <g key={i} fontFamily="Geist, sans-serif">
          <text x="60" y={100 + i * 30} fontSize="11" fill={DIM}>{r.field}</text>
          <text x="150" y={100 + i * 30} fontSize="11" fill="#9AA3B2" textDecoration="line-through">{r.before}</text>
          <text x="215" y={100 + i * 30} fontSize="11" fill={DIM}>→</text>
          <text x="230" y={100 + i * 30} fontSize="11" fontWeight="700" fill={INK}>{r.after}</text>
        </g>
      ))}
      <rect x="60" y="188" width="130" height="30" rx="8" fill={BLUE} />
      <text x="125" y="208" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#fff" fontFamily="Geist, sans-serif">Confirmar</text>
      <rect x="200" y="188" width="130" height="30" rx="8" fill="#fff" stroke={LINE} />
      <text x="265" y="208" textAnchor="middle" fontSize="11.5" fontWeight="600" fill={DIM} fontFamily="Geist, sans-serif">↶ Deshacer</text>
    </Frame>
  );
}

// ── 9. Pyramid (prioridades Alta/Media/Baja) ────────────────────────────────
function Pyramid(s: VisualSpec) {
  const tiers = A<{ label: string; tone: string }>(s.tiers, [
    { label: 'Alta · 3 tareas', tone: 'red' }, { label: 'Media', tone: 'amber' }, { label: 'Baja', tone: 'green' },
  ]);
  return (
    <Frame>
      <text x="24" y="28" fontSize="11.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{S(s.title, 'Qué hacer hoy, en orden')}</text>
      {tiers.map((t, i) => {
        const w = 120 + i * 100, x = 200 - w / 2, y = 50 + i * 66, c = toneColor(t.tone);
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height="52" rx="9" fill={c} opacity={0.9 - i * 0.18} />
            <text x="200" y={y + 32} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#fff" fontFamily="Geist, sans-serif">{t.label}</text>
          </g>
        );
      })}
    </Frame>
  );
}

// ── 10. Gauge (health / saldo) ──────────────────────────────────────────────
function Gauge(s: VisualSpec) {
  const val = N(s.value, 0.68);
  const label = S(s.label, 'Health Score');
  const big = S(s.big, '68');
  const c = toneColor(S(s.tone, val > 0.66 ? 'green' : val > 0.4 ? 'amber' : 'red'));
  const cx = 200, cy = 190, r = 100;
  const a = Math.PI * (1 - val);
  const ex = cx + r * Math.cos(a), ey = cy - r * Math.sin(a);
  return (
    <Frame>
      <path d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} fill="none" stroke={LINE} strokeWidth="16" strokeLinecap="round" />
      <path d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${ex},${ey}`} fill="none" stroke={c} strokeWidth="16" strokeLinecap="round" />
      <text x={cx} y={cy - 20} textAnchor="middle" fontSize="44" fontWeight="700" fill={c} fontFamily="Geist, sans-serif">{big}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="13" fontWeight="500" fill={DIM} fontFamily="Geist, sans-serif">{label}</text>
    </Frame>
  );
}

// ── 11. ByokKey (pegás key → tu cuenta) ─────────────────────────────────────
function ByokKey(s: VisualSpec) {
  const account = S(s.account, 'Ads · Elevate MX');
  return (
    <Frame>
      <rect x="40" y="60" width="320" height="44" rx="10" fill="#fff" stroke={LINE} />
      <text x="58" y="87" fontSize="12" fill="#9AA3B2" fontFamily="Geist Mono, monospace">EAAB••••••••••••3f9</text>
      <text x="330" y="87" fontSize="16" fill={AMBER}>🔑</text>
      <text x="200" y="140" textAnchor="middle" fontSize="20" fill={DIM}>↓</text>
      <rect x="40" y="158" width="320" height="70" rx="12" fill="#EAF7EE" stroke="#B7E0C5" />
      <circle cx="70" cy="193" r="14" fill={GREEN} /><path d="M64 193l4 4l8 -8" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="94" y="188" fontSize="11" fill={DIM} fontFamily="Geist, sans-serif">Reconocimos tu cuenta:</text>
      <text x="94" y="206" fontSize="13.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{account}</text>
    </Frame>
  );
}

// ── 12. RoleMatrix (roles × herramientas) ───────────────────────────────────
function RoleMatrix(s: VisualSpec) {
  const roles = A<string>(s.roles, ['Closer', 'Setter']);
  const tools = A<{ tool: string; on: boolean[] }>(s.tools, [
    { tool: 'CRM', on: [true, true] }, { tool: 'WhatsApp', on: [true, true] }, { tool: 'Closing', on: [true, false] }, { tool: 'Ads / gasto', on: [false, false] },
  ]);
  const x0 = 150, cw = 90;
  return (
    <Frame>
      <Chrome title="Roles del equipo" />
      {roles.map((r, i) => (
        <text key={i} x={x0 + cw / 2 + i * cw} y="64" textAnchor="middle" fontSize="12" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{r}</text>
      ))}
      {tools.map((t, ri) => (
        <g key={ri} fontFamily="Geist, sans-serif">
          <rect x="24" y={76 + ri * 46} width="352" height="40" rx="8" fill={ri % 2 ? '#FBFCFE' : '#fff'} stroke={LINE} />
          <text x="40" y={101 + ri * 46} fontSize="12" fill={INK}>{t.tool}</text>
          {t.on.map((on, ci) => (
            <g key={ci} transform={`translate(${x0 + cw / 2 + ci * cw}, ${96 + ri * 46})`}>
              {on ? <><circle r="10" fill="#EAF7EE" /><path d="M-4 0l3 3l6 -6" stroke={GREEN} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>
                : <><circle r="10" fill="#F4F5F7" /><path d="M-4 -4l8 8M4 -4l-8 8" stroke="#B6BCC7" strokeWidth="2" strokeLinecap="round" /></>}
            </g>
          ))}
        </g>
      ))}
    </Frame>
  );
}

// ── 13. PhaseLadder (5 fases, actual marcada) ───────────────────────────────
function PhaseLadder(s: VisualSpec) {
  const phases = A<string>(s.phases, ['Retención', 'Show R1', 'No-Show', 'Evergreen', 'Escalar']);
  const cur = N(s.current, 1);
  return (
    <Frame>
      <text x="24" y="28" fontSize="11.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{S(s.title, 'Tu fase → tu Norte')}</text>
      {phases.map((p, i) => {
        const y = 250 - i * 44, active = i === cur, done = i < cur, c = active ? BLUE : done ? '#B9CDF3' : '#E9ECF2';
        return (
          <g key={i} fontFamily="Geist, sans-serif">
            <rect x="24" y={y} width={100 + i * 46} height="34" rx="8" fill={active ? TILE : '#FBFCFE'} stroke={active ? BLUE : LINE} strokeWidth={active ? 2 : 1} />
            <circle cx="42" cy={y + 17} r="7" fill={c} />
            <text x="58" y={y + 21} fontSize="11.5" fontWeight={active ? 700 : 500} fill={active ? INK : DIM}>{p}</text>
            {active && <text x={140 + i * 46} y={y + 21} fontSize="11" fontWeight="700" fill={BLUE}>← estás acá</text>}
          </g>
        );
      })}
    </Frame>
  );
}

// ── 14. DocExtract (PDF → campos autollenados) ──────────────────────────────
function DocExtract(s: VisualSpec) {
  const fields = A<{ k: string; v: string }>(s.fields, [
    { k: 'Total', v: '$12.000' }, { k: 'Cuotas', v: '6' }, { k: '1er pago', v: '15/08' },
  ]);
  return (
    <Frame>
      <g>
        <rect x="34" y="60" width="120" height="150" rx="8" fill="#fff" stroke={LINE} />
        <path d="M134 60 l20 20 h-20 z" fill="#E9EDF4" />
        {[0, 1, 2, 3, 4].map((i) => <rect key={i} x="48" y={84 + i * 20} width={i === 4 ? 50 : 92} height="6" rx="3" fill="#E4E9F2" />)}
        <text x="94" y="230" textAnchor="middle" fontSize="10.5" fill={DIM} fontFamily="Geist, sans-serif">contrato.pdf</text>
      </g>
      <text x="182" y="140" fontSize="20" fill={BLUE}>→</text>
      {fields.map((f, i) => (
        <g key={i} fontFamily="Geist, sans-serif">
          <rect x="210" y={70 + i * 44} width="160" height="34" rx="8" fill="#EAF7EE" stroke="#B7E0C5" />
          <text x="224" y={91 + i * 44} fontSize="10.5" fill={DIM}>{f.k}</text>
          <text x="356" y={91 + i * 44} textAnchor="end" fontSize="12.5" fontWeight="700" fill={INK}>{f.v}</text>
        </g>
      ))}
    </Frame>
  );
}

// ── 15. SignalFlow (nodos A→B→C) ────────────────────────────────────────────
function SignalFlow(s: VisualSpec) {
  const nodes = A<{ label: string; sub?: string; tone?: string }>(s.nodes, [
    { label: 'CRM', sub: 'califica', tone: 'blue' }, { label: 'SHA-256', sub: 'hash', tone: 'violet' }, { label: 'Meta', sub: 'optimiza', tone: 'green' },
  ]).slice(0, 3);
  const bw = 96, gap = (352 - nodes.length * bw) / (nodes.length - 1), y = 110;
  return (
    <Frame>
      <text x="24" y="40" fontSize="11.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{S(s.title, 'Señal server-side a Meta')}</text>
      {nodes.map((n, i) => {
        const x = 24 + i * (bw + gap), c = toneColor(n.tone || 'blue');
        return (
          <g key={i} fontFamily="Geist, sans-serif">
            <rect x={x} y={y} width={bw} height="64" rx="12" fill="#fff" stroke={c} strokeWidth="1.5" />
            <text x={x + bw / 2} y={y + 30} textAnchor="middle" fontSize="13" fontWeight="700" fill={c}>{n.label}</text>
            <text x={x + bw / 2} y={y + 48} textAnchor="middle" fontSize="10" fill={DIM}>{n.sub}</text>
            {i < nodes.length - 1 && <text x={x + bw + gap / 2} y={y + 38} textAnchor="middle" fontSize="16" fill={DIM}>→</text>}
          </g>
        );
      })}
      {A<string>(s.badges, ['QualifiedLead', 'Schedule']).map((b, i) => (
        <g key={i}>
          <rect x={24 + i * 130} y="210" width="120" height="26" rx="13" fill={TILE} />
          <text x={84 + i * 130} y="227" textAnchor="middle" fontSize="10.5" fontWeight="600" fill={BLUE} fontFamily="Geist Mono, monospace">{b}</text>
        </g>
      ))}
    </Frame>
  );
}

// ── 16. ScoreCard (SPIN / puntajes con barras) ──────────────────────────────
function ScoreCard(s: VisualSpec) {
  const items = A<{ label: string; v: number }>(s.items, [
    { label: 'Situación', v: 0.9 }, { label: 'Problema', v: 0.7 }, { label: 'Implicación', v: 0.5 }, { label: 'Need-payoff', v: 0.8 },
  ]);
  return (
    <Frame>
      <Chrome title="Closing Analyst" />
      <text x="24" y="60" fontSize="11.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{S(s.title, 'Puntaje SPIN de la llamada')}</text>
      {items.map((it, i) => {
        const y = 82 + i * 42;
        return (
          <g key={i} fontFamily="Geist, sans-serif">
            <text x="24" y={y + 14} fontSize="11.5" fill={INK}>{it.label}</text>
            <rect x="150" y={y + 3} width="200" height="14" rx="7" fill="#EEF1F6" />
            <rect x="150" y={y + 3} width={200 * it.v} height="14" rx="7" fill={it.v > 0.66 ? GREEN : it.v > 0.45 ? AMBER : RED} />
            <text x="360" y={y + 14} textAnchor="end" fontSize="11" fontWeight="700" fill={DIM} fontFamily="Geist Mono, monospace">{Math.round(it.v * 10)}</text>
          </g>
        );
      })}
    </Frame>
  );
}

// ── 17. EmailSequence ───────────────────────────────────────────────────────
function EmailSequence(s: VisualSpec) {
  const steps = A<{ day: string; subject: string }>(s.steps, [
    { day: 'Día 0', subject: 'No agendaste todavía' }, { day: 'Día 2', subject: 'Te dejo el caso de Ana' }, { day: 'Día 5', subject: '¿Lo cerramos?' },
  ]);
  return (
    <Frame>
      <text x="24" y="28" fontSize="11.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{S(s.title, 'Secuencia por etapa del funnel')}</text>
      <line x1="40" y1="60" x2="40" y2={60 + (steps.length - 1) * 66} stroke={LINE} strokeWidth="2" />
      {steps.map((st, i) => {
        const y = 54 + i * 66;
        return (
          <g key={i} fontFamily="Geist, sans-serif">
            <circle cx="40" cy={y + 20} r="7" fill={BLUE} />
            <rect x="62" y={y} width="310" height="46" rx="10" fill="#fff" stroke={LINE} />
            <text x="78" y={y + 20} fontSize="10.5" fontWeight="700" fill={BLUE}>{st.day}</text>
            <text x="78" y={y + 36} fontSize="12" fill={INK}>✉ {st.subject}</text>
          </g>
        );
      })}
    </Frame>
  );
}

// ── 18. StampBeforeAfter (VALIDADA / REFUTADA) ──────────────────────────────
function Stamp(s: VisualSpec) {
  const ok = s.result !== 'refuted';
  const label = S(s.label, ok ? 'VALIDADA' : 'REFUTADA');
  const c = ok ? GREEN : RED;
  return (
    <Frame>
      <text x="24" y="30" fontSize="11.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{S(s.title, 'Hipótesis medida')}</text>
      <rect x="24" y="50" width="160" height="90" rx="12" fill="#FBFCFE" stroke={LINE} />
      <text x="104" y="88" textAnchor="middle" fontSize="11" fill={DIM} fontFamily="Geist, sans-serif">antes</text>
      <text x="104" y="116" textAnchor="middle" fontSize="22" fontWeight="700" fill={DIM} fontFamily="Geist, sans-serif">{S(s.before, '12%')}</text>
      <rect x="216" y="50" width="160" height="90" rx="12" fill="#EAF7EE" stroke="#B7E0C5" />
      <text x="296" y="88" textAnchor="middle" fontSize="11" fill={DIM} fontFamily="Geist, sans-serif">después</text>
      <text x="296" y="116" textAnchor="middle" fontSize="22" fontWeight="700" fill={GREEN} fontFamily="Geist, sans-serif">{S(s.after, '31%')}</text>
      <g transform="translate(200,210) rotate(-8)">
        <rect x="-92" y="-26" width="184" height="52" rx="10" fill="none" stroke={c} strokeWidth="3" />
        <text x="0" y="8" textAnchor="middle" fontSize="24" fontWeight="800" fill={c} fontFamily="Geist, sans-serif" letterSpacing="2">{label}</text>
      </g>
    </Frame>
  );
}

// ── 19. SplitLoad (vos contestás / se cargan tus datos) ─────────────────────
function SplitLoad(s: VisualSpec) {
  const items = A<string>(s.loading, ['Meta · 365 días', 'Leads', 'Guiones de ads', 'Llamadas de Fathom']);
  return (
    <Frame>
      <rect x="0" y="0" width="196" height="300" fill="#FBFCFE" />
      <text x="24" y="36" fontSize="11.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">Contestás 6 preguntas</text>
      {[0, 1, 2].map((i) => (
        <g key={i}><rect x="24" y={58 + i * 46} width="148" height="34" rx="8" fill="#fff" stroke={LINE} /><rect x="34" y={71 + i * 46} width={90 - i * 18} height="8" rx="4" fill="#E4E9F2" /></g>
      ))}
      <line x1="200" y1="0" x2="200" y2="300" stroke={LINE} strokeDasharray="4 4" />
      <text x="224" y="36" fontSize="11.5" fontWeight="700" fill={BLUE} fontFamily="Geist, sans-serif">…y ya se cargan solos</text>
      {items.map((it, i) => (
        <g key={i} fontFamily="Geist, sans-serif">
          <rect x="224" y={54 + i * 44} width="152" height="34" rx="8" fill={TILE} />
          <circle cx="242" cy={71 + i * 44} r="6" fill={GREEN} /><path d={`M238 ${71 + i * 44}l3 3l6 -6`} stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text x="258" y={75 + i * 44} fontSize="10.5" fill={INK}>{it}</text>
        </g>
      ))}
    </Frame>
  );
}

// ── 20. AlertCard (aviso por WhatsApp) ──────────────────────────────────────
function AlertCard(s: VisualSpec) {
  const text = S(s.text, 'Tu cuenta de Meta dice ACTIVE pero no entrega: saldo impago. Perdés leads AHORA.');
  return (
    <Frame>
      <rect x="0" y="0" width="400" height="300" fill="#E7DED4" />
      <rect x="30" y="70" width="340" height="160" rx="16" fill="#fff" />
      <rect x="30" y="70" width="340" height="44" rx="16" fill="#FDECEC" />
      <circle cx="56" cy="92" r="9" fill={RED} /><text x="52" y="97" fontSize="12" fontWeight="800" fill="#fff">!</text>
      <text x="74" y="97" fontSize="12.5" fontWeight="700" fill="#A11" fontFamily="Geist, sans-serif">MaKo · alerta urgente</text>
      <foreignObject x="50" y="126" width="300" height="90">
        <div style={{ fontSize: 13, lineHeight: 1.4, color: INK, fontFamily: 'Geist, sans-serif' }}>{text}</div>
      </foreignObject>
    </Frame>
  );
}

// ── 21. DashboardMock (gráfico + botón MaKo) ────────────────────────────────
function DashboardMock(s: VisualSpec) {
  const pts = A<number>(s.points, [0.3, 0.5, 0.42, 0.66, 0.6, 0.82]);
  const W = 300, H = 120, x0 = 24, y0 = 60;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x0 + (W * i) / (pts.length - 1)},${y0 + H * (1 - p)}`).join(' ');
  return (
    <Frame>
      <Chrome title={S(s.title, 'Marketing')} />
      <path d={`${path} L${x0 + W},${y0 + H} L${x0},${y0 + H} Z`} fill="rgba(47,111,237,.10)" />
      <path d={path} fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinejoin="round" />
      {[0, 1, 2].map((i) => (
        <g key={i}><rect x={24 + i * 118} y="200" width="106" height="54" rx="10" fill="#FBFCFE" stroke={LINE} />
          <text x={77 + i * 118} y="228" textAnchor="middle" fontSize="18" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{['2.1%', '$14', '31%'][i]}</text>
          <text x={77 + i * 118} y="244" textAnchor="middle" fontSize="9.5" fill={DIM} fontFamily="Geist, sans-serif">{['CTR', 'CPL', 'Cierre'][i]}</text></g>
      ))}
      <g transform="translate(300,44)"><rect x="0" y="0" width="76" height="26" rx="13" fill={INK} /><text x="38" y="17" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#fff" fontFamily="Geist, sans-serif">✦ MaKo</text></g>
    </Frame>
  );
}

// ── 22. RagIndex (doc → transcribe → índice) ────────────────────────────────
function RagIndex(s: VisualSpec) {
  return (
    <Frame>
      <text x="24" y="28" fontSize="11.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{S(s.title, 'Tu método, indexado')}</text>
      <rect x="30" y="120" width="80" height="60" rx="10" fill="#fff" stroke={LINE} /><text x="70" y="155" textAnchor="middle" fontSize="20">🎬</text><text x="70" y="196" textAnchor="middle" fontSize="9.5" fill={DIM} fontFamily="Geist, sans-serif">tu clase</text>
      <text x="126" y="155" fontSize="16" fill={BLUE}>→</text>
      <rect x="150" y="120" width="90" height="60" rx="10" fill={TILE} /><text x="195" y="148" textAnchor="middle" fontSize="10.5" fill={BLUE} fontFamily="Geist, sans-serif">transcribe</text><text x="195" y="164" textAnchor="middle" fontSize="10.5" fill={BLUE} fontFamily="Geist, sans-serif">+ chunk</text>
      <text x="252" y="155" fontSize="16" fill={BLUE}>→</text>
      {Array.from({ length: 9 }).map((_, i) => (
        <circle key={i} cx={286 + (i % 3) * 30} cy={126 + Math.floor(i / 3) * 30} r="9" fill={i === 4 ? VIOLET : '#C9D8F6'} />
      ))}
      <text x="316" y="216" textAnchor="middle" fontSize="9.5" fill={DIM} fontFamily="Geist, sans-serif">embeddings</text>
    </Frame>
  );
}

// ── 23. AdRow (fila de anuncio con cash real) ───────────────────────────────
function AdRow(s: VisualSpec) {
  const rows = A<{ name: string; cash: string; roas: string; tone?: string }>(s.rows, [
    { name: 'Creativo · Dashboard', cash: '$18k', roas: '4.2x', tone: 'green' }, { name: 'Creativo · Testimonio', cash: '$6k', roas: '1.1x', tone: 'amber' },
  ]);
  return (
    <Frame>
      <Chrome title="Ads Manager" />
      <g fontFamily="Geist, sans-serif" fontSize="10" fill={DIM}>
        <text x="40" y="62">Anuncio</text><text x="250" y="62">Cash</text><text x="330" y="62">ROAS real</text>
      </g>
      {rows.map((r, i) => (
        <g key={i} fontFamily="Geist, sans-serif">
          <rect x="24" y={72 + i * 46} width="352" height="40" rx="8" fill={i % 2 ? '#FBFCFE' : '#fff'} stroke={LINE} />
          <text x="40" y={97 + i * 46} fontSize="11.5" fill={INK}>{r.name}</text>
          <text x="250" y={97 + i * 46} fontSize="12" fontWeight="700" fill={INK} fontFamily="Geist Mono, monospace">{r.cash}</text>
          <text x="336" y={97 + i * 46} fontSize="12" fontWeight="700" fill={toneColor(r.tone || 'green')} fontFamily="Geist Mono, monospace">{r.roas}</text>
        </g>
      ))}
      <text x="24" y="180" fontSize="10" fill={DIM} fontFamily="Geist, sans-serif">Cash cerrado por anuncio (CRM × UTM), no conversiones del pixel</text>
    </Frame>
  );
}

// ── 24. ThesisCard (Retro: 6 tabs → tesis + fuga) ───────────────────────────
function ThesisCard(s: VisualSpec) {
  const tabs = A<string>(s.tabs, ['Ads', 'CRM', 'Llamadas', 'Cobranza', 'VSL', 'Nutrición']);
  return (
    <Frame>
      <g fontFamily="Geist, sans-serif">
        {tabs.slice(0, 6).map((t, i) => (
          <g key={i}><rect x={24 + (i % 3) * 84} y={26 + Math.floor(i / 3) * 30} width="76" height="24" rx="6" fill={TILE} /><text x={62 + (i % 3) * 84} y={42 + Math.floor(i / 3) * 30} textAnchor="middle" fontSize="10" fill={BLUE}>{t}</text></g>
        ))}
      </g>
      <text x="200" y="108" textAnchor="middle" fontSize="14" fill={BLUE}>↓ una tesis</text>
      <rect x="24" y="122" width="352" height="120" rx="14" fill="#fff" stroke={LINE} />
      <text x="40" y="150" fontSize="12.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{S(s.thesis, 'Tu cuello está entre R1 y R2')}</text>
      <rect x="40" y="164" width="150" height="60" rx="10" fill="#FDECEC" />
      <text x="56" y="186" fontSize="10.5" fill={DIM} fontFamily="Geist, sans-serif">Fuga principal</text>
      <text x="56" y="210" fontSize="22" fontWeight="700" fill={RED} fontFamily="Geist, sans-serif">{S(s.leak, '$9.400')}</text>
      <rect x="206" y="164" width="150" height="60" rx="10" fill="#EAF7EE" />
      <text x="222" y="186" fontSize="10.5" fill={DIM} fontFamily="Geist, sans-serif">Plan auto-creado</text>
      <text x="222" y="210" fontSize="13" fontWeight="700" fill={GREEN} fontFamily="Geist, sans-serif">2 exp · 3 tareas</text>
    </Frame>
  );
}

// ── 25. WaInbox (bandeja agrupada por lead + ventana 24h) ───────────────────
function WaInbox(s: VisualSpec) {
  const rows = A<{ name: string; stage: string; win: number }>(s.rows, [
    { name: 'Ana · R1 agendada', stage: 'Agendado', win: 18 }, { name: 'Luis · calificado', stage: 'Calificado', win: 4 }, { name: 'Sofi · no responde', stage: 'Reactivación', win: 0 },
  ]);
  return (
    <Frame>
      <Chrome title="WhatsApp" />
      {rows.map((r, i) => {
        const y = 52 + i * 62, c = r.win > 12 ? GREEN : r.win > 0 ? AMBER : RED;
        return (
          <g key={i} fontFamily="Geist, sans-serif">
            <rect x="24" y={y} width="352" height="52" rx="10" fill="#fff" stroke={LINE} />
            <circle cx="52" cy={y + 26} r="16" fill={TILE} /><text x="52" y={y + 31} textAnchor="middle" fontSize="13" fontWeight="700" fill={BLUE}>{r.name[0]}</text>
            <text x="80" y={y + 22} fontSize="12" fontWeight="600" fill={INK}>{r.name}</text>
            <rect x="80" y={y + 30} width={r.stage.length * 6.5 + 14} height="16" rx="8" fill={TILE} /><text x={87} y={y + 42} fontSize="9.5" fill={BLUE}>{r.stage}</text>
            <text x="366" y={y + 22} textAnchor="end" fontSize="10.5" fontWeight="700" fill={c}>{r.win > 0 ? `${r.win}h` : 'cerrada'}</text>
            <text x="366" y={y + 40} textAnchor="end" fontSize="8.5" fill={DIM}>ventana 24h</text>
          </g>
        );
      })}
    </Frame>
  );
}

// ── 26. MakoAnswer (pregunta → decisión) ────────────────────────────────────
function MakoAnswer(s: VisualSpec) {
  return (
    <Frame>
      <rect x="120" y="34" width="256" height="34" rx="10" fill={TILE} />
      <text x="136" y="56" fontSize="11.5" fill={INK} fontFamily="Geist, sans-serif">{S(s.q, '¿Apago este anuncio?')}</text>
      <g transform="translate(24,86)"><rect width="30" height="30" rx="9" fill={INK} /><text x="15" y="20" textAnchor="middle" fontSize="13" fill="#F2B01E">✦</text></g>
      <rect x="62" y="86" width="314" height="180" rx="14" fill="#fff" stroke={LINE} />
      <text x="80" y="112" fontSize="12.5" fontWeight="700" fill={INK} fontFamily="Geist, sans-serif">{S(s.a, 'Sí. Gastó $340, 0 cierres en 7 días.')}</text>
      <foreignObject x="80" y="124" width="280" height="80">
        <div style={{ fontSize: 12, lineHeight: 1.45, color: DIM, fontFamily: 'Geist, sans-serif' }}>{S(s.detail, 'Tu CAC objetivo es $180. Este creativo ya está fatigado (frecuencia 3.4). Te libero presupuesto para el ganador.')}</div>
      </foreignObject>
      <rect x="80" y="224" width="150" height="30" rx="8" fill={BLUE} /><text x="155" y="244" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#fff" fontFamily="Geist, sans-serif">Aplicá el cambio</text>
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
  const render = spec && REGISTRY[spec.type];
  if (!render) return <Funnel type="funnel" />; // fallback seguro
  return render(spec);
}
