'use client';

// useBoard — estado + toda la lógica del tablero (optimista, change history, undo).
// La persistencia la inyecta el `Repo` (localStorage en admin, API en cliente).

import { useState } from 'react';
import { useUndoToast } from '../../_components/UndoToast';
import { type BoardTask, type Label, type BoardUser, type Repo, type Hist, type Actor, type Prio, type Check, PLABEL, MAX_PRIORIDAD, uid, clampPct } from './types';

const now = () => Date.now();

export function useBoard(initialTasks: BoardTask[], initialLabels: Label[], user: BoardUser, repo: Repo) {
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const [labels, setLabels] = useState<Label[]>(initialLabels);
  const { undo, show, clear } = useUndoToast();

  const byId = (id: string) => tasks.find((t) => t.id === id) ?? null;
  const upd = (id: string, f: (t: BoardTask) => BoardTask) => setTasks((ts) => ts.map((t) => (t.id === id ? f(t) : t)));

  // ── persistencia (optimista; los errores no revierten, solo se loguean) ──
  const persist = (task: BoardTask) => { void repo.saveTask(task).catch((e) => console.error('[board] saveTask', e)); };

  // patch sin log
  const patch = (id: string, fields: Partial<BoardTask>) => {
    let next: BoardTask | null = null;
    upd(id, (t) => (next = { ...t, ...fields }));
    if (next) persist(next);
  };

  // patch + entrada en el change history (con info de undo: field + valor previo)
  function patchLog<K extends keyof BoardTask>(id: string, field: K, value: BoardTask[K], text: string, actor: Actor = 'user') {
    const t = byId(id); if (!t) return;
    const entry: Hist = { ts: now(), actor, text, undo: { field, prev: t[field] } };
    const next: BoardTask = { ...t, [field]: value, historial: [entry, ...t.historial] };
    setTasks((ts) => ts.map((x) => (x.id === id ? next : x)));
    persist(next);
  }

  const create = async (title: string, priority: Prio): Promise<BoardTask | null> => {
    const v = title.trim(); if (!v) return null;
    const maxN = tasks.reduce((m, t) => Math.max(m, t.num), 0);
    const draft: BoardTask = { id: 'tmp' + uid(), num: maxN + 1, title: v, detalle: '', priority, progress: 0, deadline: '', labels: repo.labelMode === 'single' && labels[0] ? [labels[0].id] : [], checklist: [], historial: [{ ts: now(), actor: 'user', text: 'Creó la tarjeta' }], origen: 'user', enPrioridad: false };
    setTasks((ts) => [draft, ...ts]);
    try {
      const canon = await repo.createTask(draft);
      setTasks((ts) => ts.map((t) => (t.id === draft.id ? canon : t)));
      return canon;
    } catch (e) { console.error('[board] createTask', e); return draft; }
  };

  const remove = (id: string) => {
    const snap = byId(id); if (!snap) return;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    void repo.deleteTask(id).catch((e) => console.error('[board] deleteTask', e));
    show('Tarea eliminada', async () => {
      setTasks((ts) => [snap, ...ts]);
      try { const canon = await repo.createTask(snap); setTasks((ts) => ts.map((t) => (t.id === snap.id ? canon : t))); }
      catch (e) { console.error('[board] restore', e); }
    });
  };

  const moveTo = (id: string, priority: Prio) => {
    const t = byId(id); if (!t || t.priority === priority) return;
    const from = t.priority;
    patchLog(id, 'priority', priority, `Movió a ${PLABEL[priority]}`);
    show(`"${t.title.slice(0, 26)}" → ${PLABEL[priority]}`, () => patchLog(id, 'priority', from, `Volvió a ${PLABEL[from]}`));
  };

  // devuelve false si se alcanzó el tope de "En prioridad"
  const toggleEnPrioridad = (id: string): boolean => {
    const t = byId(id); if (!t) return false;
    if (!t.enPrioridad && tasks.filter((x) => x.enPrioridad).length >= MAX_PRIORIDAD) return false;
    patchLog(id, 'enPrioridad', !t.enPrioridad, t.enPrioridad ? 'Quitó de prioridad' : 'Puso en prioridad');
    return true;
  };

  const setChecklist = (id: string, next: Check[], text?: string) => {
    if (text) patchLog(id, 'checklist', next, text);
    else patch(id, { checklist: next });
  };

  const setTitle = (id: string, title: string, prev: string) => {
    if (title.trim() === prev.trim()) return;
    patchLogExplicit(id, 'title', title, prev, 'Editó el título');
  };
  const setDetalle = (id: string, detalle: string, prev: string) => {
    if (detalle === prev) return;
    patchLogExplicit(id, 'detalle', detalle, prev, 'Editó el detalle');
  };
  const setProgress = (id: string, value: number, prev: number) => {
    const v = clampPct(value);
    if (v === prev) return;
    patchLogExplicit(id, 'progress', v, prev, `Avance ${v}%`);
  };
  const setDeadline = (id: string, deadline: string, prev: string) => {
    if (deadline === prev) return;
    patchLogExplicit(id, 'deadline', deadline, prev, deadline ? `Deadline ${deadline}` : 'Quitó el deadline');
  };
  const setTaskLabels = (id: string, next: string[], text: string) => patchLogExplicit(id, 'labels', next, byId(id)?.labels ?? [], text);

  // patch + log con prev EXPLÍCITO (para valores que ya venían editándose en vivo)
  function patchLogExplicit<K extends keyof BoardTask>(id: string, field: K, value: BoardTask[K], prev: unknown, text: string, actor: Actor = 'user') {
    const t = byId(id); if (!t) return;
    const entry: Hist = { ts: now(), actor, text, undo: { field, prev } };
    const next: BoardTask = { ...t, [field]: value, historial: [entry, ...t.historial] };
    setTasks((ts) => ts.map((x) => (x.id === id ? next : x)));
    persist(next);
  }

  // deshacer una entrada del historial: revierte el campo Y borra la entrada
  // (mismo criterio que Lead Details: "un cambio deshecho no es historia").
  const undoHist = (id: string, entry: Hist) => {
    const t = byId(id); if (!t || !entry.undo) return;
    const restored = { ...t, historial: t.historial.filter((h) => h.ts !== entry.ts) } as BoardTask;
    (restored as unknown as Record<string, unknown>)[entry.undo.field] = entry.undo.prev;
    setTasks((ts) => ts.map((x) => (x.id === id ? restored : x)));
    persist(restored);
  };

  // ── etiquetas (proyectos / categorías) ──
  const createLabel = async (draft: Label) => {
    setLabels((ls) => [...ls, draft]);
    try { const canon = await repo.createLabel(draft); setLabels((ls) => ls.map((l) => (l.id === draft.id ? canon : l))); }
    catch (e) { console.error('[board] createLabel', e); }
  };
  const patchLabel = (id: string, fields: Partial<Label>) => {
    let next: Label | null = null;
    setLabels((ls) => ls.map((l) => (l.id === id ? (next = { ...l, ...fields }) : l)));
    if (next) void repo.saveLabel(next).catch((e) => console.error('[board] saveLabel', e));
  };
  const deleteLabel = (id: string) => {
    setLabels((ls) => ls.filter((l) => l.id !== id));
    // sacar la etiqueta de las tareas que la tenían
    setTasks((ts) => ts.map((t) => (t.labels.includes(id) ? { ...t, labels: t.labels.filter((x) => x !== id) } : t)));
    void repo.deleteLabel(id).catch((e) => console.error('[board] deleteLabel', e));
  };

  const reset = (t: BoardTask[], l: Label[]) => { setTasks(t); setLabels(l); };

  return {
    tasks, labels, user, repo,
    labelById: (id: string) => labels.find((l) => l.id === id) ?? null,
    create, remove, patch, moveTo, toggleEnPrioridad, setChecklist,
    setTitle, setDetalle, setProgress, setDeadline, setTaskLabels, undoHist,
    createLabel, patchLabel, deleteLabel, reset,
    undo, showUndo: show, clearUndo: clear,
  };
}

export type Board = ReturnType<typeof useBoard>;
