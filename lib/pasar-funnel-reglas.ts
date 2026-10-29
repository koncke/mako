// =============================================================================
// pasar-funnel-reglas — PASAR leads a otro funnel en bloque: a quiénes, a qué etapa y cómo se dice (puro)
// =============================================================================
// Leila, ticket #21 (28/10/2026): «Quiero limpiar la casilla de contacto nuevo de lidermente y pasarlo a Funnel general»
// (394 leads; MaKo le contestó que movía de a uno y dentro del mismo funnel). La decisión del Cerebro: mover a otro funnel
// y etapa; «si la etapa no existe en el destino, se elige; avisar los que ya agendaron o pagaron antes de moverlos».
//
// Lo que esto decide, sin base:
//   · a qué etapa caen: la MISMA clave si el destino la tiene, si no la de entrada del destino — y la pantalla lo dice
//     («Contacto nuevo no está en Funnel general»), porque elegir por la persona sin decirlo es el error de antes;
//   · a quiénes se pasa: los que tienen PLATA en el origen NUNCA (sus pagos son de ese funnel: pasarlos los sumaría al
//     revenue del otro), y los que ya AGENDARON sólo si la persona lo marca (una reunión puesta es un trato en curso).
// El server (`pasarAOtroFunnel`, lib/lead-funnel.ts) vuelve a frenar a los de plata: esto es la pregunta, no la guarda.
//
// Sin 'use client' ni 'server-only': lo leen la barra y la API de MaKo, y lo ejecuta tests/crm-acciones-bloque.test.ts.

import { etapaDeEntrada } from './lead-funnel-reglas';

export type EtapaDestino = { key: string; label: string; kind?: string | null; band?: string };

/** Lo que el server mira antes de preguntar. */
export type PreviaPasar = {
  /** Los que ya están en el destino (se quedan en su etapa de ahí: sólo salen del origen). */
  yaEstan: number[];
  /** Los que ya tienen una reunión cargada. */
  agendaron: number[];
  /** Los que tienen pagos o una venta en el origen: no se pasan. */
  pagaron: number[];
  /** Las etapas del destino, en su orden. */
  etapas: EtapaDestino[];
};

/** Las etapas a las que se puede pasar: las del recorrido y las de salida; no las de nutrición, que no son un lugar donde caer. */
export function etapasElegibles(etapas: readonly EtapaDestino[]): EtapaDestino[] {
  return etapas.filter((s) => (s.band ?? 'pipeline') !== 'nutricion');
}

/** La etapa que se sugiere: la misma clave si el destino la tiene; si no, la de entrada. `igual` dice cuál fue. */
export function etapaSugerida(origen: string | null, etapas: readonly EtapaDestino[]): { key: string | null; igual: boolean } {
  const ok = etapasElegibles(etapas);
  if (origen && ok.some((s) => s.key === origen)) return { key: origen, igual: true };
  return { key: etapaDeEntrada(ok), igual: false };
}

/** A quiénes se pasa de verdad: los tildados menos los que pagaron, y menos los que agendaron si no se los incluye. */
export function aPasar(ids: readonly number[], previa: Pick<PreviaPasar, 'agendaron' | 'pagaron'>, incluirAgendados: boolean): number[] {
  const plata = new Set(previa.pagaron);
  const agenda = new Set(previa.agendaron);
  return [...new Set(ids)].filter((id) => !plata.has(id) && (incluirAgendados || !agenda.has(id)));
}

/** Los avisos de la pregunta, cada uno con su número. Sólo los que hay: un «0 ya pagaron» es ruido. */
export function avisosDePasar(previa: Pick<PreviaPasar, 'agendaron' | 'pagaron' | 'yaEstan'>, ids: readonly number[], origen: string, destino: string): string[] {
  const en = new Set(ids);
  const pagaron = previa.pagaron.filter((id) => en.has(id)).length;
  const agendaron = previa.agendaron.filter((id) => en.has(id) && !previa.pagaron.includes(id)).length;
  const ya = previa.yaEstan.filter((id) => en.has(id)).length;
  return [
    pagaron ? `${pagaron} ${pagaron === 1 ? 'ya pagó' : 'ya pagaron'} en «${origen}»: ${pagaron === 1 ? 'se queda' : 'se quedan'} ahí, sus pagos son de ese funnel.` : '',
    agendaron ? `${agendaron} ${agendaron === 1 ? 'ya agendó una reunión' : 'ya agendaron una reunión'}.` : '',
    ya ? `${ya} ya ${ya === 1 ? 'estaba' : 'estaban'} en «${destino}»: ${ya === 1 ? 'sale' : 'salen'} de «${origen}» y ${ya === 1 ? 'queda' : 'quedan'} en su etapa de ahí.` : '',
  ].filter(Boolean);
}

/** El aviso del final: cuántos pasaron, cuántos ya estaban, cuántos no y por qué. */
export function resumenDePasar(r: { pasados: number; yaEstaban: number; fallaron: number; motivos: readonly string[] }, destino: string, etapa: string): string {
  const ya = r.yaEstaban ? ` (${r.yaEstaban} ya ${r.yaEstaban === 1 ? 'estaba' : 'estaban'} ahí)` : '';
  const mal = r.fallaron ? ` · ${r.fallaron} no se ${r.fallaron === 1 ? 'pudo' : 'pudieron'}${r.motivos.length ? `: ${r.motivos.slice(0, 2).join(' · ')}` : ''}` : '';
  return `${r.pasados} a «${destino}» · ${etapa}${ya}${mal}`;
}
