// =============================================================================
// /second-brain — el chat con MaKo, y el Mapa del negocio (Analyze)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md (16/10/2026; Martín, por el coordinador: «Termina con todo, faltan mis
// pedidos del Second Brain»): el Second Brain es la casa de todo, y su puerta es un CHAT. A la izquierda la barra de
// chats (el jefe «Second Brain» y sus sub-chats), en el centro la conversación con MaKo, con la cara del Centro de
// Operaciones (ChatSecondBrain.tsx). El grafo de antes es «Mapa»: un acceso arriba de la lista que lo abre en el
// panel, como la Ticketera en el Centro (copiado del botón del grafo de Obsidian).
//
// ⚠️ DOS PUERTAS, Y LAS DOS EN EL SERVIDOR:
//   · el CHAT es de todos los que tienen MaKo (closer y setter incluidos): la clave `mako` de la barra, la misma del
//     chat del teléfono (lib/mako-turno-app.ts → personaDelRequest);
//   · el MAPA (el grafo, las áreas, la skill de Claude con su token) es del admin con la tab en su capa: el mismo corte
//     que las rutas de app/api/second-brain (`soloAdminDeTab`). A quien no le toca, no se le CALCULA: lo que no se
//     ve no viaja (tests/second-brain-chat.test.ts).
//   · y una TERCERA, desde el 17/10 (tanda 5): los chats de Claude Code de Martín —el Cerebro y cada jefe— son del
//     Centro de Operaciones y se leen sólo para quien `puedeOperar` (app/admin/operaciones/datos.ts). A los demás no
//     se les lee la cola.
// ⚠️ EL MAPA SE CALCULA SÓLO CUANDO SE PIDE (`?panel=mapa`, o un `?area=` de los links de siempre): construir el
//    cerebro son 21 lecturas, y el chat no lo necesita para el primer dibujo.
//
// Lo que se decía acá del grafo, del editor del funnel y de la skill sigue valiendo y vive en VistaCerebro.tsx.
// ⚠️ DESDE EL 17/10 ESTA PÁGINA ES UNA PUERTA: el armado (el Mapa y la pantalla) vive en pagina.tsx, porque
//    /admin/operaciones dibuja la MISMA pantalla para el super admin («Ops Center»).

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { esAdminDeTab } from '@/lib/puerta-admin-tab';
import { rutaConWs } from '@/lib/workspace';
import { rutaDelSecondBrainEnOpsCenter } from '@/lib/ops-center-ruta';
import { datosDelCentroSiOpera } from '@/app/admin/operaciones/datos';
import { PantallaSecondBrain, mapaDelSecondBrain, pideElMapa, quienOpera, type QuerySecondBrain } from './pagina';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SecondBrainPage({ searchParams }: { searchParams: Promise<QuerySecondBrain> }) {
  await requireRolWs(['closer', 'setter'], { nav: 'mako' });
  const veMapa = await esAdminDeTab('second-brain');
  const q = await searchParams;
  // ⚠️ PARA EL SUPER ADMIN EL SECOND BRAIN VIVE DENTRO DEL OPS CENTER (17/10/2026; Martín: «el second brain vive dentro de ops
  // center y es el grafo, no otro chat»): su entrada salió de la barra y un /second-brain guardado lleva a su grafo. Los demás
  // (el cliente, su equipo, y el super admin MIRANDO a un cliente: `quienOpera` pide su propio workspace) siguen con su chat.
  if (await quienOpera()) redirect(await rutaConWs(rutaDelSecondBrainEnOpsCenter(q)));
  // Los chats de Claude Code (el Cerebro y cada jefe), sólo para quien `puedeOperar`: la guarda va ADENTRO, antes de
  // leer la cola (app/admin/operaciones/datos.ts). Tanda 5: «quiero mandar prompts por MaKo en el Second Brain».
  // Mirando a un cliente, sin el Centro (`quienOpera`): nunca los chats del super admin en la cuenta de un cliente.
  const centro = (await quienOpera()) ? await datosDelCentroSiOpera().catch(() => null) : null;

  let mapa: ReactNode = null;
  if (veMapa && pideElMapa(q)) {
    mapa = await mapaDelSecondBrain();
  }

  return <PantallaSecondBrain veMapa={veMapa} mapa={mapa} centro={centro} q={q} inicio="second-brain" />;
}
