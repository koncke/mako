// =============================================================================
// /api/onboarding/archivero/manual — completar huecos y editar campos
// =============================================================================
// Un HUECO (campo vacío que ningún doc resolvió) lo puede llenar cualquier admin
// del workspace, de a una pregunta. PISAR un dato ya cargado (edición) es solo del
// SUPER ADMIN. Lo aceptado se guarda como "manual" y gana sobre lo de los archivos;
// después se recalcula el brief efectivo.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { getSesionAdmin } from '@/lib/auth';
import { listFiles, getManual, setManual, computeEffective, buildEstado, resolverWsAdmin } from '@/lib/archivero';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  let body: { campos?: Record<string, unknown> };
  try { body = (await req.json()) as { campos?: Record<string, unknown> }; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const campos = body?.campos && typeof body.campos === 'object' ? body.campos : {};

  return runWithWorkspace(ws, async () => {
    const esSuperAdmin = Boolean(await getSesionAdmin());
    try {
      const [files, manual] = await Promise.all([listFiles(), getManual()]);
      const { answers: current } = computeEffective(files, manual);
      const next = { ...manual };
      const rechazados: string[] = [];
      for (const [k, vRaw] of Object.entries(campos)) {
        if (typeof vRaw !== 'string') continue;
        const v = vRaw.trim();
        const ocupado = (current[k] ?? '').trim() !== '';
        // Vacío hoy → cualquier admin lo llena (hueco). Ocupado → solo super-admin (edición).
        if (ocupado && !esSuperAdmin) { rechazados.push(k); continue; }
        if (v === '') delete next[k]; // limpiar → vuelve a mandar el archivo, o queda vacío
        else next[k] = v;
      }
      await setManual(next);
      return Response.json({ ok: true, rechazados, ...(await buildEstado(true)) });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}
