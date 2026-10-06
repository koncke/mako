// =============================================================================
// contacto-lead — lo puro de la ficha de contacto: el link de la web y las fotos candidatas
// =============================================================================
// Sin `server-only` y sin React, a propósito: son las dos decisiones que se pueden
// equivocar (qué se linkea, de dónde se pide una foto) y tienen que poder testearse sin
// navegador. Las usan app/crm/lead-view/InfoPrincipalCard.tsx y
// app/_components/foto-contacto.ts.
// =============================================================================

import { conWs } from './ws-tab';

/**
 * El link de la web, o `null` si no es un link que se pueda abrir. Sin esquema se le pone
 * `https://` (la gente escribe «acme.com»); con otro esquema que no sea http(s) NO se
 * linkea: un `javascript:` escrito en un campo libre es un link que ejecuta código.
 */
export function hrefDeWeb(web: string | null | undefined): string | null {
  const v = (web ?? '').trim();
  if (!v || /\s/.test(v)) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null;
  return `https://${v}`;
}

export type Contacto = {
  /** Lo que eligió una persona. Si hay algo acá, no se busca nada. */
  icono?: string | null;
  avatarUrl?: string | null;
  telefono?: string | null;
  /** La URL de Gravatar con `d=404`, armada en el SERVER (el hash usa `node:crypto`). */
  fotoEmail?: string | null;
};

/**
 * Las fotos candidatas, en orden: WhatsApp → email. Vacío si la persona ya eligió una
 * (lo elegido gana siempre: es el mismo orden que `caraDeUsuario`, lib/gravatar.ts).
 *
 * ⚠️ El `?ws=` va en la URL de WhatsApp (`conWs`): un `<img>` no pasa por el parche de
 * fetch, y sin esto el super admin mirando a un cliente pediría la foto a la línea de
 * WhatsApp de SU workspace.
 */
export function candidatasDeFoto(c: Contacto, ws: number | null): string[] {
  if (c.icono?.trim() || c.avatarUrl?.trim()) return [];
  const out: string[] = [];
  const digitos = (c.telefono ?? '').replace(/\D/g, '');
  // Menos de 8 dígitos no es un número de WhatsApp: pedirlo es una consulta a Evolution
  // que sólo puede contestar que no.
  if (digitos.length >= 8) out.push(conWs(`/api/whatsapp/evolution/mensajes?avatarimg=${digitos}`, ws));
  if (c.fotoEmail?.trim()) out.push(c.fotoEmail.trim());
  return out;
}
