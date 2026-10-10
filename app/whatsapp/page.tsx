// =============================================================================
// /whatsapp — server wrapper: guard de onboarding + monta el inbox (client)
// =============================================================================
// El inbox completo vive en WhatsAppApp.tsx ('use client'). Este wrapper solo
// aplica el gate server-side del onboarding bloqueante (guardOnboarding), igual
// que el patrón de /email (EmailApp).
//
// ⛔ Hasta el 09/10/2026 la tab tenía dos canales: el OFICIAL (Chatwoot, con su formulario
// de credenciales como PanelActivacion) y el número de empresa (Evolution, por QR). Chatwoot
// se borró (decisión de Martín: «que no exista más»), así que queda uno solo y no pide
// ninguna credencial: el número se engancha escaneando un QR desde esta misma tab.

import { guardOnboarding, requireCapa } from '@/lib/tab-access';
import { getRolWsEfectivo } from '@/lib/workspace';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import { OnboardingCanalWhatsApp } from './OnboardingCanalWhatsApp';
import { listarLineas } from '@/lib/evolution';
import { leerFunnels } from '@/lib/funnels';
import { productosParaAlta } from '@/lib/lead-funnel-reglas';
import { WhatsAppApp } from './WhatsAppApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WhatsAppPage() {
  await requireCapa('whatsapp');

  // Y los PRODUCTOS del «+ Agregar al CRM» (pedido de Leila, 08/10/2026: todo nacía en el
  // principal y lo movía a mano). Van en el mismo `Promise.all` para no sumar un viaje en
  // serie, y con `leerFunnels`: `null` = no se pudieron leer, que la bandeja NO confunde con
  // «hay uno» (ahí el botón queda de un clic y decide el server).
  const [noOficial, funnels] = await Promise.all([
    listarLineas().then((ls) => ls.some((l) => l.estado === 'conectado')).catch(() => false),
    leerFunnels(),
  ]);
  const productos = productosParaAlta(funnels);
  await guardOnboarding();

  // WhatsApp tiene onboarding PROPIO (conectar y probar el número), y se renderiza acá
  // mismo: los pasos se comparten con el Chatbot, así que lo que se haga acá no se vuelve
  // a pedir allá.
  const faltaOnboarding = await onboardingTabPendiente('whatsapp');

  // Sin el número vivo y con el onboarding pendiente, gana el onboarding: es donde vive el
  // QR para vincular. Con el número vivo, la tab se sirve igual aunque el onboarding se haya
  // reabierto: reemplazarla entera dejaría al cliente sin su bandeja.
  if (faltaOnboarding && !noOficial) return <OnboardingCanalWhatsApp productos={productos} />;
  // ¿Este usuario puede ABRIR /automations? Ahí viven las secuencias, y /automations es setter+admin
  // (app/automations/page.tsx). Un closer entra a /whatsapp pero rebota de /automations a /crm:
  // ofrecerle un link allá sería un botón que lo expulsa de la pantalla donde estaba, con el
  // chat abierto perdido.
  const rolWs = await getRolWsEfectivo();
  const puedeChatbot = rolWs == null || rolWs === 'admin' || rolWs === 'setter';
  // Vincular un número es config sensible: lo mismo que pide /api/whatsapp/evolution.
  const puedeAgregarLinea = rolWs == null || rolWs === 'admin';
  return <WhatsAppApp puedeChatbot={puedeChatbot} puedeAgregarLinea={puedeAgregarLinea} productos={productos} />;
}
