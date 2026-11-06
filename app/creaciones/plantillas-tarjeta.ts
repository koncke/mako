// =============================================================================
// plantillas-tarjeta — una creación (plantilla propia o de la comunidad) como tarjeta de «Nuevo …» (6/11/2026)
// =============================================================================
// Puro (sin React ni base): lo usan usePlantillasPropias y tests/plantillas-propias-tarjeta.test.ts.
//   · El id de la tarjeta es `creacion:<n>`: no puede chocar con el de una plantilla de MaKo de la tab (ninguna lleva «:»
//     seguido de un número… y si alguna lo llevara, `idDeTarjeta` exige el prefijo entero).
//   · Grupo: «Tus plantillas» (las del negocio, privadas y compartidas) y «De la comunidad».
//   · Insignia: 🔒 si es sólo del negocio; si no, sus estrellas (y quién la hizo, en la de la comunidad).
// =============================================================================

import type { PlantillaCrear } from '@/app/_crear/reglas';
import { numeroCorto } from '@/lib/creaciones-reglas';

/** Lo que la tarjeta necesita de una creación (lo que devuelve lib/creaciones.ts, sin la definición). */
export type CreacionParaTarjeta = { id: number; titulo: string; descripcion: string; autor: string; estado: string; estrellas: number; usos: number };

export const PREFIJO_TARJETA = 'creacion:';
export const GRUPO_MIAS = 'Tus plantillas';
export const GRUPO_COMUNIDAD = 'De la comunidad';

export function idDeTarjeta(id: string): number | null {
  if (!id.startsWith(PREFIJO_TARJETA)) return null;
  const n = Number(id.slice(PREFIJO_TARJETA.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function tarjetaDeCreacion(c: CreacionParaTarjeta, de: 'mia' | 'comunidad', formato?: string): PlantillaCrear {
  const estrellas = `★ ${numeroCorto(c.estrellas)}`;
  const insignia = de === 'mia'
    ? (c.estado === 'privada' ? '🔒 Sólo tu negocio' : `${estrellas} · Compartida`)
    : `${estrellas} · ${c.autor}`;
  return {
    id: `${PREFIJO_TARJETA}${c.id}`,
    nombre: c.titulo,
    grupo: de === 'mia' ? GRUPO_MIAS : GRUPO_COMUNIDAD,
    insignia,
    rotulo: insignia,
    ...(c.descripcion ? { ayuda: c.descripcion, extracto: `${c.titulo}\n${c.descripcion}` } : { extracto: c.titulo }),
    ...(formato ? { formato } : {}),
  };
}
