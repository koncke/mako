// =============================================================================
// /chats — la bandeja unificada (WhatsApp + Instagram + Messenger), copiada de respond.io
// =============================================================================
// Pedido de Martín (14/10/2026): «tener en UNA sola tab centralizado absolutamente todos los chats,
// WhatsApp, Instagram, Messenger, etc… sobre todo el diseño que se vea bien». El plano es
// docs/diseno-chats.md; la pantalla entera vive en ChatsApp.tsx ('use client').
//
// Este wrapper hace lo de /whatsapp (app/whatsapp/page.tsx): el guard de la capa, el onboarding
// bloqueante, y los datos que la pantalla no puede pedir sola — el rol, el workspace (para las claves
// del navegador, AGENTS.md: el ws sale del server, nunca de leer `?ws=`) y los productos del
// «+ Agregar al CRM».
//
// ⚠️ SIN ONBOARDING PROPIO, a propósito: la tab ES la herramienta (el precedente es el CRM,
// tests/crm-entra-directo.test.ts). Sin ningún canal conectado, la pantalla lo dice en UNA frase
// con la salida a cada conexión. Ese estado vacío lo decide ChatsApp con lo que ya trae
// GET /api/chats (`lineas` + `cuentasSociales`), y NO acá: saber si hay una cuenta de Instagram o
// Messenger es preguntarle a Zernio (hasta 8 s, `estadoMedios`), y la lista ya lo pregunta; hacerlo
// también en el server era pagar la misma espera dos veces en cada carga.

import { guardOnboarding, requireCapa } from '@/lib/tab-access';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { leerFunnels } from '@/lib/funnels';
import { productosParaAlta } from '@/lib/lead-funnel-reglas';
import { ChatsApp } from './ChatsApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ChatsPage() {
  await requireCapa('chats');
  // Los productos del alta van en el mismo `Promise.all` que el resto: `leerFunnels` devuelve `null`
  // cuando no pudo leer, y el botón NO lo confunde con «hay uno» (ahí decide el server).
  const [funnels, rolWs, ws] = await Promise.all([leerFunnels(), getRolWsEfectivo(), getWorkspaceActual()]);
  const productos = productosParaAlta(funnels);
  await guardOnboarding();
  // El mismo criterio que /whatsapp («puedeAgregarLinea»): conectar un canal es config sensible.
  const esAdmin = rolWs == null || rolWs === 'admin';
  return <ChatsApp ws={ws} esAdmin={esAdmin} productos={productos} />;
}
