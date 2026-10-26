// =============================================================================
// Simulador de pruebas A/B con el calendario real de lecturas (para tests/pruebas-juez-aa.test.ts, 25/10/2026)
// =============================================================================
// Cada día entran `ritmoPorRama` personas a cada rama; cada una logra la métrica con su tasa (se sabe al madurar, a los
// `ventanaDias`). El cron lee UNA vez por día, con las personas maduras hasta ayer, y le pasa la lectura al juez REAL
// (lib/pruebas/juez.ts): si corta, la rama deja de recibir gente; si concluye, la prueba termina. Semilla fija: la misma
// corrida da los mismos números.
// =============================================================================
import { juzgar, type ConteoRama, type Regla, type Veredicto } from '../lib/pruebas/juez';

/** mulberry32: PRNG con semilla (los tests no usan Math.random). */
export function prng(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Escenario = {
  /** La tasa real de cada rama; la primera es el control. Todas iguales = A/A. */
  tasas: number[];
  ritmoPorRama: number;
  ventanaDias: number;
  regla: Regla;
};

export type Final = { veredicto: Veredicto; dia: number; ganadora: string | null; cortes: number; sirviendo: string };

const CLAVES = ['A', 'B', 'C', 'D'];

/** Una prueba simulada de punta a punta. */
export function simularUna(e: Escenario, azar: () => number): Final {
  const k = e.tasas.length;
  const activa = e.tasas.map(() => true);
  // Por rama: cuántos entraron cada día y cuántos de ésos lograron la métrica.
  const entraron: number[][] = e.tasas.map(() => []);
  const logros: number[][] = e.tasas.map(() => []);
  let cortes = 0;
  for (let dia = 1; dia <= e.regla.maxDias + e.ventanaDias + 1; dia++) {
    for (let i = 0; i < k; i++) {
      const n = activa[i] ? e.ritmoPorRama : 0;
      let x = 0;
      for (let u = 0; u < n; u++) if (azar() < e.tasas[i]) x++;
      entraron[i].push(n);
      logros[i].push(x);
    }
    // La lectura de HOY: los que entraron hasta `dia − ventana` ya maduraron (las ventanas terminan ayer).
    const hasta = dia - e.ventanaDias;
    const ramas: ConteoRama[] = e.tasas.map((_, i) => {
      let n = 0;
      let x = 0;
      for (let d = 0; d < Math.max(0, hasta); d++) { n += entraron[i][d]; x += logros[i][d]; }
      return { clave: CLAVES[i], control: i === 0, activa: activa[i], n, x };
    });
    const j = juzgar({ dia, ramas }, e.regla);
    if (j.accion === 'cortar') {
      for (const c of j.cortar) activa[CLAVES.indexOf(c)] = false;
      cortes += j.cortar.length;
      continue;
    }
    if (j.accion === 'concluir') return { veredicto: j.veredicto, dia, ganadora: j.ganadora, cortes: cortes + (j.veredicto === 'no_concluyente' && /cortó/.test(j.porque) ? 1 : 0), sirviendo: j.sirviendo };
  }
  throw new Error('la simulación no terminó: el juez nunca llegó al tope');
}

/** Muchas pruebas del mismo escenario: cuántas terminan en cada veredicto, y cuántas tuvieron un corte. */
export function simular(e: Escenario, veces: number, semilla: number) {
  const azar = prng(semilla);
  const cuenta: Record<Veredicto, number> = { gana_variante: 0, gana_control: 0, da_lo_mismo: 0, no_concluyente: 0 };
  let conCorte = 0;
  let dias = 0;
  for (let v = 0; v < veces; v++) {
    const f = simularUna(e, azar);
    cuenta[f.veredicto]++;
    if (f.cortes > 0) conCorte++;
    dias += f.dia;
  }
  const tasa = (x: number) => x / veces;
  return {
    ganaVariante: tasa(cuenta.gana_variante), ganaControl: tasa(cuenta.gana_control),
    daLoMismo: tasa(cuenta.da_lo_mismo), noConcluyente: tasa(cuenta.no_concluyente),
    conCorte: tasa(conCorte), diasPromedio: dias / veces,
  };
}
