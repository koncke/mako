// =============================================================================
// /admin/dev — lleva a la CONSTRUCCIÓN DE MAKO en el Second Brain (17/10/2026)
// =============================================================================
// Hasta el 17/10 esto era «Áreas del producto»: la barra de Dev con las 122 áreas y sus trampas (MapaAreas.tsx, sobre
// BarraPreview), sin un solo vínculo entre ellas. Martín pidió deprecarla al 100% («había otro grafo de eso que hay que
// DEPRECAR»): la construcción de MaKo ahora es la segunda capa del grafo del Second Brain (lib/cerebro-construccion.ts),
// con las áreas, sus bitácoras, los hitos y los chats jefe, y sus vínculos (qué chat trabaja dónde, qué áreas comparten
// código). Las páginas de cada área (/admin/dev/<área>, con su bitácora) se quedan: son a donde lleva cada nodo.
//
// Solo super-admin: el mismo guard de siempre, antes de redirigir.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DevPage() {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  redirect('/admin/operaciones?panel=mapa&capa=construccion');
}
