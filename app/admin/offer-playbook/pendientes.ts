// =============================================================================
// pendientes — dónde el código de Offer todavía no aplica el marco escrito
// =============================================================================
// Sale del cruce del 11/10/2026 entre docs/offer-marco.md y lo que corre en HEAD
// (lib/offer-marco.ts, lib/offer-reglas.ts, lib/offer-ia.ts y el grupo Offer de
// lib/prompt-registry.ts). El detalle de cada uno, con archivo:línea, está en
// docs/hallazgos-offer.md → «El marco contra el código».
//
// Es una lista que se ACHICA: cuando uno se arregla (en el código o en el marco),
// se saca de acá y queda escrito en los hallazgos. Lo que se dibuja es corto a
// propósito: qué dice el marco, qué hace hoy MaKo y quién lo resuelve.
// =============================================================================

export type QuienDecide = 'codigo' | 'marco' | 'martin';

export const QUIEN_DECIDE: Record<QuienDecide, string> = {
  codigo: 'Cambiar el código',
  marco: 'Cambiar el marco',
  martin: 'Decides tú',
};

export type Pendiente = { tema: string; marco: string; hoy: string; decide: QuienDecide };

export const PENDIENTES_OFFER: readonly Pendiente[] = [
  {
    tema: 'Cifras inventadas',
    marco: 'MaKo nunca inventa testimonios, cifras de casos ni valores de bonos (§5).',
    hoy: 'Si la pieza Prueba o Bonos tiene cualquier dato, todas sus cifras pasan sin revisar; el valor total y la ecuación de valor no se revisan.',
    decide: 'codigo',
  },
  {
    tema: 'Preguntas que faltan',
    marco: '39 preguntas, y una que destraba cada dimensión (§3 y §4).',
    hoy: 'La guía tiene 13: no pregunta cuánto gana el cliente con el resultado, el costo y la capacidad, la primera semana ni el % cobrado al firmar.',
    decide: 'codigo',
  },
  {
    tema: 'Piezas mínimas',
    marco: 'Para analizar hace falta saber cuántos pagaron y cuántos lograron el resultado (§3).',
    hoy: 'Pide 5 piezas sin Prueba, y un «no sé» cuenta como pieza cubierta.',
    decide: 'martin',
  },
  {
    tema: 'Anclas de la rúbrica',
    marco: 'Anclas con números: margen, valor de 5 a 10 veces el precio, 50 a 75% cobrado al firmar (§4).',
    hoy: 'La IA puntúa con anclas sin números y sin las señales de alerta.',
    decide: 'codigo',
  },
  {
    tema: 'Cliente o promesa en 3 o menos',
    marco: 'Se rehace la oferta desde ahí antes de tocar precio o bonos (§4).',
    hoy: 'Sólo avisa y entrega la oferta completa, con precio y bonos.',
    decide: 'martin',
  },
  {
    tema: 'Lista para vender',
    marco: 'Además pasa el Check final: dolor urgente, resultado medible, entregables, garantía fuerte y precio por valor (§4).',
    hoy: 'No existe: puede decir «lista» con Precio y cobro en 5.',
    decide: 'codigo',
  },
  {
    tema: 'Garantía fuerte',
    marco: 'Con menos de 10 a 15 casos, garantía condicional por acciones, no devolución fuerte (§7.1).',
    hoy: 'El texto que lee la IA dice «sin casos»: con 3 casos puede proponer una devolución fuerte.',
    decide: 'codigo',
  },
  {
    tema: 'Alertas que faltan',
    marco: 'Avisar margen bajo 60%, dónde se corta el embudo y cuándo subir el precio (§6 y §9.5).',
    hoy: 'Sólo hay dos alertas: foco, y cliente o promesa en 3 o menos.',
    decide: 'codigo',
  },
  {
    tema: 'Alerta de foco',
    marco: 'Tres o más ofertas a la vez ya es mala nota en Foco (§4, D9).',
    hoy: 'Sin la facturación salta recién con 6, y la IA que pone la nota de Foco no la ve.',
    decide: 'codigo',
  },
  {
    tema: 'Supuestos',
    marco: 'Separar lo que propuso MaKo de lo que dijo el dueño del negocio (§5, sección 20).',
    hoy: 'Sólo lista los campos «[completar]».',
    decide: 'martin',
  },
  {
    tema: 'Reglas de cierre',
    marco: 'Cuotas con 50% inicial o más, valor de 4 a 5 veces el precio, bonos con su porqué, LTV:CAC (§6 y §7).',
    hoy: 'No llegan al texto que lee la IA.',
    decide: 'codigo',
  },
  {
    tema: 'Reglas sólo en el prompt',
    marco: 'Duración de 90 a 180 días, precio desde 1.000 USD, garantía nunca incondicional, nombres del método como propuesta.',
    hoy: 'Se cumplen si el modelo obedece; el código no las revisa.',
    decide: 'martin',
  },
  {
    tema: 'Topes de las listas',
    marco: 'De 3 a 5 fases, de 1 a 3 bonos y 2 o 3 nombres para el método (§2 y §7.2).',
    hoy: 'Acepta 6 fases, ningún bono y ningún nombre sin marcarlo.',
    decide: 'codigo',
  },
];
