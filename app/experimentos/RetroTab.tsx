'use client';

// =============================================================================
// RetroTab — lista de retros + reporte v3 + wizard con ejecución en vivo
// =============================================================================
// Lista SIMPLE (título-tesis + período + plan aplicado). Clic → RetroReport (el
// reporte compuesto v3, diseño de Claude Design) o el render legacy para retros
// viejas. "+ Nueva Retro" abre el wizard (alcance → período → perspectiva; la
// profundidad ya no se elige: siempre a fondo) y muestra la EJECUCIÓN en vivo:
// stepper de fases + rail de tabs que MaKo va navegando + checklist anidada +
// ticker de hallazgos, todo alimentado por el stream NDJSON real.

import { useEffect, useRef, useState } from 'react';
import type { Retro } from '@/lib/retro';
import type { RetroPlanItem, RetroReporte, RetroStreamEvent, RetroFaseId } from '@/lib/retro-reporte';
import { ayerEnTijuana, diasAntes, primerDiaDelMesEnTijuana, primerDiaDelMesDeFecha } from '@/lib/date-utils';
import { MakoStar, MakoWord } from '@/app/_components/MakoBrand';
import { useConfirm } from '@/app/_components/useConfirm';
import { Icon } from '@/app/_components/icons';
import type { Toast } from './ExperimentosApp';
import { RetroReport } from './RetroReport';
import {
  MONO, SANS, card, btnPrimary, btnGhost, btnDark, pregunta, ayuda, sectionLabel,
  Pill, Markdown, Empty, fmtFechaLarga, fmtDelta,
} from './ui';

// ── Áreas del wizard (en sync con lib/retro-reporte AREA ids) ──
const AREAS_UI = [
  { key: 'adquisicion', label: 'Adquisición · TOFU', sub: 'Meta ads · impresiones → landing → VSL', emoji: '🎯' },
  { key: 'nutricion', label: 'Nutrición · MOFU', sub: 'Leads sin agenda · follow-ups · secuencias', emoji: '🌱' },
  { key: 'conversion', label: 'Conversión · BOFU', sub: 'Agenda → R1 → R2 → cierre · closing', emoji: '🤝' },
  { key: 'creativos', label: 'Creativos y guiones', sub: 'Rendimiento de anuncios y scripts', emoji: '🎬' },
  { key: 'revenue', label: 'Revenue y cobranza', sub: 'Ingresos · CAC · cobranza', emoji: '💰' },
];

const PRESETS = [
  { key: '7', label: 'Últimos 7 días' },
  { key: '30', label: 'Últimos 30 días' },
  { key: 'mes', label: 'Este mes' },
  { key: '90', label: 'Últimos 90 días' },
  { key: 'historico', label: 'Todo el histórico' },
];
function rangoPreset(k: string): { desde?: string; hasta?: string; historico?: boolean } {
  const ayer = ayerEnTijuana();
  if (k === 'historico') return { historico: true };
  if (k === 'mes') {
    // El día 1 del mes "este mes" no tiene días completos todavía → usamos el
    // mes de AYER completo (si no, desde > hasta y el backend rechaza el rango).
    const desde = primerDiaDelMesEnTijuana();
    return desde > ayer ? { desde: primerDiaDelMesDeFecha(ayer), hasta: ayer } : { desde, hasta: ayer };
  }
  if (k === '7') return { desde: diasAntes(ayer, 6), hasta: ayer };
  if (k === '90') return { desde: diasAntes(ayer, 89), hasta: ayer };
  return { desde: diasAntes(ayer, 29), hasta: ayer };
}

export function RetroTab({
  retros, setRetros, refreshRetros, refreshExp, notify, demo,
}: {
  retros: Retro[]; setRetros: (r: Retro[]) => void; refreshRetros: () => Promise<void>;
  refreshExp: () => Promise<void>; notify: Toast; demo: boolean;
}) {
  const [selId, setSelId] = useState<number | null>(null);
  const [wizard, setWizard] = useState(false);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const { confirm, confirmNode } = useConfirm();

  const sel = selId != null ? retros.find((r) => r.id === selId) ?? null : null;

  const onGenerada = (retro: Retro) => { setRetros([retro, ...retros]); setSelId(retro.id); setWizard(false); notify('Retro generada'); };

  const borrar = async (id: number) => {
    if (!(await confirm('¿Eliminar esta retrospectiva?'))) return;
    setRetros(retros.filter((r) => r.id !== id));
    if (selId === id) setSelId(null);
    if (demo) return;
    try {
      const j = await fetch('/api/retro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'borrar', id }) }).then((r) => r.json());
      if (!j.ok) { notify(j.error || 'No se pudo borrar', 'bad'); refreshRetros(); }
    } catch { refreshRetros(); }
  };

  // Acciones del plan (aceptar crea el experimento real + sus tareas en To-do).
  const onPlan = async (item: RetroPlanItem, op: 'aceptar' | 'posponer' | 'descartar' | 'deshacer', motivo?: string) => {
    if (!sel) return;
    if (busyPlanId) return; // una operación por vez: evita el read-modify-write concurrente
    if (demo) { notify('En local no se aplica (sin Supabase); en producción crea el experimento y sus tareas.'); return; }
    setBusyPlanId(item.id);
    try {
      const j = await fetch('/api/retro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'plan', id: sel.id, itemId: item.id, op, motivo }),
      }).then((r) => r.json());
      if (j.ok && j.reporte) {
        setRetros(retros.map((r) => (r.id === sel.id ? { ...r, reporte: j.reporte as RetroReporte } : r)));
        if (op === 'aceptar') { notify(item.kind === 'exp' ? 'Experimento iniciado + tareas en To-do' : 'Tarea agregada a To-do'); refreshExp(); }
      } else notify(j.error || 'No se pudo aplicar', 'bad');
    } catch (e) { notify(String(e), 'bad'); } finally { setBusyPlanId(null); }
  };

  // ── Detalle ──
  if (sel) {
    // Cuándo se corrió + qué período miró. Las dos fechas son distintas y las dos
    // importan: una Retro corrida hace 3 semanas sobre un período viejo es una foto
    // vencida, y sin la primera no hay forma de darse cuenta.
    const periodo = `Corrida el ${fmtFechaLarga(sel.created_at)} · analiza ${fmtFechaLarga(sel.periodo_desde)} – ${fmtFechaLarga(sel.periodo_hasta)}`;
    const alcance = alcanceLabel(sel);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {confirmNode}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={() => setSelId(null)} style={{ ...btnGhost, border: 'none', paddingLeft: 0 }}>← Todas las retros</button>
          <button type="button" onClick={() => borrar(sel.id)} style={{ ...btnGhost, border: 'none', color: 'var(--faint)' }}>🗑 Eliminar</button>
        </div>
        {sel.reporte ? (
          <>
            <h2 style={{ margin: '-6px 0 0', fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.12, color: 'var(--ink)', maxWidth: 820 }}>{sel.titulo}</h2>
            <RetroReport reporte={sel.reporte} periodo={periodo} alcance={alcance} onPlan={onPlan} busyPlanId={busyPlanId} />
          </>
        ) : (
          <LegacyDetalle retro={sel} periodo={periodo} />
        )}
      </div>
    );
  }

  // ── Lista ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {confirmNode}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 14.5, color: 'var(--dim)', maxWidth: 560, lineHeight: 1.55 }}>
          MaKo navega todas tus tabs, cruza los datos y te deja <b>una tesis con su plan</b>. Tú aceptas, pospones o descartas cada recomendación.
        </p>
        <button type="button" onClick={() => setWizard(true)} style={{ ...btnPrimary, padding: '13px 22px', fontSize: 15, boxShadow: '0 8px 22px rgba(47,111,237,.28)' }}>
          <MakoStar size={15} color="#fff" /> Nueva Retro
        </button>
      </div>

      {retros.length === 0 ? (
        <Empty titulo="Todavía no hay retrospectivas"
          sub="MaKo cruza adquisición, nutrición, conversión, creativos, revenue y tus experimentos, y te deja una tesis con un plan accionable.">
          <button type="button" onClick={() => setWizard(true)} style={{ ...btnDark, marginTop: 6 }}>Generar mi primera Retro</button>
        </Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {retros.map((r) => <RetroFila key={r.id} retro={r} onOpen={() => setSelId(r.id)} onBorrar={() => borrar(r.id)} />)}
        </div>
      )}

      {wizard && <NuevaRetroModal onClose={() => setWizard(false)} onGenerada={onGenerada} notify={notify} demo={demo} />}
    </div>
  );
}

function alcanceLabel(r: Retro): string {
  const areas = (r.snapshot?.areas as string[] | undefined) ?? [];
  if (!areas.length || areas.length >= 5) return 'todo el negocio';
  return AREAS_UI.filter((a) => areas.includes(a.key)).map((a) => a.label.split(' ·')[0]).join(' + ') || 'todo el negocio';
}

// ── Fila de la lista ──
function RetroFila({ retro, onOpen, onBorrar }: { retro: Retro; onOpen: () => void; onBorrar: () => void }) {
  const [hover, setHover] = useState(false);
  const plan = retro.reporte?.plan ?? [];
  const n = plan.length || (retro.recomendaciones?.length ?? 0);
  // "Aceptadas", no "✓ aplicadas": aceptar es decir que sí, no es haberlo hecho.
  // El ✓ verde acá contaba el click y hacía creer que el trabajo estaba hecho —
  // la misma mentira que la fase Memoria le contaba al cerebro (ver
  // lib/retro-seguimiento.ts). Lo hecho de verdad se ve al abrir la Retro.
  const aceptadas = plan.filter((p) => p.status?.estado === 'aceptada').length;
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={onOpen}
      style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s', borderColor: hover ? 'var(--border-strong)' : 'var(--border)', boxShadow: hover ? '0 6px 18px rgba(18,21,27,.06)' : 'none' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 4 }}>{retro.titulo}</div>
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>
          {/* Corrida el … = created_at, la fecha que Martín daba por inexistente. El
              dato está desde la mig 0051 y ya ordena esta lista: solo no se pintaba.
              Va PRIMERO porque "¿cuándo fue la última Retro?" es la pregunta que se
              le hace a esta lista; el período analizado es el segundo dato. */}
          Corrida el {fmtFechaLarga(retro.created_at)} · analiza {fmtFechaLarga(retro.periodo_desde)} – {fmtFechaLarga(retro.periodo_hasta)} · {alcanceLabel(retro)} · {n} {n === 1 ? 'recomendación' : 'recomendaciones'}{aceptadas > 0 ? ` · ${aceptadas} aceptada${aceptadas === 1 ? '' : 's'}` : ''}
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

// ── Render legacy (retros anteriores al reporte v3) ──
function LegacyDetalle({ retro, periodo }: { retro: Retro; periodo: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={sectionLabel}>Retro · {periodo} · formato anterior</div>
        <h2 style={{ margin: '6px 0 0', fontSize: 27, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--ink)' }}>{retro.titulo}</h2>
      </div>
      {retro.destacados && retro.destacados.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10 }}>
          {retro.destacados.map((d) => (
            <div key={d.metrica} style={{ ...card, padding: '13px 14px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--dim)', minHeight: 28, lineHeight: 1.3 }}>{d.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 21, fontWeight: 600, color: 'var(--ink)', marginTop: 3 }}>{d.valor}</div>
              {d.delta != null && <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, marginTop: 4, color: d.tono === 'good' ? 'var(--good)' : d.tono === 'bad' ? 'var(--bad)' : 'var(--faint)' }}>{fmtDelta(d.delta)}</div>}
            </div>
          ))}
        </div>
      )}
      {retro.resumen && (
        <div style={{ ...card, padding: '22px 26px', maxWidth: 780 }}>
          <div style={{ fontSize: 14.5, color: 'var(--ink)' }}><Markdown text={retro.resumen} /></div>
        </div>
      )}
      {retro.recomendaciones && retro.recomendaciones.length > 0 && (
        <div>
          <div style={{ ...sectionLabel, marginBottom: 10 }}>Recomendaciones</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {retro.recomendaciones.map((r, i) => (
              <div key={i} style={{ ...card, padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Pill tone={r.tipo === 'experimento' ? 'primary' : 'faint'}>{r.tipo === 'experimento' ? '🧪 Experimento' : '✅ Tarea'}</Pill>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{r.titulo}</span>
                </div>
                <p style={{ margin: '7px 0 0', fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
                  {r.tipo === 'experimento' ? r.hipotesis || r.racional : r.detalle}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Wizard (alcance → período → perspectiva) + Ejecución en vivo
// ═════════════════════════════════════════════════════════════════════════════

type WStep = 'alcance' | 'periodo' | 'perspectiva' | 'ejecutando';

function NuevaRetroModal({ onClose, onGenerada, notify, demo }: {
  onClose: () => void; onGenerada: (r: Retro) => void; notify: Toast; demo: boolean;
}) {
  const [step, setStep] = useState<WStep>('alcance');
  const [modoTodo, setModoTodo] = useState(true);
  const [areasSel, setAreasSel] = useState<string[]>([]);
  const [preset, setPreset] = useState('30');
  const [perspectiva, setPerspectiva] = useState('');
  const [eventos, setEventos] = useState<RetroStreamEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const demoCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); demoCancelRef.current?.(); }, []);

  const toggleArea = (k: string) => { setModoTodo(false); setAreasSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k])); };
  const areasPayload = modoTodo || areasSel.length === 0 ? [] : areasSel;
  const inputSteps: WStep[] = ['alcance', 'periodo', 'perspectiva'];
  const idx = inputSteps.indexOf(step);

  const generar = async () => {
    setStep('ejecutando'); setEventos([]); setErr(null); setIntento((i) => i + 1);

    if (demo) {
      const TAB_DEMO: Record<string, { label: string; icon: string }> = {
        adquisicion: { label: 'Marketing', icon: 'ads' }, nutricion: { label: 'CRM', icon: 'crm' },
        conversion: { label: 'Closing Analyst', icon: 'closing' }, creativos: { label: 'Ads Analyst', icon: 'notepencil' },
        revenue: { label: 'Dashboard', icon: 'graphics' },
      };
      const tabsDemo = (modoTodo ? AREAS_UI : AREAS_UI.filter((a) => areasSel.includes(a.key))).map((a) => TAB_DEMO[a.key]).filter(Boolean);
      demoCancelRef.current?.();
      demoCancelRef.current = simularDemo(tabsDemo, setEventos, () => { notify('En local no se genera (sin Supabase). En producción MaKo la arma con tu dato real.'); onClose(); });
      return;
    }

    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const res = await fetch('/api/retro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generar', ...rangoPreset(preset), perspectiva, areas: areasPayload }),
        signal: ctrl.signal,
      });
      // Errores pre-stream (400/401/5xx) llegan como JSON plano: mostrarlos tal cual.
      if (!res.ok || (res.headers.get('content-type') ?? '').includes('application/json')) {
        const j = await res.json().catch(() => null);
        setErr((j && (j.error as string)) || `Error ${res.status}`);
        return;
      }
      if (!res.body) { setErr('Sin respuesta del servidor'); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      // Procesa una línea NDJSON; devuelve true si el stream terminó (done/error).
      const procesar = (line: string): boolean => {
        if (!line) return false;
        let ev: RetroStreamEvent;
        try { ev = JSON.parse(line) as RetroStreamEvent; } catch { return false; }
        if (ev.t === 'done') { onGenerada(ev.retro as Retro); return true; }
        if (ev.t === 'error') { setErr(ev.error || 'Error generando la retro'); return true; }
        setEventos((p) => [...p, ev]);
        return false;
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (procesar(line)) return;
        }
      }
      // Última línea sin newline (residuo del buffer).
      if (procesar(buf.trim())) return;
      setErr('El servidor cortó la generación antes de terminar (posible límite de tiempo). Reintenta; si pasa seguido, elige menos áreas o un período más corto.');
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setErr('Se cortó la conexión. Prueba de nuevo.');
    }
  };

  return (
    <div onClick={step === 'ejecutando' ? undefined : onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 18px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: step === 'ejecutando' ? 880 : 620, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, boxShadow: '0 30px 80px rgba(18,21,27,.4)', overflow: 'hidden', fontFamily: SANS, transition: 'max-width .25s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>
            <MakoStar size={12} /> <MakoWord base="var(--accent)">MaKo</MakoWord> · nueva retro
          </div>
          {step !== 'ejecutando' && (
            <div style={{ display: 'flex', gap: 6, margin: '0 auto' }}>
              {inputSteps.map((s, i) => <span key={s} style={{ width: i === idx ? 22 : 7, height: 7, borderRadius: 999, background: i <= idx ? 'var(--primary)' : 'var(--border-strong)', transition: 'all .2s' }} />)}
            </div>
          )}
          <button aria-label="Cerrar" onClick={() => { abortRef.current?.abort(); demoCancelRef.current?.(); onClose(); }} style={{ marginLeft: step === 'ejecutando' ? 'auto' : 0, width: 32, height: 32, flex: 'none', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 15, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {step === 'alcance' && (
            <div style={{ padding: '28px 30px 12px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ textAlign: 'center' }}><h2 style={pregunta}>¿Qué quieres que analice?</h2><p style={{ ...ayuda, margin: '8px auto 0' }}>Siempre a fondo. Todo el negocio, o elige áreas. (Tus experimentos van siempre.)</p></div>
              <button type="button" onClick={() => { setModoTodo(true); setAreasSel([]); }}
                style={{ padding: '14px 18px', borderRadius: 14, border: `1.5px solid ${modoTodo ? 'var(--primary)' : 'var(--border)'}`, background: modoTodo ? 'var(--primary-bg)' : 'var(--surface)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>🧭</span>
                <span><span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, color: 'var(--ink)' }}>Todo el negocio</span><span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)' }}>Adquisición · nutrición · conversión · creativos · revenue + cruces entre todas</span></span>
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
              <div><h2 style={pregunta}>¿Tu lectura del período?</h2><p style={ayuda}>Opcional. Qué vienes observando o qué te preocupa.</p></div>
              <textarea value={perspectiva} autoFocus onChange={(e) => setPerspectiva(e.target.value)} rows={4} placeholder="Ej.: siento que los leads vienen menos calificados desde que subimos el presupuesto…"
                style={{ width: '100%', maxWidth: 500, padding: '14px 16px', borderRadius: 14, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none', resize: 'vertical', lineHeight: 1.5 }} />
              <div style={{ maxWidth: 500, fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5, textAlign: 'center' }}>⚖️ MaKo la toma como <b>tu hipótesis</b>, no como un hecho: la contrasta con el dato y puede darte la contraria.</div>
            </div>
          )}

          {step === 'ejecutando' && <Ejecucion key={intento} eventos={eventos} err={err} onClose={onClose} onReintentar={generar} />}
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
                  {bloqueado ? 'Elige un área o "Todo"' : 'Siguiente →'}
                </button>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Simulación de la ejecución en demo (local sin Supabase) ──
function simularDemo(tabs: Array<{ label: string; icon: string }>, setEventos: React.Dispatch<React.SetStateAction<RetroStreamEvent[]>>, onEnd: () => void): () => void {
  const fases: Array<{ id: RetroFaseId; label: string }> = [
    { id: 'memoria', label: 'Memoria' }, { id: 'recoleccion', label: 'Recolección' }, { id: 'auditoria', label: 'Auditoría' },
    { id: 'diagnostico', label: 'Diagnóstico' }, { id: 'cruces', label: 'Cruces' }, { id: 'cerebro', label: 'Organizando' },
    { id: 'verificacion', label: 'Verificando' }, { id: 'redaccion', label: 'Redactando' },
  ];
  const evs: RetroStreamEvent[] = [
    { t: 'plan', fases, tabs: tabs.map((x) => ({ id: x.label, label: x.label, icon: x.icon })) },
    { t: 'fase', fase: 'memoria' }, { t: 'step', fase: 'memoria', label: 'Leyendo el retro anterior y su plan…' },
    { t: 'fase', fase: 'recoleccion' }, { t: 'step', fase: 'recoleccion', label: 'Midiendo el funnel del período…' },
    ...tabs.map((x): RetroStreamEvent => ({ t: 'step', fase: 'recoleccion', label: `Leyendo la tab ${x.label}…`, tab: x.label })),
    { t: 'fase', fase: 'auditoria' }, { t: 'step', fase: 'auditoria', label: 'Auditando qué falta medir…' },
    { t: 'step', fase: 'auditoria', label: 'Hueco: VSL con dato parcial (12 de 30 días)' },
    { t: 'fase', fase: 'diagnostico' },
    ...tabs.map((x): RetroStreamEvent => ({ t: 'step', fase: 'diagnostico', label: `Sacando insights de ${x.label}…`, tab: x.label })),
    { t: 'step', fase: 'diagnostico', label: 'CRM: 304 leads sin un solo mensaje', tab: 'CRM', hallazgo: '304 leads sin tocar (63%)' },
    { t: 'fase', fase: 'cruces' }, { t: 'step', fase: 'cruces', label: 'Cruzando datos entre áreas…' },
    { t: 'step', fase: 'cruces', label: 'Cruce: los nutridos cierran 2.4× más', tab: 'Cruces', hallazgo: 'Nutridos cierran 2.4× más que fríos' },
    { t: 'fase', fase: 'cerebro' }, { t: 'step', fase: 'cerebro', label: 'Priorizando qué mueve la aguja…' },
    { t: 'fase', fase: 'verificacion' }, { t: 'step', fase: 'verificacion', label: 'Verificando cada número citado…' },
    { t: 'fase', fase: 'redaccion' }, { t: 'step', fase: 'redaccion', label: 'Componiendo el reporte…' },
  ];
  let i = 0;
  let tid = 0;
  let cancelado = false;
  const tick = () => {
    if (cancelado) return;
    if (i < evs.length) { const e = evs[i++]; setEventos((p) => [...p, e]); tid = window.setTimeout(tick, e.t === 'fase' ? 260 : 620); }
    else onEnd();
  };
  tick();
  return () => { cancelado = true; window.clearTimeout(tid); };
}

// ── La pantalla de ejecución: stepper de fases + rail de tabs + checklist ──
function Ejecucion({ eventos, err, onClose, onReintentar }: { eventos: RetroStreamEvent[]; err: string | null; onClose: () => void; onReintentar: () => void }) {
  const SPARK = 'M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z';
  const scrollRef = useRef<HTMLDivElement>(null);
  const [segs, setSegs] = useState(0);
  const [idle, setIdle] = useState(0);
  // Marca de tiempo del último evento (el backend late cada ~9s; si algo lo
  // frena, avisamos abajo que MaKo sigue vivo).
  const lastEvRef = useRef(0);
  useEffect(() => { lastEvRef.current = Date.now(); }, [eventos.length]);
  useEffect(() => {
    const id = window.setInterval(() => {
      setSegs((s) => s + 1);
      setIdle(lastEvRef.current ? Math.floor((Date.now() - lastEvRef.current) / 1000) : 0);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [eventos]);

  // Reducir los eventos a: plan, fase actual, steps, estado por tab, ticker.
  const plan = eventos.find((e): e is Extract<RetroStreamEvent, { t: 'plan' }> => e.t === 'plan');
  const fases = plan?.fases ?? [];
  const faseActual = [...eventos].reverse().find((e): e is Extract<RetroStreamEvent, { t: 'fase' }> => e.t === 'fase')?.fase;
  const faseIdx = fases.findIndex((f) => f.id === faseActual);
  const steps = eventos.filter((e): e is Extract<RetroStreamEvent, { t: 'step' }> => e.t === 'step');
  const ticker = [...steps].reverse().find((s) => s.hallazgo)?.hallazgo;

  const tabs = plan?.tabs ?? [];
  const tabActiva = [...steps].reverse().find((s) => s.tab)?.tab;
  const tabsTocadas = new Set(steps.map((s) => s.tab).filter(Boolean));

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

  const actual = steps[steps.length - 1]?.label ?? 'Preparando el análisis…';

  return (
    <div style={{ padding: '20px 26px 24px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 480 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .rxj-spark{transform-box:fill-box;transform-origin:center;animation:rxj-p 1.5s ease-in-out infinite}
        @keyframes rxj-p{0%,100%{transform:scale(.9);opacity:.85}50%{transform:scale(1.12);opacity:1}}
        @keyframes rxj-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        .rxj-step{animation:rxj-in .3s ease}
        @keyframes rxj-blink{0%,100%{opacity:1}50%{opacity:.45}}
      ` }} />

      {/* Stepper de fases */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        {fases.map((f, i) => {
          const done = faseIdx > i;
          const activa = faseIdx === i;
          return (
            <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 600, background: activa ? 'var(--primary-bg)' : done ? 'var(--good-bg)' : 'var(--surface-2)', color: activa ? 'var(--primary-strong)' : done ? 'var(--good)' : 'var(--faint)', border: `1px solid ${activa ? 'var(--primary-weak)' : done ? 'var(--good)' : 'var(--border)'}` }}>
              {done ? '✓' : activa ? <svg width={10} height={10} viewBox="-12 -12 24 24" style={{ overflow: 'visible' }}><path className="rxj-spark" d={SPARK} fill="#EF9F27" /></svg> : '○'} {f.label}
            </span>
          );
        })}
      </div>

      <div style={{ textAlign: 'center' }}>
        <h3 style={{ ...pregunta, fontSize: 19 }}>MaKo está analizando tu negocio</h3>
        <p style={{ margin: '5px 0 0', fontSize: 13.5, color: 'var(--dim)' }}>{actual} <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>· {Math.floor(segs / 60)}:{String(segs % 60).padStart(2, '0')}</span></p>
        {idle > 15 && (
          <p style={{ margin: '4px 0 0', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', animation: 'rxj-blink 1.6s ease-in-out infinite' }}>
            sigue pensando — las fases largas pueden tardar unos minutos
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: 14, flex: 1, minHeight: 0 }}>
        {/* Rail de tabs que MaKo navega */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', margin: '0 0 4px 4px' }}>Navegando</div>
          {tabs.map((t) => {
            const activa = tabActiva === t.label;
            const leida = !activa && tabsTocadas.has(t.label);
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: activa ? 'var(--primary-bg)' : 'transparent', border: `1px solid ${activa ? 'var(--primary-weak)' : 'transparent'}`, transition: 'background .2s' }}>
                {activa
                  ? <svg width={12} height={12} viewBox="-12 -12 24 24" style={{ overflow: 'visible', flex: 'none' }}><path className="rxj-spark" d={SPARK} fill="#EF9F27" /></svg>
                  : <span style={{ width: 12, textAlign: 'center', fontSize: 11, color: leida ? 'var(--good)' : 'var(--border-strong)', flex: 'none' }}>{leida ? '✓' : '○'}</span>}
                {t.icon && <span style={{ flex: 'none', color: activa ? 'var(--primary-strong)' : leida ? 'var(--dim)' : 'var(--faint)', display: 'inline-flex' }}><Icon name={t.icon} size={15} /></span>}
                <span style={{ fontSize: 13, fontWeight: activa ? 600 : 500, color: activa ? 'var(--primary-strong)' : leida ? 'var(--dim)' : 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</span>
              </div>
            );
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9 }}>
            <span style={{ width: 12, textAlign: 'center', fontSize: 11, color: tabsTocadas.has('Cruces') ? 'var(--good)' : 'var(--border-strong)', flex: 'none' }}>{tabsTocadas.has('Cruces') ? '✓' : '⇄'}</span>
            <span style={{ fontSize: 13, color: 'var(--faint)' }}>Cruces</span>
          </div>
        </div>

        {/* Checklist anidada en vivo */}
        <div ref={scrollRef} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', overflowY: 'auto', maxHeight: 320, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {steps.map((s, i) => {
            const last = i === steps.length - 1;
            return (
              <div key={i} className="rxj-step" style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '6px 9px', borderRadius: 9, background: last ? 'var(--surface)' : 'transparent', border: `1px solid ${last ? 'var(--primary-weak)' : 'transparent'}` }}>
                <span style={{ width: 15, height: 15, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontSize: 9, marginTop: 1, background: last ? 'transparent' : 'var(--good)', color: '#fff', border: last ? '2px solid var(--primary)' : 'none', animation: last ? 'rxj-blink 1.2s ease-in-out infinite' : 'none' }}>{last ? '' : '✓'}</span>
                <span style={{ minWidth: 0 }}>
                  {s.tab && <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', display: 'block' }}>{s.tab}</span>}
                  <span style={{ fontSize: 12.5, color: last ? 'var(--primary-strong)' : 'var(--dim)', fontWeight: last ? 600 : 500, lineHeight: 1.4 }}>{s.label}</span>
                </span>
              </div>
            );
          })}
          {steps.length === 0 && <div style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', textAlign: 'center', padding: 20 }}>conectando…</div>}
        </div>
      </div>

      {/* Ticker del último hallazgo */}
      {ticker && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', borderRadius: 11, background: 'var(--warn-bg)', border: '1px solid var(--warn)' }}>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'var(--warn)' }}>(!)</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--warn)' }}>{ticker}</span>
        </div>
      )}
    </div>
  );
}
