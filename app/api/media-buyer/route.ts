// =============================================================================
// /api/media-buyer — lo que hace la pantalla del Media Buyer (/ads-manager)
// =============================================================================
// GET  → el estado: la configuración, las decisiones de 30 días y si la cuenta está conectada.
// POST → { op, … }:
//   lanzar { id, presupuesto?, elegidas?, confirmarBaja? } · descartar { id, motivo? } · reabrir { id } · deshacer { id }
//   calificar { id, estrellas } · config { cambio } · analizar · estado_zernio
//   hooks_a_video { id, elegidas? } (los hooks de un video ganador, como guiones del Video Generator)
//   subir_preparar { adSetId? } (los conjuntos y los textos de partida) · subir_creativos { adSetId, archivos, textos, activo }
//   arranque { respuestas } (lo respondido en la charla del arranque, para seguir donde quedó) · lienzo (Campañas, por producto)
//   agente { agente } (crea o cambia un agente propio) · agente_borrar { agenteId }
//   lugares { q } (buscar países, provincias y ciudades de Meta: la zona y Nueva campaña) · hasta_campana { campaignId, fecha }
//   nueva_preparar (lo que pide «Nueva campaña»: formularios, píxeles, anuncios, la zona, la fecha y la moneda) ·
//   crear_campana { entrada } (lanza la campaña por la Zernio del negocio: lib/media-buyer/campana.ts)
// El botón de conectar Facebook NO está acá: es la pieza única `<ConectarViaZernio red="metaads">` (AGENTS.md).
//
// QUIÉN: el admin DEL negocio (o el super admin mirándolo), el mismo guard que tenían las escrituras del Ads Manager
// (`wsDeAdsManager`, lib/ads-guard.ts). El negocio sale del pedido, NUNCA del body: un id del body es un IDOR con la
// cuenta publicitaria de otro cliente del otro lado. Y una decisión se busca SIEMPRE con su `workspace_id`.
// =============================================================================

import type { NextRequest } from 'next/server';
import { wsDeAdsManager } from '@/lib/ads-guard';
import { getUsuarioActual } from '@/lib/auth';
import { leerConfig, guardarConfig, leerDecisiones, leerDecision, reclamar, actualizar, MediaBuyerSinTabla, MediaBuyerSinZona, PlanSinPiloto, cupoDe } from '@/lib/media-buyer/store';
import { crearCampana, datosParaNuevaCampana, prepararCampana } from '@/lib/media-buyer/campana';
import { runWithWorkspace } from '@/lib/workspace';
import { searchLugares } from '@/lib/meta-ads-create';
import { modoEfectivo } from '@/lib/media-buyer/plan';
import { RUTA_CAMBIAR_PLAN } from '@/lib/topes-plan';
import { llevarHooksAlVideo } from '@/lib/media-buyer/hooks-video';
import { guardarRespuestasArranque, lienzoMediaBuyer } from '@/lib/media-buyer/vista';
import { borrarAgentePropio, guardarAgentePropio } from '@/lib/media-buyer/agentes-ia';
import { sanearRespuestas } from '@/lib/media-buyer/arranque';
import { sanearPerfil } from '@/lib/media-buyer/copiloto';
import { guardarPerfilCopiloto, leerPerfilCopilotoEstricto } from '@/lib/media-buyer/copiloto-store';
import { lanzar, deshacer } from '@/lib/media-buyer/ejecutar';
import { analizarCuenta } from '@/lib/media-buyer/corrida';
import { cuentaDelNegocio, leerDatosCuenta, SinCuentaParaOperar } from '@/lib/media-buyer/datos';
import { conjuntosDe, generadosDelNegocio, plantillaDelConjunto, subirCreativos } from '@/lib/media-buyer/subir';
import { leerPedidoDeSubida } from '@/lib/media-buyer/creativos';
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
    const [config, { decisiones, existeTabla }, cupo] = await Promise.all([leerConfig(ws), leerDecisiones(ws, 30), cupoDe(ws)]);
    // El modo que VALE: con un plan sin piloto, la pantalla nunca lo muestra prendido (plan.ts → modoEfectivo).
    return J({ ok: true, config: { ...config, modo: modoEfectivo(config.modo, cupo) }, cupo, decisiones, existeTabla });
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
        // `confirmarBaja`: la persona ya vio «Bajarlo de X a Y es N% menos» y dijo que sí (monto.ts → revisarMontoEditado).
        const r = await lanzar(ws, id, { nombre: quien, origen: 'persona' }, { presupuesto, elegidas, bajaConfirmada: body.confirmarBaja === true });
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
      case 'hooks_a_video': {
        // Los hooks elegidos de una decisión de video, como guiones en el Video Generator (se filma sólo el gancho).
        const id = uuid(body.id);
        const d = id ? await leerDecision(ws, id) : null;
        if (!d) return J({ ok: false, error: 'Esa decisión no existe en este negocio.' }, 404);
        const elegidas = Array.isArray(body.elegidas) ? new Set(body.elegidas.filter((x): x is string => typeof x === 'string')) : null;
        const conElegidas = elegidas ? { ...d, variaciones: (d.variaciones ?? []).map((v) => ({ ...v, elegida: elegidas.has(v.id) })) } : d;
        const r = await llevarHooksAlVideo(ws, conElegidas);
        return J(r, r.ok ? 200 : 409);
      }
      case 'subir_preparar': {
        const datos = await leerDatosCuenta(ws);
        const conjuntos = conjuntosDe(datos);
        const adSetId = typeof body.adSetId === 'string' && /^\d{1,30}$/.test(body.adSetId) ? body.adSetId : null;
        const plantilla = adSetId ? await plantillaDelConjunto(ws, datos, adSetId) : null;
        // Los videos que MaKo ya generó (AI Avatar, Video Generator): se suben por su `ref`, sin bajarlos del disco. Si no se
        // pudieron leer, la lista viene vacía con su aviso: subir del disco sigue andando.
        let generados: Awaited<ReturnType<typeof generadosDelNegocio>> = [];
        let avisoGenerados: string | null = null;
        try { generados = await generadosDelNegocio(ws); } catch (e) { avisoGenerados = `No pude leer tus videos de MaKo: ${e instanceof Error ? e.message : String(e)}`; }
        return J({ ok: true, conjuntos, plantilla, conectado: !!datos.conexion, generados, avisoGenerados });
      }
      case 'copiloto': {
        // La primera entrada del Marketing CoPilot (6/11/2026): lo que respondió, por negocio. Sólo lo conocido, con su forma.
        await guardarPerfilCopiloto(ws, sanearPerfil(body.perfil));
        return J({ ok: true });
      }
      case 'copiloto_leer': {
        // Lo guardado, después de un turno de MaKo en la charla (6/11/2026): si guardó el funnel que acordaron
        // (copiloto_media_buyer), la charla de la pantalla lo muestra.
        return J({ ok: true, perfil: await leerPerfilCopilotoEstricto(ws) });
      }
      case 'arranque': {
        await guardarRespuestasArranque(ws, sanearRespuestas(body.respuestas));
        return J({ ok: true });
      }
      case 'agente': {
        const r = await guardarAgentePropio(ws, body.agente);
        return J(r, r.ok ? 200 : 400);
      }
      case 'agente_borrar': {
        const id = typeof body.agenteId === 'string' ? body.agenteId : '';
        const r = await borrarAgentePropio(ws, id);
        return J(r, r.ok ? 200 : 409);
      }
      case 'lienzo': {
        // La pestaña Campañas: la cuenta en vivo, por producto (lib/media-buyer/vista.ts → lienzoMediaBuyer).
        const config = await leerConfig(ws);
        try {
          return J({ ok: true, ...(await lienzoMediaBuyer(ws, config.kpi, config.objetivo)) });
        } catch (e) {
          if (e instanceof SinCuentaParaOperar) return J({ ok: false, error: e.message, sinCuenta: true }, 409);
          throw e;
        }
      }
      case 'campanas': {
        // Las campañas de la cuenta, para elegir qué cubre cada táctica (Automatizaciones: el «Applies to» de Madgicx).
        const datos = await leerDatosCuenta(ws);
        const campanas = datos.arbol.filter((n) => n.nivel === 'campaign')
          .map((n) => ({ id: n.id, nombre: n.nombre, prendida: n.configurado === 'ACTIVE' }))
          .sort((x, y) => Number(y.prendida) - Number(x.prendida) || x.nombre.localeCompare(y.nombre));
        return J({ ok: true, campanas });
      }
      case 'lugares': {
        // La misma búsqueda de `buscar_lugares_meta` (lib/meta-ads-create.ts → searchLugares), en el negocio del pedido.
        const q = typeof body.q === 'string' ? body.q.trim().slice(0, 80) : '';
        if (q.length < 2) return J({ ok: true, lugares: [] });
        const lugares = await runWithWorkspace(ws, () => searchLugares(q, null));
        return J({ ok: true, lugares });
      }
      case 'hasta_campana': {
        // La fecha de fin de UNA campaña (la hoja de Campañas). Vacía = sin fecha propia (vale la de toda la cuenta).
        const campaignId = typeof body.campaignId === 'string' ? body.campaignId : '';
        const fecha = typeof body.fecha === 'string' && body.fecha ? body.fecha : null;
        const config = await guardarConfig(ws, { hastaCampana: { campanaId: campaignId, fecha } }, quien);
        return J({ ok: true, hastaCampanas: config.hastaCampanas, hasta: config.hasta });
      }
      case 'nueva_preparar': {
        // Lo que pide «Nueva campaña» para armarse (lib/media-buyer/campana.ts → datosParaNuevaCampana: la MISMA lectura que
        // usa «Usar en un anuncio» de los editores).
        return J({ ok: true, ...(await datosParaNuevaCampana(ws)) });
      }
      case 'crear_campana': {
        const entrada = (body.entrada ?? {}) as Record<string, unknown>;
        if (body.soloRevisar === true) {
          // El cartel de confirmación muestra lo que va a salir, validado contra la cuenta, antes del «Lanzar».
          const p = await prepararCampana(ws, entrada);
          return J(p.ok ? { ok: true, resumen: p.resumen, hasta: p.hasta, moneda: p.moneda } : p, p.ok ? 200 : 409);
        }
        const r = await crearCampana(ws, entrada, quien);
        return J(r, r.ok ? 200 : 409);
      }
      case 'subir_creativos': {
        // El pedido se lee como lo lee la API de MaKo (lib/media-buyer/creativos.ts → leerPedidoDeSubida).
        const { adSetId, archivos, textos, activo, original } = leerPedidoDeSubida(body);
        if (!adSetId) return J({ ok: false, error: 'Elige el conjunto.' }, 400);
        const r = await subirCreativos(ws, { adSetId, archivos, textos, activo, original }, quien);
        return J(r, r.ok ? 200 : 409);
      }
      default:
        return J({ ok: false, error: 'Operación desconocida.' }, 400);
    }
  } catch (e) {
    if (e instanceof MediaBuyerSinTabla || e instanceof MediaBuyerSinZona) return J({ ok: false, error: e.message }, 503);
    if (e instanceof PlanSinPiloto) return J({ ok: false, error: e.message, tope: true, link: RUTA_CAMBIAR_PLAN }, 403);
    if (e instanceof SinCuentaParaOperar) return J({ ok: false, error: e.message, sinCuenta: true }, 409);
    const z = leerErrorDeZernio(e);
    return J({ ok: false, error: z ? `Zernio: ${z.mensaje}` : e instanceof Error ? e.message : String(e) }, 500);
  }
}
