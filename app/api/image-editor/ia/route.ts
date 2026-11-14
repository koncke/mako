// =============================================================================
// POST /api/image-editor/ia — el chat «MaKo IA» del Image Editor
// =============================================================================
// POST json {instruccion, diseno, alcance, kit?, intencion?} → { ok, resumen, operaciones, descartes } | { ok:false, error }
// (`kit`: el kit de marca elegido, lib/marca/kits.ts; `intencion`: «discutir» contesta sin cambiar nada.)
//
// El panel (app/image-editor/mako/chat/PanelMakoIA.tsx) manda lo que pidió la persona y la vista del diseño abierto
// (lib/image-editor/chat/vista.ts); vuelve una PROPUESTA (operaciones de lib/image-editor/chat/catalogo.ts) que la
// persona revisa y acepta en el editor. Esta ruta no escribe nada: el diseño lo guarda el editor, como siempre.
//
// La puerta es la del editor (`puerta` de lib/image-editor/server.ts: sesión, admin con la tab en su capa y un
// workspace). ⚠️ El workspace se exige ANTES de llamar a la IA: corre con la key DEL CLIENTE (la cascada gratis), y
// sin workspace cae al ws 1, que es un cliente.
//
// Va detrás de la sesión (NO está en lib/rutas-publicas.ts) y el proxy le exige Origin propio al POST.
//
// SÓLO MaKo Pro (14/11/2026, lib/editores-ia-pro.ts): el editor es de los dos planes, editarlo con IA no. Un Esencial recibe
// el 403 con `pasarAPro`, antes del rate limit y de leer los archivos (no gasta nada).

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { puerta } from '@/lib/image-editor/server';
import { candadoIaDeEditores } from '@/lib/editores-ia-pro';
import { rateLimit } from '@/lib/rate-limit';
import { editarImagen } from '@/lib/image-editor/chat/ia';
import { cuerpoYArchivos, leerLosArchivos } from '@/lib/adjuntos-del-chat';
import { lecturaDeArchivos } from '@/lib/mako-adjuntos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// La IA tiene 90 s y una reparación del JSON con aire; con fotos o PDF, primero se leen (una foto con la visión tardó 52 s).
export const maxDuration = 300;
/** Lo que entra de la lectura de los archivos al pedido (el diseño o la línea de tiempo ya son largos). */
const TOPE_LECTURA_EDITOR = 8_000;

const fallo = (error: string, status: number) =>
  Response.json({ ok: false, error }, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(req: NextRequest) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const pro = await candadoIaDeEditores();
  if (pro) return pro;
  if (!rateLimit(`image-editor:ia:${p.ws}`, 30, 60_000)) return fallo('Demasiados pedidos. Espera un minuto.', 429);

  // Con fotos o PDF (28/10/2026, las cajas unificadas): vienen en multipart (lib/adjuntos-del-chat.ts).
  const c = await cuerpoYArchivos(req);
  if (!c.ok) return fallo(c.error, c.status);
  const body = c.body;

  return runWithWorkspace(p.ws, async () => {
    // Se leen con la IA del negocio (por eso adentro de su workspace), y su lectura va aparte de la instrucción, como dato.
    const { lecturas, noLeidos } = await leerLosArchivos(c.adjuntos, 'image-editor-chat');
    const escrita = String(body.instruccion ?? '').trim();
    if (c.adjuntos.length && !lecturas.length && !escrita) return fallo(`No pude leer ${noLeidos.map((n) => `«${n}»`).join(', ')}: escribe qué quieres cambiar.`, 422);
    const instruccion = c.adjuntos.length && !escrita ? 'Usa lo que traen estos archivos en el diseño.' : body.instruccion;
    const archivos = lecturas.length ? lecturaDeArchivos(lecturas, TOPE_LECTURA_EDITOR) : undefined;
    const r = await editarImagen({ instruccion, diseno: body.diseno, alcance: body.alcance, memoria: body.memoria, kit: body.kit, intencion: body.intencion, conNegocio: body.conNegocio, archivos });
    if (!r.ok) return fallo(r.error, r.status);
    return Response.json(r, { headers: { 'cache-control': 'no-store' } });
  });
}
