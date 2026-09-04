// =============================================================================
// /mako-puente.zip — el link viejo, que ahora SIEMPRE lleva a la última versión
// =============================================================================
//
// Hasta el 04/09/2026 acá había un archivo estático con nombre fijo. El nombre
// fijo tiene tres formas de servir bytes viejos, y las tres son silenciosas:
//
//   · el caché del navegador y el del CDN pueden contestar la descarga anterior
//     sobre la misma URL;
//   · y —la que más muerde— la carpeta de Descargas: si ya existe
//     `mako-puente.zip`, Chrome guarda la nueva como `mako-puente (1).zip` y la
//     carpeta descomprimida de antes sigue ahí, con el mismo nombre. La persona
//     carga la vieja y no tiene forma de saberlo.
//
// Este repo ya pagó esa última: un cliente estuvo horas corriendo una copia de la
// extensión de dos horas antes.
//
// El archivo real pasó a llamarse `mako-puente-<versión>.zip`, así que cada
// versión es una dirección distinta y ningún caché puede contestar la anterior.
// Esta ruta queda para que un link viejo —un marcador, una pestaña abierta desde
// antes, el instructivo de un deploy anterior— no dé 404 ni entregue algo viejo:
// **redirige a la que esté vigente hoy**.
//
// ⚠️ El redirect va SIN cachear. Si se cacheara, el link viejo se congelaría
// apuntando a la versión que estaba vigente cuando alguien lo abrió por primera
// vez — que es exactamente el problema que esta ruta viene a cerrar, movido un
// escalón más arriba.

import { NextResponse } from 'next/server';
import { EXTENSION_URL_ZIP } from '@/lib/extension-tienda';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET(req: Request) {
  return NextResponse.redirect(new URL(EXTENSION_URL_ZIP, req.url), {
    // 307 y no 301: un permanente lo guarda el navegador para siempre y la
    // próxima versión no lo podría mover. Lo que esta ruta promete es «la de
    // ahora», y eso cambia en cada release.
    status: 307,
    headers: { 'cache-control': 'no-store' },
  });
}
