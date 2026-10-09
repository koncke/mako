// =============================================================================
// Cron: CRM automático (MaKo mueve el lead solo) — POR WORKSPACE
// =============================================================================
// Evalúa las reglas de auto-transición (lib/crm-auto.ts) sobre los workspaces
// activos. El commit se decide POR WORKSPACE con el setting crm_auto_enabled
// (lib/envio-flags.ts: cliente sin setting = apagado fail-closed; el dueño
// hereda el env CRM_AUTO_ENABLED) — prender un cliente no compromete al resto.
//
// Modos:
//   - default            → cada workspace con su flag: ON aplica de verdad
//                          (mueve el lead + confirmaciones), OFF se reporta 'off'.
//   - &ws=N              → restringe la corrida a ese workspace.
//   - ?dry=1[&ws=N]      → dry-run: computa y MUESTRA lo que MaKo haría, sin
//                          tocar ningún lead.
//   - ?commit=1&ws=N     → fuerza el commit de UN workspace ignorando su flag
//                          (piloto). Sin ws explícito se rechaza: el commit
//                          forzado de todos los inquilinos a la vez era el
//                          foot-gun que este modo reemplaza.
//
// Auth: Bearer ${CRON_SECRET}.
//
// ⚠️ Y EL BARRIDO DEL ESPEJO ETAPA → ETIQUETA (lib/etiquetas.ts, conciliarEspejoEtapas) corre acá,
// en todo negocio activo y SIN mirar crm_auto_enabled: no mueve leads ni manda nada, sólo pone y
// saca las etiquetas vinculadas a una etapa cuando el lead cambió de etapa por un camino que no
// llamó al espejo (revisión del 08/10/2026, etiquetas-3/datos-2). No va en el cron de nutrición a
// propósito: aquel inscribe y manda, y éste no tiene que poder hacer ninguna de las dos cosas.
// En `dry=1` no corre (escribe). Tiene su propio presupuesto de tiempo (ESPEJO_MS) para no
// comerle los 300 s al CRM automático: lo que no entra queda para la hora siguiente.
//
// ⚠️ Y EL AVISO DEL LEAD QUIETO (lib/lead-quieto-aviso.ts, #800) corre acá también, DESPUÉS del
// CRM automático y SIN mirar crm_auto_enabled: no mueve a nadie, le avisa al dueño de los leads
// que pasaron el plazo de su etapa. Va después a propósito —lo que el motor acaba de mover ya no
// está quieto— y sin plazos declarados no lee ni un lead. Un mensaje por día (dedup de ~20 h).
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { evaluarAutoTodos, aplicarAutoTodos } from '@/lib/crm-auto';
import { conciliarEspejoEtapasTodos } from '@/lib/etiquetas';
import { avisarLeadsQuietosTodos } from '@/lib/lead-quieto-aviso';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Cuánto puede tardar el barrido del espejo en una corrida, sumando todos los negocios. */
const ESPEJO_MS = 90_000;
/** Lo mismo para el aviso del lead quieto. Lo que no entra, a la hora siguiente. */
const QUIETOS_MS = 60_000;

export async function GET(request: NextRequest) {
  const unauth = checkCronAuth(request);
  if (unauth) return unauth;

  const url = new URL(request.url);
  const wsParam = Number(url.searchParams.get('ws'));
  const soloWs = Number.isFinite(wsParam) && wsParam > 0 ? wsParam : undefined;

  try {
    if (url.searchParams.get('dry') === '1') {
      const evals = await evaluarAutoTodos();
      const filtrados = soloWs ? evals.filter((e) => e.ws === soloWs) : evals;
      const total = filtrados.reduce((a, e) => a + (e.acciones?.length ?? 0), 0);
      // El aviso del lead quieto, en modo prueba: calcula y muestra el texto, no manda nada.
      const quietos = await avisarLeadsQuietosTodos({ soloWs, dry: true }).catch((e) => [
        { ws: 0, ok: false, error: e instanceof Error ? e.message : String(e) },
      ]);
      return Response.json({ ok: true, modo: 'dry-run', acciones_total: total, workspaces: filtrados, leads_quietos: quietos });
    }

    const forzar = url.searchParams.get('commit') === '1';
    if (forzar && !soloWs) {
      return Response.json(
        { ok: false, error: 'commit=1 exige &ws=N: el commit forzado aplica a UN workspace, nunca a todos.' },
        { status: 400 },
      );
    }

    // Primero el espejo, con su propio techo: si el CRM automático tirara, el barrido igual corrió.
    // Nunca tira (cada negocio falla por su cuenta y lo dice en su fila).
    const espejo = await conciliarEspejoEtapasTodos({ soloWs, hastaMs: Date.now() + ESPEJO_MS });

    const res = await aplicarAutoTodos(undefined, { soloWs, forzar });
    if (soloWs && res.length === 0) {
      return Response.json({ ok: false, error: `workspace ${soloWs} inexistente o pausado` }, { status: 404 });
    }
    // Nunca tira: cada negocio falla por su cuenta y lo dice en su fila.
    const quietos = await avisarLeadsQuietosTodos({ soloWs, hastaMs: Date.now() + QUIETOS_MS }).catch((e) => [
      { ws: 0, ok: false, error: e instanceof Error ? e.message : String(e) },
    ]);
    const auto = res.reduce((a, e) => a + (e.auto ?? 0), 0);
    const confirmaciones = res.reduce((a, e) => a + (e.confirmaciones ?? 0), 0);
    const errores = res.filter((r) => !r.ok).length;
    const todoFallo = res.length > 0 && errores === res.length;
    return Response.json(
      {
        ok: !todoFallo,
        modo: forzar ? `commit forzado (ws ${soloWs})` : 'por-workspace (flag crm_auto_enabled)',
        aplicadas_auto: auto,
        confirmaciones_creadas: confirmaciones,
        workspaces: res,
        espejo_etiquetas: espejo,
        leads_quietos: quietos,
      },
      { status: todoFallo ? 500 : 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron:crm-automatico] error: ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
