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
import { getWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { veOnboardingV2, esRevision } from '@/lib/onboarding-v2/revision';
import { esTelefono } from '@/lib/movil-guard';
import { ChatArranque, SeguirEnPc } from './ChatArranque';
import { ChatArranqueV2 } from './ChatArranqueV2';
import { requireRolWs } from '@/lib/tab-access';
import { getEstadoOnboarding, pasosDeCapaActual } from '@/lib/onboarding-state';
import { vistaArranque } from '@/lib/onboarding-arranque-server';
import { emailDelOnboarding, seguirEnPcPendiente } from '@/lib/seguir-en-pc';
import { mandarCorreoSeguirEnPc } from '@/lib/seguir-en-pc-correo';
import { primerNombre } from '@/lib/onboarding-arranque';
import { OPCION_ARMAR } from '@/lib/offer-reglas';
import { ARBOL_VACIO } from '../offer/arbol';
import { sembrarArranqueDesdeOrigen } from '@/lib/origen-negocio';
import { conRebote, onboardingDevuelveALaApp, vieneRebotado } from '@/lib/rebote-onboarding';
// El onboarding va en el tema de la app, CLARO como todo (17/10/2026, Martín: «El onboarding, que sea white mode,
// como todo»). Hasta ese día se forzaba oscuro con TemaOscuro/TemaOscuroScript; se fueron como en el Second Brain.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ tab?: string; rebote?: string }> }) {
  const { tab, rebote } = await searchParams;
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
  if (!done) {
    // De qué landing vino (23/10/2026, lib/origen-negocio.ts): lo que el origen ya contesta queda contestado, sin pisar nada.
    const wsOrigen = await getWorkspaceActual();
    const sesion = await getUsuarioActual().catch(() => null);
    const v2 = !!sesion && veOnboardingV2({ email: sesion.email, ws: wsOrigen });
    // En el V2 NO se siembra (20/11, OA-16): «¿Cómo llegaste a MaKo?» se pregunta siempre y la contesta ella. Con lo sembrado, el V2
    // salteaba la pregunta y dibujaba una burbuja «de ella» que nunca escribió. El V2 tampoco usa el `interes` sembrado (tiene los suyos).
    if (wsOrigen != null && !v2) await sembrarArranqueDesdeOrigen(wsOrigen);
    const vista = await vistaArranque();
    // ⚠️ `key` CON EL WORKSPACE (18/10/2026, Martín: al abrir otro negocio aparecieron las respuestas de «Consultesis»,
    // que sólo existían en el ws 3). El chat guarda la conversación en su estado (`useState(inicial)`), y pasar de un
    // `?ws=` a otro sin recargar deja montado el MISMO componente: React le pasa la vista nueva y él sigue mostrando las
    // respuestas del negocio anterior. Con la key, otro workspace es otro chat, de cero. tests/onboarding-otro-ws.test.ts.
    // El onboarding V2 en un TELÉFONO (18/11/2026): el primer paso acá y, al terminar, «Continuar el onboarding desde la PC».
    // Un teléfono es un teléfono aunque haya pedido la «Versión completa» (20/11, la verificación de OA-10).
    const seguirEnPc = v2 && (await esTelefono().catch(() => false));
    // Mirando el negocio como administrador, el email del DUEÑO (20/11, Martín: la vista como administrador muestra lo mismo que ve el
    // cliente; lib/seguir-en-pc.ts → personaDelOnboarding): con él va «Te mandamos el link a…» y lo que la pantalla recuerda por persona.
    // El dueño o nadie (`emailDelOnboarding`): mirando como administrador, nunca el correo del administrador.
    const persona = sesion ? { nombre: (sesion.nombre ?? '').trim().split(/\s+/)[0] ?? '', email: await emailDelOnboarding() } : undefined;
    const ws = await getWorkspaceActual();
    // EL ONBOARDING V2 (19/11/2026): el de la maqueta (./ChatArranqueV2.tsx). Con la guardia puesta, la pantalla de siempre (su aviso).
    if (vista.v2 && !vista.bloqueo) {
      return <ChatArranqueV2 inicial={vista} key={`ws-${ws ?? 'ninguno'}`} seguirEnPc={seguirEnPc} persona={persona} />;
    }
    return <ChatArranque inicial={vista} key={`ws-${ws ?? 'ninguno'}`} arbolVacio={ARBOL_VACIO} opcionArmar={OPCION_ARMAR} seguirEnPc={seguirEnPc} persona={persona} videos={v2 ? { revision: esRevision(v2, sesion?.email) } : null} />;
  }

  // EL TELÉFONO, ya terminado el primer paso: «Sigamos en tu computadora» cada vez que entra, hasta que vea el recorrido en la PC
  // (20/11, OA-10 y OD-12: antes era un estado de la pantalla, y al volver entraba a MaKo como siempre).
  if ((await esTelefono().catch(() => false)) && (await seguirEnPcPendiente())) {
    const sesionPc = await getUsuarioActual().catch(() => null);
    const vistaPc = await vistaArranque().catch(() => null);
    // La pantalla promete el correo: si el cierre no lo mandó (otro camino, o falló), sale ahora. Una vez por persona.
    await mandarCorreoSeguirEnPc();
    return <SeguirEnPc nombre={primerNombre(vistaPc?.nombre || sesionPc?.nombre || '')} email={await emailDelOnboarding()} maqueta />;
  }
  // Ya onboardeado → Second Brain, a la sección que pedía el link (`?tab=`), o a su portada.
  // `rutaConWs` y no el path pelado: sin el `?ws=` el super admin que mira a un cliente
  // terminaría en SU propio Second Brain (AGENTS.md, «Hay CINCO formas de navegar»).
  // ⚠️ EL CORTACIRCUITO (20/11/2026, lib/rebote-onboarding.ts: el ida y vuelta de ~7 minutos con la app). Si este pedido ACABA de
  // rebotar de la guarda de la app (que lo vio sin terminar), devolverlo es el bucle: se muestra «ya está listo» y entra con un toque.
  if (!onboardingDevuelveALaApp({ rebotado: vieneRebotado(rebote) })) {
    console.warn('[onboarding] /onboarding lo ve terminado y la guarda de la app no: «ya está listo», sin ida y vuelta');
    return <OnboardingYaListo href={await rutaConWs(destinoDeTabVieja(tab))} />;
  }
  redirect(await rutaConWs(conRebote(destinoDeTabVieja(tab), Date.now())));
}

/** El onboarding ya terminó y la app no lo dejó entrar recién (`?rebote=`): entra con un toque, con navegación completa. */
function OnboardingYaListo({ href }: { href: string }) {
  return (
    <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: '24px 16px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 420, display: 'grid', gap: 14, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>Tu onboarding ya está listo</h1>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: 'var(--dim)' }}>Entra a MaKo para seguir.</p>
        <a className="mk-btn mk-btn--md mk-btn--primary" href={href} data-onboarding-ya-listo="">Entrar a MaKo</a>
      </div>
    </main>
  );
}
