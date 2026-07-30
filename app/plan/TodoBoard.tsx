'use client';

// =============================================================================
// TodoBoard — adapter del board /todo para el CLIENTE (DB, vía /api/todo)
// =============================================================================
// Misma UI que el super-admin (board/BoardShell). Acá solo el mapeo
// Tarea↔BoardTask / Categoria↔Label y el Repo que persiste contra la API.
// En demo (local sin Supabase) el Repo muta en memoria.

import { BoardShell } from './board/BoardShell';
import { useBoard } from './board/useBoard';
import { type BoardTask, type Label, type Repo, type BoardUser, prioFromScore, scoreFromPrio } from './board/types';
import type { Tarea, Categoria } from '@/lib/todo';

const toBoard = (t: Tarea): BoardTask => ({
  // El board del cliente (experimento_tareas) todavía no persiste emoji por tarea:
  // default 📌. El emoji-por-tarea con memoria vive en el board del dueño (SEED).
  id: String(t.id), num: t.id, emoji: '📌', title: t.titulo, detalle: t.detalle ?? '',
  priority: prioFromScore(t.score || scoreFromPrio[t.prioridad]), score: t.score || scoreFromPrio[t.prioridad],
  scoreRazon: t.score_razon ?? undefined,
  progress: t.progreso, deadline: t.deadline ?? '',
  labels: t.categorias.map(String), checklist: t.checklist, historial: t.historial,
  origen: t.origen === 'manual' ? 'user' : 'ia', enPrioridad: t.en_prioridad,
  // De dónde salió: pinta el mismo chip que en el board del dueño (con link al minuto).
  fuente: (t.fuente as BoardTask['fuente']) ?? undefined,
});
const toLabel = (c: Categoria): Label => ({ id: String(c.id), emoji: c.emoji, name: c.nombre, color: c.color, score: c.prioridad, scoreRazon: c.score_razon ?? undefined, deadline: c.deadline ?? undefined, detalle: c.detalle, historial: c.historial });

async function api(body: Record<string, unknown>): Promise<{ ok: boolean; tarea?: Tarea; categoria?: Categoria; error?: string }> {
  return fetch('/api/todo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

// patch completo de una tarea → payload de editar
const editPatch = (d: BoardTask) => ({
  titulo: d.title, detalle: d.detalle || null, prioridad: d.priority, progreso: d.progress,
  deadline: d.deadline || null, categorias: d.labels.map(Number).filter(Number.isFinite),
  checklist: d.checklist, historial: d.historial, en_prioridad: d.enPrioridad, score: d.score, score_razon: d.scoreRazon ?? null, fuente: d.fuente ?? null,
});

export function TodoBoard({ tareas, categorias, demo, user, wsId }: { tareas: Tarea[]; categorias: Categoria[]; demo: boolean; user: BoardUser; wsId?: number | null }) {
  const repo: Repo = {
    // MISMA config que el board del super-admin (PlanBoard): la única diferencia real
    // es la persistencia (DB vs localStorage). Proyectos 1-a-1, mismo naming.
    labelMode: 'single', labelSingular: 'Proyecto', labelPlural: 'Proyectos',
    fathomExtract: true, // extraer tareas de una reunión (usa la Fathom key del propio workspace)
    createTask: async (d) => {
      if (demo) return d;
      // origen preservado (al restaurar un borrado de una tarea de MaKo mantiene el ✦).
      // Todo lo que no escribió el usuario cae a 'mako': la base solo distingue
      // manual/mako/retro/experimento, y 'manual' diría que la creó el cliente.
      const j = await api({ action: 'crear', tarea: { titulo: d.title, prioridad: d.priority, origen: d.origen === 'user' ? 'manual' : 'mako' } });
      if (!j.ok || !j.tarea) throw new Error(j.error || 'no se pudo crear');
      let t = j.tarea;
      // si la tarjeta ya traía contenido (p.ej. restaurar un borrado), aplicá el resto
      if (d.detalle || d.checklist.length || d.deadline || d.labels.length || d.enPrioridad || d.progress) {
        const j2 = await api({ action: 'editar', id: t.id, patch: editPatch(d) });
        if (j2.ok && j2.tarea) t = j2.tarea;
      }
      return toBoard(t);
    },
    saveTask: async (d) => { if (demo) return; await api({ action: 'editar', id: Number(d.id), patch: editPatch(d) }); },
    deleteTask: async (id) => { if (demo) return; await api({ action: 'borrar', id: Number(id) }); },
    createLabel: async (l) => {
      if (demo) return l;
      const j = await api({ action: 'categoria-crear', nombre: l.name, color: l.color, emoji: l.emoji, prioridad: l.score, detalle: l.detalle, historial: l.historial, score_razon: l.scoreRazon ?? null, deadline: l.deadline ?? null });
      return j.ok && j.categoria ? toLabel(j.categoria) : l;
    },
    saveLabel: async (l) => { if (demo) return; await api({ action: 'categoria-editar', id: Number(l.id), patch: { nombre: l.name, color: l.color, emoji: l.emoji, prioridad: l.score, detalle: l.detalle, historial: l.historial, score_razon: l.scoreRazon ?? null, deadline: l.deadline ?? null } }); },
    deleteLabel: async (id) => { if (demo) return; await api({ action: 'categoria-borrar', id: Number(id) }); },
  };
  const board = useBoard(tareas.map(toBoard), categorias.map(toLabel), user, repo);
  // Scope del auto-load POR workspace: la preferencia del cliente X no se comparte con
  // el board de la agencia ni con otro workspace en la misma impersonación/origin.
  return <BoardShell board={board} scope={wsId != null ? `ws:${wsId}` : undefined} />;
}
