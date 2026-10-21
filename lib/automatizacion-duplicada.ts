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

/** Las palabras con peso: sin `{{datos}}`, sin acentos, sin números, de 4 letras o más. */
export function palabrasConPeso(texto: string): Set<string> {
  const limpio = texto.replace(/\{\{[^}]*\}\}/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return new Set(limpio.split(/[^a-zñ]+/).filter((w) => w.length >= 4));
}

/** Dice entre las palabras con peso de dos textos (0 a 1). */
export function parecido(a: string, b: string): number {
  const pa = palabrasConPeso(a); const pb = palabrasConPeso(b);
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
export function duplicadaDe(esta: Omit<AutoParaComparar, 'activa'>, otras: readonly AutoParaComparar[]): { id: number; nombre: string } | null {
  const mio = primerMensaje(esta.pasos);
  if (!mio) return null;
  const pocas = palabrasConPeso(mio).size < MIN_PALABRAS;
  for (const o of otras) {
    if (o.id === esta.id || !o.activa) continue;
    if (!esta.disparadores.some((a) => o.disparadores.some((b) => mismaCohorte(a, b)))) continue;
    const suyo = primerMensaje(o.pasos);
    if (!suyo) continue;
    const mismo = pocas || palabrasConPeso(suyo).size < MIN_PALABRAS ? igualNormalizado(mio, suyo) : parecido(mio, suyo) >= UMBRAL_PARECIDO;
    if (mismo) return { id: o.id, nombre: o.nombre };
  }
  return null;
}

/** El aviso, corto: «Ojo: «X» ya le escribe algo parecido a la misma gente». */
export const avisoDuplicada = (nombre: string): string => `Ojo: «${nombre}» ya le escribe algo parecido a la misma gente`;
