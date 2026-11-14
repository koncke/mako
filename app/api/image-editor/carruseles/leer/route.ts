// =============================================================================
// POST /api/image-editor/carruseles/leer — la lectura del guiado: ¿el carrusel muestra a una persona? (9/11/2026)
// =============================================================================
// POST json {id} → {persona, lettering} (`true`, `false` o `null` = no se sabe). Lo pide la pestaña guiada apenas se abre, en
// paralelo a la primera pregunta (la oferta no depende de la imagen): con un «no» medido, MaKo no pregunta por el avatar
// (Martín, 9/11: «si es solo texto, que lo detecte y no le pregunte eso»). La corre la IA DEL NEGOCIO, adentro de
// `conSuIADelNegocio` (lib/carruseles/replica-servidor.ts → `leerLoQueTiene`). Sin IA no falla: contesta `null` y la pregunta
// del avatar se hace igual, con «No tiene persona» entre las respuestas.
//
// La puerta es la del Image Editor (`puerta`), como la de «replicar». Un fetch y no una server action: las acciones se encolan
// de a una (AGENTS.md) y esto corre mientras la persona contesta.
//
// SÓLO MaKo Pro (14/11/2026, lib/editores-ia-pro.ts): es la IA del negocio leyendo el ejemplo, y sólo sirve para «Editar» con IA
// (./replicar). Un Esencial recibe el 403 y la pestaña guiada lo toma como «no se sabe» (lo mismo que sin IA).

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { puerta } from '@/lib/image-editor/server';
import { candadoIaDeEditores } from '@/lib/editores-ia-pro';
import { rateLimit } from '@/lib/rate-limit';
import { leerLoQueTiene } from '@/lib/carruseles/replica-servidor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const sinCache = { 'cache-control': 'no-store' };

export async function POST(req: NextRequest) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const pro = await candadoIaDeEditores();
  if (pro) return pro;
  if (!rateLimit(`image-editor:leer:${p.ws}`, 20, 60_000)) return Response.json({ ok: false, error: 'Demasiados pedidos. Espera un minuto.' }, { status: 429, headers: sinCache });
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = Number(body?.id);
  if (!Number.isSafeInteger(id) || id === 0) return Response.json({ ok: false, error: 'Falta el carrusel.' }, { status: 400, headers: sinCache });
  const r = await runWithWorkspace(p.ws, () => leerLoQueTiene(p.ws, id));
  return Response.json({ ok: true, persona: r.persona, lettering: r.lettering }, { headers: sinCache });
}
