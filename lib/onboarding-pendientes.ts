// =============================================================================
// onboarding-pendientes — lo que el cliente dejó para después, y sigue faltando
// =============================================================================
// La otra mitad de la salida del wizard. Postergar un paso de conexión saca al cliente
// del callejón, pero un pendiente que no se ve en ningún lado es un pendiente que no
// existe: a los dos días nadie se acuerda de que Meta quedó sin conectar, y el síntoma
// que llega después no es «me falta Meta» sino «MaKo no me muestra nada».
//
// ⚠️ EL ESTADO SE PREGUNTA, NO SE RECUERDA. Este módulo NO devuelve lo que dice el flag
// `postergado`: cruza el flag con la conexión REAL de hoy. Conectar Meta desde
// /integraciones tres días después tiene que apagar el recordatorio solo, sin que nadie
// vuelva a marcar nada — si hubiera que bajarlo a mano, dentro de un mes le estaría
// pidiendo a alguien algo que ya hizo, que es la forma más rápida de que dejen de
// leerlos. Es la misma regla que gobierna los pasos de conexión en toda la app.
//
// El flag sigue haciendo falta igual: dice que el cliente ELIGIÓ seguir. Sin él, esto
// no podría distinguir «lo dejó pendiente a propósito» de «todavía no llegó a ese paso»,
// y le pintaría el recordatorio a alguien que está a mitad del wizard.
// =============================================================================

import 'server-only';
import { capaDef, esPostergable, POSTERGABLE_TXT, PASOS_POSTERGABLES, type PasoOnboarding } from './capas';
import { getCapaActual, getWorkspaceActual } from './workspace';
import { getEstadoOnboarding, pendientesDeOnboarding } from './onboarding-state';
import { integracionConectada } from './credenciales';
import { getEstadoVerificacionContacto } from './mako-grupo';

export type PendienteOnboarding = {
  paso: PasoOnboarding;
  /** Qué le falta, en su idioma. Sale del catálogo (lib/capas.ts). */
  que: string;
  /** Dónde lo resuelve, con el nombre de la tab y su ruta. */
  donde: string;
  ruta: string;
};

/**
 * Lo que quedó pendiente en el workspace actual. Vacío si no postergó nada, si ya lo
 * resolvió, o si el workspace no hace onboarding.
 *
 * Cada paso postergable trae su propia forma de preguntar «¿sigue faltando?», y el
 * `satisfies` obliga a que estén TODOS: si mañana se suma uno a `PASOS_POSTERGABLES`
 * sin decir cómo se verifica, no compila. Sin esa atadura el paso nuevo tendría un
 * botón para postergarlo y ningún recordatorio después — el peor de los dos mundos,
 * porque se lee como que MaKo se olvidó.
 */
export async function pendientesOnboarding(): Promise<PendienteOnboarding[]> {
  const ws = await getWorkspaceActual();
  if (ws == null) return [];

  const capa = capaDef(await getCapaActual());
  const estado = await getEstadoOnboarding();

  // Solo se preguntan los que el cliente REALMENTE postergó: sin esto, un workspace
  // recién creado dispararía un ping a Meta y otro a WhatsApp en cada visita a /general.
  const candidatos = capa.onboarding.filter((p) => esPostergable(p) && estado.steps[p]?.postergado && !estado.steps[p]?.done);
  if (candidatos.length === 0) return [];

  const verificadores = {
    // TODAS las requeridas por su capa, no solo Meta: una capa con dos integraciones
    // obligatorias sigue incompleta con una sola conectada.
    integraciones: async () => {
      const conectadas = await Promise.all(capa.integracionesRequeridas.map((k) => integracionConectada(k)));
      return conectadas.some((c) => !c);
    },
    tabs: async () => !(await getEstadoVerificacionContacto(ws)).verificado,
  } satisfies Record<(typeof PASOS_POSTERGABLES)[number], () => Promise<boolean>>;

  const faltan = await Promise.all(
    candidatos.map(async (p) => [p, await verificadores[p as keyof typeof verificadores]()] as const),
  );
  const sigueFaltando = new Map(faltan);

  return pendientesDeOnboarding(estado, capa.onboarding, (p) => sigueFaltando.get(p) === true)
    .map((paso) => ({ paso, ...POSTERGABLE_TXT[paso as keyof typeof POSTERGABLE_TXT] }));
}
