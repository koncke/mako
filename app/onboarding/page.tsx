// =============================================================================
// /onboarding — el arranque de un cliente (bloqueante), y nada más
// =============================================================================
// Cliente con onboarding pendiente → el CHAT DE ARRANQUE (./ChatArranque.tsx): una conversación con MaKo,
// en el mismo chat de Offer. Reemplazó al wizard el 16/10/2026 (Martín: «Quiero que elimines todo lo que hay
// hoy en onboarding tal como está y que lo reemplaces por el chat de "Offer"»); el wizard, pantalla por
// pantalla, quedó escrito en docs/onboarding-pasos-anteriores.md. Lo mandan acá lib/tab-access.ts,
// app/inicio, lib/movil-guard.ts y app/m/configurar mientras esté pendiente.
//
// Onboarding terminado → Second Brain. Acá había un HUB con diez pestañas (matriz,
// diagnóstico, archivero, oferta, lead magnet, persona, personalidad, avatares, razones y
// ángulos), en el menú de la foto, y se RETIRÓ el 15/10/2026: Second Brain ya montaba las
// mismas diez vistas. Pedido de Martín: «Si, ponlo en second brain». Un link viejo
// (`?tab=persona`) llega a la MISMA sección: app/onboarding/tabs-catalogo.ts.

import { redirect } from 'next/navigation';
// ⚠️ `destinoDeTabVieja` SALE DEL `.ts`, NUNCA DE UN COMPONENTE `use client`: importada de
// uno, esto no recibe una función sino una referencia de cliente, y llamarla tiró la pantalla
// entera en producción el 29/09/2026. Ver app/onboarding/tabs-catalogo.ts.
import { destinoDeTabVieja } from './tabs-catalogo';
import { rutaConWs } from '@/lib/workspace';
import { ChatArranque } from './ChatArranque';
import { requireRolWs } from '@/lib/tab-access';
import { getEstadoOnboarding, pasosDeCapaActual } from '@/lib/onboarding-state';
import { vistaArranque } from '@/lib/onboarding-arranque-server';
import { OPCION_ARMAR } from '@/lib/offer-reglas';
import { ARBOL_VACIO } from '../offer/arbol';
// El onboarding se pinta OSCURO, sea cual sea el tema que el cliente tenga elegido.
// Pedido de Martín: «quiero que todo el onboarding sea en black mode». Las dos mitades
// hacen falta y no son un duplicado: el `<script>` corre antes del primer pintado (sin
// él hay un fogonazo blanco de pantalla completa) y el componente cliente cubre volver
// a esta ruta por navegación —donde no hay documento nuevo que parsear— y apagar el
// atributo al salir, para no dejarle la app oscura a quien no la eligió.
import { TemaOscuroScript } from '../_components/TemaOscuroScript';
import { TemaOscuro } from '../_components/TemaOscuro';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  // gateOnboarding:false — esta ES la página del wizard, no puede redirigirse sola.
  await requireRolWs([], { gateOnboarding: false });

  // Gating (pedido de Mauricio): mientras el onboarding NO esté 'done' se ve el chat de
  // arranque — NINGUNA tab — y al terminar se sigue a Second Brain. Aplica
  // TAMBIÉN al dueño (Mauricio usa MaKo para su propio negocio): /api/onboarding ahora
  // resuelve el dueño → OWNER_WS, así que el wizard carga bien, y esAdmin=true le da los
  // atajos (saltar sin conectar) para no quedar trabado. Una capa sin pasos → Second Brain.
  const estado = await getEstadoOnboarding();
  const pasos = await pasosDeCapaActual();
  const done = pasos.length === 0 || estado.status === 'done';
  // ⚠️ El tema oscuro se prende SOLO en la rama del wizard: lo que sigue es otra tab y tiene
  // que respetar el tema que el cliente eligió (el error del laboratorio de paletas, cuando un
  // tema de prueba terminó aplicado sobre la app de un cliente).
  if (!done) {
    const vista = await vistaArranque();
    return <><TemaOscuroScript /><TemaOscuro /><ChatArranque inicial={vista} arbolVacio={ARBOL_VACIO} opcionArmar={OPCION_ARMAR} /></>;
  }

  // Ya onboardeado → Second Brain, a la sección que pedía el link (`?tab=`), o a su portada.
  // `rutaConWs` y no el path pelado: sin el `?ws=` el super admin que mira a un cliente
  // terminaría en SU propio Second Brain (AGENTS.md, «Hay CINCO formas de navegar»).
  redirect(await rutaConWs(destinoDeTabVieja(tab)));
}
