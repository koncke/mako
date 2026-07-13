'use client';

// =============================================================================
// BoardShell — la ÚNICA vista del tablero /todo (admin y cliente idénticos)
// =============================================================================
// Recibe un `Board` (useBoard) y pinta todo: header con avance promedio, toggle
// Prioridades/Kanban, 4 columnas de prioridad a ancho completo con DnD, tarjetas
// cuadradas (estilo CRM) con avance editable inline, modal con checklist + coach
// de MaKo + Change history (avatar + deshacer por entrada), editor de proyectos
// con emoji, y el form bloqueante para tareas Alta sin deadline/checklist.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { UndoToast } from '../../_components/UndoToast';
import { ConfirmModal } from '../../_components/ConfirmModal';
import { EmojiPickerMini } from './EmojiPicker';
import { PriorizarWizard } from './PriorizarWizard';
import { MakoChecklistModal } from './MakoChecklist';
import { DebateModal } from './DebateModal';
import { CrearTareaModal } from './CrearTareaModal';
import { CrearProyectoModal } from './CrearProyecto';
import { EliminarModal } from './EliminarModal';
import { AsignarProyectoModal } from './AsignarProyecto';
import { ProyectoDebateModal } from './ProyectoDebateModal';
import { MakoProyectoModal } from './MakoProyecto';
import { GuardianIcon } from './GuardianIcon';
import { MakoStar } from '../../_components/MakoBrand';
import { ScoreIcon } from './guardian-form';
import { RichText, stripHtml } from './RichText';
import type { Board } from './useBoard';
import { type BoardTask, type Label, type Prio, type Check, type Actor, PRIOS, PLABEL, PCOLOR, SWATCHES, MAX_PRIORIDAD, uid, relTime, prioFromScore, displayPrio } from './types';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

export function BoardShell({ board }: { board: Board }) {
  // G1/G2 guardián: score→columna, restricción al proyecto top, debate.
  const { tasks, labels, repo } = board;
  const [view, setView] = useState<'prioridades' | 'kanban' | 'proyectos'>('prioridades');
  const [openProj, setOpenProj] = useState<string | null>(null);
  const [nuevoProj, setNuevoProj] = useState(false);
  const [nuevaTareaProj, setNuevaTareaProj] = useState<string | null>(null); // proyecto donde crear la tarea nueva
  const [nuevaTareaPrio, setNuevaTareaPrio] = useState<Prio | null>(null);   // columna desde la que se creó (precompleta la prioridad)
  const [eliminarTaskId, setEliminarTaskId] = useState<string | null>(null);
  const [eliminarProjId, setEliminarProjId] = useState<string | null>(null);
  const [asignarTaskId, setAsignarTaskId] = useState<string | null>(null);
  const [debateProjId, setDebateProjId] = useState<string | null>(null);
  const [makoHintId, setMakoHintId] = useState<string | null>(null); // tarea recién creada → sugerir "MaKo te ayuda"
  const [makoProjId, setMakoProjId] = useState<string | null>(null); // "MaKo te ayuda" para un proyecto
  const [q, setQ] = useState('');
  const [fLabels, setFLabels] = useState<Set<string>>(new Set());
  const [doneFilter, setDoneFilter] = useState<DoneFilter>('all'); // #16: filtrar por estado
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ msg: string; onOk: () => void } | null>(null);
  const [wizardId, setWizardId] = useState<string | null>(null);
  const [debateId, setDebateId] = useState<string | null>(null);
  const [nuevaTarea, setNuevaTarea] = useState(false);
  const [altaUndo, setAltaUndo] = useState<{ id: string; snap: BoardTask } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set()); // gauntlets cerrados (super-admin, temporal)
  const [usageFlash, setUsageFlash] = useState<{ tokens: number; cost: number; feature: string } | null>(null);

  const ask = (msg: string, onOk: () => void) => setConfirm({ msg, onOk });
  useEffect(() => { if (!usageFlash) return; const t = setTimeout(() => setUsageFlash(null), 6000); return () => clearTimeout(t); }, [usageFlash]);
  // muestra el gasto de tokens/costo de UNA operación de IA (feedback #1: transparencia).
  const showUsage = (u: unknown, feature: string) => {
    const o = (u && typeof u === 'object' ? u : null) as { inputTokens?: number; outputTokens?: number; costUsd?: number } | null;
    if (o) setUsageFlash({ tokens: (o.inputTokens || 0) + (o.outputTokens || 0), cost: o.costUsd || 0, feature });
  };

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

  // ── el perro guardián re-puntúa el plan (score 1-100 / 1-10) ──
  // Sin botón: corre solo EN BACKGROUND, pero SOLO cuando el plan cambió de forma
  // ESTRUCTURAL (se agregó/quitó/completó una tarea, o cambió un proyecto). Si nada
  // cambió, NO gasta tokens (feedback #1/#14). La "firma" ignora los scores para no
  // re-dispararse a sí misma cuando el guardián aplica los suyos.
  const repriorizando = useRef(false);
  const lastReprioSig = useRef(''); // dedup: no re-puntuar dos veces la misma firma
  const planSignature = () => {
    const t = tasks.filter((x) => x.progress < 100).map((x) => x.id).sort().join(',');
    const p = labels.map((l) => l.id).sort().join(',');
    return `${t}|${p}`;
  };
  const rePriorizar = async (sig?: string) => {
    if (repriorizando.current) return;
    const sigNow = sig ?? planSignature();
    if (lastReprioSig.current === sigNow) return; // ya se corrió para esta firma
    repriorizando.current = true;
    const proyectos = labels.map((l) => ({ id: l.id, nombre: l.name }));
    // scoreActual: el guardián mantiene el score previo salvo razón concreta (estabilidad).
    const tareasIn = tasks.filter((t) => t.progress < 100).map((t) => ({ id: t.id, titulo: t.title, detalle: t.detalle, proyecto: board.labelById(t.labels[0])?.name ?? '', deadline: t.deadline, avance: t.progress, origen: t.origen, scoreActual: t.score }));
    if (tareasIn.length < 2) { repriorizando.current = false; return; }
    try {
      const j = await fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proyectos, tareas: tareasIn }) }).then((r) => r.json());
      if (j.ok) {
        board.applyGuardian(j.tareas || [], j.proyectos || []);
        showUsage(j.usage, 're-priorización del plan');
        lastReprioSig.current = sigNow;
        try { localStorage.setItem('mako_plan_sig', sigNow); } catch { /* no-op */ }
      }
    } catch { /* silencioso, es automático */ }
    repriorizando.current = false;
  };
  // Dispara la re-priorización SOLO cuando la firma estructural cambia respecto de la
  // última corrida (con debounce). Editar un título o mover un score no la re-dispara.
  const planSig = planSignature();
  useEffect(() => {
    if (tasks.length < 2) return;
    let stored = ''; try { stored = localStorage.getItem('mako_plan_sig') || ''; } catch { /* no-op */ }
    if (!planSig || planSig === stored) return;
    const id = setTimeout(() => { void rePriorizar(planSig); }, 2500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planSig]);
  // Re-puntuación FORZADA de una sola vez por navegador: aplica el guardián nuevo
  // (más duro + disciplina de distribución) al plan existente. Bump de REPRIO_FORCE
  // para volver a forzarla en el futuro si hace falta.
  const ready = tasks.length >= 2;
  useEffect(() => {
    if (!ready) return;
    const REPRIO_FORCE = 'v4-guardian-2026-07';
    let f = ''; try { f = localStorage.getItem('mako_reprio_force') || ''; } catch { /* no-op */ }
    if (f === REPRIO_FORCE) return;
    try { localStorage.setItem('mako_reprio_force', REPRIO_FORCE); } catch { /* no-op */ }
    const id = setTimeout(() => { void rePriorizar(); }, 1800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  // al cerrar el form de un pase-a-Alta: cartel de 5s para DESHACER TODO (el movimiento
  // + el deadline/checklist que se acaban de cargar) restaurando el snapshot previo.
  const cerrarWizard = () => {
    if (altaUndo && altaUndo.id === wizardId) { const snap = altaUndo.snap; board.showUndo('Movida a Alta', () => board.replaceTask(snap)); setAltaUndo(null); }
    setWizardId(null);
  };

  const passes = (t: BoardTask) => (!q || (t.title + ' ' + t.detalle).toLowerCase().includes(q.toLowerCase())) && (fLabels.size === 0 || t.labels.some((l) => fLabels.has(l))) && pasaEstado(t.progress, doneFilter);
  const visibles = tasks.filter(passes);
  const avg = tasks.length ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length) : 0;
  const hechas = tasks.filter((t) => t.progress >= 100).length;
  // "En prioridad" = AUTOMÁTICO: las 3 tareas de mayor score del Objetivo Principal
  // (no lo elige el usuario). Sin proyecto top, cae a las 3 de mayor score del plan.
  const enPrio = tasks
    .filter((t) => t.progress < 100 && (topProjectId ? t.labels.includes(topProjectId) : true))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PRIORIDAD);
  const prioAvg = enPrio.length ? Math.round(enPrio.reduce((s, t) => s + t.progress, 0) / enPrio.length) : 0;
  const openTask = tasks.find((t) => t.id === openId) ?? null;
  const wizardTask = tasks.find((t) => t.id === wizardId) ?? null;
  const debateTask = tasks.find((t) => t.id === debateId) ?? null;
  const openProjLabel = labels.find((l) => l.id === openProj) ?? null;
  const eliminarTask = tasks.find((t) => t.id === eliminarTaskId) ?? null;
  const eliminarProj = labels.find((l) => l.id === eliminarProjId) ?? null;
  const asignarTask = tasks.find((t) => t.id === asignarTaskId) ?? null;
  const debateProj = labels.find((l) => l.id === debateProjId) ?? null;
  const makoProj = labels.find((l) => l.id === makoProjId) ?? null;
  const crearProyecto = (nombre: string, emoji: string, detalle: string, score = 5) => board.createLabel({ id: uid(), emoji: emoji || '🏷', name: nombre, color: SWATCHES[labels.length % SWATCHES.length], score, detalle, historial: [] });
  // resumen del plan para que el guardián compare al debatir/crear
  const planResumen = tasks.filter((t) => t.progress < 100).map((t) => `- [${t.score}] ${t.title} (${board.labelById(t.labels[0])?.name ?? 'sin proyecto'})`).join('\n');

  // crear una tarea: el usuario propone proyecto(s) + prioridad; el GUARDIÁN la puntúa
  // (arrancando de la sugerencia del usuario) y decide su columna final (#10).
  const crearConGuardian = async (d: { title: string; detalle: string; labelIds: string[]; userScore: number; motivoNinguno: string; nuevoProyecto: string; nuevoProyEmoji: string; argumento: string }) => {
    let labelIds = d.labelIds;
    // Si el usuario dijo que el proyecto todavía no existe, lo creamos inline.
    if (d.nuevoProyecto.trim()) {
      const newId = uid();
      void board.createLabel({ id: newId, emoji: d.nuevoProyEmoji || '🏷', name: d.nuevoProyecto.trim(), color: SWATCHES[labels.length % SWATCHES.length], score: 5, detalle: '', historial: [] });
      labelIds = [newId];
    }
    const starter = d.userScore || 50;
    const t = await board.create(d.title, prioFromScore(starter), labelIds.length ? labelIds : undefined);
    if (!t) return null;
    if (d.detalle) board.setDetalle(t.id, d.detalle, '');
    const partes: string[] = [];
    if (d.argumento) partes.push(d.argumento);
    partes.push(`El usuario la propone en ${d.userScore} (${PLABEL[prioFromScore(starter)]}) — podés corregirlo si no corresponde.`);
    if (!labelIds.length && d.motivoNinguno) partes.push(`Sin proyecto: ${d.motivoNinguno}.`);
    const argFinal = partes.join(' ') || '(sin argumento: puntualo por impacto objetivo comparándolo con el resto del plan)';
    try {
      const j = await fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'debatir', tarea: d.title + (d.detalle ? `\n\n${d.detalle}` : ''), scoreActual: starter, argumento: argFinal, plan: planResumen, uso: 'Nueva tarea' }) }).then((r) => r.json());
      if (j.ok && typeof j.score === 'number') {
        board.setScore(t.id, j.score, `Priorizada al crear · score ${j.score}`, 'ia', j.razon);
        showUsage(j.usage, 'nueva tarea');
        return { id: t.id, score: j.score, razon: j.razon ?? '', respuesta: j.respuesta ?? '', prio: displayPrio({ ...t, score: j.score }, topProjectId) };
      }
    } catch { /* fallback abajo */ }
    return { id: t.id, score: starter, razon: '', respuesta: 'No pude priorizar ahora; quedó donde la propusiste. Podés debatirla después.', prio: displayPrio({ ...t, score: starter }, topProjectId) };
  };

  return (
    <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: SANS }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 30px 16px', flexWrap: 'wrap' }}>
        {/* logo (checklist) + Plan — mismo ícono que la sidebar (feedback #2) */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <PlanIcon size={38} />
          <span style={{ fontSize: 40, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.025em', lineHeight: 1 }}>Plan</span>
        </div>
        {/* tabs */}
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3 }}>
          {(['prioridades', 'kanban', 'proyectos'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ border: 'none', background: view === v ? 'var(--surface)' : 'transparent', color: view === v ? 'var(--ink)' : 'var(--dim)', fontWeight: view === v ? 600 : 500, fontSize: 13.5, padding: '7px 15px', borderRadius: 999, cursor: 'pointer', boxShadow: view === v ? '0 1px 2px rgba(18,21,27,.08)' : 'none', fontFamily: 'inherit', textTransform: 'capitalize' }}>{v === 'proyectos' ? repo.labelPlural : v}</button>
          ))}
        </div>
        {/* de acá para la derecha, todo alineado a la derecha */}
        <span style={{ flex: 1 }} />
        {view === 'kanban' && <AvgChip avg={avg} hechas={hechas} total={tasks.length} label="del plan" />}
        {view === 'prioridades' && <AvgChip avg={prioAvg} hechas={enPrio.length} total={MAX_PRIORIDAD} label="en prioridad" />}
        {view === 'kanban' && <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" style={{ minWidth: 120, maxWidth: 200, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none' }} />
          <FilterMenu labels={labels} fLabels={fLabels} setFLabels={setFLabels} doneFilter={doneFilter} setDoneFilter={setDoneFilter} />
        </>}
      </header>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {view === 'prioridades' && <Prioridades tasks={enPrio} board={board} objetivo={objetivoPrincipal} onOpen={setOpenId} onOpenProj={setOpenProj} />}
        {view === 'kanban' && <Kanban tasks={visibles} board={board} topProjectId={topProjectId} onOpen={setOpenId} onNew={(p) => { setNuevaTareaPrio(p ?? null); setNuevaTarea(true); }} onWarn={setWizardId} />}
        {view === 'proyectos' && <ProyectosView board={board} topProjectId={topProjectId} onOpen={setOpenProj} onNew={() => setNuevoProj(true)} />}
      </div>

      {openTask && <TaskModal key={openTask.id} t={openTask} board={board} topProjectId={topProjectId} suggestMako={openTask.id === makoHintId} onDebate={() => setDebateId(openTask.id)} onDelete={() => setEliminarTaskId(openTask.id)} onAsignar={() => setAsignarTaskId(openTask.id)} ask={ask} onClose={() => { setOpenId(null); setMakoHintId(null); }} />}
      {debateTask && <DebateModal task={debateTask} planResumen={planResumen}
        otras={tasks.filter((t) => t.id !== debateTask.id && t.progress < 100).map((t) => { const l = board.labelById(t.labels[0]); return { id: t.id, title: t.title, score: t.score, projId: l?.id, projName: l?.name, projColor: l?.color, projEmoji: l?.emoji }; })}
        onUsage={(u) => showUsage(u, 'debate de prioridad')}
        onApply={(score, razon) => board.setScore(debateTask.id, score, `Debate con el Perro Guardián · score ${score}`, 'ia', razon)} onClose={() => setDebateId(null)} />}
      {nuevaTarea && <CrearTareaModal labels={labels} proyectoInicial={nuevaTareaProj} prioInicial={nuevaTareaPrio} ejemplos={tasks.filter((t) => t.progress < 100).map((t) => ({ title: t.title, score: t.score }))} onCrear={crearConGuardian} onDone={(id) => { setNuevaTarea(false); setNuevaTareaProj(null); setNuevaTareaPrio(null); setOpenId(id); setMakoHintId(id); }} onClose={() => { setNuevaTarea(false); setNuevaTareaProj(null); setNuevaTareaPrio(null); }} />}
      {openProjLabel && <ProjectDetailModal proj={openProjLabel} board={board} topProjectId={topProjectId} onOpenTask={setOpenId} onNewTask={() => { setNuevaTareaProj(openProjLabel.id); setNuevaTarea(true); }} onDebatePrio={() => setDebateProjId(openProjLabel.id)} onMako={() => setMakoProjId(openProjLabel.id)} onDelete={() => setEliminarProjId(openProjLabel.id)} onClose={() => setOpenProj(null)} />}
      {makoProj && <MakoProyectoModal proj={{ name: makoProj.name, emoji: makoProj.emoji, detalle: makoProj.detalle }} onApply={(nombre, emoji, det) => board.patchLabelLog(makoProj.id, { name: nombre, emoji, detalle: det }, 'MaKo mejoró el proyecto', 'ia')} onClose={() => setMakoProjId(null)} />}
      {debateProj && <ProyectoDebateModal proj={debateProj} otrosProyectos={labels.filter((l) => l.id !== debateProj.id).map((l) => `- ${l.emoji} ${l.name} (prioridad ${l.score}/10)`).join('\n') || '(no hay otros proyectos)'} onUsage={(u) => showUsage(u, 'prioridad de proyecto')} onApply={(score, razon) => board.patchLabelLog(debateProj.id, { score, scoreRazon: razon || debateProj.scoreRazon }, `El Perro Guardián ajustó la prioridad → ${score}/10`, 'ia')} onClose={() => setDebateProjId(null)} />}
      {nuevoProj && <CrearProyectoModal otros={labels.map((l) => ({ name: l.name, emoji: l.emoji, score: l.score, color: l.color }))} onCrear={crearProyecto} onClose={() => setNuevoProj(false)} />}
      {eliminarTask && <EliminarModal tipo="tarea" nombre={eliminarTask.title} task={{ id: eliminarTask.id, title: eliminarTask.title, detalle: eliminarTask.detalle }}
        otras={tasks.filter((t) => t.id !== eliminarTask.id && t.progress < 100).map((t) => { const l = board.labelById(t.labels[0]); return { id: t.id, titulo: t.title, detalle: t.detalle, projColor: l?.color, projEmoji: l?.emoji }; })}
        plan={planResumen} onUsage={(u) => showUsage(u, 'eliminar tarea')}
        onCompletar={() => board.toggleDone(eliminarTask.id)}
        onDebate={() => setDebateId(eliminarTask.id)}
        onBorrar={(motivo) => { board.remove(eliminarTask.id, motivo); setOpenId(null); }} onClose={() => setEliminarTaskId(null)} />}
      {eliminarProj && <EliminarModal tipo="proyecto" nombre={eliminarProj.name} nTareas={tasks.filter((t) => t.labels.includes(eliminarProj.id)).length}
        plan={planResumen} onUsage={(u) => showUsage(u, 'eliminar proyecto')}
        onBorrar={() => { board.deleteLabelYTareas(eliminarProj.id); setOpenProj(null); }} onClose={() => setEliminarProjId(null)} />}
      {asignarTask && <AsignarProyectoModal task={asignarTask} labels={labels}
        onAsignar={(ids, motivo) => board.setTaskLabels(asignarTask.id, ids, `${ids.length ? `Asignó a ${ids.map((id) => board.labelById(id)?.name).filter(Boolean).join(', ')}` : 'Quitó el proyecto'}${motivo ? ` — ${motivo.slice(0, 80)}` : ''}`)}
        onClose={() => setAsignarTaskId(null)} />}
      {wizardTask && <PriorizarWizard task={wizardTask}
        dismissable={repo.dismissableGauntlet}
        onDismiss={() => { setDismissed((s) => new Set(s).add(wizardTask.id)); setAltaUndo(null); setWizardId(null); }}
        onSetDeadline={(d) => board.setDeadline(wizardTask.id, d, wizardTask.deadline)}
        onSetChecklist={(c) => board.setChecklist(wizardTask.id, c, `Definió el checklist (${c.length})`)}
        onDowngrade={(p) => { board.moveTo(wizardTask.id, p); setAltaUndo(null); }}
        onDone={cerrarWizard} />}
      {confirm && <ConfirmModal msg={confirm.msg} onOk={() => { confirm.onOk(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}
      {usageFlash && <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 250, display: 'flex', alignItems: 'center', gap: 11, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', boxShadow: '0 12px 32px rgba(18,21,27,.18)', fontFamily: SANS }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>🪙</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{fmtTokens(usageFlash.tokens)} tokens · US${usageFlash.cost.toFixed(3)}</div>
          <div style={{ fontSize: 11, color: 'var(--faint)' }}>{usageFlash.feature} · consumo de MaKo</div>
        </div>
      </div>}
      <UndoToast state={board.undo} onClose={board.clearUndo} />
    </main>
  );
}

// ── átomos ────────────────────────────────────────────────────────────────────
const ghostBtn: CSSProperties = { padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 500, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS };
const selStyle: CSSProperties = { appearance: 'none', WebkitAppearance: 'none', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: SANS, width: '100%' };
// botón "Cambiar prioridad/proyecto" — mismo diseño en toda la app: estrella de IA + texto azul
const cambiarBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', border: '1px solid var(--primary-weak)', background: 'var(--surface)', color: 'var(--primary)', fontWeight: 700, fontSize: 13, padding: '9px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: SANS };

function FunnelIcon({ color = 'currentColor' }: { color?: string }) { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>; }
// Logo del Plan: checklist relleno (mismo motivo que el ícono de la sidebar). Los
// checks/líneas usan --surface para invertir bien en claro/oscuro.
function PlanIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: 'none' }}>
      <rect x="3.4" y="2.4" width="17.2" height="19.2" rx="3.4" fill="var(--ink)" />
      <g stroke="var(--surface)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M6.6 8l1.3 1.3 2.4-2.9" /><path d="M6.6 12.4l1.3 1.3 2.4-2.9" /><path d="M6.6 16.8l1.3 1.3 2.4-2.9" />
        <path d="M13 8h4.3M13 12.4h4.3M13 16.8h4.3" strokeWidth="1.9" />
      </g>
    </svg>
  );
}
// formatea tokens (12300 → "12,3k") para el toast de consumo de IA
function fmtTokens(n: number): string { return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}k` : String(n); }
// filtro por estado (2ª capa del botón Filtrar): Todas / Activas / Comenzadas / Completadas
type DoneFilter = 'all' | 'activas' | 'comenzadas' | 'hechas';
const ESTADO_OPS: Array<[DoneFilter, string]> = [['all', 'Todas'], ['activas', 'Activas'], ['comenzadas', 'Comenzadas'], ['hechas', 'Completadas']];
function pasaEstado(progress: number, f: DoneFilter): boolean {
  if (f === 'all') return true;
  if (f === 'hechas') return progress >= 100;
  if (f === 'comenzadas') return progress > 0 && progress < 100;
  return progress < 100; // activas
}
// progreso agregado de un proyecto (promedio del avance de sus tareas)
function projProgress(tasks: BoardTask[], labelId: string): { pct: number; total: number; done: number } {
  const suyas = tasks.filter((t) => t.labels.includes(labelId));
  if (!suyas.length) return { pct: 0, total: 0, done: 0 };
  return { pct: Math.round(suyas.reduce((s, t) => s + t.progress, 0) / suyas.length), total: suyas.length, done: suyas.filter((t) => t.progress >= 100).length };
}

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
function MiniBar({ v }: { v: number }) {
  return <span style={{ display: 'block', height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: v + '%', background: 'var(--primary)' }} /></span>;
}
// prioridad del proyecto (1-10) — mismo sistema gauge + número que las tareas (#4)
function ProjScore({ score, color, big }: { score: number; color: string; big?: boolean }) {
  return <span title="Prioridad del proyecto" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: big ? 15 : 11, fontWeight: 700, color, background: color + '18', border: `1px solid ${color}33`, borderRadius: 6, padding: big ? '3px 10px' : '2px 6px 2px 5px' }}><ScoreIcon size={big ? 15 : 11} color={color} />{score}</span>;
}
// score del guardián (1-100), coloreado por la columna que define.
function ScoreBadge({ score }: { score: number }) {
  const c = PCOLOR[prioFromScore(score)];
  return <span title="Prioridad del guardián (1-100)" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 10, fontWeight: 700, color: c, background: c + '18', border: `1px solid ${c}33`, borderRadius: 5, padding: '1px 5px 1px 4px' }}><ScoreIcon size={10} color={c} />{score}</span>;
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
function CardTile({ t, board, warn, onOpen, onWarn }: {
  t: BoardTask; board: Board; warn: boolean; onOpen: (id: string) => void; onWarn: (id: string) => void;
}) {
  const done = t.progress >= 100;
  const clDone = t.checklist.filter((c) => c.done).length;
  const chips = t.labels.map((id) => board.labelById(id)).filter((l): l is Label => l != null);
  return (
    <div onClick={() => onOpen(t.id)}
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '14px 15px', cursor: 'pointer', opacity: done ? 0.62 : 1, minHeight: 158, display: 'flex', flexDirection: 'column', transition: 'border-color .12s' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {chips.map((l) => <LabelChip key={l.id} l={l} />)}
        <OrigenChip origen={t.origen} />
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
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--dim)' }}>{t.progress}%</span>
      </div>
      {/* avance: SIEMPRE derivado (feedback #17). Con checklist sale de ella; sin
          checklist, se marca "Completada" (0↔100) — nunca a mano. */}
      <MiniBar v={t.progress} />
      {t.checklist.length === 0 && (
        <button onClick={(e) => { e.stopPropagation(); board.toggleDone(t.id); }}
          style={{ marginTop: 8, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${done ? 'var(--good)' : 'var(--border-strong)'}`, background: done ? 'var(--good-bg, var(--surface))' : 'var(--surface)', color: done ? 'var(--good)' : 'var(--dim)', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
          <span style={{ width: 13, height: 13, borderRadius: 4, border: `1px solid ${done ? 'var(--good)' : 'var(--border-strong)'}`, background: done ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{done ? '✓' : ''}</span>
          {done ? 'Completada' : 'Completar'}
        </button>
      )}
    </div>
  );
}

// ── vista Kanban (4 columnas por prioridad derivada del score; ancho completo) ──
function Kanban({ tasks, board, topProjectId, onOpen, onNew, onWarn }: {
  tasks: BoardTask[]; board: Board; topProjectId: string | null; onOpen: (id: string) => void; onNew: (p?: Prio) => void; onWarn: (id: string) => void;
}) {
  const objetivo = topProjectId ? board.labelById(topProjectId) : null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, padding: '4px 30px 30px', height: '100%', alignItems: 'flex-start' }} className="mako-board">
      <style>{`@media (max-width:1000px){.mako-board{grid-template-columns:repeat(2,1fr)!important}}@media (max-width:560px){.mako-board{grid-template-columns:1fr!important}}`}</style>
      {PRIOS.map((p) => {
        const items = tasks.filter((t) => displayPrio(t, topProjectId) === p).sort((a, b) => (a.progress >= 100 ? 1 : 0) - (b.progress >= 100 ? 1 : 0) || b.score - a.score || a.num - b.num);
        return (
          <section key={p} style={{ display: 'flex', flexDirection: 'column', maxHeight: '100%', minWidth: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '3px solid ' + PCOLOR[p], borderRadius: 14, padding: 10 }}>
            <ColHeader p={p} count={items.length} nota={p === 'alta' && objetivo ? `solo ${objetivo.emoji} ${objetivo.name} · o emergencias` : undefined} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto', minHeight: 30, paddingRight: 2 }}>
              {/* card gris translúcida para crear (arriba de todo, más bajita que las tarjetas) */}
              <button onClick={() => onNew(p)} style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1.5px dashed var(--border-strong)', background: 'transparent', borderRadius: 10, padding: '9px 10px', cursor: 'pointer', color: 'var(--faint)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, opacity: 0.8, transition: 'border-color .12s, color .12s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--faint)'; }}>＋ Nueva tarea</button>
              {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', padding: '10px 0' }}>—</div>}
              {items.map((t) => <CardTile key={t.id} t={t} board={board} warn={displayPrio(t, topProjectId) === 'alta' && t.progress < 100 && (!t.deadline || t.checklist.length === 0)} onOpen={onOpen} onWarn={onWarn} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
function ColHeader({ p, count, nota }: { p: Prio; count: number; nota?: string }) {
  return (
    <div style={{ flex: 'none', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 3px 8px' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: PCOLOR[p], flex: 'none' }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--dim)' }}>{PLABEL[p]}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', background: 'var(--surface-2)', borderRadius: 999, padding: '1px 8px' }}>{count}</span>
      </div>
      {nota && <div style={{ fontSize: 10, color: 'var(--faint)', padding: '0 3px 8px', lineHeight: 1.3 }}>{nota}</div>}
    </div>
  );
}

// ── vista Prioridades: Objetivo Principal a la IZQUIERDA (alto, clickeable) + las
// 3 tareas a la DERECHA (feedback #11 y #3). ─────────────────────────────────────
function Prioridades({ tasks, board, objetivo, onOpen, onOpenProj }: { tasks: BoardTask[]; board: Board; objetivo: Label | null; onOpen: (id: string) => void; onOpenProj: (id: string) => void }) {
  const [expand, setExpand] = useState<Set<string>>(new Set());
  const toggleExp = (id: string) => setExpand((s) => { const c = new Set(s); if (c.has(id)) c.delete(id); else c.add(id); return c; });
  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '18px 30px 40px' }}>
      <div className="mako-prio" style={{ width: '100%', maxWidth: 1060, display: 'flex', gap: 20, alignItems: 'stretch' }}>
        <style>{`@media (max-width:840px){.mako-prio{flex-direction:column!important}.mako-prio-obj{flex:none!important;width:auto!important}}`}</style>
        {/* IZQUIERDA — Objetivo Principal (card alto, clickeable) */}
        <div className="mako-prio-obj" style={{ flex: '0 0 336px', display: 'flex' }}>
          {objetivo ? <ObjetivoCard objetivo={objetivo} onOpen={() => onOpenProj(objetivo.id)} /> : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--faint)', fontSize: 13.5, border: '1px dashed var(--border-strong)', borderRadius: 16, padding: 24 }}>Todavía no hay un Objetivo Principal. Creá un proyecto y el perro elige el norte.</div>
          )}
        </div>
        {/* DERECHA — las 3 tareas en prioridad */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700 }}>🎯 Tareas prioritarias · {tasks.length}/{MAX_PRIORIDAD}</div>
          {tasks.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--faint)', textAlign: 'center', padding: '24px 20px', border: '1px dashed var(--border-strong)', borderRadius: 14 }}>
              <div style={{ fontSize: 14, maxWidth: 400, lineHeight: 1.5 }}>MaKo pone acá, solo, las {MAX_PRIORIDAD} tareas de mayor prioridad del Objetivo Principal. Todavía no hay ninguna.</div>
            </div>
          )}
          {tasks.map((t, i) => {
            const chips = t.labels.map((id) => board.labelById(id)).filter((l): l is Label => l != null);
            const clDone = t.checklist.filter((c) => c.done).length;
            const open = expand.has(t.id);
            return (
              <div key={t.id} onClick={() => onOpen(t.id)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 2px rgba(18,21,27,.05)', cursor: 'pointer', transition: 'border-color .12s' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span title={`Prioridad ${i + 1}`} style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontFamily: MONO }}>{i + 1}</span>
                  {chips.map((l) => <LabelChip key={l.id} l={l} />)}
                  <span style={{ flex: 1 }} /><ScoreBadge score={t.score} />
                </div>
                <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.3, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: t.detalle ? 10 : 14 }}>{t.title}</div>
                {t.detalle && <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{stripHtml(t.detalle)}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: t.checklist.length ? 12 : 0 }}>
                  <span style={{ flex: 1 }}><MiniBar v={t.progress} /></span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--dim)' }}>{t.progress}%</span>
                  {t.checklist.length > 0 && <button onClick={(e) => { e.stopPropagation(); toggleExp(t.id); }} style={{ border: 'none', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{open ? '▾' : '▸'} checklist {clDone}/{t.checklist.length}</button>}
                </div>
                {open && t.checklist.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    {t.checklist.map((c) => (
                      <label key={c.id} onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '3px 0' }}>
                        <button onClick={(e) => { e.stopPropagation(); board.setChecklist(t.id, t.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)), c.done ? undefined : `Completó "${c.text.slice(0, 30)}"`); }} style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${c.done ? 'var(--good)' : 'var(--border-strong)'}`, background: c.done ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 11, cursor: 'pointer', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.done ? '✓' : ''}</button>
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
    </div>
  );
}

// Card del Objetivo Principal (izquierda de Prioridades). Alto, clickeable → abre el
// proyecto. Muestra el detalle y el POR QUÉ es el norte (lo escribe el perro).
function ObjetivoCard({ objetivo, onOpen }: { objetivo: Label; onOpen: () => void }) {
  return (
    <div onClick={onOpen} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: `1px solid ${objetivo.color}59`, borderTop: `4px solid ${objetivo.color}`, borderRadius: 16, padding: '20px 22px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(18,21,27,.05)', transition: 'border-color .12s' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = objetivo.color)} onMouseLeave={(e) => (e.currentTarget.style.borderColor = objetivo.color + '59')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: objetivo.color, fontWeight: 700 }}>🎯 Objetivo Principal</span>
        <span style={{ flex: 1 }} />
        <ProjScore score={objetivo.score} color={objetivo.color} />
      </div>
      <div style={{ fontSize: 26, lineHeight: 1, marginBottom: 8 }}>{objetivo.emoji}</div>
      <div style={{ fontSize: 21, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.25, marginBottom: 12 }}>{objetivo.name}</div>
      {objetivo.detalle && <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{stripHtml(objetivo.detalle)}</div>}
      <span style={{ flex: 1 }} />
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <GuardianIcon size={15} />
          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700 }}>Por qué es el norte</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.55, fontStyle: objetivo.scoreRazon ? 'italic' : 'normal' }}>
          {objetivo.scoreRazon ? `“${objetivo.scoreRazon}”` : 'El perro todavía no escribió por qué. Se completa en la próxima re-priorización.'}
        </div>
      </div>
    </div>
  );
}

// ── filtro por etiqueta ─────────────────────────────────────────────────────────
// Botón "Filtrar" de 2 CAPAS (#13): estado (Todas/Activas/Comenzadas/Completadas) +
// etiquetas. `labels` opcional: en Proyectos solo va la capa de estado.
function FilterMenu({ labels, fLabels, setFLabels, doneFilter, setDoneFilter, estadoLabels }: {
  labels?: Label[]; fLabels?: Set<string>; setFLabels?: (s: Set<string>) => void;
  doneFilter: DoneFilter; setDoneFilter: (f: DoneFilter) => void; estadoLabels?: Array<[DoneFilter, string]>;
}) {
  const [open, setOpen] = useState(false);
  const n = (fLabels?.size ?? 0) + (doneFilter !== 'all' ? 1 : 0);
  const toggle = (id: string) => { if (!fLabels || !setFLabels) return; const c = new Set(fLabels); if (c.has(id)) c.delete(id); else c.add(id); setFLabels(c); };
  const ops = estadoLabels ?? ESTADO_OPS;
  const secLabel: CSSProperties = { fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, padding: '2px 4px 6px' };
  return (
    <span style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ position: 'relative', ...ghostBtn, display: 'inline-flex', alignItems: 'center', gap: 7, background: open ? 'var(--surface-2)' : 'var(--surface)', color: n > 0 ? 'var(--primary)' : 'var(--dim)', borderColor: n > 0 ? 'var(--primary-weak)' : 'var(--border-strong)' }}>
        <FunnelIcon color="var(--primary)" />Filtrar
        {n > 0 && <span onClick={(e) => { e.stopPropagation(); setFLabels?.(new Set()); setDoneFilter('all'); }} title="Limpiar" style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>{n}</span>}
      </button>
      {open && <>
        <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'absolute', top: 40, right: 0, zIndex: 41, width: 234, maxHeight: 420, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(18,21,27,.16)', padding: 8 }}>
          {/* CAPA 1: estado */}
          <div style={secLabel}>Estado</div>
          {ops.map(([v, label]) => (
            <button key={v} onClick={() => setDoneFilter(v)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 9px', borderRadius: 7, border: 'none', background: doneFilter === v ? 'var(--primary-bg)' : 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--ink)', textAlign: 'left', fontFamily: SANS, fontWeight: doneFilter === v ? 700 : 500 }}>
              <span style={{ width: 13, height: 13, borderRadius: '50%', border: `2px solid ${doneFilter === v ? 'var(--primary)' : 'var(--border-strong)'}`, background: doneFilter === v ? 'var(--primary)' : 'transparent', flex: 'none', boxShadow: doneFilter === v ? 'inset 0 0 0 2px var(--surface)' : 'none' }} />
              <span>{label}</span>
            </button>
          ))}
          {/* CAPA 2: etiquetas (solo si hay labels) */}
          {labels && labels.length > 0 && (
            <>
              <div style={{ ...secLabel, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>{labels.length ? 'Proyecto' : ''}</div>
              {labels.map((l) => (
                <button key={l.id} onClick={() => toggle(l.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 9px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--ink)', textAlign: 'left', fontFamily: SANS }}>
                  <span style={{ width: 14, height: 14, borderRadius: 4, border: `1px solid ${fLabels?.has(l.id) ? 'var(--primary)' : 'var(--border-strong)'}`, background: fLabels?.has(l.id) ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{fLabels?.has(l.id) ? '✓' : ''}</span>
                  <span>{l.emoji} {l.name}</span>
                </button>
              ))}
            </>
          )}
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
            {/* #10: no se puede deshacer un cambio de MaKo / el perro — sería saltearse el sistema */}
            {i === 0 && h.undo && h.actor !== 'ia' && <button onClick={() => ask('Se revierte este cambio y se borra del historial. ¿Seguir?', () => board.undoHist(t.id, h))} title="Deshacer el último cambio" style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 8, padding: '4px 9px', fontSize: 12, cursor: 'pointer', flex: 'none', fontFamily: SANS }}>↶ Deshacer</button>}
          </div>
        );
      })}
    </div>
  );
}

// ── modal de detalle ────────────────────────────────────────────────────────────
function TaskModal({ t, board, topProjectId, suggestMako = false, onDebate, onDelete, onAsignar, ask, onClose }: {
  t: BoardTask; board: Board; topProjectId: string | null; suggestMako?: boolean; onDebate: () => void; onDelete: () => void; onAsignar: () => void; ask: (msg: string, onOk: () => void) => void; onClose: () => void;
}) {
  const prioEfectiva = displayPrio(t, topProjectId);
  const topeada = prioEfectiva !== prioFromScore(t.score);
  const [newItem, setNewItem] = useState('');
  const [mako, setMako] = useState(false);
  const [titleDraft, setTitleDraft] = useState(t.title);

  // commit del título al DESMONTAR (Escape/cierre no dispara onBlur). El detalle lo
  // maneja RichText (commit onBlur).
  const tRef = useRef(t);
  const tdRef = useRef(titleDraft);
  useEffect(() => { tRef.current = t; tdRef.current = titleDraft; });
  useEffect(() => () => { board.setTitle(tRef.current.id, tdRef.current, tRef.current.title); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Escape cierra la ficha (blureando primero para commitear el detalle), salvo submodal de MaKo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !mako) { (document.activeElement as HTMLElement)?.blur?.(); onClose(); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [mako, onClose]);
  const chips = t.labels.map((id) => board.labelById(id)).filter((l): l is Label => l != null);
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${optimizada ? 'var(--good)' : 'var(--primary-weak)'}`, background: optimizada ? 'var(--good-bg, var(--surface))' : 'var(--primary-bg)', color: optimizada ? 'var(--good)' : 'var(--primary)', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: suggestMako && !optimizada ? '0 0 0 3px var(--primary-weak)' : 'none', animation: suggestMako && !optimizada ? 'makoPulse 1.4s ease-in-out infinite' : 'none' }}>
            <style>{`@keyframes makoPulse{0%,100%{box-shadow:0 0 0 2px var(--primary-weak)}50%{box-shadow:0 0 0 5px transparent}}`}</style>
            {optimizada ? '✦ MaKo ✓ optimizada' : suggestMako ? '✦ Optimizala con MaKo' : '✦ MaKo te ayuda'}
          </button>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--faint)', padding: '2px 6px' }}>×</button>
        </div>
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 22px' }}>
            <textarea value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={() => board.setTitle(t.id, titleDraft, t.title)} rows={2} style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 22, fontWeight: 600, lineHeight: 1.3, fontFamily: SANS, letterSpacing: '-0.01em', marginBottom: 16 }} />
            <label style={rowLabel}>Detalle · doc</label>
            <div style={{ marginBottom: 22 }}><RichText value={t.detalle} onChange={(html) => board.setDetalle(t.id, html, t.detalle)} placeholder="El doc de esta tarea…" /></div>

            {/* Avance ARRIBA de la checklist (feedback #6). Siempre derivado (#17):
                con checklist sale de ella; sin checklist, botón Completada (0↔100). */}
            <label style={rowLabel}>Avance · {t.progress}%{cl.length > 0 ? ' · lo maneja la checklist' : ''}</label>
            <span style={{ display: 'block', marginBottom: 10 }}><MiniBar v={t.progress} /></span>
            {cl.length === 0 && (
              <button onClick={() => board.toggleDone(t.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${t.progress >= 100 ? 'var(--good)' : 'var(--border-strong)'}`, background: t.progress >= 100 ? 'var(--good-bg, var(--surface))' : 'var(--surface)', color: t.progress >= 100 ? 'var(--good)' : 'var(--dim)', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, marginBottom: 22 }}>
                <span style={{ width: 16, height: 16, borderRadius: 5, border: `1px solid ${t.progress >= 100 ? 'var(--good)' : 'var(--border-strong)'}`, background: t.progress >= 100 ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{t.progress >= 100 ? '✓' : ''}</span>
                {t.progress >= 100 ? 'Completada' : 'Marcar como completada'}
              </button>
            )}

            <label style={rowLabel}>Checklist {cl.length > 0 && `· ${clDone}/${cl.length} · manda el avance`}</label>
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
              {/* #5: "Prioridad: ALTA — 90" directo y grande, sin subtítulo, con ícono sofisticado */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: t.scoreRazon || topeada ? 8 : 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Prioridad:</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: PCOLOR[prioEfectiva], letterSpacing: '.01em' }}>{PLABEL[prioEfectiva].toUpperCase()}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 15, fontWeight: 700, color: PCOLOR[prioEfectiva] }}><ScoreIcon size={15} color={PCOLOR[prioEfectiva]} />{t.score}</span>
              </div>
              {t.scoreRazon && <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.4, marginBottom: 6, fontStyle: 'italic' }}>“{t.scoreRazon}”</div>}
              {topeada && <div style={{ fontSize: 11, color: 'var(--warn)', lineHeight: 1.4, marginBottom: 6 }}>Score de Alta, pero fuera del Objetivo Principal → queda en {PLABEL[prioEfectiva]}.</div>}
              <button onClick={onDebate} style={cambiarBtn}><MakoStar size={15} color="var(--primary)" /> Cambiar prioridad</button>
            </div>
            {/* #5: deadline en el sidebar */}
            <div><label style={rowLabel}>Deadline</label><input type="date" value={t.deadline} onChange={(e) => board.setDeadline(t.id, e.target.value, t.deadline)} style={selStyle} /></div>
            <div>
              <label style={rowLabel}>{board.repo.labelPlural}</label>
              {/* Los chips ya no se sacan con una × acá: cambiar de proyecto pasa por el
                  Perro Guardián (feedback #7). */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                {chips.length === 0
                  ? <span style={{ fontSize: 12, color: 'var(--faint)', fontStyle: 'italic' }}>Sin proyecto</span>
                  : chips.map((l) => (
                    <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, border: `1px solid ${l.color}59`, background: `${l.color}1f`, color: l.color }}>{l.emoji} {l.name}</span>
                  ))}
              </div>
              <button onClick={onAsignar} style={cambiarBtn}><MakoStar size={15} color="var(--primary)" /> {chips.length ? 'Cambiar proyecto' : 'Asignar proyecto'}</button>
            </div>
            <span style={{ flex: 1 }} />
            <button onClick={onDelete} style={{ border: 'none', background: 'transparent', color: 'var(--bad)', fontSize: 12.5, cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}>Eliminar tarea</button>
          </div>
        </div>
      </div>
      {mako && <MakoChecklistModal title={t.title} detalle={t.detalle} yaOptimizada={optimizada} onApply={(r) => {
        if (r.titulo) board.setTitle(t.id, r.titulo, t.title);
        if (r.detalle) board.setDetalle(t.id, r.detalle, t.detalle);
        if (r.items.length) setCl([...cl, ...r.items.map((x) => ({ id: uid(), text: x, done: false }))], `MaKo optimizó la tarea (+${r.items.length} ítem${r.items.length === 1 ? '' : 's'})`);
      }} onClose={() => setMako(false)} />}
    </div>
  );
}

// ── change history para proyectos — con deshacer (solo la última entrada del usuario) ──
function HistList({ historial, nombre, avatarUrl, onUndo }: { historial: BoardTask['historial']; nombre: string; avatarUrl: string; onUndo?: (h: import('./types').Hist) => void }) {
  const [nowMs, setNowMs] = useState(0);
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setNowMs(Date.now()); }, []);
  if (historial.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin actividad todavía.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {historial.map((h, i) => {
        const esCreacion = h.text.startsWith('Creó el proyecto');
        return (
          <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <ActorAvatar actor={h.actor} nombre={nombre} avatarUrl={avatarUrl} size={24} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}><strong style={{ fontWeight: 600 }}>{h.actor === 'ia' ? 'MaKo' : (nombre || 'Usuario')}</strong> · {esCreacion ? (h.actor === 'ia' ? 'Creado por la IA' : `Creado por ${nombre || 'vos'}`) : h.text}</div>
              <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{relTime(h.ts, nowMs)}</div>
            </div>
            {/* solo el último cambio del usuario se puede deshacer (nunca los de MaKo) */}
            {i === 0 && h.undo && h.actor !== 'ia' && onUndo && <button onClick={() => onUndo(h)} title="Deshacer" style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 8, padding: '3px 9px', fontSize: 12, cursor: 'pointer', flex: 'none', fontFamily: SANS }}>↶</button>}
          </div>
        );
      })}
    </div>
  );
}

// ── change history de la TAB Proyectos: agrega los eventos de CADA proyecto
// (creación/rename/detalle/score…), NO los de tareas (esos viven en el detalle). ──
function ProjTabHist({ labels, nombre, avatarUrl }: { labels: Label[]; nombre: string; avatarUrl: string }) {
  const [nowMs, setNowMs] = useState(0);
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setNowMs(Date.now()); }, []);
  const rows = labels
    .flatMap((l) => l.historial.filter((h) => h.kind !== 'task').map((h) => ({ h, l })))
    .sort((a, b) => b.h.ts - a.h.ts)
    .slice(0, 40);
  if (rows.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin actividad de proyectos todavía.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {rows.map(({ h, l }) => {
        const esCreacion = h.text.startsWith('Creó el proyecto');
        return (
          <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <ActorAvatar actor={h.actor} nombre={nombre} avatarUrl={avatarUrl} size={24} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '1px 7px 1px 5px', borderRadius: 999, border: `1px solid ${l.color}59`, background: `${l.color}1f`, color: l.color, marginRight: 6, verticalAlign: 'middle' }}>{l.emoji} {l.name}</span>
                <strong style={{ fontWeight: 600 }}>{h.actor === 'ia' ? 'MaKo' : (nombre || 'Usuario')}</strong> · {esCreacion ? (h.actor === 'ia' ? 'Creado por la IA' : `Creado por ${nombre || 'vos'}`) : h.text}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{relTime(h.ts, nowMs)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── vista Proyectos (tab): cards ordenadas por prioridad ────────────────────────
function ProyectosView({ board, topProjectId, onOpen, onNew }: { board: Board; topProjectId: string | null; onOpen: (id: string) => void; onNew: () => void }) {
  const { labels, tasks, repo } = board;
  const [projFilter, setProjFilter] = useState<DoneFilter>('all');
  const withProg = labels.slice().sort((a, b) => b.score - a.score).map((l) => ({ l, prog: projProgress(tasks, l.id) }));
  const completo = (p: { total: number; done: number }) => p.total > 0 && p.done === p.total;
  const shown = withProg.filter(({ prog }) => pasaEstado(prog.pct, projFilter));
  // #15 progreso agregado de TODOS los proyectos (promedio de los que tienen tareas)
  const conTareas = withProg.filter(({ prog }) => prog.total > 0);
  const avgProj = conTareas.length ? Math.round(conTareas.reduce((s, { prog }) => s + prog.pct, 0) / conTareas.length) : 0;
  const hechosProj = withProg.filter(({ prog }) => completo(prog)).length;
  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '18px 30px 40px' }}>
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700 }}>{repo.labelPlural}</span>
          <span style={{ flex: 1 }} />
          <AvgChip avg={avgProj} hechas={hechosProj} total={withProg.length} label="proyectos ✓" />
          <FilterMenu doneFilter={projFilter} setDoneFilter={setProjFilter} estadoLabels={[['all', 'Todos'], ['activas', 'Activos'], ['comenzadas', 'Comenzados'], ['hechas', 'Completados']]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {shown.map(({ l, prog }) => {
            const isTop = l.id === topProjectId;
            return (
              <div key={l.id} onClick={() => onOpen(l.id)} style={{ background: 'var(--surface)', border: `1px solid ${isTop ? l.color + '80' : 'var(--border)'}`, borderTop: `3px solid ${l.color}`, borderRadius: 14, padding: '15px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 128, transition: 'border-color .12s' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = isTop ? l.color + '80' : 'var(--border)')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{l.emoji}</span>
                  <span style={{ flex: 1 }} />
                  {completo(prog) && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--good)', background: 'var(--good-bg, var(--surface))', border: '1px solid var(--good)', borderRadius: 6, padding: '1px 6px' }}>✓ Completo</span>}
                  <ProjScore score={l.score} color={l.color} />
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{l.name}</div>
                {isTop && <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: l.color, fontWeight: 700 }}>🎯 Objetivo Principal</span>}
                {l.detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{stripHtml(l.detalle)}</div>}
                <span style={{ flex: 1 }} />
                {prog.total > 0 && <span style={{ display: 'block' }}><MiniBar v={prog.pct} /></span>}
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{prog.total ? `${prog.done}/${prog.total} · ${prog.pct}%` : 'sin tareas'}</div>
              </div>
            );
          })}
          {/* #8: card translúcida "crear proyecto" al final, en vez del botón de arriba */}
          <button onClick={onNew} style={{ border: '1.5px dashed var(--border-strong)', background: 'transparent', borderRadius: 14, padding: '15px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 128, color: 'var(--faint)', fontFamily: SANS, opacity: 0.85, transition: 'border-color .12s, color .12s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--faint)'; }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>＋</span>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Crear nuevo {repo.labelSingular.toLowerCase()}…</span>
          </button>
          {shown.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--faint)', fontSize: 13, padding: '10px 0 0' }}>No hay {repo.labelPlural.toLowerCase()} para este filtro.</div>}
        </div>
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, marginBottom: 12 }}>Change history · proyectos</div>
          <ProjTabHist labels={labels} nombre={board.user.nombre} avatarUrl={board.user.avatarUrl} />
        </div>
      </div>
    </div>
  );
}

// ── detalle de un proyecto — MISMO layout de 2 columnas que la ficha de tarea (#25) ─
function ProjectDetailModal({ proj, board, topProjectId, onOpenTask, onNewTask, onDebatePrio, onMako, onDelete, onClose }: { proj: Label; board: Board; topProjectId: string | null; onOpenTask: (id: string) => void; onNewTask: () => void; onDebatePrio: () => void; onMako: () => void; onDelete: () => void; onClose: () => void }) {
  const [nameDraft, setNameDraft] = useState(proj.name);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { (document.activeElement as HTMLElement)?.blur?.(); onClose(); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const suyas = board.tasks.filter((t) => t.labels.includes(proj.id)).sort((a, b) => (a.progress >= 100 ? 1 : 0) - (b.progress >= 100 ? 1 : 0) || b.score - a.score);
  const prog = projProgress(board.tasks, proj.id);
  const isTop = proj.id === topProjectId;
  const rowLabel: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6, display: 'block' };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(18,21,27,.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 16px 16px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 820, maxHeight: '85vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
          <EmojiPickerMini value={proj.emoji} onPick={(em) => board.patchLabelLog(proj.id, { emoji: em }, 'Cambió el emoji')} />
          {isTop && <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: proj.color, fontWeight: 700 }}>🎯 Objetivo Principal</span>}
          <span style={{ flex: 1 }} />
          <button onClick={onMako} title="MaKo te ayuda a mejorar el nombre y el detalle" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)', color: 'var(--primary)', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>✦ MaKo te ayuda</button>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--faint)', padding: '2px 6px' }}>×</button>
        </div>
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          {/* columna principal */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 22px' }}>
            <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onBlur={() => { if (nameDraft.trim() && nameDraft !== proj.name) board.patchLabelLog(proj.id, { name: nameDraft.trim() }, `Renombró el proyecto → «${nameDraft.trim()}»`); }}
              style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 22, fontWeight: 600, fontFamily: SANS, letterSpacing: '-0.01em', marginBottom: 16 }} />
            <label style={rowLabel}>Detalle · doc</label>
            <div style={{ marginBottom: 22 }}><RichText value={proj.detalle} onChange={(html) => { if (html !== proj.detalle) board.patchLabelLog(proj.id, { detalle: html }, 'Editó el detalle'); }} placeholder="¿De qué se trata este proyecto?" /></div>

            {/* AVANCE arriba de las tareas (#4) */}
            <label style={rowLabel}>Avance · {prog.pct}%{prog.total ? ` · ${prog.done}/${prog.total} tareas` : ''}</label>
            <span style={{ display: 'block', marginBottom: 20 }}><MiniBar v={prog.pct} /></span>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ ...rowLabel, marginBottom: 0 }}>Tareas del proyecto · {suyas.length}</label>
              <span style={{ flex: 1 }} />
              <button onClick={onNewTask} style={{ border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)', color: 'var(--primary)', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>+ Nueva Tarea</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {suyas.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Sin tareas todavía.</div>}
              {suyas.map((t) => (
                <div key={t.id} onClick={() => onOpenTask(t.id)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px', cursor: 'pointer', opacity: t.progress >= 100 ? 0.62 : 1, transition: 'border-color .12s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                    <ScoreBadge score={t.score} />
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', textDecoration: t.progress >= 100 ? 'line-through' : 'none', minWidth: 0 }}>{t.title}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)' }}>{t.progress}%</span>
                  </div>
                  <MiniBar v={t.progress} />
                </div>
              ))}
            </div>

            <label style={rowLabel}>Change history del proyecto</label>
            <HistList historial={proj.historial} nombre={board.user.nombre} avatarUrl={board.user.avatarUrl} onUndo={(h) => board.undoLabelHist(proj.id, h)} />
          </div>
          {/* sidebar */}
          <div style={{ width: 236, flex: 'none', borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', padding: '20px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: proj.scoreRazon ? 8 : 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Prioridad</span>
                <ProjScore score={proj.score} color={proj.color} big />
              </div>
              {proj.scoreRazon && <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.4, marginBottom: 6, fontStyle: 'italic' }}>“{proj.scoreRazon}”</div>}
              <button onClick={onDebatePrio} style={cambiarBtn}><MakoStar size={15} color="var(--primary)" /> Cambiar prioridad</button>
            </div>
            <div><label style={rowLabel}>Deadline</label><input type="date" value={proj.deadline || ''} onChange={(e) => board.patchLabelLog(proj.id, { deadline: e.target.value }, e.target.value ? `Deadline ${e.target.value}` : 'Quitó el deadline')} style={selStyle} /></div>
            <div><label style={rowLabel}>Color</label><ColorDropdown color={proj.color} onPick={(c) => board.patchLabel(proj.id, { color: c })} /></div>
            <span style={{ flex: 1 }} />
            <button onClick={onDelete} style={{ border: 'none', background: 'transparent', color: 'var(--bad)', fontSize: 12.5, cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}>Eliminar el proyecto y sus {suyas.length} tarea{suyas.length === 1 ? '' : 's'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Color como DESPLEGABLE (#4): botón con el color actual → panel con swatches + RGB.
function ColorDropdown({ color, onPick }: { color: string; onPick: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'block' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ ...selStyle, display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
        <span style={{ width: 16, height: 16, borderRadius: 5, background: color, border: '1px solid rgba(0,0,0,.15)', flex: 'none' }} />
        <span style={{ flex: 1, textAlign: 'left', fontFamily: MONO, fontSize: 12 }}>{color.toUpperCase()}</span>
        <span style={{ color: 'var(--faint)' }}>▾</span>
      </button>
      {open && <>
        <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 95 }} />
        <div style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0, zIndex: 96, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, boxShadow: '0 16px 40px rgba(18,21,27,.2)', padding: 12 }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
            {SWATCHES.map((s) => <button key={s} onClick={() => { onPick(s); setOpen(false); }} title={s} style={{ width: 22, height: 22, borderRadius: 7, background: s, border: color.toLowerCase() === s.toLowerCase() ? '2px solid var(--ink)' : '2px solid transparent', cursor: 'pointer', flex: 'none' }} />)}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--dim)', cursor: 'pointer' }}>
            <input type="color" value={color} onChange={(e) => onPick(e.target.value)} style={{ width: 26, height: 22, padding: 0, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }} />
            Elegir cualquier color (RGB)
          </label>
        </div>
      </>}
    </span>
  );
}
