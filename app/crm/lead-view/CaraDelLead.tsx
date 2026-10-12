'use client';

// =============================================================================
// CaraDelLead — la cara del lead en la cabecera de su ficha (pop-up y ruta)
// =============================================================================
// «Sería bueno que siempre traigas la foto de perfil del lead, buscala en WhatsApp y sino
// tiene, la foto del email» (Martín, 06/10/2026). Orden: lo que eligió una persona →
// WhatsApp → Gravatar del email → iniciales. La cadena vive en
// app/_components/foto-contacto.ts (la misma que usa Customer Success) y el dibujo en
// `Marca`, que ya sabe pintar la foto elegida, la automática y las iniciales.
//
// ⚠️ DESDE EL 12/10/2026 ES UN HOOK Y NO UN COMPONENTE. La cabecera de la ficha pasó a ser
// `CabeceraDetalle` (portada + la marca que la cruza; punto 11: «agregues la opción de configurar
// la portada y foto de perfil que ya tenemos en varios lugares»), y esa pieza pinta su propia
// `Marca`. Lo que no puede duplicarse es la CADENA de la foto: `useCaraDelLead` devuelve las dos
// cosas que `Marca` necesita, y la usa app/crm/lead-view/CabeceraLead.tsx. El componente
// `CaraDelLead` que dibujaba la cara suelta se fue con su último call site.

import { useFotoContacto } from '@/app/_components/foto-contacto';

/**
 * Lo que `Marca` necesita para dibujar la cara: lo ELEGIDO (`icono`, o la foto vieja de
 * `avatar_url`, que `Marca` lee como respaldo) y la foto AUTOMÁTICA que cargó (WhatsApp → email).
 *
 * Lo elegido gana: con `icono` o `avatarUrl` puestos, la cadena automática ni se pide
 * (`candidatasDeFoto` devuelve `[]`).
 */
export function useCaraDelLead({ telefono, fotoEmail, fotoGuardada, icono, avatarUrl }: {
  telefono: string | null;
  /** La foto del email (Gravatar, `d=404`), armada en el server. */
  fotoEmail: string | null;
  /** La copia de su foto de WhatsApp en nuestro bucket (`leads.foto_auto_url`). */
  fotoGuardada?: string | null;
  icono?: string | null;
  avatarUrl?: string | null;
}): { icono: string | null; foto: string | null } {
  const foto = useFotoContacto({ icono, avatarUrl, telefono, fotoEmail, fotoGuardada });
  return { icono: icono ?? avatarUrl ?? null, foto };
}
