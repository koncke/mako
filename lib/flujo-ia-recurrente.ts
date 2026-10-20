// =============================================================================
// flujo-ia-recurrente — «cada martes a las 3, a todos los del funnel»: el horario y a quién, por CÓDIGO (puro)
// =============================================================================
// Pedido de Martín (20/10/2026, punto 4, texto entero en docs/relevo/chatbot.md): «Le pidió literalmente que creara una
// automatización usando el CRON de Recurrente, y creó cualquier cosa... eso debería ser inteligente, no crear cosas por
// defecto». Leila (ws11, #284) pidió «cada semana los días martes a las 3 de la tarde hay que mandar un recordatorio a
// todos los que tenemos en el funnel principal» y salió «Llega a «1ª sesión sin costo»», sin horario: `opcionesCronIA`
// deja afuera el Recurrente, y el modelo eligió la etapa de nombre más parecido («sesión»).
//
// UN HORARIO ES UN DATO EXACTO (AGENTS.md: un dato exacto que pasa por un LLM deja de serlo). Lo saca el código del
// pedido y lo IMPONE (`crearConIA`, lib/flujo-ia-crear-core.ts); si falta el día o la hora, MaKo pregunta con opciones,
// y nunca se cambia por otro CRON.
//   · `horarioDelPedido`: el horario del texto (un `CronAviso` saneado con `sanearCron`), lo que le falta, o null (el
//     pedido no es un Recurrente).
//   · `audienciaDelPedido`: «todos los del funnel X» = TODAS sus etapas (las salidas ya no vienen: `productosConEtapas`
//     las saca); sin funnel ni etapa nombrados, la pregunta «¿A quién le llega?».
//   · `preguntaHorario` y `preguntaQuien`: las dos preguntas, con opciones que dicen el horario entero.
//
// ⚠️ LA HORA ES LA DE AL LADO DEL HORARIO. El pedido de Leila trae DOS horas: «a las 3 de la tarde» (cuándo sale) y «a
// las 7:30» (la sesión, que va en el texto del mensaje). Vale la más cercana a la frase del horario, y sólo si está a
// `VENTANA_HORA` caracteres o menos: la otra es contenido.
// =============================================================================

import { sanearCron, textoCron, type CronAviso } from './cron-aviso';
import { normNombre, hablaDeAlumno, type CtxIA } from './flujo-ia';
import { valorDeVarios, separarValor } from './flujo-conversacion';
import type { PreguntaMako, RespuestaMako, OpcionPregunta } from './automatizacion-chat';

/** La parte del día que dijo sin decir la hora («los martes a la tarde»). Ordena las opciones de la pregunta. */
export type PeriodoDia = 'manana' | 'tarde' | 'noche';

/**
 * EL HORARIO DE UN PEDIDO. `completo` = se puede imponer. Si no, `falta` dice qué preguntar y `base` es el horario con
 * lo que falta en su valor de siempre (`sanearCron`: 9:00, el lunes, el día 1), para armar las opciones.
 * `porDefecto` = algo lo puso el código porque la persona dijo «Elige tú» (se avisa en el chat).
 */
export type HorarioPedido =
  | { completo: true; cron: CronAviso; porDefecto?: true }
  | { completo: false; falta: 'dia' | 'hora'; base: CronAviso; periodo: PeriodoDia | null; conHora: boolean };

/** Hasta cuántos caracteres de la frase del horario se busca su hora (ver la cabecera). */
export const VENTANA_HORA = 40;

/** El texto de las dos preguntas (6 palabras o menos, en «tú»). */
export const TEXTO_HORARIO = '¿Cuándo sale?';
export const TEXTO_QUIEN = '¿A quién le llega?';

// ── Las palabras ─────────────────────────────────────────────────────────────────

const DIA = '(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)';
const NUM_DIA: Readonly<Record<string, number>> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const numDia = (s: string): number => NUM_DIA[s] ?? NUM_DIA[s.replace(/s$/, '')] ?? -1;
/** Una lista de días: «lunes», «lunes y jueves», «lunes, miércoles y viernes». */
const LISTA_DIAS = `${DIA}(?:\\s*(?:,|\\by\\b|\\be\\b)\\s*${DIA})*`;

const NUMEROS: Readonly<Record<string, number>> = {
  una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
};
// Sin una letra pegada atrás («a las dosis», «a las 150»), salvo la «h» de «15h30».
const NUM = `(\\d{1,2}|${Object.keys(NUMEROS).join('|')})(?![0-9a-gi-z])`;
const aNumero = (s: string): number => (/^\d+$/.test(s) ? Number(s) : NUMEROS[s] ?? NaN);

/** Sin tildes ni mayúsculas, los «:» y los «.» de las horas intactos. */
const plano = (s: unknown): string => normNombre(s).replace(/[¡!¿?;"«»()]/g, ' ').replace(/\s+/g, ' ');

type Tramo = { ini: number; fin: number };
type Hallada = Tramo & { hora: number; minuto: number };

/** Los días que nombra un trozo («lunes, miércoles y viernes» → [1, 3, 5]; «de lunes a viernes» → [1..5]). */
function diasDe(trozo: string): number[] {
  const rango = new RegExp(`\\bde ${DIA} a ${DIA}\\b`).exec(trozo);
  if (rango) {
    const a = numDia(rango[1]);
    const b = numDia(rango[2]);
    const orden = (d: number) => (d + 6) % 7;
    if (a >= 0 && b >= 0 && orden(a) <= orden(b)) return [0, 1, 2, 3, 4, 5, 6].filter((d) => orden(d) >= orden(a) && orden(d) <= orden(b));
  }
  return [...new Set([...trozo.matchAll(new RegExp(DIA, 'g'))].map((m) => numDia(m[1])).filter((d) => d >= 0))];
}

/** La hora de pared de «3» con su parte del día. Sin parte del día, de 1 a 7 es de la tarde: nadie avisa a las 3 a. m. */
function horaDe(h: number, parte: string | undefined): number {
  const p = (parte ?? '').replace(/[.\s]/g, '');
  if (/manana|^am$/.test(p)) return h === 12 && p === 'am' ? 0 : h;
  if (/tarde|mediodia|^pm$/.test(p)) return h < 12 ? h + 12 : h;
  if (/noche/.test(p)) return h === 12 ? 0 : h >= 6 && h < 12 ? h + 12 : h;
  if (h >= 13) return h;
  return h >= 1 && h <= 7 ? h + 12 : h;
}

// «a. m.» y «pm» sin una letra pegada: «el 15 a mis clientes» no es «15 a. m.».
const PARTE = '(de la manana|de la tarde|de la noche|del mediodia|a\\.? ?m\\.?(?![a-z])|p\\.? ?m\\.?(?![a-z]))';
const MINUTOS = '(?:(?::|\\.|h)(\\d{2})|\\s+y\\s+(media|cuarto))?';

/** Todas las horas que dice un texto, con dónde están. */
function horasEn(t: string): Hallada[] {
  const out: Hallada[] = [];
  const poner = (m: RegExpExecArray, h: number, min: number) => {
    if (!Number.isFinite(h) || h < 0 || h > 23 || min < 0 || min > 59) return;
    if (out.some((x) => m.index < x.fin && m.index + m[0].length > x.ini)) return;
    out.push({ ini: m.index, fin: m.index + m[0].length, hora: h, minuto: min });
  };
  const minDe = (dig: string | undefined, pal: string | undefined) => (dig ? Number(dig) : pal === 'media' ? 30 : pal === 'cuarto' ? 15 : 0);
  for (const m of t.matchAll(new RegExp(`\\ba (?:las|la) ${NUM}${MINUTOS}(?:\\s*(?:hs|hrs|horas|h)\\b)?(?:\\s*${PARTE})?`, 'g'))) {
    poner(m, horaDe(aNumero(m[1]), m[4]), minDe(m[2], m[3]));
  }
  for (const m of t.matchAll(/\b(?:al|a) mediodia\b/g)) poner(m, 12, 0);
  for (const m of t.matchAll(/\ba (?:la )?medianoche\b/g)) poner(m, 0, 0);
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})(?::(\\d{2}))?\\s*${PARTE.replace('de la manana|de la tarde|de la noche|del mediodia|', '')}`, 'g'))) {
    poner(m, horaDe(Number(m[1]), m[3]), m[2] ? Number(m[2]) : 0);
  }
  for (const m of t.matchAll(/\b(\d{1,2}):(\d{2})\s*(?:hs|h)?\b/g)) poner(m, horaDe(Number(m[1]), undefined), Number(m[2]));
  for (const m of t.matchAll(/\b(\d{1,2})\s*(?:hs|hrs)\b/g)) poner(m, horaDe(Number(m[1]), undefined), 0);
  return out;
}

/** «A la tarde», «por la mañana», «todas las noches»: la parte del día sin la hora. */
function periodoEn(t: string): Array<Tramo & { periodo: PeriodoDia }> {
  return [...t.matchAll(/\b(?:a|por|de|en|todas) (?:la|las) (manana|tarde|noche)s?\b/g)]
    .map((m) => ({ ini: m.index, fin: m.index + m[0].length, periodo: m[1] as PeriodoDia }));
}

const distancia = (a: Tramo, b: Tramo): number => (a.ini >= b.fin ? a.ini - b.fin : b.ini >= a.fin ? b.ini - a.fin : 0);
const masCercana = <T extends Tramo>(xs: readonly T[], marcas: readonly Tramo[]): T | null => {
  let mejor: T | null = null;
  let d = Infinity;
  for (const x of xs) {
    const dx = Math.min(...marcas.map((m) => distancia(x, m)));
    if (dx <= VENTANA_HORA && dx < d) { mejor = x; d = dx; }
  }
  return mejor;
};

// ── El horario ───────────────────────────────────────────────────────────────────

type Marca = Tramo & { unidad: CronAviso['unidad']; cada: number; dias?: number[]; diaMes?: number };

/** Las frases de recurrencia del texto, de la más concreta a la más suelta. */
function marcasEn(t: string): Marca[] {
  const out: Marca[] = [];
  const add = (m: RegExpExecArray, x: Omit<Marca, 'ini' | 'fin'>) => out.push({ ini: m.index, fin: m.index + m[0].length, ...x });
  const cadaN = (s: string | undefined) => Math.max(1, Math.min(99, Number(s) || 1));
  // SEMANA, con días: «los martes», «los días martes», «cada lunes y jueves», «todos los viernes», «de lunes a viernes».
  for (const m of t.matchAll(new RegExp(`\\b(?:cada|todos los|todas las semanas los|los dias|los)\\s+(?:dias\\s+)?${LISTA_DIAS}\\b`, 'g'))) {
    add(m, { unidad: 'semana', cada: 1, dias: diasDe(m[0]) });
  }
  for (const m of t.matchAll(new RegExp(`\\bde ${DIA} a ${DIA}\\b`, 'g'))) add(m, { unidad: 'semana', cada: 1, dias: diasDe(m[0]) });
  // SEMANA, sin días (los días pueden venir sueltos: «cada semana, el martes»).
  for (const m of t.matchAll(/\b(?:cada (\d{1,2}) semanas|cada semana|todas las semanas|semanalmente|una vez (?:a|por) (?:la )?semana)\b/g)) {
    add(m, { unidad: 'semana', cada: cadaN(m[1]) });
  }
  // MES: «el 15 de cada mes», «cada mes», «todos los meses».
  for (const m of t.matchAll(/\b(?:el|los) (?:dia )?(\d{1,2}) de cada mes\b/g)) add(m, { unidad: 'mes', cada: 1, diaMes: Number(m[1]) });
  for (const m of t.matchAll(/\b(?:cada (\d{1,2}) meses|cada mes|todos los meses|mensualmente|una vez (?:al|por) mes)\b/g)) add(m, { unidad: 'mes', cada: cadaN(m[1]) });
  // DÍA: «todos los días», «cada 2 días», «diariamente», «todas las mañanas».
  for (const m of t.matchAll(/\b(?:cada (\d{1,2}) dias|todos los dias|cada dia|diariamente|a diario|todas las (?:mananas|tardes|noches))\b/g)) {
    add(m, { unidad: 'dia', cada: cadaN(m[1]) });
  }
  // HORA: «cada hora», «cada 3 horas».
  for (const m of t.matchAll(/\b(?:cada (\d{1,2}) horas|cada hora)\b/g)) add(m, { unidad: 'hora', cada: cadaN(m[1]) });
  return out;
}

/**
 * EL HORARIO QUE DICE EL PEDIDO, o null si no dice ninguno (no es un Recurrente). Gana la unidad más concreta que
 * aparece: unos días de la semana > la semana > el mes > el día > la hora («todos los días martes» es semanal). La hora
 * es la más cercana a esas frases (`VENTANA_HORA`); los días de una semana sin días pueden venir sueltos («cada semana,
 * el martes»).
 */
export function horarioDelPedido(texto: unknown): HorarioPedido | null {
  const t = plano(texto);
  if (!t) return null;
  const marcas = marcasEn(t);
  if (!marcas.length) return null;
  const conDias = marcas.filter((m) => m.dias?.length);
  const semana = marcas.filter((m) => m.unidad === 'semana');
  const mes = marcas.filter((m) => m.unidad === 'mes');
  const dia = marcas.filter((m) => m.unidad === 'dia');
  const usadas = conDias.length ? [...conDias, ...semana] : semana.length ? semana : mes.length ? mes : dia.length ? dia : marcas;
  const unidad = usadas[0].unidad;
  const cada = usadas.find((m) => m.cada > 1)?.cada ?? 1;

  let dias = [...new Set(conDias.flatMap((m) => m.dias ?? []))];
  if (unidad === 'semana' && !dias.length) {
    // «Cada semana, el martes»: un día suelto cerca de la frase.
    const sueltos = [...t.matchAll(new RegExp(`\\b(?:el|los|cada) (?:dia )?${LISTA_DIAS}\\b`, 'g'))]
      .map((m) => ({ ini: m.index, fin: m.index + m[0].length, dias: diasDe(m[0]) }));
    const cerca = masCercana(sueltos, usadas);
    if (cerca) { dias = cerca.dias; usadas.push({ ...cerca, unidad: 'semana', cada }); }
  }
  const diaMes = usadas.find((m) => m.diaMes != null)?.diaMes;

  const hallada = unidad === 'hora' ? null : masCercana(horasEn(t), usadas);
  // «Todas las tardes» es también la parte del día (`periodoEn` la lee).
  const periodo = masCercana(periodoEn(t), usadas)?.periodo ?? null;
  const conHora = unidad === 'hora' || !!hallada;

  const crudo: Record<string, unknown> = { unidad, cada, hora: hallada?.hora ?? 9, minuto: hallada?.minuto ?? 0 };
  if (unidad === 'semana') { crudo.diaSemana = dias[0] ?? 1; if (dias.length > 1) crudo.dias = dias; }
  if (unidad === 'mes' && diaMes != null) crudo.diaMes = diaMes;
  const base = sanearCron(crudo);
  if (!base) return null;
  // Un día 29, 30 o 31 no existe todos los meses (`DIA_MES_MAX`): se pregunta, no se corre a otro.
  const faltaDia = (unidad === 'semana' && !dias.length) || (unidad === 'mes' && (diaMes == null || diaMes !== base.diaMes));
  if (faltaDia) return { completo: false, falta: 'dia', base, periodo, conHora };
  if (!conHora) return { completo: false, falta: 'hora', base, periodo, conHora };
  return { completo: true, cron: base };
}

/** El valor de una opción de la pregunta del horario: el horario entero (lo lee `horarioConRespuestas`). */
export const valorDeHorario = (c: CronAviso): string => `cron:${JSON.stringify(c)}`;
const horarioDeValor = (v: string): CronAviso | null => {
  if (!v.startsWith('cron:')) return null;
  try { return sanearCron(JSON.parse(v.slice('cron:'.length))); } catch { return null; }
};

/**
 * EL HORARIO CON LO QUE CONTESTÓ. Una opción trae el horario entero; «Otra cosa» es texto que se lee igual que el pedido
 * pero SIN ventana («16:30», «los viernes»); «Elige tú» completa con lo de siempre (`porDefecto`, se avisa).
 */
export function horarioConRespuestas(pedido: unknown, respuestas: readonly RespuestaMako[]): HorarioPedido | null {
  let h = horarioDelPedido(pedido);
  if (!h) return null;
  for (const r of respuestas) {
    if (r.sobre !== 'horario' || h.completo) continue;
    const otra = r.texto?.trim();
    if (otra) { h = completarCon(h, otra); continue; }
    const c = r.valor ? horarioDeValor(r.valor) : null;
    if (c) { h = { completo: true, cron: c }; continue; }
    if (r.valor == null) h = { completo: true, cron: h.base, porDefecto: true };
  }
  return h;
}

/** Lo que falta, de un texto suelto («a las 4 de la tarde», «los jueves»): sin ventana, la primera que diga. */
function completarCon(h: Extract<HorarioPedido, { completo: false }>, texto: string): HorarioPedido {
  const t = plano(texto);
  const base: Record<string, unknown> = { ...h.base };
  let faltaDia = h.falta === 'dia';
  if (faltaDia && h.base.unidad === 'semana') {
    const dias = diasDe(t);
    if (dias.length) { base.diaSemana = dias[0]; base.dias = dias.length > 1 ? dias : undefined; faltaDia = false; }
  } else if (faltaDia && h.base.unidad === 'mes') {
    const m = /\b(\d{1,2})\b/.exec(t);
    const n = m ? Number(m[1]) : NaN;
    if (n >= 1 && n <= 28) { base.diaMes = n; faltaDia = false; }
  }
  const hora = horasEn(t)[0] ?? (() => {
    // «16», «a las 16»: un número solo también es la hora cuando lo que falta es la hora.
    const m = h.falta === 'hora' ? /^(?:a las )?(\d{1,2})$/.exec(t) : null;
    return m ? { hora: horaDe(Number(m[1]), undefined), minuto: 0 } : null;
  })();
  if (hora) { base.hora = hora.hora; base.minuto = hora.minuto; }
  const cron = sanearCron(base) ?? h.base;
  if (faltaDia) return { ...h, base: cron, conHora: h.conHora || !!hora };
  // Faltaba el día, lo escribió y la hora no se dijo nunca: ahora falta la hora (no se pone una a escondidas).
  if (!h.conHora && !hora) return { completo: false, falta: 'hora', base: cron, periodo: h.periodo, conHora: false };
  return { completo: true, cron };
}

/** Las horas que se ofrecen, según la parte del día que dijo. */
const HORAS_DE: Readonly<Record<PeriodoDia | 'cualquiera', readonly number[]>> = {
  manana: [9, 10, 11], tarde: [15, 16, 17], noche: [19, 20, 21], cualquiera: [9, 12, 15, 18],
};

/**
 * LA PREGUNTA DEL HORARIO: cada opción es el horario ENTERO dicho como lo dice el CRON («Todos los martes a las 15:00»),
 * así la persona ve lo que va a quedar. Falta la hora → 3 o 4 horas (las de la parte del día que dijo); falta el día →
 * lunes, miércoles y viernes (o el 1, el 15 y el 28 del mes), con la hora que dijo.
 */
export function preguntaHorario(h: Extract<HorarioPedido, { completo: false }>): PreguntaMako {
  const decir = (c: CronAviso) => textoCron(c, null);
  let crons: CronAviso[];
  if (h.falta === 'hora') {
    crons = HORAS_DE[h.periodo ?? 'cualquiera'].map((hora) => ({ ...h.base, hora, minuto: 0 }));
  } else if (h.base.unidad === 'mes') {
    crons = [1, 15, 28].map((diaMes) => ({ ...h.base, diaMes }));
  } else {
    crons = [1, 3, 5].map((d) => ({ ...h.base, diaSemana: d, dias: undefined }));
  }
  const opciones: OpcionPregunta[] = crons.map((c) => sanearCron(c)).filter((c): c is CronAviso => !!c)
    .map((c) => ({ valor: valorDeHorario(c), label: decir(c) }));
  return { id: `pregunta-horario-${h.falta}`, sobre: 'horario', texto: TEXTO_HORARIO, opciones, otra: true };
}

// ── A quién ──────────────────────────────────────────────────────────────────────

/** Sin tildes ni mayúsculas, y lo que no es letra ni número como un espacio (para buscar una frase ENTERA). */
const palabras = (s: unknown): string => normNombre(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const contiene = (texto: string, frase: string): boolean => !!frase && ` ${texto} `.includes(` ${frase} `);

/** «A todos», «toda la base», «todos los leads», «todos mis contactos». */
const RX_TODOS = /\b(?:a todos|a todas|todos los que|todas las que|toda la base|toda mi base|todos (?:los|mis|nuestros) (?:leads|contactos|clientes|prospectos)|todo el (?:funnel|embudo))\b/;
/** «El funnel principal», «el embudo principal»: el del negocio por defecto. */
const RX_PRINCIPAL = /\b(?:funnel|embudo|pipeline) principal\b/;

export type AudienciaPedido =
  /** El código ya sabe a quién: el valor del CRON (`venta:4:a,b,c`) y cómo se dice. */
  | { valor: string; texto: string }
  /** El pedido nombra una etapa o una etiqueta: la elige el modelo, de las de su ámbito. */
  | { elige: 'modelo' }
  /** No se sabe: se pregunta (`opciones`, cada una con su valor de CRON). */
  | { elige: 'preguntar'; opciones: OpcionPregunta[] };

/** Lo que mira «a quién» (las etiquetas pueden faltar: la API de MaKo pregunta con `CtxPreguntas`). */
type CtxAudiencia = Pick<CtxIA, 'productos' | 'disparadores'> & { etiquetas?: CtxIA['etiquetas'] };

/** TODAS las etapas de venta de un embudo, en un valor (`venta:4:a,b,c`). */
const todoElFunnel = (p: CtxIA['productos'][number]): string =>
  valorDeVarios(p.etapas.map((e) => `venta:${p.funnelId}:${e.value}`));
const todaLaEntrega = (p: CtxIA['productos'][number]): string =>
  valorDeVarios((p.etapasEntrega ?? []).map((e) => `entrega:${p.productoId}:${e.value}`));

/**
 * A QUIÉN LE LLEGA UN RECURRENTE, del pedido:
 *   · nombra una etapa o una etiqueta que existe → la elige el modelo (con el catálogo de siempre);
 *   · nombra UN embudo (o «el funnel principal») → todas sus etapas; habla de alumnos o clientes de un producto con
 *     entrega → todas las de su entrega;
 *   · dice «a todos» y el negocio tiene un solo embudo → todas sus etapas;
 *   · si no, se pregunta: cada embudo entero, y con uno solo, también sus etapas de a una.
 */
export function audienciaDelPedido(pedido: unknown, ctx: CtxAudiencia): AudienciaPedido {
  const ped = palabras(pedido);
  const plano0 = normNombre(pedido);
  const ventas = ctx.productos.filter((p) => p.funnelId != null && p.etapas.length > 0);
  const entregas = ctx.productos.filter((p) => p.productoId != null && (p.etapasEntrega?.length ?? 0) > 0);

  const etapaNombrada = ctx.productos.some((p) => [...p.etapas, ...(p.etapasEntrega ?? [])].some((e) => {
    const n = palabras(e.label);
    return n.length >= 3 && contiene(ped, n);
  }));
  // Una etiqueta cuenta sólo si el pedido habla de etiquetas: «la sesión de Lídermente» es el tema, no a quién.
  const etiquetaNombrada = /\betiquet/.test(ped) && (ctx.etiquetas ?? []).some((e) => !e.archivada && palabras(e.nombre).length >= 3 && contiene(ped, palabras(e.nombre)));
  if (etapaNombrada || etiquetaNombrada) return { elige: 'modelo' };

  if (hablaDeAlumno(String(pedido ?? '')) && entregas.length) {
    const nombrada = entregas.filter((p) => contiene(ped, palabras(p.nombre)));
    const p = nombrada.length === 1 ? nombrada[0] : entregas.length === 1 ? entregas[0] : null;
    if (p) return { valor: todaLaEntrega(p), texto: `los clientes de «${p.nombre}»` };
  }

  const nombrados = ventas.filter((p) => palabras(p.nombre).length >= 3 && contiene(ped, palabras(p.nombre)));
  const principal = RX_PRINCIPAL.test(plano0) ? ventas.filter((p) => p.esDefault) : [];
  const elegidos = nombrados.length ? nombrados : principal;
  if (elegidos.length === 1) return { valor: todoElFunnel(elegidos[0]), texto: `todos los de «${elegidos[0].nombre}»` };
  if (!elegidos.length && ventas.length === 1 && RX_TODOS.test(plano0)) {
    return { valor: todoElFunnel(ventas[0]), texto: `todos los de «${ventas[0].nombre}»` };
  }

  const candidatos = elegidos.length > 1 ? elegidos : ventas;
  const opciones: OpcionPregunta[] = candidatos.slice(0, 4).map((p) => ({ valor: todoElFunnel(p), label: `Todos los de «${p.nombre}»` }));
  if (candidatos.length === 1) {
    const p = candidatos[0];
    for (const e of p.etapas.slice(0, 3)) opciones.push({ valor: `venta:${p.funnelId}:${e.value}`, label: `Los de «${e.label}»` });
  }
  return { elige: 'preguntar', opciones };
}

/** La pregunta «¿A quién le llega?» (con 2 opciones o más; si no, null: el modelo elige). */
export function preguntaQuien(a: AudienciaPedido): PreguntaMako | null {
  if (!('elige' in a) || a.elige !== 'preguntar' || a.opciones.length < 2) return null;
  return { id: 'pregunta-quien', sobre: 'quien', texto: TEXTO_QUIEN, opciones: a.opciones, otra: true };
}

/** «hoy: 37», para el detalle de una opción. Sin número (no se pudo contar), sin detalle: nunca un cero inventado. */
export const detalleConteo = (n: number | null | undefined): string | undefined => (n == null ? undefined : `${n} hoy`);

/**
 * LO QUE CONTESTÓ A «¿A QUIÉN LE LLEGA?»: el valor de la opción (un CRON de cohorte), o null («Elige tú», «Otra cosa»:
 * lo elige el modelo con eso en el pedido). Sólo valores que `separarValor` entiende.
 */
export function quienDeRespuestas(respuestas: readonly RespuestaMako[]): string | null {
  const r = [...respuestas].reverse().find((x) => x.sobre === 'quien');
  if (!r?.valor || r.texto?.trim()) return null;
  return separarValor(r.valor).length ? r.valor : null;
}

// ── Lo que usa `crearConIA` ──────────────────────────────────────────────────────

/** ¿Es un valor de CRON con a quién barrer? (una etapa, varias, o «Se le puso «X»»; no un evento ni «se agrega etiqueta»). */
export const esValorDeCohorte = (valor: string | null | undefined): boolean =>
  !!valor && (/^(venta|entrega):[^:]+:[^:]+$/.test(valor) || /^etiqueta:-?\d+$/.test(valor));

/** El error para el reintento cuando el modelo eligió un evento como «a quién» de un Recurrente. */
export const ERROR_RECURRENTE_SIN_COHORTE = 'es un Recurrente: "disparador" es a quién le llega, una clave de «Etapa», «Entrega» o «Etiquetas»';

export type RecurrenteDelPedido = {
  cron: CronAviso;
  /** Algo del horario lo completó el código («Elige tú», o se acabaron las rondas): se avisa en el chat. */
  porDefecto: boolean;
  /** El CRON de a quién, si lo sabe el código (el pedido o la respuesta); null = lo elige el modelo, de las cohortes. */
  quien: string | null;
};

/**
 * EL RECURRENTE DE UN PEDIDO, con lo que contestó, o null si el pedido no dice un horario. El horario sale del pedido
 * tal cual lo escribió (`pedidoOriginal`); a quién, del pedido con lo que escribió al contestar (`pedidoConExtras`).
 */
export function recurrenteDelPedido(
  pedidoOriginal: string, pedidoConExtras: string, ctx: CtxAudiencia, respuestas: readonly RespuestaMako[],
): RecurrenteDelPedido | null {
  const h = horarioConRespuestas(pedidoOriginal, respuestas);
  if (!h) return null;
  const aud = audienciaDelPedido(pedidoConExtras, ctx);
  const quien = quienDeRespuestas(respuestas) ?? ('valor' in aud ? aud.valor : null);
  return { cron: h.completo ? h.cron : h.base, porDefecto: !h.completo || h.porDefecto === true, quien };
}

/**
 * LA LÍNEA DEL PEDIDO PARA EL MODELO: cuándo sale (ya puesto) y a quién. Con a quién puesto, el modelo no elige CRON; sin
 * él, elige una cohorte. Es un mensaje para TODOS a la vez: sin apodos de la guía de voz (va {{nombre}}).
 */
export function lineaRecurrente(rec: RecurrenteDelPedido, ctx: CtxAudiencia): string {
  const cuando = `CUÁNDO: ${textoCron(rec.cron, null)} (es un RECURRENTE y el horario ya está puesto)`;
  const quien = rec.quien
    ? `A QUIÉN: ${textoDeQuien(rec.quien, ctx)} (ya está puesto; "disparador" no hace falta)`
    : 'A QUIÉN: "disparador" es a quién le llega, los que ESTÁN en esas etapas o tienen esa etiqueta en cada vez (una clave de «Etapa», «Entrega» o «Etiquetas»)';
  return `${cuando}.\n${quien}.\nLe llega a todos a la vez: sin apodos de la guía de voz, con {{nombre}}.`;
}

// ── Un mensaje para todos no lleva apodos ───────────────────────────────────────────

/**
 * LOS APODOS QUE UNA GUÍA DE VOZ SUELE TRAER. Leila, editando #284 (20/10/2026): «no pongas hermosa, pon el nombre». Su
 * guía (`mako.voz_guia` del ws11) nombra «hermosa» cuatro veces y la regla 7 manda escribir con ella: en un mensaje que
 * le llega a TODOS a la vez (un Recurrente), un apodo es para alguien, no para cualquiera.
 */
const APODOS: readonly string[] = [
  'hermosa', 'hermoso', 'linda', 'lindo', 'reina', 'bella', 'bello', 'preciosa', 'precioso', 'corazon', 'carino', 'amor',
  'querida', 'querido', 'divina', 'divino', 'bonita', 'bonito', 'guapa', 'guapo', 'cielo', 'nena', 'nene', 'genia', 'genio',
  'bombon', 'mi vida', 'mi reina', 'mi amor',
];

/** Los apodos de la lista que nombra la guía de voz (sin la guía, ninguno: no se saca lo que nadie pidió). */
export function apodosDeVoz(voz: string | null | undefined): string[] {
  const t = ` ${palabras(voz)} `;
  return APODOS.filter((a) => t.includes(` ${a} `));
}

/** Delante de un apodo cuando se le HABLA a alguien: un saludo, una coma o «mi». «Qué lindo verte» no es un apodo. */
const ANTES_VOCATIVO = /(?:^|\b(?:hola+|hey|buenas|buen dia|buenos dias|buenas tardes|buenas noches|gracias|adios|que tal)\s+|,\s*|\bmi\s+)$/i;
/** Detrás: un signo o el final («te esperamos, hermosa!»). */
const DESPUES_VOCATIVO = /^\s*(?:[,!?.]|$)/;

/**
 * LOS MENSAJES AL LEAD SIN ESOS APODOS, sólo donde se le habla a alguien (`ANTES_VOCATIVO`, `DESPUES_VOCATIVO`): el
 * primero se vuelve {{nombre}} si el mensaje no lo tiene («Holaa hermosa!» → «Holaa {{nombre}}!»); si ya lo tiene, se
 * saca con su coma. Una guía de MaKo (`tipo: 'ia'`) no se toca: la contesta MaKo a UNA persona. Devuelve los que sacó,
 * para decirlo en el chat.
 */
export function sinApodos<P extends { nodo?: unknown; tipo?: unknown; cuerpo?: unknown }>(pasos: readonly P[], apodos: readonly string[]): { pasos: P[]; sacados: string[] } {
  if (!apodos.length) return { pasos: [...pasos], sacados: [] };
  const sacados = new Set<string>();
  const rx = new RegExp(`\\b(?:${apodos.map((a) => a.replace(/ /g, '\\s+')).join('|')})\\b`, 'gi');
  const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');
  const out = pasos.map((p) => {
    if (p.nodo || p.tipo === 'ia' || typeof p.cuerpo !== 'string') return p;
    const original = p.cuerpo;
    // Se busca sobre una copia sin tildes LETRA POR LETRA (`corazón`, `cariño`): cada letra sigue en su lugar, así que
    // las posiciones valen para el original.
    const plano = [...original].map((ch) => sinTildes(ch) || ch).join('');
    let conNombre = /\{\{\s*nombre\s*\}\}/.test(original);
    let texto = '';
    let desde = 0;
    for (const m of plano.matchAll(rx)) {
      let i = m.index ?? 0;
      let fin = i + m[0].length;
      const antes = plano.slice(0, i);
      if (!ANTES_VOCATIVO.test(antes) && !DESPUES_VOCATIVO.test(plano.slice(fin))) continue;
      sacados.add(normNombre(m[0]));
      if (conNombre) {
        // «Hola {{nombre}}, hermosa, ¿cómo estás?» → sin «, hermosa»: la coma de adelante se va con él.
        const coma = /,\s*$/.exec(antes);
        if (coma && coma.index >= desde) i = coma.index;
        else if (/^\s*,/.test(plano.slice(fin))) fin += /^\s*,/.exec(plano.slice(fin))![0].length;
      }
      texto += original.slice(desde, i) + (conNombre ? '' : '{{nombre}}');
      conNombre = true;
      desde = fin;
    }
    if (desde === 0) return p;
    texto += original.slice(desde);
    return { ...p, cuerpo: texto.replace(/ {2,}/g, ' ').replace(/\s+([!?.,])/g, '$1').trim() };
  });
  return { pasos: out, sacados: [...sacados] };
}

/** Cómo se dice una opción de «A quién» elegida, para el chat («todos los de «Funnel principal»»). */
export function textoDeQuien(valor: string, ctx: CtxAudiencia): string {
  const p = ctx.productos.find((x) => valor === todoElFunnel(x));
  if (p) return `todos los de «${p.nombre}»`;
  const e = ctx.productos.find((x) => (x.etapasEntrega?.length ?? 0) > 0 && valor === todaLaEntrega(x));
  if (e) return `los clientes de «${e.nombre}»`;
  const partes = separarValor(valor);
  const nombres = partes.map((v) => {
    const k = v.slice(v.lastIndexOf(':') + 1);
    return ctx.productos.flatMap((x) => [...x.etapas, ...(x.etapasEntrega ?? [])]).find((et) => et.value === k)?.label ?? k;
  });
  if (nombres.length) return `los de «${nombres.join('», «')}»`;
  const et = /^etiqueta:(\d+)$/.exec(valor);
  const nombre = et ? (ctx.etiquetas ?? []).find((x) => x.id === Number(et[1]))?.nombre : null;
  return nombre ? `los que tienen «${nombre}»` : 'los de ese CRON';
}
