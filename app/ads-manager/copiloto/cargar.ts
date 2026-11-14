// =============================================================================
// Lo que lee el Marketing CoPilot, para la computadora (./page.tsx) y el teléfono (app/m/ads/page.tsx) — 14/11/2026
// =============================================================================
// Una sola carga para las dos: si cada página leyera por su lado, el teléfono mostraría otra cosa que la computadora (la memoria
// mismas-rutas: «las rutas deben ser las mismas, solo debe detectar si estoy en mobile»). Devuelve la ENTRADA (mientras el perfil
// no diga por dónde vende, o con ?entrada=1) o el CoPilot con sus datos. Lo que se lee de afuera va con tope de tiempo y lo que falla
// no tumba la pantalla (`callar`).
// =============================================================================

import 'server-only';
import { runWithWorkspace } from '@/lib/workspace';
import { canalMeta } from '@/lib/meta-via';
import { leerConfig, leerDecisiones, cupoDe } from '@/lib/media-buyer/store';
import { modoEfectivo } from '@/lib/media-buyer/plan';
import { vistaMediaBuyer } from '@/lib/media-buyer/vista';
import { leerPerfilCopiloto } from '@/lib/media-buyer/copiloto-store';
import { funnelElegido, tareasDeLaSemana } from '@/lib/media-buyer/copiloto';
import { leerComunicacion } from '@/lib/copiloto/comunicacion-store';
import { landingsDelWorkspace } from '@/lib/landing-config-leer';
import { conexionesViaZernio } from '@/lib/zernio-conectar';
import { leerPilotoRedes, numeroDelReel, pilotoRedesPermitido } from '@/lib/copiloto/piloto';
import { propuestasDelPiloto, ritmoConElPiloto } from '@/lib/copiloto/piloto-redes';
import { lunesDe } from '@/lib/copiloto/nevera-reglas';
import { getPlantilla } from '@/lib/plantillas';
import { retencionDeLanding } from '@/lib/landing-retencion-server';
import { resumenVsl } from '@/lib/copiloto/vsl';
import { periodoDeFechas } from '@/lib/landing-retencion';
import { verRetargeting } from '@/lib/retargeting';
import { paginasAnalizadas } from '@/lib/copiloto/web';
import { leerNevera, ritmoDelPerfil } from '@/lib/copiloto/nevera';
import { leerInstagramPropio, leerYoutubePropio } from '@/lib/copiloto/redes-propias';
import { puntosInstagram, puntosYoutube } from '@/lib/copiloto/redes-propias-reglas';
import { faltaLaEntrada, respuestasDesdeElPerfil, type RespuestasEntrada } from '@/lib/copiloto/entrada';
import type { DatosCoPilot, Tarjeta } from './CoPilot';
import type { ConexionesEntrada } from './Entrada';

export type PedidoCoPilot = { paso?: string; tarjeta?: string; sesion?: string; entrada?: string };
export type CargaCoPilot =
  | { entrada: { inicial: RespuestasEntrada; conexiones: ConexionesEntrada } }
  | { copilot: { datos: DatosCoPilot; paso: 'analisis' | 'accion' | 'piloto'; tarjeta: Tarjeta } };

const callar = <T,>(p: Promise<T>, def: T): Promise<T> => p.catch((e) => { console.warn('[copiloto]', e instanceof Error ? e.message : String(e)); return def; });
const conTope = <T,>(p: Promise<T>, ms: number): Promise<T | null> => Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);

export async function cargarCoPilot(ws: number, sp: PedidoCoPilot): Promise<CargaCoPilot> {
  const sesion = typeof sp.sesion === 'string' && /^\d{1,12}$/.test(sp.sesion) ? Number(sp.sesion) : null;
  const [comunicacion, config, dec, cupo, perfil, meta, landings, ig, yt, reel, retargeting, paginas, redesPermitidas] = await Promise.all([
    leerComunicacion(ws, sesion),
    callar(leerConfig(ws), null),
    callar(leerDecisiones(ws, 30), { decisiones: [], existeTabla: false }),
    callar(cupoDe(ws), null),
    callar(leerPerfilCopiloto(ws), {}),
    callar(canalMeta(ws), null),
    callar(runWithWorkspace(ws, () => landingsDelWorkspace()), []),
    callar(conexionesViaZernio(ws, 'instagram'), []),
    callar(conexionesViaZernio(ws, 'youtube'), []),
    // Con cuántas vistas se publica un reel de prueba: lo que propone Spy con los seguidos, o lo que eligió la persona.
    callar(numeroDelReel(ws), null),
    // El retargeting sin VSL (lib/retargeting.ts): lo que marcó MaKo en el CRM. Sólo se lee; lo que escribe lo dispara un botón.
    callar(verRetargeting(ws), null),
    // La web, como análisis: lo último que analizó el Landing Analyst (sólo se lee, no se vuelve a pagar la IA).
    callar(paginasAnalizadas(ws), []),
    // El piloto de Instagram y el de YouTube son de MaKo Pro (14/11/2026). Ante la duda, abierto: el servidor decide al guardar.
    callar(pilotoRedesPermitido(ws), true),
  ]);
  // La entrada (14/11, la maqueta que vio Julio): mientras el perfil no diga por dónde vende, o con ?entrada=1 para cambiarlo.
  if (faltaLaEntrada(perfil) || sp.entrada === '1') {
    const viva = (cs: Array<{ vencida?: boolean | null }>) => cs.some((c) => !c.vencida);
    return { entrada: { inicial: respuestasDesdeElPerfil(perfil), conexiones: { anuncios: !!meta && meta.via !== 'ninguna', instagram: viva(ig), youtube: viva(yt) } } };
  }
  const vista = config ? await callar(vistaMediaBuyer(ws, config.kpi, config.objetivo), null) : null;
  // El ritmo de la nevera: el del perfil y, encima, lo que configuró en el piloto de Instagram y YouTube (lib/copiloto/piloto-redes.ts).
  const ritmoBase = ritmoDelPerfil(perfil);
  const [pilotoRedes, plantillaNevera] = await Promise.all([
    callar(leerPilotoRedes(ws, ritmoBase), null),
    callar(runWithWorkspace(ws, () => getPlantilla('copiloto-nevera')), null),
  ]);
  const ritmo = pilotoRedes ? ritmoConElPiloto(ritmoBase, pilotoRedes) : ritmoBase;
  // La nevera de contenido: lo listo y lo publicado del Calendario, con ese ritmo (sólo se lee).
  const nevera = await callar(leerNevera(ws, perfil, ritmo), null);
  // La cuenta PROPIA (lib/copiloto/redes-propias.ts): Instagram por Zernio y Meta, YouTube por la Data API, con tope de tiempo.
  const igViva = ig.find((c) => !c.vencida), ytViva = yt.find((c) => !c.vencida);
  const urls = landings.map((l) => l.url);
  const [igPropio, ytPropio] = await Promise.all([
    igViva ? conTope(leerInstagramPropio(ws, igViva.usuario), 8000) : null,
    ytViva ? conTope(leerYoutubePropio(ytViva.usuario), 6000) : null,
  ]);
  // Lo que propone el piloto esta semana (una tarea por cosa): el reel más visto, el número del reel de prueba y los largos publicados.
  const reelTop = (igPropio?.publicaciones ?? []).filter((p) => p.tipo === 'reel' && p.vistas != null).sort((a, b) => (b.vistas ?? 0) - (a.vistas ?? 0))[0];
  const propuestas = pilotoRedes ? propuestasDelPiloto(pilotoRedes, {
    lunes: lunesDe(nevera?.hoy ?? new Date().toISOString().slice(0, 10)),
    reelTop: reelTop ? { vistas: reelTop.vistas ?? 0, url: reelTop.url } : null,
    numeroReel: reel?.numero ?? null,
    largosPublicados: nevera?.filas.find((x) => x.formato === 'video')?.publicadas30 ?? 0,
    instagram: !!igViva, youtube: !!ytViva,
  }) : [];
  // Su VSL: sólo si su campaña lleva uno. La curva del Pixel de la primera landing, de 30 días (como la API), con tope de tiempo.
  const conVsl = perfil.funnel === 'vsl-llamada' || !!perfil.campanas?.includes('vsl-llamada');
  const landingVsl = urls[0] ?? null;
  const periodo = periodoDeFechas({ dias: 30 }, Date.now()) as { desde: string; hasta: string };
  const retVsl = conVsl && landingVsl
    ? await conTope(runWithWorkspace(ws, () => retencionDeLanding({ url: landingVsl, desde: periodo.desde, hasta: periodo.hasta })), 6000)
    : null;
  const vsl = conVsl ? { landing: landingVsl, resumen: retVsl?.medido ? resumenVsl(retVsl.videos) : null } : undefined;
  const propias = {
    ...(igPropio ? { instagram: puntosInstagram(igPropio, { landings: urls, porSemana: ritmo ? ((ritmo.reel ?? 0) + (ritmo.post ?? 0)) || null : null, hoy: new Date() }) } : {}),
    ...(ytPropio ? { youtube: puntosYoutube(ytPropio, { landings: urls }) } : {}),
  };
  const f = funnelElegido(perfil);
  const datos: DatosCoPilot = {
    comunicacion,
    anuncios: {
      conectada: !!meta && meta.via !== 'ninguna',
      kpi: config?.kpi ?? 'lead',
      mejores: vista?.mejores ?? [],
      piloto: config ? { encendido: config.encendido, modo: cupo ? modoEfectivo(config.modo, cupo) : config.modo } : null,
      decisiones: dec.decisiones,
      existeTabla: dec.existeTabla,
    },
    tareas: tareasDeLaSemana(perfil),
    funnel: f ? f.nombre : null,
    reel,
    retargeting,
    web: landings.map((l) => l.url).slice(0, 6),
    paginas,
    nevera,
    propias,
    propuestas,
    ...(vsl ? { vsl } : {}),
    pilotoRedes: pilotoRedes ? { instagram: pilotoRedes.instagram, youtube: pilotoRedes.youtube, avisoNevera: plantillaNevera?.enabled ?? true } : null,
    redesPermitidas,
    redes: {
      instagram: ig.map((c) => ({ usuario: c.usuario, vencida: !!c.vencida })),
      youtube: yt.map((c) => ({ usuario: c.usuario, vencida: !!c.vencida })),
    },
  };
  const paso = sp.paso === 'accion' || sp.paso === 'piloto' ? sp.paso : 'analisis';
  const tarjeta: Tarjeta = (['oferta', 'web', 'anuncios', 'instagram', 'youtube'] as const).find((t) => t === sp.tarjeta) ?? 'oferta';
  return { copilot: { datos, paso, tarjeta } };
}
