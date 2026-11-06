// =============================================================================
// POST /api/image-editor/carruseles/replicar — «Editar» un carrusel (o un anuncio) de ejemplo, armándose en vivo (6/11/2026)
// =============================================================================
// POST json {id, pedido?, que?} → NDJSON: una línea por evento (lib/carruseles/replica.ts, `EventoReplica`): `leer`, `escribir`, una
// `lamina` por página ya armada (la pantalla la dibuja apenas llega) y `fin` con el id del diseño. Copiado de «Replicar» del
// Web Generator (app/api/landing-generator/replicar/route.ts): la misma forma de stream y el mismo `maxDuration`.
//
// `que: 'thumbnail'` (6/11/2026): una miniatura de YouTube de la biblioteca de Thumbnails, en una lámina de 1280 × 720.
//
// Lo que corre (las láminas, la IA DEL NEGOCIO con visión, su foto, el diseño): lib/carruseles/replica-servidor.ts. La IA va
// adentro de `conSuIADelNegocio` (allá), nunca con la de la plataforma.
//
// La puerta es la del Image Editor (`puerta`: sesión, admin con la tab en su capa y un workspace). Va detrás de la sesión (NO
// está en lib/rutas-publicas.ts) y el proxy le exige Origin propio al POST. El id se vuelve a leer de la base del negocio.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { puerta } from '@/lib/image-editor/server';
import { rateLimit } from '@/lib/rate-limit';
import { replicarEjemplo } from '@/lib/carruseles/replica-servidor';
import { lineaDeEvento } from '@/lib/carruseles/replica';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// ⚠️ MEDIDO con la IA real el 6/11/2026 (scripts/carruseles-probar-editar.mts, cinco corridas): 21,6 s · 33,4 s · 143,4 s ·
// 149,3 s · **276,9 s**. El peor caso casi toca este tope, y no es por el tamaño del pedido: `gemini-flash-latest` se cuelga y
// se come su plazo entero de 120 s antes de que conteste el respaldo (8 s). Si alguna vez se pasa de 300, el stream se corta
// SIN mandar el `fin` y la pantalla espera para siempre. El plazo de la cascada es por llamada, no por pedido:
// docs/hallazgos-ia.md → «Un modelo de Gemini que se cuelga se come el plazo ENTERO».
export const maxDuration = 300;

const fallo = (error: string, status: number) =>
  Response.json({ ok: false, error }, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(req: NextRequest) {
  const p = await puerta();
  if (p instanceof Response) return p;
  if (!rateLimit(`image-editor:replicar:${p.ws}`, 12, 60_000)) return fallo('Demasiados pedidos. Espera un minuto.', 429);
  const body = (await req.json().catch(() => null)) as { id?: unknown; pedido?: unknown; que?: unknown } | null;
  const id = Number(body?.id);
  const que = body?.que === 'thumbnail' ? 'thumbnail' : 'carrusel';
  if (!Number.isSafeInteger(id) || id === 0 || (que === 'thumbnail' && id < 0)) return fallo(que === 'thumbnail' ? 'Falta la miniatura.' : 'Falta el carrusel.', 400);
  const pedido = typeof body?.pedido === 'string' ? body.pedido.slice(0, 400) : null;

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const mandar = (linea: string) => { try { ctrl.enqueue(enc.encode(linea)); } catch { /* se cerró */ } };
      try {
        const r = await runWithWorkspace(p.ws, () => replicarEjemplo(p.ws, p.quien, { que, id }, { pedido, alEvento: (e) => mandar(lineaDeEvento(e)) }));
        if (!r.ok) mandar(lineaDeEvento({ fase: 'fin', ok: false, error: r.error, conectar: r.conectar ?? null }));
      } catch (e) {
        console.error('[carruseles] replicar:', e instanceof Error ? e.message : e);
        mandar(lineaDeEvento({ fase: 'fin', ok: false, error: 'No pude armar el diseño. Vuelve a intentar.' }));
      } finally {
        try { ctrl.close(); } catch { /* ya cerrado */ }
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
}
