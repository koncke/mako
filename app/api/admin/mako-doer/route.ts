// =============================================================================
// /api/admin/mako-doer — gestión + prueba del doer "Hola MaKo"
// =============================================================================
// Solo admin. Permite habilitar grupos donde MaKo escucha, abrir la recepción de
// grupos en la línea de voz (groupsIgnore:false) y SIMULAR un mensaje entrante
// para probar el loop de punta a punta (MaKo lee datos reales, propone acciones y
// responde de verdad al grupo). GET → estado; POST { action }.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { OWNER_WS, runWithWorkspace } from '@/lib/workspace';
import { permitirGruposEnInstancia, registrarWebhookInstancia } from '@/lib/evolution';
import { instanciaVoz } from '@/lib/mako-grupo';
import { gruposDoer, setGruposDoer, manejarEntranteDoer } from '@/lib/mako-doer-in';
import { pendientesVigentes } from '@/lib/mako-pendientes';
import { transcribirAudio, cheapDisponible } from '@/lib/ai-cheap';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const grupos = await gruposDoer(OWNER_WS);
  return NextResponse.json({ ok: true, grupos, voz: await instanciaVoz() });
}

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let body: { action?: string; jids?: string[]; jid?: string; texto?: string; audioBase64?: string; mime?: string };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }

  switch (body.action) {
    case 'grupos-set': {
      await setGruposDoer(OWNER_WS, Array.isArray(body.jids) ? body.jids : []);
      return NextResponse.json({ ok: true, grupos: await gruposDoer(OWNER_WS) });
    }
    case 'abrir-grupos': {
      // groupsIgnore:false en la línea de voz → Evolution empieza a entregar los @g.us.
      const r = await permitirGruposEnInstancia(await instanciaVoz());
      return NextResponse.json(r, { status: r.ok ? 200 : 502 });
    }
    case 'preparar-voz': {
      // Deja lista la línea de voz para el "Hola MaKo" en vivo: registra el webhook
      // hacia nuestra app + abre la recepción de grupos. (El canal SuperAdmin se
      // crea sin webhook; sin esto, los entrantes de grupo nunca llegan.)
      const voz = await instanciaVoz();
      const wh = await registrarWebhookInstancia(voz);
      const grp = await permitirGruposEnInstancia(voz);
      return NextResponse.json({ ok: wh.ok && grp.ok, voz, webhook: wh, grupos: grp });
    }
    case 'pendientes': {
      if (!body.jid) return NextResponse.json({ ok: false, error: 'falta jid' }, { status: 400 });
      return NextResponse.json({ ok: true, vigentes: await pendientesVigentes(OWNER_WS, body.jid) });
    }
    case 'probar-audio': {
      // Prueba SOLO la transcripción (STT): base64 de un audio → texto.
      if (!cheapDisponible()) return NextResponse.json({ ok: false, error: 'Falta GROQ_API_KEY u OPENAI_API_KEY' }, { status: 400 });
      if (!body.audioBase64) return NextResponse.json({ ok: false, error: 'falta audioBase64' }, { status: 400 });
      try {
        const texto = await transcribirAudio(body.audioBase64, body.mime || 'audio/ogg', { language: 'es' });
        return NextResponse.json({ ok: true, texto });
      } catch (e) {
        return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
      }
    }
    case 'probar': {
      // Simula un entrante de grupo: corre el doer completo (lee, propone, responde
      // de verdad al grupo). Con audioBase64 simula una NOTA DE VOZ (transcribe +
      // corre el doer). Útil para probar sin depender de un humano tecleando/hablando.
      const jid = body.jid || '';
      const texto = (body.texto || '').trim();
      const audioB64 = body.audioBase64;
      if (!jid || (!texto && !audioB64)) return NextResponse.json({ ok: false, error: 'faltan jid y (texto o audioBase64)' }, { status: 400 });
      const msg = audioB64
        ? {
            key: { remoteJid: jid, fromMe: false, id: `test-${Date.now()}`, participant: 'test@s.whatsapp.net' },
            message: { audioMessage: { mimetype: body.mime || 'audio/ogg' } },
            base64: audioB64,
            pushName: 'Prueba (admin)',
          }
        : {
            key: { remoteJid: jid, fromMe: false, id: `test-${Date.now()}`, participant: 'test@s.whatsapp.net' },
            message: { conversation: texto },
            pushName: 'Prueba (admin)',
          };
      const res = await runWithWorkspace(OWNER_WS, () => manejarEntranteDoer(OWNER_WS, msg));
      const vigentes = await pendientesVigentes(OWNER_WS, jid);
      return NextResponse.json({ ok: true, ...res, vigentes });
    }
    default:
      return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  }
}
