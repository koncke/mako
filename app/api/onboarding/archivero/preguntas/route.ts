// =============================================================================
// /api/onboarding/archivero/preguntas — huecos como preguntas CERRADAS 1x1
// =============================================================================
// POST → para los datos que ningún documento resolvió, la IA arma preguntas
// CERRADAS, cortas y personalizadas (estilo Perro Guardián), con opciones a medida
// del negocio + siempre la opción de escribirlo. Más fácil que un campo abierto.
// Piso: admin del workspace; el dueño (sin impersonar) opera sobre OWNER_WS.

import { runWithWorkspace } from '@/lib/workspace';
import { generarPreguntasCerradas } from '@/lib/onboarding';
import { buildEstado, resolverWsAdmin } from '@/lib/archivero';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST() {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  return runWithWorkspace(ws, async () => {
    try {
      const est = await buildEstado(false);
      const byKey = new Map(est.brief.map((c) => [c.key, c]));
      const faltantes = est.gaps.map((k) => byKey.get(k)).filter(Boolean).map((c) => ({ key: c!.key, label: `${c!.grupo} — ${c!.label}` }));
      if (faltantes.length === 0) return Response.json({ ok: true, preguntas: [] });
      // Lo que ya sabemos, para que las preguntas salgan a medida del negocio.
      const conocido = est.brief
        .map((c) => { const v = (est.answers[c.key] ?? '').trim(); return v ? `${c.label}: ${v}` : ''; })
        .filter(Boolean).join('\n');
      const preguntas = await generarPreguntasCerradas(faltantes, conocido);
      return Response.json({ ok: true, preguntas });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}
