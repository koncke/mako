// El contador de acciones del navegador (5/11/2026, Admin › Activity): cuántas veces la persona hizo algo que escribe (una
// server action o un pedido que no es GET a nuestra api). Lo suma el parche de fetch (./WsFetch.tsx) y lo cosecha el medidor
// (./MedidorDeUso.tsx), que lo manda por lotes. Sin `'use client'`: es un módulo de datos del navegador; sin `server-only`:
// lo ejecuta el test. ⚠️ No guarda QUÉ se hizo ni a dónde: sólo cuántas veces (el encargo: sin contenido).

declare global {
  var __makoAcciones: number | undefined;
}

/** Lo que NO es una acción de la persona: la propia medición, los reportes de errores y lo que lee. */
const NO_CUENTA = [/^\/api\/actividad(\/|$|\?)/, /^\/api\/errores(\/|$|\?)/, /^\/api\/auth\/me(\/|$|\?)/, /^\/_next\//];

/** ¿Este pedido es una acción de la persona? Un método que escribe, a NUESTRO origen, y no la medición. */
export function esAccion(url: string, metodo: string | undefined, origen: string): boolean {
  const m = (metodo ?? 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return false;
  let ruta: string;
  try {
    const u = new URL(url, origen);
    if (u.origin !== origen) return false;
    ruta = u.pathname;
  } catch { return false; }
  return !NO_CUENTA.some((r) => r.test(ruta));
}

export function sumarAccion(): void {
  globalThis.__makoAcciones = (globalThis.__makoAcciones ?? 0) + 1;
}

/** Las acciones desde la última cosecha (y vuelve a cero). */
export function tomarAcciones(): number {
  const n = globalThis.__makoAcciones ?? 0;
  globalThis.__makoAcciones = 0;
  return n;
}
