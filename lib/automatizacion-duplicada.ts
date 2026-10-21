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
 * LA FIRMA: sólo lo FIJO, el relleno y el nombre del negocio. ⚠️ NADA QUE SE CALCULE DE LOS TEXTOS (revisión del 21/10/2026):
 * la primera versión sumaba «lo que se repite en el primer mensaje de la mayoría», y contaba al PAR que se compara y a
 * todas las otras, pausadas y de otra etapa: con 3 a 5 automatizaciones, UNA más que dijera «Huayacán» sacaba esa palabra
 * de #282 contra #284 (0,53 → 0,47) y dejaba de avisar; una copia pausada de Duplicar borraba todo lo que el par
 * compartía. Otra heurística de texto que borra señal (AGENTS.md, «una heurística sobre el texto»).
 */
export function palabrasDeFirma(negocio = ''): Set<string> {
  return new Set<string>([...PALABRAS_DE_RELLENO, ...palabrasConPeso(negocio)]);
}

/** Cuántas palabras mira el arranque, como mucho (el saludo y quien escribe: «Hola {{nombre}}, soy Leila de LíderMente»). */
export const ARRANQUE_PALABRAS = 8;

/**
 * EL ARRANQUE DE UN MENSAJE: hasta el primer fin de frase (. ! ? ¿ ¡ o un salto de línea) después de la primera palabra, o
 * las primeras `ARRANQUE_PALABRAS` palabras. Ahí va el saludo; la firma se saca SÓLO de ahí (`palabrasSinFirma`).
 */
export function arranqueDe(texto: string): string {
  let vioLetra = false; let enPalabra = false; let palabras = 0;
  for (let i = 0; i < texto.length; i++) {
    const letra = /\p{L}/u.test(texto[i]);
    if (letra && !enPalabra && ++palabras > ARRANQUE_PALABRAS) return texto.slice(0, i);
    enPalabra = letra;
    if (letra) vioLetra = true;
    else if (vioLetra && /[.!?¿¡\n]/.test(texto[i])) return texto.slice(0, i);
  }
  return texto;
}

/**
 * Las palabras con peso SIN LA FIRMA: la firma sale sólo del arranque. La misma palabra más adelante es contenido («Te
 * esperamos en LíderMente…» al final del mensaje sigue contando).
 */
export function palabrasSinFirma(texto: string, firma: ReadonlySet<string>): Set<string> {
  const limpio = texto.replace(/\{\{[^}]*\}\}/g, ' ');
  const arranque = arranqueDe(limpio);
  const resto = palabrasConPeso(limpio.slice(arranque.length));
  return new Set([...palabrasConPeso(arranque, firma), ...resto]);
}

/** Dice entre las palabras con peso de dos textos (0 a 1); con `firma`, sin la firma de su arranque. */
export function parecido(a: string, b: string, firma: ReadonlySet<string> = SIN_FUERA): number {
  const pa = palabrasSinFirma(a, firma); const pb = palabrasSinFirma(b, firma);
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
  // La firma es lo FIJO (el relleno y el nombre del negocio), y sale sólo del arranque de cada mensaje.
  const firma = palabrasDeFirma(o.negocio);
  const pocas = palabrasSinFirma(mio, firma).size < MIN_PALABRAS;
  for (const otra of otras) {
    if (otra.id === esta.id || !otra.activa) continue;
    if (!esta.disparadores.some((a) => otra.disparadores.some((b) => mismaCohorte(a, b)))) continue;
    const suyo = primerMensaje(otra.pasos);
    if (!suyo) continue;
    const mismo = pocas || palabrasSinFirma(suyo, firma).size < MIN_PALABRAS ? igualNormalizado(mio, suyo) : parecido(mio, suyo, firma) >= UMBRAL_PARECIDO;
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
