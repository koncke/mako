'use client';

// =============================================================================
// foto-cliente — la cara de un cliente que nadie eligió: su WhatsApp, o la de su email
// =============================================================================
// Pedido de Martín (06/10/2026): «sería bueno que siempre traigas la foto de perfil del
// cliente, buscala en WhatsApp y sino tiene, la foto del email».
//
// ⚠️ LA REGLA NO VIVE ACÁ: vive en `app/_components/foto-contacto.ts` (el hook) y en
// `lib/contacto-lead.ts` (`candidatasDeFoto`, con test), que usan también la ficha del lead
// del CRM. Nació en este archivo y la sesión del CRM la mudó a una pieza común el mismo día:
// con dos copias, la del CRM y la de Customer Success elegirían distinto el día que una de
// las dos cambie el orden o el respaldo. Acá sólo se arma el contacto desde `ClienteCruce`.
//
// Lo que esa pieza garantiza, para quien lea sólo este archivo: lo que la persona eligió
// (`icono` / `avatar_url`) gana siempre; se prueba WhatsApp y después Gravatar con un
// `Image()` ANTES de dibujar (el `onError` de `Marca` cae directo a las iniciales y no deja
// encadenar); y la URL de WhatsApp lleva el `?ws=` a mano, porque un `<img>` no pasa por el
// parche de fetch.

import { useFotoContacto } from '@/app/_components/foto-contacto';
import type { ClienteCruce } from './cruce';

/** La primera candidata que CARGA, o `null` (iniciales) mientras tanto y si ninguna. */
export function useFotoCliente(c: Pick<ClienteCruce, 'icono' | 'avatarUrl' | 'ficha'>): string | null {
  return useFotoContacto({
    icono: c.icono, avatarUrl: c.avatarUrl,
    telefono: c.ficha?.contacto?.telefono ?? null,
    fotoGuardada: c.ficha?.contacto?.fotoGuardada ?? null,
    fotoEmail: c.ficha?.fotoEmail ?? null,
  });
}
