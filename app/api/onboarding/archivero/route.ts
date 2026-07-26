// =============================================================================
// /api/onboarding/archivero — "El Archivero": tirá tus docs, MaKo los ordena
// =============================================================================
// El cliente arrastra TODO lo que tiene suelto de su negocio (avatar, oferta,
// nicho, producto…) en cualquier formato, y/o su web/IG, y/o texto pegado. Acá
// se saca el texto de cada fuente y se le pide a la IA que lo mapee al brief
// completo (negocio + oferta + avatar + marca). Ese perfil es el combustible de
// la fábrica de creativos: sin contexto del negocio no hay ángulos que valgan.
//
// De from-0 primero: no requiere NADA. Si el cliente no sube nada, el wizard le
// muestra el brief vacío para llenar a mano. Los docs son el atajo, no el peaje.
//
// Piso de permisos: admin del workspace (igual que /api/onboarding y su hermana
// /api/mako/onboarding/extract). Procesa lo que le mandás — no filtra datos de
// nadie — pero gasta IA de la agencia y deja rastro de quién.

import type { NextRequest } from 'next/server';
import { extractAnswersFromText, getAnswers, getSchema, saveAnswers } from '@/lib/onboarding';
import { leerDocumentoIA } from '@/lib/ai-cheap';
import { getRolWsEfectivo } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Techo por fuente para no reventar memoria/contexto con un doc gigante. El
// prompt final igual se corta en extractAnswersFromText (maxChars).
const MAX_POR_FUENTE = 24_000;
const MAX_ARCHIVO_BYTES = 25 * 1024 * 1024; // 25 MB: arriba de eso no es un "doc suelto"

const LEER_DOC = 'Transcribí TODO el texto legible de este documento, tal cual, sin resumir ni omitir nada. Si es una imagen o captura, describí también lo que se ve. Devolvé solo el texto.';

// Saca el texto plano de un archivo. Nativo lo que se puede (txt/md/docx); PDF e
// imágenes van por la IA de visión (Gemini gratis → OpenAI, tenant-scoped).
async function leerArchivo(file: File): Promise<{ texto: string; warning?: string }> {
  const name = file.name.toLowerCase();
  if (file.size > MAX_ARCHIVO_BYTES) return { texto: '', warning: `"${file.name}" es muy grande (más de 25 MB), lo salté.` };
  const buf = Buffer.from(await file.arrayBuffer());

  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown') || (file.type || '').startsWith('text/')) {
    return { texto: buf.toString('utf8') };
  }
  if (name.endsWith('.docx')) {
    try {
      const mammoth = (await import('mammoth')).default;
      const result = await mammoth.extractRawText({ buffer: buf });
      return { texto: result.value };
    } catch (e) { return { texto: '', warning: `No pude leer "${file.name}" (.docx): ${msg(e)}` }; }
  }
  const esPdf = name.endsWith('.pdf') || (file.type || '') === 'application/pdf';
  const esImg = /\.(png|jpe?g|webp|gif)$/.test(name) || (file.type || '').startsWith('image/');
  if (esPdf || esImg) {
    const mime = esPdf ? 'application/pdf' : (file.type || 'image/jpeg');
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    try {
      const { text } = await leerDocumentoIA({ dataUrl, isPdf: esPdf, nombreArchivo: file.name, prompt: LEER_DOC, feature: 'El Archivero', motivo: `Leer "${file.name}" del onboarding` });
      return { texto: text };
    } catch (e) { return { texto: '', warning: `No pude leer "${file.name}": ${msg(e)}` }; }
  }
  return { texto: '', warning: `"${file.name}": formato no soportado (subí .txt, .md, .docx, .pdf o una imagen).` };
}

// Baja una URL (web o IG) y la deja en texto plano. Best-effort: si la página es
// pura JS (IG suele serlo) puede venir flaca, pero no rompe el flujo.
async function leerUrl(url: string): Promise<{ texto: string; warning?: string }> {
  let u: URL;
  try { u = new URL(url.startsWith('http') ? url : `https://${url}`); } catch { return { texto: '', warning: `"${url}" no parece una dirección válida.` }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { texto: '', warning: `"${url}": solo web (http/https).` };
  try {
    const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaKoBot/1.0)' }, cache: 'no-store', signal: AbortSignal.timeout(15_000), redirect: 'follow' });
    if (!res.ok) return { texto: '', warning: `No pude abrir "${u.hostname}" (HTTP ${res.status}).` };
    const html = await res.text();
    const texto = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#\d+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!texto) return { texto: '', warning: `"${u.hostname}" no devolvió texto legible (¿es una página que carga con JavaScript?).` };
    return { texto };
  } catch (e) { return { texto: '', warning: `No pude abrir "${u.hostname}": ${msg(e)}` }; }
}

export async function POST(req: NextRequest) {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede completar el onboarding.' }, { status: 403 });
  }

  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ ok: false, error: 'Subida inválida' }, { status: 400 }); }

  const files = form.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
  const url = (typeof form.get('url') === 'string' ? String(form.get('url')) : '').trim();
  const notas = (typeof form.get('texto') === 'string' ? String(form.get('texto')) : '').trim();

  if (files.length === 0 && !url && !notas) {
    return Response.json({ ok: false, error: 'No me diste nada para leer. Subí un documento, pegá tu web/IG o escribí unas líneas.' }, { status: 400 });
  }

  try {
    const partes: string[] = [];
    const warnings: string[] = [];
    let archivosLeidos = 0;
    let urlLeida = false;

    for (const file of files) {
      const { texto, warning } = await leerArchivo(file);
      if (warning) warnings.push(warning);
      const t = texto.trim();
      if (t) { partes.push(`### Documento: ${file.name}\n${t.slice(0, MAX_POR_FUENTE)}`); archivosLeidos++; }
    }
    if (url) {
      const { texto, warning } = await leerUrl(url);
      if (warning) warnings.push(warning);
      const t = texto.trim();
      if (t) { partes.push(`### Web/IG: ${url}\n${t.slice(0, MAX_POR_FUENTE)}`); urlLeida = true; }
    }
    if (notas) partes.push(`### Notas del cliente\n${notas.slice(0, MAX_POR_FUENTE)}`);

    const todo = partes.join('\n\n');
    if (!todo.trim()) {
      return Response.json({ ok: false, error: 'No pude sacar texto de nada de lo que me diste.', warnings }, { status: 422 });
    }

    // Todos los campos del esquema (editable). El label lleva el grupo adelante
    // para que el extractor no confunda, p.ej., "nombre" de la oferta con el del
    // personaje de marca.
    const schema = await getSchema();
    const fields = schema.flatMap((g) => g.fields.map((f) => ({ key: f.key, label: `${g.label} — ${f.label}` })));

    const nuevas = await extractAnswersFromText(todo, fields, 40_000);
    const previas = await getAnswers();
    const answers = { ...previas, ...nuevas }; // lo nuevo (ya filtrado a no-vacío) pisa/llena; lo previo se conserva donde no hubo dato
    await saveAnswers(answers);

    return Response.json({
      ok: true,
      answers,
      extraidos: Object.keys(nuevas),
      fuentes: { archivos: archivosLeidos, url: urlLeida, texto: Boolean(notas) },
      warnings,
    });
  } catch (e) {
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
