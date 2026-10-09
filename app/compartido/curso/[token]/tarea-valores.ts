// =============================================================================
// tarea-valores — la forma de lo que el alumno contesta, del lado de la pantalla (puro)
// =============================================================================
// Sin 'use client' ni 'server-only': lo usa el formulario de la tarea (TareaAlumno.tsx) y lo
// EJECUTA tests/curso-portal.test.ts. Las reglas que deciden en el server (sanear, «¿alcanza para
// enviar?») viven en lib/curso.ts; acá está lo que la pantalla necesita para dibujar y para decir
// QUÉ falta antes de mandar.
//
// ⚠️ NO SE IMPORTA NADA DE lib/curso-portal.ts: ese módulo trae, por `import()`, la capa de datos
// con `server-only`, y un componente cliente que lo importara arrastraría ese grafo al navegador.

import { camposConRespuesta, campoLleno, campoCompleto, NOTA_MIN_DEFAULT, type Calificacion, type Campo, type NotaQuiz, type Valores, type ValorCampo } from '@/lib/curso';
// SÓLO TIPOS (se borran al compilar): el aviso de arriba sigue en pie para los valores.
import type { VistaAlumno, ClaseVista } from '@/lib/curso-portal';

const esTabla = (v: ValorCampo | undefined): v is string[][] => Array.isArray(v) && v.length > 0 && Array.isArray(v[0]);
const ncol = (c: Campo) => Math.max(1, c.columnas?.length ?? 1);

/** Un renglón vacío de una tabla, del ancho de sus columnas. */
export const filaVacia = (c: Campo): string[] => Array.from({ length: ncol(c) }, () => '');

/**
 * Las filas que la tabla muestra para editar: lo guardado, completado hasta lo que pide el
 * formulario. Con filas FIJAS, la primera columna es su etiqueta (el molde del programa viejo,
 * `tablaParaEditar` en 07d07139^:lib/cs-valores.ts) y se guarda con ella: así lo contestado se
 * lee solo, sin tener que cruzarlo con el formulario. Con `filasMin`, se ven todas desde el
 * arranque — un botón «Agregar fila» esconde lo que se está pidiendo.
 */
export function filasDeTabla(c: Campo, guardado: ValorCampo | undefined): string[][] {
  const n = ncol(c);
  const base = esTabla(guardado) ? guardado : [];
  const filas = base.map((f) => {
    const fila = (Array.isArray(f) ? f : []).map((x) => String(x ?? ''));
    while (fila.length < n) fila.push('');
    return fila.slice(0, n);
  });
  if (c.filasFijas?.length) {
    return c.filasFijas.map((etiqueta, i) => {
      const f = filas[i] ?? filaVacia(c);
      return [etiqueta, ...f.slice(1)];
    });
  }
  const minimo = Math.max(1, c.filasMin ?? 1);
  while (filas.length < minimo) filas.push(filaVacia(c));
  return filas;
}

// ¿Este campo tiene algo contestado? La regla es la del SERVER (`campoLleno`, lib/curso.ts):
// hasta el 06/10/2026 estaba escrita dos veces y la del server contaba la etiqueta de una fila
// fija como respuesta. Se re-exporta con el mismo nombre porque la usan el formulario y su test.
// `campoCompleto` (#18): lo que pide un OBLIGATORIO — una checklist entera, un quiz contestado entero.
export { campoLleno, campoCompleto };

export type QueFalta =
  | { tipo: 'respuesta' }
  | { tipo: 'alguno' }
  | { tipo: 'campos'; labels: string[] };

/**
 * Qué le falta para poder ENVIAR, o `null` si ya alcanza. Es la misma regla que el server
 * (`respuestaCompleta`): sin campos, la respuesta libre; con campos, los obligatorios; sin
 * ninguno obligatorio, al menos uno contestado.
 */
export function queFalta(todos: readonly Campo[], valores: Valores): QueFalta | null {
  // Sin las `seccion` (item 12 del 08/10/2026): una no se contesta, y contada como campo dejaba la tarea
  // diciendo «contesta al menos una» para siempre. La misma puerta que el server (`respuestaCompleta`).
  const campos = camposConRespuesta(todos);
  if (!campos.length) {
    const r = valores.respuesta;
    return typeof r === 'string' && r.trim() ? null : { tipo: 'respuesta' };
  }
  const obligatorios = campos.filter((c) => c.obligatorio);
  if (!obligatorios.length) return campos.some((c) => campoLleno(c, valores[c.id])) ? null : { tipo: 'alguno' };
  const faltan = obligatorios.filter((c) => !campoCompleto(c, valores[c.id]));
  return faltan.length ? { tipo: 'campos', labels: faltan.map((c) => c.label) } : null;
}

// ── Lo que se dice de los tipos de la #18 (07/10/2026) ──────────────────────

/** Un tamaño de archivo, corto: «820 KB», «2,4 MB». */
export function fraseDeBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Segundos como un reloj: 65 → «1:05». */
export function reloj(seg: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seg) ? seg : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Lo que se le dice al alumno de UN quiz después de corregirlo, en frases cortas. `null` = todavía no
 * lo envió. Sin la respuesta correcta (no viaja): las preguntas que erró, por su número.
 *
 * ⚠️ «Sin intentos» se dice cuando el tope está y se usó entero SIN aprobar: es lo mismo que mira el
 * server para rechazar (`corregirEnvio`). Con dos reglas, la pantalla ofrecería «Enviar» sobre un
 * quiz que el server ya no corrige.
 */
export function estadoDeQuiz(c: Pick<Campo, 'notaMin' | 'intentos'>, n: NotaQuiz | undefined): {
  aprobado: boolean; sinIntentos: boolean; titulo: string; detalle: string | null;
} | null {
  if (!n) return null;
  if (n.aprobado) return { aprobado: true, sinIntentos: false, titulo: `Aprobado · ${n.nota} %`, detalle: null };
  const tope = c.intentos ?? 0;
  // `quedan === 0` es `quizCerrado` sin aprobar (abajo): la misma cuenta que el server.
  const quedan = tope > 0 ? Math.max(0, tope - n.intentos) : null;
  const malas = (n.malas ?? []).map((i) => i + 1);
  const partes = [
    malas.length ? `Revisa: ${malas.slice(0, 8).join(', ')}${malas.length > 8 ? '…' : ''}.` : null,
    quedan == null ? null : quedan === 0 ? 'Ya no quedan intentos.' : quedan === 1 ? 'Te queda 1 intento.' : `Te quedan ${quedan} intentos.`,
  ].filter(Boolean);
  return {
    aprobado: false,
    sinIntentos: quizCerrado(c, n),
    titulo: `Sacaste ${n.nota} %. Necesitas ${c.notaMin ?? NOTA_MIN_DEFAULT} %.`,
    detalle: partes.length ? partes.join(' ') : null,
  };
}

// ── El quiz corregido: si acertó, y la correcta cuando ya no hay vuelta atrás ──────────────────
// El audio del 08/10 a la noche (docs/feedback-curso-08oct-noche.md, puntos 3 y 5): «hay un error en el
// quiz que no te dice el resultado» —en la vista previa no decía nada— y como alumno de verdad decía
// «Aprobado · 100 %» sin decir qué pregunta estaba bien. Ahora cada pregunta dice si acertó, y en la que
// erró, la respuesta correcta cuando el quiz ya está cerrado.

/**
 * ¿El quiz ya no se vuelve a contestar? Aprobado (el server no lo vuelve a corregir, `corregirEnvio`), o
 * con un tope de intentos usado entero sin aprobar (el server ya no lo corrige). Es la MISMA cuenta que
 * `corregirEnvio` y que «Ya no quedan intentos» de `estadoDeQuiz`.
 *
 * Es la condición para mostrar la RESPUESTA CORRECTA: con intentos por delante, mostrarla sería darle el
 * examen resuelto. Sin tope (`intentos` 0) y sin aprobar no se cierra nunca: se le dice qué erró y nada más.
 *
 * ⚠️ El equipo puede reabrirlo DESPUÉS (`darOtroIntento` en lib/curso-entregas.ts, o subiendo el tope):
 *    para entonces el alumno ya vio las correctas. Es el costo de la regla, y lo decide quien lo reabre.
 */
export function quizCerrado(c: Pick<Campo, 'intentos'>, n: NotaQuiz | undefined): boolean {
  if (!n) return false;
  if (n.aprobado) return true;
  const tope = c.intentos ?? 0;
  return tope > 0 && n.intentos >= tope;
}

/** Cómo le fue en UNA pregunta de un quiz corregido. */
export type RevisionPregunta = {
  /** `true` acertó, `false` erró, `null` = no se sabe (sin corregir, o una nota vieja sin `malas`). */
  bien: boolean | null;
  /** La respuesta correcta: SÓLO en una que erró, con el quiz cerrado (`quizCerrado`) y si llegó. */
  correctas: string[] | null;
};

/**
 * Pregunta por pregunta: si acertó (sale de `malas`, las posiciones que el server guarda con la nota) y,
 * en las que erró, la correcta cuando ya se puede decir.
 *
 * ⚠️ SE DECIDE CON `quizCerrado`, NUNCA CON «¿LLEGARON LAS CORRECTAS?». La vista previa del equipo las
 *    tiene siempre (corrige en local, como el server) y al alumno le llegan recién con el quiz cerrado
 *    (`revelarCorrectas`): decidiendo por lo que llegó, la vista previa mostraría la correcta al primer
 *    intento y el alumno no, que es justo el punto 5 («la previsualización y la vista real no coinciden»).
 */
export function revisionDeQuiz(c: Pick<Campo, 'preguntas' | 'intentos'>, n: NotaQuiz | undefined): RevisionPregunta[] {
  const ps = c.preguntas ?? [];
  if (!n) return ps.map(() => ({ bien: null, correctas: null }));
  const malas = Array.isArray(n.malas) ? new Set(n.malas) : null;
  const cerrado = quizCerrado(c, n);
  return ps.map((p, i) => {
    // Una nota sin `malas` (de antes de guardarlas) sólo dice algo en los extremos.
    const bien = malas ? !malas.has(i) : n.nota === 100 ? true : n.nota === 0 ? false : null;
    const correctas = bien === false && cerrado && p.correctas?.length ? [...p.correctas] : null;
    return { bien, correctas };
  });
}

/**
 * Los campos con las correctas de sus quizzes DE VUELTA (las saca `camposParaAlumno`), tomadas de los
 * campos de la BASE por id de campo y de pregunta (un renglón borrado o agregado no corre nada). `cuales`
 * elige los quizzes: sin él, todos — la vista previa del EQUIPO, que corrige en local igual que el server
 * (`respuestaDeVistaPrevia` en ./TareaAlumno.tsx); con él, sólo esos — el alumno, los cerrados. No muta
 * lo que recibe.
 */
export function conCorrectas(campos: readonly Campo[], base: readonly Campo[], cuales?: (c: Campo) => boolean): Campo[] {
  const deLaBase = new Map(base.filter((b) => b.tipo === 'quiz').map((b) => [b.id, b]));
  return campos.map((c) => {
    const b = c.tipo === 'quiz' ? deLaBase.get(c.id) : undefined;
    if (!b || !c.preguntas || (cuales && !cuales(b))) return c;
    const porId = new Map((b.preguntas ?? []).map((p) => [p.id, p.correctas ?? []]));
    return { ...c, preguntas: c.preguntas.map((p) => ({ ...p, correctas: [...(porId.get(p.id) ?? [])] })) };
  });
}

/** Los ids de los quizzes cerrados de una respuesta. */
const quizzesCerrados = (campos: readonly Campo[], calif: Calificacion | undefined): string[] =>
  campos.filter((c) => c.tipo === 'quiz' && quizCerrado(c, calif?.[c.id])).map((c) => c.id);

/**
 * Las clases de la vista con algún quiz cerrado: las únicas cuyos campos de la base hace falta leer para
 * `revelarCorrectas` (casi siempre ninguna: la página no paga una lectura de más).
 */
export function clasesConQuizCerrado(vista: VistaAlumno): number[] {
  const out: number[] = [];
  for (const p of vista.productos) {
    for (const m of p.modulos) {
      for (const c of m.clases) {
        if ('cerrada' in c || c.areas) continue;
        if (quizzesCerrados(camposConRespuesta(c.campos), c.calificacion).length) out.push(c.id);
      }
    }
  }
  return out;
}

/**
 * La vista del alumno con las correctas de sus quizzes CERRADOS puestas de vuelta (punto 3): después de
 * aprobar, o sin intentos, se le dice cuál era la respuesta de lo que erró. Las de un quiz abierto siguen
 * sin viajar. `baseDe` da los campos de la base de una clase (con las correctas); sin ellos, nada cambia.
 *
 * ⚠️ SÓLO EN LAS CLASES QUE SE CONTESTAN UNA VEZ. En una POR ÁREA la nota es de cada área y los campos
 *    son de la clase: revelarlas porque cerró un área le abriría el examen a las otras. Ahí se dice qué
 *    erró, sin la correcta.
 */
export function revelarCorrectas(vista: VistaAlumno, baseDe: (claseId: number) => readonly Campo[] | undefined): VistaAlumno {
  return enCadaClase(vista, (c) => {
    if (c.areas) return c;
    const ids = new Set(quizzesCerrados(camposConRespuesta(c.campos), c.calificacion));
    const base = ids.size ? baseDe(c.id) : undefined;
    // La lista ENTERA vuelve a la vista (con sus secciones, que el alumno lee): `conCorrectas` toca sólo
    // los quizzes elegidos y deja pasar todo lo demás tal cual.
    return base ? { ...c, campos: conCorrectas(c.campos, base, (b) => ids.has(b.id)) } : c;
  });
}

/**
 * La vista previa del EQUIPO con TODAS las correctas de vuelta (punto 5 del audio del 08/10 a la noche:
 * «en la previsualización no se ve la respuesta correcta, pero como alumno me aparece»). `claseVista` se
 * las saca, y sin ellas la vista previa no podía corregir —daba el quiz por enviado, sin nota— mientras
 * al alumno el server sí lo corregía. Con ellas, `TareaAlumno` corrige en local igual que el server
 * (`corregirEnvio`), y CUÁNDO se muestra la correcta lo decide la misma regla que al alumno
 * (`revisionDeQuiz`). Es el equipo: las correctas ya las ve en la tab.
 *
 * ⚠️ NUNCA EN LA PUERTA DE UN ALUMNO: ahí van sólo las de sus quizzes cerrados (`revelarCorrectas`).
 * `clases`: las de la base del producto, con sus campos como los lee la página (con las correctas).
 */
export function conCorrectasDelEquipo(vista: VistaAlumno, clases: ReadonlyArray<{ id: number; campos: readonly Campo[] }>): VistaAlumno {
  const deLaBase = new Map(clases.map((c) => [c.id, camposConRespuesta(c.campos)]));
  return enCadaClase(vista, (c) => {
    const base = deLaBase.get(c.id);
    return base ? { ...c, campos: conCorrectas(c.campos, base) } : c;
  });
}

/** Cada clase ABIERTA de la vista, pasada por `f`. Una cerrada no trae campos (no viajó nada de ella). */
const enCadaClase = (vista: VistaAlumno, f: (c: ClaseVista) => ClaseVista): VistaAlumno => ({
  ...vista,
  productos: vista.productos.map((p) => ({
    ...p,
    modulos: p.modulos.map((m) => ({ ...m, clases: m.clases.map((c) => ('cerrada' in c ? c : f(c))) })),
  })),
});

const corto = (s: string) => (s.length > 60 ? `${s.slice(0, 57).trimEnd()}…` : s);

/** Lo que falta, en una frase. Los rótulos largos se cortan: es un aviso, no el formulario. */
export function fraseQueFalta(f: QueFalta): string {
  if (f.tipo === 'respuesta') return 'Escribe tu respuesta antes de enviar.';
  if (f.tipo === 'alguno') return 'Contesta al menos una pregunta antes de enviar.';
  const [primera, ...resto] = f.labels;
  return resto.length
    ? `Falta «${corto(primera)}» y ${resto.length} más.`
    : `Falta «${corto(primera)}».`;
}
