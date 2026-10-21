// =============================================================================
// automatizacion-duplicada — «otra automatización ya le escribe esto a la misma gente»
// =============================================================================
// 20/10/2026, el Recurrente de Leila (ws11): #282 «Recordatorio clase reactivación» y el d2 de #284 «Recordatorio
// martes sesión LíderMente» iban a la MISMA cohorte (la etapa «reactivacion» del funnel 4) con casi el mismo primer
// mensaje («¡Holaa {{nombre}}! … mañana miércoles … clase presencial de LíderMente … Huayacán …»). Con las dos activas,
// cada lead recibía el recordatorio dos veces. Al activar o publicar, la pantalla avisa (no frena: puede ser a propósito).
//
// Misma cohorte = algún CRON de cada una alcanza a la misma gente: la misma etapa del mismo funnel (o de cualquiera: un
// funnel sin elegir es «todos»), la misma etapa de entrega del mismo producto, o la misma etiqueta. Los CRON por evento
// (un formulario, un DM, un pago) no se comparan: no hay cohorte que se pise.
//
// Parecido = el primer mensaje comparte la mitad de sus palabras con peso (Dice sobre las palabras de 4 letras o más,
// sin `{{datos}}`, sin acentos ni números). Medido el 20/10/2026 con #282 y #284: 0,61. Dos textos distintos para la
// misma etapa («¿Pudiste ver la clase?» y «Te dejo el link de la grabación») quedan muy por debajo.
//
// Puro: lo usa la tab (SecuenciaPerfil, al activar y al publicar) y lo prueba tests/automatizacion-duplicada.test.ts.
// =============================================================================

import { claseDe, esNodoMensaje, idDe, nodoPorId, raizSalida, type PasoGrafo } from './flujo-grafo';
import { subarbolRespuesta } from './flujo-conversacion';
import { partesDe } from './mensaje-partes';
import { TRIGGER_ETAPA, TRIGGER_ENTREGA, TRIGGER_ETIQUETA } from './nutricion-etapa';

/** Lo que se compara de un CRON (un `Disparador`, lib/disparadores.ts). */
export type CronParaComparar = {
  trigger_tipo: string;
  etapa?: string | null;
  etapas?: readonly string[] | null;
  funnel_id?: number | string | null;
  producto_id?: number | string | null;
  etiqueta_id?: number | string | null;
};
export type AutoParaComparar = { id: number; nombre: string; activa: boolean; disparadores: readonly CronParaComparar[]; pasos: readonly PasoGrafo[] };

/** Desde cuánto dos primeros mensajes son «el mismo» (ver el encabezado). */
export const UMBRAL_PARECIDO = 0.5;
/** Con menos palabras con peso no se compara por parecido: sólo si son iguales. */
const MIN_PALABRAS = 3;

const id = (v: unknown): string | null => {
  const n = Number(v);
  return v == null || v === '' || !Number.isFinite(n) ? null : String(n);
};
const etapasDeCron = (d: CronParaComparar): string[] =>
  (d.etapas?.length ? d.etapas : [d.etapa ?? '']).map((e) => String(e ?? '').trim()).filter(Boolean);

/** ¿Estos dos CRON alcanzan a la misma gente? */
export function mismaCohorte(a: CronParaComparar, b: CronParaComparar): boolean {
  if (a.trigger_tipo !== b.trigger_tipo) return false;
  const cruzan = (): boolean => { const eb = new Set(etapasDeCron(b)); return etapasDeCron(a).some((e) => eb.has(e)); };
  if (a.trigger_tipo === TRIGGER_ETAPA) {
    const fa = id(a.funnel_id); const fb = id(b.funnel_id);
    return (fa == null || fb == null || fa === fb) && cruzan();
  }
  if (a.trigger_tipo === TRIGGER_ENTREGA) return id(a.producto_id) != null && id(a.producto_id) === id(b.producto_id) && cruzan();
  if (a.trigger_tipo === TRIGGER_ETIQUETA) return id(a.etiqueta_id) != null && id(a.etiqueta_id) === id(b.etiqueta_id);
  return false;
}

/** El texto del primer mensaje de la salida (sin «Si responde»): la primera tarjeta que se le manda al lead. */
export function primerMensaje(pasos: readonly PasoGrafo[]): string {
  const respuestas = subarbolRespuesta(pasos);
  const texto = (p: PasoGrafo): string =>
    partesDe(p as Parameters<typeof partesDe>[0]).map((x) => (x.tipo === 'audio' ? '' : x.cuerpo ?? '')).join('\n').trim();
  // Desde la raíz, saltando las esperas y los «ir a» (una condición abre caminos: ahí se cae a la primera del orden).
  let actual = raizSalida(pasos);
  for (let i = 0; actual && i < 12; i++) {
    const p = nodoPorId(pasos, actual);
    if (!p) break;
    if (esNodoMensaje(p)) { const t = texto(p); if (t) return t; }
    if (claseDe(p) !== 'esperar' && claseDe(p) !== 'ir_a' && !esNodoMensaje(p)) break;
    actual = p.siguiente ?? null;
  }
  for (let i = 0; i < pasos.length; i++) {
    const p = pasos[i];
    if (esNodoMensaje(p) && !respuestas.has(idDe(p, i))) { const t = texto(p); if (t) return t; }
  }
  return '';
}

/** Las palabras con peso: sin `{{datos}}`, sin acentos, sin números, de 4 letras o más, y sin las de `fuera`. */
export function palabrasConPeso(texto: string, fuera: ReadonlySet<string> = SIN_FUERA): Set<string> {
  const limpio = texto.replace(/\{\{[^}]*\}\}/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return new Set(limpio.split(/[^a-zñ]+/).filter((w) => w.length >= 4 && !fuera.has(w)));
}
const SIN_FUERA: ReadonlySet<string> = new Set();

/**
 * LO QUE TIENE TODO MENSAJE DEL NEGOCIO Y NO DICE DE QUÉ HABLA (revisión del 21/10/2026): el saludo («Hola {{nombre}}»), el
 * que escribe («soy Leila de LíderMente», «te escribe…») y las palabras de relleno. Con ellos, dos mensajes cortos distintos
 * («¿Pudiste ver la clase?» y «Te dejo el link de la grabación») daban 0,55 y preguntaban en cada Activar: una pregunta que
 * se contesta «… igual» sin leer desarma el aviso para el caso de verdad.
 */
export const PALABRAS_DE_RELLENO: ReadonlySet<string> = new Set([
  'hola', 'holaa', 'holaaa', 'holi', 'holis', 'buenas', 'buenos', 'dias', 'tardes', 'noches', 'saludos', 'saludo', 'gracias',
  'escribe', 'escribo', 'equipo', 'aqui', 'desde', 'para', 'esta', 'este', 'estas', 'estos', 'como', 'pero', 'porque', 'donde',
  'cuando', 'sobre', 'tambien', 'todo', 'todos', 'tienes', 'tengo', 'quiero', 'queria',
]);

/**
 * LA FIRMA: el relleno, el nombre del negocio, y lo que se repite en el primer mensaje de la mayoría de sus automatizaciones
 * (con 3 o más; con 2 no se puede saber qué es firma y qué es contenido). Sale de la comparación.
 */
export function palabrasDeFirma(textos: readonly string[], negocio = ''): Set<string> {
  const out = new Set<string>([...PALABRAS_DE_RELLENO, ...palabrasConPeso(negocio)]);
  if (textos.length >= 3) {
    const veces = new Map<string, number>();
    for (const t of textos) for (const w of palabrasConPeso(t)) veces.set(w, (veces.get(w) ?? 0) + 1);
    const piso = Math.max(3, Math.ceil(textos.length * 0.6));
    for (const [w, n] of veces) if (n >= piso) out.add(w);
  }
  return out;
}

/** Dice entre las palabras con peso de dos textos (0 a 1), sin las de `fuera` (la firma). */
export function parecido(a: string, b: string, fuera: ReadonlySet<string> = SIN_FUERA): number {
  const pa = palabrasConPeso(a, fuera); const pb = palabrasConPeso(b, fuera);
  if (!pa.size || !pb.size) return 0;
  let comunes = 0;
  for (const w of pa) if (pb.has(w)) comunes++;
  return (2 * comunes) / (pa.size + pb.size);
}

const igualNormalizado = (a: string, b: string): boolean => {
  const n = (s: string) => s.replace(/\{\{[^}]*\}\}/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-zñ0-9]+/g, ' ').trim();
  return !!n(a) && n(a) === n(b);
};

/**
 * LA OTRA ACTIVA QUE LE ESCRIBE LO MISMO A LA MISMA GENTE, o null. `esta` es la que se activa o se publica (con su
 * lienzo y sus CRON de ahora, no los guardados); `otras`, las del negocio (ella misma y las pausadas no cuentan).
 */
export function duplicadaDe(
  esta: Omit<AutoParaComparar, 'activa'>, otras: readonly AutoParaComparar[], o: { negocio?: string } = {},
): { id: number; nombre: string } | null {
  const mio = primerMensaje(esta.pasos);
  if (!mio) return null;
  // La firma, con los primeros mensajes de TODAS las del negocio (ésta incluida): lo que no dice de qué habla cada una.
  const firma = palabrasDeFirma([mio, ...otras.filter((x) => x.id !== esta.id).map((x) => primerMensaje(x.pasos)).filter(Boolean)], o.negocio);
  const pocas = palabrasConPeso(mio, firma).size < MIN_PALABRAS;
  for (const otra of otras) {
    if (otra.id === esta.id || !otra.activa) continue;
    if (!esta.disparadores.some((a) => otra.disparadores.some((b) => mismaCohorte(a, b)))) continue;
    const suyo = primerMensaje(otra.pasos);
    if (!suyo) continue;
    const mismo = pocas || palabrasConPeso(suyo, firma).size < MIN_PALABRAS ? igualNormalizado(mio, suyo) : parecido(mio, suyo, firma) >= UMBRAL_PARECIDO;
    if (mismo) return { id: otra.id, nombre: otra.nombre };
  }
  return null;
}

/**
 * LO QUE SE COMPARA DE UNA AUTOMATIZACIÓN DE LA LISTA: lo PUBLICADO (es lo que manda el motor) y sus CRON. `cronsDe` es la
 * lista de la pantalla (`disparadoresDeSecuencia`, app/automations/EditorDisparadores.tsx), para que haya UNA.
 */
export function paraComparar<S extends { id: number; nombre: string; activa: boolean; pasos?: readonly unknown[] | null }>(
  s: S, cronsDe: (s: S) => readonly CronParaComparar[],
): AutoParaComparar {
  return { id: s.id, nombre: s.nombre, activa: s.activa, disparadores: cronsDe(s), pasos: (s.pasos ?? []) as readonly PasoGrafo[] };
}

/**
 * ¿LA QUE SE ACTIVA YA TIENE UNA GEMELA ACTIVA? Con lo PUBLICADO de las dos (revisión del 20/10/2026, noche): Activar no
 * publica nada, así que comparar el borrador del lienzo avisaba de más o de menos. La usan TODOS los caminos que prenden
 * algo: el interruptor del lienzo, el «⋯» de la lista y un CRON nuevo en una que ya está activa.
 */
export function duplicadaAlActivar<S extends { id: number; nombre: string; activa: boolean; pasos?: readonly unknown[] | null }>(
  esta: S, todas: readonly S[], cronsDe: (s: S) => readonly CronParaComparar[],
  o: { pasos?: readonly PasoGrafo[]; crons?: readonly CronParaComparar[]; negocio?: string } = {},
): { id: number; nombre: string } | null {
  const base = paraComparar(esta, cronsDe);
  return duplicadaDe({ ...base, ...(o.pasos ? { pasos: o.pasos } : {}), ...(o.crons ? { disparadores: o.crons } : {}) }, todas.map((s) => paraComparar(s, cronsDe)), { negocio: o.negocio });
}

/** El aviso, corto: «Ojo: «X» ya le escribe algo parecido a la misma gente». */
export const avisoDuplicada = (nombre: string): string => `Ojo: «${nombre}» ya le escribe algo parecido a la misma gente`;
