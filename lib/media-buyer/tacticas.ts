// =============================================================================
// Media Buyer — las TÁCTICAS como automatizaciones, una por una (PURO: lo prueban los tests)
// =============================================================================
// Madgicx separa el AI Marketer (recomendaciones) de las «Automation Tactics»: cada táctica (Surf, Stop Loss, Revive,
// Sunsetting) se prende sola, con sus condiciones —el valor recomendado al lado, editable— y la lista de lo que cubre
// (docs/media-buyer/referencias/madgicx/automatizaciones-*.png). En MaKo cada táctica del motor tiene su estado:
//   · apagada: el motor no la mira;
//   · propone: deja la recomendación y espera a una persona;
//   · automática: la lanza el piloto automático, dentro de los topes.
// Sin configurar, todas siguen al modo general de la tuerca (propone, o automática con el piloto prendido).
//
// ⚠️ El plan manda (lib/media-buyer/plan.ts): sin piloto en el plan, ninguna táctica es automática.
// ⚠️ Los valores recomendados son los que el motor usó siempre (lib/media-buyer/motor.ts): editar uno no cambia los
//    demás, y lo que se guarda se recorta a su mínimo y su máximo.
// =============================================================================

import type { Tactica } from './tipos';
import {
  STOP_GASTO_MIN, STOP_DIAS_MIN, CALIDAD_LEADS_MIN, CALIDAD_TASA_CUENTA_MIN, BAJAR_COSTO_MIN, BAJAR_PCT, APAGAR_COSTO_MIN,
  SURF_COSTO_MAX, SURF_RESULTADOS_MIN, SURF_SALTO_MAX_PCT, REVIVE_COSTO_MAX, GANADOR_RESULTADOS_MIN,
  RELEVO_DIAS_MIN, RELEVO_RESULTADOS_MIN, RELEVO_MARGEN_PCT,
} from './motor';

/** Las tácticas que se configuran (estado, umbrales, campañas). `manual` es de una persona y `hasta`, la fecha de fin que puso ella. */
export type TacticaAuto = Exclude<Tactica, 'manual' | 'hasta'>;
export type EstadoTactica = 'apagada' | 'propone' | 'automatica';
export const ORDEN_TACTICAS: TacticaAuto[] = ['stop_loss', 'calidad', 'sunsetting', 'surf', 'revive', 'ganador'];

export type Parametro = {
  id: string;
  nombre: string;
  /** Cómo se lee el número: veces el objetivo, un porcentaje, días o una cantidad. */
  unidad: 'veces' | '%' | 'días' | 'cantidad';
  recomendado: number;
  min: number;
  max: number;
};

export type DefTactica = { nombre: string; icono: string; nivel: string; que: string; parametros: Parametro[] };

export const TACTICAS: Record<TacticaAuto, DefTactica> = {
  stop_loss: {
    nombre: 'Stop Loss', icono: '🛑', nivel: 'Anuncio',
    que: 'Pausa el anuncio que gastó sin traer resultados.',
    parametros: [
      { id: 'gastoVeces', nombre: 'Gastó sin resultados, en veces tu objetivo', unidad: 'veces', recomendado: STOP_GASTO_MIN, min: 1, max: 10 },
      { id: 'dias', nombre: 'Días corriendo como mínimo', unidad: 'días', recomendado: STOP_DIAS_MIN, min: 1, max: 14 },
    ],
  },
  calidad: {
    nombre: 'Calidad de leads', icono: '🧲', nivel: 'Anuncio',
    que: 'Pausa el anuncio cuyos leads no agendan en tu CRM.',
    parametros: [
      { id: 'leads', nombre: 'Leads en el CRM como mínimo', unidad: 'cantidad', recomendado: CALIDAD_LEADS_MIN, min: 3, max: 50 },
      { id: 'tasaCuentaPct', nombre: 'Agenda de toda la cuenta como mínimo', unidad: '%', recomendado: Math.round(CALIDAD_TASA_CUENTA_MIN * 100), min: 5, max: 80 },
    ],
  },
  sunsetting: {
    nombre: 'Sunsetting', icono: '📉', nivel: 'Campaña o conjunto',
    que: 'Baja de a poco el presupuesto de lo que se encarece, y lo pausa si no se recupera.',
    parametros: [
      { id: 'bajarVeces', nombre: 'Bajar si cuesta, en veces tu objetivo', unidad: 'veces', recomendado: BAJAR_COSTO_MIN, min: 1.1, max: 5 },
      { id: 'bajarPct', nombre: 'Cuánto bajar', unidad: '%', recomendado: BAJAR_PCT, min: 5, max: 50 },
      { id: 'apagarVeces', nombre: 'Pausar si cuesta, en veces tu objetivo', unidad: 'veces', recomendado: APAGAR_COSTO_MIN, min: 1.5, max: 10 },
    ],
  },
  surf: {
    nombre: 'Surf', icono: '🏄', nivel: 'Campaña o conjunto',
    que: 'Sube el presupuesto de lo que trae resultados por debajo de tu objetivo.',
    parametros: [
      { id: 'costoPct', nombre: 'Subir si cuesta menos de (% de tu objetivo)', unidad: '%', recomendado: Math.round(SURF_COSTO_MAX * 100), min: 30, max: 100 },
      { id: 'resultados', nombre: 'Resultados en 3 días como mínimo', unidad: 'cantidad', recomendado: SURF_RESULTADOS_MIN, min: 1, max: 20 },
      { id: 'subidaPct', nombre: 'Cuánto subir', unidad: '%', recomendado: SURF_SALTO_MAX_PCT, min: 5, max: 50 },
    ],
  },
  revive: {
    nombre: 'Revive', icono: '🔁', nivel: 'Lo que pausó MaKo',
    que: 'Vuelve a prender lo que MaKo pausó si después llegaron resultados y quedó dentro del objetivo.',
    parametros: [
      { id: 'costoVeces', nombre: 'Prender si cuesta, en veces tu objetivo, hasta', unidad: 'veces', recomendado: REVIVE_COSTO_MAX, min: 0.5, max: 2 },
    ],
  },
  ganador: {
    nombre: 'Ganador', icono: '🏆', nivel: 'Anuncio',
    que: 'Escribe variaciones de texto, de botón o de hook del anuncio que mejor convierte, y pausa el original cuando una le gana.',
    parametros: [
      { id: 'resultados', nombre: 'Resultados en 7 días como mínimo', unidad: 'cantidad', recomendado: GANADOR_RESULTADOS_MIN, min: 1, max: 20 },
      // El Relevo (motor.ts): pausar el original cuando su variación le gana.
      { id: 'relevoDias', nombre: 'Pausar el original: días de la variación como mínimo', unidad: 'días', recomendado: RELEVO_DIAS_MIN, min: 7, max: 30 },
      { id: 'relevoResultados', nombre: 'Pausar el original: resultados de la variación como mínimo', unidad: 'cantidad', recomendado: RELEVO_RESULTADOS_MIN, min: 1, max: 30 },
      { id: 'relevoMargenPct', nombre: 'Pausar el original: la variación tiene que costar menos, en %', unidad: '%', recomendado: RELEVO_MARGEN_PCT, min: 5, max: 80 },
    ],
  },
};

/** Lo que guarda cada negocio (media_buyer_config.tacticas). Lo que no está, es lo recomendado. */
export type ConfigTactica = { estado?: EstadoTactica; parametros?: Record<string, number>; campanas?: string[] | null };
export type ConfigTacticas = Partial<Record<TacticaAuto, ConfigTactica>>;

export type TacticaResuelta = { estado: EstadoTactica; p: Record<string, number>; campanas: ReadonlySet<string> | null };
export type TacticasResueltas = Record<TacticaAuto, TacticaResuelta>;

/**
 * Lo que vale hoy para cada táctica. `piloto`: el modo general es piloto automático (modoEfectivo); `pilotoPermitido`: el
 * plan lo trae. Sin plan, una táctica guardada como automática queda en «propone».
 */
/**
 * Lo que llega se MEZCLA con lo guardado, táctica por táctica: una pestaña abierta desde antes que toca un agente no reescribe
 * las demás con su copia vieja (podía volver a poner en automático algo que otro apagó; revisión de tren-l, falla 2).
 */
export function mezclarTacticas(guardadas: ConfigTacticas | null | undefined, recibidas: ConfigTacticas): ConfigTacticas {
  // Campo por campo, no táctica por táctica (verificación de tren-m, falla 2): una pestaña vieja que sólo cambia el ESTADO de
  // un agente mandaba la táctica entera con su copia de cuando abrió la página, y pisaba los umbrales o las campañas que otro
  // había cambiado en ESA táctica. Lo que no viene, se queda; los umbrales, uno por uno; `campanas: null` es «toda la cuenta».
  const out: ConfigTacticas = { ...(guardadas ?? {}) };
  for (const [t, c] of Object.entries(recibidas) as Array<[TacticaAuto, ConfigTactica | undefined]>) {
    if (!c) continue;
    const g = out[t] ?? {};
    const m: ConfigTactica = { ...g };
    if (c.estado !== undefined) m.estado = c.estado;
    if (c.parametros !== undefined) m.parametros = { ...(g.parametros ?? {}), ...c.parametros };
    if (c.campanas !== undefined) m.campanas = c.campanas;
    out[t] = m;
  }
  return out;
}

export function resolverTacticas(cfg: ConfigTacticas | null | undefined, o: { piloto: boolean; pilotoPermitido: boolean }): TacticasResueltas {
  const out = {} as TacticasResueltas;
  for (const t of ORDEN_TACTICAS) {
    const c = cfg?.[t] ?? {};
    let estado: EstadoTactica = c.estado ?? (o.piloto ? 'automatica' : 'propone');
    if (estado === 'automatica' && !o.pilotoPermitido) estado = 'propone';
    const p: Record<string, number> = {};
    for (const par of TACTICAS[t].parametros) {
      const v = c.parametros?.[par.id];
      p[par.id] = typeof v === 'number' && Number.isFinite(v) ? Math.min(par.max, Math.max(par.min, v)) : par.recomendado;
    }
    out[t] = { estado, p, campanas: Array.isArray(c.campanas) && c.campanas.length ? new Set(c.campanas) : null };
  }
  return out;
}

/** Lo que llega de la pantalla o de la API: se valida acá (el cliente manda lo que quiera). */
export function validarTacticas(x: unknown): { ok: true; valor: ConfigTacticas } | { ok: false; error: string } {
  if (x == null || typeof x !== 'object' || Array.isArray(x)) return { ok: false, error: 'Tácticas inválidas.' };
  const valor: ConfigTacticas = {};
  for (const [t, c] of Object.entries(x as Record<string, unknown>)) {
    if (!(ORDEN_TACTICAS as string[]).includes(t)) return { ok: false, error: `No existe la táctica «${t}».` };
    if (c == null || typeof c !== 'object') return { ok: false, error: `Táctica «${t}» inválida.` };
    const cc = c as Record<string, unknown>;
    const def = TACTICAS[t as TacticaAuto];
    const sal: ConfigTactica = {};
    if (cc.estado !== undefined) {
      if (cc.estado !== 'apagada' && cc.estado !== 'propone' && cc.estado !== 'automatica') return { ok: false, error: `Estado inválido en ${def.nombre}.` };
      sal.estado = cc.estado;
    }
    if (cc.parametros !== undefined) {
      if (cc.parametros == null || typeof cc.parametros !== 'object') return { ok: false, error: `Valores inválidos en ${def.nombre}.` };
      const ps: Record<string, number> = {};
      for (const [id, v] of Object.entries(cc.parametros as Record<string, unknown>)) {
        const par = def.parametros.find((q) => q.id === id);
        if (!par) return { ok: false, error: `${def.nombre} no tiene el valor «${id}».` };
        const n = Number(v);
        if (!Number.isFinite(n)) return { ok: false, error: `${par.nombre}: tiene que ser un número.` };
        ps[id] = Math.min(par.max, Math.max(par.min, Math.round(n * 100) / 100));
      }
      sal.parametros = ps;
    }
    if (cc.campanas !== undefined) {
      if (cc.campanas === null) sal.campanas = null;
      else if (!Array.isArray(cc.campanas) || cc.campanas.length > 300 || !cc.campanas.every((i) => typeof i === 'string' && /^\d{1,30}$/.test(i))) {
        return { ok: false, error: `Campañas inválidas en ${def.nombre}.` };
      } else sal.campanas = [...new Set(cc.campanas as string[])];
    }
    valor[t as TacticaAuto] = sal;
  }
  return { ok: true, valor };
}

/** ¿Hay alguna táctica automática guardada? (para negarla en un plan sin piloto). */
export const pideAutomatica = (c: ConfigTacticas): boolean => Object.values(c).some((x) => x?.estado === 'automatica');
