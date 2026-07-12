'use client';

// =============================================================================
// BoardShell — la ÚNICA vista del tablero /todo (admin y cliente idénticos)
// =============================================================================
// Recibe un `Board` (useBoard) y pinta todo: header con avance promedio, toggle
// Prioridades/Kanban, 4 columnas de prioridad a ancho completo con DnD, tarjetas
// cuadradas (estilo CRM) con avance editable inline, modal con checklist + coach
// de MaKo + Change history (avatar + deshacer por entrada), editor de proyectos
// con emoji, y el form bloqueante para tareas Alta sin deadline/checklist.

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as RME } from 'react';
import { UndoToast } from '../../_components/UndoToast';
import { ConfirmModal } from '../../_components/ConfirmModal';
import { EmojiPickerMini } from './EmojiPicker';
import { PriorizarWizard } from './PriorizarWizard';
import { MakoChecklistModal } from './MakoChecklist';
import { DebateModal } from './DebateModal';
import { CrearTareaModal } from './CrearTareaModal';
import type { Board } from './useBoard';
import { type BoardTask, type Label, type Prio, type Check, type Actor, PRIOS, PLABEL, PCOLOR, SWATCHES, MAX_PRIORIDAD, uid, relTime, prioFromScore, displayPrio, puedeSerAlta } from './types';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

export function BoardShell({ board }: { board: Board }) {
  // G1/G2 guardián: score→columna, restricción al proyecto top, debate.
  const { tasks, labels, repo } = board;
  const [view, setView] = useState<'prioridades' | 'kanban'>('prioridades');
  const [q, setQ] = useState('');
  const [fLabels, setFLabels] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [projMgr, setProjMgr] = useState(false);
  const [confirm, setConfirm] = useState<{ msg: string; onOk: () => void } | null>(null);
  const [wizardId, setWizardId] = useState<string | null>(null);
  const [debateId, setDebateId] = useState<string | null>(null);
  const [nuevaTarea, setNuevaTarea] = useState(false);
  const [altaUndo, setAltaUndo] = useState<{ id: string; snap: BoardTask } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set()); // gauntlets cerrados (super-admin, temporal)
  const [flash, setFlash] = useState('');

  const ask = (msg: string, onOk: () => void) => setConfirm({ msg, onOk });
  const doFlash = (m: string) => setFlash(m);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(''), 2600); return () => clearTimeout(t); }, [flash]);

  // El guardián es dueño de la ubicación: la columna respeta la restricción
  // (Alta solo para el proyecto top / sin proyecto / emergencia).
  const objetivoPrincipal = labels.length ? labels.slice().sort((a, b) => b.score - a.score)[0] : null;
  const topProjectId = objetivoPrincipal?.id ?? null;
  const esAltaIncompleta = (t: BoardTask) => displayPrio(t, topProjectId) === 'alta' && t.progress < 100 && (!t.deadline || t.checklist.length === 0);

  // ── MaKo perro guardián: NINGUNA tarea puede quedar en Alta sin deadline+
  // checklist. Si hay alguna, se abre el form bloqueante (gauntlet). ──
  useEffect(() => {
    if (wizardId) return;
    const pend = tasks.find((t) => esAltaIncompleta(t) && !dismissed.has(t.id));
    if (pend) setWizardId(pend.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, wizardId, dismissed, topProjectId]);

  const togglePrio = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (t && !t.enPrioridad && !puedeSerAlta(t, topProjectId)) { doFlash('En prioridad solo entra el proyecto Objetivo Principal (o una emergencia)'); return; }
    if (!board.toggleEnPrioridad(id)) doFlash(`En prioridad hay un máximo de ${MAX_PRIORIDAD} tareas`);
  };

  // ── el perro guardián re-puntúa todo el plan (score 1-100 / 1-5) ──
  const [repriorizando, setRepriorizando] = useState(false);
  const rePriorizar = async () => {
    if (repriorizando) return;
    setRepriorizando(true);
    const proyectos = labels.map((l) => ({ id: l.id, nombre: l.name }));
    const tareasIn = tasks.filter((t) => t.progress < 100).map((t) => ({ id: t.id, titulo: t.title, detalle: t.detalle, proyecto: board.labelById(t.labels[0])?.name ?? '', deadline: t.deadline, avance: t.progress, origen: t.origen }));
    try {
      const j = await fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proyectos, tareas: tareasIn }) }).then((r) => r.json());
      if (j.ok) { board.applyGuardian(j.tareas || [], j.proyectos || []); doFlash('MaKo re-priorizó el plan'); }
      else doFlash(j.error || 'MaKo no pudo re-priorizar ahora');
    } catch { doFlash('MaKo no pudo re-priorizar ahora'); }
    setRepriorizando(false);
  };
  // al cerrar el form de un pase-a-Alta: cartel de 5s para DESHACER TODO (el movimiento
  // + el deadline/checklist que se acaban de cargar) restaurando el snapshot previo.
  const cerrarWizard = () => {
    if (altaUndo && altaUndo.id === wizardId) { const snap = altaUndo.snap; board.showUndo('Movida a Alta', () => board.replaceTask(snap)); setAltaUndo(null); }
    setWizardId(null);
  };

  const passes = (t: BoardTask) => (!q || (t.title + ' ' + t.detalle).toLowerCase().includes(q.toLowerCase())) && (fLabels.size === 0 || t.labels.some((l) => fLabels.has(l)));
  const visibles = tasks.filter(passes);
  const avg = tasks.length ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length) : 0;
  const hechas = tasks.filter((t) => t.progress >= 100).length;
  const enPrio = tasks.filter((t) => t.enPrioridad && t.progress < 100);
  const enPrioAll = tasks.filter((t) => t.enPrioridad);
  const prioAvg = enPrioAll.length ? Math.round(enPrioAll.reduce((s, t) => s + t.progress, 0) / enPrioAll.length) : 0;
  const prioHechas = enPrioAll.filter((t) => t.progress >= 100).length;
  const openTask = tasks.find((t) => t.id === openId) ?? null;
  const wizardTask = tasks.find((t) => t.id === wizardId) ?? null;
  const debateTask = tasks.find((t) => t.id === debateId) ?? null;
  // resumen del plan para que el guardián compare al debatir/crear
  const planResumen = tasks.filter((t) => t.progress < 100).map((t) => `- [${t.score}] ${t.title} (${board.labelById(t.labels[0])?.name ?? 'sin proyecto'})`).join('\n');

  // crear una tarea: el GUARDIÁN la puntúa (con el argumento) y decide su columna.
  const crearConGuardian = async (title: string, detalle: string, argumento: string) => {
    const t = await board.create(title, 'media');
    if (!t) return null;
    if (detalle) board.setDetalle(t.id, detalle, '');
    const argFinal = argumento || '(el usuario no dio argumento: puntualo por impacto objetivo comparándolo con el resto del plan)';
    try {
      const j = await fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'debatir', tarea: title + (detalle ? `\n\n${detalle}` : ''), scoreActual: 50, argumento: argFinal, plan: planResumen }) }).then((r) => r.json());
      if (j.ok && typeof j.score === 'number') {
        board.setScore(t.id, j.score, `Priorizada al crear · score ${j.score}`, 'ia', j.razon);
        return { score: j.score, razon: j.razon ?? '', respuesta: j.respuesta ?? '', prio: displayPrio({ ...t, score: j.score }, topProjectId) };
      }
    } catch { /* fallback abajo */ }
    return { score: 50, razon: '', respuesta: 'No pude priorizar ahora; quedó en Media. Podés debatirla después.', prio: 'media' as Prio };
  };

  return (
    <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: SANS }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 30px 14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3 }}>
          {(['prioridades', 'kanban'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ border: 'none', background: view === v ? 'var(--surface)' : 'transparent', color: view === v ? 'var(--ink)' : 'var(--dim)', fontWeight: view === v ? 600 : 500, fontSize: 13.5, padding: '7px 15px', borderRadius: 999, cursor: 'pointer', boxShadow: view === v ? '0 1px 2px rgba(18,21,27,.08)' : 'none', fontFamily: 'inherit', textTransform: 'capitalize' }}>{v}</button>
          ))}
        </div>
        {view === 'kanban'
          ? <AvgChip avg={avg} hechas={hechas} total={tasks.length} label="del plan" />
          : <AvgChip avg={prioAvg} hechas={prioHechas} total={enPrioAll.length} label="en prioridad" />}
        <button onClick={() => setNuevaTarea(true)} style={{ ...ghostBtn, background: 'var(--surface)', color: 'var(--ink)', fontWeight: 600 }}>+ Nueva tarea</button>
        {view === 'kanban' && <>
          <button onClick={rePriorizar} disabled={repriorizando} title="El perro guardián re-puntúa todo el plan" style={{ ...ghostBtn, display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--primary-bg)', color: 'var(--primary)', borderColor: 'var(--primary-weak)', opacity: repriorizando ? 0.6 : 1 }}>🛡️ {repriorizando ? 'Priorizando…' : 'Re-priorizar'}</button>
          <button onClick={() => setProjMgr(true)} style={{ ...ghostBtn, display: 'inline-flex', alignItems: 'center', gap: 7 }}><PencilIcon />{repo.labelPlural}</button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" style={{ flex: 1, minWidth: 120, maxWidth: 210, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none' }} />
          <FilterMenu labels={labels} fLabels={fLabels} setFLabels={setFLabels} />
        </>}
        <span style={{ flex: 1 }} />
      </header>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {view === 'prioridades'
          ? <Prioridades tasks={enPrio} board={board} objetivo={objetivoPrincipal} onOpen={setOpenId} onToggle={togglePrio} />
          : <Kanban tasks={visibles} board={board} topProjectId={topProjectId} onOpen={setOpenId} onNew={() => setNuevaTarea(true)} onToggle={togglePrio} onWarn={setWizardId} />}
      </div>

      {openTask && <TaskModal key={openTask.id} t={openTask} board={board} topProjectId={topProjectId} onToggle={togglePrio} onDebate={() => setDebateId(openTask.id)} ask={ask} onClose={() => setOpenId(null)} />}
      {debateTask && <DebateModal task={debateTask} planResumen={planResumen} onApply={(score, razon) => board.setScore(debateTask.id, score, `Debate con MaKo · score ${score}`, 'ia', razon)} onClose={() => setDebateId(null)} />}
      {nuevaTarea && <CrearTareaModal onCrear={crearConGuardian} onClose={() => setNuevaTarea(false)} />}
      {projMgr && <ProjectsManager board={board} ask={ask} onClose={() => setProjMgr(false)} />}
      {wizardTask && <PriorizarWizard task={wizardTask}
        dismissable={repo.dismissableGauntlet}
        onDismiss={() => { setDismissed((s) => new Set(s).add(wizardTask.id)); setAltaUndo(null); setWizardId(null); }}
        onSetDeadline={(d) => board.setDeadline(wizardTask.id, d, wizardTask.deadline)}
        onSetChecklist={(c) => board.setChecklist(wizardTask.id, c, `Definió el checklist (${c.length})`)}
        onDowngrade={(p) => { board.moveTo(wizardTask.id, p); setAltaUndo(null); }}
        onDone={cerrarWizard} />}
      {confirm && <ConfirmModal msg={confirm.msg} onOk={() => { confirm.onOk(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}
      {flash && <div style={{ position: 'fixed', left: '50%', bottom: 84, transform: 'translateX(-50%)', zIndex: 250, background: '#14161B', color: '#F3F5F8', padding: '10px 16px', borderRadius: 10, fontSize: 13.5, boxShadow: '0 12px 32px rgba(18,21,27,.35)' }}>{flash}</div>}
      <UndoToast state={board.undo} onClose={board.clearUndo} />
    </main>
  );
}

// ── átomos ────────────────────────────────────────────────────────────────────
const ghostBtn: CSSProperties = { padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 500, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS };
const selStyle: CSSProperties = { appearance: 'none', WebkitAppearance: 'none', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: SANS, width: '100%' };

function PencilIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>; }
function FunnelIcon({ color = 'currentColor' }: { color?: string }) { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>; }

function AvgChip({ avg, hechas, total, label }: { avg: number; hechas: number; total: number; label: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px' }}>
      <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{avg}%</span>
      <span style={{ display: 'block', width: 74, height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: avg + '%', background: 'var(--primary)' }} /></span>
      <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{hechas}/{total} {label}</span>
    </div>
  );
}

function LabelChip({ l }: { l: Label }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: l.color, background: l.color + '14', border: `1px solid ${l.color}33`, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>{l.emoji} {l.name}</span>;
}
function StarPrioridad({ on, onClick, size = 15 }: { on: boolean; onClick: (e: RME) => void; size?: number }) {
  return <button onClick={onClick} title="En prioridad" aria-pressed={on} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: size, lineHeight: 1, color: on ? 'var(--accent-soft, #C8870C)' : 'var(--faint)', padding: 2 }}>{on ? '★' : '☆'}</button>;
}
function MiniBar({ v }: { v: number }) {
  return <span style={{ display: 'block', height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: v + '%', background: 'var(--primary)' }} /></span>;
}
// score del guardián (1-100), coloreado por la columna que define.
function ScoreBadge({ score }: { score: number }) {
  const c = PCOLOR[prioFromScore(score)];
  return <span title="Prioridad del guardián (1-100)" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: MONO, fontSize: 10, fontWeight: 700, color: c, background: c + '18', border: `1px solid ${c}33`, borderRadius: 5, padding: '1px 5px' }}>⚡{score}</span>;
}
// Chip de origen: solo para tareas creadas por MaKo (✦ Origen IA), al lado del tag.
function OrigenChip({ origen }: { origen: Actor }) {
  if (origen !== 'ia') return null;
  return <span title="Creada por MaKo" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--surface)', border: '1px solid var(--primary-weak)', borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap' }}>✦ Origen IA</span>;
}
// Avatar para el change history: IA → ✦ MaKo; usuario → foto de perfil o inicial.
function ActorAvatar({ actor, nombre, avatarUrl, size = 24 }: { actor: Actor; nombre: string; avatarUrl: string; size?: number }) {
  if (actor === 'ia') return <span title="MaKo" style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent)' + '1f', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.55, flex: 'none' }}>✦</span>;
  if (avatarUrl) /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={avatarUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />;
  const ini = (nombre || 'U').trim().slice(0, 1).toUpperCase();
  return <span style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, fontWeight: 700, flex: 'none' }}>{ini}</span>;
}

// ── tarjeta (cuadrada, estilo CRM; la columna la decide el guardián, no se arrastra) ─
function CardTile({ t, board, warn, onOpen, onToggle, onWarn }: {
  t: BoardTask; board: Board; warn: boolean; onOpen: (id: string) => void; onToggle: (id: string) => void; onWarn: (id: string) => void;
}) {
  const done = t.progress >= 100;
  const clDone = t.checklist.filter((c) => c.done).length;
  const chips = t.labels.map((id) => board.labelById(id)).filter((l): l is Label => l != null);
  const [prog, setProg] = useState<number | null>(null);
  const shown = prog ?? t.progress;
  const commit = () => { if (prog != null) board.setProgress(t.id, prog, t.progress); setProg(null); };
  return (
    <div onClick={() => onOpen(t.id)}
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '14px 15px', cursor: 'pointer', opacity: done ? 0.62 : 1, minHeight: 158, display: 'flex', flexDirection: 'column', transition: 'border-color .12s' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {chips.map((l) => <LabelChip key={l.id} l={l} />)}
        <OrigenChip origen={t.origen} />
        <span style={{ flex: 1 }} />
        <StarPrioridad on={t.enPrioridad} onClick={(e) => { e.stopPropagation(); onToggle(t.id); }} size={14} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.35, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', marginBottom: 8, wordBreak: 'break-word' }}>{t.title}</div>
      <span style={{ flex: 1 }} />
      {warn && <button onClick={(e) => { e.stopPropagation(); onWarn(t.id); }} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: 'var(--bad)', background: 'var(--bad-bg)', border: 'none', borderRadius: 999, padding: '2px 8px', cursor: 'pointer', marginBottom: 8 }}>⚠ falta {!t.deadline ? 'deadline' : 'checklist'}</button>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <ScoreBadge score={t.score} />
        <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--faint)' }}>#{t.num}</span>
        {t.deadline && <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--dim)' }}>◷ {t.deadline.slice(5)}</span>}
        {t.checklist.length > 0 && <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>☑ {clDone}/{t.checklist.length}</span>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--dim)' }}>{shown}%</span>
      </div>
      {/* avance: si hay checklist se DERIVA de ella (solo lectura); si no, slider editable inline */}
      {t.checklist.length > 0
        ? <MiniBar v={t.progress} />
        : <input type="range" min={0} max={100} step={5} value={shown} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setProg(Number(e.target.value))} onMouseUp={commit} onKeyUp={commit} onTouchEnd={commit}
            style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }} draggable={false} />}
    </div>
  );
}

// ── vista Kanban (4 columnas por prioridad derivada del score; ancho completo) ──
function Kanban({ tasks, board, topProjectId, onOpen, onNew, onToggle, onWarn }: {
  tasks: BoardTask[]; board: Board; topProjectId: string | null; onOpen: (id: string) => void; onNew: () => void; onToggle: (id: string) => void; onWarn: (id: string) => void;
}) {
  const objetivo = topProjectId ? board.labelById(topProjectId) : null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, padding: '4px 30px 30px', height: '100%', alignItems: 'flex-start' }} className="mako-board">
      <style>{`@media (max-width:1000px){.mako-board{grid-template-columns:repeat(2,1fr)!important}}@media (max-width:560px){.mako-board{grid-template-columns:1fr!important}}`}</style>
      {PRIOS.map((p) => {
        const items = tasks.filter((t) => displayPrio(t, topProjectId) === p).sort((a, b) => (a.progress >= 100 ? 1 : 0) - (b.progress >= 100 ? 1 : 0) || b.score - a.score || a.num - b.num);
        return (
          <section key={p} style={{ display: 'flex', flexDirection: 'column', maxHeight: '100%', minWidth: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '3px solid ' + PCOLOR[p], borderRadius: 14, padding: 10 }}>
            <ColHeader p={p} count={items.length} onNew={onNew} nota={p === 'alta' && objetivo ? `solo ${objetivo.emoji} ${objetivo.name} · o emergencias` : undefined} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto', minHeight: 30, paddingRight: 2 }}>
              {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', padding: '14px 0' }}>—</div>}
              {items.map((t) => <CardTile key={t.id} t={t} board={board} warn={displayPrio(t, topProjectId) === 'alta' && t.progress < 100 && (!t.deadline || t.checklist.length === 0)} onOpen={onOpen} onToggle={onToggle} onWarn={onWarn} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
function ColHeader({ p, count, onNew, nota }: { p: Prio; count: number; onNew: () => void; nota?: string }) {
  return (
    <div style={{ flex: 'none', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 3px 8px' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: PCOLOR[p], flex: 'none' }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--dim)' }}>{PLABEL[p]}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', background: 'var(--surface-2)', borderRadius: 999, padding: '1px 8px' }}>{count}</span>
        <span style={{ flex: 1 }} />
        <button onClick={onNew} title="Nueva tarea (la prioriza MaKo)" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--dim)', fontSize: 18, lineHeight: 1, padding: '0 3px' }}>+</button>
      </div>
      {nota && <div style={{ fontSize: 10, color: 'var(--faint)', padding: '0 3px 8px', lineHeight: 1.3 }}>{nota}</div>}
    </div>
  );
}

// ── vista Prioridades (Objetivo Principal + máx 3 tareas, checklist desplegable) ─
function Prioridades({ tasks, board, objetivo, onOpen, onToggle }: { tasks: BoardTask[]; board: Board; objetivo: Label | null; onOpen: (id: string) => void; onToggle: (id: string) => void }) {
  const [expand, setExpand] = useState<Set<string>>(new Set());
  const toggleExp = (id: string) => setExpand((s) => { const c = new Set(s); if (c.has(id)) c.delete(id); else c.add(id); return c; });
  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '18px 30px 40px' }}>
      <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {objetivo && (
          <div style={{ background: 'var(--surface)', border: `1px solid ${objetivo.color}59`, borderLeft: `4px solid ${objetivo.color}`, borderRadius: 16, padding: '18px 22px' }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.15em', textTransform: 'uppercase', color: objetivo.color, fontWeight: 700, marginBottom: 6 }}>🎯 Objetivo Principal · prioridad {objetivo.score}/5</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{objetivo.emoji} {objetivo.name}</div>
            <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 4 }}>El norte de todo ahora. Lo que MaKo protege por encima del resto.</div>
          </div>
        )}
        <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700, textAlign: 'center' }}>⭐ En prioridad · {tasks.length}/{MAX_PRIORIDAD}</div>
        {tasks.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--faint)', textAlign: 'center', padding: '24px 20px', border: '1px dashed var(--border-strong)', borderRadius: 14 }}>
            <div style={{ fontSize: 14, maxWidth: 380, lineHeight: 1.5 }}>Marcá hasta {MAX_PRIORIDAD} tareas con la <span style={{ color: 'var(--accent-soft, #C8870C)' }}>★</span> para tener adelante lo poco que importa ahora.</div>
          </div>
        )}
        {tasks.slice().sort((a, b) => a.progress - b.progress).map((t) => {
          const chips = t.labels.map((id) => board.labelById(id)).filter((l): l is Label => l != null);
          const clDone = t.checklist.filter((c) => c.done).length;
          const open = expand.has(t.id);
          return (
            <div key={t.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 26px', boxShadow: '0 1px 2px rgba(18,21,27,.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {chips.map((l) => <LabelChip key={l.id} l={l} />)}
                <span style={{ flex: 1 }} /><StarPrioridad on onClick={(e) => { e.stopPropagation(); onToggle(t.id); }} size={18} />
              </div>
              <div onClick={() => onOpen(t.id)} style={{ fontSize: 21, fontWeight: 600, lineHeight: 1.3, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: t.detalle ? 12 : 14, cursor: 'pointer' }}>{t.title}</div>
              {t.detalle && <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.55, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.detalle}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: t.checklist.length ? 12 : 0 }}>
                <span style={{ flex: 1 }}><MiniBar v={t.progress} /></span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--dim)' }}>{t.progress}%</span>
                {t.checklist.length > 0 && <button onClick={() => toggleExp(t.id)} style={{ border: 'none', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{open ? '▾' : '▸'} checklist {clDone}/{t.checklist.length}</button>}
              </div>
              {open && t.checklist.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  {t.checklist.map((c) => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '3px 0' }}>
                      <button onClick={() => board.setChecklist(t.id, t.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)), c.done ? undefined : `Completó "${c.text.slice(0, 30)}"`)} style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${c.done ? 'var(--good)' : 'var(--border-strong)'}`, background: c.done ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 11, cursor: 'pointer', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.done ? '✓' : ''}</button>
                      <span style={{ fontSize: 13.5, color: c.done ? 'var(--faint)' : 'var(--ink)', textDecoration: c.done ? 'line-through' : 'none' }}>{c.text}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── filtro por etiqueta ─────────────────────────────────────────────────────────
function FilterMenu({ labels, fLabels, setFLabels }: { labels: Label[]; fLabels: Set<string>; setFLabels: (s: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const n = fLabels.size;
  const toggle = (id: string) => { const c = new Set(fLabels); if (c.has(id)) c.delete(id); else c.add(id); setFLabels(c); };
  return (
    <span style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ position: 'relative', ...ghostBtn, display: 'inline-flex', alignItems: 'center', gap: 7, background: open ? 'var(--surface-2)' : 'var(--surface)', color: n > 0 ? 'var(--primary)' : 'var(--dim)', borderColor: n > 0 ? 'var(--primary-weak)' : 'var(--border-strong)' }}>
        <FunnelIcon color="var(--primary)" />Filtrar
        {n > 0 && <span onClick={(e) => { e.stopPropagation(); setFLabels(new Set()); }} title="Limpiar" style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>{n}</span>}
      </button>
      {open && <>
        <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'absolute', top: 40, right: 0, zIndex: 41, width: 234, maxHeight: 380, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(18,21,27,.16)', padding: 8 }}>
          {labels.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--faint)', padding: '6px 9px' }}>Sin etiquetas</div> : labels.map((l) => (
            <button key={l.id} onClick={() => toggle(l.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 9px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--ink)', textAlign: 'left', fontFamily: SANS }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, border: `1px solid ${fLabels.has(l.id) ? 'var(--primary)' : 'var(--border-strong)'}`, background: fLabels.has(l.id) ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{fLabels.has(l.id) ? '✓' : ''}</span>
              <span>{l.emoji} {l.name}</span>
            </button>
          ))}
        </div>
      </>}
    </span>
  );
}

// ── change history (avatar + nombre + deshacer por entrada) ─────────────────────
function ChangeHistory({ t, board, ask }: { t: BoardTask; board: Board; ask: (msg: string, onOk: () => void) => void }) {
  const [nowMs, setNowMs] = useState(0);
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setNowMs(Date.now()); }, []);
  const { nombre, avatarUrl } = board.user;
  if (t.historial.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin actividad todavía. Los cambios van a aparecer acá.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {t.historial.map((h, i) => {
        const esCreacion = h.text.startsWith('Creó la tarjeta');
        return (
          <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <ActorAvatar actor={h.actor} nombre={nombre} avatarUrl={avatarUrl} size={26} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}><strong style={{ fontWeight: 600 }}>{h.actor === 'ia' ? 'MaKo' : (nombre || 'Usuario')}</strong> · {esCreacion ? (h.actor === 'ia' ? 'Creada por la IA' : `Creada por ${nombre || 'vos'}`) : h.text}</div>
              <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{relTime(h.ts, nowMs)}</div>
            </div>
            {/* solo el ÚLTIMO cambio se puede deshacer (1 en 1, tipo ctrl-z) */}
            {i === 0 && h.undo && <button onClick={() => ask('Se revierte este cambio y se borra del historial. ¿Seguir?', () => board.undoHist(t.id, h))} title="Deshacer el último cambio" style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 8, padding: '4px 9px', fontSize: 12, cursor: 'pointer', flex: 'none', fontFamily: SANS }}>↶ Deshacer</button>}
          </div>
        );
      })}
    </div>
  );
}

// ── modal de detalle ────────────────────────────────────────────────────────────
function TaskModal({ t, board, topProjectId, onToggle, onDebate, ask, onClose }: {
  t: BoardTask; board: Board; topProjectId: string | null; onToggle: (id: string) => void; onDebate: () => void; ask: (msg: string, onOk: () => void) => void; onClose: () => void;
}) {
  const prioEfectiva = displayPrio(t, topProjectId);
  const topeada = prioEfectiva !== prioFromScore(t.score);
  const [newItem, setNewItem] = useState('');
  const [mako, setMako] = useState(false);
  const [titleDraft, setTitleDraft] = useState(t.title);
  const [detalleDraft, setDetalleDraft] = useState(t.detalle);
  const [progDraft, setProgDraft] = useState<number | null>(null);
  const progShown = progDraft ?? t.progress;
  const commitProg = () => { if (progDraft != null) board.setProgress(t.id, progDraft, t.progress); setProgDraft(null); };

  // commit de título/detalle al DESMONTAR (Escape/cierre no dispara onBlur del textarea)
  const tRef = useRef(t); tRef.current = t;
  const tdRef = useRef(titleDraft); tdRef.current = titleDraft;
  const ddRef = useRef(detalleDraft); ddRef.current = detalleDraft;
  useEffect(() => () => {
    board.setTitle(tRef.current.id, tdRef.current, tRef.current.title);
    board.setDetalle(tRef.current.id, ddRef.current, tRef.current.detalle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Escape cierra la ficha, salvo que haya un submodal de MaKo abierto
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !mako) onClose(); };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [mako, onClose]);
  const chips = t.labels.map((id) => board.labelById(id)).filter((l): l is Label => l != null);
  const disponibles = board.labels.filter((l) => !t.labels.includes(l.id));
  const cl = t.checklist; const clDone = cl.filter((c) => c.done).length;
  const setCl = (next: Check[], log?: string) => board.setChecklist(t.id, next, log);
  const optimizada = t.historial.some((h) => h.text.startsWith('MaKo'));
  const rowLabel: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6, display: 'block' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 16px 16px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 820, maxHeight: '85vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', fontWeight: 600 }}>#{t.num}</span>
          {chips.map((l) => <LabelChip key={l.id} l={l} />)}
          <OrigenChip origen={t.origen} />
          <span style={{ flex: 1 }} />
          <button onClick={() => setMako(true)} title={optimizada ? 'Ya optimizada por MaKo — podés volver a pedirle ayuda' : 'MaKo te ayuda a mejorar título, detalle y checklist'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${optimizada ? 'var(--good)' : 'var(--primary-weak)'}`, background: optimizada ? 'var(--good-bg, var(--surface))' : 'var(--primary-bg)', color: optimizada ? 'var(--good)' : 'var(--primary)', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            {optimizada ? '✦ MaKo ✓ optimizada' : '✦ MaKo te ayuda'}
          </button>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--faint)', padding: '2px 6px' }}>×</button>
        </div>
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 22px' }}>
            <textarea value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={() => board.setTitle(t.id, titleDraft, t.title)} rows={2} style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 22, fontWeight: 600, lineHeight: 1.3, fontFamily: SANS, letterSpacing: '-0.01em', marginBottom: 16 }} />
            <label style={rowLabel}>Detalle · doc</label>
            <textarea value={detalleDraft} onChange={(e) => setDetalleDraft(e.target.value)} onBlur={() => board.setDetalle(t.id, detalleDraft, t.detalle)} placeholder="El doc de esta tarea…" style={{ width: '100%', minHeight: 130, border: '1px solid var(--border)', borderRadius: 10, outline: 'none', resize: 'vertical', background: 'var(--surface-2)', color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.6, padding: '12px 14px', fontFamily: SANS, marginBottom: 20 }} />

            <label style={rowLabel}>Checklist {cl.length > 0 && `· ${clDone}/${cl.length} · manda el avance`}</label>
            {cl.length > 0 && <span style={{ display: 'block', marginBottom: 10 }}><MiniBar v={cl.length ? Math.round((clDone / cl.length) * 100) : 0} /></span>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {cl.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 2px' }}>
                  <button onClick={() => setCl(cl.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)), c.done ? undefined : `Completó "${c.text.slice(0, 30)}"`)} style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${c.done ? 'var(--good)' : 'var(--border-strong)'}`, background: c.done ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 11, cursor: 'pointer', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.done ? '✓' : ''}</button>
                  <input value={c.text} onChange={(e) => setCl(cl.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))} style={{ flex: 1, border: 'none', background: 'transparent', color: c.done ? 'var(--faint)' : 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS, textDecoration: c.done ? 'line-through' : 'none' }} />
                  <button onClick={() => setCl(cl.filter((x) => x.id !== c.id))} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
            <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newItem.trim()) { setCl([...cl, { id: uid(), text: newItem.trim(), done: false }], `Agregó "${newItem.trim().slice(0, 30)}" al checklist`); setNewItem(''); } }} placeholder="+ ítem de checklist (Enter)" style={{ width: '100%', padding: '8px 11px', borderRadius: 8, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--ink)', fontSize: 13, outline: 'none', marginBottom: 24 }} />

            <label style={rowLabel}>Change history</label>
            <ChangeHistory t={t} board={board} ask={ask} />
          </div>
          <div style={{ width: 236, flex: 'none', borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', padding: '20px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
            <div>
              <label style={rowLabel}>Prioridad · la pone MaKo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <ScoreBadge score={t.score} />
                <span style={{ fontSize: 13, fontWeight: 600, color: PCOLOR[prioEfectiva] }}>{PLABEL[prioEfectiva]}</span>
              </div>
              {t.scoreRazon && <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.4, marginBottom: 6, fontStyle: 'italic' }}>“{t.scoreRazon}”</div>}
              {topeada && <div style={{ fontSize: 11, color: 'var(--warn)', lineHeight: 1.4, marginBottom: 6 }}>Score de Alta, pero fuera del Objetivo Principal → queda en {PLABEL[prioEfectiva]}.</div>}
              <button onClick={onDebate} style={{ ...selStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'var(--surface)', color: 'var(--accent)', fontWeight: 700 }}>🛡️ Debatir con MaKo</button>
            </div>
            <div><label style={rowLabel}>Avance · {cl.length > 0 ? t.progress : progShown}%{cl.length > 0 ? ' · por checklist' : ''}</label>
              {cl.length > 0
                ? <MiniBar v={t.progress} />
                : <input type="range" min={0} max={100} step={5} value={progShown} onChange={(e) => setProgDraft(Number(e.target.value))} onMouseUp={commitProg} onKeyUp={commitProg} onTouchEnd={commitProg} style={{ width: '100%', accentColor: 'var(--primary)' }} />}
            </div>
            <div><label style={rowLabel}>Deadline</label><input type="date" value={t.deadline} onChange={(e) => board.setDeadline(t.id, e.target.value, t.deadline)} style={selStyle} /></div>
            <div>
              <label style={rowLabel}>{board.repo.labelPlural}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: chips.length ? 8 : 0 }}>
                {chips.map((l) => (
                  <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 4px 3px 8px', borderRadius: 999, border: `1px solid ${l.color}59`, background: `${l.color}1f`, color: l.color }}>
                    {l.emoji} {l.name}
                    <button onClick={() => board.setTaskLabels(t.id, board.repo.labelMode === 'single' ? [] : t.labels.filter((x) => x !== l.id), `Quitó ${l.name}`)} style={{ border: 'none', background: 'transparent', color: 'inherit', opacity: 0.6, fontSize: 13, lineHeight: 1, cursor: 'pointer', padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
              {disponibles.length > 0 && <select value="" onChange={(e) => { if (e.target.value) board.setTaskLabels(t.id, board.repo.labelMode === 'single' ? [e.target.value] : [...t.labels, e.target.value], `Agregó ${board.labelById(e.target.value)?.name ?? ''}`); }} style={selStyle}><option value="">＋ {board.repo.labelSingular.toLowerCase()}</option>{disponibles.map((l) => <option key={l.id} value={l.id}>{l.emoji} {l.name}</option>)}</select>}
            </div>
            <button onClick={() => onToggle(t.id)} style={{ ...selStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: t.enPrioridad ? 'var(--primary-bg)' : 'var(--surface)', color: t.enPrioridad ? 'var(--primary)' : 'var(--dim)', fontWeight: 600 }}>{t.enPrioridad ? '★ En prioridad' : '☆ Poner en prioridad'}</button>
            <span style={{ flex: 1 }} />
            <button onClick={() => ask('¿Eliminar esta tarea?', () => { board.remove(t.id); onClose(); })} style={{ border: 'none', background: 'transparent', color: 'var(--bad)', fontSize: 12.5, cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}>Eliminar tarea</button>
          </div>
        </div>
      </div>
      {mako && <MakoChecklistModal title={t.title} detalle={t.detalle} yaOptimizada={optimizada} onApply={(txts) => setCl([...cl, ...txts.map((x) => ({ id: uid(), text: x, done: false }))], `MaKo agregó ${txts.length} ítem${txts.length === 1 ? '' : 's'}`)} onClose={() => setMako(false)} />}
    </div>
  );
}

// ── editor de proyectos / categorías (con emoji picker) ─────────────────────────
function ProjectsManager({ board, ask, onClose }: { board: Board; ask: (msg: string, onOk: () => void) => void; onClose: () => void }) {
  const { labels, repo } = board;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(18,21,27,.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '10vh 16px 16px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: '78vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{repo.labelPlural}</h2><span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--faint)' }}>×</button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {labels.map((l) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px' }}>
              <EmojiPickerMini value={l.emoji} onPick={(em) => board.patchLabel(l.id, { emoji: em })} />
              <input value={l.name} onChange={(e) => board.patchLabel(l.id, { name: e.target.value })} style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, padding: '6px 9px', outline: 'none', fontFamily: SANS }} />
              <span title="Prioridad del proyecto (la pone el guardián)" style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 6px', flex: 'none' }}>P{l.score}</span>
              <span style={{ display: 'flex', gap: 3 }}>{SWATCHES.map((s) => <button key={s} onClick={() => board.patchLabel(l.id, { color: s })} title={s} style={{ width: 16, height: 16, borderRadius: 5, background: s, border: l.color === s ? '2px solid var(--ink)' : '2px solid transparent', cursor: 'pointer' }} />)}</span>
              <button onClick={() => ask(`¿Borrar "${l.name}"?`, () => board.deleteLabel(l.id))} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
            </div>
          ))}
          <button onClick={() => board.createLabel({ id: uid(), emoji: '🏷', name: `Nuevo ${repo.labelSingular.toLowerCase()}`, color: SWATCHES[1], score: 3 })} style={{ ...ghostBtn, textAlign: 'center' }}>+ {repo.labelSingular}</button>
        </div>
      </div>
    </div>
  );
}
