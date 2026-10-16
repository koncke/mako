// =============================================================================
// /tickets/decisiones — la puerta vieja de la Ticketera: lleva al Centro de Operaciones (16/10/2026)
// =============================================================================
// Martín (16/10/2026): «elimines la ruta de la ticketera y lo pongas dentro del centro de operaciones». La Ticketera
// (el mazo y la lista, los mismos de siempre) vive en /admin/operaciones?ticketera=…; esta URL la tienen avisos, links
// y favoritos viejos, así que trae hasta ahí con la vista que era y sin perder la query (app/tickets/decisiones/reglas.ts
// → aLaTicketera). En el teléfono el proxy la lleva directo a /m/operaciones (lib/movil-rutas.ts). El Centro hace su
// propia guarda (`puedeOperar`).

import { redirect } from 'next/navigation';
import { aLaTicketera } from './reglas';

export const dynamic = 'force-dynamic';

export default async function Ticketera({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(aLaTicketera('tarjetas', await searchParams));
}
