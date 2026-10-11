// =============================================================================
// /m/mako — el chat con MaKo en el teléfono
// =============================================================================
// El server abre lo que se ve primero —la lista de chats de ESTA persona y el último— para
// que la pantalla no arranque en blanco; todo lo demás (mandar, cambiar de chat, confirmar
// una propuesta) lo hace el cliente contra /api/m/mako y app/m/mako/acciones.ts.
//
// ⚠️ maxDuration 300: el techo de la PÁGINA gobierna sus server actions, y confirmar una
// acción de MaKo puede tardar (una acción lenta cortada a mitad deja la pendiente ya
// reclamada). El turno en sí corre en la ruta, que declara el suyo.
//
// Quién entra: la misma regla del Sidebar para la tab MaKo (navKey 'mako'); y adentro,
// `personaDelRequest` la vuelve a mirar (rol + capa) antes de leer nada.
// =============================================================================

import { requireMovil } from '@/lib/movil-guard';
import { personaDelRequest, listarSesiones, abrirSesion } from '@/lib/mako-turno-app';
import { ErrorM } from '@/app/m/_ui';
import { ChatMako } from './ChatMako';
import './mako.css';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
    return <ErrorM frase="No pude cargar el chat. Vuelve a intentarlo en un momento." />;
  }
}
