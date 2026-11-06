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

let promesa: Promise<boolean | null> | null = null;

/** La lectura, una vez por pestaña. Si falla, `null`: nunca se asume que SÍ es cliente de una agencia. */
export function leerClienteDeAgencia(): Promise<boolean | null> {
  promesa ??= fetch('/api/auth/me')
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j?.ok && j.autenticado ? j.clienteDeAgencia === true : null))
    .catch(() => null);
  return promesa;
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
