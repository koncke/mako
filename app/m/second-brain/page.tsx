// =============================================================================
// /m/second-brain — «Second Brain» en el teléfono: el chat con MaKo
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md, tanda 3 (16/10/2026): como en escritorio, el Second Brain es el CHAT con
// MaKo (desde el 22/10/2026, el Ops Center del cliente: ChatClienteM.tsx, la lista y cada chat en su hoja), y lo que era esta
// pantalla —el buscador, el mapa en chico, las carpetas y el Archivero— es el «Mapa» (/m/second-brain/mapa), que el
// admin abre desde la hoja «Tus chats». Una sola entrada «Second Brain» por persona, como la barra de escritorio.
//
// ⚠️ DOS PUERTAS, LAS DOS EN EL SERVIDOR (las mismas de escritorio, app/second-brain/page.tsx):
//   · el CHAT, con la clave `mako` (closer y setter incluidos), la misma de /api/m/mako;
//   · el MAPA, con `esAdminDeTab('second-brain')`: a quien no le toca no se le ofrece ni se le manda.
// ⚠️ Un link de otra pantalla con `?area=` (las claves de escritorio: QUERY_DE_SECCION, `rutaSeccion`) o el
//    `?panel=mapa` de escritorio llevan al Mapa, si es del admin.
// ⚠️ Y una TERCERA desde el 17/10 (tanda 5): los chats de Claude Code de Martín (el Cerebro y cada jefe del Centro) van
//    en la hoja «Tus chats» sólo para quien `puedeOperar`; la guarda va adentro de `datosDelCentroSiOpera`, antes de
//    leer la cola (SecondBrainCentroM.tsx).

import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { esAdminDeTab } from '@/lib/puerta-admin-tab';
import { rutaConWs } from '@/lib/workspace';
import { RUTA_CENTRO_M } from '@/lib/movil-rutas';
import { personaDelRequest, listarSesiones } from '@/lib/mako-turno-app';
import { CabeceraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { ChatClienteM } from './ChatClienteM';
import { SecondBrainCentroM } from './SecondBrainCentroM';
import { OPCION_ARMAR } from '@/lib/offer-reglas';
import { datosDelCentroSiOpera } from '@/app/admin/operaciones/datos';
import { hiloParaQuienYaTermino } from '@/lib/onboarding-arranque-server';
import '../mako/mako.css';

export const dynamic = 'force-dynamic';
// El chat corre acá sus server actions (confirmar una tarjeta: app/m/mako/acciones.ts), y confirmar replicar_landing
// corre ~275 s: el mismo techo que tenía /m/mako (tests/mako-doer-plazo.test.ts).
export const maxDuration = 420;

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SecondBrainPagina({ searchParams }: {
  searchParams: Promise<{ area?: string | string[]; vista?: string | string[]; panel?: string | string[]; chat?: string | string[]; offer?: string | string[]; grupo?: string | string[] }>;
}) {
  const ctx = await requireMovil({ navKey: 'mako' });
  const veMapa = await esAdminDeTab('second-brain');
  const sp = await searchParams;

  // ⚠️ Y para el super admin el Second Brain vive dentro del Ops Center (17/10/2026): su entrada salió de More y un
  // /m/second-brain guardado lo lleva al grafo, como en la computadora (lib/ops-center-ruta.ts). La fila «Second Brain» del Ops
  // Center del teléfono ya apunta acá con `?panel=mapa`.
  if (veMapa && (uno(sp.panel) === 'mapa' || uno(sp.area))) {
    const q = new URLSearchParams();
    for (const k of ['area', 'vista'] as const) { const v = uno(sp[k]); if (v) q.set(k, v); }
    redirect(await rutaConWs(`/m/second-brain/mapa${q.size ? `?${q}` : ''}`));
  }
  // ⚠️ Desde el 20/10/2026 el Ops Center es la TAB PRINCIPAL del teléfono (pedido bb885d5f) y la app entra por acá
  // (`ENTRADA_MOVIL`): sin pedir el grafo, quien opera va al Centro, que es SU Ops Center (el grafo está adentro, en la
  // fila «Second Brain»). Hasta ese día iba directo al grafo. La pregunta es la de la fila del Centro en /m/mas y la de la
  // barra (app/m/layout.tsx), NO `quienOpera`: en el teléfono el super admin siempre lleva el `?ws=` de su negocio, y para
  // `quienOpera` eso ya es «mirando un cliente» (contextoMovil sí distingue su negocio propio). Mirando uno: su chat.
  // ⚠️ `?grupo=` viaja: es el push de un aviso, y sin él caería en la lista.
  const grupoPedido = uno(sp.grupo);
  if (ctx.sesion.rol === 'admin' && !ctx.impersonando && grupoPedido && /^\d{1,15}$/.test(grupoPedido)) redirect(await rutaConWs(`${RUTA_CENTRO_M}?grupo=${grupoPedido}`));
  if (ctx.sesion.rol === 'admin' && !ctx.impersonando) redirect(await rutaConWs(RUTA_CENTRO_M));

  // El chat «Onboarding» de quien terminó antes de que existiera, también desde el teléfono (20/10/2026, revisión del
  // Cerebro): se crea una vez, con las mismas reglas que en la computadora, y como es el más reciente es el que se abre.
  await hiloParaQuienYaTermino().catch(() => null);

  const persona = await personaDelRequest();
  if ('error' in persona) return <PantallaM><ErrorM frase={persona.error} /></PantallaM>;
  // El Ops Center del cliente es el del super admin (22/10/2026, ChatClienteM.tsx): la pantalla es la LISTA (el Cerebro y todos
  // sus chats) y cada conversación se abre en su hoja. `?chat=` y `?offer=` la abren al entrar.
  const entero = (v: string | string[] | undefined) => { const n = Number(uno(v)); return Number.isInteger(n) && n > 0 ? n : null; };
  try {
    const [sesiones, centro] = await Promise.all([listarSesiones(persona), datosDelCentroSiOpera().catch(() => null)]);
    const chat = {
      sesionesIniciales: sesiones, hrefMapa: veMapa ? '/m/second-brain/mapa' : null, opcionArmar: OPCION_ARMAR,
      chatInicial: entero(sp.chat), offerInicial: entero(sp.offer), grupoInicial: entero(sp.grupo),
    };
    return (
      <PantallaM>
        <CabeceraM titulo="Ops Center" padre={null} />
        {centro ? <SecondBrainCentroM centro={centro} chat={chat} /> : <ChatClienteM {...chat} />}
      </PantallaM>
    );
  } catch (e) {
    console.error('[m/second-brain] abrir:', e instanceof Error ? e.message : e);
    return <PantallaM><ErrorM frase="No pude cargar el chat." /></PantallaM>;
  }
}
