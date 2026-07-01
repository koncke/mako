'use client';

// =============================================================================
// RetroTab — la retrospectiva de MaKo (reporte + plan probá/hacé)
// =============================================================================

import { useState } from 'react';
import type { Retro, RetroRecoExperimento, RetroRecoTarea } from '@/lib/retro';
import { ayerEnTijuana, diasAntes, primerDiaDelMesEnTijuana } from '@/lib/date-utils';
import type { Toast } from './ExperimentosApp';
import {
  MONO, SANS, card, btnPrimary, btnGhost, btnDark, sectionLabel,
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
  retros, setRetros, refreshRetros, refreshExp, refreshTareas, notify, demo, onGoExperiments, onGoTodo,
}: {
  retros: Retro[]; setRetros: (r: Retro[]) => void; refreshRetros: () => Promise<void>;
  refreshExp: () => Promise<void>; refreshTareas: () => Promise<void>; notify: Toast; demo: boolean;
  onGoExperiments: () => void; onGoTodo: () => void;
}) {
  const [preset, setPreset] = useState('30');
  const [generando, setGenerando] = useState(false);
  const [selId, setSelId] = useState<number | null>(retros[0]?.id ?? null);
  const [applied, setApplied] = useState<Record<string, 'exp' | 'todo'>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const sel = retros.find((r) => r.id === selId) ?? retros[0] ?? null;

  const generar = async () => {
    if (generando) return;
    if (demo) { notify('En demo no se genera una Retro nueva (local sin Supabase). En producción MaKo la arma con tu dato real.'); return; }
    setGenerando(true);
    try {
      const { desde, hasta } = (PRESETS.find((p) => p.key === preset) ?? PRESETS[1]).rango();
      const j = await fetch('/api/retro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generar', desde, hasta }) }).then((r) => r.json());
      if (j.ok && j.retro) {
        setRetros([j.retro, ...retros]);
        setSelId(j.retro.id);
        notify('Retro generada');
      } else {
        notify(j.error || 'No se pudo generar la retro', 'bad');
        if (!demo) refreshRetros();
      }
    } catch (e) { notify(String(e), 'bad'); } finally { setGenerando(false); }
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
      if (j.ok) { setApplied((a) => ({ ...a, [key]: 'todo' })); await refreshTareas(); notify('Tarea agregada a To-do'); }
      else notify(j.error || 'No se pudo agregar', 'bad');
    } catch (e) { notify(String(e), 'bad'); } finally { setBusy(null); }
  };

  // ── barra de generación ──
  const control = (
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>Retrospectiva de MaKo</div>
        <p style={{ margin: '3px 0 0', fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5 }}>
          MaKo lee tu funnel real, tus experimentos y tus conclusiones del período, y arma una lectura con un plan de qué <b>probar</b> y qué <b>hacer</b>.
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: 3 }}>
          {PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => setPreset(p.key)}
              style={{ padding: '7px 11px', borderRadius: 8, border: 'none', background: preset === p.key ? 'var(--surface)' : 'transparent', color: preset === p.key ? 'var(--ink)' : 'var(--dim)', fontFamily: SANS, fontSize: 12.5, fontWeight: preset === p.key ? 600 : 500, cursor: 'pointer', boxShadow: preset === p.key ? '0 1px 3px rgba(18,21,27,.1)' : 'none' }}>{p.label}</button>
          ))}
        </div>
        <button type="button" onClick={generar} disabled={generando} style={{ ...btnPrimary, opacity: generando ? 0.6 : 1 }}>
          {generando ? 'Analizando…' : retros.length ? 'Generar nueva' : 'Generar Retro'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {control}

      {generando && (
        <div style={card}>
          <MakoLoading pasos={['Leyendo tu funnel del período…', 'Cruzando con tus experimentos y conclusiones…', 'Buscando dónde está la palanca…', 'Escribiendo la retro y el plan…']} />
        </div>
      )}

      {!generando && !sel && (
        <Empty titulo="Todavía no hay retrospectivas"
          sub="MaKo lee tu funnel, tus experimentos en curso y tus conclusiones, y te deja una lectura del período con un plan de qué probar y qué hacer. Elegí un período arriba y generá la primera.">
          <button type="button" onClick={generar} style={{ ...btnDark, marginTop: 6 }}>Generar mi primera Retro</button>
        </Empty>
      )}

      {!generando && sel && (
        <>
          {/* selector de retros previas */}
          {retros.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ ...sectionLabel, marginRight: 2 }}>Retros</span>
              {retros.map((r) => {
                const on = r.id === sel.id;
                return (
                  <button key={r.id} type="button" onClick={() => setSelId(r.id)}
                    style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: on ? 'var(--primary-strong)' : 'var(--dim)', fontFamily: MONO, fontSize: 11.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {fmtFechaLarga(r.periodo_desde)} – {fmtFechaLarga(r.periodo_hasta)}
                  </button>
                );
              })}
            </div>
          )}

          <RetroReport
            retro={sel} applied={applied} busy={busy}
            onExperimento={aplicarExperimento} onTarea={aplicarTarea}
            onGoExperiments={onGoExperiments} onGoTodo={onGoTodo}
          />
        </>
      )}
    </div>
  );
}

function RetroReport({
  retro, applied, busy, onExperimento, onTarea, onGoExperiments, onGoTodo,
}: {
  retro: Retro; applied: Record<string, 'exp' | 'todo'>; busy: string | null;
  onExperimento: (r: RetroRecoExperimento, key: string) => void;
  onTarea: (r: RetroRecoTarea, key: string) => void;
  onGoExperiments: () => void; onGoTodo: () => void;
}) {
  const recos = retro.recomendaciones ?? [];
  const exps = recos.map((r, i) => ({ r, i })).filter((x) => x.r.tipo === 'experimento') as Array<{ r: RetroRecoExperimento; i: number }>;
  const tareas = recos.map((r, i) => ({ r, i })).filter((x) => x.r.tipo === 'tarea') as Array<{ r: RetroRecoTarea; i: number }>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* encabezado */}
      <div>
        <div style={sectionLabel}>Retro · {fmtFechaLarga(retro.periodo_desde)} – {fmtFechaLarga(retro.periodo_hasta)}</div>
        <h2 style={{ margin: '6px 0 0', fontSize: 27, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--ink)' }}>{retro.titulo}</h2>
      </div>

      {/* destacados: DATO duro del funnel */}
      {retro.destacados && retro.destacados.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {retro.destacados.map((d) => (
            <div key={d.metrica} style={{ ...card, padding: 15 }}>
              <div style={{ fontSize: 12, color: 'var(--dim)', minHeight: 30, lineHeight: 1.3 }}>{d.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: 21, fontWeight: 600, color: 'var(--ink)' }}>{d.valor}</span>
                {d.delta != null && (
                  <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: d.tono === 'good' ? 'var(--good)' : d.tono === 'bad' ? 'var(--bad)' : 'var(--faint)' }}>{fmtDelta(d.delta)}</span>
                )}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 3 }}>antes {d.valor_prev}</div>
            </div>
          ))}
        </div>
      )}

      {/* resumen narrativo */}
      {retro.resumen && (
        <div style={{ ...card, padding: '22px 26px', maxWidth: 760 }}>
          <div style={{ fontSize: 14.5, color: 'var(--ink)' }}><Markdown text={retro.resumen} /></div>
        </div>
      )}

      {/* plan: probá / hacé */}
      {(exps.length > 0 || tareas.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          {exps.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>🧪 Probá esto</h3>
                <span style={{ ...sectionLabel }}>experimentos</span>
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
                <span style={{ ...sectionLabel }}>tareas</span>
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
                        <button type="button" onClick={onGoTodo} style={{ ...btnGhost, color: 'var(--good)', borderColor: 'var(--good)', flexShrink: 0 }}>✓ En To-do →</button>
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
