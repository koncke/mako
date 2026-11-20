'use client';

// =============================================================================
// Link — el que preserva el cliente que estás mirando
// =============================================================================
// Cuando el super admin abre un cliente, el workspace viaja en `?ws=N` (ver
// lib/ws-tab.ts). Un `<Link href="/crm">` común lo pierde, y perderlo significa
// que la navegación te devuelve a TU cuenta en el medio de estar mirando la de
// otro. No es peligroso —nunca te muestra un cliente que no pediste— pero es
// exactamente el tipo de cosa que hace que la feature no se use.
//
// Este envoltorio le pega el `?ws=` actual a los destinos internos. Se importa
// igual que el de Next, así que en las pantallas solo cambia la línea del import:
//
//     import Link from '@/app/_ui/Link';
//
// ⚠️ POR QUÉ HAY UN CONTEXTO Y NO `useSearchParams()` ACÁ ADENTRO. Se lee UNA vez,
// en el provider del layout, y de ahí baja por contexto: los demás solo consumen un
// número. El provider NO tiene un <Suspense> encima, a propósito (10/10/2026: escondía
// toda pantalla grande a quien no ejecuta JavaScript, ver app/layout.tsx). Funciona
// porque ninguna ruta se prerenderiza estática —el layout lee la sesión (cookies) en
// cada request— y `useSearchParams` sólo exige el boundary en una ruta estática.
//
// Sin provider el contexto vale null y todo se comporta como el Link de Next.

import { createContext, useContext, useMemo, type ComponentProps } from 'react';
import NextLink from 'next/link';
import { usePathname, useRouter as useNextRouter, useSearchParams } from 'next/navigation';
import { WS_PARAM, conWs, parseWs } from '@/lib/ws-tab';

const WsCtx = createContext<number | null>(null);

/** El workspace de la pestaña. null = estás en tu propia cuenta. */
export function useWs(): number | null {
  return useContext(WsCtx);
}

/**
 * Lee el `?ws=` una sola vez y lo reparte. Va en el layout, SIN <Suspense> encima: el
 * layout es dinámico, así que `useSearchParams` no lo necesita (ver app/layout.tsx).
 */
export function WsProvider({ children }: { children: React.ReactNode }) {
  const sp = useSearchParams();
  const ws = parseWs(sp.get(WS_PARAM));
  return <WsCtx.Provider value={ws}>{children}</WsCtx.Provider>;
}

type LinkProps = ComponentProps<typeof NextLink>;

/**
 * ¿Esta página es el onboarding? Ahí NADA prefetchea la app (20/11/2026, el bucle de «Entrar a MaKo» en producción): con el
 * onboarding pendiente, el servidor contesta un prefetch de /second-brain con «a /onboarding», el Router Cache del navegador lo guarda,
 * y al terminar la app y el onboarding se mandaban uno al otro hasta que vencía (~5 minutos).
 */
export const enElOnboarding = (ruta: string | null | undefined): boolean => !!ruta && (ruta === '/onboarding' || ruta.startsWith('/onboarding/'));

/** Igual que el `<Link>` de Next, pero se lleva el cliente puesto. En el onboarding, sin prefetch (`enElOnboarding`). */
export default function Link({ href, ...rest }: LinkProps) {
  const ws = useWs();
  const ruta = usePathname();
  // `href` también puede ser un objeto UrlObject. Ese caso se deja pasar tal
  // cual: no aparece en este repo y adivinarle la forma sería inventar un bug.
  const destino = typeof href === 'string' ? conWs(href, ws) : href;
  return <NextLink href={destino} {...rest} {...(enElOnboarding(ruta) ? { prefetch: false } : {})} />;
}

/**
 * El `useRouter` de Next con la misma cortesía, para los `router.push(...)`.
 * `back`, `forward`, `refresh` y `prefetch` pasan derecho.
 */
export function useRouter() {
  const router = useNextRouter();
  const ws = useWs();
  return useMemo(
    // Se listan los métodos a mano en vez de `{...router, push, replace}`: el
    // spread copia las funciones a un objeto nuevo, y si alguna dependiera de
    // `this` quedaría llamándose sobre el objeto equivocado. Envolverlas en
    // flechas que delegan en `router` no tiene esa duda.
    () => ({
      push: (href: string, opts?: Parameters<typeof router.push>[1]) => router.push(conWs(href, ws), opts),
      replace: (href: string, opts?: Parameters<typeof router.replace>[1]) => router.replace(conWs(href, ws), opts),
      // En el onboarding no se prefetchea la app (`enElOnboarding`, arriba).
      prefetch: (href: string, opts?: Parameters<typeof router.prefetch>[1]) => { if (!enElOnboarding(window.location.pathname)) router.prefetch(conWs(href, ws), opts); },
      back: () => router.back(),
      forward: () => router.forward(),
      refresh: () => router.refresh(),
    }),
    [router, ws],
  );
}
