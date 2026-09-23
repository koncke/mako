'use client';

// useBoard — estado + toda la lógica del tablero (optimista, change history, undo).
// La persistencia la inyecta el `Repo` (localStorage en admin, API en cliente).

import { useEffect, useRef, useState } from 'react';
import { useUndoToast } from '../../_components/UndoToast';
import { type BoardTask, type Label, type BoardUser, type Repo, type Hist, type Actor, type Fuente, type Prio, type Check, type GuardPatch, type GuardProjPatch, PLABEL, MAX_PRIORIDAD, HIST_CAP, uid, clampPct, clampScore, clampProj, prioFromScore, scoreFromPrio } from './types';
import { type Dep, type ClaseDep, type EntidadDep, puedeDepender } from './dependencias';

export type GuardScore = { id: string; score: number; razon: string; impacto?: number; esfuerzo?: number };

const now = () => Date.now();

export function useBoard(initialTasks: BoardTask[], initialLabels: Label[], user: BoardUser, repo: Repo, initialDeps: Dep[] = []) {
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const [labels, setLabels] = useState<Label[]>(initialLabels);
  // Las dependencias NO viven adentro de la tarea (mig 0140: tabla propia). El autosave de
  // acá abajo upsertea la FILA ENTERA desde el estado del navegador, así que un campo
  // dentro de la tarea lo pisaría una pestaña con estado viejo, sin error y sin build roto.
  // Con la relación afuera, ese modo de falla no existe.
  const [deps, setDeps] = useState<Dep[]>(initialDeps);
  const { undo, show, clear } = useUndoToast();

  const byId = (id: string) => tasks.find((t) => t.id === id) ?? null;

  // ── persistencia por "dirty set": marcamos ids cambiados y un efecto los
  // guarda con el estado FRESCO (evita el clobber de precomputar `next`). ──
  const dirty = useRef<Set<string>>(new Set());
  const markDirty = (id: string) => { dirty.current.add(id); };
  useEffect(() => {
    if (dirty.current.size === 0) return;
    const ids = [...dirty.current]; dirty.current.clear();
    for (const id of ids) { const t = tasks.find((x) => x.id === id); if (t) void repo.saveTask(t).catch((e) => console.error('[board] saveTask', e)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const mkEntry = (actor: Actor, text: string, field: string, prev: unknown): Hist => ({ id: uid(), ts: now(), actor, text, undo: { field, prev } });

  // patch sin log (acumula en el updater con el task fresco)
  const patch = (id: string, fields: Partial<BoardTask>) => {
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, ...fields } : x)));
    markDirty(id);
  };

  // patch + entrada en el change history. El `prev` para el undo se lee del task
  // ACTUAL (correcto para campos distintos); el nuevo valor se aplica DENTRO del
  // updater sobre el task fresco, así dos cambios encadenados no se pisan.
  function patchLog<K extends keyof BoardTask>(id: string, field: K, value: BoardTask[K], text: string, actor: Actor = 'user') {
    const t = byId(id); if (!t) return;
    const entry = mkEntry(actor, text, field, t[field]);
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, [field]: value, historial: [entry, ...x.historial].slice(0, HIST_CAP) } : x)));
    markDirty(id);
  }
  // igual pero con `prev` explícito (para valores que ya venían editándose en vivo)
  function patchLogExplicit<K extends keyof BoardTask>(id: string, field: K, value: BoardTask[K], prev: unknown, text: string, actor: Actor = 'user') {
    const entry = mkEntry(actor, text, field, prev);
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, [field]: value, historial: [entry, ...x.historial].slice(0, HIST_CAP) } : x)));
    markDirty(id);
  }

  const create = async (title: string, priority: Prio, labelsIn?: string[], meta?: { origen?: Actor; fuente?: Fuente; altaText?: string; detalle?: string }): Promise<BoardTask | null> => {
    const v = title.trim(); if (!v) return null;
    const maxN = tasks.reduce((m, t) => Math.max(m, t.num), 0);
    // `labelsIn` undefined = "no me dijeron proyecto" → hereda el primero (alta manual
    // dentro de un tablero de un solo proyecto). `labelsIn` = [] es DISTINTO: es "esta
    // tarea NO va a ningún proyecto", y hay que respetarlo. Sin esa diferencia, toda
    // tarea que la IA dejó sin proyecto se apilaba en el primero de la lista — por eso
    // terminaba TODO dentro de «Setup inicial de Maco», incluidas tareas de otras
    // personas y de temas que no tenían nada que ver.
    const labels0 = labelsIn ? labelsIn : (repo.labelMode === 'single' && labels[0] ? [labels[0].id] : []);
    // El emoji nace heredado del proyecto elegido (o 📌); editable después.
    const emoji0 = labels.find((l) => l.id === labels0[0])?.emoji || '📌';
    // origen + fuente + texto del alta: por default es una tarjeta del usuario, pero
    // quien la crea desde otra fuente (Fathom/WhatsApp/archivo) los pasa por `meta`.
    const actor: Actor = meta?.origen ?? 'user';
    const draft: BoardTask = { id: 'tmp' + uid(), num: maxN + 1, emoji: emoji0, title: v, detalle: meta?.detalle ?? '', priority, score: scoreFromPrio[priority], progress: 0, deadline: '', labels: labels0, checklist: [], historial: [{ id: uid(), ts: now(), actor, text: meta?.altaText || 'Creó la tarjeta' }], origen: actor, fuente: meta?.fuente, enPrioridad: false };
    setTasks((ts) => [draft, ...ts]);
    try {
      const canon = await repo.createTask(draft);
      // preservar ediciones en vuelo: mantenemos el task local y solo fijamos el id real
      setTasks((ts) => ts.map((x) => (x.id === draft.id ? { ...x, id: canon.id, num: canon.num || x.num, origen: canon.origen } : x)));
      markDirty(canon.id);
      draft.labels.forEach((lid) => logProject(lid, `Agregó la tarea «${v.slice(0, 38)}»`));
      return { ...draft, id: canon.id };
    } catch (e) {
      console.error('[board] createTask', e);
      setTasks((ts) => ts.filter((x) => x.id !== draft.id)); // revertir la tarjeta optimista
      return null;
    }
  };

  // Borra sin toast propio (para deshacer un alta en lote: el toast lo maneja el caller).
  const removeSilent = (id: string) => {
    if (!byId(id)) return;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    void repo.deleteTask(id).catch((e) => console.error('[board] deleteTask', e));
  };
  const remove = (id: string, motivo?: string) => {
    const snap = byId(id); if (!snap) return;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    void repo.deleteTask(id).catch((e) => console.error('[board] deleteTask', e));
    snap.labels.forEach((lid) => logProject(lid, `Eliminó la tarea «${snap.title.slice(0, 34)}»${motivo ? ` — ${motivo.slice(0, 60)}` : ''}`));
    show('Tarea eliminada', async () => {
      setTasks((ts) => [snap, ...ts]);
      try { const canon = await repo.createTask(snap); setTasks((ts) => ts.map((t) => (t.id === snap.id ? canon : t))); }
      catch (e) { console.error('[board] restore', e); }
    });
  };

  // El SCORE es la fuente de verdad; la columna (priority) se DERIVA de él.
  //
  // ⚠️ Escribe TAMBIÉN `scoreBase` (mig 0141), y es lo que hace que arrastrar una tarjeta
  // signifique algo. Sin esto, el reparto determinista la devolvía a su lugar en la
  // siguiente corrida: arrastro, rebota, arrastro, rebota, sin nada que lo explique.
  // Mover una tarjeta a mano ES un juicio, y un juicio se guarda donde viven los juicios.
  const setScore = (id: string, score: number, text: string, actor: Actor = 'user', razon?: string) => {
    const t = byId(id); if (!t) return;
    const s = clampScore(score);
    const entry = mkEntry(actor, text, 'score', t.score);
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, score: s, scoreBase: s, priority: prioFromScore(s), scoreRazon: razon ?? x.scoreRazon, historial: [entry, ...x.historial].slice(0, HIST_CAP) } : x)));
    markDirty(id);
  };
  const moveTo = (id: string, priority: Prio) => {
    const t = byId(id); if (!t || t.priority === priority) return;
    const fromScore = t.score, fromPrio = t.priority;
    setScore(id, scoreFromPrio[priority], `Movió a ${PLABEL[priority]}`);
    show(`"${t.title.slice(0, 26)}" → ${PLABEL[priority]}`, () => setScore(id, fromScore, `Volvió a ${PLABEL[fromPrio]}`));
  };
  // aplica la puntuación del guardián: score → columna derivada, 1 entrada por tarea.
  const applyGuardian = (tareas: GuardScore[], proyectos: GuardScore[]) => {
    setTasks((ts) => ts.map((x) => {
      const g = tareas.find((t) => t.id === x.id); if (!g) return x;
      const s = clampScore(g.score);
      const entry = mkEntry('ia', `Priorizó · score ${s}`, 'score', x.score);
      return { ...x, score: s, scoreBase: s, priority: prioFromScore(s), scoreRazon: g.razon, impacto: g.impacto ?? x.impacto, esfuerzo: g.esfuerzo ?? x.esfuerzo, historial: [entry, ...x.historial].slice(0, HIST_CAP) };
    }));
    tareas.forEach((t) => markDirty(t.id));
    setLabels((ls) => ls.map((l) => { const g = proyectos.find((p) => p.id === l.id); return g ? { ...l, score: clampProj(g.score), scoreRazon: g.razon || l.scoreRazon } : l; }));
    proyectos.forEach((p) => { const l = labels.find((x) => x.id === p.id); if (l) void repo.saveLabel({ ...l, score: clampProj(p.score), scoreRazon: p.razon || l.scoreRazon }).catch((e) => console.error('[board] saveLabel', e)); });
  };

  // Igual que applyGuardian pero para el Perro SERVER-SIDE: la DB ya quedó escrita, así
  // que acá solo sincronizamos la pantalla. NADA de markDirty/saveTask: volver a guardar
  // desde el navegador es justo lo que borraba el trabajo del Perro (upsert de fila
  // completa con el estado viejo). Trae también detalle y checklist, que el path client
  // no tiene.
  const aplicarPerroServer = (patches: GuardPatch[], proys: GuardProjPatch[] = []) => {
    if (patches.length) {
      setTasks((ts) => ts.map((x) => {
        const p = patches.find((q) => q.id === x.id); if (!p) return x;
        return {
          ...x,
          score: p.score != null ? clampScore(p.score) : x.score,
          priority: p.priority ?? (p.score != null ? prioFromScore(clampScore(p.score)) : x.priority),
          scoreRazon: p.scoreRazon || x.scoreRazon,
          impacto: p.impacto ?? x.impacto,
          esfuerzo: p.esfuerzo ?? x.esfuerzo,
          detalle: p.detalle || x.detalle,
          // El proyecto que el Perro ruteó. Sólo viene cuando la tarea nació SIN uno: una
          // tarjeta que ya tenía proyecto no se le toca ni acá ni en el server.
          labels: p.labels?.length ? p.labels : x.labels,
          checklist: p.checklist?.length ? p.checklist : x.checklist,
          historial: p.historialEntry ? [p.historialEntry, ...x.historial].slice(0, HIST_CAP) : x.historial,
        };
      }));
    }
    if (proys.length) {
      setLabels((ls) => ls.map((l) => {
        const p = proys.find((q) => q.id === l.id); if (!p) return l;
        return { ...l, score: clampProj(p.score), scoreRazon: p.scoreRazon || l.scoreRazon, impacto: p.impacto ?? l.impacto, esfuerzo: p.esfuerzo ?? l.esfuerzo, emoji: p.emoji || l.emoji, detalle: p.detalle || l.detalle };
      }));
    }
  };

  // La PRIORIDAD A MANO ya la escribió el server (`fijarPrioridadAMano`): columna por
  // columna, por id, con su cascada. Acá solo se sincroniza la pantalla — sin markDirty y
  // sin saveLabel, porque volver a guardar desde el navegador es cómo una pestaña con
  // estado viejo pisa lo que el server acaba de decidir.
  //
  // ⚠️ `scoreBase` y `scoreManual` se actualizan TAMBIÉN acá aunque no se vean. Si el
  // estado local se queda con el viejo, el próximo autosave de esa tarea (cambiarle el
  // título, tildar algo) upsertea la fila entera y devuelve `score_base` al número de
  // antes y `score_manual` a false: el candado se abre solo, sin que nadie lo toque.
  const aplicarCascadaManual = (
    entidad: 'proyecto' | 'tarea',
    fijado: { id: string; score: number; razon: string; texto: string },
    movidos: Array<{ id: string; despues: number }> = [],
  ) => {
    const otros = new Map(movidos.filter((m) => m.id !== fijado.id).map((m) => [m.id, m.despues]));
    const entry: Hist = { id: uid(), ts: now(), actor: 'user', text: fijado.texto };
    if (entidad === 'tarea') {
      setTasks((ts) => ts.map((x) => {
        if (x.id === fijado.id) {
          const s = clampScore(fijado.score);
          return { ...x, score: s, scoreBase: s, priority: prioFromScore(s), scoreRazon: fijado.razon, scoreManual: true, historial: [entry, ...x.historial].slice(0, HIST_CAP) };
        }
        const s = otros.get(x.id);
        return s == null ? x : { ...x, score: clampScore(s), priority: prioFromScore(clampScore(s)) };
      }));
      return;
    }
    setLabels((ls) => ls.map((l) => {
      if (l.id === fijado.id) return { ...l, score: clampProj(fijado.score), scoreRazon: fijado.razon, scoreManual: true, historial: [entry, ...l.historial].slice(0, HIST_CAP) };
      const s = otros.get(l.id);
      return s == null ? l : { ...l, score: clampProj(s) };
    }));
  };

  /** El inverso: le devolvés la decisión a MaKo y el candado se saca en pantalla también. */
  const soltarCandadoManual = (entidad: 'proyecto' | 'tarea', id: string) => {
    const entry: Hist = { id: uid(), ts: now(), actor: 'user', text: 'Le devolviste la prioridad a MaKo' };
    if (entidad === 'tarea') setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, scoreManual: false, scoreRazon: undefined, historial: [entry, ...x.historial].slice(0, HIST_CAP) } : x)));
    else setLabels((ls) => ls.map((l) => (l.id === id ? { ...l, scoreManual: false, scoreRazon: undefined, historial: [entry, ...l.historial].slice(0, HIST_CAP) } : l)));
  };

  // tope de "En prioridad": cuenta solo las NO completadas (consistente con la vista)
  const toggleEnPrioridad = (id: string): boolean => {
    const t = byId(id); if (!t) return false;
    if (!t.enPrioridad && tasks.filter((x) => x.enPrioridad && x.progress < 100).length >= MAX_PRIORIDAD) return false;
    patchLog(id, 'enPrioridad', !t.enPrioridad, t.enPrioridad ? 'Quitó de prioridad' : 'Puso en prioridad');
    return true;
  };

  // El avance de una tarea CON checklist se deriva del % de ítems completados
  // (marcar/agregar/quitar mueve la barra proporcionalmente).
  const setChecklist = (id: string, next: Check[], text?: string, actor: Actor = 'user') => {
    const t = byId(id); if (!t) return;
    const derived = next.length ? Math.round((next.filter((c) => c.done).length / next.length) * 100) : null;
    const entry = text ? mkEntry(actor, text, 'checklist', t.checklist) : null;
    setTasks((ts) => ts.map((x) => (x.id === id
      ? { ...x, checklist: next, ...(derived != null ? { progress: derived } : {}), ...(entry ? { historial: [entry, ...x.historial].slice(0, HIST_CAP) } : {}) }
      : x)));
    markDirty(id);
  };
  // reemplaza una tarea entera (para el "deshacer todo" del pase a Alta)
  const replaceTask = (task: BoardTask) => { setTasks((ts) => ts.map((x) => (x.id === task.id ? task : x))); markDirty(task.id); };
  const setTitle = (id: string, title: string, prev: string) => {
    if (title.trim() === prev.trim()) return;
    patchLogExplicit(id, 'title', title, prev, 'Editó el título');
    (byId(id)?.labels ?? []).forEach((lid) => logProject(lid, `Renombró una tarea → «${title.slice(0, 34)}»`));
  };
  const setDetalle = (id: string, detalle: string, prev: string) => { if (detalle !== prev) patchLogExplicit(id, 'detalle', detalle, prev, 'Editó el detalle'); };
  const setProgress = (id: string, value: number, prev: number) => { const w = clampPct(value); if (w !== prev) patchLogExplicit(id, 'progress', w, prev, `Avance ${w}%`); };
  // Marcar "Completada" (0 → 100) o reabrir (→ 0). Si la tarea TIENE checklist, marca
  // TODOS sus ítems (el avance deriva). Salta el undo-toast de 5s (feedback #7/#33).
  const toggleDone = (id: string) => {
    const t = byId(id); if (!t) return;
    const snap = t;
    const done = t.progress >= 100;
    if (t.checklist.length > 0) {
      setChecklist(id, t.checklist.map((c) => ({ ...c, done: !done })), done ? 'Reabrió la tarea' : 'Marcó como completada');
    } else {
      patchLogExplicit(id, 'progress', done ? 0 : 100, t.progress, done ? 'Reabrió la tarea' : 'Marcó como completada');
    }
    show(done ? 'Tarea reabierta' : 'Tarea completada', () => replaceTask(snap));
  };
  const setDeadline = (id: string, deadline: string, prev: string) => { if (deadline !== prev) patchLogExplicit(id, 'deadline', deadline, prev, deadline ? `Deadline ${deadline}` : 'Quitó el deadline'); };
  /**
   * El Quarter planificado (`2026-Q3`), o vacío para sacarlo.
   *
   * Va por `patchLogExplicit` como el deadline —y no por un patch pelado— porque eso
   * es lo que guarda el valor ANTERIOR en el historial, que es de donde sale el
   * deshacer. Un campo que se escribe sin `prev` no se puede revertir, y en un
   * tablero donde la IA también escribe eso no es un lujo.
   */
  const setQuarter = (id: string, quarter: string, prev: string) => { if (quarter !== prev) patchLogExplicit(id, 'quarter', quarter || undefined, prev, quarter ? `La planificó para el ${quarter.replace('-', ' ')}` : 'Le sacó el Quarter'); };
  const setTaskLabels = (id: string, next: string[], text: string) => patchLogExplicit(id, 'labels', next, byId(id)?.labels ?? [], text);

  // deshacer una entrada del historial: revierte el campo Y borra la entrada
  // (mismo criterio que Lead Details: "un cambio deshecho no es historia").
  const undoHist = (id: string, entry: Hist) => {
    if (!entry.undo) return;
    const field = entry.undo.field, prev = entry.undo.prev;
    setTasks((ts) => ts.map((x) => {
      if (x.id !== id) return x;
      const next = { ...x, historial: x.historial.filter((h) => h.id !== entry.id) } as BoardTask;
      (next as unknown as Record<string, unknown>)[field] = prev;
      if (field === 'score') next.priority = prioFromScore(clampScore(Number(prev))); // la columna deriva del score
      return next;
    }));
    markDirty(id);
  };

  // ── etiquetas / PROYECTOS (con su propio change history) ──
  // DEVUELVE la canónica (la del server), no void. El id que pone la UI es temporal
  // (`uid()`, alfanumérico) y el del server es NUMÉRICO: quien creaba un proyecto y le
  // colgaba tareas usando el temporal las mandaba con un id que `Number()` convierte en
  // NaN, se filtraba, y la tarea nacía SIN PROYECTO. Es la causa exacta de las tareas
  // huérfanas del tablero. Quien crea un proyecto para usarlo tiene que esperar esto.
  const createLabel = async (draft: Label): Promise<Label> => {
    const d: Label = { ...draft, historial: draft.historial?.length ? draft.historial : [{ id: uid(), ts: now(), actor: draft.score >= 1 ? 'user' : 'user', text: 'Creó el proyecto' }] };
    setLabels((ls) => [...ls, d]);
    try { const canon = await repo.createLabel(d); setLabels((ls) => ls.map((l) => (l.id === d.id ? canon : l))); return canon; }
    catch (e) { console.error('[board] createLabel', e); return d; }
  };
  const patchLabel = (id: string, fields: Partial<Label>) => {
    let next: Label | null = null;
    setLabels((ls) => ls.map((l) => (l.id === id ? (next = { ...l, ...fields }) : l)));
    if (next) void repo.saveLabel(next).catch((e) => console.error('[board] saveLabel', e));
  };
  // patch de proyecto + entrada en SU change history (rename, detalle, score…).
  // Guarda el `undo` (snapshot de los campos que cambian) SOLO para cambios del usuario.
  const patchLabelLog = (id: string, fields: Partial<Label>, text: string, actor: Actor = 'user') => {
    let next: Label | null = null;
    setLabels((ls) => ls.map((l) => {
      if (l.id !== id) return l;
      const prev: Record<string, unknown> = {};
      for (const k of Object.keys(fields)) prev[k] = (l as unknown as Record<string, unknown>)[k];
      const entry: Hist = { id: uid(), ts: now(), actor, text, ...(actor === 'user' ? { undo: { field: '__label__', prev } } : {}) };
      next = { ...l, ...fields, historial: [entry, ...l.historial].slice(0, HIST_CAP) };
      return next;
    }));
    if (next) void repo.saveLabel(next).catch((e) => console.error('[board] saveLabel', e));
  };
  // deshacer una entrada del change history de un proyecto (solo cambios del usuario)
  const undoLabelHist = (labelId: string, entry: Hist) => {
    if (!entry.undo) return;
    const prev = entry.undo.prev as Partial<Label>;
    let next: Label | null = null;
    setLabels((ls) => ls.map((l) => (l.id === labelId ? (next = { ...l, ...prev, historial: l.historial.filter((h) => h.id !== entry.id) }) : l)));
    if (next) void repo.saveLabel(next).catch((e) => console.error('[board] saveLabel', e));
  };
  // registra un evento en el change history de un proyecto (tarea creada/borrada/renombrada).
  // kind:'task' → queda en el detalle del proyecto pero NO en el change history de la tab.
  const logProject = (labelId: string, text: string, actor: Actor = 'user') => {
    let next: Label | null = null;
    setLabels((ls) => ls.map((l) => (l.id === labelId ? (next = { ...l, historial: [{ id: uid(), ts: now(), actor, text, kind: 'task' as const }, ...l.historial].slice(0, HIST_CAP) }) : l)));
    if (next) void repo.saveLabel(next).catch((e) => console.error('[board] saveLabel', e));
  };
  const deleteLabel = (id: string) => {
    setLabels((ls) => ls.filter((l) => l.id !== id));
    setTasks((ts) => ts.map((t) => (t.labels.includes(id) ? { ...t, labels: t.labels.filter((x) => x !== id) } : t)));
    void repo.deleteLabel(id).catch((e) => console.error('[board] deleteLabel', e));
  };
  // borra un proyecto Y todas sus tareas (fricción alta: se debate antes).
  const deleteLabelYTareas = (id: string) => {
    const suyas = tasks.filter((t) => t.labels.includes(id));
    suyas.forEach((t) => { void repo.deleteTask(t.id).catch((e) => console.error('[board] deleteTask', e)); });
    setTasks((ts) => ts.filter((t) => !t.labels.includes(id)));
    setLabels((ls) => ls.filter((l) => l.id !== id));
    void repo.deleteLabel(id).catch((e) => console.error('[board] deleteLabel', e));
  };

  const reset = (t: BoardTask[], l: Label[]) => { setTasks(t); setLabels(l); };

  // ── Dependencias ──
  // El estado local se actualiza con lo que devuelve el SERVER, no con lo que el cliente
  // creía: el guard de ciclo corre allá (es la única puerta que comparten el modal,
  // /api/agente/plan, WhatsApp y los scripts), así que la lista buena es siempre la suya.
  const addDep = async (d: { entidad: EntidadDep; deId: string; aId: string; clase?: ClaseDep; razon?: string }): Promise<{ ok: boolean; error?: string; camino?: string[] }> => {
    // Chequeo local ANTES de pegarle al server: es el que le permite a la pantalla
    // deshabilitar la opción con el motivo al lado en vez de dejar clickear y fallar.
    const ver = puedeDepender(deps, d.entidad, d.deId, d.aId);
    if (!ver.ok) return { ok: false, error: 'Sería un círculo: eso ya espera a esto.', camino: ver.camino };
    const r = await repo.addDep?.(d);
    if (r?.ok && r.deps) setDeps(r.deps);
    return r ?? { ok: false, error: 'Este tablero no guarda dependencias.' };
  };
  const delDep = async (entidad: EntidadDep, deId: string, aId: string) => {
    const r = await repo.delDep?.(entidad, deId, aId);
    if (r?.ok && r.deps) setDeps(r.deps);
  };

  return {
    tasks, labels, user, repo, deps, addDep, delDep,
    labelById: (id: string) => labels.find((l) => l.id === id) ?? null,
    create, remove, removeSilent, patch, moveTo, setScore, applyGuardian, aplicarPerroServer, aplicarCascadaManual, soltarCandadoManual, toggleEnPrioridad, setChecklist, replaceTask,
    setTitle, setDetalle, setProgress, toggleDone, setDeadline, setQuarter, setTaskLabels, undoHist,
    createLabel, patchLabel, patchLabelLog, undoLabelHist, deleteLabel, deleteLabelYTareas, reset,
    undo, showUndo: show, clearUndo: clear,
  };
}

export type Board = ReturnType<typeof useBoard>;
