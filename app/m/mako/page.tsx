// =============================================================================
// /m/mako — el chat con MaKo en el teléfono
// =============================================================================
// El server abre lo que se ve primero —la lista de chats de ESTA persona y el último— para
// que la pantalla no arranque en blanco; todo lo demás (mandar, cambiar de chat, confirmar
// una propuesta) lo hace el cliente contra /api/m/mako y app/m/mako/acciones.ts.
//
// ⚠️ maxDuration 420: el techo de la PÁGINA gobierna sus server actions, y confirmar una
// acción de MaKo puede tardar (una acción lenta cortada a mitad deja la pendiente ya
// reclamada). El turno en sí corre en la ruta, que declara el suyo.
//
// Quién entra: la misma regla del Sidebar para la tab MaKo (navKey 'mako'); y adentro,
// `personaDelRequest` la vuelve a mirar (rol + capa) antes de leer nada.
//
// v2: es pantalla de TRABAJO dentro de More (cabecera.ts: «‹ More», «MaKo» en la barra, sin
// título grande y sin la barra de abajo). La página no pone título.
// =============================================================================

import { requireMovil } from '@/lib/movil-guard';
import { personaDelRequest, listarSesiones, abrirSesion } from '@/lib/mako-turno-app';
import { ErrorM } from '@/app/m/_ui';
import { ChatMako } from './ChatMako';
import './mako.css';

export const dynamic = 'force-dynamic';
// 420 y no 300 (tanda 7 del Web Generator, 15/10/2026; Martín: «Todas las funciones a la API de MaKo»): confirmar
// replicar_landing por chat corre hasta ~275 s (lib/editor-landing/replicar.ts: imágenes hasta los 265 s, más
// guardar el tema y crear) y antes y después van los pasos del modelo y el envío: 300 lo cortaba. Plan Pro con
// fluid compute: tope 800. tests/mako-doer-plazo.test.ts.
export const maxDuration = 420;

export default async function MakoMovilPage() {
  await requireMovil({ navKey: 'mako' });

  const persona = await personaDelRequest();
  if ('error' in persona) return <ErrorM frase={persona.error} />;

  try {
    const sesiones = await listarSesiones(persona);
    const ultima = sesiones[0] ?? null;
    const inicial = ultima ? await abrirSesion(persona, ultima.id) : null;
    return <ChatMako sesionesIniciales={sesiones} inicial={inicial} />;
  } catch (e) {
    console.error('[m/mako] abrir:', e instanceof Error ? e.message : e);
    return <ErrorM frase="No pude cargar el chat." />;
  }
}
