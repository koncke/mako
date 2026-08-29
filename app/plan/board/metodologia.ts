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
  // ⚠️ EL `universo` TIENE QUE SER DEL MISMO NIVEL QUE EL ÍTEM: un proyecto se compara con
  // otro PROYECTO, una tarea con otra TAREA. La primera versión de esto le pasaba
  // `[...proyectos, ...tareas]` a los dos, y con eso la razón que originó todo el problema
  // —«Vale lo que su mejor tarea: "Closing Analyst: la conclusión antes que la evidencia"»—
  // PASABA la validación, porque esa tarea existe. Un validador que aprueba justo el caso
  // que vino a cazar es peor que no tenerlo: da la tranquilidad sin dar la garantía.
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
export function usaTodoElRango(proyectos: Puntuado[], minimo = 6, tipo: 'proyecto' | 'tarea' = 'proyecto'): Falla | null {
  const n = proyectos.length;
  if (n < minimo) return null;   // con 3 proyectos el rango no dice nada
  const scores = proyectos.map((p) => p.score);
  const max = Math.max(...scores), min = Math.min(...scores);
  // ⚠️ EL PISO SALE DE LA CANTIDAD, no de una constante. La versión anterior exigía `min <=
  // 15` para cualquier tablero: marcaba como falla uno de 71 proyectos que estaba bien
  // (`min = 30`, que es lo máximo que la aritmética permite con 71 valores distintos) y no
  // habría marcado uno de 100 que se quedara en 20. Ver `escalaEsperada`.
  const { piso, techo } = escalaEsperada(n, tipo);
  const problemas: string[] = [];
  if (max < techo - 5) problemas.push(`el más alto es ${max} (el norte va en ${techo - 5}-${techo})`);
  if (min > piso) problemas.push(`el más bajo es ${min} y con ${n} proyectos sin empatar tiene que llegar a ${piso} o menos`);
  if (!problemas.length) return null;
  return { regla: 'La escala se abre tanto como proyectos haya', detalle: problemas.join(' · '), ids: [], peso: 'blanda' };
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
  const n = tareas.length;
  if (n < 20) return null;
  const altas = tareas.filter((t) => t.score >= 75).length;
  const cupo = Math.max(1, Math.round(n * tope));
  if (altas <= cupo) return null;
  return {
    regla: 'Como mucho ~15% en Alta — si te salen más, estás inflando',
    detalle: `${altas} de ${n} en Alta (${Math.round((altas / n) * 100)}%), y el cupo con ${n} tareas es ${cupo}`,
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
  // dicen a nadie más que una que diga «40 de 71». Y cada nivel contra SU nivel.
  const sinComparar = [
    ...proyectos.map((i) => razonCompara(i, proyectos)),
    ...tareas.map((i) => razonCompara(i, tareas)),
  ].filter((f): f is Falla => f != null);
  if (sinComparar.length) {
    // ⚠️ SI LA MAYORÍA NO COMPARA, ES DURA. Una razón floja suelta se tolera; un ranking
    // donde la mitad de las razones se comparan CONSIGO MISMAS («Le gana a "Feature:
    // Mindset"» escrito adentro de «Feature: Mindset») no es un ranking auditable — es el
    // formato copiado sin el contenido, y el dueño no tiene con qué discutirlo. Medido en la
    // primera corrida real: 54 de 66. Con esto se reintenta diciéndole exactamente eso.
    const masivo = sinComparar.length >= Math.max(5, (proyectos.length + tareas.length) * 0.5);
    fallas.push({
      peso: masivo ? 'dura' : 'blanda',
      regla: sinComparar[0].regla,
      detalle: `${sinComparar.length} de ${proyectos.length + tareas.length} no comparan contra nada del plan · ej: ${sinComparar.slice(0, 3).map((f) => f.detalle).join(' | ')}`,
      ids: sinComparar.flatMap((f) => f.ids),
    });
  }

  const duras = fallas.filter((f) => f.peso === 'dura').length;
  return { fallas, duras, blandas: fallas.length - duras, ok: duras === 0 };
}

/** Una línea por falla, para el log y para la pantalla. */
export const textoAuditoria = (a: Auditoria): string =>
  a.fallas.map((f) => `${f.peso === 'dura' ? '⛔' : '⚠️'} ${f.regla} → ${f.detalle}`).join('\n');

/**
 * Desempata SIN redistribuir: el mínimo movimiento que hace cumplir «PROHIBIDO empatar».
 *
 * ⚠️ ES EL REEMPLAZO DE `spreadProjScores`, Y LA DIFERENCIA ES TODA LA LECCIÓN DE ESTE
 * ARCHIVO. Aquel reparte los proyectos en 1..100 estrictamente decreciente: con 71
 * proyectos escribe 100, 99, 97, 96… 1, o sea **el score guardado deja de ser el juicio y
 * pasa a ser la POSICIÓN en el ranking**. El efecto se ve en pantalla: el modelo dice «95 →
 * 34» en la razón y el número que se muestra es otro, porque lo escribió el reparto. La
 * razón y el número vuelven a salir de dos mecanismos distintos — la forma exacta del bug
 * que este board acaba de pagar.
 *
 * Acá el juicio se conserva: al empatado se lo baja de a 1 hasta encontrar un hueco libre.
 * Un proyecto en 88 sigue en 88 y su vecino queda en 87 — la DISTANCIA entre dos proyectos
 * sigue significando algo (que es lo único que un reparto lineal borra), y si el modelo
 * amontonó, eso lo dice `usaTodoElRango` en vez de taparlo.
 *
 * Estable: el orden de entrada decide quién se queda con el número original.
 */
export function desempatar(items: Puntuado[]): Record<string, number> {
  const usados = new Set<number>();
  const out: Record<string, number> = {};
  for (const it of items.slice().sort((a, b) => b.score - a.score)) {
    let v = Math.max(1, Math.min(100, it.score));
    while (usados.has(v) && v > 1) v--;
    // Si abajo no quedaba lugar (el 1 ocupado), se busca para arriba. Solo pasa con más de
    // 100 proyectos, y ahí el problema es otro — pero no puede devolver un empate igual.
    while (usados.has(v) && v < 100) v++;
    usados.add(v);
    out[it.id] = v;
  }
  return out;
}

// ── LA ESCALA SE ABRE TANTO COMO COSAS HAYA ──────────────────────────────────────────

/**
 * Hasta dónde tiene que llegar la escala con `n` ítems.
 *
 * La regla la dio el dueño mirando su tablero, y es aritmética, no gusto:
 *
 *   *«Está bien que ahora haya llegado hasta el 30 en el menor de los proyectos, porque yo
 *   tengo 71 proyectos. Pero si tuviera 100, debería llegar hasta el 1. Lo mismo debería
 *   pasar con las tareas: si tengo pocas no es lo mismo que si tengo muchas.»*
 *
 * Sale sola de juntar dos reglas que ya estaban escritas: «el norte va en 95-100» y
 * «PROHIBIDO empatar». Si el más alto está en 100 y hay `n` valores distintos, el más bajo
 * NO PUEDE estar por encima de `101 - n`. Con 71 proyectos eso da exactamente 30 — el número
 * que él señaló como correcto — y con 100 da 1.
 *
 * Lo que la fórmula arregla en las DOS direcciones:
 *  · Con MUCHOS ítems exige llegar al fondo. La validación fija que había antes («el más
 *    bajo tiene que ser ≤ 15») marcaba como falla un tablero de 71 proyectos que estaba
 *    bien, y no habría marcado uno de 100 que se quedara en 20.
 *  · Con POCOS deja de exigir un fondo que no existe. `curveTaskScores` estiraba de 93 a 2
 *    sin mirar cuántas tareas había: MEDIDO, con 5 tareas ya mandaba 2 a «A futuro» con
 *    score 2. O sea le decía a un cliente que acaba de escribir cinco cosas que dos no
 *    importan — y con 550 hacía exactamente lo mismo. La forma era idéntica; lo único que
 *    cambiaba era cuántas caían en cada banda.
 *
 * ⚠️ POR QUÉ EL MISMO NÚMERO SIRVE PARA LOS DOS, aunque las razones sean distintas:
 *  · En PROYECTOS es aritmética pura y no hay margen: no pueden empatar, así que `n` valores
 *    distintos ocupan `n` escalones y el más bajo no puede estar más arriba de `101 - n`.
 *  · En TAREAS sí pueden empatar, así que no hay obligación aritmética — pero la misma
 *    cuenta expresa bien la idea de fondo: la escala se abre tantos escalones como cosas
 *    haya, y recién con ~90 tareas tiene sentido que alguna toque el piso de «A futuro».
 *    Debajo de 5 no se curva nada (`curveTaskScores` ya devuelve el juicio tal cual): con
 *    tan pocas, cualquier distribución forzada es una invención.
 */
export function escalaEsperada(n: number, tipo: 'proyecto' | 'tarea' = 'proyecto'): { techo: number; piso: number } {
  // El techo de las TAREAS es 93 y no 100: es donde arranca la pirámide de `curveTaskScores`
  // (93→76 Alta · 72→51 Media · 48→26 Baja · 23→2 A futuro). Los 100 son para proyectos,
  // que se comparan entre sí en su propia escala.
  const techo = tipo === 'proyecto' ? 100 : 93;
  return { techo, piso: Math.max(tipo === 'proyecto' ? 1 : 2, techo + 1 - Math.max(1, n)) };
}

/**
 * Los CUPOS por banda, en números absolutos, para decírselos al modelo.
 *
 * Un modelo respeta «de estos 71, como mucho 11 pueden quedar por encima de 80» muchísimo
 * mejor que «~15% en Alta». El porcentaje lo tiene que traducir él mientras hace otras diez
 * cosas; el número ya está traducido, y además se puede CONTAR después — que es la mitad
 * que faltaba.
 *
 * ⚠️ El cupo de arriba es `null` cuando la aritmética lo vuelve imposible, y esto importa:
 * con 71 proyectos sin empatar y un rango de 70, los valores 81-100 se ocupan sí o sí, así
 * que exigir «solo 11 arriba de 80» sería pedir algo que no se puede cumplir. La disciplina
 * del 15% es de TAREAS —que empatan y son cientos—, no de proyectos. Aplicarla a los
 * proyectos era generar una falla permanente que nadie podría arreglar nunca, y una alarma
 * que siempre suena es una alarma apagada.
 */
export function cuposDeDistribucion(n: number, tipo: 'proyecto' | 'tarea'): {
  n: number; piso: number; maxArriba: number | null; minAbajo: number; texto: string;
} {
  const { piso } = escalaEsperada(n, tipo);
  if (tipo === 'proyecto') {
    return {
      n, piso, maxArriba: null,
      minAbajo: Math.max(1, Math.round(n * 0.15)),
      texto: `Son ${n} proyectos. El norte (uno solo) va en 95-100. Como NO puedes empatar, el más bajo tiene que quedar en ${piso} o menos — con ${n} proyectos distintos no hay forma de que todos entren más arriba. Y al menos ${Math.max(1, Math.round(n * 0.15))} tienen que quedar en la parte de abajo de la escala: son los que pueden esperar del todo, y en un plan real siempre los hay.`,
    };
  }
  const maxArriba = Math.max(1, Math.round(n * 0.15));
  return {
    n, piso, maxArriba,
    minAbajo: Math.max(1, Math.round(n * 0.25)),
    texto: `Son ${n} tareas. Como mucho ${maxArriba} pueden quedar en Alta (75-100) — si te salen más, estás inflando. ${n >= 90 ? `Al menos ${Math.max(1, Math.round(n * 0.25))} van en "A futuro" (1-24).` : `Con solo ${n} tareas NO fuerces el fondo de la escala: la más baja tiene que quedar alrededor de ${piso}, no en 2. Mandar a "A futuro" algo de un plan de ${n} tareas es decirle al dueño que lo que acaba de escribir no importa.`}`,
  };
}

// ── EL DEBATE: CUANDO EL NÚMERO LO PIDE EL DUEÑO ─────────────────────────────────────

export type Veredicto = 'acepta' | 'ajusta' | 'rechaza';

/**
 * El veredicto se DERIVA de los tres números. No se lee de la etiqueta que manda el modelo.
 *
 * Lo que reemplaza —`coerceVeredicto`, que hacía `return subio ? 'acepta' : 'rechaza'`— tenía
 * dos agujeros y los dos se pagan en la pantalla del dueño:
 *
 *  1. Miraba SOLO el signo del delta contra el score actual, sin saber qué se había pedido.
 *     Una BAJADA que el dueño pidió y el Perro concedió (32 → 20) salía etiquetada
 *     «rechaza», y entonces el guard de «un rechazo no mueve el número» le descartaba la
 *     concesión. El Perro decía que sí y el tablero no se enteraba.
 *  2. Cualquier string fuera del enum colapsaba a uno de los dos. Un modelo que devuelva
 *     `veredicto: "pregunta"` —o `"parcial"`, o vacío— con el número subido se lee como una
 *     ACEPTACIÓN. Y una aceptación acá mueve el tablero entero.
 *
 * Con esto, la etiqueta no es un dato del modelo: es una lectura de lo que el modelo HIZO.
 * El modelo devuelve un número y una razón; qué significa ese número lo decide el código.
 * Es la misma regla de «cuando dos señales se contradicen, gana la más cara de producir»:
 * un `veredicto` es un token que se tira sin pensar, un score es la decisión.
 */
export function veredictoDe(pedido: number, actual: number, final: number): Veredicto {
  const pedida = Math.sign(pedido - actual);
  const lograda = Math.sign(final - actual);
  if (pedida === 0) return 'rechaza'; // no pidió nada: no hay nada que conceder
  if (lograda !== pedida) return 'rechaza'; // no se movió, o se movió al revés
  return final === pedido ? 'acepta' : 'ajusta';
}

/**
 * Desempata RESERVANDO primero los valores que no se pueden mover.
 *
 * `desempatar` es estable por orden de entrada, así que «poner el fijado primero» ya
 * alcanzaría — pero eso es un truco que se pierde en el próximo refactor y que además no
 * cubre a los OTROS ítems con `score_manual`. Acá la reserva es explícita.
 *
 * ⚠️ CIERRA UN BUG VIVO. `priorizarProyectosOwner` mete al proyecto con `score_manual` en el
 * array de `desempatar` con su score, y después lo escribe con `antes.score` ignorando lo que
 * desempatar decidió. Si el modelo le daba 100 a otro proyecto y ese aparecía antes, quedaban
 * DOS en 100 en la base — justo la falla dura que `sinEmpates` existe para cazar, escrita por
 * el mismo código que la corre.
 *
 * Los fijados entre sí también se resuelven (si el dueño clavó dos en 80, uno tiene que
 * bajar), pero en un orden determinista y ANTES que todo lo demás.
 */
export function fijarYDesempatar(items: Puntuado[], fijados: Record<string, number>): Record<string, number> {
  const usados = new Set<number>();
  const out: Record<string, number> = {};
  const tomar = (id: string, deseado: number) => {
    let v = Math.max(1, Math.min(100, Math.round(deseado)));
    while (usados.has(v) && v > 1) v--;
    while (usados.has(v) && v < 100) v++;
    usados.add(v);
    out[id] = v;
  };
  const esFijo = (id: string) => Object.prototype.hasOwnProperty.call(fijados, id);
  const orden = (a: Puntuado, b: Puntuado) => b.score - a.score || (a.id < b.id ? -1 : 1);
  for (const it of items.filter((i) => esFijo(i.id)).sort((a, b) => (fijados[b.id] ?? 0) - (fijados[a.id] ?? 0) || (a.id < b.id ? -1 : 1))) tomar(it.id, fijados[it.id]);
  for (const it of items.filter((i) => !esFijo(i.id)).slice().sort(orden)) tomar(it.id, it.score);
  return out;
}

/**
 * La cascada movió números, pero NO puede haber reordenado nada.
 *
 * Es la propiedad que separa «arreglar la escala» de «volver a juzgar». Cuando el dueño fija
 * un proyecto en 87, los que estaban abajo se corren de a uno para hacerle lugar: eso es
 * aritmética de huecos y está bien. Lo que no puede pasar es que dos proyectos que él no
 * tocó se crucen entre sí — ahí el tablero le cambió el criterio a algo que no discutió, y
 * la próxima vez que mire no va a saber por qué.
 *
 * Falla DURA: si el orden relativo cambió, no se escribe una sola fila.
 */
export function mismoOrdenRelativo(antes: Puntuado[], despues: Record<string, number>, exceptoId: string): Falla | null {
  const previo = new Map(antes.map((p) => [p.id, p.score]));
  const otros = antes.filter((p) => p.id !== exceptoId && despues[p.id] != null).map((p) => p.id);
  const cruces: string[] = [];
  for (let i = 0; i < otros.length; i++) {
    for (let j = i + 1; j < otros.length; j++) {
      const a = otros[i], b = otros[j];
      const antesSigno = Math.sign((previo.get(a) ?? 0) - (previo.get(b) ?? 0));
      const despuesSigno = Math.sign(despues[a] - despues[b]);
      if (antesSigno !== 0 && despuesSigno !== 0 && antesSigno !== despuesSigno) cruces.push(`${a}↔${b}`);
    }
  }
  if (!cruces.length) return null;
  return {
    regla: 'Mover UNO no puede reordenar a los otros: la cascada arregla la escala, no vuelve a juzgar',
    detalle: `${cruces.length} par${cruces.length === 1 ? '' : 'es'} de proyectos que el dueño no tocó se cruzaron entre sí (${cruces.slice(0, 4).join(', ')}${cruces.length > 4 ? '…' : ''})`,
    ids: [...new Set(cruces.flatMap((c) => c.split('↔')))],
    peso: 'dura',
  };
}

/**
 * Lo que el dueño fijó a mano no se mueve. Nunca, ni de a uno.
 *
 * El candado de `score_manual` existe para que la corrida automática de mañana no pise un
 * número que se discutió. Una cascada que lo corre «solo un punto» lo apaga igual de bien:
 * el dueño puso 80 porque 80 significaba algo contra el de al lado, y 79 ya es otra cosa.
 */
export function noPisaManuales(antes: Puntuado[], despues: Record<string, number>, manuales: string[], exceptoId?: string): Falla | null {
  const fijos = new Set(manuales.filter((id) => id !== exceptoId));
  const movidos = antes.filter((p) => fijos.has(p.id) && despues[p.id] != null && despues[p.id] !== p.score);
  if (!movidos.length) return null;
  return {
    regla: 'Un score fijado a mano no lo mueve ninguna corrida automática (mig 0143)',
    detalle: movidos.map((p) => `«${p.titulo}» ${p.score} → ${despues[p.id]}`).join(' · '),
    ids: movidos.map((p) => p.id),
    peso: 'dura',
  };
}

/**
 * El ítem que se debatió TIENE que estar en la salida, y su número tiene que haberse movido
 * en la dirección que se pidió (o quedarse quieto, que es un rechazo válido).
 *
 * Que el modelo se olvide justo del que se estaba discutiendo es la falla más cara acá: el
 * dueño argumentó, esperó, y el tablero no cambió nada sin decirle por qué.
 */
export function respetaElReclamo(r: { id: string; scorePedido: number; scoreActual: number }, despues: Record<string, number>): Falla | null {
  const final = despues[r.id];
  if (final == null) {
    return { regla: 'El ítem que se debate no puede faltar en la salida', detalle: `se pidió mover «${r.id}» de ${r.scoreActual} a ${r.scorePedido} y no vino en la respuesta`, ids: [r.id], peso: 'dura' };
  }
  const pedida = Math.sign(r.scorePedido - r.scoreActual);
  const lograda = Math.sign(final - r.scoreActual);
  if (pedida !== 0 && lograda !== 0 && lograda !== pedida) {
    return { regla: 'Conceder al revés de lo que se pidió no es un veredicto: es un error', detalle: `se pidió ${pedida > 0 ? 'subir' : 'bajar'} de ${r.scoreActual} a ${r.scorePedido} y quedó en ${final}`, ids: [r.id], peso: 'dura' };
  }
  return null;
}
