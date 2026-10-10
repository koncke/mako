// =============================================================================
// API: el recordatorio de la reunión AL LEAD — interruptor y textos (tarjeta de /automations)
// =============================================================================
// GET  → { activo, envioWhatsapp, toques: [{ min, texto, porDefecto, textoDefault }], variables }
// POST → { activo?: boolean, textos?: { "1440"|"60"|"15": string } }. Lo que no viene se conserva.
//        Un texto vacío vuelve al de fábrica. Una `{{variable}}` que no existe se RECHAZA acá,
//        al guardar: el mensaje sale solo y nadie lo lee antes de que le llegue al lead.
// Guard: sólo el admin del workspace (le escribe a leads reales).
//
// El setting es POR WORKSPACE y no se hereda del dueño: se lee con el `workspace_id` explícito
// (`leerConfigRecordatorio`) y se escribe adentro de `runWithWorkspace(ws, …)`, nunca por el
// contexto suelto, que fuera de un request cae al dueño. Ver lib/reunion-recordatorio.ts.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getWorkspaceActual, getRolWsEfectivo, runWithWorkspace } from '@/lib/workspace';
import { setSetting } from '@/lib/settings';
import { envioWhatsappHabilitadoEstricto } from '@/lib/envio-flags';
import { leerConfigRecordatorio } from '@/lib/reunion-recordatorio';
import {
  KEY_RECORDATORIO, TOQUES, TEXTO_DEFAULT, TOPE_TEXTO, VARIABLES, serializarConfig, variablesDesconocidas,
  type ConfigRecordatorio, type Toque,
} from '@/lib/recordatorio-lead';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function guard(): Promise<{ ws: number } | { error: Response }> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return { error: Response.json({ ok: false, error: 'Solo el admin del negocio puede configurar el recordatorio.' }, { status: 403 }) };
  }
  return { ws };
}

async function estado(ws: number, cfg: ConfigRecordatorio): Promise<Record<string, unknown>> {
  // `null` = no se pudo leer: la tarjeta no afirma que el envío está apagado si no lo sabe.
  // ⚠️ Con el ESTRICTO: `envioWhatsappHabilitado` lee con `getSetting`, que se come el error y
  // devuelve «apagado», así que este `.catch` no corría nunca y un 5xx se dibujaba «No sale:
  // envío apagado» (revisión del #17).
  const envio = await runWithWorkspace(ws, () => envioWhatsappHabilitadoEstricto()).catch(() => null);
  return {
    activo: cfg.activo,
    envioWhatsapp: envio,
    toques: TOQUES.map((min) => ({
      min, texto: cfg.textos[min], porDefecto: !cfg.propios.includes(min), textoDefault: TEXTO_DEFAULT[min],
    })),
    variables: VARIABLES,
  };
}

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  try {
    return Response.json({ ok: true, ...(await estado(g.ws, await leerConfigRecordatorio(g.ws))) });
  } catch (e) {
    console.error(`[api:chat-agent/recordatorio-reunion GET] ${msg(e)}`);
    return Response.json({ ok: false, error: 'No pude leer el recordatorio.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if ('error' in g) return g.error;

  let body: { activo?: unknown; textos?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    const actual = await leerConfigRecordatorio(g.ws);
    const textos: Partial<Record<Toque, string>> = {};
    for (const min of TOQUES) textos[min] = actual.propios.includes(min) ? actual.textos[min] : '';

    if (body.textos != null) {
      if (typeof body.textos !== 'object') return Response.json({ ok: false, error: 'textos inválidos' }, { status: 400 });
      const entrantes = body.textos as Record<string, unknown>;
      for (const min of TOQUES) {
        const v = entrantes[String(min)];
        if (v === undefined) continue;
        if (typeof v !== 'string') return Response.json({ ok: false, error: 'textos inválidos' }, { status: 400 });
        if (v.trim().length > TOPE_TEXTO) {
          return Response.json({ ok: false, error: `Máximo ${TOPE_TEXTO} caracteres.` }, { status: 400 });
        }
        const malas = variablesDesconocidas(v);
        if (malas.length) {
          return Response.json({ ok: false, error: `No existe: ${malas.map((m) => `{{${m}}}`).join(', ')}` }, { status: 400 });
        }
        textos[min] = v;
      }
    }
    const activo = typeof body.activo === 'boolean' ? body.activo : actual.activo;

    await runWithWorkspace(g.ws, () => setSetting(KEY_RECORDATORIO, serializarConfig({ activo, textos })));
    return Response.json({ ok: true, ...(await estado(g.ws, await leerConfigRecordatorio(g.ws))) });
  } catch (e) {
    console.error(`[api:chat-agent/recordatorio-reunion POST] ${msg(e)}`);
    return Response.json({ ok: false, error: 'No se pudo guardar.' }, { status: 500 });
  }
}
