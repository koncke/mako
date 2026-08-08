// =============================================================================
// GET /api/agente/contexto — el segundo cerebro del negocio, para el agente
// =============================================================================
// Auth: `Authorization: Bearer <token de /integraciones>` → resuelve el workspace,
// igual que /api/agente/plan. Sin sesión ni cookies: corre en la compu del cliente.
//
// Devuelve MARKDOWN, no JSON: el agente lo lee, no lo parsea, y le cuesta menos
// tokens. Sin `?seccion=` devuelve el núcleo (~10 kB, tope 16); con él, una sección
// grande bajo demanda.
//
// ⚠️ Lo que NO devuelve, a propósito: los PROMPTS de MaKo. La metodología no sale de
// acá — el agente le PIDE a MaKo que genere, y el prompt se resuelve del lado del
// servidor. El token de agente lo acuña cualquier `rol_ws === 'admin'`, que es el
// mismo privilegio que una auditoría anterior declaró insuficiente para ver prompts;
// y un .md en el disco del cliente no se rota ni se revoca.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { bearerDe, wsPorAgenteToken } from '@/lib/agente-token';
import { runWithWorkspace } from '@/lib/workspace';
import { contextoParaAgente, seccionContexto, SECCIONES, type SeccionAgente } from '@/lib/agente-contexto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const texto = (md: string) =>
  new NextResponse(md, { status: 200, headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });

export async function GET(req: NextRequest) {
  const ws = await wsPorAgenteToken(bearerDe(req));
  if (ws == null) return NextResponse.json({ ok: false, error: 'token inválido o revocado' }, { status: 401 });

  const pedida = req.nextUrl.searchParams.get('seccion');
  if (pedida && !SECCIONES.includes(pedida as SeccionAgente)) {
    // Se responde con la lista en vez de un 404 mudo: el agente puede corregirse solo.
    return NextResponse.json(
      { ok: false, error: `sección desconocida: ${pedida}`, disponibles: SECCIONES },
      { status: 400 },
    );
  }

  try {
    const md = await runWithWorkspace(ws, () =>
      pedida ? seccionContexto(pedida as SeccionAgente) : contextoParaAgente());
    // Una sección vacía NO es un error: es un negocio que todavía no cargó eso. Se dice
    // con todas las letras para que el agente no lo lea como una falla y reintente.
    return texto(md || `_Todavía no hay nada cargado en «${pedida}»._\n`);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
