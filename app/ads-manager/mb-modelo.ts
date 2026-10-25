// =============================================================================
// Media Buyer — lo que la pantalla DICE de cada decisión (PURO: lo prueban los tests)
// =============================================================================
// Los nombres de las tácticas van como los llama la referencia (Madgicx: Surf, Stop Loss, Revive, Sunsetting): son
// NOMBRES (regla de la casa: los nombres en inglés), y así quien conoce la herramienta las reconoce. Las frases, en
// español neutro y cortas (memoria texto-de-pantalla-corto).
// =============================================================================

import { cuentaAUsd, esConvertible } from '@/lib/presupuesto-cambio';
import type { Decision, EstadoDecision, Tactica, TipoDecision } from '@/lib/media-buyer/tipos';

export const NOMBRE_TACTICA: Record<Tactica, string> = {
  surf: 'Surf',
  sunsetting: 'Sunsetting',
  stop_loss: 'Stop Loss',
  revive: 'Revive',
  calidad: 'Calidad de leads',
  ganador: 'Ganador',
};

export const ICONO_TIPO: Record<TipoDecision, string> = {
  subir_presupuesto: '📈',
  bajar_presupuesto: '📉',
  pausar: '✋',
  activar: '🔄',
  variaciones_texto: '✍️',
  variaciones_hook: '🎬',
};

export const NIVEL: Record<Decision['nivel'], string> = { campaign: 'Campaña', adset: 'Conjunto', ad: 'Anuncio' };

/** El tono del titular de la columna del medio: verde lo que gana, rojo lo que pierde, dorado lo que crea MaKo. */
export function tonoDe(d: Pick<Decision, 'tipo' | 'tactica'>): 'bien' | 'mal' | 'cuidado' | 'mako' {
  if (d.tipo === 'variaciones_texto' || d.tipo === 'variaciones_hook') return 'mako';
  if (d.tipo === 'subir_presupuesto' || d.tipo === 'activar') return 'bien';
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
  const n = (x: number) => x.toLocaleString('es-MX', { maximumFractionDigits: x >= 100 ? 0 : 2 });
  if (moneda && esConvertible(moneda)) {
    const usd = cuentaAUsd(m, moneda);
    if (usd != null) return `US$ ${n(usd)}`;
  }
  return `${n(m)} ${moneda ?? ''}`.trim();
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
