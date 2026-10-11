// =============================================================================
// /api/graficos/analisis — el «AI Analyst» del Dashboard: el último análisis de una hoja y su horario
// =============================================================================
// Pedido de Martín (11/10/2026), punto 23. El panel es app/dashboard/PanelAnalista.tsx; el trabajo,
// lib/graficos-analisis-server.ts; lo puro (serializar, sanear, el horario), lib/graficos-analisis.ts.
//
// Una ruta PROPIA y no una acción más de /api/graficos: aquélla corta a los 60 s y un análisis con la
// cascada de IA (esperas de 1,5 + 6 + 13,5 s y el modelo de respaldo) no entra. Acá el análisis corre
// por DETRÁS (`after()`), con el negocio capturado antes, y la pantalla consulta el avance.
//
// La puerta es la misma que la de /api/graficos y la de la página: admin del negocio y la tab en su
// capa. Sin eso, un closer leería por acá los números que su pantalla le esconde.
//
//   GET  ?hoja=<id>[&inicial=1]                → { vista, tzNegocio? }
//   GET                                       → { nuevos: hojaIds[] }   (el punto del botón)
//   POST { accion: 'analizar', hoja, ids?, vista? } → { estado: 'corriendo' | 'ocupado', vista?, mensaje? }
//   POST { accion: 'cancelar', hojaId }             → { cancelado }
//   POST { accion: 'programar', hojaId, cron|null, componentes? } → { vista }
//   POST { accion: 'visto', hojaId, analizadoAt }   → { ok }

import { NextResponse, after } from 'next/server';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { getUsuarioActual } from '@/lib/auth';
import { tableroActual } from '@/lib/tablero-actual';
import { rateLimit } from '@/lib/rate-limit';
import { tzDeWorkspace } from '@/lib/timezone';
import { TZ_TIJUANA } from '@/lib/date-utils';
import { MAX_COMPONENTES, sanearHoja, type VistaValores } from '@/lib/graficos-catalogo';
import {
  NoProgramable, analizarHoja, arrancarAMano, cancelarCorrida, hojasConNuevo, marcarVisto, programar, vistaDe,
} from '@/lib/graficos-analisis-server';

export const dynamic = 'force-dynamic';
// El análisis por detrás corre adentro de este mismo plazo (`after` usa el maxDuration de la ruta).
export const maxDuration = 300;

const err = (status: number, error: string) => NextResponse.json({ error }, { status });
const ID = /^[a-z0-9-]{1,40}$/i;

/** La puerta: admin del negocio, la tab en su capa, y una persona con su `sub` (la clave del informe). */
async function puerta(): Promise<{ ws: number; sub: string } | Response> {
  const rol = await getRolWsEfectivo();
  if (rol == null) return err(401, 'no autenticado');
  if (rol !== 'admin') return err(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('graphics', await getCapaActual())) return err(404, 'No existe');
  const s = await getUsuarioActual();
  const ws = await getWorkspaceActual();
  if (!s || ws == null) return err(401, 'no autenticado');
  return { ws, sub: s.sub };
}

/** Lo elegido mirando: por id de control, sólo objetos. El catálogo lo vuelve a sanear al usarlo (`conVista`). */
function sanearVista(raw: unknown): VistaValores {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: VistaValores = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 40)) {
    if (ID.test(k) && v && typeof v === 'object' && !Array.isArray(v)) out[k] = v as VistaValores[string];
  }
  return out;
}
const sanearIds = (raw: unknown): string[] | null =>
  (Array.isArray(raw) ? [...new Set(raw.map(String).filter((x) => ID.test(x)))].slice(0, MAX_COMPONENTES) : null);

export async function GET(req: Request) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const url = new URL(req.url);
  const hojaId = url.searchParams.get('hoja');
  try {
    if (!hojaId) return NextResponse.json({ nuevos: await hojasConNuevo(p.sub) });
    if (!ID.test(hojaId)) return err(400, 'Hoja inválida');
    const vista = await vistaDe(p.sub, hojaId);
    if (url.searchParams.get('inicial') !== '1') return NextResponse.json({ vista });
    // Sólo al abrir el panel: la zona (para decir «hora de …» antes de programar). Ya no se pregunta
    // si el negocio tiene IA: sin la suya va la red de plataforma (Martín, 11/10/2026: «siempre tiene
    // que probar con otros provedoores»), así que el botón no se apaga por eso.
    const tzNegocio = await tzDeWorkspace(p.ws).catch(() => TZ_TIJUANA);
    return NextResponse.json({ vista, tzNegocio });
  } catch (e) {
    console.error(`[analista] GET: ${e instanceof Error ? e.message : String(e)}`);
    return err(500, 'No pude leer el análisis');
  }
}

export async function POST(req: Request) {
  const p = await puerta();
  if (p instanceof Response) return p;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }

  try {
    if (body.accion === 'analizar') {
      const crudo = body.hoja as { id?: unknown } | undefined;
      // El id tiene que valer TAL CUAL: `sanearHoja` le inventaría uno nuevo a uno inválido, y la fila
      // quedaría colgada de una hoja que no existe.
      if (!crudo || typeof crudo.id !== 'string' || !ID.test(crudo.id)) return err(400, 'Hoja inválida');
      const hoja = sanearHoja(crudo, 0);
      if (!hoja) return err(400, 'Hoja inválida');
      if (!rateLimit(`analista:${p.ws}:${p.sub}`, 15, 60 * 60_000)) return err(429, 'Muchos análisis seguidos. Prueba en un rato.');
      // Sin IA propia del negocio también se intenta: después de sus keys va la red de plataforma
      // (lib/graficos-ia-red.ts; Martín, 11/10/2026: «siempre tiene que probar con otros provedoores»).
      const inicio = Date.now();
      const r = await arrancarAMano({
        usuario: p.sub, hoja, ids: sanearIds(body.ids), vista: sanearVista(body.vista),
        queTablero: await tableroActual(), hastaMs: inicio + 270_000,
      });
      if (!r.ok) return NextResponse.json({ estado: 'ocupado', vista: r.vista });
      // ⚠️ El negocio va ADENTRO del pedido (lo capturó `arrancarAMano`) y `analizarHoja` lo fija con
      // `runWithWorkspace`: lo que corre por detrás no depende de la pestaña.
      after(() => analizarHoja(r.pedido).catch((e) => console.error(`[analista] after: ${e instanceof Error ? e.message : String(e)}`)));
      return NextResponse.json({ estado: 'corriendo', vista: await vistaDe(p.sub, hoja.id) });
    }

    const hojaId = typeof body.hojaId === 'string' && ID.test(body.hojaId) ? body.hojaId : null;
    if (!hojaId) return err(400, 'Hoja inválida');

    if (body.accion === 'cancelar') return NextResponse.json({ cancelado: await cancelarCorrida(p.sub, hojaId) });

    if (body.accion === 'programar') {
      try {
        const vista = await programar({ usuario: p.sub, hojaId, cron: body.cron ?? null, componentes: sanearIds(body.componentes), queTablero: await tableroActual() });
        return NextResponse.json({ vista });
      } catch (e) {
        if (e instanceof NoProgramable) return err(400, e.message);
        throw e;
      }
    }

    if (body.accion === 'visto') {
      const analizadoAt = typeof body.analizadoAt === 'string' && Number.isFinite(Date.parse(body.analizadoAt)) ? body.analizadoAt : null;
      if (!analizadoAt) return err(400, 'Fecha inválida');
      await marcarVisto(p.sub, hojaId, analizadoAt);
      return NextResponse.json({ ok: true });
    }

    return err(400, 'Acción desconocida');
  } catch (e) {
    console.error(`[analista] POST ${String(body.accion)}: ${e instanceof Error ? e.message : String(e)}`);
    return err(500, 'No pude completar el pedido');
  }
}
