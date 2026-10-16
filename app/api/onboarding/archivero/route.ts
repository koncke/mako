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
import { extraerDeArchivo, generarPanorama } from '@/lib/onboarding';
import { leerDocumentoIA, docsIADisponible } from '@/lib/ai-cheap';
import { muroConocido, textoInsuficiente, sinDatosDelNegocio } from '@/lib/archivero-webs';
import {
  flatFields, insertFile, subirBinario, getFile, deleteFileRow, borrarBinario, buildEstado, resolverWsAdmin,
  getPanorama, setPanorama, listFiles,
} from '@/lib/archivero';
import { getSupabaseServer } from '@/lib/supabase';
import { validarDestino } from '@/lib/landing-fetch';
import { bajarWebSegura, pedirClavado, pathSubidoValido } from '@/lib/archivero-bajada';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const MAX_ARCHIVO_BYTES = 25 * 1024 * 1024;
// ⚠️ ACÁ HABÍA TRES CORTES `if (!(await docsIADisponible()))` que devolvían «Carga tu API key de
// Gemini» ANTES de llamar a la IA, y con eso la red de la plataforma de este archivo no corría nunca
// para un cliente sin keys. Desde el 15/10/2026 un cliente nuevo no trae una API (el paso de la IA
// del wizard es opcional) y El Archivero es bloqueante: con los cortes puestos, se quedaba trabado
// acá. Se sacaron el 16/10/2026; lo fija tests/onboarding-sin-api.test.ts.
//
// Así que "sinIA" ya no significa «había key y falló»: puede ser la red de la plataforma, sin keys
// propias. El mensaje lo distingue, y a quien no tiene IA propia le dice cómo dejar de depender de la
// red (sin acusarlo: no hizo nada mal). Si extraerDeArchivo pudo interpretar por qué (cuota, key
// vencida, timeout), eso va primero.
const mensajeSinIA = async (nombre: string, motivo?: string): Promise<string> => {
  if (motivo) return `No pude analizar "${nombre}": ${motivo}`;
  if (await docsIADisponible().catch(() => false)) return `Tu IA está conectada pero no pudo analizar "${nombre}" ahora mismo. Prueba de nuevo en un momento.`;
  return `No pude analizar "${nombre}" ahora mismo. Prueba de nuevo en un momento, o conecta tu propia IA en Integraciones para no depender de la de MaKo.`;
};
const LEER_DOC = 'Transcribe TODO el texto legible de este documento, tal cual, sin resumir ni omitir nada. Si es una imagen o captura, describe también lo que se ve. Devuelve solo el texto.';

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
  if (esPdf) {
    // 1) Capa de texto (la mayoría de los PDFs la tienen): rápida, confiable y sin
    //    gastar visión. Antes TODO PDF iba por visión y un PDF de texto volvía vacío.
    try {
      // pdfjs (dentro de unpdf) usa Math.sumPrecise, que no existe en Node <22.
      const M = Math as unknown as { sumPrecise?: (a: number[]) => number };
      if (typeof M.sumPrecise !== 'function') M.sumPrecise = (a) => a.reduce((x, y) => x + y, 0);
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      if (text && text.trim().length > 80) return { texto: text };
    } catch { /* sin capa de texto → probamos visión (PDF escaneado) */ }
    // 2) PDF escaneado (imágenes) → visión.
    try {
      const dataUrl = `data:application/pdf;base64,${buf.toString('base64')}`;
      const { text } = await leerDocumentoIA({ dataUrl, isPdf: true, nombreArchivo: file.name, prompt: LEER_DOC, feature: 'El Archivero', motivo: `Leer "${file.name}"`, redDePlataforma: true });
      return { texto: text };
    } catch (e) { return { texto: '', warning: `No pude leer "${file.name}": ${msg(e)}` }; }
  }
  if (esImg) {
    try {
      const dataUrl = `data:${file.type || 'image/jpeg'};base64,${buf.toString('base64')}`;
      const { text } = await leerDocumentoIA({ dataUrl, isPdf: false, nombreArchivo: file.name, prompt: LEER_DOC, feature: 'El Archivero', motivo: `Leer "${file.name}"`, redDePlataforma: true });
      return { texto: text };
    } catch (e) { return { texto: '', warning: `No pude leer "${file.name}": ${msg(e)}` }; }
  }
  return { texto: '', warning: `"${file.name}": formato no soportado (sube .txt, .md, .docx, .pdf o una imagen).` };
}

// Procesa UN archivo ya subido a storage (direct-upload). Corre dentro de
// runWithWorkspace(ws). Chequea que el path pertenezca al ws (anti-IDOR).
async function procesarDirecto(ws: number, body: { fileId?: string; path?: string; nombre?: string; mime?: string; tamano?: number; finalizar?: boolean }): Promise<Response> {
  try {
    const fileId = String(body.fileId || '');
    const path = String(body.path || '');
    const nombre = String(body.nombre || 'documento');
    const mime = String(body.mime || '');
    const tamano = Number(body.tamano) || 0;
    // El path tiene que ser EXACTAMENTE el que acuñó /archivero/upload-url (`${ws}/${uuid}`). Con
    // un `startsWith(`${ws}/`)` pasaba `5/../7/<uuid>`: se bajaba —y si la lectura fallaba, se
    // BORRABA— un archivo de otro workspace (auditoría del 14/10/2026, lib/archivero-bajada.ts).
    if (!pathSubidoValido(ws, fileId, path)) return Response.json({ ok: false, error: 'Datos de archivo inválidos.' }, { status: 400 });

    const { data: blob, error: dErr } = await getSupabaseServer().storage.from('archivero').download(path);
    if (dErr || !blob) return Response.json({ ok: false, error: 'No encontré el archivo subido. Reintenta.' }, { status: 404 });
    const buf = Buffer.from(await blob.arrayBuffer());
    const file = new File([new Uint8Array(buf)], nombre, { type: mime });

    const warnings: string[] = [];
    const { texto, warning } = await leerArchivo(file);
    let textoOk = '';
    let leido = false;
    if (warning) warnings.push(warning);
    else if (!texto.trim()) warnings.push(`No pude sacar texto de "${nombre}".`);
    else {
      const fields = (await flatFields()).map((f) => ({ key: f.key, label: `${f.grupo} — ${f.label}` }));
      const { campos, razonamiento, sinIA, motivoSinIA } = await extraerDeArchivo(texto, fields, 24000);
      if (sinIA) warnings.push(await mensajeSinIA(nombre, motivoSinIA));
      else { await insertFile(ws, { id: fileId, nombre, mime, tamano, storage_path: path, razonamiento, campos }); textoOk = texto; leido = true; }
    }
    if (!leido) await getSupabaseServer().storage.from('archivero').remove([path]).catch(() => {}); // binario huérfano
    else {
      try { const pano = await generarPanorama([textoOk], await getPanorama()); if (pano) await setPanorama(pano); }
      catch (e) { console.error('[archivero] panorama (no fatal):', msg(e)); }
    }
    // NOTA: ya NO auto-generamos avatares/razones al subir docs. Mauricio pidió que
    // MaKo SIEMPRE pregunte (segmentación) antes de armar los avatares → la generación
    // se hace en el paso "Avatares" (con preguntas), no en silencio acá.
    await buildEstado(true);
    if (!leido) return Response.json({ ok: false, error: warnings[0] || 'No pude leer el archivo.', warnings, ...(await buildEstado(false)) }, { status: 422 });
    return Response.json({ ok: true, warnings, ...(await buildEstado(false)) });
  } catch (e) {
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

// ── Webs pegadas: valida la URL (anti-SSRF), baja la página y saca el texto ──
// ⚠️ ESTE FILTRO ES SÓLO EL PRIMERO, y por sí solo NO frena un SSRF: mira el TEXTO del host, y
// `localhost.`, `localtest.me` o `x.127.0.0.1.nip.io` lo pasan y resuelven a loopback. Sirve para
// contestar rápido y claro lo obvio. La baranda de verdad está en `fetchWebText`: cada salto
// resuelto y con TODAS sus IPs públicas, la conexión clavada a esa IP y los redirects a mano.
function validarUrlPublica(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let s = (raw || '').trim();
  if (!s) return { ok: false, error: 'Falta el link.' };
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u: URL;
  try { u = new URL(s); } catch { return { ok: false, error: 'Ese link no es válido.' }; }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, error: 'Solo se aceptan links http/https.' };
  const h = u.hostname.toLowerCase();
  // SSRF básico: nada de localhost ni rangos privados/link-local.
  if (h === 'localhost' || h.endsWith('.local') || h === '0.0.0.0' || h === '::1' || h.startsWith('[')
    || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || !h.includes('.')) {
    return { ok: false, error: 'Ese link no es una web pública.' };
  }
  return { ok: true, url: u.toString() };
}

async function fetchWebText(url: string): Promise<{ texto: string; titulo: string; warning?: string }> {
  try {
    // NO con `fetch` + `redirect: 'follow'` (auditoría del 14/10/2026): no revalidaba ningún
    // salto ni dejaba clavar la IP. `validarDestino` (lib/landing-fetch.ts) en CADA salto, y el
    // pedido a la IP ya validada; tope de 3 MB mientras se lee (lib/archivero-bajada.ts).
    const res = await bajarWebSegura(url, { validar: validarDestino, pedir: pedirClavado });
    if (res.status < 200 || res.status >= 300) return { texto: '', titulo: '', warning: `La web respondió ${res.status}.` };
    const html = res.cuerpo.toString('utf8');
    const titulo = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const texto = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ').trim();
    return { texto, titulo };
  } catch (e) { return { texto: '', titulo: '', warning: `No pude abrir la web: ${msg(e)}` }; }
}

// Procesa una WEB pegada (link): baja la página, extrae el texto y lo trata como un
// documento más. Se guarda con mime 'text/html' y storage_path = la URL (sin binario).
async function procesarLink(ws: number, body: { url?: string }): Promise<Response> {
  try {
    const val = validarUrlPublica(String(body.url || ''));
    if (!val.ok) return Response.json({ ok: false, error: val.error }, { status: 400 });
    const url = val.url;
    const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } })();

    // El muro va PRIMERO, antes incluso de pedir IA: contra un Instagram la
    // llamada se gasta para nada, y «carga tu API key» manda a arreglar algo
    // que no abre ningún muro.
    const muro = muroConocido(host);
    if (muro) return Response.json({ ok: false, error: muro, warnings: [muro], ...(await buildEstado(false)) }, { status: 422 });

    const warnings: string[] = [];
    const { texto, titulo, warning } = await fetchWebText(url);
    let leido = false;
    const pobre = textoInsuficiente(host, texto);
    if (warning) warnings.push(warning);
    else if (pobre) warnings.push(pobre);
    else {
      const fields = (await flatFields()).map((f) => ({ key: f.key, label: `${f.grupo} — ${f.label}` }));
      const { campos, razonamiento, sinIA, motivoSinIA } = await extraerDeArchivo(texto, fields, 24000);
      const vacia = sinDatosDelNegocio(host, campos);
      if (sinIA) warnings.push(await mensajeSinIA(host, motivoSinIA));
      // Cero datos NO es una lectura: la fila se mostraba como documento leído
      // y el texto del muro entraba al panorama del negocio (tarea #201).
      else if (vacia) warnings.push(vacia);
      else {
        await insertFile(ws, { id: randomUUID(), nombre: titulo || host, mime: 'text/html', tamano: texto.length, storage_path: url, razonamiento, campos });
        leido = true;
        try { const pano = await generarPanorama([texto], await getPanorama()); if (pano) await setPanorama(pano); }
        catch (e) { console.error('[archivero] panorama link (no fatal):', msg(e)); }
      }
    }
    await buildEstado(true);
    if (!leido) return Response.json({ ok: false, error: warnings[0] || 'No pude leer la web.', warnings, ...(await buildEstado(false)) }, { status: 422 });
    return Response.json({ ok: true, warnings, ...(await buildEstado(false)) });
  } catch (e) {
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
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
  // DIRECT-UPLOAD: si viene JSON, el binario ya está en storage (subido con la URL
  // firmada de /archivero/upload-url) y solo procesamos la metadata → sin el límite de
  // ~4.5 MB de Vercel. Un archivo grande ya no da 413. El multipart de abajo queda como
  // fallback para archivos chicos.
  if ((req.headers.get('content-type') || '').includes('application/json')) {
    let body: { action?: string; fileId?: string; path?: string; nombre?: string; mime?: string; tamano?: number; finalizar?: boolean; url?: string };
    try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
    if (body.action === 'procesar-link') return runWithWorkspace(ws, () => procesarLink(ws, body));
    if (body.action !== 'procesar') return Response.json({ ok: false, error: 'acción inválida' }, { status: 400 });
    return runWithWorkspace(ws, () => procesarDirecto(ws, body));
  }
  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ ok: false, error: 'Subida inválida' }, { status: 400 }); }
  const files = form.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return Response.json({ ok: false, error: 'No subiste ningún archivo.' }, { status: 400 });

  return runWithWorkspace(ws, async () => {
    try {
      const fields = (await flatFields()).map((f) => ({ key: f.key, label: `${f.grupo} — ${f.label}` }));
      const warnings: string[] = [];
      const textos: string[] = [];
      let leidos = 0;
      for (const file of files) {
        const { texto, warning } = await leerArchivo(file);
        if (warning) { warnings.push(warning); continue; }
        if (!texto.trim()) { warnings.push(`No pude sacar texto de "${file.name}".`); continue; }
        const { campos, razonamiento, sinIA, motivoSinIA } = await extraerDeArchivo(texto, fields, 24000);
        if (sinIA) { warnings.push(await mensajeSinIA(file.name, motivoSinIA)); continue; }
        const id = randomUUID();
        const buf = Buffer.from(await file.arrayBuffer());
        const path = await subirBinario(ws, id, buf, file.type || '');
        await insertFile(ws, { id, nombre: file.name, mime: file.type || '', tamano: file.size, storage_path: path, razonamiento, campos });
        textos.push(texto);
        leidos++;
      }
      if (leidos === 0) return Response.json({ ok: false, error: 'No pude leer ninguno de los archivos.', warnings, ...(await buildEstado(false)) }, { status: 422 });
      // Panorama libre: lo que la IA entendió de TODO. Regenera con los docs de esta
      // tanda + el panorama previo (acumula entre subidas). Best-effort, no bloquea.
      try {
        const pano = await generarPanorama(textos, await getPanorama());
        if (pano) await setPanorama(pano);
      } catch (e) { console.error('[archivero] panorama falló (no fatal):', msg(e)); }
      // avatares/razones NO se generan acá: se hacen en el paso Avatares (con preguntas).
      await buildEstado(true);
      return Response.json({ ok: true, warnings, ...(await buildEstado(false)) });
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
      // Sin archivos, el panorama queda huérfano: lo limpiamos.
      if ((await listFiles()).length === 0) await setPanorama('');
      return Response.json({ ok: true, ...(await buildEstado(true)) });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}
