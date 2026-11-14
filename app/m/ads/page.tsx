// =============================================================================
// /m/ads — el Media Buyer en el teléfono (25/10/2026)
// =============================================================================
// Desde el 25/10 a la noche, la captura 04 de AdAmigo como la computadora: el mismo árbol de cambios, en una columna
// (MediaBuyerM.tsx).
// Reemplaza al Ads Manager del teléfono (período, resumen y campañas), que se borró con el de la computadora.
//
// 14/11/2026: lo que abre el menú es el Marketing CoPilot NUEVO, como en la computadora (app/ads-manager/copiloto): la entrada, los
// dos pasos o «Configurar el piloto» (`?configurar=1`, que pone el desvío para /ads-manager/copiloto/configurar). Con la misma
// carga que la computadora (./cargar.ts de cada una). La charla vieja (`?estrategia=1`) y este Media Buyer (`?mb=1`)
// siguen abriendo como antes. (`mb` y no `vista`: `?vista=` es del Media Buyer de escritorio y no viaja.)
//
// Quién: la regla del Sidebar para `ads-manager` (el admin del negocio). Quién LANZA: el mismo guard de escritorio
// (`wsDeAdsManager`), y sólo si el negocio con el que escribiría es el que se está mirando.
// =============================================================================

import { requireMovil } from '@/lib/movil-guard';
import { wsDeAdsManager } from '@/lib/ads-guard';
import { credWs } from '@/lib/credenciales';
import { PantallaM, VacioM } from '@/app/m/_ui';
import { leerConfig, leerDecisiones, cupoDe } from '@/lib/media-buyer/store';
import { vistaMediaBuyer } from '@/lib/media-buyer/vista';
import { modoEfectivo } from '@/lib/media-buyer/plan';
import { leerPerfilCopiloto } from '@/lib/media-buyer/copiloto-store';
import { copilotoListo, conCampanas, funnelElegido } from '@/lib/media-buyer/copiloto';
import { getUsuarioActual } from '@/lib/auth';
import { PrimeraEntrada } from '@/app/ads-manager/PrimeraEntrada';
import { SinAnunciosM } from './SinAnunciosM';
import { MediaBuyerM } from './MediaBuyerM';
import { CoPilot } from '@/app/ads-manager/copiloto/CoPilot';
import { Entrada } from '@/app/ads-manager/copiloto/Entrada';
import { cargarCoPilot } from '@/app/ads-manager/copiloto/cargar';
import { ConfigurarPiloto } from '@/app/ads-manager/copiloto/configurar/ConfigurarPiloto';
import { cargarConfigurar } from '@/app/ads-manager/copiloto/configurar/cargar';
import '@/app/ads-manager/aa.css';
import './mb-m.css';

export const dynamic = 'force-dynamic';

type Pedido = Partial<Record<'estrategia' | 'paso' | 'tarjeta' | 'entrada' | 'configurar' | 'red' | 'mb' | 'sesion', string | string[]>>;
const uno = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export default async function MediaBuyerMovil({ searchParams }: { searchParams: Promise<Pedido> }) {
  const ctx = await requireMovil({ navKey: 'ads-manager' });
  // `?estrategia=1` («Cambiar mi estrategia» del Plan y de Ajustes): vuelve a la charla con lo ya respondido, como la computadora.
  // Llega porque el desvío al teléfono la deja viajar (lib/movil-rutas.ts → QUERY_DE_SECCION.ads).
  const sp = await searchParams;
  const reabrir = (Array.isArray(sp.estrategia) ? sp.estrategia[0] : sp.estrategia) === '1';
  if (ctx.ws == null) return <PantallaM><VacioM frase="Elige un negocio para ver su Media Buyer." /></PantallaM>;
  // El CoPilot nuevo: sin la charla vieja pedida ni el Media Buyer pedido.
  if (!reabrir && uno(sp.mb) !== '1') {
    if (uno(sp.configurar) === '1') return <PantallaM><ConfigurarPiloto {...await cargarConfigurar(ctx.ws, uno(sp.red))} /></PantallaM>;
    const c = await cargarCoPilot(ctx.ws, { paso: uno(sp.paso), tarjeta: uno(sp.tarjeta), entrada: uno(sp.entrada), sesion: uno(sp.sesion) });
    return (
      <PantallaM>
        {'entrada' in c
          ? <Entrada inicial={c.entrada.inicial} conexiones={c.entrada.conexiones} />
          : <CoPilot datos={c.copilot.datos} pasoInicial={c.copilot.paso} tarjetaInicial={c.copilot.tarjeta} enTelefono />}
      </PantallaM>
    );
  }
  const [op, guardada, dec, cupo, token, perfil, yo] = await Promise.all([
    wsDeAdsManager(), leerConfig(ctx.ws), leerDecisiones(ctx.ws, 30), cupoDe(ctx.ws),
    credWs('META_ACCESS_TOKEN', ctx.ws).catch(() => null),
    leerPerfilCopiloto(ctx.ws), getUsuarioActual().catch(() => null),
  ]);
  // La primera entrada, igual que en la computadora (app/ads-manager/page.tsx): sólo para quien nunca trabajó con el Media Buyer.
  // La misma regla que la computadora (app/ads-manager/page.tsx): una cuenta medida vacía tampoco «operaba».
  const nuncaOpero = !guardada.encendido && !guardada.ultimaCorrida && dec.decisiones.length === 0;
  const cuentaVacia = guardada.ultimaCorridaInfo?.campanas === 0;
  if (reabrir || (!copilotoListo(perfil) && (nuncaOpero || cuentaVacia))) {
    return <PantallaM><PrimeraEntrada nombre={(yo?.nombre ?? '').trim().split(/\s+/)[0] || 'equipo'} inicial={perfil} /></PantallaM>;
  }
  const config = { ...guardada, modo: modoEfectivo(guardada.modo, cupo) };
  const vista = await vistaMediaBuyer(ctx.ws, config.kpi, config.objetivo).catch(() => null);
  // Un funnel sin anuncios: Esta semana · Plan · Qué medir, como en la computadora.
  const elegido = funnelElegido(perfil);
  if (elegido && copilotoListo(perfil) && !conCampanas(elegido.id, perfil.presupuestoMes)) return <PantallaM><SinAnunciosM perfil={perfil} /></PantallaM>;
  const puedeOperar = typeof op === 'number' && op === ctx.ws;
  // Con token, la cuenta está conectada. SIN token no se concluye nada: puede estar conectada por Zernio, y preguntárselo
  // sería una llamada a Zernio al abrir la pantalla del teléfono. Con `null`, el cartel de Hoy no afirma que falte la cuenta
  // (lo dice la última corrida, si dejó `estado: 'sin_cuenta'`).
  return (
    <PantallaM>
      <MediaBuyerM config={config} decisiones={dec.decisiones} puedeOperar={puedeOperar} productoDe={vista?.productoDe ?? {}}
        conectada={token ? true : null} perfil={perfil} />
    </PantallaM>
  );
}
