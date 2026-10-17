// =============================================================================
// /api/chats/email — contestar por EMAIL desde la tab Chats (17/10/2026)
// =============================================================================
// POST multipart { para, texto, asunto?, leadId?, archivos[] } (o JSON sin archivos)
//   → { ok, mensaje: MensajeChat } · { ok: false, error }
//
// Martín: «eliminar las tabs de "Email y WhatsApp" y unificarlo todo en "Chats"... que todo funcione bien». Lo del canal
// (el remitente del negocio, el hilo con `In-Reply-To`, la fila del hilo, los adjuntos) vive en lib/chats-email.ts
// (`enviarEmailDeChat`). Acá: la puerta, la forma del pedido y los topes.
//
// Quién puede: cualquier rol con la tab, como el envío manual de WhatsApp y de Instagram: contestar es el trabajo de
// quien atiende la conversación. ⚠️ El lead que viene del navegador se verifica DENTRO del negocio antes de anotarlo:
// una clave foránea sólo dice que existe, no que es de este workspace.

import { NextResponse } from 'next/server';
import { puertaChats } from '@/lib/chats';
import { enviarEmailDeChat } from '@/lib/chats-email';
import { MAX_ADJUNTOS_EMAIL, TOPE_ADJUNTO_EMAIL } from '@/lib/chats-email-reglas';
import { getTenantDb } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const TOPE_TEXTO = 50_000;
const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const puerta = await puertaChats();
  if (!puerta.ok) return err(puerta.status, puerta.error);

  let campos: Record<string, unknown> = {};
  const archivos: Array<{ nombre: string; mime: string; buf: Buffer }> = [];
  const tipo = req.headers.get('content-type') ?? '';
  try {
    if (tipo.includes('multipart/form-data')) {
      const fd = await req.formData();
      for (const k of ['para', 'texto', 'asunto', 'leadId']) campos[k] = fd.get(k);
      const files = fd.getAll('archivos').filter((x): x is File => typeof x === 'object' && x !== null && 'arrayBuffer' in x);
      if (files.length > MAX_ADJUNTOS_EMAIL) return err(400, `Hasta ${MAX_ADJUNTOS_EMAIL} archivos por email.`);
      for (const f of files) {
        if (f.size > TOPE_ADJUNTO_EMAIL) return err(400, `«${f.name}» pasa los ${Math.round(TOPE_ADJUNTO_EMAIL / 1024 / 1024)} MB.`);
        archivos.push({ nombre: f.name || 'archivo', mime: f.type || 'application/octet-stream', buf: Buffer.from(await f.arrayBuffer()) });
      }
    } else {
      campos = (await req.json()) as Record<string, unknown>;
    }
  } catch {
    return err(400, 'Pedido inválido.');
  }

  const para = typeof campos.para === 'string' ? campos.para : '';
  const texto = typeof campos.texto === 'string' ? campos.texto : '';
  const asunto = typeof campos.asunto === 'string' && campos.asunto.trim() ? campos.asunto : null;
  if (texto.length > TOPE_TEXTO) return err(400, 'El mensaje es demasiado largo.');
  const leadCrudo = campos.leadId == null || campos.leadId === '' ? null : Number(campos.leadId);
  if (leadCrudo != null && (!Number.isSafeInteger(leadCrudo) || leadCrudo <= 0)) return err(400, 'Lead inválido.');

  let leadId: number | null = null;
  if (leadCrudo != null) {
    const { data, error } = await (await getTenantDb()).from('leads').select('id').eq('id', leadCrudo).maybeSingle();
    if (error) return err(502, 'No pude leer el lead.');
    if (!data) return err(404, 'Ese lead no es de este negocio.');
    leadId = leadCrudo;
  }

  const r = await enviarEmailDeChat({ leadId, para, asunto, texto, archivos, autor: puerta.yo.nombre });
  if (r.ok) return NextResponse.json({ ok: true, mensaje: r.mensaje });
  return err(r.error.startsWith('Ese email') || r.error.startsWith('Escribe') || r.error.startsWith('Hasta') ? 400 : 502, r.error);
}
