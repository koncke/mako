// =============================================================================
// /api/image-editor/disenos/<id> — abrir, guardar y eliminar un diseño
// =============================================================================
// GET    → el diseño con su documento y su versión.
// PATCH  → { version, titulo?, doc? }: compare-and-set; 409 con `versionActual` si otra pestaña guardó.
// DELETE → lo saca de la lista (la fila queda).
// La puerta y el trabajo con la base: lib/image-editor/server.ts.

import { borrarDiseno, guardarDiseno, leerDiseno, mal, puerta } from '@/lib/image-editor/server';
import { runWithWorkspace } from '@/lib/workspace';
import type { PedidoGuardar } from '@/lib/image-editor/tipos';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const id = (await params).id;
  // ⚠️ ANTES DE LEER, se asientan las fotos de lámina que la IA de imagen del negocio ya devolvió
  // (lib/carruseles/foto-lamina.ts): «Editar» un carrusel con gente abre el diseño en el acto y la foto la genera LA PESTAÑA
  // DEL CLIENTE, que tarda minutos. Abrir el diseño es el momento en que alguien lo mira, así que es donde se asienta EN EL
  // ACTO. Sin nada anotado cuesta una lectura de `app_settings`, y nunca puede hacer fallar el GET.
  //
  // Sí: un GET que ESCRIBE. Es la segunda mitad de un «Editar» que la persona ya pidió (su diseño, su foto), no una
  // escritura nueva. Y DESDE EL 7/11/2026 YA NO ES LO ÚNICO QUE ASIENTA: `/api/cron/carruseles-fotos-lamina` lo hace a
  // ciegas cada diez minutos, como `flow-abandono` con la cola. Los dos se quedan porque hacen trabajos distintos: el cron
  // cubre el caso en que NADIE vuelve a abrir el diseño (hasta ese día, la foto no entraba nunca), y esto cubre el caso en
  // que alguien está mirando AHORA — esperar diez minutos con el hueco a la vista es justo el síntoma del que salió todo
  // esto. Por eso se espera (`await`): sin eso `leerDiseno` devuelve el documento viejo y la foto aparecería recién la
  // próxima vez que lo abran.
  try {
    await runWithWorkspace(p.ws, async () => {
      const { asentarFotosDeLamina } = await import('@/lib/carruseles/foto-lamina');
      await asentarFotosDeLamina(p.ws, id);
    });
  } catch (e) {
    console.warn('[image-editor] no pude asentar las fotos de lámina:', e instanceof Error ? e.message : e);
  }
  const { status, ...r } = await leerDiseno(p.ws, id);
  return Response.json(r, { status: status ?? 200 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const cuerpo = (await req.json().catch(() => null)) as PedidoGuardar | null;
  if (!cuerpo || typeof cuerpo !== 'object') return mal('Pedido inválido');
  const { status, ...r } = await guardarDiseno(p.ws, (await params).id, cuerpo);
  return Response.json(r, { status: status ?? 200 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const { status, ...r } = await borrarDiseno(p.ws, (await params).id);
  return Response.json(r, { status: status ?? 200 });
}
