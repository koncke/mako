// =============================================================================
// pruebas/pantalla — lo que DICE una prueba A/B en una tarjeta (PURO, 25/10/2026)
// =============================================================================
// docs/diseno-pruebas-ab.md (2.9). Una sola pantalla que reusa cada superficie (la tarjeta «A/B TEST», la landing):
//   · mientras corre NO HAY VERDE NI ROJO: un experimento pintado con «confianza» mientras corría ya engañó una vez
//     (docs/hallazgos-ads.md). Es «Midiendo · día 9 de 28 · A 410 / B 402 · B va adelante (71 %)»;
//   · nunca p-valores: «Hay 71 % de chance de que B sea mejor» (como PostHog);
//   · con pocos datos, sólo los conteos (menos de 10 maduras por rama en una automatización, menos de 50 en una landing);
//   · los finales: «Ganó B», «Empate: quedó A», «Todavía no se sabe: quedó A», «B iba adelante (84 %): quedó B, sin afirmarlo».
// =============================================================================

import type { NumerosRama, Veredicto } from './juez';
import type { Superficie } from './metricas';

/** Con menos que esto por rama, la pantalla muestra sólo los conteos. */
export const MIN_PARA_DECIR = { automatizacion: 10, landing: 50 } as const;
const minimoDe = (s: Superficie): number => (s === 'automatizacion' ? MIN_PARA_DECIR.automatizacion : MIN_PARA_DECIR.landing);

const pct = (x: number): string => `${Math.round(x * 100)} %`;

export type EstadoPantalla = {
  estado: 'sin_prueba' | 'propuesta' | 'corriendo' | 'detenida' | 'concluida' | 'descartada' | 'vencida' | 'deshecha';
  superficie: Superficie;
  dia: number;
  maxDias: number;
  ramas: readonly NumerosRama[];
  veredicto?: Veredicto | null;
  sirviendo?: string | null;
  /** El efecto más chico que se nota con la gente de hoy (lib/pruebas/volumen.ts `efectoQueSeNota`), si se conoce. */
  seNotaDesde?: number | null;
  /** Por qué se reinició, si se reinició («cambiaste B»). */
  reiniciada?: { fecha: string; porque: string } | null;
};

/** La línea de arriba de la tarjeta. */
export function textoDeLaPrueba(e: EstadoPantalla): string {
  if (e.estado === 'sin_prueba') return 'Sin prueba: todos van a A.';
  if (e.estado === 'propuesta') return 'Propuesta: todavía no reparte. Hasta que la empieces, todos van a A.';
  if (e.estado === 'detenida') return 'Detenida: todos van a A.';
  if (e.estado === 'vencida' || e.estado === 'descartada' || e.estado === 'deshecha') return 'Sin prueba: todos van a A.';
  const conteos = e.ramas.map((r) => `${r.clave} ${r.n}`).join(' / ');
  if (e.estado === 'concluida') {
    const s = e.sirviendo ?? 'A';
    switch (e.veredicto) {
      case 'gana_variante': return `Ganó ${s} · ${conteos}`;
      case 'gana_control': return `Ganó A: la otra iba peor · ${conteos}`;
      case 'da_lo_mismo': return `Empate: quedó A · ${conteos}`;
      default: {
        const r = e.ramas.find((x) => x.clave === s);
        return s !== 'A' && r ? `${s} iba adelante (${pct(r.pMejor)}): quedó ${s}, sin afirmarlo · ${conteos}` : `Todavía no se sabe: quedó A · ${conteos}`;
      }
    }
  }
  const partes = [`Midiendo · día ${e.dia} de ${e.maxDias}`, conteos];
  if (e.reiniciada) partes.push(`reiniciada el ${e.reiniciada.fecha}: ${e.reiniciada.porque}`);
  if (e.ramas.every((r) => r.n >= minimoDe(e.superficie))) {
    const adelante = [...e.ramas].sort((a, b) => b.pMejor - a.pMejor)[0];
    partes.push(`${adelante.clave} va adelante (${pct(adelante.pMejor)})`);
    if (e.seNotaDesde != null && Number.isFinite(e.seNotaDesde)) partes.push(`con este tráfico sólo se nota una diferencia de ±${pct(e.seNotaDesde)} o más`);
  }
  return partes.join(' · ');
}

/** Lo que dice cada fila de la tarjeta: «B · 50 % — 9 entraron · 3 respondieron (33 %)». */
export function textoDeRama(r: { clave: string; pct: number }, n: NumerosRama | undefined, asignados: number | undefined, verbo: string): string {
  const base = `${r.clave} · ${r.pct} %`;
  if (!asignados) return base;
  if (!n || !n.n) return `${base} — ${asignados} entraron`;
  return `${base} — ${asignados} entraron · ${n.x} ${verbo} (${pct(n.tasa)})`;
}

/** «¿Hay X % de chance de que B sea mejor?», sin p-valores. Sólo con datos suficientes. */
export function textoDeChance(r: NumerosRama, superficie: Superficie): string | null {
  if (r.control || r.pPeor == null || r.n < minimoDe(superficie)) return null;
  return `Hay ${pct(1 - r.pPeor)} de chance de que ${r.clave} sea mejor que A.`;
}
