// =============================================================================
// /whatsapp — ya no es una pantalla: lleva a Chats (24/10/2026)
// =============================================================================
// Martín (por el Cerebro, 24/10): «Cuando quiero conectar un WhatsApp, mira que salta el diseño de la tab vieja de WhatsApp,
// eso está muy mal, solo debería saltar el QR» y «Mira como se ve toda la tab vieja de WhatsApp por detrás eso está muy mal».
// Las conversaciones están en Chats desde el 17/10 (docs/diseno-sidebar.md §5), y lo que esta tab tenía y Chats no (conectar
// un número, administrarlo, el «Chatbot: ON/OFF», los ocultos, borrar un chat, la alarma del número caído) vive en Chats
// desde el 24/10 (docs/diseno-chats.md §8.4). Los links a /whatsapp siguen llegando (avisos, mails, la API de MaKo, botones
// de otras tabs), así que la ruta queda y los traduce:
//   · `?stab=plantillas` → /automations, como antes (las plantillas se mudaron el 05/10);
//   · `?linea=&chat=`, `?lead=`, `?c=` → los mismos en /chats (lib/chats-links.ts los resuelve);
//   · sin número conectado, a un admin → `/chats?conectar=whatsapp`: el QR, en un modal sobre Chats;
//   · con el onboarding de WhatsApp pendiente y sin número, el wizard (que al terminar va a Chats).
//
// ⚠️ EL `?ws=` VA EN CADA REDIRECCIÓN (`rutaConWs`): el super admin mira clientes por pestaña, y perderlo es terminar en el
//    Chats de otra cuenta.

import { redirect } from 'next/navigation';
import { guardOnboarding, requireCapa } from '@/lib/tab-access';
import { getRolWsEfectivo, rutaConWs } from '@/lib/workspace';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import { listarLineas } from '@/lib/evolution';
import { OnboardingCanalWhatsApp } from './OnboardingCanalWhatsApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Lo que /chats entiende de un link (lib/chats-links.ts `PARAM_CHATS`, más la `n` de un aviso repetido). */
const PASAN = ['c', 'lead', 'linea', 'chat', 'n'] as const;

type Busqueda = Promise<Record<string, string | string[] | undefined>>;

export default async function WhatsAppPage({ searchParams }: { searchParams: Busqueda }) {
  await requireCapa('whatsapp');
  const sp = await searchParams;
  const uno = (k: string): string | null => { const v = sp[k]; return typeof v === 'string' && v ? v : null; };

  const tpl = uno('tpl');
  if (uno('stab') === 'plantillas') redirect(await rutaConWs(`/automations?stab=plantillas${tpl ? `&tpl=${encodeURIComponent(tpl)}` : ''}`));

  // ¿Hay un número vivo? «No pude leer» cuenta como «no»: sólo decide si se abre el QR, y con el QR abierto se ve el estado real.
  const conNumero = await listarLineas().then((ls) => ls.some((l) => l.estado === 'conectado')).catch(() => false);
  await guardOnboarding();
  // El onboarding de WhatsApp (conectar y probar el número) es el wizard compartido con el Chatbot: si falta y no hay número,
  // gana él, como antes. Con el número vivo se va a Chats aunque el onboarding se haya reabierto.
  if (!conNumero && await onboardingTabPendiente('whatsapp')) return <OnboardingCanalWhatsApp />;

  const q = new URLSearchParams();
  for (const k of PASAN) { const v = uno(k); if (v) q.set(k, v); }
  // Sin número y sin un chat que abrir, lo que se venía a hacer acá era conectarlo. Vincular un número es del admin (lo
  // mismo que exige /api/whatsapp/evolution): al resto se le abre Chats y nada más.
  const rolWs = await getRolWsEfectivo();
  if (!q.toString() && !conNumero && (rolWs == null || rolWs === 'admin')) q.set('conectar', 'whatsapp');
  const query = q.toString();
  redirect(await rutaConWs(query ? `/chats?${query}` : '/chats'));
}
