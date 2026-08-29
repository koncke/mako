'use client';

// =============================================================================
// GraphicsView — la tab "Graphics" del board /plan
// =============================================================================
// Gráficos que responden preguntas que cambian decisiones (no adorno). Todo con
// SVG inline (mismo estilo que el board, sin librerías). Los de comportamiento
// (cumplimiento de deadlines, cycle time, velocidad) se llenan a medida que se usa
// el board: hasta que haya eventos reales, muestran un estado "sin datos todavía".

import { useMemo, useState } from 'react';
import type { Board } from './useBoard';
import { type BoardTask, type Label, type Hist, PCOLOR, PLABEL, prioFromScore, type Prio } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const DAY = 86400000;

// ── helpers sobre el historial (eventos con timestamp) ────────────────────────
const creadoTs = (h: Hist[]): number => {
  const c = h.find((x) => (x.text || '').startsWith('Creó'));
  if (c) return c.ts;
  return h.length ? Math.min(...h.map((x) => x.ts)) : 0;
};
const completadoTs = (t: BoardTask): number | null => {
  if (t.progress < 100) return null;
  const done = t.historial.filter((x) => /completa/i.test(x.text || '')).sort((a, b) => b.ts - a.ts)[0];
  return done ? done.ts : null;
};
const ultActividad = (h: Hist[]): number => (h.length ? Math.max(...h.map((x) => x.ts)) : 0);
const deadlineMoves = (h: Hist[]): number => h.filter((x) => (x.text || '').startsWith('Deadline')).length;

type DoneFilter = 'todos' | 'activos' | 'completados';

export function GraphicsView({ board }: { board: Board }) {
  const { tasks, labels } = board;
  const [filtro, setFiltro] = useState<DoneFilter>('activos');

  const m = useMemo(() => {
    const now = Date.now();
    const activas = tasks.filter((t) => t.progress < 100);
    const hechas = tasks.filter((t) => t.progress >= 100);
    // proyecto = "completado" si tiene tareas y todas están hechas
    const projMeta = labels.map((l) => {
      const suyas = tasks.filter((t) => t.labels.includes(l.id));
      const done = suyas.filter((t) => t.progress >= 100).length;
      const pct = suyas.length ? Math.round(suyas.reduce((s, t) => s + t.progress, 0) / suyas.length) : 0;
      return { l, total: suyas.length, done, pct, completo: suyas.length > 0 && done === suyas.length };
    });
    const avanceGlobal = projMeta.length ? Math.round(projMeta.reduce((s, p) => s + p.pct, 0) / projMeta.length) : 0;

    // pirámide: tareas activas por columna
    const piramide: Record<Prio, number> = { alta: 0, media: 0, baja: 0, futuro: 0 };
    activas.forEach((t) => { piramide[prioFromScore(t.score)]++; });

    // comportamiento (necesita eventos reales)
    const ciclos = hechas.map((t) => { const c = creadoTs(t.historial); const f = completadoTs(t); return c && f && f - c > DAY / 2 ? { t, dias: (f - c) / DAY, prio: prioFromScore(t.score) } : null; }).filter(Boolean) as { t: BoardTask; dias: number; prio: Prio }[];
    const conDeadline = hechas.map((t) => { const f = completadoTs(t); if (!f || !t.deadline) return null; const dl = Date.parse(t.deadline + 'T23:59:59'); if (!Number.isFinite(dl)) return null; return { t, aTiempo: f <= dl, dias: Math.round((f - dl) / DAY) }; }).filter(Boolean) as { t: BoardTask; aTiempo: boolean; dias: number }[];

    // estancadas: activas sin actividad hace > 7 días
    const estancadas = activas.map((t) => ({ t, dias: Math.round((now - ultActividad(t.historial)) / DAY) })).filter((x) => x.dias >= 7).sort((a, b) => b.dias - a.dias);
    // sin deadline (foco en Alta)
    const sinDeadlineAlta = activas.filter((t) => prioFromScore(t.score) === 'alta' && !t.deadline);
    const sinDeadlineTotal = activas.filter((t) => !t.deadline).length;
    const projSinDeadline = labels.filter((l) => !l.deadline);
    // deadlines que se corrieron
    const corridos = tasks.map((t) => ({ t, n: deadlineMoves(t.historial) })).filter((x) => x.n >= 2).sort((a, b) => b.n - a.n);

    // WIP
    const wip = activas.filter((t) => t.progress > 0).length;

    return { activas, hechas, projMeta, avanceGlobal, piramide, ciclos, conDeadline, estancadas, sinDeadlineAlta, sinDeadlineTotal, projSinDeadline, corridos, wip };
  }, [tasks, labels]);

  // proyectos filtrados (para matriz + avance)
  const projShown = m.projMeta.filter((p) => (filtro === 'todos' ? true : filtro === 'completados' ? p.completo : !p.completo));

  return (
    <div style={{ flex: '1 0 auto', padding: '18px 30px 44px', fontFamily: SANS }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <Kpi label="Proyectos" value={labels.length} />
          <Kpi label="Avance global" value={`${m.avanceGlobal}%`} />
          <Kpi label="Completados" value={m.projMeta.filter((p) => p.completo).length} />
          <Kpi label="Tareas activas" value={m.activas.length} />
          <Kpi label="En curso (WIP)" value={m.wip} tone={m.wip > 12 ? 'warn' : undefined} />
          <Kpi label="Alta sin deadline" value={m.sinDeadlineAlta.length} tone={m.sinDeadlineAlta.length ? 'bad' : 'good'} />
        </div>

        {/* filtro */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>Mostrar</span>
          <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3 }}>
            {([['activos', 'Activos'], ['completados', 'Completados'], ['todos', 'Todos']] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setFiltro(k)} style={{ border: 'none', background: filtro === k ? 'var(--surface)' : 'transparent', color: filtro === k ? 'var(--ink)' : 'var(--dim)', fontWeight: filtro === k ? 600 : 500, fontSize: 12.5, padding: '5px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: SANS, boxShadow: filtro === k ? '0 1px 2px rgba(18,21,27,.08)' : 'none' }}>{lbl}</button>
            ))}
          </div>
        </div>

        <Section titulo="¿Qué hago primero?" sub="La prioridad del Perro Guardián, hecha imagen.">
          <Card titulo="Impacto × Esfuerzo" sub="Cada burbuja un proyecto · tamaño = nº de tareas">
            <Matriz proyectos={projShown} />
          </Card>
          <Card titulo="Pirámide de prioridad" sub="Tareas activas por columna — pocas Alta = foco sano">
            <Piramide piramide={m.piramide} totalActivas={m.activas.length} />
          </Card>
        </Section>

        <Section titulo="¿Cómo venimos?" sub="El avance real, de un vistazo.">
          <Card titulo="Avance por proyecto" sub={`${projShown.length} ${filtro === 'completados' ? 'completados' : filtro === 'activos' ? 'activos' : 'proyectos'}`}>
            <AvanceProyectos rows={projShown} />
          </Card>
        </Section>

        <Section titulo="¿Eres disciplinado con los tiempos?" sub="El espejo de tus hábitos de ejecución. Se llena a medida que usas el board.">
          <Card titulo="Cumplimiento de deadlines" sub="De lo terminado con fecha: a tiempo vs tarde">
            <Cumplimiento data={m.conDeadline} />
          </Card>
          <Card titulo="Cycle time" sub="Días desde crear hasta completar, por prioridad">
            <CycleTime ciclos={m.ciclos} />
          </Card>
          <Card titulo="Deadlines que corriste" sub="Cuántas veces moviste la fecha antes de cerrar">
            <Corridos rows={m.corridos} />
          </Card>
        </Section>

        <Section titulo="¿Qué huele mal?" sub="Lo que conviene desenterrar, cerrar o matar.">
          <Card titulo="Estancadas" sub="Activas sin movimiento hace 7+ días">
            <Lista items={m.estancadas.map((x) => ({ t: x.t, extra: `${x.dias} d sin tocar` }))} vacio="Nada estancado — todo con actividad reciente." icon="⏳" />
          </Card>
          <Card titulo="Alta sin deadline" sub="Prioridad Alta sin fecha = riesgo de nunca cerrarse">
            <Lista items={m.sinDeadlineAlta.map((t) => ({ t, extra: 'sin fecha' }))} vacio="Toda tarea Alta tiene deadline. 💪" icon="📅" />
            {m.projSinDeadline.length > 0 && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--faint)' }}>{m.projSinDeadline.length} proyecto{m.projSinDeadline.length > 1 ? 's' : ''} sin deadline · {m.sinDeadlineTotal} tareas sin fecha en total</div>}
          </Card>
        </Section>
      </div>
    </div>
  );
}

// ── piezas ────────────────────────────────────────────────────────────────────
function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: 'good' | 'warn' | 'bad' }) {
  const c = tone === 'good' ? '#1E9E57' : tone === 'warn' ? '#C8870C' : tone === 'bad' ? '#D0504A' : 'var(--ink)';
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 16px' }}>
      <div style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 25, fontWeight: 700, color: c, letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  );
}
function Section({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{titulo}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 2, marginBottom: 12 }}>{sub}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>{children}</div>
    </div>
  );
}
function Card({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{titulo}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 1, marginBottom: 12 }}>{sub}</div>}
      {children}
    </div>
  );
}
function Vacio({ msg, icon = '📊' }: { msg: string; icon?: string }) {
  return (
    <div style={{ border: '1.5px dashed var(--border-strong)', borderRadius: 11, padding: '22px 16px', textAlign: 'center', color: 'var(--faint)', fontSize: 12.5, lineHeight: 1.5 }}>
      <div style={{ fontSize: 22, marginBottom: 6, opacity: 0.7 }}>{icon}</div>{msg}
    </div>
  );
}

const quadColor = (imp: number, esf: number): string => (imp >= 50 && esf < 50 ? '#1BAF7A' : imp >= 50 && esf >= 50 ? '#2A78D6' : imp < 50 && esf < 50 ? '#8A8880' : '#E34948');

function Matriz({ proyectos }: { proyectos: { l: Label; total: number }[] }) {
  const [hov, setHov] = useState<string | null>(null);
  const pts = proyectos.filter((p) => p.l.impacto != null && p.l.esfuerzo != null);
  if (!pts.length) return <Vacio msg="Sin impacto/esfuerzo cargado todavía. Se completa en la próxima re-priorización del guardián." />;
  const W = 620, H = 360, ml = 44, mr = 16, mt = 16, mb = 40;
  const pw = W - ml - mr, ph = H - mt - mb;
  const maxT = Math.max(1, ...pts.map((p) => p.total));
  const px = (e: number) => ml + (e / 100) * pw;
  const py = (i: number) => mt + (1 - i / 100) * ph;
  const r = (t: number) => 5 + (t / maxT) * 16;
  const cx = px(50), cy = py(50);
  const hovP = pts.find((p) => p.l.id === hov);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }} role="img" aria-label="Matriz de impacto vs esfuerzo por proyecto">
        {/* ejes */}
        <line x1={ml} y1={mt} x2={ml} y2={mt + ph} stroke="var(--border)" />
        <line x1={ml} y1={mt + ph} x2={ml + pw} y2={mt + ph} stroke="var(--border)" />
        {/* cruz de cuadrantes */}
        <line x1={cx} y1={mt} x2={cx} y2={mt + ph} stroke="var(--border)" strokeDasharray="4 4" />
        <line x1={ml} y1={cy} x2={ml + pw} y2={cy} stroke="var(--border)" strokeDasharray="4 4" />
        {/* labels de cuadrante */}
        <text x={ml + 5} y={mt + 12} fontSize="10" fontWeight="700" fill="var(--faint)" fontFamily={MONO}>QUICK WINS</text>
        <text x={ml + pw - 5} y={mt + 12} fontSize="10" fontWeight="700" fill="var(--faint)" fontFamily={MONO} textAnchor="end">APUESTAS</text>
        <text x={ml + 5} y={mt + ph - 6} fontSize="10" fontWeight="700" fill="var(--faint)" fontFamily={MONO}>RELLENO</text>
        <text x={ml + pw - 5} y={mt + ph - 6} fontSize="10" fontWeight="700" fill="var(--faint)" fontFamily={MONO} textAnchor="end">TRAMPAS</text>
        {/* ticks */}
        {[0, 50, 100].map((v) => <text key={'x' + v} x={px(v)} y={mt + ph + 16} fontSize="9.5" fill="var(--faint)" fontFamily={MONO} textAnchor="middle">{v}</text>)}
        {[0, 50, 100].map((v) => <text key={'y' + v} x={ml - 6} y={py(v) + 3} fontSize="9.5" fill="var(--faint)" fontFamily={MONO} textAnchor="end">{v}</text>)}
        <text x={ml + pw / 2} y={mt + ph + 32} fontSize="10.5" fill="var(--dim)" textAnchor="middle">Esfuerzo →</text>
        <text x={12} y={mt + ph / 2} fontSize="10.5" fill="var(--dim)" textAnchor="middle" transform={`rotate(-90 12 ${mt + ph / 2})`}>Impacto →</text>
        {/* burbujas */}
        {pts.map((p) => {
          const col = quadColor(p.l.impacto!, p.l.esfuerzo!);
          const on = hov === p.l.id;
          return <circle key={p.l.id} cx={px(p.l.esfuerzo!)} cy={py(p.l.impacto!)} r={r(p.total)} fill={col + (on ? 'e0' : '80')} stroke={col} strokeWidth={on ? 2 : 1.2} style={{ cursor: 'pointer', transition: 'fill .1s' }} onMouseEnter={() => setHov(p.l.id)} onMouseLeave={() => setHov(null)} />;
        })}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--faint)' }}>
        {[['#1BAF7A', 'Quick win'], ['#2A78D6', 'Apuesta grande'], ['#8A8880', 'De relleno'], ['#E34948', 'Trampa']].map(([c, l]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />{l}</span>
        ))}
      </div>
      <div style={{ marginTop: 8, minHeight: 20, fontSize: 12.5, color: hovP ? 'var(--ink)' : 'var(--faint)' }}>
        {hovP ? <span>{hovP.l.emoji} <b style={{ fontWeight: 600 }}>{hovP.l.name}</b> — impacto {hovP.l.impacto}, esfuerzo {hovP.l.esfuerzo}, {hovP.total} tareas</span> : 'Pasa el cursor por una burbuja para ver el proyecto.'}
      </div>
    </div>
  );
}

function Piramide({ piramide, totalActivas }: { piramide: Record<Prio, number>; totalActivas: number }) {
  const orden: Prio[] = ['alta', 'media', 'baja', 'futuro'];
  const max = Math.max(1, ...orden.map((p) => piramide[p]));
  const altaPct = totalActivas ? Math.round((piramide.alta / totalActivas) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {orden.map((p) => (
        <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 62, flex: 'none', fontSize: 12, fontWeight: 600, color: PCOLOR[p] }}>{PLABEL[p]}</span>
          <span style={{ flex: 1, height: 16, borderRadius: 5, background: 'var(--surface-2)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${(piramide[p] / max) * 100}%`, background: PCOLOR[p], minWidth: piramide[p] ? 3 : 0 }} /></span>
          <span style={{ width: 26, flex: 'none', textAlign: 'right', fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{piramide[p]}</span>
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: altaPct > 18 ? '#C8870C' : 'var(--faint)', marginTop: 2 }}>
        {altaPct > 18 ? `⚠ ${altaPct}% en Alta — puede estar inflada; una pirámide sana tiene pocas arriba.` : `${altaPct}% en Alta — foco sano.`}
      </div>
    </div>
  );
}

function AvanceProyectos({ rows }: { rows: { l: Label; total: number; done: number; pct: number }[] }) {
  if (!rows.length) return <Vacio msg="No hay proyectos con este filtro." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', paddingRight: 2 }}>
      {rows.map(({ l, total, done, pct }) => (
        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 150, flex: 'none', fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.emoji} {l.name}</span>
          <span style={{ flex: 1, height: 14, borderRadius: 5, background: 'var(--surface-2)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${pct}%`, background: l.color, minWidth: pct ? 3 : 0 }} /></span>
          <span style={{ width: 74, flex: 'none', textAlign: 'right', fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{total ? `${done}/${total} · ${pct}%` : 'sin tareas'}</span>
        </div>
      ))}
    </div>
  );
}

function Cumplimiento({ data }: { data: { aTiempo: boolean; dias: number }[] }) {
  if (!data.length) return <Vacio msg="Todavía sin datos. Se llena cuando completes tareas que tenían deadline." icon="⏱️" />;
  const aTiempo = data.filter((d) => d.aTiempo).length;
  const tarde = data.length - aTiempo;
  const pct = Math.round((aTiempo / data.length) * 100);
  const promTarde = tarde ? Math.round(data.filter((d) => !d.aTiempo).reduce((s, d) => s + d.dias, 0) / tarde) : 0;
  return (
    <div>
      <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
        <span style={{ width: `${pct}%`, background: '#1E9E57', minWidth: aTiempo ? 4 : 0 }} />
        <span style={{ flex: 1, background: '#D0504A', minWidth: tarde ? 4 : 0 }} />
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 12.5 }}>
        <span style={{ color: '#1E9E57', fontWeight: 600 }}>● {aTiempo} a tiempo ({pct}%)</span>
        <span style={{ color: '#D0504A', fontWeight: 600 }}>● {tarde} tarde{tarde ? ` (~${promTarde} d promedio)` : ''}</span>
      </div>
    </div>
  );
}

function CycleTime({ ciclos }: { ciclos: { dias: number; prio: Prio }[] }) {
  if (!ciclos.length) return <Vacio msg="Todavía sin datos. Se llena cuando cierres tareas que empezaste aquí (crear → completar)." icon="🔄" />;
  const orden: Prio[] = ['alta', 'media', 'baja', 'futuro'];
  const prom = (p: Prio) => { const g = ciclos.filter((c) => c.prio === p); return g.length ? Math.round(g.reduce((s, c) => s + c.dias, 0) / g.length) : null; };
  const max = Math.max(1, ...orden.map((p) => prom(p) ?? 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {orden.map((p) => { const v = prom(p); return (
        <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 62, flex: 'none', fontSize: 12, fontWeight: 600, color: PCOLOR[p] }}>{PLABEL[p]}</span>
          <span style={{ flex: 1, height: 14, borderRadius: 5, background: 'var(--surface-2)', overflow: 'hidden' }}>{v != null && <span style={{ display: 'block', height: '100%', width: `${(v / max) * 100}%`, background: PCOLOR[p], minWidth: 3 }} />}</span>
          <span style={{ width: 44, flex: 'none', textAlign: 'right', fontFamily: MONO, fontSize: 11.5, color: v != null ? 'var(--ink)' : 'var(--faint)' }}>{v != null ? `${v} d` : '—'}</span>
        </div>
      ); })}
    </div>
  );
}

function Corridos({ rows }: { rows: { t: BoardTask; n: number }[] }) {
  if (!rows.length) return <Vacio msg="Todavía sin datos. Aparece cuando muevas el deadline de una tarea más de una vez." icon="📆" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.slice(0, 6).map(({ t, n }) => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#C8870C', background: '#C8870C18', border: '1px solid #C8870C33', borderRadius: 5, padding: '1px 6px', flex: 'none' }}>{n}×</span>
          <span style={{ flex: 1, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
        </div>
      ))}
    </div>
  );
}

function Lista({ items, vacio, icon }: { items: { t: BoardTask; extra: string }[]; vacio: string; icon: string }) {
  if (!items.length) return <Vacio msg={vacio} icon={icon} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 220, overflowY: 'auto', paddingRight: 2 }}>
      {items.slice(0, 12).map(({ t, extra }) => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: PCOLOR[prioFromScore(t.score)], flex: 'none' }}>{t.score}</span>
          <span style={{ flex: 1, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
          <span style={{ flex: 'none', fontSize: 11, color: 'var(--faint)' }}>{extra}</span>
        </div>
      ))}
      {items.length > 12 && <div style={{ fontSize: 11, color: 'var(--faint)', paddingTop: 2 }}>+{items.length - 12} más</div>}
    </div>
  );
}
