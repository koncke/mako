// =============================================================================
// editor-landing/quiz — el quiz con diagnóstico de una landing (puro, 6/11/2026)
// =============================================================================
// Martín (29/10/2026): «un quiz (preguntas que llevan a un diagnóstico)... con el Web Generator; si la landing no lo permite,
// que el editor permita agregar formularios... conectarlo con el CRM». Un bloque más del Web Generator: preguntas de opción
// única, cada opción suma puntos, y el puntaje elige UN resultado por rango («desde N puntos»). Antes del resultado, un
// formulario de contacto: lo que dejan entra al CRM por el Pixel, como cualquier formulario de la landing, con el resultado y
// las respuestas como datos del lead (lib/landing-token.ts → `otrosCampos`: los campos de texto que no son de contacto).
//
// El flujo y las medidas se copian de SurveyJS Form Library (MIT, `survey-core` 1.12.20, tema defaultV2): una pregunta por
// paso, la barra de avance de 2 px con «Pregunta N de M» a la derecha, «Anterior / Siguiente», el contacto y la página final
// centrada. Por qué SurveyJS y los valores medidos: docs/investigacion-lead-magnets.md.
//
// QUÉ RESULTADO GANA (una regla, dos lugares que la cumplen):
//   · los resultados se ordenan por `desde` (de menor a mayor; a igual `desde`, el orden en que se escribieron) y gana el
//     ÚLTIMO cuyo `desde` es menor o igual al puntaje; si ninguno, el primero.
//   · la página la corre en el navegador con `ELEGIR_RESULTADO_JS` (un texto: va adentro del script de la página) y el
//     server con `indiceDeResultado`. tests/quiz-landing.test.ts los corre a los dos sobre miles de casos y exige lo mismo.
//
// Sin el dato no sale (como los bloques de venta): sin una pregunta completa (texto y dos opciones) y un resultado con título,
// render.ts lo saltea. Una pregunta o un resultado a medio escribir no se publica; el editor dice qué falta.
//
// ⚠️ PURO: sin DOM, sin React, sin server-only. Lo usan especificacion.ts, render.ts, pagina-publica.ts (el script), la vista
// del editor (app/web-generator/editor/nodos/QuizVista.tsx) y la API de MaKo (`configurar_quiz_landing`).
// =============================================================================

import { NODO } from './doc';
import { attrsDeFuente, hrefPermitido, idValido, type CtxSpec } from './especificacion';
import { cortarSinPartir } from '../unicode-seguro';
import type { NodoArbol } from './grafico-svg';

export const TOPES_QUIZ = {
  titulo: 120, intro: 240, boton: 40, pregunta: 160, opcion: 100, preguntas: 12, opciones: 6, puntos: 100,
  resultados: 6, resultadoTitulo: 120, resultadoTexto: 600, href: 2000, desde: 1200,
} as const;

/** Lo que se dice si el negocio no escribió otra cosa. */
export const TEXTOS_QUIZ = {
  empezar: 'Empezar',
  siguiente: 'Siguiente',
  anterior: 'Anterior',
  pide: 'Déjanos tus datos y te mostramos tu resultado.',
  enviar: 'Ver mi resultado',
  falta: 'Elige una opción para seguir.',
} as const;

/** El quiz recién insertado: la ESTRUCTURA sin textos (tres preguntas de tres opciones con 0, 1 y 2 puntos; tres resultados). */
export const QUIZ_NUEVO: AttrsQuiz = {
  titulo: '', intro: '', empezar: '', enviar: '', pideTelefono: false,
  preguntas: [0, 1, 2].map(() => ({ texto: '', opciones: [0, 1, 2].map((puntos) => ({ texto: '', puntos })) })),
  resultados: [0, 3, 5].map((desde) => ({ desde, titulo: '', texto: '', boton: '', href: '' })),
};

/**
 * Cuántas respuestas viajan al lead, además del resultado y el puntaje. El Pixel lee hasta `TOPES.camposFormulario` (10)
 * campos extra desde la v29 (14/11/2026; hasta ahí, 8): 2 + 6 entra con lugar.
 */
export const RESPUESTAS_AL_LEAD = 6;

/** `saltarA` de una opción que termina el quiz: después de elegirla va el contacto (y el resultado). */
export const SALTO_FIN = -1;

/**
 * El SALTO de una opción (14/11/2026, llamada con Julio: «quiz con lógica»): `null` = la pregunta siguiente; `SALTO_FIN` = al
 * contacto; un número = la pregunta con ese índice (de `preguntas`, como las ve el editor: «Pregunta 3» = 2). Sólo hacia
 * ADELANTE: un salto hacia atrás o a sí misma podría dar vueltas para siempre, y se lee como «la siguiente».
 * `multiple`: la pregunta se contesta con casillas (todas las que quiera): suma los puntos de cada una y no salta.
 */
export type OpcionQuiz = { texto: string; puntos: number; saltarA?: number | null };
export type PreguntaQuiz = { texto: string; multiple?: boolean; opciones: OpcionQuiz[] };
export type ResultadoQuiz = { desde: number; titulo: string; texto: string; boton: string; href: string };
/** `id` y `nombre`: los del formulario (doc.ts, `AttrsFormulario`): el CRM rutea y nombra el quiz por ellos. Van PRIMERO. */
export type AttrsQuiz = {
  /** Ausentes en un quiz de antes (el saneo le pone el id: validar.ts); TipTap los declara aparte (extensiones/nodos.ts). */
  id?: string | null; nombre?: string;
  titulo: string; intro: string; empezar: string; enviar: string; pideTelefono: boolean;
  preguntas: PreguntaQuiz[]; resultados: ResultadoQuiz[];
};

// Cortado sin partir un emoji (`cortarSinPartir`): medio emoji en el JSON hace que la base rechace la landing entera.
const texto = (v: unknown, tope: number): string => (typeof v === 'string' ? cortarSinPartir(v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(), tope).trim() : '');
/** El texto largo de un resultado conserva sus renglones (se dibujan como párrafos). */
const textoLargo = (v: unknown, tope: number): string => (typeof v === 'string'
  ? cortarSinPartir(v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim(), tope).trim()
  : '');
const entero = (v: unknown, min: number, max: number, def: number): number => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max ? n : def;
};
const o = (raw: unknown): Record<string, unknown> => (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {});
const lista = (v: unknown, tope: number): unknown[] => (Array.isArray(v) ? v.slice(0, tope) : []);

/** El href de un botón de resultado: el de la casa (http(s), una sección o `pagina:<id>`), o vacío. */
export function hrefResultado(v: unknown): string {
  const h = hrefPermitido(v);
  return h && h !== '#' ? h : '';
}

export function attrsQuiz(raw: unknown): AttrsQuiz {
  const a = o(raw);
  return {
    // Sólo si los trae: un quiz de antes sale idéntico (la IA lo devuelve igual, tests/quiz-landing.test.ts).
    ...(idValido(a.id) ? { id: idValido(a.id) } : {}),
    ...(texto(a.nombre, TOPES_QUIZ.titulo) ? { nombre: texto(a.nombre, TOPES_QUIZ.titulo) } : {}),
    titulo: texto(a.titulo, TOPES_QUIZ.titulo),
    intro: texto(a.intro, TOPES_QUIZ.intro),
    empezar: texto(a.empezar, TOPES_QUIZ.boton),
    enviar: texto(a.enviar, TOPES_QUIZ.boton),
    pideTelefono: a.pideTelefono === true,
    preguntas: lista(a.preguntas, TOPES_QUIZ.preguntas).map((p, i) => {
      const q = o(p);
      const multiple = q.multiple === true;
      // `multiple` y `saltarA` van SÓLO cuando no son lo de siempre: un quiz de antes (sin ellos) sale idéntico del saneo, y
      // validar.ts no anota un «preguntas inválido» en cada guardado (tests/quiz-landing.test.ts).
      return {
        texto: texto(q.texto, TOPES_QUIZ.pregunta),
        ...(multiple ? { multiple: true } : {}),
        opciones: lista(q.opciones, TOPES_QUIZ.opciones).map((x) => {
          const op = o(x);
          const salto = multiple ? null : saltoValido(op.saltarA, i);
          return { texto: texto(op.texto, TOPES_QUIZ.opcion), puntos: entero(op.puntos, 0, TOPES_QUIZ.puntos, 0), ...(salto != null ? { saltarA: salto } : {}) };
        }),
      };
    }),
    resultados: lista(a.resultados, TOPES_QUIZ.resultados).map((r) => {
      const x = o(r);
      return {
        desde: entero(x.desde, 0, TOPES_QUIZ.desde, 0),
        titulo: texto(x.titulo, TOPES_QUIZ.resultadoTitulo),
        texto: textoLargo(x.texto, TOPES_QUIZ.resultadoTexto),
        boton: texto(x.boton, TOPES_QUIZ.boton),
        href: hrefResultado(x.href),
      };
    }),
  };
}

/** Un salto que se puede cumplir desde la pregunta `desde`: hacia adelante y dentro del tope, o al final; si no, null. */
function saltoValido(v: unknown, desde: number): number | null {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  if (n === SALTO_FIN) return SALTO_FIN;
  return typeof n === 'number' && Number.isInteger(n) && n > desde && n < TOPES_QUIZ.preguntas ? n : null;
}

/**
 * Las preguntas que salen: con su texto y al menos dos opciones con texto (las opciones vacías no salen). Los saltos quedan
 * con el índice de lo que SALE: un salto a una pregunta que no sale (a medio escribir) va a la primera que sí sale después de
 * ella, y si no hay ninguna, al final (`SALTO_FIN`).
 */
export function preguntasCompletas(a: AttrsQuiz): PreguntaQuiz[] {
  const salen: number[] = [];
  a.preguntas.forEach((p, i) => { if (p.texto && p.opciones.filter((x) => x.texto).length >= 2) salen.push(i); });
  const destino = (salto: number | null): number | null => {
    if (salto == null || salto === SALTO_FIN) return salto;
    const k = salen.findIndex((i) => i >= salto);
    return k < 0 ? SALTO_FIN : k;
  };
  return salen.map((i) => {
    const p = a.preguntas[i];
    return { texto: p.texto, multiple: p.multiple === true, opciones: p.opciones.filter((x) => x.texto).map((x) => ({ ...x, saltarA: destino(x.saltarA ?? null) })) };
  });
}

/**
 * El CAMINO de unas respuestas: las preguntas (de las que salen) por las que pasa la persona, en orden, siguiendo los saltos de
 * las opciones elegidas. Una pregunta sin respuesta corta el camino ahí (la página no deja seguir sin elegir). La misma regla
 * que corre el script de la página (`SCRIPT_QUIZ`, `siguienteDe`); tests/web-generator-formularios-julio.test.ts las compara.
 */
export function caminoDe(preguntas: PreguntaQuiz[], elegidas: ReadonlyArray<number | readonly number[] | null | undefined>): number[] {
  const camino: number[] = [];
  let k = 0;
  while (k >= 0 && k < preguntas.length && camino.length <= preguntas.length) {
    camino.push(k);
    const e = elegidas[k];
    const p = preguntas[k];
    if (e == null || (Array.isArray(e) && !e.length)) break;
    const salto = !p.multiple && typeof e === 'number' ? p.opciones[e]?.saltarA ?? null : null;
    if (salto === SALTO_FIN) break;
    k = salto != null && salto > k ? salto : k + 1;
  }
  return camino;
}

/** Los resultados que salen (con título), ordenados por `desde` sin perder el orden de los que empatan. */
export function resultadosCompletos(a: AttrsQuiz): ResultadoQuiz[] {
  return a.resultados
    .map((r, i) => ({ r, i }))
    .filter((x) => x.r.titulo)
    .sort((x, y) => x.r.desde - y.r.desde || x.i - y.i)
    .map((x) => x.r);
}

/** ¿Sale en la página? Una pregunta completa y un resultado con título. */
export function quizListo(raw: unknown): boolean {
  const a = attrsQuiz(raw);
  return preguntasCompletas(a).length > 0 && resultadosCompletos(a).length > 0;
}

/** El puntaje más alto posible (la suma del mejor puntaje de cada pregunta que sale): el editor lo dice para poner los rangos. */
export function puntajeMaximo(a: AttrsQuiz): number {
  return preguntasCompletas(a).reduce((s, p) => s + Math.max(0, ...p.opciones.map((x) => x.puntos)), 0);
}

/**
 * El puntaje de unas respuestas: `elegidas[i]` es el índice de la opción de la pregunta i (de las que salen), o la lista de
 * índices en una de selección múltiple. Cuentan sólo las preguntas del CAMINO (`caminoDe`): lo que quedó elegido en una
 * pregunta que un salto dejó afuera no suma.
 */
export function puntajeDe(preguntas: PreguntaQuiz[], elegidas: ReadonlyArray<number | readonly number[] | null | undefined>): number {
  let s = 0;
  for (const i of caminoDe(preguntas, elegidas)) {
    const p = preguntas[i];
    const e = elegidas[i];
    for (const k of Array.isArray(e) ? e : typeof e === 'number' ? [e] : []) if (p.opciones[k]) s += p.opciones[k].puntos;
  }
  return s;
}

/**
 * Qué resultado gana: sobre los `desde` YA ORDENADOS (`resultadosCompletos`), el último que es menor o igual al puntaje; si
 * ninguno, el primero. ⚠️ La página corre `ELEGIR_RESULTADO_JS`: si cambia esta regla, cambia ese texto en el mismo commit
 * (tests/quiz-landing.test.ts los compara).
 */
export function indiceDeResultado(desdes: readonly number[], puntaje: number): number {
  let k = 0;
  for (let i = 0; i < desdes.length; i++) if (desdes[i] <= puntaje) k = i;
  return k;
}

/** El resultado de unas respuestas (lo que ve la persona y lo que le llega al lead). null si el quiz no sale. */
export function resultadoDe(raw: unknown, elegidas: ReadonlyArray<number | readonly number[] | null | undefined>): { resultado: ResultadoQuiz; puntaje: number } | null {
  const a = attrsQuiz(raw);
  const ps = preguntasCompletas(a);
  const rs = resultadosCompletos(a);
  if (!ps.length || !rs.length) return null;
  const puntaje = puntajeDe(ps, elegidas);
  return { resultado: rs[indiceDeResultado(rs.map((r) => r.desde), puntaje)], puntaje };
}

/** Cómo se dice en una línea (la API, ver_secciones_landing). */
export function resumenQuiz(raw: unknown): string {
  const a = attrsQuiz(raw);
  const n = preguntasCompletas(a).length;
  const m = resultadosCompletos(a).length;
  if (!n || !m) return `quiz a medio armar (${n} ${n === 1 ? 'pregunta completa' : 'preguntas completas'}, ${m} ${m === 1 ? 'resultado' : 'resultados'}): no se muestra`;
  return `quiz «${a.titulo || 'sin título'}»: ${n} ${n === 1 ? 'pregunta' : 'preguntas'}, ${m} ${m === 1 ? 'resultado' : 'resultados'}, puntaje de 0 a ${puntajeMaximo(a)}`;
}

/** Lo que le falta para salir, en una línea (la barra del editor). */
export function faltaDelQuiz(raw: unknown): string | null {
  const a = attrsQuiz(raw);
  if (!preguntasCompletas(a).length) return 'Falta una pregunta con dos opciones';
  if (!resultadosCompletos(a).length) return 'Falta un resultado con título';
  return null;
}

/**
 * Lo que no rompe el quiz pero no va a salir como se escribió: el botón de un resultado sin un link de la casa (o sin texto)
 * no se dibuja. El editor lo dice al lado del resultado (revisión del 6/11/2026: desaparecía al publicar sin aviso).
 */
export function avisoDelBoton(r: { boton?: unknown; href?: unknown }): string | null {
  const boton = typeof r.boton === 'string' ? r.boton.trim() : '';
  const href = hrefResultado(r.href);
  if (boton && !href) return 'Sin un link válido, el botón no se muestra.';
  if (!boton && href) return 'Sin texto, el botón no se muestra.';
  return null;
}

// ── La forma HTML ────────────────────────────────────────────────────────────────────────────

const parrafos = (t: string, clase: string): NodoArbol[] => t.split('\n').filter(Boolean).map((l): NodoArbol => ['p', { class: clase }, l]);

/**
 * `div.gm-quiz`. En la página publicada (`ctx.modo === 'publico'`) va el flujo entero, con todo menos la portada escondido
 * hasta que el script lo muestra (sin JavaScript se ve la portada y nada se rompe). Exportada, la portada sola. En el editor y
 * la miniatura, un resumen quieto: la portada, las preguntas y los resultados, para ver qué hay escrito.
 */
export function specQuiz(raw: unknown, ctx?: CtxSpec): NodoArbol {
  const a = attrsQuiz(raw);
  const ps = preguntasCompletas(a);
  const rs = resultadosCompletos(a);
  const portada: NodoArbol = ['div', { class: 'gm-quiz-inicio' },
    ['h3', { class: 'gm-quiz-titulo' }, a.titulo || 'Tu quiz'],
    ...(a.intro ? [['p', { class: 'gm-quiz-intro' }, a.intro] as NodoArbol] : []),
    ['button', { type: 'button', class: 'gm-boton', 'data-variante': 'primario', 'data-quiz': 'empezar' }, a.empezar || TEXTOS_QUIZ.empezar]];

  // Lo exportado (PDF, PNG, HTML) lo ve el CLIENTE, y sin script no se puede contestar: la portada sola, como la página
  // publicada sin JavaScript. El resumen dice «desde N puntos» y «Pregunta N sin escribir» (revisión del 6/11/2026).
  if (ctx?.modo === 'exportar') return ['div', { class: 'gm-quiz' }, portada];
  if (ctx?.modo !== 'publico') {
    const n = ps.length;
    return ['div', { class: 'gm-quiz', 'data-vista': 'resumen' },
      portada,
      ['ol', { class: 'gm-quiz-resumen' }, ...(a.preguntas.length ? a.preguntas : [{ texto: '', opciones: [] }]).map((p, i): NodoArbol => ['li', {},
        ['strong', {}, p.texto || `Pregunta ${i + 1} sin escribir`],
        ['span', { class: 'gm-quiz-resumen-op' }, ` · ${p.opciones.filter((x) => x.texto).length} opciones`]])],
      ['p', { class: 'gm-quiz-resumen-res' }, rs.length
        ? `${n} ${n === 1 ? 'pregunta' : 'preguntas'} · ${rs.map((r) => `${r.titulo} (desde ${r.desde})`).join(' · ')}`
        : 'Falta un resultado con título']];
  }

  const n = ps.length;
  // `data-salta`: a qué paso lleva la opción (el índice de lo que sale, o «fin»); sin el atributo, al siguiente. La selección
  // múltiple son casillas y no salta.
  const preguntas = ps.map((p, i): NodoArbol => ['fieldset', { class: 'gm-quiz-pregunta', 'data-paso': String(i), 'data-multiple': p.multiple ? 'si' : undefined, hidden: '' },
    ['legend', { class: 'gm-quiz-enunciado' }, p.texto],
    ['div', { class: 'gm-quiz-opciones' }, ...p.opciones.map((x, j): NodoArbol => ['label', { class: 'gm-quiz-opcion' },
      ['input', {
        type: p.multiple ? 'checkbox' : 'radio', name: `gmq-${i}`, value: String(j), 'data-puntos': String(x.puntos),
        'data-salta': x.saltarA === SALTO_FIN ? 'fin' : x.saltarA != null ? String(x.saltarA) : undefined,
      }],
      ['span', { class: 'gm-quiz-opcion-texto' }, x.texto]])],
    ['p', { class: 'gm-quiz-falta', hidden: '', role: 'alert' }, TEXTOS_QUIZ.falta],
    ['div', { class: 'gm-quiz-nav' },
      ...(i > 0 ? [['button', { type: 'button', class: 'gm-quiz-atras', 'data-quiz': 'atras' }, TEXTOS_QUIZ.anterior] as NodoArbol] : []),
      ['button', { type: 'button', class: 'gm-boton', 'data-variante': 'primario', 'data-quiz': 'siguiente' }, TEXTOS_QUIZ.siguiente]]]);

  // Los datos que viajan al lead: campos de TEXTO (el Pixel no lee los `hidden`) dentro de una caja que no se ve. Su rótulo es
  // una ETIQUETA que los envuelve («Resultado del quiz», «Puntaje del quiz» y el enunciado de cada pregunta, cortado a 40 por el
  // Pixel), NUNCA un `aria-label`: el Pixel decide qué es contacto mirando name, id, placeholder y aria-label, y una pregunta
  // como «¿Cuánto factura tu negocio?» se guardaba como la EMPRESA del lead, y una con «hotel», como su TELÉFONO
  // (`campo()` y `otrosCampos()` en lib/landing-token.ts). La etiqueta no entra en esas pistas y es lo que el Pixel lee primero
  // como rótulo. Sin `name` ni `id` por lo mismo.
  const dato = (rotulo: string, attrs: Record<string, string>): NodoArbol => ['label', { class: 'gm-quiz-dato' },
    ['span', {}, rotulo],
    ['input', { type: 'text', readonly: '', tabindex: '-1', ...attrs }]];
  const datos: NodoArbol = ['div', { class: 'gm-quiz-datos', 'aria-hidden': 'true' },
    dato('Resultado del quiz', { 'data-quiz-dato': 'resultado' }),
    dato('Puntaje del quiz', { 'data-quiz-dato': 'puntaje' }),
    // Con su número adelante: el Pixel guarda por rótulo, y dos preguntas que empiezan igual se pisaban. Cortado a 40 ACÁ, sin
    // partir un emoji: el Pixel corta a 40 con `slice`, y medio emoji hace que la base rechace el lead entero.
    ...ps.slice(0, RESPUESTAS_AL_LEAD).map((p, i): NodoArbol => dato(cortarSinPartir(`${i + 1}. ${p.texto}`, 40), { 'data-quiz-respuesta': String(i) }))];

  // La etiqueta ENVUELVE al campo (sin `id`: dos quizzes en una página no repiten ids), con las clases del formulario de la casa.
  const campo = (rotulo: string, requerido: boolean, attrs: Record<string, string>): NodoArbol => ['label', { class: 'gm-campo' },
    ['span', { class: 'gm-campo-etiqueta', 'data-requerido': requerido ? 'si' : undefined }, rotulo],
    ['input', { ...attrs, maxlength: '200', required: requerido ? '' : undefined }]];
  const contacto: NodoArbol = ['form', { class: 'gm-quiz-form', method: 'post', hidden: '', ...attrsDeFuente(a.id ?? null, a.nombre || (a.titulo ? `Quiz ${a.titulo}` : ''), ctx) },
    ['p', { class: 'gm-quiz-pide' }, TEXTOS_QUIZ.pide],
    campo('Nombre', true, { type: 'text', name: 'nombre', autocomplete: 'name' }),
    campo('Correo', true, { type: 'email', name: 'email', autocomplete: 'email', inputmode: 'email' }),
    ...(a.pideTelefono ? [campo('WhatsApp', false, { type: 'tel', name: 'telefono', autocomplete: 'tel', inputmode: 'tel' })] : []),
    datos,
    ['div', { class: 'gm-quiz-nav' },
      ['button', { type: 'button', class: 'gm-quiz-atras', 'data-quiz': 'atras' }, TEXTOS_QUIZ.anterior],
      ['button', { type: 'submit', class: 'gm-boton', 'data-variante': 'primario' }, a.enviar || TEXTOS_QUIZ.enviar]]];

  const resultados = rs.map((r, k): NodoArbol => {
    const href = r.href ? (ctx?.resolverHref ? ctx.resolverHref(r.href) : r.href) : null;
    const externo = !!href && /^https?:/i.test(href);
    return ['div', { class: 'gm-quiz-resultado', 'data-desde': String(r.desde), 'data-resultado': String(k), tabindex: '-1', hidden: '' },
      ['h3', { class: 'gm-quiz-titulo' }, r.titulo],
      ...parrafos(r.texto, 'gm-quiz-texto'),
      ...(href && r.boton ? [['a', {
        class: 'gm-boton', 'data-variante': 'primario', href,
        ...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
      }, r.boton] as NodoArbol] : [])];
  });

  return ['div', { class: 'gm-quiz', 'data-quiz-n': String(n) },
    ['div', { class: 'gm-quiz-progreso', hidden: '' },
      ['div', { class: 'gm-quiz-barra' }, ['span', { class: 'gm-quiz-lleno', style: 'width:0%' }]],
      ['p', { class: 'gm-quiz-cuenta', 'aria-live': 'polite' }, `Pregunta 1 de ${n}`]],
    portada, ...preguntas, contacto, ...resultados];
}

// ── El script de la página publicada ─────────────────────────────────────────────────────────

/**
 * La regla de `indiceDeResultado`, como texto de JavaScript (va adentro de `SCRIPT_QUIZ`). Sin regex, sin barras invertidas,
 * sin backticks y sin `${`: es un string que se sirve (AGENTS.md, «el fuente y lo que se sirve no son el mismo texto»).
 */
export const ELEGIR_RESULTADO_JS = 'function gmQuizElegir(desdes, p) { var k = 0; for (var i = 0; i < desdes.length; i++) if (desdes[i] <= p) k = i; return k; }';

/**
 * EL SCRIPT DEL QUIZ en la página publicada (se suma a `SCRIPT_PAGINA`, con su hash en la CSP):
 *   · «Empezar» muestra la primera pregunta y la barra de avance; «Siguiente» exige una opción («Elige una opción para
 *     seguir»); «Anterior» vuelve; después de la última va el formulario de contacto.
 *   · Al llegar al contacto se llenan los campos que viajan al lead (resultado, puntaje y respuestas): el Pixel lee el
 *     formulario EN CAPTURA, antes de este script, así que tienen que estar llenos antes de enviar.
 *   · Enviar: valida (nombre y correo), esconde el formulario y muestra el resultado. Nunca manda nada: el opt-in lo manda el
 *     Pixel, como en cualquier formulario de la landing.
 *   · Los nombres de las opciones (`gmq-<i>`) se vuelven únicos por quiz: dos quizzes en una página no se pisan.
 */
export const SCRIPT_QUIZ: readonly string[] = [
  '  function quizzes() {',
  "    var zs = d.querySelectorAll('.gm-quiz[data-quiz-n]');",
  '    ' + ELEGIR_RESULTADO_JS,
  '    for (var q = 0; q < zs.length; q++) armarQuiz(zs[q], q);',
  '    function armarQuiz(z, q) {',
  "      var pasos = z.querySelectorAll('.gm-quiz-pregunta');",
  '      var n = pasos.length;',
  "      var inicio = z.querySelector('.gm-quiz-inicio');",
  "      var prog = z.querySelector('.gm-quiz-progreso');",
  "      var lleno = z.querySelector('.gm-quiz-lleno');",
  "      var cuenta = z.querySelector('.gm-quiz-cuenta');",
  "      var form = z.querySelector('.gm-quiz-form');",
  "      var res = z.querySelectorAll('.gm-quiz-resultado');",
  '      if (!n || !form || !res.length || !inicio) return;',
  '      for (var i = 0; i < n; i++) {',
  "        var rs = pasos[i].querySelectorAll('input[type=radio], input[type=checkbox]');",
  "        for (var j = 0; j < rs.length; j++) rs[j].name = 'gmq' + q + '-' + i;",
  '      }',
  // `hist`: las preguntas por las que pasó, en orden (los saltos hacen que «Anterior» no sea siempre la de al lado). Lo que
  // suma y lo que viaja al lead es SÓLO el camino: lo elegido en una pregunta que un salto dejó afuera no cuenta (`caminoDe`).
  '      var actual = -1, hist = [];',
  '      function elegidas(k) {',
  "        return pasos[k] ? pasos[k].querySelectorAll('input[type=radio]:checked, input[type=checkbox]:checked') : [];",
  '      }',
  '      function elegida(k) {',
  '        var e = elegidas(k);',
  '        return e.length ? e[0] : null;',
  '      }',
  '      function siguienteDe(k) {',
  "        var r = pasos[k] ? pasos[k].querySelector('input[type=radio]:checked') : null;",
  "        var s = r ? r.getAttribute('data-salta') : null;",
  "        if (s === 'fin') return n;",
  '        var v = s ? parseInt(s, 10) : NaN;',
  '        return isFinite(v) && v > k && v < n ? v : k + 1;',
  '      }',
  '      function enCamino(k) {',
  '        for (var h = 0; h < hist.length; h++) if (hist[h] === k) return true;',
  '        return false;',
  '      }',
  '      function puntaje() {',
  '        var s = 0;',
  '        for (var h = 0; h < hist.length; h++) {',
  '          var e = elegidas(hist[h]);',
  "          for (var x = 0; x < e.length; x++) { var v = parseInt(e[x].getAttribute('data-puntos'), 10); if (isFinite(v)) s += v; }",
  '        }',
  '        return s;',
  '      }',
  '      function ganador() {',
  '        var desdes = [];',
  "        for (var k = 0; k < res.length; k++) { var v = parseInt(res[k].getAttribute('data-desde'), 10); desdes.push(isFinite(v) ? v : 0); }",
  '        return gmQuizElegir(desdes, puntaje());',
  '      }',
  '      function llenar() {',
  '        var g = res[ganador()];',
  "        var t = g ? g.querySelector('.gm-quiz-titulo') : null;",
  "        var dr = form.querySelector('[data-quiz-dato=resultado]'); if (dr) dr.value = t ? t.textContent : '';",
  "        var dp = form.querySelector('[data-quiz-dato=puntaje]'); if (dp) dp.value = String(puntaje());",
  "        var rr = form.querySelectorAll('[data-quiz-respuesta]');",
  '        for (var k = 0; k < rr.length; k++) {',
  "          var p = parseInt(rr[k].getAttribute('data-quiz-respuesta'), 10), e = enCamino(p) ? elegidas(p) : [], ts = [];",
  '          for (var x = 0; x < e.length; x++) {',
  "            var lb = e[x].parentNode ? e[x].parentNode.querySelector('.gm-quiz-opcion-texto') : null;",
  '            if (lb) ts.push(lb.textContent);',
  '          }',
  "          rr[k].value = ts.join(', ');",
  '        }',
  '      }',
  '      function ver(k) {',
  '        actual = k;',
  '        inicio.hidden = k !== -1;',
  '        for (var i = 0; i < n; i++) pasos[i].hidden = i !== k;',
  '        form.hidden = k !== n;',
  '        if (prog) prog.hidden = k < 0 || k > n;',
  "        if (lleno) lleno.style.width = Math.round(Math.min(k, n) * 100 / n) + '%';",
  "        if (cuenta) cuenta.textContent = k < n ? 'Pregunta ' + (k + 1) + ' de ' + n : 'Último paso';",
  '        if (k === n) llenar();',
  '        enfocar(k);',
  '      }',
  // El foco va al paso nuevo: el botón que se apretó queda escondido, y sin esto el foco cae al body (el teclado y el lector de
  // pantalla pierden el lugar). La opción elegida (o la primera), el primer campo del contacto, o «Empezar» al volver.
  '      function enfocar(k) {',
  "        var el = k < 0 ? inicio.querySelector('[data-quiz=empezar]') : k < n ? (elegida(k) || pasos[k].querySelector('input')) : form.querySelector('input:not([readonly])');",
  '        if (el && el.focus) { try { el.focus(); } catch (e) {} }',
  '      }',
  "      z.addEventListener('click', function (ev) {",
  "        var b = ev.target && ev.target.closest ? ev.target.closest('[data-quiz]') : null;",
  '        if (!b || !z.contains(b)) return;',
  "        var que = b.getAttribute('data-quiz');",
  "        if (que === 'empezar') { hist = []; ver(0); return; }",
  "        if (que === 'atras') { ver(hist.length ? hist.pop() : -1); return; }",
  "        if (que === 'siguiente') {",
  "          var falta = pasos[actual] ? pasos[actual].querySelector('.gm-quiz-falta') : null;",
  '          if (!elegida(actual)) { if (falta) falta.hidden = false; return; }',
  '          if (falta) falta.hidden = true;',
  '          hist.push(actual);',
  '          ver(siguienteDe(actual));',
  '        }',
  '      });',
  "      z.addEventListener('change', function (ev) {",
  "        var f = pasos[actual] ? pasos[actual].querySelector('.gm-quiz-falta') : null;",
  "        if (f && ev.target && (ev.target.type === 'radio' || ev.target.type === 'checkbox')) f.hidden = true;",
  '      });',
  "      form.addEventListener('submit', function (ev) {",
  '        ev.preventDefault();',
  "        if (form.getAttribute('data-gm-enviado')) return;",
  '        if (form.checkValidity && !form.checkValidity()) { if (form.reportValidity) form.reportValidity(); return; }',
  "        form.setAttribute('data-gm-enviado', '1');",
  '        var g = res[ganador()];',
  '        form.hidden = true;',
  '        if (prog) prog.hidden = true;',
  '        if (g) { g.hidden = false; if (g.focus) g.focus(); }',
  '      });',
  '    }',
  '  }',
  '  try { quizzes(); } catch (e) {}',
];

/** ¿El nodo es el quiz? (render.ts lo saltea si no está listo). */
export const esNodoQuiz = (tipo: string): boolean => tipo === NODO.quiz;
