// /tickets/decisiones/lista — la puerta vieja de la lista de la Ticketera: lleva a la lista adentro del Centro
// (16/10/2026, ver app/tickets/decisiones/page.tsx).

import { redirect } from 'next/navigation';
import { aLaTicketera } from '../reglas';

export const dynamic = 'force-dynamic';

export default async function TicketeraLista({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(aLaTicketera('lista', await searchParams));
}
