// =============================================================================
// /whatsapp — server wrapper: guard de onboarding + monta el inbox (client)
// =============================================================================
// El inbox completo vive en WhatsAppApp.tsx ('use client'). Este wrapper solo
// aplica el gate server-side del onboarding bloqueante (guardOnboarding), igual
// que el patrón de /email (EmailApp).

import { redirect } from 'next/navigation';
import { guardOnboarding, requireCapa } from '@/lib/tab-access';
import { getRolWsEfectivo } from '@/lib/workspace';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import { OnboardingCanalWhatsApp } from './OnboardingCanalWhatsApp';
import { integracionConectada } from '@/lib/credenciales';
import { CHATWOOT_APAGADO } from '@/lib/chatwoot';
import { listarLineas } from '@/lib/evolution';
import { leerFunnels } from '@/lib/funnels';
import { productosParaAlta } from '@/lib/lead-funnel-reglas';
import { WhatsAppApp } from './WhatsAppApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WhatsAppPage() {
  await requireCapa('whatsapp');

  // El gate mira los DOS canales, no solo Chatwoot. El inbox tiene una pestaña
  // por método, y el no oficial (Evolution, por QR) funciona sin ninguna
  // credencial: pedir Chatwoot para entrar dejaba fuera de la tab a un cliente
  // que acababa de vincular su número y ya tenía sus conversaciones adentro.
  //
  // Y los PRODUCTOS del «+ Agregar al CRM» (pedido de Leila, 08/10/2026: todo nacía en el
  // principal y lo movía a mano). Van en el mismo `Promise.all` para no sumar un viaje en
  // serie, y con `leerFunnels`: `null` = no se pudieron leer, que la bandeja NO confunde con
  // «hay uno» (ahí el botón queda de un clic y decide el server).
  // ⛔ El canal OFICIAL corre sobre Chatwoot, que está APAGADO desde el 09/10/2026
  // (lib/chatwoot.ts): la pestaña no se muestra, aunque queden credenciales cargadas.
  const [oficial, noOficial, funnels] = await Promise.all([
    CHATWOOT_APAGADO ? false : integracionConectada('whatsapp'),
    listarLineas().then((ls) => ls.some((l) => l.estado === 'conectado')).catch(() => false),
    leerFunnels(),
  ]);
  const productos = productosParaAlta(funnels);
  await guardOnboarding();

  // WhatsApp tiene onboarding PROPIO (conectar y probar los dos métodos), y se
  // renderiza acá mismo: los pasos se comparten con el Chatbot, así que lo
  // que se haga acá no se vuelve a pedir allá.
  const faltaOnboarding = await onboardingTabPendiente('whatsapp');

  // ORDEN IMPORTANTE. Si no hay NINGÚN canal vivo, gana el onboarding —  que es
  // donde vive el QR para re-vincular.
  if (faltaOnboarding && !oficial && !noOficial) return <OnboardingCanalWhatsApp productos={productos} />;

  // ⛔ Y SIN canal vivo con el onboarding ya hecho, se sirve la BANDEJA, nunca el
  // PanelActivacion. Ese panel es el formulario de credenciales de CHATWOOT («WhatsApp
  // se prende con esto — Conecta tu cuenta por Chatwoot…»), y Chatwoot está apagado
  // desde el 09/10/2026. Medido ese día en el ws11: con su número desvinculado (o con
  // `listarLineas` fallando, que cae a false), la tab entera era ese formulario, sin
  // ningún camino al QR — Martín: «los clientes lo necesitan usar y eso lo bloquea».
  // La bandeja con el canal no oficial dibuja `EvolutionConnect`, que es el QR.
  // Lo fija tests/whatsapp-sin-chatwoot-gate.test.ts.
  //
  // Con algún canal vivo, la tab se sirve igual aunque el onboarding se haya
  // reabierto: reemplazarla entera dejaría al cliente sin su inbox y sin salida.
  // ¿Este usuario puede ABRIR /chatbot? Ahí viven ahora las plantillas de Meta, y /chatbot
  // es setter+admin (app/chatbot/page.tsx). Un closer entra a /whatsapp pero rebota de
  // /chatbot a /crm: ofrecerle «redactar plantilla» sería un botón que lo expulsa de la
  // pantalla donde estaba, con el chat abierto perdido.
  const rolWs = await getRolWsEfectivo();
  const puedeChatbot = rolWs == null || rolWs === 'admin' || rolWs === 'setter';
  // Vincular un número es config sensible: lo mismo que pide /api/whatsapp/evolution.
  const puedeAgregarLinea = rolWs == null || rolWs === 'admin';
  // El canal OFICIAL salió del producto (tarea #832): Meta cobra por mensaje y el no
  // oficial no tiene esa restricción. Se esconde para todos MENOS para quien ya lo tiene
  // conectado — ahí hay conversaciones reales, y sacarle la pestaña sería esconderle su
  // propio inbox. `oficial` ya está medido arriba con `integracionConectada('whatsapp')`.
  return <WhatsAppApp puedeChatbot={puedeChatbot} mostrarOficial={oficial} puedeAgregarLinea={puedeAgregarLinea} productos={productos} />;
}
