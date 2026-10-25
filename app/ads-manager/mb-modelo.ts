// =============================================================================
// Media Buyer — lo que la pantalla DICE de cada decisión (PURO: lo prueban los tests)
// =============================================================================
// Los nombres de las tácticas van como los llama la referencia (Madgicx: Surf, Stop Loss, Revive, Sunsetting): son
// NOMBRES (regla de la casa: los nombres en inglés), y así quien conoce la herramienta las reconoce. Las frases, en
// español neutro y cortas (memoria texto-de-pantalla-corto).
// =============================================================================

import { cuentaAUsd, esConvertible } from '@/lib/presupuesto-cambio';
import { fmtDinero } from '@/lib/format';
import type { Decision, EstadoDecision, KpiMediaBuyer, Tactica, TipoDecision } from '@/lib/media-buyer/tipos';

export const NOMBRE_TACTICA: Record<Tactica, string> = {
  surf: 'Surf',
  sunsetting: 'Sunsetting',
  stop_loss: 'Stop Loss',
  revive: 'Revive',
  calidad: 'Calidad de leads',
  ganador: 'Ganador',
  manual: 'Subida',
};

export const ICONO_TIPO: Record<TipoDecision, string> = {
  subir_presupuesto: '📈',
  bajar_presupuesto: '📉',
  pausar: '✋',
  activar: '🔄',
  variaciones_texto: '✍️',
  variaciones_hook: '🎬',
  crear_anuncios: '⬆️',
};

export const NIVEL: Record<Decision['nivel'], string> = { campaign: 'Campaña', adset: 'Conjunto', ad: 'Anuncio' };

/** El tono del titular de la columna del medio: verde lo que gana, rojo lo que pierde, dorado lo que crea MaKo. */
export function tonoDe(d: Pick<Decision, 'tipo' | 'tactica'>): 'bien' | 'mal' | 'cuidado' | 'mako' {
  if (d.tipo === 'variaciones_texto' || d.tipo === 'variaciones_hook') return 'mako';
  if (d.tipo === 'subir_presupuesto' || d.tipo === 'activar' || d.tipo === 'crear_anuncios') return 'bien';
  if (d.tactica === 'sunsetting' && d.tipo === 'bajar_presupuesto') return 'cuidado';
  return 'mal';
}

/** El rótulo del botón principal, por lo que hace. */
export function verboLanzar(d: Pick<Decision, 'tipo'>): string {
  switch (d.tipo) {
    case 'subir_presupuesto': return 'Subir';
    case 'bajar_presupuesto': return 'Bajar';
    case 'pausar': return 'Pausar';
    case 'activar': return 'Prender';
    default: return 'Crear anuncios';
  }
}

/** Un monto de la cuenta, como se lee: en dólares si la moneda convierte, si no en la suya. */
export function monto(m: number | null | undefined, moneda: string | null): string {
  if (m == null) return '—';
  if (moneda && esConvertible(moneda)) {
    const usd = cuentaAUsd(m, moneda);
    if (usd != null) return fmtDinero(usd);
  }
  return fmtDinero(m, moneda);
}

/** Qué se hizo, en una línea: lo que va debajo del nombre en «Lo que hizo MaKo» (como «Set budget from $5,132 to $740»). */
export function queSeHizo(d: Pick<Decision, 'tipo' | 'nivel' | 'entidadNombre' | 'antes' | 'despues' | 'moneda' | 'creados'>): string {
  const que = `«${d.entidadNombre}»`;
  switch (d.tipo) {
    case 'subir_presupuesto':
    case 'bajar_presupuesto':
      return `${d.tipo === 'subir_presupuesto' ? 'Subió' : 'Bajó'} ${que} de ${monto(d.antes.presupuesto, d.moneda)} a ${monto(d.despues.presupuesto, d.moneda)}`;
    case 'pausar': return `Pausó ${que}`;
    case 'activar': return `Prendió ${que}`;
    default: return `Creó ${d.creados.length || ''} ${d.creados.length === 1 ? 'anuncio' : 'anuncios'} de ${que}`.replace('  ', ' ');
  }
}

/** «hace 2 h», «hace 3 días». */
export function hace(iso: string | null | undefined, ahora = Date.now()): string {
  if (!iso) return '';
  const ms = Math.max(0, ahora - Date.parse(iso));
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.floor(h / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}

export type Pestana = 'abiertas' | 'hechas' | 'descartadas';

/** En qué pestaña vive cada estado. Lo que falló o frenó un tope sigue ABIERTO: todavía hay algo que decidir. */
export function pestanaDe(e: EstadoDecision): Pestana {
  if (e === 'abierta' || e === 'fallida' || e === 'bloqueada') return 'abiertas';
  if (e === 'aplicada' || e === 'deshecha') return 'hechas';
  return 'descartadas';
}

/** El porcentaje de lo aplicado en 30 días que lanzó el piloto automático (el «Percent of account automation»). */
export function porcentajeAutomatico(ds: Pick<Decision, 'estado' | 'origen'>[]): number {
  const aplicadas = ds.filter((d) => d.estado === 'aplicada' || d.estado === 'deshecha');
  if (!aplicadas.length) return 0;
  return Math.round((aplicadas.filter((d) => d.origen === 'piloto').length / aplicadas.length) * 100);
}

/** El saludo según la hora del navegador. */
export function saludo(hora: number): string {
  if (hora < 12) return 'Buen día';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ── La estructura de AdAmigo (25/10/2026, Martín: «Me gusta el de "AdAmigo" implementalo de punta en punta») ──────────
// docs/media-buyer/referencias/adamigo/: cada acción la firma un AGENTE (Strategist, Media Buyer, Creative Designer,
// Protect), se lee como Qué · Por qué · Impacto esperado, muestra el cambio como «$250 → $300/day +20%», y vive en una de
// cuatro pestañas de Autopilot (Today, Scheduled, Implemented, Blocked).

// Los agentes viven en lib/media-buyer/agentes.ts (los usa también la API de MaKo); la pantalla los toma de acá.
export { AGENTE_DE, NOMBRE_AGENTE, TACTICAS_DE, QUE_HACE, estadoDeAgente, cambiarAgente } from '@/lib/media-buyer/agentes';
export type { Agente, EstadoAgente } from '@/lib/media-buyer/agentes';

export type PestanaAA = 'hoy' | 'programadas' | 'implementadas' | 'bloqueadas';

/**
 * La pestaña de Autopilot. «Programadas» son las abiertas de una táctica AUTOMÁTICA: el piloto las lanza en su próxima
 * vuelta. «Bloqueadas» junta lo que frenó un tope o falló (todavía se puede reintentar) con lo descartado o vencido.
 */
export function pestanaAutopilot(d: Pick<Decision, 'estado' | 'tactica'>, automatica: (t: Tactica) => boolean): PestanaAA {
  if (d.estado === 'aplicada' || d.estado === 'deshecha') return 'implementadas';
  if (d.estado === 'abierta') return automatica(d.tactica) ? 'programadas' : 'hoy';
  return 'bloqueadas';
}

const DEL: Record<Decision['nivel'], string> = { campaign: 'de la campaña', adset: 'del conjunto', ad: 'del anuncio' };
const EL: Record<Decision['nivel'], string> = { campaign: 'la campaña', adset: 'el conjunto', ad: 'el anuncio' };

/** El cambio como en AdAmigo («$250 → $300/day +20%»); null si la decisión no cambia un presupuesto ni un interruptor. */
export function cambioDe(d: Pick<Decision, 'antes' | 'despues' | 'moneda'>): { antes: string; despues: string; pct: string | null } | null {
  const a = d.antes.presupuesto;
  const b = d.despues.presupuesto;
  if (a != null && b != null) {
    const pct = a > 0 ? Math.round((b / a - 1) * 100) : null;
    return { antes: monto(a, d.moneda), despues: `${monto(b, d.moneda)}/día`, pct: pct == null ? null : `${pct > 0 ? '+' : ''}${pct}%` };
  }
  if (d.antes.estado && d.despues.estado) {
    const t = (e: string) => (e === 'ACTIVE' ? 'Prendido' : 'Pausado');
    return { antes: t(d.antes.estado), despues: t(d.despues.estado), pct: null };
  }
  return null;
}

/** El «Qué» de la tarjeta: lo que hace y dónde, en una oración (como «Pause the ad set X within the campaign Y»). */
export function queHace(d: Pick<Decision, 'tipo' | 'nivel' | 'entidadNombre' | 'campanaNombre' | 'antes' | 'despues' | 'moneda' | 'variaciones'>): string {
  const donde = d.campanaNombre && d.nivel !== 'campaign' ? ` (campaña «${d.campanaNombre}»)` : '';
  const quien = `«${d.entidadNombre}»${donde}`;
  const n = (d.variaciones ?? []).length;
  switch (d.tipo) {
    case 'subir_presupuesto':
    case 'bajar_presupuesto':
      return `${d.tipo === 'subir_presupuesto' ? 'Subir' : 'Bajar'} el presupuesto diario ${DEL[d.nivel]} ${quien} de ${monto(d.antes.presupuesto, d.moneda)} a ${monto(d.despues.presupuesto, d.moneda)}.`;
    case 'pausar': return `Pausar ${EL[d.nivel]} ${quien}.`;
    case 'activar': return `Prender ${EL[d.nivel]} ${quien}.`;
    case 'variaciones_texto': return `Probar ${n || 'tres'} textos nuevos ${DEL[d.nivel]} ${quien}, como anuncios nuevos en su mismo conjunto.`;
    case 'variaciones_hook': return `Probar ${n || 'tres'} ganchos nuevos del video ${quien}: se filma sólo el gancho.`;
    default: return `Subir anuncios nuevos a ${quien}.`;
  }
}

const RESULTADO: Record<KpiMediaBuyer, string> = { lead: 'leads', agenda: 'agendas', venta: 'ventas' };

/** El «Impacto esperado»: lo que se busca con la acción, en una o dos líneas (no promete números que no salen del dato). */
export function impactoEsperado(d: Pick<Decision, 'tipo' | 'tactica'>, kpi: KpiMediaBuyer): string[] {
  const r = RESULTADO[kpi];
  switch (d.tipo) {
    case 'subir_presupuesto': return [`Más ${r} al costo de hoy`, 'Sin reiniciar el aprendizaje de Meta'];
    case 'bajar_presupuesto': return [`Menos gasto donde cada uno de tus ${r} sale caro`, 'El presupuesto queda para lo que rinde'];
    case 'pausar': return d.tactica === 'calidad'
      ? ['Menos leads que no agendan', 'Más presupuesto para los que sí']
      : [`Frenar el gasto que no trae ${r}`, 'Ese presupuesto pasa a lo que convierte'];
    case 'activar': return [`Volver a sumar ${r} de un anuncio que resultó bueno`];
    case 'variaciones_texto':
    case 'variaciones_hook': return ['Encontrar el próximo ganador antes de que este se canse', `Más ${r} con el mismo presupuesto`];
    default: return ['Probar creativos nuevos en un conjunto que ya funciona'];
  }
}
