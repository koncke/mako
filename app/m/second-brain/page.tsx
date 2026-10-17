// =============================================================================
// /m/second-brain — «Second Brain» en el teléfono: el chat con MaKo
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md, tanda 3 (16/10/2026): como en escritorio, el Second Brain es el CHAT con
// MaKo (el de siempre del teléfono, app/m/mako/ChatMako.tsx, con su micrófono y sus adjuntos), y lo que era esta
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
import { personaDelRequest, listarSesiones, abrirSesion } from '@/lib/mako-turno-app';
import { ErrorM } from '@/app/m/_ui';
import { ChatMako } from '../mako/ChatMako';
import { SecondBrainCentroM } from './SecondBrainCentroM';
import { datosDelCentroSiOpera } from '@/app/admin/operaciones/datos';
import '../mako/mako.css';

export const dynamic = 'force-dynamic';
// El chat corre acá sus server actions (confirmar una tarjeta: app/m/mako/acciones.ts), y confirmar replicar_landing
// corre ~275 s: el mismo techo que tenía /m/mako (tests/mako-doer-plazo.test.ts).
export const maxDuration = 420;

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SecondBrainPagina({ searchParams }: {
  searchParams: Promise<{ area?: string | string[]; vista?: string | string[]; panel?: string | string[] }>;
}) {
  await requireMovil({ navKey: 'mako' });
  const veMapa = await esAdminDeTab('second-brain');
  const sp = await searchParams;

  if (veMapa && (uno(sp.panel) === 'mapa' || uno(sp.area))) {
    const q = new URLSearchParams();
    for (const k of ['area', 'vista'] as const) { const v = uno(sp[k]); if (v) q.set(k, v); }
    redirect(await rutaConWs(`/m/second-brain/mapa${q.size ? `?${q}` : ''}`));
  }

  const persona = await personaDelRequest();
  if ('error' in persona) return <ErrorM frase={persona.error} />;
  try {
    const sesiones = await listarSesiones(persona);
    const ultima = sesiones[0] ?? null;
    const [inicial, centro] = await Promise.all([ultima ? abrirSesion(persona, ultima.id) : null, datosDelCentroSiOpera().catch(() => null)]);
    const chat = { sesionesIniciales: sesiones, inicial, hrefMapa: veMapa ? '/m/second-brain/mapa' : null };
    return centro ? <SecondBrainCentroM centro={centro} chat={chat} /> : <ChatMako {...chat} />;
  } catch (e) {
    console.error('[m/second-brain] abrir:', e instanceof Error ? e.message : e);
    return <ErrorM frase="No pude cargar el chat." />;
  }
}
