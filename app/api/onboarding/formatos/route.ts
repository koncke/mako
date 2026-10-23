// =============================================================================
// /api/onboarding/formatos — los ÁNGULOS = formatos de creativo (la biblioteca y cuántos anuncios los usan)
// =============================================================================
// GET → { biblioteca (fija), usos (cuántos anuncios de la matriz usan cada formato) }. Cuenta sólo las celdas de un
// avatar que existe, las que dibuja la Matriz: borrar un avatar no borra sus razones (lib/angulos-data.ts).
// SIN IA: el formato lo elige `elegirAngulo` POR ANUNCIO (celda de la matriz), y acá sólo se cuenta
// (`usosPorFormato`, lib/angulos-data.ts, la misma cuenta que el grafo de Second Brain y la API de MaKo).
//
// ⚠️ ACÁ HABÍA UN POST que pagaba IA para «recomendar formatos» a nivel negocio, y se sacó el 23/10/2026:
// ningún generador leía esa lista y, medido en prod, 0 negocios la tenían guardada y la generación tenía
// 0 llamadas en toda la historia (docs/hallazgos-onboarding.md). La biblioteca NO es editable.
//
// `getRazones` y `getAvatares` convierten una lectura caída en [], así que con la base caída la vista muestra la
// biblioteca sin conteos. Se acepta: un conteo de 0 no se dibuja («si no hay dato, no se muestra»).

import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { getRazones } from '@/lib/razones';
import { getAvatares } from '@/lib/avatares';
import { BIBLIOTECA_ANGULOS, usosPorFormato } from '@/lib/angulos-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function estado() {
  const [razones, avatares] = await Promise.all([getRazones(), getAvatares()]);
  return { biblioteca: BIBLIOTECA_ANGULOS, usos: usosPorFormato(razones, avatares) };
}

export async function GET() {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  return runWithWorkspace(ws, async () => {
    try { return Response.json({ ok: true, ...(await estado()) }); }
    catch (e) { return Response.json({ ok: false, error: msg(e) }, { status: 500 }); }
  });
}
