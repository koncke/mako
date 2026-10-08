// =============================================================================
// pedir-link — «Soy alumno: entrar con mi email»: qué se CONTESTA (puro, con test)
// =============================================================================
// La ruta (./link/route.ts) recibe un email y, si tiene una invitación vigente, le manda el link
// de entrada (lib/alumno-acceso.ts → `mandarLinkDeEntrada`). Acá vive la decisión de qué se le
// contesta a quien lo pidió, separada para que un test la EJECUTE: es la parte que no puede filtrar
// nada, y una regla así no se verifica leyendo.
//
// ⚠️ LA RESPUESTA NO DICE SI EL EMAIL EXISTE, Y NO ES SÓLO EL TEXTO: TAMBIÉN EL TIEMPO. Con «sí»
// y «no» distintos, el formulario sería un buscador de quién es alumno de qué negocio. Y aunque el
// texto fuera el mismo, buscar la invitación y mandar el mail tarda; contestar después de eso haría
// que el «sí» tarde un segundo más que el «no». Por eso la búsqueda y el mail van PROGRAMADOS
// (`after`) y la respuesta sale antes, idéntica para los dos: el estado de la base no puede llegar a
// la respuesta porque la respuesta no lo espera.
//
// ⚠️ Lo único que distingue la respuesta es lo que NO depende de la base: un email mal escrito
// (400) y demasiados intentos desde la misma IP (429). El tope POR EMAIL, en cambio, contesta igual
// que el éxito: decir «a este email ya le mandamos varios» también sería contar algo.
//
// ⚠️ SIN `server-only` y sin imports de la base, a propósito: lo importa el test. Las dependencias
// (programar, mandar, el rate limit) las pasa la ruta.

import { emailNormalizado, emailUtilizable } from '@/lib/agencia-altas';

/** Lo que se le contesta a todo email bien escrito, exista o no. Corto: es lo único que dice la pantalla. */
export const RESPUESTA_LINK = { ok: true as const, mensaje: 'Si tu email tiene acceso, te llegó un link.' };

/** Topes: por IP (lo que frena a quien prueba emails) y por email (lo que frena a quien llena la casilla de otro). */
export const TOPE_IP = { max: 5, ventanaMs: 10 * 60_000 };
export const TOPE_EMAIL = { max: 3, ventanaMs: 60 * 60_000 };

export type DepsPedirLink = {
  /** Corre el trabajo DESPUÉS de contestar (`after` en la ruta). */
  programar: (trabajo: () => Promise<void>) => void;
  /** Busca la invitación y manda el link (lib/alumno-acceso.ts). Puede no hacer nada. */
  mandar: (email: string) => Promise<void>;
  /** `true` = se permite (lib/rate-limit.ts). */
  limite: (clave: string, max: number, ventanaMs: number) => boolean;
};

export type RespuestaPedido =
  | { status: 200; body: typeof RESPUESTA_LINK }
  | { status: 400 | 429; body: { ok: false; error: string } };

export function pedirLinkDeEntrada(p: { ip: string; email: unknown }, deps: DepsPedirLink): RespuestaPedido {
  if (!deps.limite(`alumno-link:ip:${p.ip}`, TOPE_IP.max, TOPE_IP.ventanaMs)) {
    return { status: 429, body: { ok: false, error: 'Demasiados intentos. Prueba en unos minutos.' } };
  }
  const email = typeof p.email === 'string' ? emailNormalizado(p.email) : '';
  if (!emailUtilizable(email) || email.length > 254) return { status: 400, body: { ok: false, error: 'Ese email no sirve.' } };
  // Pasado el tope por email se contesta IGUAL que el éxito, y no se manda nada.
  if (!deps.limite(`alumno-link:email:${email}`, TOPE_EMAIL.max, TOPE_EMAIL.ventanaMs)) return { status: 200, body: RESPUESTA_LINK };
  deps.programar(async () => {
    try {
      await deps.mandar(email);
    } catch (e) {
      // Ya se contestó: un fallo acá sólo se puede registrar. Sin el email (es de una persona).
      console.error('[alumno-link] no pude mandar el link de entrada:', e instanceof Error ? e.message : e);
    }
  });
  return { status: 200, body: RESPUESTA_LINK };
}
