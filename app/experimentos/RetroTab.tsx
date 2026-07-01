'use client';

// =============================================================================
// RetroTab — lista de retrospectivas + detalle + wizard "Nueva Retro"
// =============================================================================
// Por defecto se ve la LISTA (título, período, algunos detalles). Clic abre el
// reporte completo. "+ Nueva Retro" abre un wizard SIMPLE (período → tu
// perspectiva → profundidad/foco) al estilo "Nueva campaña".

import { useState } from 'react';
import type { Retro, RetroRecoExperimento, RetroRecoTarea } from '@/lib/retro';
import { ayerEnTijuana, diasAntes, primerDiaDelMesEnTijuana } from '@/lib/date-utils';
import { MakoStar, MakoWord } from '@/app/_components/MakoBrand';
import type { Toast } from './ExperimentosApp';
import {
  MONO, SANS, card, btnPrimary, btnGhost, btnDark, pregunta, ayuda, sectionLabel,
  Pill, Markdown, MakoLoading, Empty, fmtFechaLarga, fmtDelta, dirLabel,
} from './ui';

type Preset = { key: string; label: string; rango: () => { desde: string; hasta: string } };
const PRESETS: Preset[] = [
  { key: '7', label: 'Últimos 7 días', rango: () => ({ desde: diasAntes(ayerEnTijuana(), 6), hasta: ayerEnTijuana() }) },
  { key: '30', label: 'Últimos 30 días', rango: () => ({ desde: diasAntes(ayerEnTijuana(), 29), hasta: ayerEnTijuana() }) },
  { key: 'mes', label: 'Este mes', rango: () => ({ desde: primerDiaDelMesEnTijuana(), hasta: ayerEnTijuana() }) },
  { key: '90', label: 'Últimos 90 días', rango: () => ({ desde: diasAntes(ayerEnTijuana(), 89), hasta: ayerEnTijuana() }) },
];

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

  const onGenerada = (retro: Retro) => {
    setRetros([retro, ...retros]);
    setSelId(retro.id);
    setWizard(false);
    notify('Retro generada');
  };

  const aplicarExperimento = async (r: RetroRecoExperimento, key: string) => {
    setBusy(key);
    try {
      const j = await fetch('/api/experimentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'crear', experimento: {
          titulo: r.titulo, hipotesis: r.hipotesis, cambio: r.cambio, metrica: r.metrica,
          direccion: r.direccion, objetivo_valor: r.objetivo_valor, criterio_exito: r.criterio_exito,
          ventana_dias: r.ventana_dias, origen: 'mako', racional: r.racional, config: { retro_id: sel?.id }, arrancar: true,
        } }),
      }).then((x) => x.json());
      if (j.ok) { setApplied((a) => ({ ...a, [key]: 'exp' })); await refreshExp(); notify('Experimento iniciado'); }
      else notify(j.error || 'No se pudo iniciar', 'bad');
    } catch (e) { notify(String(e), 'bad'); } finally { setBusy(null); }
  };

  const aplicarTarea = async (r: RetroRecoTarea, key: string) => {
    setBusy(key);
    try {
      const j = await fetch('/api/todo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'crear', tarea: { titulo: r.titulo, detalle: r.detalle, prioridad: r.prioridad, origen: 'retro', retro_id: sel?.id } }),
      }).then((x) => x.json());
      if (j.ok) { setApplied((a) => ({ ...a, [key]: 'todo' })); notify('Tarea agregada a To-do'); }
      else notify(j.error || 'No se pudo agregar', 'bad');
    } catch (e) { notify(String(e), 'bad'); } finally { setBusy(null); }
  };

  // ── Detalle de una retro ──
  if (sel) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <button type="button" onClick={() => setSelId(null)} style={{ ...btnGhost, alignSelf: 'flex-start', border: 'none', paddingLeft: 0 }}>← Volver a las retros</button>
        <RetroReport retro={sel} applied={applied} busy={busy} onExperimento={aplicarExperimento} onTarea={aplicarTarea} onGoExperiments={onGoExperiments} />
      </div>
    );
  }

  // ── Lista ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 14.5, color: 'var(--dim)', maxWidth: 560, lineHeight: 1.55 }}>
          MaKo lee tu funnel real, tus experimentos y tus conclusiones de un período, y te deja una <b>lectura con un plan</b> de qué probar y qué hacer.
        </p>
        <button type="button" onClick={() => setWizard(true)} style={{ ...btnPrimary, padding: '13px 22px', fontSize: 15, boxShadow: '0 8px 22px rgba(47,111,237,.28)' }}>
          <MakoStar size={15} color="#fff" /> Nueva Retro
        </button>
      </div>

      {retros.length === 0 ? (
        <Empty titulo="Todavía no hay retrospectivas"
          sub="MaKo lee tu funnel, tus experimentos y tus conclusiones, y te deja una lectura del período con un plan de qué probar y qué hacer.">
          <button type="button" onClick={() => setWizard(true)} style={{ ...btnDark, marginTop: 6 }}>Generar mi primera Retro</button>
        </Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {retros.map((r) => <RetroListItem key={r.id} retro={r} onOpen={() => setSelId(r.id)} />)}
        </div>
      )}

      {wizard && <NuevaRetroModal onClose={() => setWizard(false)} onGenerada={onGenerada} notify={notify} refreshRetros={refreshRetros} demo={demo} />}
    </div>
  );
}

// ── Fila de la lista ──
function RetroListItem({ retro, onOpen }: { retro: Retro; onOpen: () => void }) {
  const recos = retro.recomendaciones ?? [];
  const nExp = recos.filter((r) => r.tipo === 'experimento').length;
  const nTar = recos.filter((r) => r.tipo === 'tarea').length;
  const top = (retro.destacados ?? []).filter((d) => d.tono !== 'neutral').slice(0, 3);
  return (
    <button type="button" onClick={onOpen}
      style={{ ...card, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', transition: 'border-color .15s, box-shadow .15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(18,21,27,.06)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ ...sectionLabel, marginBottom: 5 }}>{fmtFechaLarga(retro.periodo_desde)} – {fmtFechaLarga(retro.periodo_hasta)}</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{retro.titulo}</div>
        <div style={{ marginTop: 8, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {nExp > 0 && <Pill tone="primary">🧪 {nExp} experimento{nExp === 1 ? '' : 's'}</Pill>}
          {nTar > 0 && <Pill>✅ {nTar} tarea{nTar === 1 ? '' : 's'}</Pill>}
        </div>
      </div>
      {top.length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {top.map((d) => (
            <div key={d.metrica} style={{ minWidth: 90 }}>
              <div style={{ fontSize: 10.5, color: 'var(--faint)', fontFamily: MONO, whiteSpace: 'nowrap' }}>{d.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{d.valor}</span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: d.tono === 'good' ? 'var(--good)' : 'var(--bad)' }}>{fmtDelta(d.delta)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <span style={{ color: 'var(--faint)', fontSize: 20 }}>›</span>
    </button>
  );
}

// ── Reporte completo (detalle) ──
function RetroReport({
  retro, applied, busy, onExperimento, onTarea, onGoExperiments,
}: {
  retro: Retro; applied: Record<string, 'exp' | 'todo'>; busy: string | null;
  onExperimento: (r: RetroRecoExperimento, key: string) => void;
  onTarea: (r: RetroRecoTarea, key: string) => void; onGoExperiments: () => void;
}) {
  const recos = retro.recomendaciones ?? [];
  const exps = recos.map((r, i) => ({ r, i })).filter((x) => x.r.tipo === 'experimento') as Array<{ r: RetroRecoExperimento; i: number }>;
  const tareas = recos.map((r, i) => ({ r, i })).filter((x) => x.r.tipo === 'tarea') as Array<{ r: RetroRecoTarea; i: number }>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={sectionLabel}>Retro · {fmtFechaLarga(retro.periodo_desde)} – {fmtFechaLarga(retro.periodo_hasta)}</div>
        <h2 style={{ margin: '6px 0 0', fontSize: 27, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--ink)' }}>{retro.titulo}</h2>
      </div>

      {retro.destacados && retro.destacados.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {retro.destacados.map((d) => (
            <div key={d.metrica} style={{ ...card, padding: 15 }}>
              <div style={{ fontSize: 12, color: 'var(--dim)', minHeight: 30, lineHeight: 1.3 }}>{d.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: 21, fontWeight: 600, color: 'var(--ink)' }}>{d.valor}</span>
                {d.delta != null && <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: d.tono === 'good' ? 'var(--good)' : d.tono === 'bad' ? 'var(--bad)' : 'var(--faint)' }}>{fmtDelta(d.delta)}</span>}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 3 }}>antes {d.valor_prev}</div>
            </div>
          ))}
        </div>
      )}

      {retro.resumen && (
        <div style={{ ...card, padding: '22px 26px', maxWidth: 760 }}>
          <div style={{ fontSize: 14.5, color: 'var(--ink)' }}><Markdown text={retro.resumen} /></div>
        </div>
      )}

      {(exps.length > 0 || tareas.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          {exps.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>🧪 Probá esto</h3>
                <span style={sectionLabel}>experimentos</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {exps.map(({ r, i }) => {
                  const key = `${retro.id}:${i}`; const done = applied[key] === 'exp';
                  return (
                    <div key={key} style={{ ...card, borderColor: done ? 'var(--good)' : 'var(--border)' }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{r.titulo}</div>
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>{r.hipotesis}</p>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
                        <Pill tone="primary">📏 {r.metrica}</Pill>
                        <Pill>objetivo: {dirLabel(r.direccion)}</Pill>
                        <Pill>ventana: {r.ventana_dias}d</Pill>
                      </div>
                      {r.racional && <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--faint)', fontStyle: 'italic', lineHeight: 1.5 }}>💡 {r.racional}</p>}
                      <div style={{ marginTop: 14 }}>
                        {done ? (
                          <button type="button" onClick={onGoExperiments} style={{ ...btnGhost, color: 'var(--good)', borderColor: 'var(--good)' }}>✓ Iniciado · ver en Experiments →</button>
                        ) : (
                          <button type="button" disabled={busy === key} onClick={() => onExperimento(r, key)} style={{ ...btnPrimary, opacity: busy === key ? 0.6 : 1 }}>{busy === key ? 'Iniciando…' : 'Iniciar experimento'}</button>
                        )}
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
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>✅ Hacé esto</h3>
                <span style={sectionLabel}>tareas → To-do</span>
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
                      {done ? (
                        <span style={{ ...btnGhost, color: 'var(--good)', borderColor: 'var(--good)', flexShrink: 0 }}>✓ En To-do</span>
                      ) : (
                        <button type="button" disabled={busy === key} onClick={() => onTarea(r, key)} style={{ ...btnDark, flexShrink: 0, opacity: busy === key ? 0.6 : 1 }}>{busy === key ? '…' : '+ To-do'}</button>
                      )}
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

// ── Wizard "Nueva Retro" ──
type WStep = 'periodo' | 'perspectiva' | 'enfoque' | 'generando';
const FOCOS = [
  { key: '', label: 'Todo el funnel' },
  { key: 'la adquisición (Meta, CPL, CTR, landing)', label: 'Adquisición' },
  { key: 'la conversión (landing → VSL → agenda)', label: 'Conversión' },
  { key: 'el cierre (agendas → cierres, CAC)', label: 'Cierre' },
];

function NuevaRetroModal({ onClose, onGenerada, notify, refreshRetros, demo }: {
  onClose: () => void; onGenerada: (r: Retro) => void; notify: Toast; refreshRetros: () => Promise<void>; demo: boolean;
}) {
  const [step, setStep] = useState<WStep>('periodo');
  const [preset, setPreset] = useState('30');
  const [perspectiva, setPerspectiva] = useState('');
  const [profundidad, setProfundidad] = useState<'rapida' | 'estandar' | 'profunda'>('estandar');
  const [foco, setFoco] = useState('');

  const generar = async () => {
    if (demo) { notify('En local no se genera una Retro (sin Supabase). En producción MaKo la arma con tu dato real.'); onClose(); return; }
    setStep('generando');
    try {
      const { desde, hasta } = (PRESETS.find((p) => p.key === preset) ?? PRESETS[1]).rango();
      const j = await fetch('/api/retro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generar', desde, hasta, perspectiva, profundidad, foco }),
      }).then((r) => r.json());
      if (j.ok && j.retro) onGenerada(j.retro);
      else { notify('No se pudo generar la retro. Probá de nuevo.', 'bad'); onClose(); refreshRetros(); }
    } catch { notify('No se pudo generar la retro. Probá de nuevo.', 'bad'); onClose(); }
  };

  const steps: WStep[] = ['periodo', 'perspectiva', 'enfoque'];
  const idx = steps.indexOf(step);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 18px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 600, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, boxShadow: '0 30px 80px rgba(18,21,27,.4)', overflow: 'hidden', fontFamily: SANS }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>
            <MakoStar size={12} /> <MakoWord base="var(--accent)">MaKo</MakoWord> · nueva retro
          </div>
          {step !== 'generando' && (
            <div style={{ display: 'flex', gap: 6, margin: '0 auto' }}>
              {steps.map((s, i) => <span key={s} style={{ width: i === idx ? 22 : 7, height: 7, borderRadius: 999, background: i <= idx ? 'var(--primary)' : 'var(--border-strong)', transition: 'all .2s' }} />)}
            </div>
          )}
          <button onClick={onClose} style={{ marginLeft: step === 'generando' ? 'auto' : 0, width: 32, height: 32, flex: 'none', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 15, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {step === 'periodo' && (
            <div style={{ padding: '30px 30px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <div><h2 style={pregunta}>¿Qué período querés analizar?</h2><p style={ayuda}>MaKo compara este período contra el anterior de igual largo.</p></div>
              <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PRESETS.map((p) => {
                  const on = preset === p.key;
                  return (
                    <button key={p.key} type="button" onClick={() => setPreset(p.key)}
                      style={{ padding: '15px 18px', borderRadius: 14, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15.5, fontWeight: on ? 600 : 500, cursor: 'pointer', textAlign: 'left' }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'perspectiva' && (
            <div style={{ padding: '30px 30px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
              <div><h2 style={pregunta}>¿Querés darle tu lectura del período?</h2><p style={ayuda}>Opcional. Contale a MaKo qué venís observando o qué te preocupa.</p></div>
              <textarea value={perspectiva} autoFocus onChange={(e) => setPerspectiva(e.target.value)} rows={4} placeholder="Ej.: siento que los leads vienen menos calificados desde que subimos el presupuesto…"
                style={{ width: '100%', maxWidth: 500, padding: '14px 16px', borderRadius: 14, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none', resize: 'vertical', lineHeight: 1.5 }} />
              <div style={{ maxWidth: 500, fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5, textAlign: 'center', display: 'flex', gap: 7, alignItems: 'flex-start', justifyContent: 'center' }}>
                <span>⚖️</span><span>MaKo la toma como <b>tu hipótesis</b>, no como un hecho: la contrasta con el dato y puede darte la contraria.</span>
              </div>
            </div>
          )}

          {step === 'enfoque' && (
            <div style={{ padding: '28px 30px 12px', display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ textAlign: 'center' }}><h2 style={{ ...pregunta, fontSize: 22 }}>¿Qué tan a fondo, y con qué foco?</h2></div>
              <div>
                <div style={{ ...sectionLabel, marginBottom: 8 }}>Profundidad</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {([['rapida', 'Rápida', 'lo esencial'], ['estandar', 'Estándar', 'análisis completo'], ['profunda', 'Profunda', 'causas de 2º orden']] as const).map(([v, l, d]) => {
                    const on = profundidad === v;
                    return (
                      <button key={v} type="button" onClick={() => setProfundidad(v)}
                        style={{ padding: '13px 12px', borderRadius: 13, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{l}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>{d}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={{ ...sectionLabel, marginBottom: 8 }}>Foco (opcional)</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {FOCOS.map((f) => {
                    const on = foco === f.key;
                    return (
                      <button key={f.label} type="button" onClick={() => setFoco(f.key)}
                        style={{ padding: '8px 14px', borderRadius: 999, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: on ? 'var(--primary-strong)' : 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: on ? 600 : 500, cursor: 'pointer' }}>{f.label}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 'generando' && <MakoLoading pasos={['Leyendo tu funnel del período…', 'Cruzando con tus experimentos y conclusiones…', 'Contrastando tu perspectiva con el dato…', 'Buscando la palanca y escribiendo el plan…']} />}
        </div>

        {step !== 'generando' && (
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px' }}>
            <button type="button" onClick={() => (idx > 0 ? setStep(steps[idx - 1]) : onClose())} style={btnGhost}>← {idx > 0 ? 'Atrás' : 'Cancelar'}</button>
            {step === 'enfoque'
              ? <button type="button" onClick={generar} style={{ ...btnPrimary, padding: '11px 20px' }}>Generar Retro</button>
              : <button type="button" onClick={() => setStep(steps[idx + 1])} style={btnPrimary}>{step === 'perspectiva' && !perspectiva.trim() ? 'Saltar →' : 'Siguiente →'}</button>}
          </div>
        )}
        {demo && step !== 'generando' && <div style={{ padding: '0 20px 12px', fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', textAlign: 'center' }}>en local no se genera (sin Supabase); en prod MaKo la arma de verdad</div>}
      </div>
    </div>
  );
}
