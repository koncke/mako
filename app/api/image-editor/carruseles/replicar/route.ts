// =============================================================================
// POST /api/image-editor/carruseles/replicar — «Editar» un carrusel (o un anuncio) de ejemplo, armándose en vivo (6/11/2026)
// =============================================================================
// POST json {id, pedido?, que?} → NDJSON: una línea por evento (lib/carruseles/replica.ts, `EventoReplica`): `leer`, `escribir`, una
// `lamina` por página ya armada (la pantalla la dibuja apenas llega) y `fin` con el id del diseño. Copiado de «Replicar» del
// Web Generator (app/api/landing-generator/replicar/route.ts): la misma forma de stream y el mismo `maxDuration`.
//
// `que: 'thumbnail'` (6/11/2026): una miniatura de YouTube de la biblioteca de Thumbnails, en una lámina de 1280 × 720.
// `que: 'vertical'` (13/11/2026): la portada de un reel que Spy ya trajo (lib/thumbnails/verticales.ts), en 1080 × 1920. Su id es
// el del outlier de video (`spy:123`), un texto: se valida con `esIdDeVertical` y se vuelve a leer del Spy del negocio.
//
// `guiado` (9/11/2026): lo que contestó el dueño en la pestaña guiada (la oferta, la foto que va en lugar de la persona y qué
// cambia; lib/carruseles/guiado.ts → `PedidoGuiado`). Desde el 12/11/2026 llega sin preguntar (la oferta principal), y sin ofertas
// cargadas también se escribe.
//
// Lo que corre (las láminas, la IA DEL NEGOCIO con visión, su foto, el diseño): lib/carruseles/replica-servidor.ts. La IA va
// adentro de `conSuIADelNegocio` (allá), nunca con la de la plataforma.
//
// La puerta es la del Image Editor (`puerta`: sesión, admin con la tab en su capa y un workspace). Va detrás de la sesión (NO
// está en lib/rutas-publicas.ts) y el proxy le exige Origin propio al POST. El id se vuelve a leer de la base del negocio.
//
// SÓLO MaKo Pro (14/11/2026, lib/editores-ia-pro.ts): es editar con IA. Un Essential recibe el 403 en JSON (no el stream), con
// `pasarAPro`: la pantalla (app/image-editor/carruseles/EditarCarrusel.tsx) lo lee antes de abrir el stream y dibuja el candado.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { puerta } from '@/lib/image-editor/server';
import { candadoIaDeEditores } from '@/lib/editores-ia-pro';
import { rateLimit } from '@/lib/rate-limit';
import { replicarEjemplo, type EjemploAReplicar } from '@/lib/carruseles/replica-servidor';
import { hastaDeLaReplica, streamDeReplica } from '@/lib/carruseles/replica-stream';
import { leerPedidoGuiado } from '@/lib/carruseles/guiado';
import { esIdDeVertical } from '@/lib/thumbnails/verticales';
import { vistaDeOtro } from '@/lib/vista-de-otro';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// ⚠️ MEDIDO con la IA real el 6/11/2026 (scripts/carruseles-probar-editar.mts, cinco corridas): 21,6 s · 33,4 s · 143,4 s ·
// 149,3 s · **276,9 s**. El peor caso casi toca este tope, y no es por el tamaño del pedido: `gemini-flash-latest` se cuelga y
// se come su plazo entero de 120 s antes de que conteste el respaldo (8 s). El plazo de la cascada es por llamada, no por pedido:
// docs/hallazgos-ia.md → «Un modelo de Gemini que se cuelga se come el plazo ENTERO».
//
// ⚠️ ANTES DEL TOPE SE AVISA (18/11/2026, F14). Si se pasaba de 300, Vercel cortaba la función, el stream terminaba SIN el `fin` y
// la pantalla esperaba para siempre en «Escribo tu versión…». Ahora `streamDeReplica` (lib/carruseles/replica-stream.ts) manda él
// el `fin` con la causa (la fase en que estaba) a `AVISO_ANTES_DEL_TOPE_MS`, y la pantalla, si igual le llega un stream sin `fin`,
// lo dice (`leerStreamDeReplica`). Lo de atrás no se aborta: si termina y guarda, queda en «tus diseños», y el texto lo dice.
export const maxDuration = 300;
/** Cuándo manda la ruta su propio `fin`: 15 s antes de que Vercel corte (`maxDuration`), con lugar para escribirlo y cerrar. */
const AVISO_ANTES_DEL_TOPE_MS = (maxDuration - 15) * 1000;

const fallo = (error: string, status: number) =>
  Response.json({ ok: false, error }, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(req: NextRequest) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const pro = await candadoIaDeEditores();
  if (pro) return pro;
  if (!rateLimit(`image-editor:replicar:${p.ws}`, 12, 60_000)) return fallo('Demasiados pedidos. Espera un minuto.', 429);
  const body = (await req.json().catch(() => null)) as { id?: unknown; pedido?: unknown; que?: unknown; guiado?: unknown } | null;
  const id = Number(body?.id);
  const vertical = body?.que === 'vertical';
  if (vertical && !esIdDeVertical(body?.id)) return fallo('Falta la miniatura.', 400);
  const que = body?.que === 'thumbnail' ? 'thumbnail' : 'carrusel';
  if (!vertical && (!Number.isSafeInteger(id) || id === 0 || (que === 'thumbnail' && id < 0))) return fallo(que === 'thumbnail' ? 'Falta la miniatura.' : 'Falta el carrusel.', 400);
  const ejemplo: EjemploAReplicar = vertical ? { que: 'vertical', id: String(body?.id) } : { que, id };
  const pedido = typeof body?.pedido === 'string' ? body.pedido.slice(0, 600) : null;
  // Lo que contestó el dueño en el guiado (lib/carruseles/guiado.ts): se lee sin creerle; la oferta se vuelve a buscar en SU base.
  // Sin oferta también se escribe (12/11/2026, «Replicar» sin preguntas): un negocio sin ofertas cargadas recibe su versión con lo
  // que se sabe de él, y la oferta se elige después. Antes: «Falta elegir la oferta.», 400.
  const guiado = body?.guiado != null ? leerPedidoGuiado(body.guiado) : null;
  // INSPECCIONANDO (14/11/2026): la IA que escribe es la del negocio que se mira (p.ws), y si falla, el aviso dice DE QUIÉN es
  // («El Gemini de Mauricio Bustos rechazó la clave…»), no «Tu Gemini». Sólo si la vista es de ESTE mismo negocio: el cartel y
  // los datos no pueden nombrar a dos clientes distintos.
  const vista = await vistaDeOtro().catch(() => null);
  const negocioAjeno = vista && vista.clienteWs === p.ws ? vista.clienteNombre : null;

  // ⏱ La corrida termina ANTES del aviso de la ruta (ticket 119): con el plazo, lo escrito se guarda y llega su `fin` de verdad.
  const hastaMs = hastaDeLaReplica(Date.now(), AVISO_ANTES_DEL_TOPE_MS);
  const stream = streamDeReplica(
    (alEvento) => runWithWorkspace(p.ws, () => replicarEjemplo(p.ws, p.quien, ejemplo, { pedido, guiado, negocioAjeno, alEvento, hastaMs })),
    {
      plazoMs: AVISO_ANTES_DEL_TOPE_MS, minutos: Math.floor(AVISO_ANTES_DEL_TOPE_MS / 60_000), negocioAjeno,
      alFallar: (e) => console.error('[carruseles] replicar:', e instanceof Error ? e.message : e),
    },
  );
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
}
