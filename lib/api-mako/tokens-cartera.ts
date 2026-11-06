// =============================================================================
// api-mako/tokens-cartera — el token de AGENCIA: uno para toda la cartera, y cada pedido dice a qué cliente va
// =============================================================================
// La llamada con Thiago (29/10/2026, docs/promesas/2910-llamada-thiago.md): una agencia con 27 clientes que quiere migrar
// sus CRM por la API no puede acuñar 27 tokens, uno entrando a cada cuenta. El token de agencia (`mako_agt_…`) se acuña
// UNA vez en la cuenta de la agencia, y cada pedido nombra al cliente en el header `X-MaKo-Cliente: <número>`.
//
// LAS DOS DECISIONES, separadas (AGENTS.md, «Un permiso de UN inquilino sobre OTRO son DOS decisiones»):
//   1. ¿Este workspace es una agencia? (`esAgencia`: la capa y su fila en `agencias`). Si deja de serlo, el token deja de
//      valer para todos sus clientes.
//   2. ¿A ESTE cliente puede entrar? Una fila de `agencia_clientes` de ESTA agencia, para ESE cliente, en `aprobado`
//      (`puedeEntrar`, lib/agencia-cartera.ts, la MISMA regla que «Inspeccionar»).
// Las dos se REPREGUNTAN EN CADA PEDIDO (lib/api-mako/tokens-cartera-server.ts): una aprobación se revoca después de acuñar
// el token, y un permiso que sólo se mira al emitir es un permiso que se puede quitar y no se quita. «No pude leer» es un
// 503, nunca un sí.
//
// ⚠️ NUNCA ALCANZA A LA AGENCIA MISMA. Un token de cartera sin cliente, o con el número de la agencia, no cae a su cuenta:
// para su propio negocio, la agencia usa un token de los de siempre. Así un pedido mal armado no escribe en el negocio
// equivocado: no escribe en ninguno.
// ⚠️ Y UN CLIENTE AJENO CONTESTA 404, NO 403: un 403 confirmaría que ese número existe y es de otro.
// ⚠️ El header lo lee SÓLO un token de cartera. Para un token de los de siempre, `X-MaKo-Cliente` no cambia nada (el `ws`
// sale del token): un header no puede hacer saltar a un token de su negocio.
//
// SIN `server-only`: puro, lo prueba tests/api-mako-token-agencia.test.ts.
// =============================================================================

import { puedeEntrar, esWsValido, type FilaCartera } from '@/lib/agencia-cartera';

/** El prefijo de un token de agencia: a simple vista dice que vale para una cartera, no para una cuenta. */
export const PREFIJO_AGENCIA = 'mako_agt_';
/** El header que nombra al cliente. Lo exige todo pedido con un token de agencia. */
export const CABECERA_CLIENTE = 'X-MaKo-Cliente';

/**
 * El cliente que nombra el pedido: el header, o `?cliente=` en la URL (para un `curl` rápido). `undefined` = no vino;
 * `null` = vino algo que no es un número de cuenta.
 */
export function clienteDelPedido(headers: Headers, url: string | null = null): number | null | undefined {
  let crudo = headers.get(CABECERA_CLIENTE)?.trim() ?? '';
  if (!crudo && url) {
    try { crudo = new URL(url).searchParams.get('cliente')?.trim() ?? ''; } catch { /* sin URL legible, sin cliente */ }
  }
  if (!crudo) return undefined;
  if (!/^\d{1,12}$/.test(crudo)) return null;
  const n = Number(crudo);
  return esWsValido(n) ? n : null;
}

export type DecisionCliente =
  | { ok: true; ws: number }
  | { ok: false; status: 400 | 403 | 404; mensaje: string; listar?: true };

/**
 * ¿Este pedido de un token de agencia puede correr, y sobre qué cliente? Sobre datos YA leídos (la cartera de esa agencia
 * para ese cliente, y si sigue siendo agencia).
 */
export function decidirCliente(p: {
  agenciaWs: number;
  pedido: number | null | undefined;
  esAgencia: boolean;
  cartera: readonly FilaCartera[];
}): DecisionCliente {
  if (!p.esAgencia) {
    return { ok: false, status: 403, mensaje: 'Este token es de una agencia, y la cuenta que lo creó ya no es una agencia en MaKo. Para trabajar en tu propio negocio, usa un token de los de siempre.' };
  }
  if (p.pedido === undefined) {
    return { ok: false, status: 400, listar: true, mensaje: `Este token vale para los clientes de tu agencia: dime a cuál va cada pedido con el header «${CABECERA_CLIENTE}: <número de cuenta>». Los números están en «disponibles».` };
  }
  if (p.pedido === null) {
    return { ok: false, status: 400, listar: true, mensaje: `«${CABECERA_CLIENTE}» tiene que ser el número de cuenta de un cliente de tu agencia. Los números están en «disponibles».` };
  }
  if (!puedeEntrar(p.agenciaWs, p.pedido, p.cartera)) {
    return { ok: false, status: 404, listar: true, mensaje: `La cuenta #${p.pedido} no es un cliente aprobado de tu agencia.` };
  }
  return { ok: true, ws: p.pedido };
}

/**
 * ¿Quien creó un token de AGENCIA sigue administrando la agencia? Más estricto que un token de cuenta
 * (`creadorConAcceso`, tokens-creador.ts): ahí alcanza con ser admin de una agencia que tiene esa cuenta en su cartera;
 * acá tiene que ser admin de la AGENCIA MISMA (o admin global). Si no, el admin de una agencia que entró a la cuenta de
 * un cliente que a su vez es agencia podría acuñar un token para la cartera de ESE cliente, que no es la suya.
 */
export function creadorDeAgenciaConAcceso(agenciaWs: number, u: { rol: string; rol_ws: string | null; workspace_id: number | null; estado: string } | null): boolean {
  if (!u || u.estado === 'suspendido') return false;
  if (u.rol === 'admin') return true;
  return (u.rol_ws ?? 'admin') === 'admin' && u.workspace_id === agenciaWs;
}
