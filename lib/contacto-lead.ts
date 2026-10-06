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
  /** La copia de su foto de WhatsApp en NUESTRO bucket (`leads.foto_auto_url`, mig 0195).
   *  No vence, a diferencia de la URL de WhatsApp: por eso va antes. */
  fotoGuardada?: string | null;
  /** La URL de Gravatar con `d=404`, armada en el SERVER (el hash usa `node:crypto`). */
  fotoEmail?: string | null;
};

/**
 * Las fotos candidatas, en orden: la de WhatsApp GUARDADA → WhatsApp en vivo → email. Vacío si la persona ya eligió una
 * (lo elegido gana siempre: es el mismo orden que `caraDeUsuario`, lib/gravatar.ts).
 *
 * ⚠️ El `?ws=` va en la URL de WhatsApp (`conWs`): un `<img>` no pasa por el parche de
 * fetch, y sin esto el super admin mirando a un cliente pediría la foto a la línea de
 * WhatsApp de SU workspace.
 */
export function candidatasDeFoto(c: Contacto, ws: number | null): string[] {
  if (c.icono?.trim() || c.avatarUrl?.trim()) return [];
  const out: string[] = [];
  if (c.fotoGuardada?.trim()) out.push(c.fotoGuardada.trim());
  const digitos = (c.telefono ?? '').replace(/\D/g, '');
  // Menos de 8 dígitos no es un número de WhatsApp: pedirlo es una consulta a Evolution
  // que sólo puede contestar que no.
  if (digitos.length >= 8) out.push(conWs(`/api/whatsapp/evolution/mensajes?avatarimg=${digitos}`, ws));
  if (c.fotoEmail?.trim()) out.push(c.fotoEmail.trim());
  return out;
}

// ── La foto de WhatsApp, GUARDADA (mig 0195) ─────────────────────────────────
// La URL que da WhatsApp (pps.whatsapp.net) viene firmada y VENCE a los 10 días: su `oe`
// es el vencimiento en segundos, en hexadecimal. El cron fotos-contacto copia los bytes a
// nuestro bucket mientras la URL vale; estas funciones deciden QUÉ se copia, sin red.

/** Cuándo vence una URL firmada de WhatsApp (ms), o `null` si no trae `oe` legible. */
export function venceFotoWa(url: string): number | null {
  try {
    const oe = new URL(url).searchParams.get('oe');
    if (!oe || !/^[0-9a-f]{6,12}$/i.test(oe)) return null;
    return parseInt(oe, 16) * 1000;
  } catch {
    return null;
  }
}

/**
 * El número sin el «1» de celular mexicano: 52·1·10 y 52·10 son la MISMA línea (WhatsApp
 * guarda la primera forma y el CRM casi siempre la segunda — medido: 1142 de 1153 leads del
 * cliente más grande en 52·10 contra 2951 JIDs en 52·1·10).
 */
export function numeroCanonico(tel: string | null | undefined): string | null {
  const d = (tel ?? '').replace(/\D/g, '');
  if (d.length < 10) return null;
  return d.length === 13 && d.startsWith('521') ? '52' + d.slice(3) : d;
}

/**
 * De la agenda a un mapa «últimos 10 dígitos → URL de foto que todavía vale».
 *
 * ⚠️ LOS ÚLTIMOS 10 TRAEN CANDIDATOS; QUIÉN ES QUIÉN LO DECIDE EL NÚMERO ENTERO (AGENTS.md).
 * Si bajo la misma clave hay dos números DISTINTOS (otro país, otra línea), la clave no
 * entra: elegir uno sería ponerle a un lead la cara de otra persona. Medido: 5 claves así en
 * un cliente, 2 en otro. Si es el mismo número dos veces (las dos formas, o dos URLs
 * firmadas de la misma foto), gana la que vence más tarde.
 *
 * Una URL que vence en menos de `margenMs` no entra: no llegaría a bajarse. Una sin `oe`
 * legible sí (no se sabe que esté vencida, y si lo está la descarga falla y no se guarda).
 */
export function fotosVigentes(
  contactos: { telefono: string | null; fotoUrl: string | null }[],
  ahora: number,
  margenMs = 6 * 3600_000,
): Map<string, string> {
  const porClave = new Map<string, { numero: string; url: string; vence: number } | 'ambigua'>();
  for (const c of contactos) {
    const url = (c.fotoUrl ?? '').trim();
    const numero = numeroCanonico(c.telefono);
    if (!numero || !/^https:\/\//i.test(url)) continue;
    const vence = venceFotoWa(url) ?? Number.POSITIVE_INFINITY;
    if (vence < ahora + margenMs) continue;
    const clave = numero.slice(-10);
    const prev = porClave.get(clave);
    if (prev === 'ambigua') continue;
    if (prev && prev.numero !== numero) { porClave.set(clave, 'ambigua'); continue; }
    if (!prev || vence > prev.vence) porClave.set(clave, { numero, url, vence });
  }
  const out = new Map<string, string>();
  for (const [k, v] of porClave) if (v !== 'ambigua') out.set(k, v.url);
  return out;
}

/** Los leads cuya foto hay que copiar: tienen una vigente en la agenda y no tienen copia, o
 *  la copia tiene más de `refrescoDias` (la persona pudo cambiar su foto). */
export function leadsParaGuardarFoto(
  leads: { id: number; telefono: string | null; foto_auto_at?: string | null }[],
  fotos: Map<string, string>,
  ahora: number,
  refrescoDias = 30,
): { id: number; url: string }[] {
  const out: { id: number; url: string }[] = [];
  for (const l of leads) {
    const numero = numeroCanonico(l.telefono);
    if (!numero) continue;
    const url = fotos.get(numero.slice(-10));
    if (!url) continue;
    const ultima = l.foto_auto_at ? Date.parse(l.foto_auto_at) : NaN;
    if (Number.isFinite(ultima) && ahora - ultima < refrescoDias * 86_400_000) continue;
    out.push({ id: l.id, url });
  }
  return out;
}
