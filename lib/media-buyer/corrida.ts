// =============================================================================
// Media Buyer — UNA corrida del agente sobre un negocio
// =============================================================================
// Lo que hace el cron (y el botón «Analizar ahora»): lee la cuenta, corre el motor, escribe las variaciones de los
// ganadores con la IA del negocio, guarda las decisiones nuevas y, SÓLO si el negocio eligió el piloto automático,
// las lanza. Madgicx audita «every 24 hours»; acá el cron corre una vez por día después de la ingesta de Meta, y las
// decisiones tienen clave por día: correr dos veces no duplica.
//
// ⚠️ EL PILOTO AUTOMÁTICO LO PRENDE CADA NEGOCIO. Por defecto (sin fila de configuración) el modo es «propone»: las
// decisiones quedan abiertas hasta que una persona las lanza. Nada en este archivo cambia el modo de nadie.
// =============================================================================

import 'server-only';
import { hoyEnTijuana } from '@/lib/date-utils';
import { proponer, objetivoRecomendado, type DecisionPrevia } from './motor';
import { leerConfig, leerDecisiones, guardarPropuestas, vencerViejas, marcarCorrida, MediaBuyerSinTabla } from './store';
import { leerDatosCuenta, SinCuentaParaOperar, fmtUnidad, presupuestoMinimoCuenta } from './datos';
import { prepararVariaciones } from './variaciones';
import { lanzar } from './ejecutar';
import type { Decision, Propuesta } from './tipos';

export type ResumenCorrida = {
  estado: 'ok' | 'apagado' | 'sin_tabla' | 'sin_cuenta' | 'error';
  mensaje?: string;
  objetivo?: number | null;
  objetivoEsRecomendado?: boolean;
  propuestas?: number;
  nuevas?: number;
  lanzadas?: number;
  fallidas?: string[];
  sinVariaciones?: string[];
  avisos?: string[];
  fuente?: string;
};

const previa = (d: Decision): DecisionPrevia => ({
  tipo: d.tipo, tactica: d.tactica, nivel: d.nivel, entidadId: d.entidadId, estado: d.estado,
  creada: d.creada, aplicadaAt: d.aplicadaAt, origen: d.origen,
});

/** Analiza la cuenta del negocio y guarda (y en piloto, lanza) lo que haya que hacer hoy. Nunca tira. */
export async function analizarCuenta(ws: number, opts: { hoy?: string; quien?: string } = {}): Promise<ResumenCorrida> {
  const hoy = opts.hoy ?? hoyEnTijuana();
  let r: ResumenCorrida;
  try {
    r = await correr(ws, hoy);
  } catch (e) {
    r = e instanceof MediaBuyerSinTabla ? { estado: 'sin_tabla', mensaje: e.message }
      : e instanceof SinCuentaParaOperar ? { estado: 'sin_cuenta', mensaje: e.message }
        : { estado: 'error', mensaje: e instanceof Error ? e.message : String(e) };
  }
  if (r.estado !== 'sin_tabla') await marcarCorrida(ws, { ...r, quien: opts.quien ?? 'cron', hoy }).catch(() => null);
  return r;
}

async function correr(ws: number, hoy: string): Promise<ResumenCorrida> {
  const config = await leerConfig(ws);
  if (!config.existeTabla) return { estado: 'sin_tabla', mensaje: 'Falta aplicar la migración del Media Buyer.' };
  if (!config.encendido) return { estado: 'apagado' };
  await vencerViejas(ws);
  const datos = await leerDatosCuenta(ws, hoy);
  const recomendado = objetivoRecomendado(datos.crm, config.kpi);
  const objetivo = config.objetivo ?? recomendado;
  const { decisiones } = await leerDecisiones(ws, 21);

  const props = proponer({
    ahora: Date.now(), config, objetivo, arbol: datos.arbol,
    corta: datos.corta, larga: datos.larga, crm: datos.crm,
    historial: decisiones.map(previa),
    aUnidad: datos.conversor.aUsdNum, fmt: fmtUnidad(datos), presupuestoMinimo: presupuestoMinimoCuenta(datos),
  }, hoy);

  // Las variaciones se escriben ANTES de guardar: una propuesta de variaciones sin variaciones no se puede lanzar. Sólo las
  // que todavía no existen (misma clave = ya se escribieron hoy, no se gasta IA dos veces).
  const yaGuardadas = new Set(decisiones.map((d) => d.clave));
  const sinVariaciones: string[] = [];
  const listas: Propuesta[] = [];
  for (const p of props) {
    if (yaGuardadas.has(p.clave)) continue;
    if (p.tipo === 'variaciones_texto' || p.tipo === 'variaciones_hook') {
      const v = await prepararVariaciones(ws, p);
      if (!v.variaciones.length) { sinVariaciones.push(`${p.entidadNombre}: ${v.motivo ?? 'sin variaciones'}`); continue; }
      listas.push({ ...p, variaciones: v.variaciones });
    } else {
      listas.push(p);
    }
  }
  const nuevas = await guardarPropuestas(ws, listas, datos.moneda);

  // El piloto automático: lanza lo nuevo con la MISMA lectura (que `lanzar` mantiene al día), de lo que BAJA el gasto a lo
  // que lo SUBE, así el tope de la cuenta ve primero lo que se liberó.
  let lanzadas = 0;
  const fallidas: string[] = [];
  if (config.modo === 'piloto') {
    const orden = (d: Decision) => (d.tipo === 'pausar' ? 0 : d.tipo === 'bajar_presupuesto' ? 1 : d.tipo === 'activar' ? 2 : d.tipo === 'subir_presupuesto' ? 3 : 4);
    for (const d of [...nuevas].sort((a, b) => orden(a) - orden(b))) {
      const x = await lanzar(ws, d.id, { nombre: 'Piloto automático', origen: 'piloto' }, { datos });
      if (x.ok) lanzadas++;
      else fallidas.push(`${d.titulo}: ${x.error}`);
    }
  }

  return {
    estado: 'ok', objetivo, objetivoEsRecomendado: config.objetivo == null,
    propuestas: props.length, nuevas: nuevas.length, lanzadas, fallidas, sinVariaciones,
    avisos: datos.avisos, fuente: datos.fuente,
  };
}
