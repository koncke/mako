// =============================================================================
// La cartera de una agencia — la condición, sola y testeable
// =============================================================================
// «¿Puede ESTA agencia mirar a ESTE cliente?» es la pregunta que decide si se
// abren los datos de un inquilino a otro. Vive acá, en una función pura, y
// **este módulo NO lleva `server-only` a propósito**: si la condición viviera
// adentro del que hace el trabajo sucio (lib/workspace.ts, que importa Supabase),
// ningún test la podría importar — y quedaría sin red justo donde más duele.
// Es el mismo criterio que `exigirClienteDePrueba` en lib/auth-session.ts, y por
// la misma razón: ése también protege algo destructivo y por eso se testea.
//
// Lo que NO vive acá: la consulta a la base. Eso es lib/agencia.ts, que sí es de
// servidor. Acá sólo el juicio sobre datos ya leídos.

/** Una fila de `agencia_clientes` (mig 0175), tal como la devuelve PostgREST. */
export type FilaCartera = {
  agencia_ws: number;
  cliente_ws: number;
  estado: string;
};

/** Los tres estados que la base acepta. El CHECK de la 0175 los fija. */
export const ESTADOS_CARTERA = ['pendiente', 'aprobado', 'revocado'] as const;
export type EstadoCartera = (typeof ESTADOS_CARTERA)[number];

/**
 * Rótulos de cada estado, para la pantalla. Cortos: es un chip, no una
 * explicación (AGENTS.md → «el texto que se DIBUJA es corto»).
 */
export const ROTULO_CARTERA: Record<EstadoCartera, string> = {
  pendiente: 'Espera aprobación',
  aprobado: 'Aprobado',
  revocado: 'Revocado',
};

/**
 * LA CONDICIÓN. En positivo y sin excepciones: hace falta una fila, de ESTA
 * agencia, para ESE cliente, en estado 'aprobado'.
 *
 * ⚠️ Escrita como «hay una fila que cumple» y NUNCA como «no hay ninguna que
 * prohíba». La diferencia la pagó el Reset, que decía `ws !== OWNER_WS` en tres
 * capas y por eso se ofrecía adentro de todos los clientes reales: una condición
 * negativa protege lo que enumera y deja pasar todo lo demás, y se queda vieja
 * sola — cada cliente nuevo entra en la lista de los no contemplados sin que nada
 * avise.
 *
 * ⚠️ Y los tres rechazos de arriba no son paranoia de tipos: son los tres modos
 * en que esto se puede romper desde afuera.
 *   · `agenciaWs` inválido → una sesión sin workspace (un super-admin sin espacio
 *     propio) llegaría con null y, sin este corte, cualquier fila cuyo
 *     `agencia_ws` también fuera null empataría.
 *   · `clienteWs` inválido → el id llega de un body o de un link.
 *   · iguales → lo cubre el CHECK de la base, y se repite acá porque la base
 *     puede tener filas anteriores al CHECK y porque un test tiene que poder
 *     preguntarlo sin base.
 */
export function puedeEntrar(
  agenciaWs: number | null | undefined,
  clienteWs: number | null | undefined,
  cartera: readonly FilaCartera[],
): boolean {
  if (!esWsValido(agenciaWs) || !esWsValido(clienteWs)) return false;
  if (agenciaWs === clienteWs) return false;
  return cartera.some(
    (f) => f.agencia_ws === agenciaWs && f.cliente_ws === clienteWs && f.estado === 'aprobado',
  );
}

/**
 * Los clientes que esta agencia SÍ puede mirar, ordenados y sin repetidos.
 * Lo usa la pantalla; el guard usa `puedeEntrar`, que contesta por uno.
 */
export function clientesAprobados(
  agenciaWs: number | null | undefined,
  cartera: readonly FilaCartera[],
): number[] {
  if (!esWsValido(agenciaWs)) return [];
  const ids = cartera
    .filter((f) => f.agencia_ws === agenciaWs && f.estado === 'aprobado' && f.cliente_ws !== agenciaWs)
    .map((f) => f.cliente_ws)
    .filter(esWsValido);
  return [...new Set(ids)].sort((a, b) => a - b);
}

/** Un id de workspace de verdad: entero y positivo. */
export function esWsValido(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

/**
 * A dónde vuelve alguien cuando aprieta «Salir de la vista».
 *
 * ⚠️ NO es una constante, y ése era el bug. La salida estaba cableada a '/admin'
 * en TRES lugares (ImpersonationBanner.tsx dos veces, OnboardingWizard.tsx una),
 * y '/admin' está en SOLO_ADMIN del gate: un usuario de agencia que la apretara
 * se comía el `denegarRol` y aterrizaba en /inicio. Funciona, pero no es salir —
 * es que la app te mueva a otro lado. Y AGENTS.md ya lo tiene escrito para
 * cualquier «vista de otro»: si la única salida no lleva a ningún lado, no hay
 * salida.
 *
 * El super-admin vuelve a su panel de workspaces; una agencia vuelve a su
 * cartera, que es la pantalla desde la que entró.
 */
export function rutaDeSalida(esSuperAdmin: boolean): string {
  return esSuperAdmin ? '/admin' : '/customer-success';
}
