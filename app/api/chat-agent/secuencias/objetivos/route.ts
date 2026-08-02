// =============================================================================
// API: los objetivos que el dueño escribió con la opción "Otro"
// =============================================================================
// Los cinco del catálogo cubren lo habitual, pero no todo. Cuando el dueño
// escribe el suyo, esa frase pasa a ser parte de SU vocabulario: la próxima vez
// tiene que aparecer en la lista, no obligarlo a reescribirla igual.
//
// GET → { objetivos: string[] }
// POST { objetivo } → lo suma al catálogo del workspace
// =============================================================================

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { getSetting, setSetting } from '@/lib/settings';
import { KEY_OBJETIVOS_CUSTOM } from '@/lib/etapas-contexto';
import { OBJETIVOS } from '@/lib/setting-estrategia';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const DEL_CATALOGO = new Set<string>(OBJETIVOS.map((o) => o.value));

async function leer(): Promise<string[]> {
  const raw = await getSetting(KEY_OBJETIVOS_CUSTOM);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()).slice(0, 30)
      : [];
  } catch { return []; }
}

export async function GET() {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || (rol !== 'admin' && rol !== 'setter')) return Response.json({ ok: true, objetivos: [] });
  try {
    return Response.json({ ok: true, objetivos: await leer() });
  } catch (e) {
    console.error(`[api:chat-agent/secuencias/objetivos GET] ${msg(e)}`);
    return Response.json({ ok: true, objetivos: [] });
  }
}

export async function POST(req: Request) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede hacer esto.' }, { status: 403 });
  }
  try {
    const body = (await req.json()) as { objetivo?: unknown };
    const objetivo = String(body.objetivo ?? '').trim().slice(0, 120);
    // Uno del catálogo no se guarda como custom: duplicaría la opción.
    if (!objetivo || DEL_CATALOGO.has(objetivo)) return Response.json({ ok: true, objetivos: await leer() });
    const previos = await leer();
    if (previos.some((p) => p.toLowerCase() === objetivo.toLowerCase())) {
      return Response.json({ ok: true, objetivos: previos });
    }
    const lista = [...previos, objetivo].slice(-30);
    await setSetting(KEY_OBJETIVOS_CUSTOM, JSON.stringify(lista));
    return Response.json({ ok: true, objetivos: lista });
  } catch (e) {
    console.error(`[api:chat-agent/secuencias/objetivos POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
