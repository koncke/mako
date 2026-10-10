// =============================================================================
// flujo-ia-cliente — lo que la PANTALLA de «Crear con IA» decide con el resultado
// =============================================================================
// Módulo PURO, sin imports y sin `server-only`, a propósito: lo importan un `'use client'`
// (app/automations/SecuenciaPerfil.tsx) y la ruta (app/api/chat-agent/secuencias/ia/route.ts). No vive en
// lib/flujo-ia.ts porque ése lleva los dos prompts enteros, y un `'use client'` que importa un VALOR
// de ahí se los lleva al navegador (AGENTS.md: `'use client'` es una frontera de DATOS).
//
// Revisión de la segunda tanda (09/10/2026): dos hallazgos del frente IA viven acá.
// =============================================================================

/**
 * QUÉ AVISO VA PRIMERO. La pantalla muestra UNO (texto corto, AGENTS.md) y mostraba `avisos[0]`, que
 * es el primero que salió al procesar las tarjetas; la ruta agrega al FINAL los que más importan
 * («Elige qué la dispara en el CRON»: sin disparador no inscribe a nadie). Con cualquier aviso antes,
 * ésos no se veían nunca, y tampoco «No tengo guardado el link «agenda»: el mensaje va sin link» si
 * antes hubo un «Borré un link…».
 *
 *   0 — lo que cambia lo que sale y pide algo a la persona: el disparador, un link o un audio que no
 *       va, un monto que hay que poner, un tramo que no se agregó;
 *   1 — lo que se sacó (y, desde la tercera tanda, la flecha de una tarjeta colgada de dos lugares:
 *       sin «Ir a», la segunda salida queda vacía);
 *   2 — lo cosmético.
 * Estable: dentro de la misma prioridad queda el orden de llegada.
 */
const PRIORIDAD: ReadonlyArray<RegExp> = [
  /dispara|sin link|va como texto|monto|no la pis[ée]|no lo agregu[ée]|no agregu[ée]/i,
  /^(Saqu[ée]|Cort[ée]|Borr[ée])|dej[ée] en el primero/,
];

function prioridad(a: string): number {
  const i = PRIORIDAD.findIndex((re) => re.test(a));
  return i < 0 ? PRIORIDAD.length : i;
}

export function ordenarAvisos(avisos: readonly string[]): string[] {
  return avisos.map((a, i) => ({ a, i, p: prioridad(a) })).sort((x, y) => x.p - y.p || x.i - y.i).map((x) => x.a);
}

/**
 * Lo que se DIBUJA: el aviso que más importa y cuántos más hay («… (+2)»). `todos` va en el `title`:
 * no ocupa lugar y se lee al pasar el cursor. null = no hay nada que decir.
 */
export function resumenAvisos(avisos: readonly string[]): { texto: string; todos: string[] } | null {
  if (!avisos.length) return null;
  const todos = ordenarAvisos(avisos);
  return { texto: todos.length > 1 ? `${todos[0]} (+${todos.length - 1})` : todos[0], todos };
}

/**
 * ¿EL BORRADOR SIGUE SIENDO EL QUE SE LE MANDÓ A LA IA? Editar arma el resultado sobre la foto que
 * la caja mandó al hacer clic (`base`), y mientras la IA trabaja el lienzo sigue editable: aplicar el
 * resultado sobre un lienzo que cambió borra de la pantalla la corrección hecha en el medio (y el
 * siguiente Publicar la revierte). Si cambió, el resultado NO se aplica y se pide de nuevo.
 */
export function edicionVigente(base: readonly unknown[] | undefined, actuales: readonly unknown[]): boolean {
  if (!base) return true;
  return JSON.stringify(base) === JSON.stringify(actuales);
}
