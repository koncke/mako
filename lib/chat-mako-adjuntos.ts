// =============================================================================
// Los adjuntos del chat con MaKo: subirlos, firmarlos, borrarlos y pasar los PDF a El Archivero
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md, tanda 4 (16/10/2026, pedido de Martín: «los adjuntos se guardan en el
// archivero»). Lo que decide —la forma del bloque, qué path vale— está en lib/chat-mako-bloques.ts (puro, con test).
//
// ⚠️ EL BINARIO NUNCA QUEDA SUELTO: se sube ANTES de guardar el mensaje (la referencia va en el mismo insert) y, si el
//    mensaje se guarda sin ella (la 0303 sin aplicar), quien lo subió lo borra en el acto (lib/mako-turno-app.ts).
//    Se va con la conversación (`deleteSession`, lib/chart-chats.ts).
// ⚠️ UN PDF DEL ADMIN TAMBIÉN VA A EL ARCHIVERO, como el chat de Offer (decisión de Martín, Ticketera 15/10/2026
//    05:32, ref `offer-archivero`: «¿El Archivero del chat guarda el archivo y paga una extracción por documento? → A
//    · Sí»). Sólo el ADMIN: El Archivero alimenta el perfil del negocio, y el PDF que un closer le pasa a MaKo (el
//    contrato de un lead) no es un documento del negocio. Las fotos tampoco van.
//    Va una COPIA (`<ws>/chatdoc/<uuid>`): `registrarDocumentoSinPisar` se hace cargo de su origen y lo MUEVE, y el
//    adjunto del chat tiene que seguir viéndose en la conversación. Corre DESPUÉS de responder (`after`) y lo que pasó
//    se anota en el bloque: el chip del archivo lo dice.

import 'server-only';
import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace } from './workspace';
import { BUCKET_ADJUNTOS, getMensajeConBloques, setBloques } from './chart-chats';
import { registrarDocumentoSinPisar, type RegistroArchivero } from './archivero';
import { conArchivero, rutaDeAdjunto, sanearBloques, type BloqueChat, type EstadoArchivero } from './chat-mako-bloques';
import type { AdjuntoListo } from './mako-adjuntos';

/** Lo que dura el link firmado de un adjunto: lo que tarda en abrirse, no más. */
const FIRMA_S = 300;
/** Hasta cuándo puede correr la extracción de El Archivero, desde que EMPEZÓ el turno (`inicio`, la primera línea de
 *  `turnoApp`; no después de leer los archivos, que con fotos por visión son minutos): el maxDuration de las rutas que
 *  guardan adjuntos (420 s) menos lo que hace falta para mover el binario, escribir la fila y anotar el chip. */
const PLAZO_ARCHIVERO_MS = 300_000;

const bucket = () => getSupabaseServer().storage.from(BUCKET_ADJUNTOS);

/**
 * Sube los adjuntos de un mensaje a `<ws>/chat/<uuid>`. Devuelve los bloques que subieron, con el índice del adjunto
 * del que salió cada uno. Uno que no sube no frena el turno: MaKo lo lee igual, sólo que al recargar no vuelve.
 */
export async function subirAdjuntos(ws: number, adjuntos: readonly AdjuntoListo[]): Promise<Array<{ bloque: BloqueChat; de: number }>> {
  const subidos = await Promise.all(adjuntos.map(async (a, de) => {
    const path = rutaDeAdjunto(ws, randomUUID());
    const { error } = await bucket().upload(path, Buffer.from(a.bytes), { contentType: a.mime, upsert: false });
    if (error) {
      console.error(`[chat-mako:adjunto] no pude guardar «${a.nombre}»: ${error.message}`);
      return null;
    }
    return { bloque: { k: 'adjunto', path, nombre: a.nombre, mime: a.mime, tipo: a.tipo } satisfies BloqueChat, de };
  }));
  return subidos.filter((x): x is { bloque: BloqueChat; de: number } => x != null);
}

/** Borra binarios del chat (los de un mensaje que no los pudo guardar). Nunca tira. */
export async function borrarAdjuntos(paths: readonly string[]): Promise<void> {
  if (paths.length) await bucket().remove([...paths]).catch(() => null);
}

/** El link firmado (inline) de un adjunto. Quien llama ya miró de quién es la conversación. */
export async function urlFirmadaDeAdjunto(path: string): Promise<string | null> {
  const { data } = await bucket().createSignedUrl(path, FIRMA_S);
  return data?.signedUrl ?? null;
}

/**
 * Los PDF que mandó el admin, también a El Archivero, DESPUÉS de responder. `i` es la posición del bloque en el
 * mensaje `msgId`: ahí se anota lo que pasó. Fuera de un pedido (un script) `after` tira y se hace en línea (molde:
 * app/api/offer/route.ts, `archivarDespues`).
 */
export async function archivarPdfsDelChat(ws: number, msgId: number, inicio: number, pdfs: ReadonlyArray<{
  i: number; contenido: Uint8Array; nombre: string; mime: string; texto: string;
}>): Promise<void> {
  if (!pdfs.length) return;
  const trabajo = () => runWithWorkspace(ws, async () => {
    for (const p of pdfs) {
      const origen = `${ws}/chatdoc/${randomUUID()}`;
      let r: RegistroArchivero;
      try {
        const { error } = await bucket().upload(origen, Buffer.from(p.contenido), { contentType: p.mime, upsert: false });
        r = error
          ? { ok: false, motivo: 'falló el almacenamiento de MaKo' }
          : await registrarDocumentoSinPisar(ws, {
            origen, contenido: p.contenido, nombre: p.nombre, mime: p.mime, texto: p.texto,
            motivo: `Second Brain → El Archivero: extraer campos de «${p.nombre.slice(0, 120)}»`, hastaMs: inicio + PLAZO_ARCHIVERO_MS,
          });
      } catch (e) {
        // No debería: registrarDocumentoSinPisar devuelve sus fallos. Si igual tira, la copia no queda suelta.
        await borrarAdjuntos([origen]);
        console.error('[chat-mako:archivero]', e instanceof Error ? e.message : e);
        r = { ok: false, motivo: 'algo falló de nuestro lado al guardarlo' };
      }
      if (!r.ok) console.error(`[chat-mako:archivero] «${p.nombre}» (mensaje #${msgId}) no quedó en El Archivero: ${r.motivo}`);
      await anotar(ws, msgId, p.i, r.ok ? { estado: 'guardado', id: r.id, ...(r.aviso ? { aviso: r.aviso } : {}) } : { estado: 'fallo', motivo: r.motivo });
    }
  });
  try {
    after(trabajo);
    return;
  } catch { /* sin pedido: en línea */ }
  await trabajo();
}

/** Lo que pasó en El Archivero, en el bloque del mensaje. Nunca tira: el registro ya está hecho. */
async function anotar(ws: number, msgId: number, i: number, estado: EstadoArchivero): Promise<void> {
  try {
    const m = await getMensajeConBloques(msgId);
    const bloques = m ? sanearBloques(ws, m.bloques) : [];
    if (!bloques[i]) return; // la conversación se borró mientras tanto: no hay dónde anotarlo
    await setBloques(msgId, conArchivero(bloques, i, estado));
  } catch (e) {
    console.error(`[chat-mako:archivero] no pude anotar el resultado en el mensaje #${msgId}:`, e instanceof Error ? e.message : e);
  }
}
