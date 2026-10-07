// =============================================================================
// onboarding-clientes — qué DATO cierra cada paso del onboarding de la tab Clientes
// =============================================================================
// Regla de la casa: toda tab tiene onboarding y su estado alimenta a MaKo
// (.claude/skills/tab-onboarding). Los pasos están declarados en lib/tab-onboarding-catalogo.ts
// (`customer-success`); acá vive la regla de cuándo cada uno está hecho, y es PURA para que el test
// la ejecute. El molde es el de la tab Curso (./curso/onboarding-curso.ts).
//
// ⚠️ EL ESTADO SE DERIVA DE LOS DATOS, NO SE RECUERDA (#109). El ws1 llegó a esta tab con sus
// productos, sus etapas y catorce clientes: un paso que sólo se cerrara «haciéndolo acá» le pediría
// a Mauricio armar lo que ya tiene. La página llama a `cambiosDeOnboarding` en cada carga y escribe
// lo que el dato dice (./onboarding-clientes-sync.ts).
//
// ⚠️ «NO PUDE LEER» NO ES «NO HAY» (AGENTS.md): un hecho en `null` no marca ni desmarca nada. Una
// lectura caída de la entrega que desmarcara «Tu servicio» le volvería a pedir a Mauricio su
// catálogo.
//
// Sin 'use client' ni 'server-only': lo usan la página (server), la lista de la tab (navegador) y
// el test.

/** La key de la tab en el catálogo de onboardings (y en el nav). */
export const TAB_CLIENTES = 'customer-success';

/** Los pasos, EN EL ORDEN DEL CATÁLOGO. El test compara las dos listas: el orden es una guarda. */
export const PASOS_CLIENTES = ['cs_servicio', 'cs_clientes', 'cs_ficha'] as const;
export type PasoClientes = (typeof PASOS_CLIENTES)[number];

/**
 * Lo que se sabe de la tab en este workspace. `null` = no se pudo leer.
 *
 * `servicios` son los productos que la entrega ofrece CON ETAPAS (lo que el kanban dibuja);
 * `movidos`, las filas de `cliente_entrega` (alguien ubicó a un cliente en una etapa);
 * `fichaAbierta`, que alguien abrió la ficha de un cliente — un hecho que sólo se ve en el
 * navegador, así que lo anota una action (`anotarFichaAbiertaAction`).
 */
export type HechosClientes = {
  servicios: number | null;
  clientes: number | null;
  movidos: number | null;
  fichaAbierta?: boolean;
};

const hay = (n: number | null): boolean | null => (n == null ? null : n > 0);

/** Qué dice el dato de cada paso: `true` hecho, `false` no hecho, `null` no se sabe. */
export function pasosDeLosDatos(h: HechosClientes): Record<PasoClientes, boolean | null> {
  return {
    cs_servicio: hay(h.servicios),
    cs_clientes: hay(h.clientes),
    // El ensayo lo cierra abrir una ficha, o haber movido a un cliente de etapa: eso es usar la
    // tab más a fondo que mirarla, y es lo que deja al ws1 (con clientes ya ubicados) sin lista.
    cs_ficha: h.fichaAbierta || (h.movidos ?? 0) > 0 ? true : hay(h.movidos),
  };
}

/**
 * Los pasos que el dato puede DESHACER: los servicios se borran y los clientes se pierden. Haber
 * abierto una ficha es un hecho que ya pasó — no se des-abre.
 */
const DESMARCABLES: ReadonlySet<PasoClientes> = new Set<PasoClientes>(['cs_servicio', 'cs_clientes']);

/**
 * Lo que hay que escribir para que el estado guardado diga lo mismo que los datos, en el orden
 * del catálogo (marcar `cs_ficha` exige los dos anteriores: `pasoBloqueadoPor`).
 */
export function cambiosDeOnboarding(
  steps: Readonly<Record<string, { done?: boolean } | undefined>>,
  h: HechosClientes,
): Array<{ paso: PasoClientes; done: boolean }> {
  const d = pasosDeLosDatos(h);
  const out: Array<{ paso: PasoClientes; done: boolean }> = [];
  for (const p of PASOS_CLIENTES) {
    const hecho = !!steps[p]?.done;
    if (d[p] === true && !hecho) out.push({ paso: p, done: true });
    else if (d[p] === false && hecho && DESMARCABLES.has(p)) out.push({ paso: p, done: false });
  }
  return out;
}

/** Lo que la lista de la tab necesita saber: qué paso está hecho. */
export type OnboardingClientes = Record<PasoClientes, boolean>;

/**
 * Lo que la lista DIBUJA: lo anotado, o lo que el dato leído en esta carga ya dice que está hecho.
 *
 * ⚠️ NO ES LO MISMO QUE LO ANOTADO, Y NO PUEDE SERLO (07/10/2026, revisión de #109). Lo anotado
 * respeta el orden del catálogo (`marcarPasoTab` tira si falta un paso anterior), y así tiene que
 * ser: es lo que lee MaKo. Pero un workspace con ganados y SIN ningún producto con etapas no puede
 * anotar «Tus clientes» (le falta «Tu servicio» antes), el sync se traga el error, y la lista decía
 * «Carga uno o gana una venta en el CRM» con su botón ARRIBA DE SUS 14 CLIENTES — la pantalla
 * negando el dato del que dice derivarse.
 *
 * Sólo SUMA hechos (`=== true`): un dato en `false` no desmarca en pantalla lo anotado (eso lo hace
 * `cambiosDeOnboarding`, y sólo para los pasos que se pueden deshacer), y un `null` —«no pude
 * leer»— no dice nada.
 */
export function pasosParaDibujar(
  steps: Readonly<Record<string, { done?: boolean } | undefined>>,
  h: HechosClientes,
): OnboardingClientes {
  const d = pasosDeLosDatos(h);
  return Object.fromEntries(PASOS_CLIENTES.map((p) => [p, !!steps[p]?.done || d[p] === true])) as OnboardingClientes;
}

/**
 * La lista se dibuja mientras falte algún paso. `null` = no se dibuja (la lectura de lo anotado
 * falló, o ya está todo): una lista sobre un estado que no se pudo leer le pediría al ws1 lo que
 * ya tiene.
 */
export function listaVisible(o: OnboardingClientes | null): boolean {
  return !!o && PASOS_CLIENTES.some((p) => !o[p]);
}

/** Cuántos productos tienen etapas que el kanban puede dibujar. */
export const serviciosConEtapas = (servicios: ReadonlyArray<{ etapas: readonly unknown[] }>): number =>
  servicios.filter((s) => s.etapas.length > 0).length;

/** Cuántas filas de entrega hay (clientes ubicados en una etapa de algún producto). */
export const filasDeEntrega = (porServicio: Readonly<Record<number, Readonly<Record<number, unknown>>>>): number =>
  Object.values(porServicio).reduce((n, m) => n + Object.keys(m).length, 0);
