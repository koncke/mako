// =============================================================================
// POST /api/ia-pc/mcp — las herramientas de MaKo para el Claude de la PC del cliente (MCP sobre HTTP, docs/ia-del-cliente.md §4)
// =============================================================================
// Es un RELEVO, no un segundo motor: `tools/list` devuelve las herramientas que viajaron en ESE turno, y `tools/call`
// deja la llamada en la base para que la corra el turno que está esperando (lib/mako-turno-app.ts), con su `runTool` de
// siempre: el gating de la vista de la persona, el memo anti-duplicado y las tarjetas. Las reglas viven en un solo lugar.
//
// Con el token del TURNO (`mkotn_`), que acuña el servidor cuando la PC toma el turno y que vence con él. Sin estado de
// sesión MCP: cada pedido trae su token. JSON-RPC 2.0, con lotes.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { pedirLlamada, turnoDelToken } from '@/lib/ia-pc';
import { bearer, herramientasParaMcp } from '@/lib/ia-pc-reglas';
import { limitePorClave } from '@/lib/limite-publico';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 90;

type Rpc = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
type Turno = NonNullable<Awaited<ReturnType<typeof turnoDelToken>>>;

const error = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const texto = (id: unknown, t: string, esError: boolean) => ({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: t }], isError: esError } });

async function atender(m: Rpc, t: Turno): Promise<Record<string, unknown> | null> {
  if (!m || typeof m !== 'object' || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return error(m?.id, -32600, 'pedido inválido');
  const esAviso = m.id === undefined || m.id === null;
  const params = (m.params && typeof m.params === 'object' ? m.params : {}) as Record<string, unknown>;
  switch (m.method) {
    case 'initialize':
      return {
        jsonrpc: '2.0', id: m.id,
        result: {
          protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : '2025-06-18',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'mako', version: '1.0.0' },
          instructions: 'Las herramientas de MaKo para este turno. Las acciones dejan una tarjeta que la persona confirma en la app.',
        },
      };
    case 'ping':
      return { jsonrpc: '2.0', id: m.id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id: m.id, result: { tools: herramientasParaMcp(t.tools) } };
    case 'tools/call': {
      const nombre = typeof params.name === 'string' ? params.name : '';
      const entrada = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Record<string, unknown>;
      // Lo que no viajó en este turno no corre, aunque el modelo lo pida (la misma regla que `runTool`).
      if (!t.tools.some((x) => x.name === nombre)) return texto(m.id, `«${nombre}» no está disponible en este turno.`, true);
      const r = await pedirLlamada(t.id, nombre, entrada);
      return r ? texto(m.id, r.salida, r.esError) : texto(m.id, 'El turno ya no espera: no se corrió.', true);
    }
    default:
      return esAviso ? null : error(m.id, -32601, `método desconocido: ${m.method}`);
  }
}

export async function POST(req: NextRequest) {
  const t = await turnoDelToken(bearer(req.headers.get('authorization'))).catch(() => null);
  if (!t) return NextResponse.json(error(null, -32001, 'token del turno inválido o vencido'), { status: 401 });
  // Por turno: un turno de 12 vueltas pide decenas de herramientas, no cientos.
  const frenado = limitePorClave('ia-pc-mcp', t.id, 120, 60_000);
  if (frenado) return frenado;
  let cuerpo: unknown;
  try { cuerpo = await req.json(); } catch { return NextResponse.json(error(null, -32700, 'JSON inválido'), { status: 400 }); }
  const lote = Array.isArray(cuerpo);
  const pedidos = (lote ? cuerpo : [cuerpo]) as Rpc[];
  const respuestas: Array<Record<string, unknown>> = [];
  for (const m of pedidos.slice(0, 20)) {
    const r = await atender(m, t);
    if (r) respuestas.push(r);
  }
  // Sólo avisos (`notifications/initialized`): 202 sin cuerpo, como pide MCP.
  if (!respuestas.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(lote ? respuestas : respuestas[0], { headers: { 'cache-control': 'no-store' } });
}

/** Sin flujo SSE: este servidor contesta cada pedido en su respuesta. */
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}
