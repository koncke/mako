// =============================================================================
// /api/media-buyer — lo que hace la pantalla del Media Buyer (/ads-manager)
// =============================================================================
// GET  → el estado: la configuración, las decisiones de 30 días y si la cuenta está conectada.
// POST → { op, … }:
//   lanzar { id, presupuesto?, elegidas? } · descartar { id, motivo? } · reabrir { id } · deshacer { id }
//   calificar { id, estrellas } · config { cambio } · analizar · estado_zernio
//   subir_preparar { adSetId? } (los conjuntos y los textos de partida) · subir_creativos { adSetId, archivos, textos, activo }
// El botón de conectar Facebook NO está acá: es la pieza única `<ConectarViaZernio red="metaads">` (AGENTS.md).
//
// QUIÉN: el admin DEL negocio (o el super admin mirándolo), el mismo guard que tenían las escrituras del Ads Manager
// (`wsDeAdsManager`, lib/ads-guard.ts). El negocio sale del pedido, NUNCA del body: un id del body es un IDOR con la
// cuenta publicitaria de otro cliente del otro lado. Y una decisión se busca SIEMPRE con su `workspace_id`.
// =============================================================================

import type { NextRequest } from 'next/server';
import { wsDeAdsManager } from '@/lib/ads-guard';
import { getUsuarioActual } from '@/lib/auth';
import { leerConfig, guardarConfig, leerDecisiones, reclamar, actualizar, MediaBuyerSinTabla } from '@/lib/media-buyer/store';
import { lanzar, deshacer } from '@/lib/media-buyer/ejecutar';
import { analizarCuenta } from '@/lib/media-buyer/corrida';
import { cuentaDelNegocio, leerDatosCuenta, SinCuentaParaOperar } from '@/lib/media-buyer/datos';
import { conjuntosDe, plantillaDelConjunto, subirCreativos } from '@/lib/media-buyer/subir';
import { CTAS } from '@/lib/media-buyer/creativos';
import { marcarPasoTab } from '@/lib/tab-onboarding-state';
import { credWs } from '@/lib/credenciales';
import { claveZernioAnuncios, conexionAnunciosZernio, leerErrorDeZernio } from '@/lib/zernio-ads';

export const dynamic = 'force-dynamic';
// 300: subir un video lo baja Zernio, lo sube a Meta y espera que lo procese antes de contestar.
export const maxDuration = 300;

const J = (x: unknown, status = 200) => Response.json(x, { status });
const uuid = (x: unknown): string | null => (typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x) ? x : null);

export async function GET() {
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return ws;
  try {
    const [config, { decisiones, existeTabla }] = await Promise.all([leerConfig(ws), leerDecisiones(ws, 30)]);
    return J({ ok: true, config, decisiones, existeTabla });
  } catch (e) {
    return J({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

export async function POST(req: NextRequest) {
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return ws;
  const yo = await getUsuarioActual().catch(() => null);
  const quien = yo?.nombre?.trim() || yo?.email || 'Alguien del equipo';
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return J({ ok: false, error: 'Pedido inválido.' }, 400); }
  const op = String(body.op ?? '');

  try {
    switch (op) {
      case 'lanzar': {
        const id = uuid(body.id);
        if (!id) return J({ ok: false, error: 'Falta la decisión.' }, 400);
        const presupuesto = body.presupuesto == null ? undefined : Number(body.presupuesto);
        const elegidas = Array.isArray(body.elegidas) ? body.elegidas.filter((x): x is string => typeof x === 'string').slice(0, 20) : undefined;
        const r = await lanzar(ws, id, { nombre: quien, origen: 'persona' }, { presupuesto, elegidas });
        return J(r, r.ok ? 200 : 409);
      }
      case 'deshacer': {
        const id = uuid(body.id);
        if (!id) return J({ ok: false, error: 'Falta la decisión.' }, 400);
        const r = await deshacer(ws, id, quien);
        return J(r, r.ok ? 200 : 409);
      }
      case 'descartar': {
        const id = uuid(body.id);
        if (!id) return J({ ok: false, error: 'Falta la decisión.' }, 400);
        const motivo = typeof body.motivo === 'string' ? body.motivo.trim().slice(0, 500) : null;
        const d = await reclamar(ws, id, ['abierta', 'fallida', 'bloqueada'], { estado: 'descartada', motivo_descarte: motivo });
        return d ? J({ ok: true, decision: d }) : J({ ok: false, error: 'Esa decisión ya no está abierta.' }, 409);
      }
      case 'reabrir': {
        const id = uuid(body.id);
        if (!id) return J({ ok: false, error: 'Falta la decisión.' }, 400);
        const d = await reclamar(ws, id, ['descartada', 'vencida'], { estado: 'abierta', motivo_descarte: null, creada: new Date().toISOString() });
        return d ? J({ ok: true, decision: d }) : J({ ok: false, error: 'Sólo se vuelve a abrir una descartada o vencida.' }, 409);
      }
      case 'calificar': {
        const id = uuid(body.id);
        const n = Number(body.estrellas);
        if (!id || !Number.isInteger(n) || n < 1 || n > 5) return J({ ok: false, error: 'Calificación inválida.' }, 400);
        await actualizar(ws, id, { estrellas: n });
        return J({ ok: true });
      }
      case 'config': {
        const cambio = (body.cambio ?? {}) as Record<string, unknown>;
        const config = await guardarConfig(ws, cambio, quien);
        // El onboarding de la tab (lib/tab-onboarding-catalogo.ts → 'ads-manager'): elegir el resultado y prenderlo son sus
        // pasos 2 y 3. Best-effort y en orden: si el paso anterior no está, marcarPasoTab se niega y no pasa nada.
        if (cambio.kpi !== undefined) await marcarPasoTab('ads-manager', 'am_resultado').catch(() => null);
        if (cambio.encendido === true) await marcarPasoTab('ads-manager', 'am_prender').catch(() => null);
        return J({ ok: true, config });
      }
      case 'analizar': {
        const r = await analizarCuenta(ws, { quien });
        return J({ ok: r.estado === 'ok', resumen: r, error: r.estado === 'ok' ? undefined : r.mensaje ?? r.estado });
      }
      case 'estado_zernio': {
        const tieneClave = !!(await claveZernioAnuncios(ws));
        const act = await cuentaDelNegocio(ws);
        const conexion = tieneClave ? await conexionAnunciosZernio(ws, act).catch(() => null) : null;
        // Paso 1 del onboarding: la cuenta conectada (por Zernio o por el token de Meta del negocio).
        if (conexion || (await credWs('META_ACCESS_TOKEN', ws))) await marcarPasoTab('ads-manager', 'am_cuenta').catch(() => null);
        return J({ ok: true, tieneClave, cuenta: act, conectado: !!conexion });
      }
      case 'subir_preparar': {
        const datos = await leerDatosCuenta(ws);
        const conjuntos = conjuntosDe(datos);
        const adSetId = typeof body.adSetId === 'string' && /^\d{1,30}$/.test(body.adSetId) ? body.adSetId : null;
        const plantilla = adSetId ? await plantillaDelConjunto(ws, datos, adSetId) : null;
        return J({ ok: true, conjuntos, plantilla, conectado: !!datos.conexion });
      }
      case 'subir_creativos': {
        const adSetId = typeof body.adSetId === 'string' && /^\d{1,30}$/.test(body.adSetId) ? body.adSetId : null;
        if (!adSetId) return J({ ok: false, error: 'Elige el conjunto.' }, 400);
        const archivos = (Array.isArray(body.archivos) ? body.archivos : []).map((a) => {
          const o = (a ?? {}) as Record<string, unknown>;
          return { path: String(o.path ?? ''), tipo: o.tipo === 'video' ? 'video' as const : 'image' as const, nombre: String(o.nombre ?? 'creativo').slice(0, 120) };
        });
        const t = (body.textos ?? {}) as Record<string, unknown>;
        const textos = {
          textoPrincipal: String(t.textoPrincipal ?? ''), titulo: String(t.titulo ?? ''),
          cta: (CTAS as readonly string[]).includes(String(t.cta)) ? (t.cta as (typeof CTAS)[number]) : 'LEARN_MORE',
          link: typeof t.link === 'string' && t.link.trim() ? t.link.trim() : null,
          formularioId: typeof t.formularioId === 'string' && /^\d{1,30}$/.test(t.formularioId) ? t.formularioId : null,
        };
        const r = await subirCreativos(ws, { adSetId, archivos, textos, activo: body.activo !== false }, quien);
        return J(r, r.ok ? 200 : 409);
      }
      default:
        return J({ ok: false, error: 'Operación desconocida.' }, 400);
    }
  } catch (e) {
    if (e instanceof MediaBuyerSinTabla) return J({ ok: false, error: e.message }, 503);
    if (e instanceof SinCuentaParaOperar) return J({ ok: false, error: e.message }, 409);
    const z = leerErrorDeZernio(e);
    return J({ ok: false, error: z ? `Zernio: ${z.mensaje}` : e instanceof Error ? e.message : String(e) }, 500);
  }
}
