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
import { getWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { veOnboardingV2 } from '@/lib/onboarding-v2/revision';
import { rutaDelSecondBrainEnOpsCenter } from '@/lib/ops-center-ruta';
import { datosDelCentroSiOpera } from '@/app/admin/operaciones/datos';
import { PantallaSecondBrain, mapaDelSecondBrain, pideElMapa, quienOpera, type QuerySecondBrain } from './pagina';
import { hiloOnboardingGuardado, hiloParaQuienYaTermino } from '@/lib/onboarding-arranque-server';
import { RUTA_SEGUIR_EN_PC, seguirEnPcPendiente } from '@/lib/seguir-en-pc';
import { ATTR_BARRA_OCULTA } from '@/app/_ui/tutorial/barra-oculta';
import { esTelefono } from '@/lib/movil-guard';
import { rutaDelHilo } from '@/lib/onboarding-arranque';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SecondBrainPage({ searchParams }: { searchParams: Promise<QuerySecondBrain> }) {
  await requireRolWs(['closer', 'setter'], { nav: 'mako' });
  // ⚠️ A LA VEZ LO QUE NO DEPENDE DE OTRA COSA (23/10/2026, «Rendimiento y loaders»; Martín: «cuando entro a Second Brain
  // tarda muchísimo»). La guarda va primero y sola (redirige a quien no entra); el resto iba en serie: p50 2,1 s en producción.
  const [veMapa, q, opera] = await Promise.all([esAdminDeTab('second-brain'), searchParams, quienOpera()]);
  // ⚠️ PARA EL SUPER ADMIN EL SECOND BRAIN VIVE DENTRO DEL OPS CENTER (17/10/2026; Martín: «el second brain vive dentro de ops
  // center y es el grafo, no otro chat»): su entrada salió de la barra y un /second-brain guardado lleva a su grafo. Los demás
  // (el cliente, su equipo, y el super admin MIRANDO a un cliente: `quienOpera` pide su propio workspace) siguen con su chat.
  if (opera) redirect(await rutaConWs(rutaDelSecondBrainEnOpsCenter(q)));
  // El TELÉFONO con la «Versión completa» (20/11, la verificación de OA-10 y OD-12): mientras no vio el recorrido en la PC, el Ops
  // Center de escritorio tampoco; va a «Sigamos en tu computadora». En la computadora, `esTelefono` corta antes de leer nada.
  if ((await esTelefono().catch(() => false)) && (await seguirEnPcPendiente())) redirect(await rutaConWs(RUTA_SEGUIR_EN_PC));
  // El chat «Onboarding» de quien terminó antes de que existiera (20/10/2026, Florencia, ws21): en su primera visita se crea
  // y entra a él, con el tutorial. Una vez: después ya está anotado y esto no hace nada.
  // El grafo (la lectura más pesada: construirCerebro) sale A LA VEZ que esto, que ESCRIBE (crea el hilo) y por eso va
  // después de la redirección de arriba, como siempre. Si el hilo redirige, el grafo se descarta; si el grafo falla, falla
  // donde fallaba (al esperarlo, más abajo), no antes de la redirección.
  const pMapa: Promise<ReactNode> | null = veMapa && pideElMapa(q) ? mapaDelSecondBrain() : null;
  pMapa?.catch(() => {});
  const hiloNuevo = await hiloParaQuienYaTermino().catch(() => null);
  if (hiloNuevo) redirect(await rutaConWs(rutaDelHilo(hiloNuevo)));
  // Los chats de Claude Code (el Cerebro y cada jefe), sólo para quien `puedeOperar`: la guarda va ADENTRO, antes de
  // leer la cola (app/admin/operaciones/datos.ts). Tanda 5: «quiero mandar prompts por MaKo en el Second Brain».
  // Mirando a un cliente, sin el Centro (`quienOpera`): nunca los chats del super admin en la cuenta de un cliente.
  const centro = opera ? await datosDelCentroSiOpera().catch(() => null) : null;

  const mapa: ReactNode = pMapa ? await pMapa : null;

  // El chat «Reto de 7 días» (18/11/2026): sólo la revisión de Martín (sus cuentas y el Cliente de Prueba) hasta que lo apruebe.
  // Y los DOS coaches (Offer Coach y Funnel Coach, Martín 15/11), con el mismo interruptor: `dosCoaches` (ChatSecondBrain.tsx).
  const sesion = await getUsuarioActual().catch(() => null);
  const retoV2 = !!sesion && veOnboardingV2({ email: sesion.email, ws: await getWorkspaceActual().catch(() => null) });
  const nombrePersona = (sesion?.nombre ?? '').trim().split(/\s+/)[0] ?? '';
  // El chat «Onboarding» (sólo con el V2), para ponerlo enseguida del Ops Center en la lista (20/11, OD-08).
  const hiloOnboarding = retoV2 ? await hiloOnboardingGuardado() : null;
  // LA BARRA OCULTA AL RECARGAR (20/11, la verificación de OD-03: «oculta en el Ops Center mientras el recorrido no se vio»). El
  // atributo que pone «Entrar a MaKo» vive sólo en la página; al recargar, la barra volvía. Con el V2 y sin el recorrido visto (la
  // misma lectura que la del teléfono), el HTML la esconde antes de pintar. La vuelve a mostrar el recorrido en «Tu panel».
  const barraOculta = retoV2 && (await seguirEnPcPendiente());
  return <>{barraOculta && <script dangerouslySetInnerHTML={{ __html: `document.documentElement.setAttribute('${ATTR_BARRA_OCULTA}','')` }} />}<PantallaSecondBrain veMapa={veMapa} mapa={mapa} centro={centro} q={q} inicio="second-brain" retoV2={retoV2} dosCoaches={retoV2} nombrePersona={nombrePersona} hiloOnboarding={hiloOnboarding} /></>;
}
