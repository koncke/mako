'use client';

// =============================================================================
// RetroTab — lista SIMPLE de retros + detalle VISUAL + wizard con ejecución en vivo
// =============================================================================
// Lista simple (título + período + una línea). Clic → detalle. "+ Nueva Retro"
// abre un wizard: profundidad → alcance (qué áreas) → período (con histórico) →
// tu perspectiva → y transmite la EJECUCIÓN en vivo (streaming NDJSON) mientras
// MaKo lee cada área.

import { useState } from 'react';
import type { Retro, RetroRecoExperimento, RetroRecoTarea } from '@/lib/retro';
import { ayerEnTijuana, diasAntes, primerDiaDelMesEnTijuana } from '@/lib/date-utils';
import { MakoStar, MakoWord } from '@/app/_components/MakoBrand';
import type { Toast } from './ExperimentosApp';
import {
  MONO, SANS, card, btnPrimary, btnGhost, btnDark, pregunta, ayuda, sectionLabel,
  Pill, Markdown, Empty, fmtFechaLarga, fmtDelta, dirLabel,
} from './ui';

// ── Áreas (en sync con AREAS de lib/retro-fuentes.ts). 'experimentos' va siempre. ──
const AREAS_UI = [
  { key: 'adquisicion', label: 'Adquisición · TOFU', sub: 'Meta ads · impresiones → landing → VSL', emoji: '🎯' },
  { key: 'nutricion', label: 'Nutrición · MOFU', sub: 'Leads sin agenda · follow-ups · secuencias', emoji: '🌱' },
  { key: 'conversion', label: 'Conversión · BOFU', sub: 'Agenda → R1 → R2 → cierre · closing', emoji: '🤝' },
  { key: 'creativos', label: 'Creativos y guiones', sub: 'Rendimiento de anuncios y scripts', emoji: '🎬' },
  { key: 'revenue', label: 'Revenue y cobranza', sub: 'Ingresos · CAC · cobranza', emoji: '💰' },
];

type Preset = { key: string; label: string };
const PRESETS: Preset[] = [
  { key: '7', label: 'Últimos 7 días' },
  { key: '30', label: 'Últimos 30 días' },
  { key: 'mes', label: 'Este mes' },
  { key: '90', label: 'Últimos 90 días' },
  { key: 'historico', label: 'Todo el histórico' },
];
function rangoPreset(k: string): { desde?: string; hasta?: string; historico?: boolean } {
  const ayer = ayerEnTijuana();
  if (k === 'historico') return { historico: true };
  if (k === 'mes') return { desde: primerDiaDelMesEnTijuana(), hasta: ayer };
  if (k === '7') return { desde: diasAntes(ayer, 6), hasta: ayer };
  if (k === '90') return { desde: diasAntes(ayer, 89), hasta: ayer };
  return { desde: diasAntes(ayer, 29), hasta: ayer };
}

const PROF_UI = [
  { key: 'rapida', label: 'Rápida', sub: 'los titulares de cada área' },
  { key: 'estandar', label: 'Estándar', sub: 'análisis completo y plan' },
  { key: 'profunda', label: 'Profunda', sub: 'área por área + causas de 2º orden' },
] as const;

export function RetroTab({
  retros, setRetros, refreshRetros, refreshExp, notify, demo, onGoExperiments,
}: {
  retros: Retro[]; setRetros: (r: Retro[]) => void; refreshRetros: () => Promise<void>;
  refreshExp: () => Promise<void>; notify: Toast; demo: boolean; onGoExperiments: () => void;
}) {
  const [selId, setSelId] = useState<number | null>(null);
  const [wizard, setWizard] = useState(false);
  const [applied, setApplied] = useState<Record<string, 'exp' | 'todo'>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const sel = selId != null ? retros.find((r) => r.id === selId) ?? null : null;

  const onGenerada = (retro: Retro) => { setRetros([retro, ...retros]); setSelId(retro.id); setWizard(false); notify('Retro generada'); };

  const borrarRetro = async (id: number) => {
    if (!window.confirm('¿Eliminar esta retrospectiva?')) return;
    setRetros(retros.filter((r) => r.id !== id));
    if (selId === id) setSelId(null);
    if (demo) return;
    try {
      const j = await fetch('/api/retro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'borrar', id }) }).then((r) => r.json());
      if (!j.ok) { notify(j.error || 'No se pudo borrar', 'bad'); refreshRetros(); }
    } catch { refreshRetros(); }
  };

  const aplicarExperimento = async (r: RetroRecoExperimento, key: string) => {
    setBusy(key);
    try {
      const j = await fetch('/api/experimentos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'crear', experimento: {
          titulo: r.titulo, hipotesis: r.hipotesis, cambio: r.cambio, metrica: r.metrica, direccion: r.direccion,
          objetivo_valor: r.objetivo_valor, criterio_exito: r.criterio_exito, ventana_dias: r.ventana_dias,
          origen: 'mako', racional: r.racional, config: { retro_id: sel?.id }, arrancar: true,
        } }) }).then((x) => x.json());
      if (j.ok) { setApplied((a) => ({ ...a, [key]: 'exp' })); await refreshExp(); notify('Experimento iniciado'); }
      else notify(j.error || 'No se pudo iniciar', 'bad');
    } catch (e) { notify(String(e), 'bad'); } finally { setBusy(null); }
  };
  const aplicarTarea = async (r: RetroRecoTarea, key: string) => {
    setBusy(key);
    try {
      const j = await fetch('/api/todo', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'crear', tarea: { titulo: r.titulo, detalle: r.detalle, prioridad: r.prioridad, origen: 'retro', retro_id: sel?.id } }) }).then((x) => x.json());
      if (j.ok) { setApplied((a) => ({ ...a, [key]: 'todo' })); notify('Tarea agregada a To-do'); }
      else notify(j.error || 'No se pudo agregar', 'bad');
    } catch (e) { notify(String(e), 'bad'); } finally { setBusy(null); }
  };

  if (sel) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={() => setSelId(null)} style={{ ...btnGhost, border: 'none', paddingLeft: 0 }}>← Volver a las retros</button>
          <button type="button" onClick={() => borrarRetro(sel.id)} style={{ ...btnGhost, border: 'none', color: 'var(--faint)' }}>🗑 Eliminar</button>
        </div>
        <RetroDetalle retro={sel} applied={applied} busy={busy} onExperimento={aplicarExperimento} onTarea={aplicarTarea} onGoExperiments={onGoExperiments} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 14.5, color: 'var(--dim)', maxWidth: 560, lineHeight: 1.55 }}>
          MaKo lee tu negocio de punta a punta y te deja una <b>lectura clara</b> del período, con un plan de qué probar y qué hacer.
        </p>
        <button type="button" onClick={() => setWizard(true)} style={{ ...btnPrimary, padding: '13px 22px', fontSize: 15, boxShadow: '0 8px 22px rgba(47,111,237,.28)' }}>
          <MakoStar size={15} color="#fff" /> Nueva Retro
        </button>
      </div>

      {retros.length === 0 ? (
        <Empty titulo="Todavía no hay retrospectivas"
          sub="MaKo cruza adquisición, nutrición, conversión, creativos, revenue y tus experimentos, y te deja una lectura del período con un plan.">
          <button type="button" onClick={() => setWizard(true)} style={{ ...btnDark, marginTop: 6 }}>Generar mi primera Retro</button>
        </Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {retros.map((r) => <RetroFila key={r.id} retro={r} onOpen={() => setSelId(r.id)} onBorrar={() => borrarRetro(r.id)} />)}
        </div>
      )}

      {wizard && <NuevaRetroModal onClose={() => setWizard(false)} onGenerada={onGenerada} notify={notify} demo={demo} />}
    </div>
  );
}

// ── Fila de la lista (SIMPLE: título + período + 1 línea; borrar al hover) ──
function RetroFila({ retro, onOpen, onBorrar }: { retro: Retro; onOpen: () => void; onBorrar: () => void }) {
  const [hover, setHover] = useState(false);
  const recos = retro.recomendaciones ?? [];
  const n = recos.length;
  const prof = (retro.snapshot?.profundidad as string) || 'estándar';
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s', borderColor: hover ? 'var(--border-strong)' : 'var(--border)', boxShadow: hover ? '0 6px 18px rgba(18,21,27,.06)' : 'none' }}
      onClick={onOpen}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 4 }}>{retro.titulo}</div>
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>
          {fmtFechaLarga(retro.periodo_desde)} – {fmtFechaLarga(retro.periodo_hasta)} · {prof} · {n} recomendación{n === 1 ? '' : 'es'}
        </div>
      </div>
      <button type="button" onClick={(e) => { e.stopPropagation(); onBorrar(); }} aria-label="Eliminar"
        style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, opacity: hover ? 1 : 0, transition: 'opacity .15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bad-bg)'; e.currentTarget.style.color = 'var(--bad)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--faint)'; }}>🗑</button>
      <span style={{ color: 'var(--faint)', fontSize: 20, flexShrink: 0 }}>›</span>
    </div>
  );
}

// ── Detalle VISUAL ──
function RetroDetalle({
  retro, applied, busy, onExperimento, onTarea, onGoExperiments,
}: {
  retro: Retro; applied: Record<string, 'exp' | 'todo'>; busy: string | null;
  onExperimento: (r: RetroRecoExperimento, key: string) => void;
  onTarea: (r: RetroRecoTarea, key: string) => void; onGoExperiments: () => void;
}) {
  const recos = retro.recomendaciones ?? [];
  const exps = recos.map((r, i) => ({ r, i })).filter((x) => x.r.tipo === 'experimento') as Array<{ r: RetroRecoExperimento; i: number }>;
  const tareas = recos.map((r, i) => ({ r, i })).filter((x) => x.r.tipo === 'tarea') as Array<{ r: RetroRecoTarea; i: number }>;
  const areas = (retro.snapshot?.fuentes as string[] | undefined) ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* hero */}
      <div>
        <div style={sectionLabel}>Retro · {fmtFechaLarga(retro.periodo_desde)} – {fmtFechaLarga(retro.periodo_hasta)}</div>
        <h2 style={{ margin: '7px 0 0', fontSize: 29, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.12, color: 'var(--ink)', maxWidth: 780 }}>{retro.titulo}</h2>
        {areas.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {areas.map((a) => <span key={a} style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 9px' }}>{a}</span>)}
          </div>
        )}
      </div>

      {/* destacados: el DATO, bien visual */}
      {retro.destacados && retro.destacados.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10 }}>
          {retro.destacados.map((d) => {
            const col = d.tono === 'good' ? 'var(--good)' : d.tono === 'bad' ? 'var(--bad)' : 'var(--faint)';
            const arrow = d.delta == null ? '' : d.delta > 0 ? '↑' : d.delta < 0 ? '↓' : '';
            return (
              <div key={d.metrica} style={{ ...card, padding: '13px 14px' }}>
                <div style={{ fontSize: 11.5, color: 'var(--dim)', minHeight: 28, lineHeight: 1.3 }}>{d.label}</div>
                <div style={{ fontFamily: MONO, fontSize: 21, fontWeight: 600, color: 'var(--ink)', marginTop: 3 }}>{d.valor}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  {d.delta != null && <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: col }}>{arrow} {fmtDelta(d.delta)}</span>}
                  <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--faint)' }}>vs {d.valor_prev}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* la lectura */}
      {retro.resumen && (
        <div style={{ ...card, padding: '24px 28px', maxWidth: 780 }}>
          <div style={{ ...sectionLabel, marginBottom: 10 }}>La lectura de MaKo</div>
          <div style={{ fontSize: 15, color: 'var(--ink)' }}><Markdown text={retro.resumen} /></div>
        </div>
      )}

      {/* plan */}
      {(exps.length > 0 || tareas.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          {exps.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>🧪 Probá esto</h3><span style={sectionLabel}>experimentos</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {exps.map(({ r, i }) => {
                  const key = `${retro.id}:${i}`; const done = applied[key] === 'exp';
                  return (
                    <div key={key} style={{ ...card, borderColor: done ? 'var(--good)' : 'var(--border)' }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{r.titulo}</div>
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>{r.hipotesis}</p>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
                        <Pill tone="primary">📏 {r.metrica}</Pill><Pill>objetivo: {dirLabel(r.direccion)}</Pill><Pill>ventana: {r.ventana_dias}d</Pill>
                      </div>
                      {r.racional && <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--faint)', fontStyle: 'italic', lineHeight: 1.5 }}>💡 {r.racional}</p>}
                      <div style={{ marginTop: 14 }}>
                        {done
                          ? <button type="button" onClick={onGoExperiments} style={{ ...btnGhost, color: 'var(--good)', borderColor: 'var(--good)' }}>✓ Iniciado · ver en Experiments →</button>
                          : <button type="button" disabled={busy === key} onClick={() => onExperimento(r, key)} style={{ ...btnPrimary, opacity: busy === key ? 0.6 : 1 }}>{busy === key ? 'Iniciando…' : 'Iniciar experimento'}</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {tareas.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>✅ Hacé esto</h3><span style={sectionLabel}>tareas → To-do</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tareas.map(({ r, i }) => {
                  const key = `${retro.id}:${i}`; const done = applied[key] === 'todo';
                  return (
                    <div key={key} style={{ ...card, borderColor: done ? 'var(--good)' : 'var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{r.titulo}</span>
                          <Pill tone={r.prioridad === 'alta' ? 'bad' : r.prioridad === 'baja' ? 'faint' : 'warn'}>{r.prioridad}</Pill>
                        </div>
                        {r.detalle && <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>{r.detalle}</p>}
                      </div>
                      {done
                        ? <span style={{ ...btnGhost, color: 'var(--good)', borderColor: 'var(--good)', flexShrink: 0 }}>✓ En To-do</span>
                        : <button type="button" disabled={busy === key} onClick={() => onTarea(r, key)} style={{ ...btnDark, flexShrink: 0, opacity: busy === key ? 0.6 : 1 }}>{busy === key ? '…' : '+ To-do'}</button>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Wizard + ejecución en vivo ──
type WStep = 'profundidad' | 'alcance' | 'periodo' | 'perspectiva' | 'ejecutando';
type Ev = { fase: string; label: string };

function NuevaRetroModal({ onClose, onGenerada, notify, demo }: {
  onClose: () => void; onGenerada: (r: Retro) => void; notify: Toast; demo: boolean;
}) {
  const [step, setStep] = useState<WStep>('profundidad');
  const [profundidad, setProfundidad] = useState<'rapida' | 'estandar' | 'profunda'>('estandar');
  const [modoTodo, setModoTodo] = useState(true);
  const [areasSel, setAreasSel] = useState<string[]>([]);
  const [preset, setPreset] = useState('30');
  const [perspectiva, setPerspectiva] = useState('');
  const [pasos, setPasos] = useState<Ev[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const toggleArea = (k: string) => { setModoTodo(false); setAreasSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k])); };
  const areasPayload = modoTodo || areasSel.length === 0 ? [] : areasSel;

  const inputSteps: WStep[] = ['profundidad', 'alcance', 'periodo', 'perspectiva'];
  const idx = inputSteps.indexOf(step);

  const generar = async () => {
    setStep('ejecutando'); setPasos([]); setErr(null);
    const payload = { action: 'generar', ...rangoPreset(preset), perspectiva, profundidad, areas: areasPayload };

    if (demo) { // en local no hay Supabase → simulamos la ejecución para ver el diseño
      const fake = ['Midiendo el funnel del período…', ...(modoTodo ? AREAS_UI : AREAS_UI.filter((a) => areasSel.includes(a.key))).map((a) => `Leyendo ${a.label}…`), 'Leyendo Experimentos…', 'MaKo está escribiendo la retrospectiva…', 'Guardando la retrospectiva…'];
      let i = 0;
      const tick = () => {
        if (i < fake.length) { setPasos((p) => [...p, { fase: `f${i}`, label: fake[i] }]); i++; window.setTimeout(tick, 650); }
        else { notify('En local no se genera (sin Supabase). En producción MaKo la arma con tu dato real.'); onClose(); }
      };
      tick();
      return;
    }

    try {
      const res = await fetch('/api/retro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.body) { const j = await res.json().catch(() => null); if (j?.ok && j.retro) onGenerada(j.retro); else setErr('No se pudo generar'); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: { t?: string; fase?: string; label?: string; retro?: Retro; error?: string };
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.t === 'step' && ev.label) setPasos((p) => [...p, { fase: ev.fase || '', label: ev.label as string }]);
          else if (ev.t === 'done' && ev.retro) { onGenerada(ev.retro); return; }
          else if (ev.t === 'error') { setErr(ev.error || 'Error generando la retro'); return; }
        }
      }
      setErr('La generación terminó sin resultado. Probá de nuevo.');
    } catch (e) { setErr(String(e)); }
  };

  return (
    <div onClick={step === 'ejecutando' ? undefined : onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 18px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 620, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, boxShadow: '0 30px 80px rgba(18,21,27,.4)', overflow: 'hidden', fontFamily: SANS }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>
            <MakoStar size={12} /> <MakoWord base="var(--accent)">MaKo</MakoWord> · nueva retro
          </div>
          {step !== 'ejecutando' && (
            <div style={{ display: 'flex', gap: 6, margin: '0 auto' }}>
              {inputSteps.map((s, i) => <span key={s} style={{ width: i === idx ? 22 : 7, height: 7, borderRadius: 999, background: i <= idx ? 'var(--primary)' : 'var(--border-strong)', transition: 'all .2s' }} />)}
            </div>
          )}
          {step !== 'ejecutando' && <button onClick={onClose} style={{ width: 32, height: 32, flex: 'none', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 15, cursor: 'pointer' }}>✕</button>}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {step === 'profundidad' && (
            <div style={{ padding: '30px 30px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <div><h2 style={pregunta}>¿Qué tan a fondo?</h2><p style={ayuda}>Cuánto va a profundizar MaKo en cada área que elijas.</p></div>
              <div style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PROF_UI.map((p) => {
                  const on = profundidad === p.key;
                  return (
                    <button key={p.key} type="button" onClick={() => setProfundidad(p.key)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '15px 18px', borderRadius: 14, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', cursor: 'pointer', textAlign: 'left' }}>
                      <span><span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, color: 'var(--ink)' }}>{p.label}</span><span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', marginTop: 1 }}>{p.sub}</span></span>
                      {p.key === 'profunda' && <Pill tone="faint">más lento</Pill>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'alcance' && (
            <div style={{ padding: '28px 30px 12px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ textAlign: 'center' }}><h2 style={pregunta}>¿Qué querés que analice?</h2><p style={{ ...ayuda, margin: '8px auto 0' }}>Todo el negocio, o elegí áreas específicas. (Tus experimentos van siempre.)</p></div>
              <button type="button" onClick={() => { setModoTodo(true); setAreasSel([]); }}
                style={{ padding: '14px 18px', borderRadius: 14, border: `1.5px solid ${modoTodo ? 'var(--primary)' : 'var(--border)'}`, background: modoTodo ? 'var(--primary-bg)' : 'var(--surface)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>🧭</span>
                <span><span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, color: 'var(--ink)' }}>Todo el negocio</span><span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)' }}>Adquisición · nutrición · conversión · creativos · revenue</span></span>
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
                {AREAS_UI.map((a) => {
                  const on = !modoTodo && areasSel.includes(a.key);
                  return (
                    <button key={a.key} type="button" onClick={() => toggleArea(a.key)}
                      style={{ padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 19 }}>{a.emoji}</span>
                      <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{a.label}</span><span style={{ display: 'block', fontSize: 11.5, color: 'var(--dim)', marginTop: 1, lineHeight: 1.35 }}>{a.sub}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'periodo' && (
            <div style={{ padding: '30px 30px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
              <div><h2 style={pregunta}>¿Qué período?</h2><p style={ayuda}>MaKo lo compara contra el período anterior de igual largo.</p></div>
              <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PRESETS.map((p) => {
                  const on = preset === p.key;
                  return (
                    <button key={p.key} type="button" onClick={() => setPreset(p.key)}
                      style={{ padding: '14px 18px', borderRadius: 14, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, fontWeight: on ? 600 : 500, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {p.label}{p.key === 'historico' && <Pill tone="faint">todo</Pill>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'perspectiva' && (
            <div style={{ padding: '30px 30px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
              <div><h2 style={pregunta}>¿Tu lectura del período?</h2><p style={ayuda}>Opcional. Qué venís observando o qué te preocupa.</p></div>
              <textarea value={perspectiva} autoFocus onChange={(e) => setPerspectiva(e.target.value)} rows={4} placeholder="Ej.: siento que los leads vienen menos calificados desde que subimos el presupuesto…"
                style={{ width: '100%', maxWidth: 500, padding: '14px 16px', borderRadius: 14, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none', resize: 'vertical', lineHeight: 1.5 }} />
              <div style={{ maxWidth: 500, fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5, textAlign: 'center' }}>⚖️ MaKo la toma como <b>tu hipótesis</b>, no como un hecho: la contrasta con el dato y puede darte la contraria.</div>
            </div>
          )}

          {step === 'ejecutando' && <Ejecucion pasos={pasos} err={err} onClose={onClose} onReintentar={generar} />}
        </div>

        {step !== 'ejecutando' && (
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px' }}>
            <button type="button" onClick={() => (idx > 0 ? setStep(inputSteps[idx - 1]) : onClose())} style={btnGhost}>← {idx > 0 ? 'Atrás' : 'Cancelar'}</button>
            {step === 'perspectiva' ? (
              <button type="button" onClick={generar} style={{ ...btnPrimary, padding: '11px 20px' }}><MakoStar size={13} color="#fff" /> Generar Retro</button>
            ) : (() => {
              const bloqueado = step === 'alcance' && !modoTodo && areasSel.length === 0;
              return (
                <button type="button" disabled={bloqueado} onClick={() => { if (!bloqueado) setStep(inputSteps[idx + 1]); }} style={{ ...btnPrimary, opacity: bloqueado ? 0.5 : 1, cursor: bloqueado ? 'default' : 'pointer' }}>
                  {bloqueado ? 'Elegí un área o "Todo"' : 'Siguiente →'}
                </button>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ejecución en vivo (checklist que se llena con los pasos que llegan por streaming) ──
function Ejecucion({ pasos, err, onClose, onReintentar }: { pasos: Ev[]; err: string | null; onClose: () => void; onReintentar: () => void }) {
  const SPARK = 'M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z';
  const uid = 'exj';
  if (err) {
    return (
      <div style={{ padding: '48px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--bad-bg)', display: 'grid', placeItems: 'center', fontSize: 24, color: 'var(--bad)' }}>!</div>
        <h3 style={pregunta}>No se pudo generar</h3>
        <p style={{ ...ayuda, margin: '4px auto 0' }}>{err}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button type="button" onClick={onClose} style={btnGhost}>Cerrar</button>
          <button type="button" onClick={onReintentar} style={btnDark}>Reintentar</button>
        </div>
      </div>
    );
  }
  const actual = pasos[pasos.length - 1]?.label ?? 'Preparando el análisis…';
  return (
    <div style={{ padding: '40px 34px 34px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .${uid}-spark{transform-box:fill-box;transform-origin:center;animation:${uid}-p 1.5s ease-in-out infinite}
        @keyframes ${uid}-p{0%,100%{transform:scale(.9);opacity:.85}50%{transform:scale(1.12);opacity:1}}
        .${uid}-r{transform-box:fill-box;transform-origin:center;opacity:0;animation:${uid}-s 1.8s ease-out infinite}
        .${uid}-r2{animation-delay:.9s}
        @keyframes ${uid}-s{0%{transform:scale(.5);opacity:.5}100%{transform:scale(2.3);opacity:0}}
      ` }} />
      <svg width={58} height={58} viewBox="-33 -33 66 66" role="img" aria-label="MaKo trabajando">
        <defs><linearGradient id={`${uid}-g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F6D365" /><stop offset="100%" stopColor="#EF9F27" /></linearGradient></defs>
        <circle className={`${uid}-r`} r="13" fill="none" stroke="#EF9F27" strokeWidth="1.5" strokeOpacity=".5" />
        <circle className={`${uid}-r ${uid}-r2`} r="13" fill="none" stroke="#F6D365" strokeWidth="1.5" strokeOpacity=".45" />
        <g transform="scale(1.5)"><path className={`${uid}-spark`} d={SPARK} fill={`url(#${uid}-g)`} /></g>
      </svg>
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ ...pregunta, fontSize: 20 }}>MaKo está analizando tu negocio</h3>
        <p style={{ ...ayuda, margin: '6px auto 0' }}>{actual}</p>
      </div>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {pasos.map((p, i) => {
          const last = i === pasos.length - 1;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: last ? 'var(--primary-bg)' : 'var(--surface-2)', border: `1px solid ${last ? 'var(--primary-weak)' : 'var(--border)'}` }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontSize: 10, background: last ? 'transparent' : 'var(--good)', color: '#fff', border: last ? '2px solid var(--primary)' : 'none' }}>{last ? '' : '✓'}</span>
              <span style={{ fontSize: 13, color: last ? 'var(--primary-strong)' : 'var(--dim)', fontWeight: last ? 600 : 500 }}>{p.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
