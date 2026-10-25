// =============================================================================
// pruebas/juez — quién ganó una prueba A/B, con HORIZONTE FIJO (PURO; el veredicto es código, nunca un LLM, 25/10/2026)
// =============================================================================
// docs/diseno-pruebas-ab.md, con la crítica (Anexo 2, A), que manda: mirar todos los días con «95 % dos días seguidos»
// daba entre 10 y 35 % de falsos ganadores con el volumen de MaKo. Por eso:
//   · «gana» se decide UNA vez, en el HORIZONTE: el día en que todas las ramas activas tienen `nPorRama` personas
//     maduras (el n que calcula lib/pruebas/volumen.ts ANTES de arrancar) y pasaron `minDias`. Ese día depende sólo de
//     cuánta gente entró, nunca de los resultados: por eso vale como una sola mirada;
//   · antes del horizonte, una lectura sólo puede CORTAR una rama por DAÑO, con 99,5 %. Cortar deja de servirla y el
//     veredicto, si se termina así, es `no_concluyente`: una prueba sin potencia nunca es «no funciona»;
//   · `gana_control` (la que llega a MaKo como «PROBADO QUE NO FUNCIONA») sólo con daño demostrado en el horizonte;
//   · al tope (`maxDias` sin llegar al horizonte) es `no_concluyente`. Lo que se SIRVE puede ser la rama que va adelante
//     (80 %), pero como verdad no se registra nada (la decisión de negocio no es la verdad, diseño 2.5).
// Cuenta conteos de personas MADURAS (las que ya cumplieron la ventana: lib/pruebas/metricas.ts), nunca promedios de
// tasas diarias. El test A/A (tests/pruebas-juez-aa.test.ts) corre este juez con el calendario real de lecturas (una
// por día) y exige ≤ 5 % de falsos ganadores: es la puerta de todo lo que sigue.
//
// LOS NÚMEROS (los cambia una persona en código, con el porqué):
//   · UMBRAL_GANA 0,98 por comparación con el control (Bonferroni: con k ramas, 1 − 0,02/(k − 1)). Por lado, 2 % de
//     falsos «gana B» y 2 % de falsos «gana el control»: juntos ≤ 4 %, debajo del 5 % del Cerebro.
//   · PERDIDA_MAX_REL 1 %: además, lo que se pierde en promedio por quedarse con B si A era mejor tiene que ser menos del
//     1 % de la tasa del control (la regla doble de VWO). ⚠️ Con 98 % no ata nunca (medido: 0/6 contra 6/6 pierde 0,00115
//     con un techo de 0,0033); queda por si el umbral baja. Donde SÍ decide es al tope (SERVIR_AL_TOPE).
//   · UMBRAL_CORTE 0,995 y la mitad del n del plan: lo que exige la crítica para cortar antes del horizonte.
//   · GUARDRAIL: B no gana si la métrica final (agendó, compró) empeora más que su tolerancia con 80 % de chance. Con
//     menos de 5 eventos en total, el guardrail no tiene dato y no frena.
//   · SERVIR_AL_TOPE 0,8: al tope se sigue sirviendo la rama con 80 % de ser la mejor y pérdida < 1 %; si no, el control.
//   · El prior: Beta(1 + 10·p, 1 + 10·(1 − p)), igual para todas las ramas, con p la tasa conjunta de la prueba. Escéptico
//     y sin historia; el 1 + garantiza densidades acotadas para la integral (lib/pruebas/estadistica.ts).
// =============================================================================

import { cuantilLift, grilla, mediaDe, perdidaEsperada, probMejor, probMenorQue, type Grilla, type Posterior } from './estadistica';

export const UMBRAL_GANA = 0.98;
export const PERDIDA_MAX_REL = 0.01;
export const UMBRAL_CORTE = 0.995;
export const FRACCION_PARA_CORTAR = 0.5;
export const GUARDRAIL_P = 0.8;
export const MIN_EVENTOS_GUARDRAIL = 5;
export const SERVIR_AL_TOPE = 0.8;
export const PESO_PRIOR = 10;

/** El umbral de una comparación contra el control, con k ramas en la prueba (Bonferroni). */
export const umbralGana = (ramas: number): number => 1 - (1 - UMBRAL_GANA) / Math.max(1, ramas - 1);

/** Lo que entra de una rama: personas maduras (`n`) y cuántas lograron la métrica (`x`). */
export type ConteoRama = { clave: string; control?: boolean; activa?: boolean; n: number; x: number };
/** Un guardrail: la métrica final, con su tolerancia relativa (0,1 = puede empeorar hasta 10 %). */
export type ConteoGuardrail = { metrica: string; toleranciaRel: number; ramas: ConteoRama[] };
/** Lo que se fijó al crear la prueba. `mdeRel` es el efecto que el plan quería poder ver (0,8 = de 10 % a 18 %). */
export type Regla = { nPorRama: number; minDias: number; maxDias: number; mdeRel: number };
/** Una lectura diaria: el día desde que arrancó (o desde la época) y los conteos. */
export type Lectura = { dia: number; ramas: ConteoRama[]; guardrails?: ConteoGuardrail[] };

export type Veredicto = 'gana_variante' | 'gana_control' | 'da_lo_mismo' | 'no_concluyente';
/** El molde del Media Buyer (lib/media-buyer/tipos.ts): cada número con la condición que miró y su porqué. */
export type NumeroJuez = { condicion: string; valor: string; porQue: string };
export type NumerosRama = {
  clave: string; control: boolean; activa: boolean; n: number; x: number; tasa: number;
  pMejor: number;
  /** P(peor que el control); null en el control. */
  pPeor: number | null;
  /** E[max(θc − θv, 0)]; null en el control. */
  perdida: number | null;
  /** El intervalo del 90 % del lift relativo contra el control; sólo al concluir (o con `detalle`). */
  lift: [number, number] | null;
};
type Base = { ramas: NumerosRama[]; numeros: NumeroJuez[]; porque: string };
export type Juicio =
  | (Base & { accion: 'seguir' })
  | (Base & { accion: 'cortar'; cortar: string[] })
  | (Base & { accion: 'concluir'; veredicto: Veredicto; sirviendo: string; esVerdad: boolean; ganadora: string | null });

const pct = (x: number): string => `${Math.round(x * 1000) / 10} %`;

/** La posterior de cada rama con el prior común. */
function posteriores(ramas: readonly ConteoRama[]): Posterior[] {
  const n = ramas.reduce((s, r) => s + r.n, 0);
  const x = ramas.reduce((s, r) => s + r.x, 0);
  const p = (x + 0.5) / (n + 1);
  return ramas.map((r) => ({ alfa: 1 + PESO_PRIOR * p + r.x, beta: 1 + PESO_PRIOR * (1 - p) + (r.n - r.x) }));
}

/** Los números de cada rama de una lectura. */
function numerosDe(ramas: readonly ConteoRama[], g: Grilla, conLift: boolean): NumerosRama[] {
  const c = ramas.findIndex((r) => r.control);
  const pm = probMejor(g);
  return ramas.map((r, i) => {
    const esC = i === c;
    return {
      clave: r.clave, control: esC, activa: r.activa !== false, n: r.n, x: r.x, tasa: r.n ? r.x / r.n : 0,
      pMejor: pm[i],
      pPeor: esC ? null : probMenorQue(g, i, c),
      perdida: esC ? null : perdidaEsperada(g, i, c),
      lift: esC || !conLift ? null : [cuantilLift(g, i, c, 0.05), cuantilLift(g, i, c, 0.95)],
    };
  });
}

/** ¿El guardrail frena a la rama `clave`? (P(peor por más de la tolerancia) ≥ 80 %, con 5 eventos o más). */
function guardrailFrena(gr: ConteoGuardrail, clave: string): { frena: boolean; p: number | null } {
  const eventos = gr.ramas.reduce((s, r) => s + r.x, 0);
  const v = gr.ramas.findIndex((r) => r.clave === clave);
  const c = gr.ramas.findIndex((r) => r.control);
  if (eventos < MIN_EVENTOS_GUARDRAIL || v < 0 || c < 0) return { frena: false, p: null };
  const g = grilla(posteriores(gr.ramas));
  const p = probMenorQue(g, v, c, 1 - gr.toleranciaRel);
  return { frena: p >= GUARDRAIL_P, p };
}

/**
 * EL JUICIO DE UNA LECTURA. Sin red ni base: lo que entra son conteos; lo que sale, qué hacer y por qué.
 * `detalle` calcula también el intervalo del lift en una lectura que sigue (para la pantalla; cuesta más).
 */
export function juzgar(l: Lectura, regla: Regla, opciones: { detalle?: boolean } = {}): Juicio {
  const todas = l.ramas;
  const control = todas.find((r) => r.control);
  if (!control) throw new Error('juzgar: la prueba no tiene control');
  const k = todas.length;
  const activas = todas.filter((r) => r.activa !== false);
  const variantes = activas.filter((r) => !r.control);
  const umbral = umbralGana(k);
  const numeros: NumeroJuez[] = [];

  const horizonte = l.dia >= regla.minDias && activas.every((r) => r.n >= regla.nPorRama);
  const tope = !horizonte && l.dia >= regla.maxDias;
  const concluye = horizonte || tope;
  // Las cuentas van sobre las ramas activas (el control siempre lo está).
  const g = grilla(posteriores(activas));
  const ramas = numerosDe(activas, g, concluye || !!opciones.detalle);
  const de = (clave: string) => ramas.find((r) => r.clave === clave)!;
  const nc = de(control.clave);
  const tasaC = mediaDe(posteriores(activas)[activas.indexOf(control)]);

  numeros.push({ condicion: 'personas maduras por rama', valor: activas.map((r) => `${r.clave} ${r.n}`).join(' · '), porQue: `el plan pide ${regla.nPorRama} por rama` });
  numeros.push({ condicion: 'día', valor: `${l.dia} de ${regla.maxDias}`, porQue: `mínimo ${regla.minDias} (el ciclo de la semana)` });

  if (!concluye) {
    // ANTES DEL HORIZONTE: sólo se corta por daño, con 99,5 % y la mitad del plan en las dos ramas.
    const mitad = Math.ceil(regla.nPorRama * FRACCION_PARA_CORTAR);
    const cortar = variantes.filter((v) => v.n >= mitad && control.n >= mitad && (de(v.clave).pPeor ?? 0) >= UMBRAL_CORTE).map((v) => v.clave);
    for (const v of cortar) numeros.push({ condicion: `P(${v} peor que ${control.clave})`, valor: pct(de(v).pPeor!), porQue: `≥ ${pct(UMBRAL_CORTE)} con la mitad del plan: se deja de servir` });
    if (cortar.length && cortar.length === variantes.length) {
      return { accion: 'concluir', veredicto: 'no_concluyente', sirviendo: control.clave, esVerdad: false, ganadora: null, ramas, numeros,
        porque: `Se cortó ${cortar.join(', ')} por daño antes del horizonte: queda ${control.clave}, sin afirmar que no funciona.` };
    }
    if (cortar.length) return { accion: 'cortar', cortar, ramas, numeros, porque: `Se deja de servir ${cortar.join(', ')}: va claramente peor.` };
    return { accion: 'seguir', ramas, numeros, porque: 'Midiendo: todavía no llegó al horizonte del plan.' };
  }

  if (tope) {
    // AL TOPE: no se sabe. Se sirve la que va adelante con 80 % y pérdida chica, sin afirmarlo.
    const adelante = [...ramas].sort((a, b) => b.pMejor - a.pMejor)[0];
    const sirve = adelante.pMejor >= SERVIR_AL_TOPE && (adelante.control || (adelante.perdida ?? 1) < PERDIDA_MAX_REL * tasaC) ? adelante.clave : control.clave;
    numeros.push({ condicion: `P(${adelante.clave} es la mejor)`, valor: pct(adelante.pMejor), porQue: `al tope se sirve con ${pct(SERVIR_AL_TOPE)} o más, sin registrarlo como verdad` });
    return { accion: 'concluir', veredicto: 'no_concluyente', sirviendo: sirve, esVerdad: false, ganadora: null, ramas, numeros,
      porque: `Llegó al tope de ${regla.maxDias} días sin el volumen del plan: todavía no se sabe.${sirve !== control.clave ? ` Queda ${sirve}, que iba adelante, sin afirmarlo.` : ''}` };
  }

  // EL HORIZONTE: la única mirada que decide.
  const candidatas = variantes.map((v) => de(v.clave))
    .filter((v) => (1 - (v.pPeor ?? 1)) >= umbral && (v.perdida ?? 1) < PERDIDA_MAX_REL * tasaC)
    .filter((v) => {
      for (const gr of l.guardrails ?? []) {
        const f = guardrailFrena(gr, v.clave);
        if (f.p != null) numeros.push({ condicion: `P(${v.clave} empeora ${gr.metrica} más de ${pct(gr.toleranciaRel)})`, valor: pct(f.p), porQue: `con ${pct(GUARDRAIL_P)} o más no gana` });
        if (f.frena) return false;
      }
      return true;
    })
    .sort((a, b) => b.pMejor - a.pMejor);
  if (candidatas.length) {
    const v = candidatas[0];
    numeros.push({ condicion: `P(${v.clave} mejor que ${control.clave})`, valor: pct(1 - v.pPeor!), porQue: `≥ ${pct(umbral)} en el horizonte` });
    numeros.push({ condicion: `pérdida esperada con ${v.clave}`, valor: pct(v.perdida!), porQue: `< ${pct(PERDIDA_MAX_REL)} de la tasa de ${control.clave}` });
    return { accion: 'concluir', veredicto: 'gana_variante', sirviendo: v.clave, esVerdad: true, ganadora: v.clave, ramas, numeros,
      porque: `${v.clave} ganó: ${pct(v.tasa)} contra ${pct(nc.tasa)} (${v.n} y ${nc.n} personas), con el lift entre ${pct(v.lift![0])} y ${pct(v.lift![1])}.` };
  }
  const variantesN = variantes.map((v) => de(v.clave));
  if (variantesN.length && variantesN.every((v) => (v.pPeor ?? 0) >= umbral)) {
    for (const v of variantesN) numeros.push({ condicion: `P(${v.clave} peor que ${control.clave})`, valor: pct(v.pPeor!), porQue: `≥ ${pct(umbral)} en el horizonte: daño demostrado` });
    return { accion: 'concluir', veredicto: 'gana_control', sirviendo: control.clave, esVerdad: true, ganadora: control.clave, ramas, numeros,
      porque: `${control.clave} ganó: ${variantesN.map((v) => `${v.clave} ${pct(v.tasa)}`).join(', ')} contra ${pct(nc.tasa)}, con daño demostrado.` };
  }
  // «Da lo mismo» sólo si el intervalo cruza el cero y queda dentro del efecto del plan: uno que no cruza el cero (B va
  // peor, sin llegar al umbral) no es un empate, es «no se sabe» (medido: con B 50 % peor salía «da lo mismo» 1 de 3).
  const igual = variantesN.every((v) => v.lift && v.lift[0] >= -regla.mdeRel && v.lift[1] <= regla.mdeRel && v.lift[0] < 0 && v.lift[1] > 0);
  if (igual) {
    return { accion: 'concluir', veredicto: 'da_lo_mismo', sirviendo: control.clave, esVerdad: false, ganadora: null, ramas, numeros,
      porque: `No se vio una diferencia mayor a ${pct(regla.mdeRel)}: queda ${control.clave}.` };
  }
  return { accion: 'concluir', veredicto: 'no_concluyente', sirviendo: control.clave, esVerdad: false, ganadora: null, ramas, numeros,
    porque: `En el horizonte no alcanza para decir cuál es mejor: queda ${control.clave}.` };
}
