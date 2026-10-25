// =============================================================================
// pruebas/concluir — de un veredicto a la fila de `experimentos` (PURO, 25/10/2026)
// =============================================================================
// docs/diseno-pruebas-ab.md (2.7, con la crítica A.2 y A.3): el estado vive en `pruebas`; la CONCLUSIÓN va a
// `experimentos`, el canal de verdades del negocio (el elemento «Experimento» del Dashboard, y lo que MaKo cita:
// `resumenExperimentos`, lib/experimentos.ts). Lo que importa:
//   · `gana_variante` → validada. `gana_control` → refutada, y SÓLO porque el juez la da con daño demostrado en el
//     horizonte (un corte temprano es `no_concluyente`). `da_lo_mismo` y `no_concluyente` → no_concluyente: «no se vio una
//     diferencia mayor a X» no es «probado que no funciona»;
//   · el aprendizaje cita el INTERVALO, no el punto («subió de 10 % a 40 %» presentaba como verdad un número que no se
//     sabe). Sale de una plantilla con los números calculados: la IA no redacta nada todavía (si un día lo hace, se valida
//     contra estos números, crítica A.3);
//   · `metrica` = «ab:<clave>» y los valores van en % (9,4, no 0,094): `fmtVal` los formatea por el prefijo y la tarjeta
//     los rotula «A / B» (crítica, punto 31). El catálogo de lib/experimentos.ts NO se toca: lo lee la IA que propone
//     experimentos y empezaría a proponer «ab».
// =============================================================================

import type { Juicio, NumerosRama, Veredicto } from './juez';
import { metricaDe } from './metricas';

export type VeredictoExperimento = 'validada' | 'refutada' | 'no_concluyente';

export const veredictoDeExperimento = (v: Veredicto): VeredictoExperimento =>
  v === 'gana_variante' ? 'validada' : v === 'gana_control' ? 'refutada' : 'no_concluyente';

/** Lo que concluir necesita de la prueba. */
export type PruebaParaConcluir = {
  id: number; superficie: string; titulo: string; hipotesis: string; cambio: string | null; origen: 'dueno' | 'mako';
  metrica: string; ventanaDias: number; iniciadaAt: string | null; mdeRel: number;
  ramas: ReadonlyArray<{ clave: string; nombre: string; control: boolean }>;
};

const pct1 = (x: number): string => `${(Math.round(x * 1000) / 10).toLocaleString('es-AR')} %`;
const signo = (x: number): string => `${x >= 0 ? '+' : '−'}${(Math.round(Math.abs(x) * 1000) / 10).toLocaleString('es-AR')} %`;

/** El nombre de la métrica en palabras («Respondió»). */
const nombreMetrica = (clave: string): string => metricaDe(clave)?.titulo ?? clave;

/** La variante que se cuenta: la ganadora, o la primera que no es el control. */
function laVariante(p: PruebaParaConcluir, j: Extract<Juicio, { accion: 'concluir' }>): NumerosRama | undefined {
  const porClave = (c: string | null) => (c ? j.ramas.find((r) => r.clave === c && !r.control) : undefined);
  return porClave(j.ganadora) ?? porClave(j.sirviendo) ?? j.ramas.find((r) => !r.control);
}

/** EL APRENDIZAJE, de una plantilla con los números del juez (con el intervalo, nunca el punto solo). */
export function aprendizajeDe(p: PruebaParaConcluir, j: Extract<Juicio, { accion: 'concluir' }>): string {
  const c = j.ramas.find((r) => r.control)!;
  const v = laVariante(p, j);
  const m = `«${nombreMetrica(p.metrica)}»`;
  if (!v) return `Todavía no se sabe: sólo quedó ${c.clave} (${c.n} personas).`;
  const nom = (clave: string) => p.ramas.find((r) => r.clave === clave)?.nombre?.trim();
  const quien = nom(v.clave) ? `${v.clave} («${nom(v.clave)}»)` : v.clave;
  const gente = `${c.clave} ${c.n} / ${v.clave} ${v.n} personas`;
  const rango = v.lift ? `entre ${signo(v.lift[0])} y ${signo(v.lift[1])}` : null;
  switch (j.veredicto) {
    case 'gana_variante':
      return `La versión ${quien} subió ${m} de ${pct1(c.tasa)} a ${pct1(v.tasa)} (${gente})${rango ? `: con 90 % de seguridad, ${rango}` : ''}.`;
    case 'gana_control':
      return `La versión ${quien} bajó ${m} de ${pct1(c.tasa)} a ${pct1(v.tasa)} (${gente})${rango ? `: con 90 % de seguridad, ${rango}` : ''}. Probado que no funciona.`;
    case 'da_lo_mismo':
      return `No se vio una diferencia mayor a ${pct1(p.mdeRel)} en ${m} entre ${c.clave} (${pct1(c.tasa)}) y ${quien} (${pct1(v.tasa)}), con ${gente}.`;
    default:
      return `Todavía no se sabe si ${quien} cambia ${m}: ${c.clave} ${pct1(c.tasa)} · ${v.clave} ${pct1(v.tasa)} (${gente}).`;
  }
}

/** LA FILA DE `experimentos`, con el workspace EXPLÍCITO (la escribe el cron, sin sesión). */
export function filaDeExperimento(ws: number, p: PruebaParaConcluir, j: Extract<Juicio, { accion: 'concluir' }>, ahoraIso: string): Record<string, unknown> {
  const c = j.ramas.find((r) => r.control)!;
  const v = laVariante(p, j);
  const enPct = (x: number) => Math.round(x * 1000) / 10;
  return {
    workspace_id: ws,
    titulo: p.titulo || `Prueba A/B: ${nombreMetrica(p.metrica)}`,
    hipotesis: p.hipotesis,
    cambio: p.cambio,
    estado: 'cerrado',
    origen: p.origen === 'mako' ? 'mako' : 'manual',
    metrica: `ab:${p.metrica}`,
    metrica_label: `${nombreMetrica(p.metrica)} (A / B)`,
    direccion: 'subir',
    baseline_valor: enPct(c.tasa),
    resultado_valor: v ? enPct(v.tasa) : null,
    ventana_dias: p.ventanaDias,
    fecha_inicio: p.iniciadaAt ? p.iniciadaAt.slice(0, 10) : null,
    fecha_fin: ahoraIso.slice(0, 10),
    veredicto: veredictoDeExperimento(j.veredicto),
    aprendizaje: aprendizajeDe(p, j),
    cerrado_at: ahoraIso,
    racional: j.porque,
    config: {
      prueba_id: p.id,
      superficie: p.superficie,
      veredicto_prueba: j.veredicto,
      sirviendo: j.sirviendo,
      // La rama de resultado_valor (la tarjeta la rotula con esta letra: con 3 ramas puede no ser B).
      variante: v?.clave ?? null,
      ramas: j.ramas.map((r) => ({ clave: r.clave, n: r.n, x: r.x, tasa: r.tasa, p_mejor: r.pMejor, lift: r.lift })),
    },
  };
}
