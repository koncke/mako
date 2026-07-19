import 'server-only';

// =============================================================================
// plan-snapshot — foto de sólo-lectura del board del super-admin (localStorage)
// =============================================================================
// El board de la agencia vive en el localStorage del navegador: el servidor no lo
// ve (#177). Para que "MaKo por WhatsApp" pueda AUTO-ASIGNAR proyecto y DEDUPLICAR
// (la lógica del Perro) en vez de preguntar a ciegas, PlanBoard empuja acá una foto
// liviana (proyectos + títulos de tareas abiertas) que el doer lee. Es una setting
// JSON en OWNER_WS. Para los CLIENTES no hace falta: su board vive en la base.
// =============================================================================

import { getSetting, setSetting } from '@/lib/settings';
import { runWithWorkspace, OWNER_WS } from '@/lib/workspace';

const KEY_SNAP = 'mako.plan.snapshot';
const CAP_TAREAS = 300;

export type SnapProyecto = { id: string; pid: string; nombre: string };
export type SnapTarea = { id: string; num: number; titulo: string; proyecto: string };
export type PlanSnapshot = { proyectos: SnapProyecto[]; tareas: SnapTarea[]; ts: number };

const VACIO: PlanSnapshot = { proyectos: [], tareas: [], ts: 0 };

export async function guardarSnapshot(snap: { proyectos: SnapProyecto[]; tareas: SnapTarea[] }): Promise<void> {
  const limpio: PlanSnapshot = {
    proyectos: (snap.proyectos ?? []).slice(0, 200).map((p) => ({ id: String(p.id), pid: String(p.pid ?? ''), nombre: String(p.nombre ?? '').slice(0, 120) })).filter((p) => p.id && p.nombre),
    tareas: (snap.tareas ?? []).slice(0, CAP_TAREAS).map((t) => ({ id: String(t.id), num: Number(t.num) || 0, titulo: String(t.titulo ?? '').slice(0, 200), proyecto: String(t.proyecto ?? '').slice(0, 120) })).filter((t) => t.id && t.titulo),
    ts: Date.now(),
  };
  await runWithWorkspace(OWNER_WS, () => setSetting(KEY_SNAP, JSON.stringify(limpio)));
}

export async function leerSnapshot(): Promise<PlanSnapshot> {
  return runWithWorkspace(OWNER_WS, async () => {
    const raw = await getSetting(KEY_SNAP);
    if (!raw) return VACIO;
    try {
      const o = JSON.parse(raw);
      return {
        proyectos: Array.isArray(o.proyectos) ? o.proyectos : [],
        tareas: Array.isArray(o.tareas) ? o.tareas : [],
        ts: Number(o.ts) || 0,
      };
    } catch { return VACIO; }
  });
}
