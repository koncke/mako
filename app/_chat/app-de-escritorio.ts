// =============================================================================
// ¿Esta persona tiene la app de escritorio? La pregunta compartida de los chats con MaKo (25/10/2026)
// =============================================================================
// La mitad sin dibujo de app/_chat/useAppDeEscritorio.tsx: sin CSS ni componentes, para que la puedan importar los MOTORES de los
// chats que los tests cargan en node (Automations, ChatMako.tsx) y cortar el envío también por fuera de la caja (un pedido que
// llega de otra pantalla, una sugerencia). Lo decide el servidor (app/api/mako/chat/route.ts → laApp, `?app=1`); se pregunta UNA
// vez por página, y mientras bloquea, se relee cada 8 s con la pestaña a la vista y se destraba sola.

import { useSyncExternalStore } from 'react';
import type { AppDeEscritorio } from '@/lib/chat-mako-reglas';

/** Lo que falta, en el campo apagado de la caja. */
export const FRASE_APP = 'Instala MaKo para escribir';
/** El paso siguiente, ya descargado (con lo que dice el sistema al abrirlo, en el `title` del botón). */
/** Tocado «Instalar MaKo» (27/10/2026): que se está bajando, y abrirlo al terminar. Lo que frena Chrome va en el aviso del botón. */
export const FRASE_INSTALAR = 'Se está descargando: ábrelo al terminar';
/** Una respuesta rápida del hilo sin la app (29/10/2026): tocarla no mandaba nada y no lo decía. El botón está en la caja. */
export const FRASE_RESPONDER = 'Para contestar, instala MaKo: el botón está abajo, en la caja.';

/** Lo que dijo el servidor. null = todavía no se sabe (no bloquea: decide el servidor, no la espera). */
let estado: AppDeEscritorio | null = null;
let pidiendo = false;
let reloj: ReturnType<typeof setInterval> | null = null;
const oyentes = new Set<() => void>();

/** Lo que el servidor contesta, a lo que entiende la caja: sin saberlo, `tiene` (un bache no le tapa el chat a nadie). */
export function leerRespuestaApp(ok: boolean, datos: unknown): AppDeEscritorio {
  const app = ok && datos && typeof datos === 'object' ? (datos as { app?: unknown }).app : null;
  return app === 'bloquea' || app === 'en-la-computadora' ? app : 'tiene';
}

function programar() {
  if (reloj != null) { clearInterval(reloj); reloj = null; }
  if (estado !== 'bloquea' || !oyentes.size) return;
  reloj = setInterval(() => { if (document.visibilityState === 'visible') void mirarApp(); }, 8_000);
}

/** Vuelve a preguntar (al cerrar «Tus cuentas de IA», o cada 8 s mientras bloquea). */
export async function mirarApp(): Promise<void> {
  if (pidiendo) return;
  pidiendo = true;
  let nuevo: AppDeEscritorio;
  try {
    const r = await fetch('/api/mako/chat?app=1', { cache: 'no-store' });
    nuevo = leerRespuestaApp(r.ok, await r.json().catch(() => null));
  } catch {
    nuevo = 'tiene';
  } finally {
    pidiendo = false;
  }
  if (nuevo !== estado) { estado = nuevo; for (const avisar of oyentes) avisar(); }
  programar();
}

function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar);
  // El primer chat de la página pregunta (también al volver a una tab: entre tanto pudo conectar la computadora).
  if (oyentes.size === 1) void mirarApp(); else programar();
  return () => {
    oyentes.delete(avisar);
    if (!oyentes.size && reloj != null) { clearInterval(reloj); reloj = null; }
  };
}

// ¿Ya tocó «Instalar MaKo» en esta página? Compartido: todas las cajas pasan juntas a «Ya lo instalé: conectar».
let descargado = false;
const oyentesDescarga = new Set<() => void>();
export function marcarDescargado(): void {
  if (descargado) return;
  descargado = true;
  for (const avisar of oyentesDescarga) avisar();
}
export function useDescargado(): boolean {
  return useSyncExternalStore((avisar) => { oyentesDescarga.add(avisar); return () => { oyentesDescarga.delete(avisar); }; }, () => descargado, () => false);
}

/** Lo que dijo el servidor para esta persona en este dispositivo (null mientras no se sabe; en el server, null). */
export function useApp(): AppDeEscritorio | null {
  return useSyncExternalStore(suscribir, () => estado, () => null);
}

/** ¿Este chat no puede mandar nada? Para el motor: la caja ya lo sabe por `bloqueo`, pero un pedido de afuera no pasa por ella. */
export function useAppBloqueada(): boolean {
  return useApp() === 'bloquea';
}
