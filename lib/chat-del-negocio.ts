import 'server-only';
// =============================================================================
// Los chats del negocio, mirando como administrador: la lista y la lectura del DUEÑO; escribir, sólo en los de prueba (20/11/2026)
// =============================================================================
// La regla es lib/chat-del-negocio-reglas.ts. Aquí, del pedido: ¿mira el ADMINISTRADOR de MaKo (no una agencia: ésa sigue como estaba)
// un negocio que no es el suyo?, ¿quién es el dueño (su fila de `usuarios`, y su `chart_key`)?, ¿se puede escribir?
// Liviano a propósito (sin lib/mako-turno-app.ts): lo usan la persona del chat (`personaDelChatDelNegocio`), la fila «Onboarding»
// (lib/onboarding-arranque-server.ts) y la página del Ops Center.
// =============================================================================

import { cache } from 'react';
import { getSesionAdmin } from './auth';
import { estaImpersonando, getWorkspaceActual } from './workspace';
import { emailDelDuenoDelWs } from './dueno-del-ws';
import { getSupabaseServer } from './supabase';
import { escribeComoElCliente } from './onboarding-v2/revision';
import { chartKeyDePersona } from './mako-turno-app-reglas';
import { chatDelNegocio } from './chat-del-negocio-reglas';

export type DuenoDelChat = { chartKey: string; quien: { sub: string; email: string; nombre: string } };

/** El dueño del negocio como persona del chat (su fila en ESE negocio), o null si no tiene o no se pudo leer. */
const duenoDelNegocio = cache(async (ws: number): Promise<DuenoDelChat | null> => {
  const email = await emailDelDuenoDelWs(ws).catch(() => '');
  if (!email) return null;
  const { data, error } = await getSupabaseServer().from('usuarios').select('id, email, nombre').eq('email', email).eq('workspace_id', ws).maybeSingle();
  if (error || !data) return null;
  const d = data as { id: number; email: string; nombre: string | null };
  const chartKey = chartKeyDePersona({ sub: String(d.id), email: d.email });
  return chartKey ? { chartKey, quien: { sub: String(d.id), email: d.email, nombre: d.nombre ?? '' } } : null;
});

/**
 * Lo que decide el pedido: si mira el administrador de MaKo, el dueño (si lo hay) y si la caja queda en lectura. Si algo no se pudo
 * leer, como estaba (no mirando): nunca se le traba la caja a un cliente por un error.
 */
export const elChatDelNegocio = cache(async (): Promise<{ mirando: boolean; dueno: DuenoDelChat | null; soloLectura: boolean }> => {
  const admin = await getSesionAdmin().catch(() => null);
  const mirando = !!admin && (await estaImpersonando().catch(() => false));
  if (!mirando) return { mirando: false, dueno: null, soloLectura: false };
  const ws = await getWorkspaceActual().catch(() => null);
  if (ws == null) return { mirando: false, dueno: null, soloLectura: false };
  const dueno = await duenoDelNegocio(ws).catch(() => null);
  const d = chatDelNegocio({ mirando, hayDueno: !!dueno, escribeComoElCliente: escribeComoElCliente(ws) });
  return { mirando, dueno: d.de === 'dueno' ? dueno : null, soloLectura: d.soloLectura };
});
