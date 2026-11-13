'use client';

// =============================================================================
// useClienteDeAgencia — ¿esta cuenta es el cliente de una AGENCIA? (6/11/2026)
// =============================================================================
// Thiago (29/10/2026): «yo no me meto con ese cliente». A quien entró por una agencia, MaKo no le ofrece cambiar de plan:
// su plan lo cambia su agencia desde /agency. El Sidebar ya lo respetaba (`noParaClienteDeAgencia`, lib/nav-visibilidad.ts)
// y la barra de /m también, pero cada cartel de tope seguía ofreciendo «Pasar a Pro» con un link a /configuraciones/plan:
// el cliente de la agencia hacía clic y le pagaba a MaKo un plan que su agencia ya le paga.
//
// ⚠️ ES COSMÉTICO, como `nav-visibilidad`: el cierre de verdad es el guard de cada pantalla. Esconder el link no es la
//    defensa; es no ofrecerle al cliente una puerta que no le sirve.
//
// UNA sola lectura de /api/auth/me por pestaña (el molde es app/_components/SeccionesTab.tsx): el Sidebar ya hace la suya al
// montar, así que ésta se memoiza a nivel de módulo y los siete u ocho carteles que la piden comparten la misma promesa.
//
// `null` = todavía no se sabe. Quien dibuja un link lo trata como «no es cliente de agencia» (es el caso común, y estos
// carteles aparecen después de un error, cuando la lectura ya contestó): un `null` que esconda el link se lo esconde a
// todos en el primer dibujo.
// =============================================================================

import { useEffect, useState } from 'react';

/**
 * Lo que hace falta de /api/auth/me. `agenciaAdentroDe`: el ws del cliente cuando quien lo mira es SU agencia (#89).
 * `superAdminMira`: la agencia y el cliente cuando quien mira es el super admin y el cliente es de una agencia (`agencia` de
 * /api/auth/me, que sólo viene para él: lib/vista-de-otro.ts).
 */
type SuperAdminMira = { agenciaWs: number; clienteWs: number };
type QuienMira = { clienteDeAgencia: boolean; agenciaAdentroDe: number | null; superAdminMira: SuperAdminMira | null };
let promesa: Promise<QuienMira | null> | null = null;

function leerQuienMira(): Promise<QuienMira | null> {
  promesa ??= fetch('/api/auth/me')
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j?.ok && j.autenticado
      ? {
        clienteDeAgencia: j.clienteDeAgencia === true,
        agenciaAdentroDe: j.modoAgencia === true && Number(j.clienteWs) > 0 ? Number(j.clienteWs) : null,
        superAdminMira: j.rol === 'admin' && Number(j.agencia?.ws) > 0 && Number(j.clienteWs) > 0
          ? { agenciaWs: Number(j.agencia.ws), clienteWs: Number(j.clienteWs) } : null,
      }
      : null))
    .catch(() => null);
  return promesa;
}

/** ¿Quien mira es el SUPER ADMIN, adentro de un cliente de agencia? La agencia y el cliente, o null (12/11/2026). */
export function useSuperAdminMira(): SuperAdminMira | null {
  const [s, setS] = useState<SuperAdminMira | null>(null);
  useEffect(() => {
    let vivo = true;
    void leerQuienMira().then((q) => { if (vivo) setS(q?.superAdminMira ?? null); });
    return () => { vivo = false; };
  }, []);
  return s;
}

/** La lectura, una vez por pestaña. Si falla, `null`: nunca se asume que SÍ es cliente de una agencia. */
export function leerClienteDeAgencia(): Promise<boolean | null> {
  return leerQuienMira().then((q) => (q ? q.clienteDeAgencia : null));
}

/**
 * ¿Quien mira es la AGENCIA, adentro de un cliente suyo? El ws de ese cliente, o null (12/11/2026, ticket #89: el cartel de
 * tope le decía a la agencia «Pídele a tu agencia…»). La misma lectura que `useClienteDeAgencia`.
 */
export function useAgenciaAdentro(): number | null {
  const [ws, setWs] = useState<number | null>(null);
  useEffect(() => {
    let vivo = true;
    void leerQuienMira().then((q) => { if (vivo) setWs(q?.agenciaAdentroDe ?? null); });
    return () => { vivo = false; };
  }, []);
  return ws;
}

/**
 * ¿La cuenta es cliente de una agencia? `null` mientras no se sabe.
 *
 * Para esconder un link: `if (deAgencia) return null;` — con `null` se sigue dibujando.
 * Para cambiar un texto: `deAgencia ? 'Pídele a tu agencia que te pase a Pro' : 'Pasar a Pro'`.
 */
export function useClienteDeAgencia(): boolean | null {
  const [es, setEs] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    void leerClienteDeAgencia().then((v) => { if (vivo) setEs(v); });
    return () => { vivo = false; };
  }, []);
  return es;
}
