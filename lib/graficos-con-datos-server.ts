// =============================================================================
// graficos-con-datos-server — medir qué gráficos de una hoja tienen datos en ESTE negocio y armarla con eso
// =============================================================================
// Las reglas puras (qué es vacío, qué se va con un gráfico quitado, cómo se suma lo de MaKo) viven en
// lib/graficos-con-datos.ts, con test. Acá lo que necesita la base y la IA:
//   · `medirGraficos`: cada gráfico de la hoja con el período y los filtros con que la PANTALLA lo va a pedir
//     (`efectivoDe` sin nada elegido mirando), por el MISMO lector (`datosDeGraficos`). Un error o un plazo vencido es
//     'nose', nunca 'sin'.
//   · `hojaConDatos`: quita los vacíos y, si se pide, le pide a MaKo (IA gratis, la de «¿Qué vas a crear hoy?») que sume
//     gráficos SÓLO sobre los conjuntos que sí tienen datos; lo que suma se mide igual y entra sólo lo que tiene datos.
//     Si MaKo no contesta, la hoja sale podada y nada más: sumar es lo opcional, no tener vacíos es lo pedido.
// Lo usan «Nueva hoja» al elegir una plantilla (app/api/graficos/plantilla/route.ts), «¿Qué vas a crear hoy?»
// (app/api/graficos/ia/route.ts: sólo poda, lo armó MaKo con el pedido) y la API de MaKo (crear_hoja_dashboard).

import 'server-only';
import { efectivoDe, esGrafico, tituloDe, type Hoja } from './graficos-catalogo';
import { datosDeGraficos, type PedidoDatos } from './graficos-datos';
import { sinDatos } from './graficos-agregar';
import { generarHojaIA } from './graficos-ia-generar';
import { TOPE_PEDIDO_IA, type AlcanceIA } from './graficos-ia';
import { TOPE_AGREGADOS, agregarAlFinal, avisoConDatos, podarSinDatos, type Medida } from './graficos-con-datos';

/** Lo que tiene la lectura de una hoja (la ruta de datos tiene 60 s; acá se mide dos veces y queda lugar para la IA). */
const PLAZO_MEDIR_MS = 20_000;
/** Lo mínimo que tiene que quedar para pedirle a MaKo que sume: menos, y no llega a contestar. */
const MIN_PARA_IA_MS = 25_000;

/** Qué gráficos de la hoja tienen datos, con el período de la hoja y por el mismo lector que la pantalla. */
export async function medirGraficos(h: Hoja, hoy: string, plazoMs = PLAZO_MEDIR_MS): Promise<Map<string, Medida>> {
  const graficos = h.componentes.filter(esGrafico);
  if (!graficos.length) return new Map();
  const pedidos: PedidoDatos[] = graficos.map((g) => {
    const ef = efectivoDe(g, h, {}, hoy);
    return { grafico: g, desde: ef.desde, hasta: ef.hasta, filtros: ef.filtros, agrupar: ef.agrupar };
  });
  const datos = await datosDeGraficos(pedidos, { plazoMs });
  return new Map(graficos.map((g) => {
    const d = datos[g.id];
    const m: Medida = !d || !d.ok ? 'nose' : sinDatos(d.resultado) ? 'sin' : 'con';
    return [g.id, m] as const;
  }));
}

export type HojaConDatos = { hoja: Hoja; aviso: string | null; quitados: number; agregados: number; sinNada: boolean };

/**
 * La hoja sin los gráficos vacíos y, con `sumar`, con los que MaKo arma sobre los conjuntos que tienen datos. `hastaMs`:
 * hasta cuándo se puede trabajar (epoch ms). Nunca tira por la IA: si MaKo no contesta, sale podada. `alcance`: lo que
 * la hoja acepta (16/10/2026: a una plantilla de General, MaKo le sumaba gráficos del catálogo entero del Dashboard).
 */
export async function hojaConDatos(h: Hoja, o: { hoy: string; hastaMs: number; sumar?: { nombre: string; linea: string }; alcance?: AlcanceIA }): Promise<HojaConDatos> {
  const medidas = await medirGraficos(h, o.hoy, Math.min(PLAZO_MEDIR_MS, Math.max(5_000, o.hastaMs - Date.now())));
  const poda = podarSinDatos(h, medidas);
  let hoja = poda.hoja;
  let agregados = 0;
  const conDatos = [...new Set(h.componentes.filter(esGrafico).filter((g) => medidas.get(g.id) === 'con').map((g) => g.fuente))];
  if (o.sumar && !poda.sinNada && conDatos.length && o.hastaMs - Date.now() > MIN_PARA_IA_MS) {
    const ya = hoja.componentes.filter(esGrafico).map((g) => tituloDe(g)).slice(0, 14);
    const pedido = [
      `Gráficos para SUMAR a la hoja «${o.sumar.nombre}» (${o.sumar.linea}).`,
      ya.length ? `Ya tiene: ${ya.join('; ')}. No repitas esos.` : '',
      `Arma hasta ${TOPE_AGREGADOS} gráficos distintos que completen la hoja.`,
    ].filter(Boolean).join(' ').slice(0, TOPE_PEDIDO_IA);
    try {
      const g = await generarHojaIA(pedido, Date.now(), { plazoMs: o.hastaMs - Date.now() - PLAZO_MEDIR_MS, soloFuentes: conDatos, alcance: o.alcance });
      if ('error' in g) {
        console.info('[graficos/con-datos] MaKo no sumó gráficos:', g.error);
      } else {
        const m2 = await medirGraficos(g.hoja, o.hoy, Math.min(PLAZO_MEDIR_MS, Math.max(5_000, o.hastaMs - Date.now())));
        const r = agregarAlFinal(hoja, g.hoja.componentes.filter((c) => esGrafico(c) && m2.get(c.id) === 'con'));
        hoja = r.hoja;
        agregados = r.agregados;
      }
    } catch (e) {
      console.error('[graficos/con-datos] sumar falló:', e instanceof Error ? e.message : e);
    }
  }
  return { hoja, aviso: avisoConDatos({ quitados: poda.quitados, agregados, sinNada: poda.sinNada }), quitados: poda.quitados, agregados, sinNada: poda.sinNada };
}
