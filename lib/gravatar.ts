// =============================================================================
// gravatar — la cara que una persona ya tiene, sin pedirle que suba nada
// =============================================================================
// «Si agrego el email, sería bueno que ya ponga la foto de perfil de ese email
// automáticamente en la card, y en todo caso que yo la pueda modificar»
// (27/09/2026). Gravatar contesta eso con el hash del email y sin ninguna cuenta
// de por medio: si esa persona tiene una foto cargada, aparece; si no, no.
//
// ⚠️ ES UN RESPALDO, NUNCA EL DATO. Lo que manda es `usuarios.foto_url` —lo que la
// persona eligió— y esto es lo que se dibuja mientras no haya elegido nada. El
// orden es `foto_url || gravatar || iniciales`, y esa cadena se escribe en UN solo
// lugar (`caraDeUsuario`) justo para que las tres pantallas no elijan distinto.
//
// ⚠️ Y VA `d=404` A PROPÓSITO. El default de Gravatar es dibujar un monigote
// generado del hash: eso le pondría una cara inventada a alguien que no tiene
// ninguna, y una cara inventada es peor que unas iniciales — se lee como que ES su
// foto. Con 404 la imagen falla y el `onError` de `Marca` cae a las iniciales.
//
// ⚠️ SIN `server-only`, Y NO ES UN OLVIDO. La precedencia de `caraDeUsuario` es
// justo lo que hay que poder testear —es la regla, no el hash— y un módulo con
// `server-only` no lo puede importar ningún test. Mismo criterio que
// `lib/agencia-cartera.ts` y `exigirClienteDePrueba`.
//
// Lo que lo mantiene fuera del navegador es el `node:crypto` de acá abajo: un
// `'use client'` que importe un valor de este archivo NO compila, que es
// exactamente el mismo corte duro que daría la directiva. Y no hace falta que
// llegue: el único componente que dibuja un Gravatar del lado del cliente
// (`app/conocimientos/Compartir.tsx`) recibe el HASH ya calculado desde
// `/api/compartir` y sólo arma la URL.

import { createHash } from 'node:crypto';

/** El hash con el que Gravatar identifica un email: minúsculas, sin espacios, SHA-256. */
export const hashGravatar = (email: string): string =>
  createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

/** La URL de su foto, del tamaño pedido. 404 si no tiene — ver la cabecera. */
export const urlGravatar = (email: string, tam = 120): string =>
  `https://www.gravatar.com/avatar/${hashGravatar(email)}?d=404&s=${tam}`;

/**
 * La cara de una persona, en el ÚNICO orden que vale: lo que eligió primero.
 *
 * Devuelve `null` cuando no hay email: sin email no hay Gravatar que pedir, y `null`
 * es lo que hace que `Marca` dibuje las iniciales.
 */
export const caraDeUsuario = (
  u: { foto_url?: string | null; email?: string | null },
  tam = 120,
): string | null =>
  u.foto_url?.trim() || (u.email?.trim() ? urlGravatar(u.email, tam) : null);
