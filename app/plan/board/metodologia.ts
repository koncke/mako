// =============================================================================
// metodologia — el código que MIRA si el Perro cumplió sus propias reglas
// =============================================================================
// `GUARDIAN_SYSTEM_TEMPLATE` (lib/mako-guardian.ts) impone una metodología: la escalera del
// dinero, la disciplina de pirámide, el rango completo sin empates, y un formato de razón
// que obliga a COMPARAR contra otra cosa nombrada. Todo eso vivía SOLO en la prosa del
// prompt — y la regla de la casa es que **una regla en un prompt no es una regla**: se
// cumple casi siempre, que es otra cosa.
//
// Se cobró el 2026-08-21. Se shippeó una fórmula que calculaba el score de un proyecto como
// `max(sus tareas) + densidad`, y violaba TRES reglas escritas a la vez —premiaba el tamaño,
// amontonaba doce proyectos entre 95 y 98 con empates, y escribía una razón que describía el
// mecanismo («vale lo que su mejor tarea») en vez de comparar. Ninguna línea de código se dio
// cuenta. Lo vio el dueño, mirando la pantalla.
//
// SIN `server-only` a propósito, como `preguntas-contrato.ts`: lo corre el servidor al
// aplicar la salida del Perro Y lo importa el test. Una validación que ningún test puede
// importar es justo lo que queda sin red.
//
// ⚠️ ESTO NO VUELVE A JUZGAR. No calcula scores, no los corrige y no tiene opinión sobre qué
// mueve la aguja — eso es del Perro y meterse ahí es repetir el error con otra cara. Lo único
// que hace es CONTAR y comparar contra las reglas escritas, y devolver qué se rompió para que
// el caller decida: reintentar, avisar, o registrarlo donde el dueño lo vea.
// =============================================================================

/** Un ítem puntuado por el Perro, del tipo que sea. */
export type Puntuado = { id: string; titulo: string; score: number; razon?: string };

export type Falla = {
  /** la regla, tal como está escrita en la metodología */
  regla: string;
  /** qué se midió, con números */
  detalle: string;
  /** ids de los ítems involucrados, para poder señalarlos */
  ids: string[];
  /** 'dura' = la salida no se puede aplicar así · 'blanda' = se aplica pero hay que avisar */
  peso: 'dura' | 'blanda';
};

// ── Formato de la razón ──────────────────────────────────────────────────────────────

/**
 * Un título, reducido a lo comparable: sin mayúsculas, sin tildes, sin puntuación.
 *
 * El rango de diacríticos va como ESCAPE (`̀-ͯ`) y no como caracteres crudos, por
 * la regla de la casa: un carácter de control o combinante escrito literal se rompe al pasar
 * por una herramienta, y el resultado —una clase de regex que no saca nada— compila igual y
 * falla en silencio. Ya pasó en este mismo archivo mientras se escribía.
 */
export const normalizar = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Lo que la razón cita entre comillas.
 *
 * Se aceptan las angulares (que es lo que pide el prompt), las rectas y las tipográficas:
 * el modelo mezcla las tres y rechazar una comparación buena por el tipo de comilla sería
 * castigar la forma en vez del contenido. Los escapes `“”` van explícitos porque
 * una comilla tipográfica cruda se rompe al pasar por una herramienta y deja una clase de
 * regex que compila y no matchea nada — falla silenciosa, que es la peor.
 *
 * Devuelve SIN repetidos: una misma cita agarrada por dos patrones es ruido en el mensaje.
 */
export function citasDe(razon: string): string[] {
  const out = new Set<string>();
  for (const re of [/«([^»]{3,200})»/g, /"([^"]{3,200})"/g, /“([^”]{3,200})”/g]) {
    for (const m of razon.matchAll(re)) out.add(m[1].trim());
  }
  return [...out];
}

/**
 * ¿La razón COMPARA contra algo real, o es una paráfrasis?
 *
 * La metodología lo pide textual: *«cada "razon" tiene que NOMBRAR entre comillas al menos
 * una tarea concreta del plan y decir por qué esta va arriba o abajo de esa. PROHIBIDO que
 * la razón sea una paráfrasis del título: eso no es una razón, es repetir la tarea con otras
 * palabras — y sin comparación no hay ranking, que es lo único que el Perro produce.»*
 *
 * Se chequean las tres cosas que hacen que una razón sirva, y las tres son verificables:
 *   1. cita algo entre comillas;
 *   2. lo citado EXISTE en el plan — esto además caza el título alucinado, que es el modo de
 *      falla más caro: una comparación contra algo que no existe se lee igual de convincente;
 *   3. lo citado no es el propio ítem, porque compararse con uno mismo no ordena nada.
 */
export function razonCompara(item: Puntuado, universo: Array<{ titulo: string }>): Falla | null {
  const regla = 'La razón tiene que NOMBRAR otra cosa del plan entre comillas y comparar contra ella';
  const razon = (item.razon ?? '').trim();
  if (!razon) return { regla, detalle: 'sin razón', ids: [item.id], peso: 'blanda' };
  const citas = citasDe(razon);
  if (!citas.length) {
    return { regla, detalle: `no cita nada: «${razon.slice(0, 90)}»`, ids: [item.id], peso: 'blanda' };
  }
  const propios = normalizar(item.titulo);
  const conocidos = universo.map((u) => normalizar(u.titulo));
  const utiles = citas
    .map(normalizar)
    .filter((c) => c.length > 4 && c !== propios)
    // Coincidencia por inclusión en los dos sentidos: el modelo recorta títulos largos, y
    // exigir igualdad exacta convertiría una comparación buena en una falla.
    .filter((c) => conocidos.some((k) => k === c || k.includes(c) || c.includes(k)));
  if (!utiles.length) {
    return {
      regla,
      detalle: `cita ${citas.map((c) => `«${c.slice(0, 40)}»`).join(', ')}, que no existe en el plan (o es su propio título)`,
      ids: [item.id], peso: 'blanda',
    };
  }
  return null;
}

// ── Reglas de distribución ───────────────────────────────────────────────────────────

/**
 * «CADA proyecto con un número DISTINTO — PROHIBIDO empatar dos proyectos.»
 *
 * Es DURA: dos proyectos empatados dejan el orden del tablero librado a en qué orden los
 * devolvió Postgres, y el «Objetivo Principal» —que es lo primero que se lee— pasa a
 * depender de eso.
 */
export function sinEmpates(proyectos: Puntuado[]): Falla | null {
  const porScore = new Map<number, string[]>();
  for (const p of proyectos) {
    const a = porScore.get(p.score); if (a) a.push(p.id); else porScore.set(p.score, [p.id]);
  }
  const empatados = [...porScore.entries()].filter(([, ids]) => ids.length > 1);
  if (!empatados.length) return null;
  return {
    regla: 'PROHIBIDO empatar dos proyectos',
    detalle: `${empatados.reduce((n, [, ids]) => n + ids.length, 0)} proyectos en ${empatados.length} empates (scores: ${empatados.map(([s]) => s).join(', ')})`,
    ids: empatados.flatMap(([, ids]) => ids), peso: 'dura',
  };
}

/**
 * «EN TODA LA ESCALA 1-100, sin amontonar. El norte va en 95-100; lo que puede esperar del
 * todo, en 1-10.»
 *
 * Se mide el rango REAL usado, no la varianza: la falla que se vio es exactamente
 * «amontonar» —12 proyectos entre 95 y 98—, y eso un promedio no lo delata.
 */
export function usaTodoElRango(proyectos: Puntuado[], minimo = 6): Falla | null {
  if (proyectos.length < minimo) return null;   // con 3 proyectos el rango no dice nada
  const scores = proyectos.map((p) => p.score);
  const max = Math.max(...scores), min = Math.min(...scores);
  const problemas: string[] = [];
  if (max < 95) problemas.push(`el más alto es ${max} (el norte va en 95-100)`);
  if (min > 15) problemas.push(`el más bajo es ${min} (lo que puede esperar va en 1-10)`);
  // Amontonamiento: más de la mitad de los proyectos en un quinto de la escala.
  const arriba = scores.filter((s) => s >= 80).length;
  if (arriba > Math.max(2, Math.ceil(proyectos.length * 0.3))) {
    problemas.push(`${arriba} de ${proyectos.length} por encima de 80`);
  }
  if (!problemas.length) return null;
  return { regla: 'Los proyectos van en TODA la escala 1-100, sin amontonar', detalle: problemas.join(' · '), ids: [], peso: 'blanda' };
}

/**
 * «Como mucho ~15% en Alta (75-100). Si te salen más, estás inflando.»
 *
 * Blanda: el reparto (`curveTaskScores`) ya fuerza la pirámide después, así que esto no
 * bloquea nada — pero si el modelo devuelve el 60% en Alta, la CURVA lo arregla y el
 * problema real (que comparó mal) queda tapado. Por eso se mide ANTES de curvar: es la
 * única señal de que el juicio vino inflado.
 */
export function piramideSana(tareas: Puntuado[], tope = 0.15): Falla | null {
  if (tareas.length < 20) return null;
  const altas = tareas.filter((t) => t.score >= 75).length;
  const ratio = altas / tareas.length;
  if (ratio <= tope) return null;
  return {
    regla: 'Como mucho ~15% en Alta — si te salen más, estás inflando',
    detalle: `${altas} de ${tareas.length} en Alta (${Math.round(ratio * 100)}%)`,
    ids: [], peso: 'blanda',
  };
}

/**
 * «EL TAMAÑO DE UN PROYECTO NO ES SU PRIORIDAD. Uno con 30 tarjetas no es más norte que uno
 * con 2: la cantidad mide cuánto se ESCRIBIÓ, no cuánta plata mueve.»
 *
 * Parece una regla imposible de verificar y no lo es: se mide la CORRELACIÓN entre el
 * ranking por score y el ranking por cantidad de tareas. Si el Perro está ordenando por
 * tamaño sin darse cuenta, los dos rankings coinciden y eso es un número.
 *
 * Se usa Spearman (correlación de rangos) y no Pearson porque lo que importa es el ORDEN,
 * no la escala. Un valor alto NO prueba que esté mal —puede que los proyectos grandes de
 * verdad sean los importantes— por eso la falla es BLANDA: es una señal para mirar, no un
 * veredicto. Con la fórmula que se revirtió daba prácticamente 1, que era la prueba.
 */
export function noRankeaPorTamano(proyectos: Array<Puntuado & { nTareas: number }>, tope = 0.75): Falla | null {
  const n = proyectos.length;
  if (n < 8) return null;
  const rangos = (vals: number[]): number[] => {
    const orden = vals.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    const r = new Array<number>(n);
    // Rango promedio para los empates: sin esto, dos proyectos con las mismas tareas
    // reciben rangos distintos según en qué orden vinieron y la correlación se ensucia.
    let k = 0;
    while (k < orden.length) {
      let j = k; while (j + 1 < orden.length && orden[j + 1].v === orden[k].v) j++;
      const medio = (k + j) / 2 + 1;
      for (let x = k; x <= j; x++) r[orden[x].i] = medio;
      k = j + 1;
    }
    return r;
  };
  const rs = rangos(proyectos.map((p) => p.score));
  const rt = rangos(proyectos.map((p) => p.nTareas));
  const d2 = rs.reduce((acc, v, i) => acc + (v - rt[i]) ** 2, 0);
  const rho = 1 - (6 * d2) / (n * (n * n - 1));
  if (rho <= tope) return null;
  return {
    regla: 'El TAMAÑO de un proyecto no es su prioridad',
    detalle: `el ranking por score y el ranking por cantidad de tareas coinciden en ${rho.toFixed(2)} (Spearman): está ordenando por tamaño`,
    ids: [], peso: 'blanda',
  };
}

// ── La pasada completa ───────────────────────────────────────────────────────────────

export type Auditoria = { fallas: Falla[]; duras: number; blandas: number; ok: boolean };

/**
 * Corre TODAS las reglas verificables sobre una salida del Perro.
 *
 * `ok` es false solo si hay fallas DURAS: una salida con fallas blandas se aplica igual —
 * negarse a priorizar porque una razón salió floja deja al dueño sin tablero, que es peor.
 * Pero las blandas no se tragan: el caller las registra donde él las vea.
 */
export function auditarSalidaDelPerro(entrada: {
  proyectos?: Array<Puntuado & { nTareas?: number }>;
  tareas?: Puntuado[];
}): Auditoria {
  const fallas: Falla[] = [];
  const proyectos = entrada.proyectos ?? [];
  const tareas = entrada.tareas ?? [];
  const universo = [...proyectos, ...tareas];

  if (proyectos.length) {
    const e = sinEmpates(proyectos); if (e) fallas.push(e);
    const r = usaTodoElRango(proyectos); if (r) fallas.push(r);
    if (proyectos.every((p) => typeof p.nTareas === 'number')) {
      const t = noRankeaPorTamano(proyectos as Array<Puntuado & { nTareas: number }>); if (t) fallas.push(t);
    }
  }
  if (tareas.length) {
    const p = piramideSana(tareas); if (p) fallas.push(p);
  }
  // La razón se audita item por item, pero se REPORTA agrupada: 40 fallas idénticas no le
  // dicen a nadie más que una que diga «40 de 71».
  const sinComparar = universo.map((i) => razonCompara(i, universo)).filter((f): f is Falla => f != null);
  if (sinComparar.length) {
    fallas.push({
      regla: sinComparar[0].regla,
      detalle: `${sinComparar.length} de ${universo.length} no comparan contra nada del plan · ej: ${sinComparar.slice(0, 3).map((f) => f.detalle).join(' | ')}`,
      ids: sinComparar.flatMap((f) => f.ids), peso: 'blanda',
    });
  }

  const duras = fallas.filter((f) => f.peso === 'dura').length;
  return { fallas, duras, blandas: fallas.length - duras, ok: duras === 0 };
}

/** Una línea por falla, para el log y para la pantalla. */
export const textoAuditoria = (a: Auditoria): string =>
  a.fallas.map((f) => `${f.peso === 'dura' ? '⛔' : '⚠️'} ${f.regla} → ${f.detalle}`).join('\n');
