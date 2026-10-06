'use client';

// =============================================================================
// CaraDelLead — la cara del lead en la cabecera de su ficha (pop-up y ruta)
// =============================================================================
// «Sería bueno que siempre traigas la foto de perfil del lead, buscala en WhatsApp y sino
// tiene, la foto del email» (Martín, 06/10/2026). Orden: lo que eligió una persona →
// WhatsApp → Gravatar del email → iniciales. La cadena vive en
// app/_components/foto-contacto.ts (la misma que usa Customer Success) y el dibujo en
// `Marca`, que ya sabe pintar la foto elegida, la automática y las iniciales.

import { Marca } from '@/app/_components/Marca';
import { useFotoContacto } from '@/app/_components/foto-contacto';

export function CaraDelLead({ nombre, telefono, fotoEmail, icono, avatarUrl, tam = 46, color }: {
  nombre: string;
  telefono: string | null;
  fotoEmail: string | null;
  icono?: string | null;
  avatarUrl?: string | null;
  tam?: number;
  /** El color de la etapa: tiñe las iniciales mientras no haya foto. */
  color?: string;
}) {
  const foto = useFotoContacto({ icono, avatarUrl, telefono, fotoEmail });
  return <Marca icono={icono ?? avatarUrl ?? null} foto={foto} nombre={nombre} tam={tam} cuadrado color={color} />;
}
