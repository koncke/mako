// =============================================================================
// Quién puede abrir AI Avatar — el admin de cualquier negocio, en los tres planes (y la plataforma)
// =============================================================================
// Nació el 17/10/2026 sólo para el super admin (la sesión de la agencia), hasta que Martín la validara. El 29/10/2026 la
// abrió a TODOS: «haz que AI-Avatar esté disponible para todos» (Esencial, Pro y Acelerador; ya no está en TABS_SOLO_PRO).
// La puerta es la de toda tab (sesión, capa, rol y onboarding: `requireRolWs`), como el Video Editor. La usan las pantallas y
// las server actions, para que el acceso se decida en un solo lugar.
//
// SÓLO MaKo Pro DESDE EL 14/11/2026 (Martín, sobre /planes: «el de 97 ya podés generar avatares de IA… el de 47 debería estar
// bien limitado y restrictivo»; el relevo que aprobó, docs/relevo/planes-que-incluye-cada-columna.md §4.3). El candado es el
// de siempre (`FUNCIONES_SOLO_PRO`, 'ai-avatar', lib/topes-plan.ts), NO una tab escondida: la tab se abre igual y adentro va
// el cartel, como la comunidad del Classroom (app/customer-success/comunidad/pantalla.tsx).
//
// DÓNDE SE FRENA: en CADA FUNCIÓN QUE GENERA, no en una puerta común ni en una pantalla (AGENTS.md, «Qué cierra un plan se
// lee en la PUERTA»). Son cuatro, y la cuarta se descubrió el 14/11 a la noche:
//   · `crearLookAction` (./actions.ts): la imagen del look en el Flow de la persona;
//   · `crearVideoAction` (./actions.ts): el plan y las tomas del video con su avatar;
//   · `crearAvatarAction` (app/video-editor/avatar/actions.ts): LA MISMA generación desde Biblioteca › «Avatar de IA» del
//     Video Editor, que está abierto en los dos planes. Sin esto, cerrar la tab no cerraba nada: se entraba por el editor;
//   · las pantallas, que NO son la defensa sino el cartel: /ai-avatar y /m/ai-avatar con `candadoDeAiAvatar` →
//     <CartelSoloPro />, y la pestaña del editor con `useSoloPro('ai-avatar')` + <CandadoSoloPro /> (el molde de
//     broll-view.tsx, PanelChat.tsx y clips-view.tsx).
// ⚠️ LO QUE LEE, PASA. El candado estuvo unas horas en la `puerta()` común de ./actions.ts y apagó una pantalla ajena: la
//    guía de video del editor (app/video-editor/guia/GuiaEnElChat.tsx) usa `inicioAvatarAction` para listar las FOTOS de la
//    persona, y a un Esencial le decía «No pude leer tus fotos» y le borraba la galería de su onboarding. El porqué y qué
//    action hace qué, en el comentario de `soloProParaGenerar` (./actions.ts).
// ⚠️ ANTE LA DUDA, PASA: `esEsencialDeLaSesion` (lib/plan-esencial.ts) devuelve false si no se pudo leer el plan. Y es sólo
//    para quien MaKo le COBRA el Esencial por la pasarela: el ws1, los acuerdos a mano y la plataforma no lo ven.
// ⚠️ CERRARLA EN ESENCIAL NO ES VENDERLA EN PRO: la tabla de /planes sigue sin prometerla hasta que ande de punta a punta
//    (`AI_AVATAR_SE_VENDE`, lib/planes-comparacion.ts). Son dos decisiones distintas.
// ⚠️ Generar pide cosas que son de la persona y no de su plan (la extensión de MaKo en Chrome, su cuenta de Google Flow, sus
//    créditos y una foto de su cara): la pantalla las lista paso a paso antes de «Generar» (lib/ai-avatar/requisitos.ts).

import 'server-only';
import { requireRolWs } from '@/lib/tab-access';
import { tabEnCapa } from '@/lib/capas';
import { esEsencialDeLaSesion } from '@/lib/plan-esencial';
import { textoSoloPro } from '@/lib/topes-plan';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';

/** ¿Quien mira puede usar AI Avatar? Para las actions (no redirige): el admin, con la tab en su capa. */
export async function veAiAvatar(): Promise<boolean> {
  if ((await getRolWsEfectivo()) !== 'admin') return false;
  return tabEnCapa('ai-avatar', await getCapaActual());
}

/** El guard de las pantallas: lo de toda tab (sesión, capa, rol y onboarding). */
export async function requireAiAvatar(): Promise<void> {
  await requireRolWs([], { nav: 'ai-avatar' });
}

/** El texto del candado si quien mira paga MaKo Esencial, o null (pasa). Lo dibuja `CartelSoloPro`; las actions lo devuelven. */
export async function candadoDeAiAvatar(): Promise<string | null> {
  return (await esEsencialDeLaSesion()) ? textoSoloPro('ai-avatar') : null;
}
