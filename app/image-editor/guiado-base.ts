// =============================================================================
// Lo que el guiado de «Editar» sabe del negocio antes de preguntar (9/11/2026; compartido con el teléfono el 10/11/2026)
// =============================================================================
// Sus ofertas ACTIVAS, si tiene una foto (la cara de marca o un look del AI Avatar) y si su kit tiene colores
// (lib/carruseles/guiado.ts). Cada lectura que falla es «no sé», nunca «no tiene»: las ofertas en `null` (MaKo pide escribirla),
// las fotos y el kit en `false` (MaKo ofrece subir la foto). El server lo vuelve a leer al generar
// (lib/carruseles/replica-servidor.ts): esto sólo arma las preguntas.
//
// Vive acá y no en ./page.tsx porque lo leen DOS pantallas: la de la computadora y la del teléfono (app/m/image-editor). El
// 10/11 el teléfono no lo leía y su «Editar» armaba sin preguntar nada (docs/hallazgos-carruseles.md).
// =============================================================================

import 'server-only';
import { listarOfertas } from '@/lib/ofertas';
import { getPersona } from '@/lib/persona';
import { leerLooks } from '@/app/ai-avatar/looks';
import type { KitMarca } from '@/lib/marca/kits';
import type { BaseGuiado } from './carruseles/ReplicarGuiado';

export async function baseDelGuiado(kit: KitMarca | null): Promise<BaseGuiado> {
  const [ofertas, persona, looks] = await Promise.all([
    listarOfertas(true).then((xs) => xs.map((o) => ({ id: o.id, nombre: o.nombre, principal: o.es_principal }))).catch(() => null),
    getPersona().catch(() => null),
    leerLooks().catch(() => []),
  ]);
  return {
    ofertas,
    fotos: { cara: (persona?.fotos.length ?? 0) > 0, look: looks.some((l) => /^https:\/\//.test(l.url) && !l.error) },
    kit: (kit?.colores.length ?? 0) > 0,
  };
}
