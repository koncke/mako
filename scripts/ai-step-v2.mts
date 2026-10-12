// =============================================================================
// ai-step-v2 — RETIRADO en la undécima tanda (11/10/2026). No escribe nada.
// =============================================================================
// En la décima partía cada AI Step guardado en una tarjeta por caso (docs/diseno-ai-step-v2.md §8; lo aplicó el
// 11/10 sobre #198 y #213 del ws1, respaldo en backups/ai-step-v2-2026-10-11T15-20-50-160Z.json).
//
// La undécima lo dio vuelta. Martín: «Toda la cantidad de tarjetas de "AI Step" deberían ser una sola... Si
// justamente es el mismo objetivo, solo son diferentes objeciones o escenarios». La forma vigente es UN AI Step por
// medio, con el objetivo en la tarjeta (`juntarPasosIA`, lib/flujo-grafo.ts), y lo guardado se junta solo al abrir
// y al guardar. Correr esto PARTIRÍA de nuevo lo que el lienzo junta: por eso sale sin leer ni escribir.
//
// Lo que reescribe los flujos de producción con la forma de hoy es el script de la ola 4
// (scripts/undecima-flujos.mts, docs/diseno-undecima-tanda.md §3 y §8). La comprobación que este script usaba
// (`loQueContesta`) sigue en lib/ai-step-migrar.ts.
// =============================================================================

console.error('Retirado en la undécima: la forma vigente es UN AI Step por medio (juntarPasosIA). No se vuelve a correr.');
process.exit(1);
