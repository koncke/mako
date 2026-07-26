// =============================================================================
// /api/onboarding/archivero — El Archivero: los documentos del negocio, conservados
// =============================================================================
// GET     → estado: archivos guardados + brief efectivo + procedencia + huecos.
// POST     → subir archivos (multipart): guarda el binario, extrae por archivo
//            (campos + razonamiento), inserta la fila y recalcula el perfil.
// DELETE ?id → borra un archivo (binario + fila) y recalcula (cascada: se lleva lo
//            que ese archivo aportó, salvo lo que además esté en manual).
//
// Editar campos a mano NO se hace acá: va por /manual (huecos para cualquier admin;
// pisar un dato ya cargado, solo super-admin). Descargar: /download?id=.
// Piso: admin del workspace; el dueño (sin impersonar) opera sobre OWNER_WS. Todo
// el trabajo va dentro de runWithWorkspace(ws) para scopear tabla + storage + brief.

import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { runWithWorkspace } from '@/lib/workspace';
import { extraerDeArchivo } from '@/lib/onboarding';
import { leerDocumentoIA } from '@/lib/ai-cheap';
import {
  flatFields, insertFile, subirBinario, getFile, deleteFileRow, borrarBinario, buildEstado, resolverWsAdmin,
} from '@/lib/archivero';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const MAX_ARCHIVO_BYTES = 25 * 1024 * 1024;
const LEER_DOC = 'Transcribí TODO el texto legible de este documento, tal cual, sin resumir ni omitir nada. Si es una imagen o captura, describí también lo que se ve. Devolvé solo el texto.';

async function leerArchivo(file: File): Promise<{ texto: string; warning?: string }> {
  const name = file.name.toLowerCase();
  if (file.size > MAX_ARCHIVO_BYTES) return { texto: '', warning: `"${file.name}" es muy grande (más de 25 MB), lo salté.` };
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown') || (file.type || '').startsWith('text/')) {
    return { texto: buf.toString('utf8') };
  }
  if (name.endsWith('.docx')) {
    try { const mammoth = (await import('mammoth')).default; return { texto: (await mammoth.extractRawText({ buffer: buf })).value }; }
    catch (e) { return { texto: '', warning: `No pude leer "${file.name}" (.docx): ${msg(e)}` }; }
  }
  const esPdf = name.endsWith('.pdf') || (file.type || '') === 'application/pdf';
  const esImg = /\.(png|jpe?g|webp|gif)$/.test(name) || (file.type || '').startsWith('image/');
  if (esPdf || esImg) {
    const mime = esPdf ? 'application/pdf' : (file.type || 'image/jpeg');
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    try { const { text } = await leerDocumentoIA({ dataUrl, isPdf: esPdf, nombreArchivo: file.name, prompt: LEER_DOC, feature: 'El Archivero', motivo: `Leer "${file.name}"` }); return { texto: text }; }
    catch (e) { return { texto: '', warning: `No pude leer "${file.name}": ${msg(e)}` }; }
  }
  return { texto: '', warning: `"${file.name}": formato no soportado (subí .txt, .md, .docx, .pdf o una imagen).` };
}

export async function GET() {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace puede ver el archivero.' }, { status: 403 });
  return runWithWorkspace(ws, async () => {
    try { return Response.json({ ok: true, ...(await buildEstado(false)) }); }
    catch (e) { return Response.json({ ok: false, error: msg(e) }, { status: 500 }); }
  });
}

export async function POST(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace puede subir archivos.' }, { status: 403 });
  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ ok: false, error: 'Subida inválida' }, { status: 400 }); }
  const files = form.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return Response.json({ ok: false, error: 'No subiste ningún archivo.' }, { status: 400 });

  return runWithWorkspace(ws, async () => {
    try {
      const fields = (await flatFields()).map((f) => ({ key: f.key, label: `${f.grupo} — ${f.label}` }));
      const warnings: string[] = [];
      let leidos = 0;
      for (const file of files) {
        const { texto, warning } = await leerArchivo(file);
        if (warning) { warnings.push(warning); continue; }
        if (!texto.trim()) { warnings.push(`No pude sacar texto de "${file.name}".`); continue; }
        const { campos, razonamiento } = await extraerDeArchivo(texto, fields, 24000);
        const id = randomUUID();
        const buf = Buffer.from(await file.arrayBuffer());
        const path = await subirBinario(ws, id, buf, file.type || '');
        await insertFile(ws, { id, nombre: file.name, mime: file.type || '', tamano: file.size, storage_path: path, razonamiento, campos });
        leidos++;
      }
      if (leidos === 0) return Response.json({ ok: false, error: 'No pude leer ninguno de los archivos.', warnings, ...(await buildEstado(false)) }, { status: 422 });
      return Response.json({ ok: true, warnings, ...(await buildEstado(true)) });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}

export async function DELETE(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace puede borrar archivos.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ ok: false, error: 'Falta el id del archivo.' }, { status: 400 });
  return runWithWorkspace(ws, async () => {
    try {
      const f = await getFile(id);
      if (!f) return Response.json({ ok: false, error: 'Archivo no encontrado.' }, { status: 404 });
      await borrarBinario(f.storage_path);
      await deleteFileRow(id);
      return Response.json({ ok: true, ...(await buildEstado(true)) });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}
