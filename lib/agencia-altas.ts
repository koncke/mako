// =============================================================================
// agencia-altas — lo que una agencia PIDE sumar, antes de que exista
// =============================================================================
// «En super admin, me tienen que aparecer las notificaciones de cuando una agencia
// intenta agregar a un nuevo usuario, para poder aceptarlo o rechazarlo»
// (27/09/2026).
//
// Acá vive la FORMA y la CONDICIÓN; la base y los guards de sesión, en
// `lib/agencia.ts`. ⚠️ SIN `server-only` A PROPÓSITO, por la misma razón que
// `lib/agencia-cartera.ts`: la condición que decide si una agencia puede pedir un
// alta es un guard cross-tenant, y un guard que ningún test puede importar es lo
// único sin red justo donde más duele.
//
// ⚠️ Y LA CONDICIÓN ES LA MISMA QUE LA DE ENTRAR, a propósito y no por comodidad:
// pedir sumar a alguien al equipo de un cliente es una acción SOBRE ese cliente, y
// quien no puede ni mirarlo no tiene por qué poder tocarlo. Escribirla aparte sería
// una segunda respuesta a «¿este cliente es tuyo?», y la segunda es la que se queda
// vieja — hoy diría lo mismo y el día que alguien revoque una cartera, no.

import { puedeEntrar, esWsValido, type FilaCartera } from './agencia-cartera';

export const ESTADOS_ALTA = ['pendiente', 'aprobada', 'rechazada'] as const;
export type EstadoAlta = (typeof ESTADOS_ALTA)[number];

/** Cómo se llama cada estado en la pantalla. Un estado sin rótulo deja un chip vacío. */
export const ROTULO_ALTA: Record<EstadoAlta, string> = {
  pendiente: 'Esperando aprobación',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

/** Los roles del negocio del cliente. Es el mismo CHECK que la mig 0178. */
export const ROLES_ALTA = ['admin', 'closer', 'setter'] as const;
export type RolAlta = (typeof ROLES_ALTA)[number];

export const ROTULO_ROL: Record<RolAlta, string> = {
  admin: 'Admin',
  closer: 'Closer',
  setter: 'Setter',
};

/**
 * Un email utilizable.
 *
 * ⚠️ NO ES UNA VALIDACIÓN DE RFC: es «tiene una arroba con algo a cada lado y un
 * punto después». Lo que este chequeo protege no es la sintaxis — es que no se
 * encole un pedido cuyo único efecto posible sea un mail que rebota, y que el
 * super admin no tenga que firmar basura. El email de verdad lo valida el envío.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const emailUtilizable = (v: unknown): v is string =>
  typeof v === 'string' && EMAIL_RE.test(v.trim());

/** Cómo se guarda y se compara un email: es la identidad, y una mayúscula no la cambia. */
export const emailNormalizado = (v: string): string => v.trim().toLowerCase();

/**
 * ¿Esta agencia puede PEDIR un alta sobre este cliente?
 *
 * En positivo y delegando en `puedeEntrar`: hay una fila APROBADA de esta agencia
 * sobre este cliente. 'pendiente' no alcanza —la firma que habilita a mirar es la
 * misma que habilita a pedir— y 'revocado' cierra.
 */
export function puedePedirAlta(
  agenciaWs: number | null | undefined,
  clienteWs: number | null | undefined,
  cartera: FilaCartera[],
): boolean {
  return puedeEntrar(agenciaWs, clienteWs, cartera);
}

/** Lo que un pedido necesita para existir. Devuelve el pedido limpio, o el motivo. */
export function sanearPedido(input: {
  agenciaWs: unknown; clienteWs: unknown; email: unknown; nombre?: unknown; rolWs?: unknown;
}): { ok: true; pedido: { agenciaWs: number; clienteWs: number; email: string; nombre: string; rolWs: RolAlta } }
  | { ok: false; error: string } {
  const agenciaWs = Number(input.agenciaWs);
  const clienteWs = Number(input.clienteWs);
  if (!esWsValido(agenciaWs) || !esWsValido(clienteWs)) return { ok: false, error: 'workspace inválido' };
  // El CHECK de la 0178 también lo prohíbe; acá se contesta antes para que el error
  // diga qué pasa en vez de devolver una violación de constraint.
  if (agenciaWs === clienteWs) return { ok: false, error: 'ese es tu propio workspace' };
  if (!emailUtilizable(input.email)) return { ok: false, error: 'el email no sirve' };

  // ⚠️ EL ROL CAE A `admin` SI NO LO MANDAN, y eso es lo que la base ya hace por
  // default — pero un valor RARO no cae al default: se rechaza. Un rol inventado que
  // el código colapsa en silencio es una decisión tomada por el default (AGENTS.md).
  const rolCrudo = input.rolWs === undefined || input.rolWs === null ? 'admin' : input.rolWs;
  if (!(ROLES_ALTA as readonly unknown[]).includes(rolCrudo)) return { ok: false, error: 'rol inválido' };

  return {
    ok: true,
    pedido: {
      agenciaWs, clienteWs,
      email: emailNormalizado(input.email),
      // El nombre es opcional de verdad: sin él, el alta usa el email, que es lo
      // que /admin ya hace. Se topea porque viaja a un renglón de una lista.
      nombre: typeof input.nombre === 'string' ? input.nombre.trim().slice(0, 120) : '',
      rolWs: rolCrudo as RolAlta,
    },
  };
}

/** El renglón que lee el super admin al firmar. Una frase: quién, a quién, con qué rol. */
export const resumenAlta = (a: {
  agencia: string; cliente: string; email: string; rolWs: string;
}): string => `${a.agencia} quiere sumar a ${a.email} al equipo de ${a.cliente} como ${ROTULO_ROL[a.rolWs as RolAlta] ?? a.rolWs}`;
