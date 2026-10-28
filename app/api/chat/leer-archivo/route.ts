// =============================================================================
// POST /api/chat/leer-archivo — lo que se adjunta en una caja de chat de MaKo, LEÍDO (27/10/2026, ticket #16 de Leila)
// =============================================================================
// La caja única (app/_chat/CajaChat.tsx) adjunta en TODA pantalla: la que no tiene adjuntos propios usa esto
// (app/_chat/adjuntos-que-se-leen.ts). Dos pasos, como Offer (Vercel corta un POST de más de ~4,5 MB):
//   · { accion: 'subir-url', nombre, mime, tamano } → { path, signedUrl }: el navegador sube el binario con un PUT;
//   · { accion: 'leer', path, nombre, mime }        → { texto, aviso? }: se lee con `archivoATexto` (Word, Excel, PDF,
//     imágenes por visión, audio transcripto) y se borra. El texto vuelve a la caja, que lo manda con el mensaje.
// ⚠️ EL PATH LO ESCRIBE EL NAVEGADOR: sólo uno de ESTE workspace y de esta ruta (`esArchivoParaLeer`). Uno ajeno no se toca.
// ⚠️ CON LA IA DEL NEGOCIO (D6b, tests/d6b-rutas.test.ts): leer una imagen o un audio gasta SU IA, nunca la de la plataforma.
// =============================================================================

import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import { conSuIADelNegocio } from '@/lib/ia-del-negocio';
import { archivoATexto } from '@/lib/archivo-a-texto';
import { CARPETA_LEER, TOPE_LEIDO, esArchivoParaLeer, porQueNoSeAdjunta } from '@/lib/chat-formatos';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const BUCKET = 'archivero';
const json = (cuerpo: Record<string, unknown>, status = 200) => Response.json(cuerpo, { status });
const cadena = (x: unknown) => (typeof x === 'string' ? x.trim() : '');

export async function POST(req: NextRequest) {
  const origen = req.headers.get('origin');
  let mismo = false;
  try { mismo = !!origen && new URL(origen).host === req.headers.get('host'); } catch { mismo = false; }
  if (!mismo) return json({ ok: false, error: 'No salió de MaKo' }, 403);
  const [sesion, ws] = await Promise.all([getUsuarioActual(), getWorkspaceActual()]);
  if (!sesion || ws == null) return json({ ok: false, error: 'Tu sesión venció.' }, 401);
  let body: Record<string, unknown> = {};
  try { body = ((await req.json()) ?? {}) as Record<string, unknown>; } catch { return json({ ok: false, error: 'No entendí el pedido.' }, 400); }
  const nombre = cadena(body.nombre).slice(0, 200) || 'archivo';
  const mime = cadena(body.mime);
  const storage = getSupabaseServer().storage.from(BUCKET);

  if (body.accion === 'subir-url') {
    const tamano = Number(body.tamano);
    const no = porQueNoSeAdjunta(nombre, mime, Number.isFinite(tamano) ? tamano : 0);
    if (no) return json({ ok: false, error: no }, 415);
    const path = `${ws}/${CARPETA_LEER}/${randomUUID()}`;
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data) {
      console.error('[chat:leer-archivo] subir-url', error?.message);
      return json({ ok: false, error: 'No pude preparar la subida (falló el almacenamiento de MaKo, no es tu archivo). Prueba de nuevo.' }, 502);
    }
    return json({ ok: true, path, signedUrl: data.signedUrl });
  }

  if (body.accion === 'leer') {
    const path = cadena(body.path);
    if (!esArchivoParaLeer(ws, path)) return json({ ok: false, error: 'Ese archivo no es de esta cuenta. Vuelve a adjuntarlo.' }, 400);
    try {
      const { data, error } = await storage.download(path);
      if (error || !data) return json({ ok: false, error: `No encontré «${nombre}». Vuelve a adjuntarlo.` }, 404);
      // Lo que se mira es lo que BAJÓ (la revisión del 27/10/2026): en «subir-url» el tamaño y el tipo los declara el navegador.
      const no = porQueNoSeAdjunta(nombre, mime || data.type, data.size);
      if (no) return json({ ok: false, error: no }, 415);
      const file = new File([data], nombre, { type: mime || data.type });
      // `feature`: el gasto de la visión sale en el Saldo de IA como el del chat, no como «Importar al plan».
      const lectura = await runWithWorkspace(ws, () => conSuIADelNegocio(ws, () => archivoATexto(file, { feature: 'mako-chat', motivo: `Chat de MaKo: leer «${nombre}»` })));
      const texto = lectura.texto.trim();
      if (!texto) return json({ ok: false, error: lectura.warning || `No pude sacarle texto a «${nombre}».` }, 422);
      const cortado = texto.length > TOPE_LEIDO;
      return json({ ok: true, texto: cortado ? `${texto.slice(0, TOPE_LEIDO)}\n[…el archivo sigue: se cortó aquí por largo]` : texto, ...(lectura.warning ? { aviso: lectura.warning } : {}) });
    } catch (e) {
      console.error('[chat:leer-archivo] leer', e instanceof Error ? e.message : String(e));
      return json({ ok: false, error: `No pude leer «${nombre}». Prueba de nuevo en un momento.` }, 500);
    } finally {
      await storage.remove([path]).catch(() => null);
    }
  }

  return json({ ok: false, error: 'No sé qué hacer con eso.' }, 400);
}
