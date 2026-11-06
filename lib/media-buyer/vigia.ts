// =============================================================================
// Media Buyer — el VIGÍA DEL DÍA: cada dos horas, lo que no puede esperar a la corrida de mañana
// =============================================================================
// Dos cosas, nada más (la corrida diaria sigue siendo la que propone, sube y escribe variaciones: corrida.ts):
//   1. HASTA: la campaña que pasó su fecha de fin se pausa (zona.ts → pausasPorFecha). Sin esto, «hasta el 5» pausaba el 6 a
//      las 14:30 UTC: un día y medio de gasto de más. Va por el canal del negocio (Zernio, o su token de respaldo).
//   2. EL STOP LOSS DEL DÍA (del-dia.ts): el anuncio que hoy se está quemando sin resultados. Necesita el gasto de HOY, que
//      sólo da Zernio (`/ads/tree` con hoy): el cron de Meta trae el día de ayer. Un negocio sólo con el token de Meta (deprecado
//      desde el 25/10) no tiene Stop Loss del día, y el vigía lo dice.
// Lanza con `lanzar` (ejecutar.ts): la misma lectura en vivo, el mismo reclamo y el mismo Deshacer que todo lo demás. La pausa
// por fecha sale sola siempre (es la regla de la persona); el Stop Loss del día, sólo si la táctica está en automático.
// =============================================================================

import 'server-only';
import { getTenantDb, runWithWorkspace } from '@/lib/workspace';
import { leerTodo } from '@/lib/supabase-paginado';
import { hoyEnTijuana, hoyEnTz } from '@/lib/date-utils';
import { arbolPorZernio } from '@/lib/zernio-ads';
import { adIdDeLead } from '@/lib/atribucion-url';
import { crearNotificacion } from '@/lib/notificaciones';
import { leerConfig, leerDecisiones, guardarPropuestas, cupoDe } from './store';
import { leerDatosCuenta, cuentaDelNegocio, fmtUnidad, type DatosCuenta } from './datos';
import { arbolDesdeZernio, senalesDeVentana, type FilaLeadAd } from './senales';
import { objetivoRecomendado, previaDeDecision } from './motor';
import { modoEfectivo, ordenDelCupo, recomendadasHoy } from './plan';
import { resolverTacticas } from './tacticas';
import { pausasPorFecha, pausasPendientes, propuestaHasta } from './zona';
import { stopLossDelDia } from './del-dia';
import { lanzar } from './ejecutar';
import type { Decision, Propuesta } from './tipos';

export type ResumenVigia = {
  estado: 'ok' | 'apagado' | 'sin_tabla' | 'sin_cuenta' | 'sin_zona_horaria' | 'parcial' | 'cuenta_compartida' | 'error';
  mensaje?: string;
  propuestas?: number;
  lanzadas?: number;
  fallidas?: string[];
  avisos?: string[];
};

/** Hoy del negocio y su zona (la estricta: el día DECIDE qué se pausa). null si no se pudo leer. */
async function diaDelNegocio(ws: number): Promise<{ hoy: string; tz: string } | null> {
  try {
    const { zonaDelNegocioEstricta } = await import('@/lib/timezone');
    const tz = await zonaDelNegocioEstricta(ws);
    return { hoy: hoyEnTz(tz), tz };
  } catch { return null; }
}

/** Lo de HOY por anuncio: el gasto y los resultados de Meta por Zernio, y los leads que entraron hoy al CRM (día del negocio). */
async function senalesDeHoy(ws: number, datos: DatosCuenta, dia: { hoy: string; tz: string }) {
  if (!datos.conexion) return null;
  const z = await arbolPorZernio(ws, datos.conexion, dia.hoy, dia.hoy);
  const { metricas } = arbolDesdeZernio(z.campanas);
  // Los leads de las últimas 36 h, quedándose con los que entraron HOY en la zona del negocio (created_at es UTC).
  const desde = new Date(Date.now() - 36 * 3600_000).toISOString();
  const crudos = await runWithWorkspace(ws, async () => leerTodo<FilaLeadAd & { utm_content: string | null }>(await getTenantDb(), 'leads',
    'id, meta_ad_id, utm_content, created_at, fecha_junta_1, estado_lead, total_cobrado_usd',
    { filtros: (q) => q.or('meta_ad_id.not.is.null,utm_content.not.is.null').gte('created_at', desde) }));
  const nombres: Record<string, string> = Object.fromEntries(datos.arbol.filter((n) => n.nivel === 'ad').map((n) => [n.id, n.nombre]));
  const leads: FilaLeadAd[] = crudos
    .map((l) => ({ ...l, meta_ad_id: adIdDeLead(l.meta_ad_id, l.utm_content, nombres), created_at: l.created_at ? hoyEnTz(dia.tz, new Date(l.created_at)) : null }))
    .filter((l) => l.created_at === dia.hoy);
  return senalesDeVentana(metricas, leads, dia.hoy, dia.hoy, datos.conversor.aUsdNum);
}

// Lo que el motor ve de cada decisión: UNA función (motor.ts), con los anuncios creados y su original (el Relevo los usa).
const previa = previaDeDecision;

/** Mira la cuenta del negocio AHORA: la fecha de fin y el Stop Loss del día. Nunca tira. */
export async function vigilarCuenta(ws: number, opts: { cuentasVistas?: Set<string> } = {}): Promise<ResumenVigia> {
  try {
    const config = await leerConfig(ws);
    if (!config.existeTabla) return { estado: 'sin_tabla' };
    // Apagado no mira nada, salvo las FECHAS DE FIN que puso la persona (M1): esas se cumplen igual, y es lo único que hace.
    const soloFechas = !config.encendido;
    if (soloFechas && !config.hasta && !Object.keys(config.hastaCampanas).length) return { estado: 'apagado' };
    if (opts.cuentasVistas) {
      const act = await cuentaDelNegocio(ws);
      if (act && opts.cuentasVistas.has(act)) return { estado: 'cuenta_compartida', mensaje: `La cuenta ${act} ya la miró otro negocio.` };
      if (act) opts.cuentasVistas.add(act);
    }
    const dia = await diaDelNegocio(ws);
    if (!dia) return { estado: 'sin_zona_horaria', mensaje: 'No pude leer la zona horaria del negocio: sin el día de hoy no se pausa nada.' };
    let datos: DatosCuenta;
    try { datos = await leerDatosCuenta(ws, hoyEnTijuana()); }
    catch (e) { return { estado: 'sin_cuenta', mensaje: e instanceof Error ? e.message : String(e) }; }
    if (datos.parcial) return { estado: 'parcial', mensaje: 'Meta devolvió la cuenta a medias: no se toca nada.' };

    const avisos: string[] = [...datos.avisos];
    // 21 días, como la corrida: una pausa por fecha que no salió hace una semana se busca acá para relanzarla.
    const { decisiones } = await leerDecisiones(ws, 21);
    const ya = new Set(decisiones.map((d) => d.clave));
    const cupo = await cupoDe(ws);
    const tacticas = resolverTacticas(config.tacticas, { piloto: modoEfectivo(config.modo, cupo) === 'piloto', pilotoPermitido: cupo.piloto });

    let lanzadas = 0;
    const fallidas: string[] = [];
    const lanzarTodas = async (ds: readonly Decision[]) => {
      for (const d of ds) {
        const x = await lanzar(ws, d.id, { nombre: d.tactica === 'hasta' ? 'Tu fecha de fin' : 'Vigía del día', origen: 'piloto' }, { datos });
        if (x.ok) lanzadas++; else fallidas.push(`${d.titulo}: ${x.error}`);
      }
    };

    // 1. HASTA, PRIMERO y lanzado en el acto: que algo de abajo falle no puede dejar una campaña gastando pasada su fecha
    // (revisión adversarial del 29/10, hallazgo 1). Las que se guardaron antes y no salieron, se relanzan.
    const pausas = pausasPorFecha(datos.arbol, config, dia.hoy);
    const porFecha: Propuesta[] = pausas.map(propuestaHasta).filter((p) => !ya.has(p.clave));
    let nuevasFecha: Decision[] = [];
    if (porFecha.length) {
      // Aparte: sin la 0350 la táctica `hasta` no entra en la tabla, y eso no frena el Stop Loss.
      try { nuevasFecha = await guardarPropuestas(ws, porFecha, datos.moneda); }
      catch (e) { avisos.push(`No pude guardar las pausas por fecha de fin (${e instanceof Error ? e.message.slice(0, 160) : String(e)}).`); }
    }
    await lanzarTodas([...nuevasFecha, ...pausasPendientes(pausas, decisiones)]);
    if (soloFechas) {
      // Una falla se avisa la primera vez (la pausa recién guardada); las que se relanzan cada 2 h, no: serían doce avisos por día.
      if (lanzadas > 0 || (fallidas.length && nuevasFecha.length)) {
        await crearNotificacion({
          ws, tipo: 'media_buyer', severidad: fallidas.length ? 'warn' : 'info', origen: 'media-buyer', link: '/ads-manager',
          titulo: fallidas.length ? 'No pude pausar una campaña que llegó a su fecha de fin' : `MaKo pausó ${lanzadas === 1 ? 'una campaña que llegó' : `${lanzadas} campañas que llegaron`} a su fecha de fin`,
          descripcion: [...nuevasFecha.map((d) => d.titulo), ...fallidas].slice(0, 3).join(' · ') || null,
        }).catch(() => null);
      }
      return { estado: 'ok', propuestas: nuevasFecha.length, lanzadas, fallidas, avisos };
    }

    // 2. EL STOP LOSS DEL DÍA: con el gasto de hoy (Zernio) y una moneda que se sepa pasar a la unidad del objetivo. En su propio
    // try: una lectura de hoy que falla no deshace lo de arriba.
    let nuevasStop: Decision[] = [];
    let stopLanzadas = 0;
    try {
      if (!datos.conexion) avisos.push('Sin tu conexión de Facebook por Zernio, MaKo no ve el gasto de hoy: el Stop Loss mira el día cerrado, una vez por día.');
      else if (datos.conversor.aUsd(1) == null) avisos.push(`Tu cuenta cobra en ${datos.moneda ?? 'una moneda desconocida'} y MaKo no tiene su tasa: el Stop Loss del día no corre.`);
      else {
        const delDia = await senalesDeHoy(ws, datos, dia);
        // El objetivo del resultado de HOY: el del negocio o el que recomienda MaKo con ese mismo resultado. El de la última corrida
        // no sirve: pudo calcularse con otro resultado (lead) antes de que la persona lo cambiara (venta). Hallazgo 5.
        const objetivo = config.objetivo ?? objetivoRecomendado(datos.crm, config.kpi);
        const stop = stopLossDelDia({
          ahora: Date.now(), hoy: dia.hoy, kpi: config.kpi, objetivo, arbol: datos.arbol, delDia: delDia ?? [], semana: datos.larga,
          historial: decisiones.map(previa), tacticas, fmt: fmtUnidad(datos),
        }).filter((p) => !ya.has(p.clave));
        // El cupo de MaKo Esencial (plan.ts): lo del día cuenta como una recomendación más.
        const { orden, lugares } = ordenDelCupo(stop, recomendadasHoy(decisiones, dia.hoy), cupo.recomendacionesDia);
        nuevasStop = await guardarPropuestas(ws, orden.slice(0, Math.max(0, lugares)), datos.moneda);
        if (tacticas.stop_loss.estado === 'automatica') { const antes = lanzadas; await lanzarTodas(nuevasStop); stopLanzadas = lanzadas - antes; }
      }
    } catch (e) {
      avisos.push(`El Stop Loss del día no pudo mirar la cuenta: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`);
    }
    const esperan = nuevasStop.length - stopLanzadas;
    if (lanzadas > 0 || esperan > 0) {
      await crearNotificacion({
        ws, tipo: 'media_buyer', severidad: fallidas.length || esperan ? 'warn' : 'info', origen: 'media-buyer', link: '/ads-manager',
        titulo: lanzadas > 0
          ? `MaKo pausó ${lanzadas} ${lanzadas === 1 ? 'cosa' : 'cosas'} en tus anuncios${esperan > 0 ? ` y te deja ${esperan} para revisar` : ''}`
          : `${esperan === 1 ? 'Un anuncio se está' : `${esperan} anuncios se están`} quemando hoy: MaKo te propone pausar${esperan === 1 ? 'lo' : 'los'}`,
        descripcion: [...nuevasFecha, ...nuevasStop].slice(0, 3).map((d) => d.titulo).join(' · ') || null,
      }).catch(() => null);
    }
    return { estado: 'ok', propuestas: nuevasFecha.length + nuevasStop.length, lanzadas, fallidas, avisos };
  } catch (e) {
    return { estado: 'error', mensaje: e instanceof Error ? e.message : String(e) };
  }
}
