// =============================================================================
// /ads-manager/copiloto — el Marketing CoPilot nuevo: los tres pasos sobre las cinco tarjetas (12/11/2026)
// =============================================================================
// Martín (12/11, mirando la vuelta 18): «evidentemente que esté todo preparado para que en producción funcione, no solamente el
// frontend, sino que el backend se conecte perfecto con todo y que funcione realmente. Que el piloto automático funcione». Es la
// maqueta (docs/marketing-copilot/rediseno/maqueta-diecinueve.html) con los datos de verdad del negocio:
//   · Oferta y comunicación: las piezas de Offer, y Ángulos y Tu voz (lib/copiloto/comunicacion*.ts);
//   · Anuncios: los anuncios que más resultados trajeron, las tareas de la semana de su funnel y el piloto del Media Buyer (sus
//     decisiones de verdad: aprobar, «No» y deshacer, por /api/media-buyer);
//   · Web, Instagram y YouTube: si están conectados y a dónde se trabajan hoy (su análisis propio llega después: el relevo lo lista).
// Va al lado de /ads-manager (que sigue siendo la pantalla del Media Buyer de siempre) hasta que Martín lo mire: un cliente que
// hoy opera sus campañas no cambia de pantalla de un día para el otro. La misma puerta que /ads-manager.
// =============================================================================

import '../aa.css';
import { requireRolWs } from '@/lib/tab-access';
import { adsSinNegocio, wsDeAdsManager } from '@/lib/ads-guard';
import { Pagina } from '@/app/_ui/Pagina';
import { EmptyState, PermissionState } from '@/app/_ui/Estados';
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
import { numeroDelReel } from '@/lib/copiloto/piloto';
import { verRetargeting } from '@/lib/retargeting';
import { paginasAnalizadas } from '@/lib/copiloto/web';
import { leerNevera } from '@/lib/copiloto/nevera';
import { CoPilot, type DatosCoPilot } from './CoPilot';
import { Entrada } from './Entrada';
import { faltaLaEntrada, respuestasDesdeElPerfil } from '@/lib/copiloto/entrada';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const callar = <T,>(p: Promise<T>, def: T): Promise<T> => p.catch((e) => { console.warn('[copiloto]', e instanceof Error ? e.message : String(e)); return def; });

export default async function CoPilotPage({ searchParams }: { searchParams: Promise<{ paso?: string; tarjeta?: string; sesion?: string; entrada?: string }> }) {
  await requireRolWs([], { nav: 'ads-manager' });
  if (await adsSinNegocio()) {
    return <Pagina><EmptyState titulo="Elige un negocio" detalle="El Marketing CoPilot trabaja sobre un negocio. Entra a uno desde el panel y vuelve aquí." accion={{ label: 'Ir al panel', href: '/admin' }} /></Pagina>;
  }
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return <Pagina><PermissionState motivo="rol" /></Pagina>;
  const sp = await searchParams;
  const sesion = typeof sp.sesion === 'string' && /^\d{1,12}$/.test(sp.sesion) ? Number(sp.sesion) : null;

  const [comunicacion, config, dec, cupo, perfil, meta, landings, ig, yt, reel, retargeting, paginas] = await Promise.all([
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
  ]);
  // La entrada (14/11, la maqueta que vio Julio): mientras el perfil no diga por dónde vende, o con ?entrada=1 para cambiarlo.
  if (faltaLaEntrada(perfil) || sp.entrada === '1') {
    const viva = (cs: Array<{ vencida?: boolean | null }>) => cs.some((c) => !c.vencida);
    return (
      <Pagina ancho="completo" style={{ padding: 0 }}>
        <Entrada inicial={respuestasDesdeElPerfil(perfil)} conexiones={{ anuncios: !!meta && meta.via !== 'ninguna', instagram: viva(ig), youtube: viva(yt) }} />
      </Pagina>
    );
  }
  const vista = config ? await callar(vistaMediaBuyer(ws, config.kpi, config.objetivo), null) : null;
  // La nevera de contenido: lo listo y lo publicado del Calendario, con el ritmo que respondió en el CoPilot (sólo se lee).
  const nevera = await callar(leerNevera(ws, perfil), null);
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
    redes: {
      instagram: ig.map((c) => ({ usuario: c.usuario, vencida: !!c.vencida })),
      youtube: yt.map((c) => ({ usuario: c.usuario, vencida: !!c.vencida })),
    },
  };
  const paso = sp.paso === 'accion' || sp.paso === 'piloto' ? sp.paso : 'analisis';
  const tarjeta = ['oferta', 'web', 'anuncios', 'instagram', 'youtube'].includes(sp.tarjeta ?? '') ? sp.tarjeta as never : 'oferta';
  return (
    <Pagina ancho="completo" style={{ padding: 0 }}>
      <CoPilot datos={datos} pasoInicial={paso} tarjetaInicial={tarjeta} />
    </Pagina>
  );
}
